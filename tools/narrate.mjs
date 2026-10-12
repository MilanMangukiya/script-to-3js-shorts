#!/usr/bin/env node
// Local narration + word alignment. No network, no paid API. (GPU alternative: tools/narrate-kaggle.mjs.)
//   node tools/narrate.mjs <storyboard.json> [--voice am_michael] [--speed 0.92] [--out build/<slug>/audio]
// 1) Kokoro-82M (ONNX, local) speaks each scene's exact narration text.
// 2) Whisper (local, word timestamps) listens to the real audio; its word times are aligned back to the
//    script words, so burned-in captions follow the actual synthesized speech rather than guessed timing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { writeWav, resample } from './lib/wav.mjs';
import { norm, trimSilence, sceneRecord } from './lib/align.mjs';

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
  const { record, exact, wordCount } = sceneRecord({ id: sc.id, text, file, sampleRate: sr, duration, heardText: out.text, heard });
  result.scenes.push(record);
  console.log(`${sc.id} ${duration.toFixed(2)}s ${wordCount}w ${(wordCount / duration * 60).toFixed(0)}wpm match ${exact}/${wordCount} | ${out.text.trim()}`);
}
fs.writeFileSync(path.join(outDir, 'narration.json'), JSON.stringify(result, null, 2));
console.log(`wrote ${path.relative(ROOT, path.join(outDir, 'narration.json'))} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
