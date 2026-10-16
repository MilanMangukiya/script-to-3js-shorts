// Kokoro exposes rate, not prose direction. Pause edits use verified quiet gaps in whole-scene synthesis.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {assertCaptionTiming,provenanceEqual} from './narration-quality.mjs';
import {assertRecognitionTiming} from './align.mjs';

export const PERFORMANCE_VERSION = 'kokoro-gap-v3';
// Measured kokoro-onnx 0.6.1 starting rates (see config/narration.json); used when the config file is absent.
export const PACING_SPEED = { fast_hook: 0.887, crisp_mechanism: 0.866, steady_escalation: 0.84, weighty_impact: 0.86, reflective_payoff: 0.787, loop_bridge: 0.84 };
const ENGINE = 'kokoro_local', MODEL = 'Kokoro-82M v1.0 ONNX';

export function performancePlan(narration, baseSpeed = 0.92, pacingSpeed = PACING_SPEED) {
  if (!Number.isFinite(baseSpeed) || baseSpeed <= 0) throw new Error('Narration speed must be finite and positive');
  const performance = narration.performance === undefined ? {} : narration.performance;
  if (!performance || typeof performance !== 'object' || Array.isArray(performance)) throw new Error('narration.performance must be an object');
  if (Object.keys(performance).some((k) => !['rate', 'pauses'].includes(k))) throw new Error('Unknown narration.performance control');
  if (performance.rate !== undefined && (typeof performance.rate !== 'number' || !Number.isFinite(performance.rate) || performance.rate < 0.5 || performance.rate > 1.2)) throw new Error('performance.rate must be between 0.5 and 1.2');
  const rate = performance.rate ?? pacingSpeed[narration.pacing_energy] ?? baseSpeed;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Narration speed must be finite and positive');
  const wordCount = narration.text.split(/\s+/).filter(Boolean).length;
  const pauses = performance.pauses === undefined ? [] : performance.pauses;
  if (!Array.isArray(pauses) || pauses.length > 6) throw new Error('performance.pauses must be an array with at most six entries');
  const seen = new Set();
  let total = 0;
  for (const p of pauses) {
    if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).some((k) => !['after_word', 'duration_s', 'mode'].includes(k))) throw new Error('Invalid performance pause');
    if (!Number.isInteger(p.after_word) || p.after_word < 1 || p.after_word >= wordCount || seen.has(p.after_word)) throw new Error('Pause after_word must be a unique 1-based token index before the final word');
    if (typeof p.duration_s !== 'number' || !Number.isFinite(p.duration_s) || p.duration_s < 0.05 || p.duration_s > 0.6) throw new Error('Pause duration_s must be between 0.05 and 0.6 seconds');
    if (p.mode !== undefined && !['minimum', 'target'].includes(p.mode)) throw new Error('Pause mode must be minimum or target');
    seen.add(p.after_word); total += p.duration_s;
  }
  if (total > 1.2 + 1e-9) throw new Error('Requested pauses must total at most 1.2 seconds per scene');
  return { rate, pauses: pauses.map((p) => ({ after_word: p.after_word, duration_s: p.duration_s, mode: p.mode ?? 'minimum' })).sort((a, b) => a.after_word - b.after_word) };
}

const inside = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

// Resolve existing ancestors too: a lexically safe --out can otherwise escape through a junction.
function canonicalTarget(target) {
  let ancestor = target;
  const suffix = [];
  while (true) {
    try { fs.lstatSync(ancestor); break; }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw new Error(`Cannot resolve output path: ${target}`);
      suffix.unshift(path.basename(ancestor)); ancestor = parent;
    }
  }
  return path.join(fs.realpathSync(ancestor), ...suffix);
}

export function outputChild(dir, file) {
  const target = path.resolve(dir, file), realDir = canonicalTarget(dir);
  if (!inside(dir, target) || !inside(realDir, canonicalTarget(target))) throw new Error(`Audio output path escapes its directory: ${file}`);
  return target;
}

export function resolveOutputDir(root, requested, slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid project slug');
  const build = path.join(root, 'build');
  const dir = requested === undefined ? path.join(build, slug, 'audio') : path.resolve(requested);
  if (!inside(build, dir) || !inside(canonicalTarget(build), canonicalTarget(dir))) throw new Error('--out must be a directory below the repository build directory, without a symlink escape');
  for (const child of ['narration', 'performance', 'narration-raw.json', 'narration.json', 'narration.wav', 'narration-timeline.wav']) outputChild(dir, child);
  return dir;
}

export function rawCacheMatches(cache, { scenes, voice, speeds, dir, provenance }) {
  if (!cache || cache.engine !== ENGINE || cache.model !== MODEL || cache.voice !== voice || !Array.isArray(cache.scenes)) return false;
  if (!cache.provenance?.synthesis || (provenance && !provenanceEqual(cache.provenance.synthesis,provenance.synthesis))) return false;
  return scenes.every((sc) => {
    const r = cache.scenes.find((x) => x.id === sc.id);
    if (!r || r.text !== sc.narration.text || !Number.isFinite(r.speed ?? cache.speed) || Math.abs((r.speed ?? cache.speed) - speeds[sc.id]) >= 1e-6 || typeof r.file !== 'string') return false;
    try { const file=outputChild(dir,r.file); return fs.statSync(file).isFile() && typeof r.source_sha256==='string' && createHash('sha256').update(fs.readFileSync(file)).digest('hex')===r.source_sha256; } catch { return false; }
  });
}

export const performanceIdentity = (value) => createHash('sha256').update(JSON.stringify({ version: PERFORMANCE_VERSION, ...value })).digest('hex');
const seconds = (samples, sr) => +(samples / sr).toFixed(6);

/** Keep the same verified quiet-prefix policy for production narration and isolated auditions. */
export function prepareNarrationSource(raw, samples, sampleRate, hookStart_s) {
  assertRecognitionTiming(raw.heard,raw.duration,raw.id);
  let source = raw, leadingTrim = 0;
  if (hookStart_s !== undefined) {
    const onset = samples.findIndex((x) => Math.abs(x) > 0.006);
    const pad = Math.max(0, Math.min(0.015, 0.08 - hookStart_s - 0.005));
    const remove = Math.max(0, onset - Math.floor(pad * sampleRate));
    if (remove) {
      leadingTrim = remove / sampleRate;
      samples = samples.subarray(remove);
      source = { ...raw, duration: samples.length / sampleRate,
        heard: raw.heard.map((h) => ({ ...h, start: Math.max(0, h.start - leadingTrim), end: Math.max(0, h.end - leadingTrim) })) };
    }
  }
  return { source, samples, leadingTrim };
}

function quietRun(samples, lo, hi, peak) {
  const threshold = peak * 0.02;
  let runStart = lo, bestStart = lo, bestLength = 0;
  for (let i = lo; i <= hi; i++) {
    if (i === hi || !Number.isFinite(samples[i]) || Math.abs(samples[i]) > threshold) {
      if (i - runStart > bestLength) { bestStart = runStart; bestLength = i - runStart; }
      runStart = i + 1;
    }
  }
  return { start: bestStart, length: bestLength };
}

/** Edit quiet gaps only; target mode may shorten a gap, minimum mode only extends it. */
export function applyPerformance({ record, raw, matches, samples, sampleRate, plan }) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !samples.length) throw new Error(`${record.id}: empty or invalid narration waveform`);
  let peak = 0;
  for (const x of samples) { if (!Number.isFinite(x)) throw new Error(`${record.id}: non-finite narration waveform`); peak = Math.max(peak, Math.abs(x)); }
  if (peak === 0) throw new Error(`${record.id}: silent narration waveform`);
  const splices = [], applied = [];
  for (const pause of plan.pauses) {
    const leftIndex = pause.after_word - 1, rightIndex = pause.after_word;
    const evidence=record.recognition?.evidence;
    const l=evidence?.[leftIndex]?.heard_end_index??matches[leftIndex],r=evidence?.[rightIndex]?.heard_start_index??matches[rightIndex];
    if (l === null || l === undefined || r !== l + 1 || !raw.heard[l] || !raw.heard[r]) throw new Error(`${record.id}: pause after word ${pause.after_word} needs verified adjacent recognized word spans`);
    const left = Math.max(record.words[leftIndex].end_s, raw.heard[l].end);
    const right = Math.min(record.words[rightIndex].start_s, raw.heard[r].start);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left < 0 || right < left || right > samples.length / sampleRate) throw new Error(`${record.id}: pause after word ${pause.after_word} has no safe measured word gap`);
    const lo = Math.ceil(left * sampleRate), hi = Math.floor(right * sampleRate);
    const wanted = Math.ceil(pause.duration_s * sampleRate) - (hi - lo);
    const delta = pause.mode === 'target' ? wanted : Math.max(0, wanted);
    const added = Math.max(0, delta), removed = Math.max(0, -delta);
    let point = null;
    if (delta) {
      const quiet = quietRun(samples, lo, hi, peak);
      // Keep a quiet 10ms margin on each side of a cut, including the tiny endpoint fades.
      if (quiet.length < removed + Math.ceil(0.02 * sampleRate)) throw new Error(`${record.id}: pause after word ${pause.after_word} needs ${removed ? 'enough continuous quiet to remove the requested silence plus a ' : 'a quiet '}20ms window inside its measured gap; choose another boundary`);
      point = quiet.start + Math.floor((quiet.length - removed) / 2);
      splices.push({ point, added, removed, delta, after_word: pause.after_word });
    }
    applied.push({ after_word: pause.after_word, mode: pause.mode ?? 'minimum', requested_s: pause.duration_s, original_gap_s: seconds(hi - lo, sampleRate), resulting_gap_s: seconds(hi - lo + delta, sampleRate), added_s: seconds(added, sampleRate), removed_s: seconds(removed, sampleRate), splice_original_s: point === null ? null : seconds(point, sampleRate) });
  }
  const outputLength = samples.length + splices.reduce((n, s) => n + s.delta, 0);
  if (outputLength <= 0) throw new Error(`${record.id}: pause edits would remove the entire clip`);
  const output = new Float32Array(outputLength);
  let sourceAt = 0, outputAt = 0;
  for (const splice of splices) {
    output.set(samples.subarray(sourceAt, splice.point), outputAt);
    outputAt += splice.point - sourceAt;
    const gapStart = outputAt, gapEnd = outputAt + splice.added;
    // Both 2ms fades remain inside the verified quiet window and outside captioned words.
    const fade = Math.min(Math.ceil(0.002 * sampleRate), Math.floor(0.01 * sampleRate));
    for (let i = 0; i < fade; i++) output[gapStart - fade + i] *= 1 - (i + 1) / fade;
    outputAt = gapEnd; sourceAt = splice.point + splice.removed;
    splice.gapStart = gapStart; splice.gapEnd = gapEnd; splice.fade = fade;
  }
  output.set(samples.subarray(sourceAt), outputAt);
  for (const splice of splices) {
    for (let i = 0; i < splice.fade; i++) output[splice.gapEnd + i] *= (i + 1) / splice.fade;
  }
  const directed = structuredClone(record);
  directed.duration_s = seconds(output.length, sampleRate);
  directed.words = record.words.map((word, index) => {
    const shift = splices.filter((s) => index >= s.after_word).reduce((n, s) => n + s.delta / sampleRate, 0);
    return { ...word, start_s: +(word.start_s + shift).toFixed(6), end_s: +(word.end_s + shift).toFixed(6) };
  });
  directed.performance = { version: PERFORMANCE_VERSION, rate: plan.rate, pauses: plan.pauses, applied_pauses: applied, identity: performanceIdentity({ rate: plan.rate, pauses: plan.pauses, text: raw.text }) };
  for (const splice of splices) {
    const gapStart = splice.gapStart / sampleRate, gapEnd = splice.gapEnd / sampleRate;
    if (directed.words.some((w) => w.start_s < gapEnd - 1e-6 && w.end_s > gapStart + 1e-6)) throw new Error(`${record.id}: caption timing crosses edited silence`);
    const metadata = applied.find((p) => p.after_word === splice.after_word);
    if (splice.added) { metadata.inserted_start_s = seconds(splice.gapStart, sampleRate); metadata.inserted_end_s = seconds(splice.gapEnd, sampleRate); }
    if (splice.removed) { metadata.removed_original_start_s = seconds(splice.point, sampleRate); metadata.removed_original_end_s = seconds(splice.point + splice.removed, sampleRate); metadata.join_s = seconds(splice.gapStart, sampleRate); }
  }
  assertCaptionTiming(directed);
  return { samples: output, record: directed };
}
