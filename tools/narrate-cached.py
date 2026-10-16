"""Local cached Kokoro ONNX + faster-whisper runner; no media API calls."""
import argparse
import json
import os
import sys
import hashlib
import importlib.metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('story', nargs='?')
parser.add_argument('--model', default=str(Path.home()/'.cache/bili2yt/kokoro/kokoro-v1.0.onnx'))
parser.add_argument('--voices', default=str(Path.home()/'.cache/bili2yt/kokoro/voices-v1.0.bin'))
parser.add_argument('--voice', default='am_michael')
parser.add_argument('--speed', type=float, default=.92)
parser.add_argument('--speeds', help='JSON map of scene id -> Kokoro speed (overrides --speed per scene).')
parser.add_argument('--scene-ids', help='Comma-separated scene ids to synthesize from the complete storyboard (isolated auditions).')
parser.add_argument('--out', help='Output audio directory (default build/<slug>/audio).')
parser.add_argument('--reuse', action='store_true', help='Reuse matching per-scene raw clips; voice/model/text/rate must match.')
parser.add_argument('--deps', help='Reusable local Python dependency directory; otherwise discover an existing studio build environment.')
parser.add_argument('--fingerprint', action='store_true', help='Report installed synthesis/recognition provenance without loading models or writing files.')
args = parser.parse_args()
if not args.story and not args.fingerprint:
    parser.error('story is required unless --fingerprint is used')
story = json.loads(Path(args.story).read_text(encoding='utf-8')) if args.story else None
slug = story['project']['slug'] if story else 'provenance-probe'
build = ROOT/'build'/slug
deps = Path(args.deps) if args.deps else ROOT/'build'/'audio-python'/'pydeps'
if not deps.is_dir():
    deps = next((p for p in (ROOT/'build').glob('*/pydeps') if (p/'kokoro_onnx').is_dir()),build/'pydeps')
sys.path.insert(0,str(deps))
cached = Path.home()/'.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots/536b0662742c02347bc0e980a01041f333bce120'
RECOGNITION_VERSION = 3

def sha256(file):
    h = hashlib.sha256()
    with Path(file).open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()

def versions(names):
    result = {}
    for name in names:
        try: result[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError: result[name] = None
    return result

def package_sources(name):
    directory = deps/name
    return {str(p.relative_to(directory)): sha256(p) for p in sorted(directory.rglob('*.py'))} if directory.is_dir() else {}

provenance = dict(version=1,
    synthesis=dict(model_sha256=sha256(args.model), voices_sha256=sha256(args.voices),
        python=sys.version.split()[0], runtime=versions(['kokoro-onnx','onnxruntime','numpy','phonemizer-fork','espeakng-loader','misaki']),
        implementation=package_sources('kokoro_onnx'), language='en-us', processing='finite-mono-trim-headroom-minus1db-v1'),
    recognition=dict(model={p.name: sha256(p) for p in sorted(cached.iterdir()) if p.is_file()},
        python=sys.version.split()[0], runtime=versions(['faster-whisper','ctranslate2','numpy']),
        implementation=package_sources('faster_whisper'), version=RECOGNITION_VERSION,
        settings=dict(language='en',beam_size=5,temperature=0,vad_filter=False,condition_on_previous_text=False,initial_prompt=None)))
if args.fingerprint:
    print(json.dumps(provenance, sort_keys=True))
    raise SystemExit(0)
scenes = story['scenes']
if args.scene_ids is not None:
    if not args.out:
        parser.error('--scene-ids requires an explicit isolated --out directory')
    selected = [value.strip() for value in args.scene_ids.split(',')]
    known = {sc['id'] for sc in scenes}
    if len(selected) != len(set(selected)) or any(value not in known for value in selected):
        parser.error('--scene-ids must contain unique ids present in the storyboard')
    scenes = [sc for sc in scenes if sc['id'] in selected]
os.environ.setdefault('OMP_NUM_THREADS','4')
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from faster_whisper import WhisperModel

out = Path(args.out) if args.out else build/'audio'
speeds = json.loads(args.speeds) if args.speeds else {}
(out/'narration').mkdir(parents=True,exist_ok=True)
tts = asr = None

def recognize(file):
    """Recognize the actual saved PCM without priming Whisper with the expected utterance."""
    global asr
    if asr is None:
        asr = WhisperModel(str(cached),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
    pcm, sample_rate = sf.read(file,dtype='float32')
    if pcm.ndim != 1 or not len(pcm) or not np.all(np.isfinite(pcm)):
        raise RuntimeError(f'{file}: invalid mono narration PCM')
    audio16 = np.interp(np.arange(int(len(pcm)*16000/sample_rate))*sample_rate/16000,np.arange(len(pcm)),pcm).astype(np.float32)
    segments,_ = asr.transcribe(audio16,language='en',word_timestamps=True,beam_size=5,temperature=0,vad_filter=False,condition_on_previous_text=False)
    segments = list(segments)
    heard = [dict(text=w.word.strip(),start=w.start,end=w.end,probability=w.probability) for seg in segments for w in seg.words]
    return dict(heardText=' '.join(seg.text.strip() for seg in segments),heard=heard,recognition_version=RECOGNITION_VERSION,
        recognition_provenance=provenance['recognition'], recognition_diagnostics=[dict(start=s.start,end=s.end,avg_logprob=s.avg_logprob,no_speech_prob=s.no_speech_prob) for s in segments])

def voice_style(engine, spec):
    """A Kokoro voice id, or a weighted blend such as 'am_michael*0.7+am_onyx*0.3': the style vectors are averaged
    (weights normalised), giving a distinct but stable narrator without a new model. Deterministic for a given spec."""
    if '+' not in spec and '*' not in spec:
        return spec
    names, weights = [], []
    for part in spec.split('+'):
        name, _, weight = part.strip().partition('*')
        names.append(name.strip()); weights.append(float(weight) if weight else 1.0)
    unknown = [n for n in names if n not in engine.voices]
    if unknown or any(not np.isfinite(w) or w <= 0 for w in weights) or len(set(names)) != len(names):
        raise ValueError(f'invalid voice blend {spec!r}: unknown voices {unknown} or non-positive/duplicate weights')
    total = sum(weights)
    return sum(engine.get_voice_style(n).astype(np.float64) * (w / total) for n, w in zip(names, weights)).astype(np.float32)

result = dict(slug=slug,engine='kokoro_local',model='Kokoro-82M v1.0 ONNX',voice=args.voice,speed=args.speed,provenance=provenance,aligner='faster-whisper-small int8 local; unprompted beam5 temperature0 PCM',license=f'Kokoro weights: Apache-2.0; voice {args.voice} supplied by Kokoro; Whisper: MIT',scenes=[])
raw_file = out/'narration-raw.json'
previous = json.loads(raw_file.read_text(encoding='utf-8')) if args.reuse and raw_file.is_file() else {}
compatible = (previous.get('engine') == result['engine'] and previous.get('model') == result['model']
              and previous.get('voice') == args.voice and previous.get('provenance',{}).get('synthesis') == provenance['synthesis'])
previous_scenes = {r['id']: r for r in previous.get('scenes', [])} if compatible else {}
for sc in scenes:
    text = sc['narration']['text']
    speed = float(speeds.get(sc['id'],args.speed))
    old = previous_scenes.get(sc['id'])
    old_path = (out/old.get('file', '')).resolve() if old else None
    if (old and old.get('text') == text and abs(float(old.get('speed', previous.get('speed', 0))) - speed) < 1e-6
            and old_path.is_relative_to(out.resolve()) and old_path.is_file() and old.get('source_sha256') == sha256(old_path)):
        if old.get('recognition_provenance') != provenance['recognition']:
            old = {**old,**recognize(old_path)}
            print(f'{sc["id"]}: refreshed recognition from unchanged raw PCM at speed {speed:.2f}',flush=True)
        else:
            print(f'{sc["id"]}: reused raw clip and recognition at speed {speed:.2f}',flush=True)
        result['scenes'].append(old)
        raw_file.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
        continue
    if tts is None:
        tts = Kokoro(args.model,args.voices)
        style = voice_style(tts,args.voice)
    samples,sr = tts.create(text,voice=style,speed=speed,lang='en-us')
    if samples.ndim != 1 or not len(samples) or not np.all(np.isfinite(samples)):
        raise RuntimeError(f'{sc["id"]}: invalid finite mono voice output')
    original_peak = float(np.max(np.abs(samples)))
    if original_peak == 0:
        raise RuntimeError(f'{sc["id"]}: silent voice output')
    gain = min(1.0,10**(-1/20)/original_peak)
    samples = samples * gain
    active = np.flatnonzero(np.abs(samples)>.006)
    if not len(active):
        raise RuntimeError(f'{sc["id"]}: empty voice output')
    samples = samples[max(0,int(active[0]) - int(.05*sr)):min(len(samples),int(active[-1])+int(.10*sr))]
    file = f'narration/{sc["id"]}.wav'
    sf.write(out/file,samples,sr,subtype='PCM_16')
    recognition = recognize(out/file)
    stored,_ = sf.read(out/file,dtype='float32')
    source_measurement = dict(original_peak=original_peak,gain=gain,stored_peak=float(np.max(np.abs(stored))),
        full_scale_samples=int(np.sum(np.abs(stored)>=32767/32768)),headroom_dbfs=-1)
    result['scenes'].append(dict(id=sc['id'],text=text,speed=speed,file=file,sampleRate=sr,duration=len(samples)/sr,
        source_sha256=sha256(out/file),source_measurement=source_measurement,**recognition))
    (out/'narration-raw.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(f'{sc["id"]}: {len(samples)/sr:.2f}s at speed {speed:.2f}, {len(recognition["heard"])} aligned words',flush=True)

