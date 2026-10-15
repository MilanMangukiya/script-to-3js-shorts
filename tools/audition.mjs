#!/usr/bin/env node
// Local, isolated casting samples. Compare voices only after the performance plan has been reviewed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readWav, writeWav } from './lib/wav.mjs';
import { sceneRecord } from './lib/align.mjs';
import { PERFORMANCE_VERSION, performancePlan, prepareNarrationSource, applyPerformance, resolveOutputDir, outputChild, rawCacheMatches, performanceIdentity } from './lib/performance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW_ROOT = path.join(ROOT, 'build', 'voice-selection-review');
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const args = process.argv.slice(2);
const usage = 'node tools/audition.mjs [full-storyboard.json] [--voice am_michael|am_puck|am_fenrir] [--out build/voice-selection-review/<candidate>] [--deps <cached-python-deps>]';
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`--${name} needs a value`);
  return args[i + 1];
};
const run = (bin, argv, options = {}) => {
  const r = spawnSync(bin, argv, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }, ...options });
  if (r.error || r.status !== 0) throw new Error(`${path.basename(bin)} failed: ${r.error?.message ?? r.stderr ?? r.status}`);
  return r;
};
const jsonScan = (stderr) => {
  const blocks = stderr.match(/\{[^{}]*\}/g);
  if (!blocks?.length) throw new Error('FFmpeg did not report measured loudness');
  return JSON.parse(blocks.at(-1));
};
const joinedTranscript = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
const BAND = { S01: [148, 160, 154], S05: [148, 160, 154], S08: [125, 135, 130] };

function main() {
  const flags = new Set(['--voice', '--out', '--deps', '--help']), seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) {
      if (i !== 0) throw new Error('Pass the complete storyboard before options');
      continue;
    }
    if (!flags.has(arg) || seen.has(arg)) throw new Error(`Unknown or duplicate audition option: ${arg}`);
    seen.add(arg);
    if (arg !== '--help') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} needs a value`);
      i++;
    }
  }
  if (args.includes('--help')) { console.log(usage); return; }
  const storyFile = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : path.join(ROOT, 'build', 'voice-performance-review', 'directed-storyboard.json'));
  const voice = opt('voice', 'am_michael');
  if (!['am_michael', 'am_puck', 'am_fenrir'].includes(voice)) throw new Error('Choose am_michael, am_puck or am_fenrir for this bounded male-voice comparison');
  run(process.env.PYTHON ?? 'python', [path.join(ROOT, 'scripts', 'validate_storyboard.py'), storyFile]);
  const story = JSON.parse(fs.readFileSync(storyFile, 'utf8'));
  const scenes = Object.keys(BAND).map((id) => {
    const scene = story.scenes.find((sc) => sc.id === id);
    if (!scene) throw new Error(`Diagnostic scene ${id} is missing from the complete storyboard`);
    return scene;
  });
  const dir = resolveOutputDir(ROOT, opt('out', path.join(REVIEW_ROOT, voice)), story.project.slug);
  outputChild(REVIEW_ROOT, dir); // Casting must not overwrite the performance proof or production audio.
  fs.mkdirSync(outputChild(dir, 'narration'), { recursive: true });
  fs.mkdirSync(outputChild(dir, 'performance'), { recursive: true });
  for (const sc of scenes) { outputChild(dir, `narration/${sc.id}.wav`); outputChild(dir, `performance/${sc.id}.wav`); }
  const sourceFile = outputChild(dir, 'source-storyboard.json');
  fs.writeFileSync(sourceFile, JSON.stringify(story, null, 2) + '\n');
  let rates = { S01: 0.8, S05: 0.8, S08: 0.65 };
  const priorFile = outputChild(dir, 'narration-raw.json');
  if (fs.existsSync(priorFile)) {
    const prior = JSON.parse(fs.readFileSync(priorFile, 'utf8'));
    const priorRates = Object.fromEntries(scenes.map((sc) => [sc.id, prior.scenes?.find((r) => r.id === sc.id)?.speed]));
    if (Object.values(priorRates).every((rate) => Number.isFinite(rate) && rate >= .5 && rate <= 1.2)
      && rawCacheMatches(prior, { scenes, voice, speeds: priorRates, dir })) rates = priorRates;
  }
  const history = [];
  let measurements = [], clips = [], raw;
  for (let pass = 1; pass <= 3; pass++) {
    console.log(`${voice}: calibration pass ${pass}/3, rates ${JSON.stringify(rates)}`);
    const pyArgs = [path.join(ROOT, 'tools', 'narrate-cached.py'), sourceFile, '--voice', voice, '--speeds', JSON.stringify(rates), '--scene-ids', scenes.map((sc) => sc.id).join(','), '--out', dir, '--reuse'];
    const deps = opt('deps', undefined); if (deps) pyArgs.push('--deps', path.resolve(deps));
    run(process.env.PYTHON ?? 'python', pyArgs, { stdio: 'inherit' });
    raw = JSON.parse(fs.readFileSync(outputChild(dir, 'narration-raw.json'), 'utf8'));
    if (!rawCacheMatches(raw, { scenes, voice, speeds: rates, dir })) throw new Error('Audition source cache does not match voice, model, text and rates');
    measurements = []; clips = [];
    for (const sc of scenes) {
      const original = raw.scenes.find((r) => r.id === sc.id), wav = readWav(outputChild(dir, original.file));
      if (wav.channels.length !== 1 || wav.sampleRate !== original.sampleRate || Math.abs(wav.channels[0].length / wav.sampleRate - original.duration) > 1 / wav.sampleRate + 1e-6) throw new Error(`${sc.id}: source WAV and metadata disagree`);
      const prepared = prepareNarrationSource(original, wav.channels[0], wav.sampleRate, sc.id === 'S01' ? sc.narration.start_s : undefined);
      const aligned = sceneRecord(prepared.source);
      const plan = performancePlan({ ...sc.narration, performance: { ...sc.narration.performance, rate: rates[sc.id] } });
      const directed = applyPerformance({ record: aligned.record, raw: prepared.source, matches: aligned.matches, samples: prepared.samples, sampleRate: wav.sampleRate, plan });
      const record = directed.record, wpm = aligned.wordCount / record.duration_s * 60;
      const [min, max, target] = BAND[sc.id];
      const limit = Math.min(sc.narration.end_s, sc.end_s - 0.15);
      const overrun_s = Math.max(0, sc.narration.start_s + record.duration_s - limit);
      const audible = directed.samples.findIndex((x) => Math.abs(x) > 0.006);
      const audible_start_s = sc.narration.start_s + audible / wav.sampleRate;
      const timing_ok = record.words.every((w, i) => w.start_s >= 0 && w.end_s >= w.start_s && w.end_s <= record.duration_s + 1e-6 && (!i || w.start_s >= record.words[i - 1].end_s - 1e-6));
      const transcript_exact = joinedTranscript(original.heardText) === joinedTranscript(sc.narration.text);
      record.file = `performance/${sc.id}.wav`; record.source_file = original.file; record.speed = rates[sc.id];
      record.performance.leading_trim_s = prepared.leadingTrim;
      record.audible_start_s = audible_start_s;
      writeWav(outputChild(dir, record.file), [directed.samples], wav.sampleRate);
      measurements.push({ id: sc.id, text: sc.narration.text, rate: rates[sc.id], duration_s: record.duration_s, word_count: aligned.wordCount, wpm, target_wpm: target, cadence_ok: wpm >= min && wpm <= max, ordered_exact_words: aligned.exact, joined_transcript_exact: transcript_exact, heard: original.heardText, overrun_s, timing_ok, audible_start_s, onset_ok: sc.id !== 'S01' || (audible >= 0 && audible_start_s <= 0.08 + 1 / wav.sampleRate), sample: outputChild(dir, record.file), record });
      clips.push({ samples: directed.samples, sampleRate: wav.sampleRate });
      console.log(`${voice} ${sc.id}: ${wpm.toFixed(1)} WPM, rate ${rates[sc.id]}, transcript ${transcript_exact ? 'exact' : 'MISMATCH'}, overrun ${overrun_s.toFixed(3)}s`);
    }
    history.push({ pass, scenes: measurements.map(({ record, ...m }) => m) });
    if (measurements.every((m) => m.cadence_ok) || pass === 3) break;
    for (const m of measurements) if (!m.cadence_ok) rates[m.id] = +Math.max(0.5, Math.min(1.2, m.rate * m.target_wpm / m.wpm)).toFixed(4);
  }
  const sampleRate = clips[0].sampleRate;
  if (clips.some((clip) => clip.sampleRate !== sampleRate)) throw new Error('Audition sample rates disagree');
  const separator = Math.round(0.65 * sampleRate);
  const montage = new Float32Array(clips.reduce((n, clip) => n + clip.samples.length, 0) + separator * (clips.length - 1));
  let at = 0;
  for (const clip of clips) { montage.set(clip.samples, at); at += clip.samples.length + separator; }
  const rawMontage = outputChild(dir, 'audition-raw.wav'), sampleFile = outputChild(dir, 'audition.wav');
  writeWav(rawMontage, [montage], sampleRate);
  const measure = jsonScan(run(ffmpeg, ['-hide_banner', '-nostdin', '-i', rawMontage, '-af', 'loudnorm=I=-18:TP=-1:LRA=7:print_format=json', '-f', 'null', '-']).stderr);
  const filter = `loudnorm=I=-18:TP=-1:LRA=7:measured_I=${measure.input_i}:measured_TP=${measure.input_tp}:measured_LRA=${measure.input_lra}:measured_thresh=${measure.input_thresh}:offset=${measure.target_offset}:linear=true:print_format=json`;
  run(ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', rawMontage, '-af', filter, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', sampleFile]);
  const loudness = jsonScan(run(ffmpeg, ['-hide_banner', '-nostdin', '-i', sampleFile, '-af', 'loudnorm=I=-18:TP=-1:LRA=7:print_format=json', '-f', 'null', '-']).stderr);
  const lufs = Number(loudness.input_i), true_peak_dbtp = Number(loudness.input_tp);
  const loudness_ok = Number.isFinite(lufs) && Math.abs(lufs + 18) <= 0.3 && Number.isFinite(true_peak_dbtp) && true_peak_dbtp <= -1;
  const technical_ready = loudness_ok && measurements.every((m) => m.cadence_ok && m.joined_transcript_exact && m.overrun_s <= 1e-6 && m.timing_ok && m.onset_ok);
  const report = { voice, engine: raw.engine, model: raw.model, language: 'en-us', storyboard: sourceFile, source_storyboard: storyFile, output_dir: dir, scene_ids: scenes.map((sc) => sc.id), performance_version: PERFORMANCE_VERSION, identity: performanceIdentity({ voice, model: raw.model, scenes: measurements.map((m) => ({ id: m.id, text: m.text, rate: m.rate, pauses: m.record.performance.pauses })) }), calibration_history: history, scenes: measurements, montage: sampleFile, separator_s: 0.65, loudness: { lufs, true_peak_dbtp, ok: loudness_ok }, technical_ready, listening_review: 'unverified; compare the samples to choose a voice', selection: null };
  const reportFile = outputChild(dir, 'audition.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(`${voice}: wrote ${sampleFile} and ${reportFile}; technical checks ${technical_ready ? 'PASS' : 'NEED REVIEW'}`);
  if (!technical_ready) process.exitCode = 3;
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
