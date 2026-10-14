"""Local cached Kokoro ONNX + faster-whisper runner; no media API calls."""
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('story')
parser.add_argument('--model', default=str(Path.home()/'.cache/bili2yt/kokoro/kokoro-v1.0.onnx'))
parser.add_argument('--voices', default=str(Path.home()/'.cache/bili2yt/kokoro/voices-v1.0.bin'))
parser.add_argument('--voice', default='am_michael')
parser.add_argument('--speed', type=float, default=.92)
parser.add_argument('--speeds', help='JSON map of scene id -> Kokoro speed (overrides --speed per scene).')
parser.add_argument('--out', help='Output audio directory (default build/<slug>/audio).')
parser.add_argument('--deps', help='Reusable local Python dependency directory; otherwise discover an existing studio build environment.')
args = parser.parse_args()
story = json.loads(Path(args.story).read_text(encoding='utf-8'))
slug = story['project']['slug']
build = ROOT/'build'/slug
deps = Path(args.deps) if args.deps else ROOT/'build'/'audio-python'/'pydeps'
if not deps.is_dir():
    deps = next((p for p in (ROOT/'build').glob('*/pydeps') if (p/'kokoro_onnx').is_dir()),build/'pydeps')
sys.path.insert(0,str(deps))
os.environ.setdefault('OMP_NUM_THREADS','4')
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from faster_whisper import WhisperModel

out = Path(args.out) if args.out else build/'audio'
speeds = json.loads(args.speeds) if args.speeds else {}
(out/'narration').mkdir(parents=True,exist_ok=True)
tts = Kokoro(args.model,args.voices)
cached = Path.home()/'.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots/536b0662742c02347bc0e980a01041f333bce120'
asr = WhisperModel(str(cached),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
result = dict(slug=slug,engine='kokoro_local',model='Kokoro-82M v1.0 ONNX',voice=args.voice,speed=args.speed,aligner='faster-whisper-small int8 local',license='Kokoro weights: Apache-2.0; voice am_michael supplied by Kokoro; Whisper: MIT',scenes=[])
for sc in story['scenes']:
    text = sc['narration']['text']
    speed = float(speeds.get(sc['id'],args.speed))
    samples,sr = tts.create(text,voice=args.voice,speed=speed,lang='en-us')
    active = np.flatnonzero(np.abs(samples)>.006)
    if not len(active):
        raise RuntimeError(f'{sc["id"]}: empty voice output')
    samples = samples[max(0,int(active[0]) - int(.05*sr)):min(len(samples),int(active[-1])+int(.10*sr))]
    file = f'narration/{sc["id"]}.wav'
    sf.write(out/file,samples,sr,subtype='PCM_16')
    audio16 = np.interp(np.arange(int(len(samples)*16000/sr))*sr/16000,np.arange(len(samples)),samples).astype(np.float32)
    segments,_ = asr.transcribe(audio16,language='en',word_timestamps=True,beam_size=3,vad_filter=False,initial_prompt=text,condition_on_previous_text=False)
    segments = list(segments)
    heard = [dict(text=w.word.strip(),start=w.start,end=w.end) for seg in segments for w in seg.words]
    result['scenes'].append(dict(id=sc['id'],text=text,speed=speed,file=file,sampleRate=sr,duration=len(samples)/sr,heardText=' '.join(seg.text.strip() for seg in segments),heard=heard))
    (out/'narration-raw.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(f'{sc["id"]}: {len(samples)/sr:.2f}s at speed {speed:.2f}, {len(heard)} aligned words',flush=True)

