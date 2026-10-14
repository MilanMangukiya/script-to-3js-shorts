"""Pitch-preserving cadence correction followed by actual Whisper re-alignment."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'build/every-human-jumped-at-once/pydeps'))
os.environ.setdefault('OMP_NUM_THREADS', '4')
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

audio = ROOT/'build/last-man-alive/audio'
rawfile = audio/'narration-raw.json'
raw = json.loads(rawfile.read_text())
ffmpeg = ROOT/'node_modules/ffmpeg-static/ffmpeg.exe'
model = Path.home()/'.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots/536b0662742c02347bc0e980a01041f333bce120'
asr = WhisperModel(str(model), device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
rates = [155, 155, 155, 155, 155, 145, 132, 130, 130]
for i, sc in enumerate(raw['scenes']):
    file = audio/sc['file']
    original = file.with_suffix('.source.wav')
    if not original.exists(): shutil.copyfile(file, original)
    samples, sr = sf.read(original)
    target = len(sc['text'].split())/rates[i]*60
    rate = (len(samples)/sr)/target
    subprocess.run([str(ffmpeg), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(original), '-af', f'atempo={rate:.8f}', '-ar', str(sr), str(file)], check=True)
    samples, sr = sf.read(file)
    audio16 = np.interp(np.arange(int(len(samples)*16000/sr))*sr/16000, np.arange(len(samples)), samples).astype(np.float32)
    # A second decode without prompting avoids the occasional short-clip prompt hallucination.
    segs, _ = asr.transcribe(audio16, language='en', word_timestamps=True, beam_size=5, vad_filter=False, temperature=0, condition_on_previous_text=False)
    segs = list(segs)
    heard = [dict(text=w.word.strip(), start=w.start, end=w.end) for s in segs for w in s.words]
    sc.update(duration=len(samples)/sr, sampleRate=sr, heardText=' '.join(s.text.strip() for s in segs), heard=heard, tempo_adjustment=rate)
    print(sc['id'], f'{len(samples)/sr:.2f}s', sc['heardText'], flush=True)
rawfile.write_text(json.dumps(raw, indent=2)+'\n')
