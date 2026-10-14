"""Set scene narration cadence with pitch-preserving tempo and real Whisper alignment.

Usage: python scripts/pace_story_narration.py <slug>
Then run tools/narrate.mjs with --reuse to assemble the paced scene clips.
"""
import argparse
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
RATES = (155, 155, 155, 155, 145, 135, 130, 130, 130)


def tempo_filters(rate):
    """Keep each atempo stage within 0.5..2 for good pitch-preserving output."""
    if not math.isfinite(rate) or rate <= 0:
        raise ValueError(f"Invalid tempo rate: {rate}")
    factors = []
    while rate > 2:
        factors.append(2.0)
        rate /= 2
    while rate < .5:
        factors.append(.5)
        rate *= 2
    factors.append(rate)
    return ','.join(f'atempo={factor:.10f}' for factor in factors)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('slug', help='Storyboard slug, for example last-woman-alive')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.slug):
        parser.error('slug must contain only lowercase letters, digits, and separating hyphens')
    build = (ROOT / 'build' / args.slug).resolve()
    audio = build / 'audio'
    rawfile = audio / 'narration-raw.json'
    story = json.loads((ROOT / 'stories' / f'{args.slug}.json').read_text(encoding='utf-8'))
    raw = json.loads(rawfile.read_text(encoding='utf-8'))
    if story['project']['slug'] != args.slug or raw.get('slug') != args.slug:
        raise ValueError('Storyboard and narration must both match the requested slug')

    raw_scenes = {scene['id']: scene for scene in raw['scenes']}
    work = []
    for index, scene in enumerate(story['scenes']):
        sc = raw_scenes.get(scene['id'])
        if sc is None or sc.get('text') != scene['narration']['text']:
            raise ValueError(f"{scene['id']}: narration is missing or stale; synthesize it first")
        file = (audio / sc['file']).resolve()
        if not file.is_relative_to(build):
            raise ValueError(f"{scene['id']}: clip path leaves this story's build directory")
        if not file.is_file():
            raise FileNotFoundError(file)
        original = file.with_suffix('.source.wav')
        if 'tempo_adjustment' in sc and not original.is_file():
            raise FileNotFoundError(f'{original}: paced clips require their original source')
        max_duration = float(scene['end_s']) - float(scene['narration']['start_s']) - .15
        if max_duration <= 0:
            raise ValueError(f"{scene['id']}: narration has no usable scene window")
        words = len(sc['text'].split())
        if words == 0:
            raise ValueError(f"{scene['id']}: empty narration text")
        number = int(scene['id'][1:]) if re.fullmatch(r'S\d+', scene['id']) else index + 1
        target_wpm = RATES[min(max(number - 1, 0), len(RATES) - 1)]
        target = min(words / target_wpm * 60, max_duration)
        work.append((sc, file, original, target, target_wpm))

    # Share the studio's existing local environment without creating bytecode outside this build.
    sys.dont_write_bytecode = True
    deps = ROOT / 'build' / 'audio-python' / 'pydeps'
    if not deps.is_dir():
        deps = next((p for p in (ROOT / 'build').glob('*/pydeps')
                     if (p / 'kokoro_onnx').is_dir()), build / 'pydeps')
    sys.path.insert(0, str(deps))
    os.environ.setdefault('OMP_NUM_THREADS', '4')
    import numpy as np
    import soundfile as sf
    from faster_whisper import WhisperModel

    ffmpeg = ROOT / 'node_modules' / 'ffmpeg-static' / ('ffmpeg.exe' if os.name == 'nt' else 'ffmpeg')
    model = (Path.home() / '.cache' / 'huggingface' / 'hub' /
             'models--Systran--faster-whisper-small' / 'snapshots' /
             '536b0662742c02347bc0e980a01041f333bce120')
    asr = WhisperModel(str(model), device='cpu', compute_type='int8',
                       cpu_threads=4, local_files_only=True)
    for sc, file, original, target, target_wpm in work:
        # A fresh synthesis resets raw metadata, so refresh its source even if a stale copy exists.
        # On repeated pacing runs, always start from the same untouched source.
        if 'tempo_adjustment' not in sc:
            shutil.copyfile(file, original)
        samples, sr = sf.read(original)
        if len(samples) == 0:
            raise ValueError(f"{sc['id']}: empty source clip")
        rate = (len(samples) / sr) / target
        subprocess.run([str(ffmpeg), '-y', '-hide_banner', '-loglevel', 'error',
                        '-i', str(original), '-af', tempo_filters(rate), '-ar', str(sr),
                        str(file)], check=True)
        samples, sr = sf.read(file)
        mono = samples.mean(axis=1) if samples.ndim > 1 else samples
        audio16 = np.interp(np.arange(int(len(mono) * 16000 / sr)) * sr / 16000,
                            np.arange(len(mono)), mono).astype(np.float32)
        segments, _ = asr.transcribe(audio16, language='en', word_timestamps=True,
                                    beam_size=5, temperature=0, vad_filter=False,
                                    condition_on_previous_text=False)
        segments = list(segments)
        heard = [dict(text=w.word.strip(), start=w.start, end=w.end)
                 for segment in segments for w in (segment.words or [])]
        sc.update(duration=len(samples) / sr, sampleRate=sr,
                  heardText=' '.join(segment.text.strip() for segment in segments),
                  heard=heard, tempo_adjustment=rate)
        pending = rawfile.with_suffix('.pending.json')
        pending.write_text(json.dumps(raw, indent=2) + '\n', encoding='utf-8')
        pending.replace(rawfile)
        print(sc['id'], f"{sc['duration']:.2f}s", f'target {target_wpm}wpm',
              f'tempo {rate:.3f}', sc['heardText'], flush=True)


if __name__ == '__main__':
    main()
