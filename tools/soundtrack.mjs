#!/usr/bin/env node
// Assemble narration + original soundtrack and master to the storyboard's loudness target.
//   node tools/soundtrack.mjs <slug>
// Reads build/<slug>/audio/narration.json (+ clips) and src/stories/<slug>/soundtrack.mjs (exports buildSoundtrack).
// Writes build/<slug>/audio/{voice.wav, bed.wav, mix.wav}. mix.wav is 48 kHz stereo, two-pass loudness-normalised.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readWav, writeWav } from './lib/wav.mjs';
import { dB, stereo, mixStereo, reverb, peak } from '../src/library/audio/synth.mjs';

const require = createRequire(import.meta.url), ffmpeg = require('ffmpeg-static');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('Usage: node tools/soundtrack.mjs <slug>'); process.exit(2); }
const story = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', `${slug}.json`), 'utf8'));
const dir = path.join(ROOT, 'build', slug, 'audio');
const narration = JSON.parse(fs.readFileSync(path.join(dir, 'narration.json'), 'utf8'));
const D = story.project.duration_s, A = story.audio;

// ---- voice track at the TTS sample rate (resampled to 48 kHz by FFmpeg for quality)
const vsr = narration.scenes[0].sample_rate, voice = new Float32Array(Math.ceil(D * vsr));
for (const sc of story.scenes) {
  const clip = narration.scenes.find((n) => n.id === sc.id), x = readWav(path.join(dir, clip.file)).channels[0];
  const end = sc.narration.start_s + x.length / vsr;
  if (end > sc.end_s + 1e-3) throw new Error(`${sc.id}: narration (${end.toFixed(2)}s) overruns its scene (${sc.end_s}s)`);
  voice.set(x, Math.round(sc.narration.start_s * vsr));
}
let vp = 0; for (const v of voice) vp = Math.max(vp, Math.abs(v));
const vGain = 0.5 / vp; for (let i = 0; i < voice.length; i++) voice[i] *= vGain;  // voice peak at -6 dBFS before mastering
// A touch of small-room warmth so the dry synthetic voice sits in the mix.
const vWet = reverb({ L: voice, R: voice.slice(), sr: vsr }, { decay: 0.7, mix: 0.07, damp: 0.5, tail: 0.1 });
writeWav(path.join(dir, 'voice.wav'), [vWet.L.subarray(0, voice.length), vWet.R.subarray(0, voice.length)], vsr);

// ---- voice envelope for gentle side-chain ducking of the bed
const hop = Math.round(vsr * 0.01), env = new Float32Array(Math.ceil(voice.length / hop));
for (let i = 0; i < env.length; i++) { let m = 0; for (let k = i * hop; k < Math.min(voice.length, (i + 1) * hop); k++) m = Math.max(m, Math.abs(voice[k])); env[i] = m; }
let e = 0; for (let i = 0; i < env.length; i++) { const target = env[i] > 0.02 ? 1 : 0; e += (target - e) * (target > e ? 0.25 : 0.03); env[i] = e; }

// ---- music + effects bed
const { buildSoundtrack } = await import(pathToFileURL(path.join(ROOT, 'src', 'stories', slug, 'soundtrack.mjs')).href);
const t0 = Date.now(), { music, sfx } = buildSoundtrack(D);
const bed = stereo(D);
// Levels are RMS-referenced to the spoken voice: under narration the music sits music_level_db_below_voice below it
// (3 dB of that comes from side-chain ducking, so it breathes up slightly in the pauses). Effects are authored in dB
// relative to the voice's peak reference of 0.5.
const rms = (x, pick) => { let s = 0, n = 0; for (let i = 0; i < x.length; i++) if (!pick || pick(i)) { s += x[i] * x[i]; n++; } return Math.sqrt(s / Math.max(1, n)); };
const voiceRms = rms(voice, (i) => env[Math.min(env.length - 1, Math.floor(i / hop))] > 0.5);
const DUCK = dB(-3), musicRms = rms(music.L);
mixStereo(bed, music, 0, (voiceRms * dB(A.music_level_db_below_voice + 3)) / musicRms);
mixStereo(bed, sfx, 0, 0.5);
for (let i = 0; i < bed.L.length; i++) { const d = 1 - (1 - DUCK) * env[Math.min(env.length - 1, Math.floor(i / 48000 / 0.01))]; bed.L[i] *= d; bed.R[i] *= d; }
writeWav(path.join(dir, 'bed.wav'), [bed.L, bed.R], 48000);
console.log(`bed synthesized in ${((Date.now() - t0) / 1000).toFixed(1)}s | voice RMS ${(20 * Math.log10(voiceRms)).toFixed(1)} dBFS`);
const db = (v) => (20 * Math.log10(Math.max(v, 1e-6))).toFixed(1).padStart(6);
for (const sc of story.scenes) {
  const a = Math.round(sc.start_s * 48000), b = Math.round(sc.end_s * 48000), seg = bed.L.subarray(a, b);
  let pk = 0; for (const v of seg) pk = Math.max(pk, Math.abs(v));
  console.log(`  ${sc.id} bed RMS ${db(rms(seg))} dBFS  peak ${db(pk)} dBFS  (voice RMS ${db(voiceRms)})`);
}

// ---- mix + two-pass loudnorm to the storyboard target
const graph = `[0:a]aresample=48000:filter_size=64[v];[v][1:a]amix=inputs=2:normalize=0,highpass=f=28[m]`;
// AAC encoding overshoots PCM peaks slightly, so master 0.7 dB under the storyboard ceiling.
const ln = `loudnorm=I=${A.mix_target_lufs}:TP=${A.true_peak_max_dbtp - 0.7}:LRA=11`;
const pass1 = spawnSync(ffmpeg, ['-hide_banner', '-i', path.join(dir, 'voice.wav'), '-i', path.join(dir, 'bed.wav'), '-filter_complex', `${graph};[m]${ln}:print_format=json[o]`, '-map', '[o]', '-f', 'null', '-'], { encoding: 'utf8' });
const m = JSON.parse(pass1.stderr.slice(pass1.stderr.lastIndexOf('{'), pass1.stderr.lastIndexOf('}') + 1));
execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(dir, 'voice.wav'), '-i', path.join(dir, 'bed.wav'), '-filter_complex',
  `${graph};[m]${ln}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true[o]`,
  '-map', '[o]', '-ar', '48000', '-ac', '2', '-t', String(D), '-c:a', 'pcm_s16le', path.join(dir, 'mix.wav')]);
console.log(`mix.wav written | measured input I=${m.input_i} LUFS TP=${m.input_tp} dBTP → target ${A.mix_target_lufs} LUFS / ${A.true_peak_max_dbtp} dBTP`);
