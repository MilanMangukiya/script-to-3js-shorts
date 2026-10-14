#!/usr/bin/env node
/**
 * tools/soundtrack.mjs — Procedural Soundtrack Renderer & -14.0 LUFS Master Mixer
 *
 * Usage: node tools/soundtrack.mjs <slug>
 *
 * 1. Loads `stories/<slug>.json` and `src/stories/<slug>/soundtrack.mjs` (`buildSoundtrack(duration)`).
 * 2. Applies any `"silence"` cues from `scenes[].audio_cues` as a -24 dB pre-impact vacuum
 *    on the music/ambience beds so subsequent `"impact"` transients cut through cleanly.
 * 3. Mixes narration (`build/<slug>/audio/narration.wav`) on top of music and SFX, then
 *    runs FFmpeg EBU R128 loudness normalization to -14.0 LUFS (true peak <= -1.0 dBTP)
 *    into `build/<slug>/audio/mix.wav` (48 kHz stereo).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import {
  DEFAULT_SAMPLE_RATE,
  createStereoBuffer,
  dbToGain,
  mixIn,
  applyPreImpactVacuum,
} from '../src/library/audio/synth.mjs';

function writeWavFile(filePath, stereoBuffer) {
  const sr = stereoBuffer.sampleRate || DEFAULT_SAMPLE_RATE;
  const numSamples = stereoBuffer.length;
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * numChannels * bytesPerSample, 28);
  buf.writeUInt16LE(numChannels * bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, stereoBuffer.left[i] || 0));
    const r = Math.max(-1, Math.min(1, stereoBuffer.right[i] || 0));
    buf.writeInt16LE(Math.round(l * 32767), offset);
    buf.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node tools/soundtrack.mjs <slug>');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const storyPath = path.join(repoRoot, 'stories', `${slug}.json`);
  if (!fs.existsSync(storyPath)) {
    console.error(`Missing storyboard: ${storyPath}`);
    process.exit(1);
  }

  const storyboard = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
  const duration_s = storyboard.project.duration_s;

  // Target -14.0 LUFS and -1.0 dBTP true peak for viral short-form loudness
  const targetLufs = Math.max(
    -16.0,
    Math.min(-12.0, storyboard.audio?.mix_target_lufs ?? -14.0)
  );
  const truePeakDbtp = Math.min(-1.0, storyboard.audio?.true_peak_max_dbtp ?? -1.0);
  const musicDbBelowVoice = storyboard.audio?.music_level_db_below_voice ?? -17;

  const soundtrackModulePath = path.join(
    repoRoot,
    'src',
    'stories',
    slug,
    'soundtrack.mjs'
  );
  if (!fs.existsSync(soundtrackModulePath)) {
    console.error(`Missing soundtrack module: ${soundtrackModulePath}`);
    process.exit(1);
  }

  const soundtrackMod = await import(pathToFileURL(soundtrackModulePath).href);
  const built = await soundtrackMod.buildSoundtrack(duration_s, storyboard);
  // Soundtracks written against the earlier synth API return { L, R, sr }: adapt them to { left, right, sampleRate }.
  const asStereo = (b) => (b && b.L && !b.left ? { sampleRate: b.sr ?? DEFAULT_SAMPLE_RATE, length: b.L.length, duration_s: b.L.length / (b.sr ?? DEFAULT_SAMPLE_RATE), left: b.L, right: b.R } : b);
  const music = asStereo(built.music), sfx = asStereo(built.sfx);

  const bedBuffer = createStereoBuffer(duration_s, DEFAULT_SAMPLE_RATE);
  const musicGain = dbToGain(musicDbBelowVoice);

  if (music) {
    mixIn(bedBuffer, music, 0, musicGain, 0);
  }

  // Apply pre-impact acoustic vacuum ("silence" cues in storyboard.scenes[].audio_cues)
  for (const scene of storyboard.scenes || []) {
    for (const cue of scene.audio_cues || []) {
      if (cue.kind === 'silence') {
        applyPreImpactVacuum(bedBuffer, {
          at_s: cue.at_s,
          duration_s: cue.duration_s,
          duckDb: cue.relative_db ?? -24,
        });
      }
    }
  }

  // Mix foreground SFX after vacuum ducking so impact transients hit at full authority
  if (sfx) {
    mixIn(bedBuffer, sfx, 0, 1.0, 0);
  }

  const audioBuildDir = path.join(repoRoot, 'build', slug, 'audio');
  fs.mkdirSync(audioBuildDir, { recursive: true });
  const bedWavPath = path.join(audioBuildDir, 'bed_unmixed.wav');
  writeWavFile(bedWavPath, bedBuffer);

  const narrationWavPath = path.join(audioBuildDir, 'narration.wav');
  const finalMixWavPath = path.join(audioBuildDir, 'mix.wav');
  const bin = ffmpegPath || 'ffmpeg';

  // 1) Pre-mix (float, no normalisation): voice over the bed, the bed side-chain ducked under the voice. The voice is
  //    split so it can feed both the ducker key and the mix (an FFmpeg label can only be consumed once).
  const premixPath = path.join(audioBuildDir, 'premix.wav');
  const hasVoice = fs.existsSync(narrationWavPath);
  const premix = spawnSync(bin, hasVoice
    ? ['-y', '-hide_banner', '-loglevel', 'error', '-i', narrationWavPath, '-i', bedWavPath, '-filter_complex', [
        `[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,asplit=2[voice][key]`,
        `[1:a]aresample=48000[bed]`,
        `[bed][key]sidechaincompress=threshold=0.035:ratio=3.5:attack=15:release=220[ducked]`,
        `[voice][ducked]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0:weights='1.25 0.95'[out]`,
      ].join(';'), '-map', '[out]', '-c:a', 'pcm_f32le', '-ar', '48000', '-ac', '2', '-t', String(duration_s), premixPath]
    : ['-y', '-hide_banner', '-loglevel', 'error', '-i', bedWavPath, '-c:a', 'pcm_f32le', '-ar', '48000', '-ac', '2', '-t', String(duration_s), premixPath], { stdio: 'inherit' });
  if (premix.status !== 0) process.exit(premix.status ?? 1);

  // 2) Linear loudness normalisation: measure integrated loudness (EBU R128), apply the gain, and catch peaks with a
  //    limiter set below the true-peak ceiling (sample-peak limiter, so keep margin for inter-sample and AAC overshoot). Repeat
  //    the measure → gain step until the integrated loudness is within 0.2 LU of the target.
  const measure = (file) => {
    const r = spawnSync(bin, ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=I=${targetLufs}:TP=${truePeakDbtp}:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
    const j = JSON.parse((r.stderr.match(/\{[\s\S]*?\}/g) ?? []).pop() ?? '{}');
    return { I: Number(j.input_i), TP: Number(j.input_tp) };
  };
  // ~1.4 dB under the ceiling: sample-peak limiting plus AAC encoder overshoot in the final MP4.
  const limit = Math.pow(10, (truePeakDbtp - 1.4) / 20);
  let gain = targetLufs - measure(premixPath).I, result = { I: NaN, TP: NaN };
  for (let pass = 0; pass < 4; pass++) {
    const r = spawnSync(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-i', premixPath, '-af', `volume=${gain.toFixed(3)}dB,alimiter=limit=${limit.toFixed(4)}:attack=4:release=60:level=false`,
      '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-t', String(duration_s), finalMixWavPath], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
    result = measure(finalMixWavPath);
    if (Math.abs(result.I - targetLufs) <= 0.2) break;
    gain += targetLufs - result.I;
  }
  fs.rmSync(premixPath, { force: true });

  console.log(
    `[soundtrack] Mixed ${finalMixWavPath} (${duration_s}s) | integrated ${result.I.toFixed(1)} LUFS (target ${targetLufs}), true peak ${result.TP.toFixed(1)} dBTP (max ${truePeakDbtp})`
  );
  if (!(result.TP <= truePeakDbtp + 0.05)) { console.error('[soundtrack] true peak exceeds the ceiling'); process.exit(4); }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});