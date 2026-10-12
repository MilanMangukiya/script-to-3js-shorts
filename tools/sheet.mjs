#!/usr/bin/env node
// Contact sheet of rendered smoke frames: node tools/sheet.mjs <slug> <out.jpg> f1,f2,... [cellWidth]
import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), ffmpeg = require('ffmpeg-static');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [slug, out, list, cw = '400'] = process.argv.slice(2), frames = list.split(',');
const inputs = frames.flatMap((f) => ['-i', path.join(ROOT, 'build', slug, 'frames', `f${String(f).padStart(5, '0')}.jpg`)]);
const filter = frames.map((_, i) => `[${i}:v]scale=${cw}:-2[v${i}]`).join(';') + ';' + frames.map((_, i) => `[v${i}]`).join('') + `hstack=inputs=${frames.length}[o]`;
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', frames.length > 1 ? filter : `[0:v]scale=${cw}:-2[o]`, '-map', '[o]', '-q:v', '3', out]);
console.log('wrote', out);
