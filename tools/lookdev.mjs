#!/usr/bin/env node
// Render frames of a look-development scene (src/lookdev/<name>.ts) through the real pipeline, for building and
// checking library assets without a storyboard.   node tools/lookdev.mjs <name> [--frames 0,30,60] [--scale 0.5]
// → build/lookdev/<name>/f00000.jpg ... (plus a contact sheet sheet.jpg when several frames are rendered)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url), ffmpeg = require('ffmpeg-static');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), name = args[0];
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!name) { console.error('Usage: node tools/lookdev.mjs <name> [--frames a,b,c] [--scale s] [--cell 360]'); process.exit(2); }
const frames = String(opt('frames', '0')).split(',').map(Number), scale = Number(opt('scale', '0.5'));
const outDir = path.join(ROOT, 'build', 'lookdev', name), webDir = path.join(ROOT, 'build', 'lookdev', 'web');
fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(webDir, { recursive: true });
await esbuild.build({ entryPoints: [path.join(ROOT, 'src', 'lookdev', 'entry.ts')], bundle: true, format: 'esm', target: 'es2022', outfile: path.join(webDir, 'lookdev.js'), logLevel: 'warning' });
fs.writeFileSync(path.join(webDir, 'index.html'), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style><body><script type="module" src="lookdev.js"></script></body>`);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text().slice(0, 800)}`); });
page.on('pageerror', (e) => console.log(`[page error] ${String(e.stack ?? e).slice(0, 1500)}`));
await page.goto(`http://127.0.0.1:${server.address().port}/build/lookdev/web/index.html?name=${name}&scale=${scale}`);
try { await page.evaluate(() => window.__filmReady); }
catch (e) { console.error('Lookdev failed:', await page.evaluate(() => window.__filmError).catch(() => String(e))); await browser.close(); server.close(); process.exit(1); }
const t0 = Date.now(), files = [];
for (const i of frames) {
  const url = await page.evaluate((f) => window.__film.renderFrame(f, 'image/jpeg', 0.95), i);
  const file = path.join(outDir, `f${String(i).padStart(5, '0')}.jpg`); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); files.push(file);
}
await browser.close(); server.close();
if (files.length > 1) {
  const cw = opt('cell', '360'), inputs = files.flatMap((f) => ['-i', f]);
  const filter = files.map((_, i) => `[${i}:v]scale=${cw}:-2[v${i}]`).join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + `hstack=inputs=${files.length}[o]`;
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[o]', '-q:v', '3', path.join(outDir, 'sheet.jpg')]);
}
console.log(`wrote ${files.length} frame(s) to ${path.relative(ROOT, outDir)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
