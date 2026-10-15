#!/usr/bin/env node
// Probe the finished MP4, run the required finalizer with the bundled ffprobe on PATH (this machine has no
// system-wide FFmpeg; binaries come from ffmpeg-static / ffprobe-static), then upload the MP4, its thumbnail and its
// publishing copy (output/<slug>.md) to the private Hugging Face repo in huggingface.json as <NNN>-<slug>, and finalize
// again so the links appear in the catalog.
//   node tools/finalize.mjs <slug> [--probe-only] [--no-upload]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('Usage: node tools/finalize.mjs <slug> [--probe-only] [--no-upload]'); process.exit(2); }
const ffprobe = require('ffprobe-static').path;
const env = { ...process.env, PATH: path.dirname(ffprobe) + path.delimiter + process.env.PATH };
const probe = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,avg_frame_rate,nb_frames,sample_rate,channels', '-of', 'default=nw=1', path.join(ROOT, 'output', `${slug}.mp4`)], { encoding: 'utf8' });
process.stdout.write(probe.stdout + probe.stderr);
if (probe.status !== 0) process.exit(probe.status ?? 1);
if (process.argv.includes('--probe-only')) {
  const qa = spawnSync('python', [path.join(ROOT, 'scripts', 'finalize_video.py'), slug, '--probe-only'], { cwd: ROOT, env, stdio: 'inherit' });
  process.exit(qa.status ?? 1);
}
const finalize = () => spawnSync('python', [path.join(ROOT, 'scripts', 'finalize_video.py'), slug], { cwd: ROOT, env, stdio: 'inherit' }).status ?? 1;
if (finalize() !== 0) process.exit(1);
if (process.argv.includes('--no-upload')) process.exit(0);
// Required archive step for every film: MP4 + thumbnail + publishing copy, numbered in the shared folder. Runs after
// finalizing, so rendering and finalizing never depend on the network.
const up = spawnSync('python', [path.join(ROOT, 'scripts', 'upload_to_hf.py'), slug], { cwd: ROOT, env, stdio: 'inherit' });
if ((up.status ?? 1) !== 0) { console.error(`Finalized, but the Hugging Face upload failed. Fix the cause above, then run: node tools/finalize.mjs ${slug}`); process.exit(3); }
process.exit(finalize());
