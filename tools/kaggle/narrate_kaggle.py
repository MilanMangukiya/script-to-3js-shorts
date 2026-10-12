#!/usr/bin/env python3
"""Kaggle GPU narration job for the What-If Shorts studio (template filled in by tools/narrate-kaggle.mjs).

Kokoro-82M (PyTorch, CUDA) speaks each scene's exact narration with the storyboard's voice and speed, and Whisper
small.en (CUDA) returns word timestamps for the real audio. Clips are trimmed exactly like tools/lib/align.mjs and
written as 16-bit mono WAV, so the local tool only has to align the words and write narration.json.

Outputs in /kaggle/working: <scene>.wav for every scene and raw.json (tagged with the job's run_id).
"""
import base64
import json
import os
import subprocess
import sys
import time
import wave

JOB = json.loads(base64.b64decode("__JOB_B64__").decode("utf-8"))
OUT = "/kaggle/working"
T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:6.1f}s] {msg}", flush=True)


log(f"job {JOB['slug']}: {len(JOB['scenes'])} scenes, voice {JOB['voice']}, speed {JOB['speed']}")
# kokoro and misaki are pure Python but pin Python < 3.13 in their metadata, while Kaggle images now run Python 3.13:
# install those two without the version check, then their dependencies (which do support 3.13) normally.
PIP = [sys.executable, "-m", "pip", "install", "-q"]
subprocess.run(PIP + ["--no-deps", "--ignore-requires-python", "kokoro>=0.9.4", "misaki>=0.9.4"], check=True)
subprocess.run(PIP + ["loguru", "addict", "regex", "huggingface_hub", "espeakng-loader", "num2words", "phonemizer-fork"], check=True)
# Optional espeak-ng fallback for unusual words (misaki already ships espeakng-loader).
subprocess.run("apt-get -qq -y install espeak-ng > /dev/null 2>&1", shell=True)

import numpy as np  # noqa: E402
import torch  # noqa: E402
from kokoro import KPipeline  # noqa: E402
from scipy.signal import resample_poly  # noqa: E402
from transformers import pipeline as hf_pipeline  # noqa: E402

device = "cuda" if torch.cuda.is_available() else "cpu"
gpu = torch.cuda.get_device_name(0) if device == "cuda" else "none"
log(f"device {device} ({gpu}), torch {torch.__version__}")
TTS_MODEL = "hexgrad/Kokoro-82M"
ASR_MODEL = "openai/whisper-small.en"
tts = KPipeline(lang_code="a", repo_id=TTS_MODEL, device=device)
asr = hf_pipeline("automatic-speech-recognition", model=ASR_MODEL, device=0 if device == "cuda" else -1, torch_dtype=torch.float32)
log("models loaded")

SR = 24000  # Kokoro output rate


def trim_silence(x, sr, thr=0.006, pad_s=0.05):
    """Same rule as trimSilence() in tools/lib/align.mjs."""
    n = len(x)
    loud = np.nonzero(np.abs(x) >= thr)[0]
    a, b = (int(loud[0]), int(loud[-1])) if len(loud) else (n - 1, n - 1)
    a = max(0, a - round(pad_s * sr))
    b = min(n - 1, b + round(pad_s * 2 * sr))
    return x[a:b + 1]


def write_wav16(path, x, sr):
    """Same encoding as writeWav() in tools/lib/wav.mjs: clamp, scale by 32767, 16-bit PCM mono."""
    pcm = np.round(np.clip(x, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def synthesize(text):
    parts = []
    for result in tts(text, voice=JOB["voice"], speed=JOB["speed"], split_pattern=None):
        audio = result.audio if hasattr(result, "audio") else result[2]
        if audio is not None:
            parts.append(audio.detach().cpu().float().numpy() if hasattr(audio, "detach") else np.asarray(audio, dtype=np.float32))
    if not parts:
        raise RuntimeError(f"Kokoro returned no audio for: {text[:60]}")
    return np.concatenate(parts).astype(np.float32)


raw = {
    "run_id": JOB.get("run_id"),
    "slug": JOB["slug"],
    "engine": "kokoro_kaggle_gpu",
    "model": TTS_MODEL,
    "voice": JOB["voice"],
    "speed": JOB["speed"],
    "aligner": ASR_MODEL,
    "device": gpu,
    "scenes": [],
}
for sc in JOB["scenes"]:
    audio = trim_silence(synthesize(sc["text"]), SR)
    duration = len(audio) / SR
    file = f"{sc['id']}.wav"
    write_wav16(os.path.join(OUT, file), audio, SR)
    x16 = resample_poly(audio, 2, 3).astype(np.float32)  # 24 kHz -> 16 kHz for Whisper
    out = asr({"raw": x16, "sampling_rate": 16000}, return_timestamps="word", chunk_length_s=30)
    heard = []
    for c in out.get("chunks", []):
        start, end = c["timestamp"]
        start = float(start) if start is not None else 0.0
        end = float(end) if end is not None else start
        heard.append({"text": c["text"], "start": start, "end": end})
    raw["scenes"].append({
        "id": sc["id"], "text": sc["text"], "file": file, "sample_rate": SR,
        "duration_s": duration, "heard_text": out["text"], "heard": heard,
    })
    words = len(sc["text"].split())
    log(f"{sc['id']} {duration:.2f}s {words}w {words / duration * 60:.0f}wpm | {out['text'].strip()}")

with open(os.path.join(OUT, "raw.json"), "w", encoding="utf-8") as f:
    json.dump(raw, f, ensure_ascii=False, indent=1)
log("done")
