#!/usr/bin/env node
// Deterministic frame renderer: bundles src/entry.ts, serves the repo locally, drives headless Chrome (WebGL on the
// GPU) frame by frame and either saves still frames or pipes them into FFmpeg with the mixed soundtrack.
//   node tools/render.mjs <slug> --frames 30,600,1500 [--scale 0.5]     → build/<slug>/frames/f00030.jpg ...
//   node tools/render.mjs <slug> --final [--crf 19]                      → output/<slug>.mp4 (needs build/<slug>/audio/mix.wav)
// Film grain makes low CRF values very large (CRF 15 ≈ 30 Mbit/s); CRF 19 keeps a 72 s short near upload-friendly sizes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), slug = args[0];
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[i + 1]) : d; };
if (!slug) { console.error('Usage: node tools/render.mjs <slug> (--frames a,b,c | --range a-b | --final | --thumbnail) [--scale s] [--png]'); process.exit(2); }
const story = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', `${slug}.json`), 'utf8'));
const { width: W, height: H, fps, duration_s } = story.project;
const total = duration_s * fps;
const scale = Number(opt('scale', '1')), final = !!opt('final', false), png = !!opt('png', false);
const buildDir = path.join(ROOT, 'build', slug), webDir = path.join(buildDir, 'web');
fs.mkdirSync(webDir, { recursive: true });

await esbuild.build({ entryPoints: [path.join(ROOT, 'src', 'entry.ts')], bundle: true, format: 'esm', target: 'es2022', outfile: path.join(webDir, 'film.js'), logLevel: 'warning', minify: false });
fs.writeFileSync(path.join(webDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>${slug}</title><style>html,body{margin:0;background:#000}canvas{display:block}</style><body><script type="module" src="film.js"></script></body>`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-unsafe-swiftshader', `--window-size=${W},${H}`],
});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text().slice(0, 600)}`); });
page.on('pageerror', (e) => console.log(`[page error] ${String(e.stack ?? e).slice(0, 1200)}`));
await page.goto(`http://127.0.0.1:${port}/build/${slug}/web/index.html?slug=${slug}&scale=${scale}`);
let info;
try { info = await page.evaluate(() => window.__filmReady); }
catch (e) { console.error('Film failed to initialise:', await page.evaluate(() => window.__filmError).catch(() => String(e))); await browser.close(); server.close(); process.exit(1); }
console.log(`ready | ${info.frames} frames @ ${info.fps} fps | GPU: ${info.gpu}`);

const mime = png ? 'image/png' : 'image/jpeg';
const grab = async (i) => Buffer.from((await page.evaluate(([f, m]) => window.__film.renderFrame(f, m, 0.96), [i, mime])).split(',')[1], 'base64');

// The thumbnail (clean still + headline, 1080×1920 JPG) is written next to the video: output/<slug>.jpg.
const thumbPath = path.join(ROOT, story.delivery.video_output.replace(/\.mp4$/, '.jpg'));
const writeThumbnail = async () => {
  const url = await page.evaluate(() => window.__film.renderThumbnail('image/jpeg', 0.92));
  fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
  fs.writeFileSync(thumbPath, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`wrote ${path.relative(ROOT, thumbPath)} (${(fs.statSync(thumbPath).size / 1024).toFixed(0)} KB)`);
};

if (opt('thumbnail', false)) {
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
  console.log(`encoded ${path.relative(ROOT, out)} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await writeThumbnail();
}
await browser.close(); server.close();
