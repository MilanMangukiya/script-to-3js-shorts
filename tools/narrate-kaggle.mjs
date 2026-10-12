#!/usr/bin/env node
// Narration on a free Kaggle GPU instead of the local CPU. Same voice (Kokoro-82M), same trimming and word
// alignment (tools/lib/align.mjs) and the same outputs as tools/narrate.mjs:
// build/<slug>/audio/narration.json + build/<slug>/audio/narration/<scene>.wav.
//   node tools/narrate-kaggle.mjs <storyboard.json> [--voice am_michael] [--speed 0.92] [--out build/<slug>/audio]
//                                 [--accelerator NvidiaTeslaT4] [--timeout-min 30] [--work build/<slug>/kaggle]
// Needs the Kaggle CLI (pip install kaggle) signed in (`kaggle auth login`, or ~/.kaggle/kaggle.json) and a
// phone-verified Kaggle account (the job downloads the models from Hugging Face). Each run uses a few minutes of the
// weekly GPU quota and keeps one private Kaggle notebook per story ("narrate-<slug>"), updated on every run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readWav } from './lib/wav.mjs';
import { norm, sceneRecord } from './lib/align.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const storyFile = args[0];
if (!storyFile || storyFile.startsWith('--')) {
  console.error('Usage: node tools/narrate-kaggle.mjs <storyboard.json> [--voice id] [--speed n] [--out dir] [--accelerator id] [--timeout-min n] [--work dir]');
  process.exit(2);
}
const story = JSON.parse(fs.readFileSync(storyFile, 'utf8'));
const slug = story.project.slug;
const voice = opt('voice', 'am_michael');
const speed = Number(opt('speed', '0.92'));
const accelerator = opt('accelerator', 'NvidiaTeslaT4');
const timeoutMs = Number(opt('timeout-min', '30')) * 60_000;
const outDir = path.resolve(opt('out', path.join(ROOT, 'build', slug, 'audio')));
const jobDir = path.resolve(opt('work', path.join(ROOT, 'build', slug, 'kaggle')));
const dlDir = path.join(jobDir, 'output');
const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

// ------------------------------------------------------------------ Kaggle CLI
function findCli() {
  if (process.env.KAGGLE_CLI) return { cmd: process.env.KAGGLE_CLI, pre: [] };
  const candidates = [{ cmd: 'kaggle', pre: [] }];
  const appdata = process.env.APPDATA;
  if (appdata && fs.existsSync(path.join(appdata, 'Python'))) {
    for (const v of fs.readdirSync(path.join(appdata, 'Python'))) candidates.push({ cmd: path.join(appdata, 'Python', v, 'Scripts', 'kaggle.exe'), pre: [] });
  }
  candidates.push({ cmd: process.env.PYTHON ?? 'python', pre: ['-c', 'import sys; from kaggle.cli import main; sys.exit(main())'] });
  for (const c of candidates) {
    const r = spawnSync(c.cmd, [...c.pre, '--version'], { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });
    if (r.status === 0) return c;
  }
  console.error('Kaggle CLI not found. Install it with: python -m pip install --user kaggle   (then: kaggle auth login)');
  process.exit(1);
}
const cli = findCli();
const cliEnv = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
const kaggle = (...a) => spawnSync(cli.cmd, [...cli.pre, ...a], { encoding: 'utf8', env: cliEnv, maxBuffer: 64 * 1024 * 1024 });

function kaggleUser() {
  if (process.env.KAGGLE_USERNAME) return process.env.KAGGLE_USERNAME;
  const dir = path.join(os.homedir(), '.kaggle');
  for (const f of ['credentials.json', 'kaggle.json']) {
    try { const u = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).username; if (u) return u; } catch { /* next */ }
  }
  console.error('No Kaggle sign-in found. Run: kaggle auth login   (or put kaggle.json in ~/.kaggle)');
  process.exit(1);
}
const user = kaggleUser();
const kernelSlug = `narrate-${slug}`.slice(0, 50).replace(/-+$/, '');
const kernelId = `${user}/${kernelSlug}`;

// ------------------------------------------------------------------ job folder
fs.rmSync(jobDir, { recursive: true, force: true });
fs.mkdirSync(dlDir, { recursive: true });
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const job = { run_id: runId, slug, voice, speed, scenes: story.scenes.map((sc) => ({ id: sc.id, text: sc.narration.text })) };
const template = fs.readFileSync(path.join(ROOT, 'tools', 'kaggle', 'narrate_kaggle.py'), 'utf8');
fs.writeFileSync(path.join(jobDir, 'narrate_kaggle.py'), template.replace('__JOB_B64__', Buffer.from(JSON.stringify(job), 'utf8').toString('base64')));
fs.writeFileSync(path.join(jobDir, 'kernel-metadata.json'), JSON.stringify({
  id: kernelId, title: kernelSlug, code_file: 'narrate_kaggle.py', language: 'python', kernel_type: 'script',
  is_private: true, enable_gpu: true, enable_internet: true, machine_shape: accelerator,
  dataset_sources: [], competition_sources: [], kernel_sources: [], model_sources: [],
}, null, 2));

// ------------------------------------------------------------------ push, wait, download
console.log(`pushing ${kernelId} (${accelerator}, ${job.scenes.length} scenes, voice=${voice} speed=${speed}, run ${runId})`);
const push = kaggle('kernels', 'push', '-p', jobDir, '--accelerator', accelerator);
process.stdout.write(push.stdout ?? '');
if (push.status !== 0 || /error/i.test(push.stdout ?? '')) {
  console.error(push.stderr || 'kaggle kernels push failed');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let status = '';
await sleep(10_000);
for (;;) {
  const r = kaggle('kernels', 'status', kernelId);
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  const s = (text.match(/status "?([A-Za-z_.]+)"?/)?.[1] ?? text).toLowerCase();
  if (s !== status) { console.log(`[${secs()}] ${text}`); status = s; }
  if (/complete|error|cancel/.test(s)) {
    await sleep(15_000);
    const again = kaggle('kernels', 'status', kernelId);
    const s2 = (`${again.stdout ?? ''}${again.stderr ?? ''}`.match(/status "?([A-Za-z_.]+)"?/)?.[1] ?? '').toLowerCase();
    if (s2 === s) break;
    console.log(`[${secs()}] status changed again: ${s2}`);
    status = s2;
    continue;
  }
  if (Date.now() - t0 > timeoutMs) { console.error(`timed out after ${timeoutMs / 60000} min; the job keeps running on Kaggle: ${kernelId}`); process.exit(1); }
  await sleep(15_000);
}

const dl = kaggle('kernels', 'output', kernelId, '-p', dlDir, '-o');
if (dl.status !== 0) { console.error(dl.stderr || dl.stdout || 'kaggle kernels output failed'); process.exit(1); }
const logFile = fs.readdirSync(dlDir).find((f) => f.endsWith('.log'));
const tail = () => {
  if (!logFile) return '(no log downloaded)';
  const lines = fs.readFileSync(path.join(dlDir, logFile), 'utf8').split('\n');
  return lines.slice(-40).join('\n');
};
if (!/complete/.test(status) || !fs.existsSync(path.join(dlDir, 'raw.json'))) {
  console.error(`Kaggle job did not finish (${status}). Last log lines:\n${tail()}`);
  process.exit(1);
}

// ------------------------------------------------------------------ align locally, write narration.json
const raw = JSON.parse(fs.readFileSync(path.join(dlDir, 'raw.json'), 'utf8'));
if (raw.run_id !== runId) {
  console.error(`The downloaded files belong to another run of ${kernelId} (run ${raw.run_id ?? 'unknown'}, speed ${raw.speed}), not this one (${runId}).\n`
    + 'Another session or the Kaggle website pushed the same notebook meanwhile; run this command again when it is free.');
  process.exit(1);
}
fs.mkdirSync(path.join(outDir, 'narration'), { recursive: true });
const result = { slug, engine: raw.engine, model: raw.model, voice, speed, aligner: raw.aligner, device: raw.device, scenes: [] };
for (const sc of story.scenes) {
  const r = raw.scenes.find((x) => x.id === sc.id);
  if (!r || r.text !== sc.narration.text) { console.error(`Kaggle output does not match the storyboard for ${sc.id}`); process.exit(1); }
  const file = `narration/${sc.id}.wav`;
  fs.copyFileSync(path.join(dlDir, r.file), path.join(outDir, file));
  const wav = readWav(path.join(outDir, file));
  const duration = wav.channels[0].length / wav.sampleRate;
  const heard = r.heard.filter((h) => norm(h.text));
  const { record, exact, wordCount } = sceneRecord({ id: sc.id, text: sc.narration.text, file, sampleRate: wav.sampleRate, duration, heardText: r.heard_text, heard });
  result.scenes.push(record);
  console.log(`${sc.id} ${duration.toFixed(2)}s ${wordCount}w ${(wordCount / duration * 60).toFixed(0)}wpm match ${exact}/${wordCount} | ${record.heard}`);
}
fs.writeFileSync(path.join(outDir, 'narration.json'), JSON.stringify(result, null, 2));
console.log(`wrote ${path.relative(ROOT, path.join(outDir, 'narration.json'))} in ${secs()} (GPU: ${raw.device})`);
