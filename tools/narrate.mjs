#!/usr/bin/env node
// Local narration + word alignment. No network, no paid API.
//   node tools/narrate.mjs <storyboard.json> [--voice am_michael] [--speed 0.92] [--out build/<slug>/audio]
// 1) Kokoro-82M (ONNX, local) speaks each scene's exact narration text.
// 2) Whisper (local, word timestamps) listens to the real audio; its word times are aligned back to the
//    script words, so burned-in captions follow the actual synthesized speech rather than guessed timing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { writeWav, resample } from './lib/wav.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const storyFile = args[0];
if (!storyFile) { console.error('Usage: node tools/narrate.mjs <storyboard.json> [--voice id] [--speed n] [--out dir]'); process.exit(2); }
const story = JSON.parse(fs.readFileSync(storyFile, 'utf8'));
const slug = story.project.slug;
const voice = opt('voice', 'am_michael');
const speed = Number(opt('speed', '0.92'));
const outDir = path.resolve(opt('out', path.join(ROOT, 'build', slug, 'audio')));
const MODELS = opt('models', path.join(ROOT, 'asset-sources', 'models'));
fs.mkdirSync(path.join(outDir, 'narration'), { recursive: true });

// kokoro-js bundles its own transformers build; share that instance so the offline env applies to both models.
const { KokoroTTS } = require('kokoro-js');
const tf = createRequire(require.resolve('kokoro-js'))('@huggingface/transformers');
tf.env.allowRemoteModels = false;
tf.env.allowLocalModels = true;
tf.env.localModelPath = MODELS.replace(/\\/g, '/') + '/';

const norm = (w) => w.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']/g, '');

function trimSilence(x, sr, thr = 0.006, padS = 0.05) {
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  a = Math.max(0, a - Math.round(padS * sr)); b = Math.min(x.length - 1, b + Math.round(padS * 2 * sr));
  return x.slice(a, b + 1);
}

const subCost = (a, b) => (a === b ? 0 : (a[0] === b[0] ? 0.6 : 1));

/** Align script words to recognized words (edit-distance path); unmatched script words are interpolated. */
function alignWords(scriptWords, heard, duration) {
  const S = scriptWords.map(norm), H = heard.map((h) => norm(h.text));
  const n = S.length, m = H.length;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j - 1] + subCost(S[i - 1], H[j - 1]), D[i - 1][j] + 1, D[i][j - 1] + 1);
  }
  const times = new Array(n).fill(null);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (D[i][j] === D[i - 1][j - 1] + subCost(S[i - 1], H[j - 1])) { times[i - 1] = [heard[j - 1].start, heard[j - 1].end]; i--; j--; }
    else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  // Interpolate unmatched runs proportionally to word length.
  let k = 0;
  while (k < n) {
    if (times[k]) { k++; continue; }
    let e = k; while (e < n && !times[e]) e++;
    const t0 = k > 0 ? times[k - 1][1] : 0, t1 = e < n ? times[e][0] : duration;
    const total = scriptWords.slice(k, e).reduce((s, w) => s + w.length + 1, 0);
    let acc = 0;
    for (let q = k; q < e; q++) { const a = t0 + (t1 - t0) * acc / total; acc += scriptWords[q].length + 1; times[q] = [a, t0 + (t1 - t0) * acc / total]; }
    k = e;
  }
  // Monotonic, non-overlapping, inside the clip.
  for (let q = 0; q < n; q++) {
    times[q][0] = Math.max(q ? times[q - 1][0] + 0.02 : 0, Math.min(duration, times[q][0]));
    times[q][1] = Math.max(times[q][0] + 0.05, Math.min(duration, times[q][1]));
    if (q) times[q - 1][1] = Math.min(times[q - 1][1], times[q][0]);
  }
  return times;
}

const t0 = Date.now();
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });
const asr = await tf.pipeline('automatic-speech-recognition', 'onnx-community/whisper-small.en_timestamped', { dtype: 'fp32', device: 'cpu' });
console.log(`models loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s | voice=${voice} speed=${speed}`);

const result = { slug, engine: 'kokoro_local', model: 'onnx-community/Kokoro-82M-v1.0-ONNX', voice, speed, aligner: 'onnx-community/whisper-small.en_timestamped', scenes: [] };
for (const sc of story.scenes) {
  const text = sc.narration.text;
  const raw = await tts.generate(text, { voice, speed });
  const sr = raw.sampling_rate;
  const audio = trimSilence(raw.audio, sr);
  const duration = audio.length / sr;
  const file = `narration/${sc.id}.wav`;
  writeWav(path.join(outDir, file), [audio], sr);
  const out = await asr(resample(audio, sr, 16000), { return_timestamps: 'word', chunk_length_s: 30 });
  const heard = out.chunks.filter((c) => norm(c.text)).map((c) => ({ text: c.text, start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? c.timestamp[0] ?? 0 }));
  const scriptWords = text.split(/\s+/).filter(Boolean);
  const times = alignWords(scriptWords, heard, duration);
  const exact = scriptWords.filter((w) => heard.some((h) => norm(h.text) === norm(w))).length;
  result.scenes.push({
    id: sc.id, text, file, sample_rate: sr, duration_s: +duration.toFixed(3), heard: out.text.trim(),
    words: scriptWords.map((w, q) => ({ text: w, start_s: +times[q][0].toFixed(3), end_s: +times[q][1].toFixed(3) })),
  });
  console.log(`${sc.id} ${duration.toFixed(2)}s ${scriptWords.length}w ${(scriptWords.length / duration * 60).toFixed(0)}wpm match ${exact}/${scriptWords.length} | ${out.text.trim()}`);
}
fs.writeFileSync(path.join(outDir, 'narration.json'), JSON.stringify(result, null, 2));
console.log(`wrote ${path.relative(ROOT, path.join(outDir, 'narration.json'))} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
