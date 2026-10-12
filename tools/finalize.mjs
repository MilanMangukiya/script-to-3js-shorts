#!/usr/bin/env node
// Probe the finished MP4 and run the required finalizer with the bundled ffprobe on PATH
// (this machine has no system-wide FFmpeg; binaries come from ffmpeg-static / ffprobe-static).
//   node tools/finalize.mjs <slug> [--probe-only]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('Usage: node tools/finalize.mjs <slug> [--probe-only]'); process.exit(2); }
const ffprobe = require('ffprobe-static').path;
const env = { ...process.env, PATH: path.dirname(ffprobe) + path.delimiter + process.env.PATH };
const probe = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,avg_frame_rate,nb_frames,sample_rate,channels', '-of', 'default=nw=1', path.join(ROOT, 'output', `${slug}.mp4`)], { encoding: 'utf8' });
process.stdout.write(probe.stdout + probe.stderr);
if (probe.status !== 0) process.exit(probe.status ?? 1);
if (process.argv.includes('--probe-only')) process.exit(0);
const fin = spawnSync('python', [path.join(ROOT, 'scripts', 'finalize_video.py'), slug], { cwd: ROOT, env, stdio: 'inherit' });
process.exit(fin.status ?? 1);
