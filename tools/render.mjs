#!/usr/bin/env node
// Deterministic frame renderer: bundles src/entry.ts, serves the repo locally, drives headless Chrome (WebGL on the
// GPU) frame by frame and either saves still frames or pipes them into FFmpeg with the mixed soundtrack.
//   node tools/render.mjs <slug> --frames 30,600,1500 [--scale 0.5]     → build/<slug>/frames/f00030.jpg ...
//   node tools/render.mjs <slug> --final [--crf 19]                      → output/<slug>.mp4 (needs build/<slug>/audio/mix.wav)
//   node tools/render.mjs <slug> --preview build/<slug>/review.mp4 --range 0-359 --scale 0.5 [--clean]
//   any mode: --quality standard|cinematic|draft overrides delivery.render_quality (not with --final)
// Preview-only --storyboard build/<slug>/variant.json overrides pipeline cameras/cuts, not stage construction
// or production-data overlays. Paired --narration/--audio review isolated timing JSON and a full-timeline WAV.
// Previews never write final videos or thumbnails.
// Film grain makes low CRF values very large (CRF 15 ≈ 30 Mbit/s); CRF 19 keeps a 72 s short near upload-friendly sizes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';
import { readWav } from './lib/wav.mjs';
import { assertCaptionTiming } from './lib/narration-quality.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), slug = args[0];
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[i + 1]) : d; };
const fail = (message) => { console.error(message); process.exit(2); };
if (!slug) fail('Usage: node tools/render.mjs <slug> (--frames a,b,c | --range a-b | --final | --thumbnail | --preview build/<path>.mp4 --range a-b) [--scale s] [--quality standard|cinematic|draft] [--png] [--clean] [--storyboard build/<path>.json]');
const story = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', `${slug}.json`), 'utf8'));
const { width: W, height: H, fps, duration_s } = story.project;
const total = duration_s * fps;
const scale = Number(opt('scale', '1')), final = !!opt('final', false), png = !!opt('png', false);
// --quality overrides the storyboard's delivery.render_quality for this run (e.g. 'draft' for fast look reviews).
const quality = opt('quality', undefined);
if (quality !== undefined && !['standard', 'cinematic', 'draft'].includes(quality)) fail('--quality must be standard, cinematic or draft');
if (final && quality !== undefined && quality !== (story.delivery?.render_quality ?? 'standard')) fail('--final renders the storyboard delivery.render_quality; change the storyboard rather than overriding it');
const buildDir = path.join(ROOT, 'build', slug), webDir = path.join(buildDir, 'web');
const preview = args.includes('--preview'), clean = args.includes('--clean');
let previewPath, previewRange, previewStory, previewNarration, previewAudio;
const under = (base, file) => { const relative = path.relative(base, file); return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };
const buildPath = (value, extension, label) => {
  if (typeof value !== 'string' || path.extname(value).toLowerCase() !== extension) fail(`${label} must name a ${extension} file under build/`);
  const resolved = path.resolve(ROOT, value), buildRoot = path.join(ROOT, 'build');
  let ancestor = resolved;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const canonical = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, resolved));
  if (!under(buildRoot, resolved) || !under(path.join(fs.realpathSync(ROOT), 'build'), canonical)) fail(`${label} must stay under the repository build/ directory`);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) fail(`${label} must name a file`);
  return resolved;
};
if (!preview && ['--clean', '--storyboard', '--narration', '--audio'].some((flag) => args.includes(flag))) fail('--clean, --storyboard, --narration and --audio are available only with --preview');
if (preview) {
  if (['final', 'thumbnail', 'frames', 'step'].some((name) => args.includes(`--${name}`))) fail('--preview cannot be combined with --final, --thumbnail, --frames or --step');
  previewPath = buildPath(opt('preview'), '.mp4', '--preview');
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1 || Math.round(W * scale) < 2 || Math.round(H * scale) < 2) fail('Preview --scale must be greater than 0 and at most 1, with at least 2 pixels per dimension');
  const range = opt('range');
  if (typeof range !== 'string' || !/^\d+-\d+$/.test(range)) fail('--preview requires --range <first>-<last> with inclusive integer frame bounds');
  previewRange = range.split('-').map(Number);
  if (!previewRange.every(Number.isSafeInteger) || previewRange[0] > previewRange[1] || previewRange[1] >= total) fail(`Preview range must satisfy 0 <= first <= last < ${total}`);
  const crf = Number(opt('crf', '22'));
  if (!Number.isInteger(crf) || crf < 0 || crf > 51) fail('Preview --crf must be an integer from 0 to 51');
  if (args.includes('--storyboard')) {
    const variantPath = buildPath(opt('storyboard'), '.json', '--storyboard');
    try { previewStory = JSON.parse(fs.readFileSync(variantPath, 'utf8')); }
    catch (error) { fail(`Cannot read preview storyboard: ${error.message}`); }
    if (['slug', 'width', 'height', 'fps', 'duration_s'].some((key) => previewStory.project?.[key] !== story.project[key])) fail('Preview storyboard must preserve project slug, width, height, fps and duration_s');
    const bindings = (document) => Array.isArray(document.scenes) && document.scenes.every((scene) => Array.isArray(scene?.shots))
      ? document.scenes.flatMap((scene) => scene.shots.map((shot) => `${scene.id}/${shot?.id}`)) : null;
    if (JSON.stringify(bindings(previewStory)) !== JSON.stringify(bindings(story))) fail('Preview storyboard must preserve the original ordered scene/shot bindings');
    const validation = spawnSync('python', [path.join(ROOT, 'scripts', 'validate_storyboard.py'), variantPath], { encoding: 'utf8', cwd: ROOT });
    if (validation.error || validation.status !== 0) fail(`Invalid preview storyboard: ${validation.error?.message || validation.stderr || validation.stdout}`);
    console.log('preview storyboard: pipeline cameras/cuts overridden; stage construction and production-data overlays remain unchanged');
  }
  if (args.includes('--narration') !== args.includes('--audio')) fail('An audiovisual preview requires both --narration <timing.json> and --audio <full-timeline.wav>');
  if (args.includes('--audio')) {
    if (clean) fail('Use normal overlays with --narration/--audio to review the assembled captions and picture');
    try {
      previewNarration = JSON.parse(fs.readFileSync(buildPath(opt('narration'), '.json', '--narration'), 'utf8'));
      previewAudio = buildPath(opt('audio'), '.wav', '--audio');
      const activeStory = previewStory ?? story;
      if (previewNarration.slug !== slug || !Array.isArray(previewNarration.scenes)
        || previewNarration.scenes.length !== activeStory.scenes.length) throw new Error('Narration must contain this film’s complete ordered scene list');
      for (const [index, scene] of activeStory.scenes.entries()) {
        const record = previewNarration.scenes[index];
        if (record.id !== scene.id || record.text !== scene.narration.text
          || record.words?.map((word) => word.text).join(' ') !== scene.narration.text.trim().split(/\s+/).join(' ')) throw new Error(`${scene.id}: narration/caption text or scene order differs from the storyboard`);
        assertCaptionTiming(record);
        if (scene.narration.start_s + record.duration_s > Math.min(scene.narration.end_s, scene.end_s - .15) + 1e-6) throw new Error(`${scene.id}: narration exceeds its scene window`);
      }
      const wav = readWav(previewAudio);
      if (Math.abs(wav.channels[0].length / wav.sampleRate - duration_s) > 1 / wav.sampleRate + 1e-6) throw new Error('Preview audio must span the complete film timeline, including silence');
    } catch (error) { fail(`Invalid audiovisual preview: ${error.message}`); }
  }
}
fs.mkdirSync(webDir, { recursive: true });

await esbuild.build({ entryPoints: [path.join(ROOT, 'src', 'entry.ts')], bundle: true, format: 'esm', target: 'es2022', outfile: path.join(webDir, 'film.js'), logLevel: 'warning', minify: false });
fs.writeFileSync(path.join(webDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>${slug}</title><style>html,body{margin:0;background:#000}canvas{display:block}</style><body><script type="module" src="film.js"></script></body>`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  if (new URL(req.url, 'http://x').pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (clean && new URL(req.url, 'http://x').pathname === `/build/${slug}/audio/narration.json`
    && !fs.existsSync(path.join(buildDir, 'audio', 'narration.json'))) {
    res.writeHead(204); res.end(); return;
  }
  if (previewNarration && new URL(req.url, 'http://x').pathname === `/build/${slug}/audio/narration.json`) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(previewNarration)); return;
  }
  if (previewStory && new URL(req.url, 'http://x').pathname === `/stories/${slug}.json`) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(previewStory)); return;
  }
  const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

let browser;
try {
browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-unsafe-swiftshader', `--window-size=${W},${H}`],
});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const runtimeErrors = [];
page.on('requestfailed', (request) => runtimeErrors.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', (response) => { if (response.status() >= 400) runtimeErrors.push(`${response.status()} ${response.url()}`); });
page.on('console', (m) => {
  if (m.type() === 'error') runtimeErrors.push(m.text());
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text().slice(0, 600)}`);
});
page.on('pageerror', (e) => { runtimeErrors.push(String(e.stack ?? e)); console.log(`[page error] ${String(e.stack ?? e).slice(0, 1200)}`); });
await page.goto(`http://127.0.0.1:${port}/build/${slug}/web/index.html?slug=${slug}&scale=${scale}${quality ? `&quality=${quality}` : ''}`);
let info;
try { info = await page.evaluate(() => window.__filmReady); }
catch (e) { throw new Error(`Film failed to initialise: ${await page.evaluate(() => window.__filmError).catch(() => String(e))}`); }
console.log(`ready | ${info.frames} frames @ ${info.fps} fps | quality ${info.quality} | GPU: ${info.gpu}`);

const mime = png ? 'image/png' : 'image/jpeg';
const grab = async (i) => Buffer.from((await page.evaluate(([f, m, c]) => window.__film.renderFrame(f, m, 0.96, c ? { overlay: false, captions: false } : {}), [i, mime, clean])).split(',')[1], 'base64');

// The thumbnail (clean still + headline, 1080×1920 JPG) is written next to the video: output/<slug>.jpg.
const thumbPath = path.join(ROOT, story.delivery.video_output.replace(/\.mp4$/, '.jpg'));
const writeThumbnail = async () => {
  const url = await page.evaluate(() => window.__film.renderThumbnail('image/jpeg', 0.92));
  fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
  fs.writeFileSync(thumbPath, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`wrote ${path.relative(ROOT, thumbPath)} (${(fs.statSync(thumbPath).size / 1024).toFixed(0)} KB)`);
};

if (preview) {
  const ffmpeg = require('ffmpeg-static'), [first, last] = previewRange;
  const clipDuration = (last - first + 1) / fps;
  const width = Math.max(2, Math.round(W * scale / 2) * 2), height = Math.max(2, Math.round(H * scale / 2) * 2);
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  const ff = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', png ? 'png' : 'mjpeg', '-i', 'pipe:0',
    ...(previewAudio ? ['-ss', String(first / fps), '-i', previewAudio, '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-t', String(clipDuration)] : ['-an']),
    '-vf', `scale=${width}:${height}:in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p`, '-c:v', 'libx264', '-preset', 'fast', '-crf', String(opt('crf', '22')),
    '-pix_fmt', 'yuv420p', '-r', String(fps), '-frames:v', String(last - first + 1), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', previewPath], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => { ff.once('error', reject); ff.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Preview FFmpeg exited ${code}`))); });
  done.catch(() => {}); // Observe spawn/encode failures while a browser frame is still being captured.
  ff.stdin.on('error', () => {}); // The write callback / done promise reports this failure.
  const t0 = Date.now();
  try {
    for (let i = first; i <= last; i++) {
      const buffer = await grab(i);
      await Promise.race([
        new Promise((resolve, reject) => ff.stdin.write(buffer, (error) => error ? reject(error) : resolve())),
        done.then(() => { throw new Error('Preview FFmpeg closed before all frames were written'); }),
      ]);
      if ((i - first) % 150 === 0) console.log(`preview frame ${i}/${last} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end(); await done;
    if (runtimeErrors.length) throw new Error(`Preview encountered runtime/resource errors: ${runtimeErrors.join('; ')}`);
    console.log(`encoded ${previewAudio ? 'audiovisual' : 'silent'} preview ${path.relative(ROOT, previewPath)} | ${width}x${height} | ${last - first + 1} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } finally {
    if (ff.exitCode === null && ff.signalCode === null) ff.kill();
  }
} else if (opt('thumbnail', false)) {
  await writeThumbnail();
} else if (!final) {
  const list = opt('frames') ? String(opt('frames')).split(',').map(Number)
    : (() => { const [a, b] = String(opt('range', `0-${total - 1}`)).split('-').map(Number); const step = Number(opt('step', '1')); const o = []; for (let i = a; i <= b; i += step) o.push(i); return o; })();
  const outDir = path.join(buildDir, 'frames'); fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  for (const i of list) { fs.writeFileSync(path.join(outDir, `f${String(i).padStart(5, '0')}.${png ? 'png' : 'jpg'}`), await grab(i)); }
  console.log(`wrote ${list.length} frame(s) to ${path.relative(ROOT, outDir)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} else {
  const ffmpeg = require('ffmpeg-static'), audio = path.join(buildDir, 'audio', 'mix.wav'), out = path.join(ROOT, story.delivery.video_output);
  if (!fs.existsSync(audio)) { console.error(`Missing soundtrack ${audio}; run tools/soundtrack.mjs first`); process.exit(1); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', png ? 'png' : 'mjpeg', '-i', 'pipe:0', '-i', audio,
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt('crf', '19')), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-t', String(duration_s), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const buf = await grab(i);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end(); await done;
  if (runtimeErrors.length) throw new Error(`Final render encountered runtime/resource errors: ${runtimeErrors.join('; ')}`);
  console.log(`encoded ${path.relative(ROOT, out)} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await writeThumbnail();
}
} finally {
  try { await browser?.close(); } finally { server.close(); }
}
