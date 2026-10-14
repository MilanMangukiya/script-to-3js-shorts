#!/usr/bin/env node
// Local narration + word alignment + voice timeline. No network, no paid API.
//   node tools/narrate.mjs stories/<slug>.json [--speed 0.92] [--reuse] [--voice am_michael]
// 1) Kokoro-82M (ONNX, local cache) speaks each scene's exact narration text through tools/narrate-cached.py, at a
//    per-scene speed taken from narration.pacing_energy (fast_hook 1.08 … reflective_payoff 0.98; else --speed).
// 2) faster-whisper (local, word timestamps) listens to the real audio; its words are aligned back to the script words
//    (tools/lib/align.mjs), so burned-in captions follow the actual synthesized speech.
// 3) The clips are laid on the film timeline at each scene's narration.start_s and written as
//    build/<slug>/audio/narration.wav (48 kHz mono) for tools/soundtrack.mjs.
// --reuse skips synthesis when build/<slug>/audio/narration-raw.json already holds every scene's text at the same
// speed (re-timing scenes after measuring the clips then only re-aligns and re-assembles).
// Outputs: build/<slug>/audio/narration.json (+ narration/<scene>.wav, narration-raw.json, narration.wav).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readWav, writeWav } from './lib/wav.mjs';
import { sceneRecord } from './lib/align.mjs';
import { reverb } from '../src/library/audio/synthLegacy.mjs';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const storyFile = args[0];
if (!storyFile || storyFile.startsWith('--')) { console.error('Usage: node tools/narrate.mjs stories/<slug>.json [--speed 0.92] [--reuse] [--voice am_michael]'); process.exit(2); }
const story = JSON.parse(fs.readFileSync(path.resolve(storyFile), 'utf8'));
const slug = story.project.slug, D = story.project.duration_s;
const voice = opt('voice', 'am_michael'), baseSpeed = Number(opt('speed', '0.92'));
const dir = path.join(ROOT, 'build', slug, 'audio');
fs.mkdirSync(path.join(dir, 'narration'), { recursive: true });

// Kokoro speed per pacing_energy (Kokoro am_michael ≈ 135 wpm at 0.92 and ≈ 158 wpm at 1.08, pauses included).
const PACING_SPEED = { fast_hook: 1.08, crisp_mechanism: 1.05, steady_escalation: 1.03, weighty_impact: 1.01, reflective_payoff: 0.98, loop_bridge: 1.02 };
const speeds = Object.fromEntries(story.scenes.map((sc) => [sc.id, PACING_SPEED[sc.narration.pacing_energy] ?? baseSpeed]));

// ---- 1+2) synthesis and recognition (cached Kokoro ONNX + faster-whisper)
const rawFile = path.join(dir, 'narration-raw.json');
const cached = fs.existsSync(rawFile) ? JSON.parse(fs.readFileSync(rawFile, 'utf8')) : null;
const fresh = cached && story.scenes.every((sc) => {
  const r = cached.scenes.find((x) => x.id === sc.id);
  return r && r.text === sc.narration.text && Math.abs((r.speed ?? cached.speed) - speeds[sc.id]) < 1e-6 && fs.existsSync(path.join(dir, r.file));
});
if (args.includes('--reuse') && fresh) console.log('reusing synthesized clips from narration-raw.json');
else {
  const t0 = Date.now();
  const py = spawnSync(process.env.PYTHON ?? 'python', [path.join(ROOT, 'tools', 'narrate-cached.py'), path.resolve(storyFile), '--voice', voice, '--speed', String(baseSpeed), '--speeds', JSON.stringify(speeds), '--out', dir],
    { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
  if (py.status !== 0) { console.error('narrate-cached.py failed'); process.exit(py.status ?? 1); }
  console.log(`synthesized ${story.scenes.length} scenes in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));

// ---- alignment → narration.json (word times relative to each clip; src/entry.ts offsets them by narration.start_s)
const result = { slug, engine: raw.engine, model: raw.model, voice: raw.voice, speed: baseSpeed, aligner: raw.aligner, license: raw.license, scenes: [] };
let words = 0, speech = 0;
const problems = [];
for (const sc of story.scenes) {
  const r = raw.scenes.find((x) => x.id === sc.id);
  if (!r || r.text !== sc.narration.text) { console.error(`${sc.id}: narration-raw.json does not match the storyboard text; run without --reuse`); process.exit(1); }
  const { record, exact, wordCount } = sceneRecord(r);
  record.speed = r.speed ?? raw.speed;
  result.scenes.push(record);
  const end = sc.narration.start_s + record.duration_s;
  words += wordCount; speech += record.duration_s;
  console.log(`${sc.id} ${record.duration_s.toFixed(2)}s ${wordCount}w ${(wordCount / record.duration_s * 60).toFixed(0)}wpm speed ${record.speed} match ${exact}/${wordCount} | ends ${end.toFixed(2)}s of scene ${sc.start_s}-${sc.end_s}`);
  if (end > sc.end_s - 0.05) problems.push(`${sc.id}: speech ends at ${end.toFixed(2)}s, past scene end ${sc.end_s}s - 0.05s`);
}
fs.writeFileSync(path.join(dir, 'narration.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`total ${words} words, ${speech.toFixed(1)}s of speech (${(words / speech * 60).toFixed(0)} wpm) in a ${D}s film`);
if (story.scenes[0].narration.start_s > 0.08) console.warn(`WARNING: S01 narration starts at ${story.scenes[0].narration.start_s}s (hook speech should start by 0.08s)`);
if (problems.length) { console.error(`Narration overruns its scene windows (re-time the storyboard, then run with --reuse):\n  ${problems.join('\n  ')}`); process.exit(3); }

// ---- 3) voice timeline: clips at narration.start_s, peak -6 dBFS, a touch of small-room warmth, 48 kHz mono
const sr = result.scenes[0].sample_rate, voiceTrack = new Float32Array(Math.ceil(D * sr));
for (const sc of story.scenes) {
  const rec = result.scenes.find((x) => x.id === sc.id), x = readWav(path.join(dir, rec.file)).channels[0];
  voiceTrack.set(x.subarray(0, Math.max(0, voiceTrack.length - Math.round(sc.narration.start_s * sr))), Math.round(sc.narration.start_s * sr));
}
let pk = 0; for (const v of voiceTrack) pk = Math.max(pk, Math.abs(v));
for (let i = 0; i < voiceTrack.length; i++) voiceTrack[i] *= 0.5 / pk;
const wet = reverb({ L: voiceTrack, R: voiceTrack.slice(), sr }, { decay: 0.7, mix: 0.07, damp: 0.5, tail: 0.1 });
const tmp = path.join(dir, 'narration-timeline.wav'), out = path.join(dir, 'narration.wav');
writeWav(tmp, [wet.L.subarray(0, voiceTrack.length)], sr);
const ff = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', tmp, '-af', 'aresample=48000', '-ar', '48000', '-ac', '1', '-t', String(D), out], { stdio: 'inherit' });
if (ff.status !== 0) { console.error('ffmpeg failed to write narration.wav'); process.exit(1); }
fs.rmSync(tmp, { force: true });
console.log(`wrote ${path.relative(ROOT, path.join(dir, 'narration.json'))} and ${path.relative(ROOT, out)} (${D}s, 48 kHz mono)`);
