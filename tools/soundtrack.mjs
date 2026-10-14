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

  if (fs.existsSync(narrationWavPath)) {
    // Sidechain duck bed slightly under active voiceover & normalize master to -14.0 LUFS
    const filterComplex = [
      `[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0[voice]`,
      `[1:a]aresample=48000[bed]`,
      `[bed][voice]sidechaincompress=threshold=0.035:ratio=3.5:attack=15:release=220[ducked]`,
      `[voice][ducked]amix=inputs=2:duration=longest:dropout_transition=0:weights='1.25 0.95',loudnorm=I=${targetLufs}:TP=${truePeakDbtp}:LRA=7[out]`,
    ].join(';');

    const res = spawnSync(
      bin,
      [
        '-y',
        '-i',
        narrationWavPath,
        '-i',
        bedWavPath,
        '-filter_complex',
        filterComplex,
        '-map',
        '[out]',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-t',
        String(duration_s),
        finalMixWavPath,
      ],
      { stdio: 'inherit' }
    );
    if (res.status !== 0) process.exit(res.status ?? 1);
  } else {
    const res = spawnSync(
      bin,
      [
        '-y',
        '-i',
        bedWavPath,
        '-af',
        `loudnorm=I=${targetLufs}:TP=${truePeakDbtp}:LRA=7`,
        '-ar',
        '48000',
        '-ac',
        '2',
        '-t',
        String(duration_s),
        finalMixWavPath,
      ],
      { stdio: 'inherit' }
    );
    if (res.status !== 0) process.exit(res.status ?? 1);
  }

  console.log(
    `[soundtrack] Mixed ${finalMixWavPath} (${duration_s}s @ ${targetLufs} LUFS, peak <= ${truePeakDbtp} dBTP)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});