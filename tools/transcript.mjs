#!/usr/bin/env node
// Write the caption and transcript files from the real word timings, using the same phrase grouping as the
// burned-in captions (the caption layer itself is bundled and asked for its cues), so the files match the picture.
//   node tools/transcript.mjs <slug>
// Reads stories/<slug>.json and build/<slug>/audio/narration.json.
// Writes output/<slug>.srt (one cue per on-screen phrase) and output/<slug>.txt (title, then one [mm:ss] paragraph per scene).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('Usage: node tools/transcript.mjs <slug>'); process.exit(2); }
const story = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', `${slug}.json`), 'utf8'));
const narration = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', slug, 'audio', 'narration.json'), 'utf8'));

const bundle = path.join(ROOT, 'build', slug, 'transcript', 'captions.mjs');
await esbuild.build({ entryPoints: [path.join(ROOT, 'src', 'library', 'captions', 'KineticCaptions.ts')], bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'warning' });
const { KineticCaptions, DEFAULT_CAPTION_STYLE } = await import(pathToFileURL(bundle).href);

// Same inputs and style as src/entry.ts (only the character budget affects phrasing; the rest is layout).
const p = story.project, cap = story.captions, safe = cap.safe_area;
const words = (sc) => narration.scenes.find((n) => n.id === sc.id).words;
const captions = new KineticCaptions(
  story.scenes.map((sc) => ({ offset_s: sc.narration.start_s, words: words(sc), emphasis: sc.caption_emphasis })),
  { ...DEFAULT_CAPTION_STYLE, fontSize: cap.font_size_px, lineHeight: Math.round(cap.font_size_px * 1.27), maxCharsPerLine: cap.max_chars_per_line,
    baselineY: safe.caption_baseline_y_px, centerX: (safe.left_px + (p.width - safe.right_px)) / 2, maxWidth: p.width - safe.left_px - safe.right_px },
);

const D = p.duration_s;
const stamp = (t) => {
  const ms = Math.round(Math.min(Math.max(t, 0), D) * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const cues = captions.cues();
const srt = cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(Math.max(c.end, c.start + 0.05))}\n${c.lines.join('\n')}\n`).join('\n');

const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const txt = [p.title, '', ...story.scenes.flatMap((sc) => [`[${mmss(sc.narration.start_s)}] ${sc.narration.text}`, ''])].join('\n');

// Every spoken word exactly once, in order, and every cue inside the video.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();
const spoken = norm(story.scenes.map((sc) => sc.narration.text).join(' '));
const fromSrt = norm(cues.map((c) => c.lines.join(' ')).join(' '));
const fromTxt = norm(story.scenes.map((sc) => sc.narration.text).join(' '));
if (fromSrt !== spoken || fromTxt !== spoken) throw new Error('Transcript words do not match the narration');
if (cues.some((c) => c.start < -1e-6 || c.end > D + 1e-6)) throw new Error('A caption cue falls outside the video');
for (let i = 1; i < cues.length; i++) if (cues[i].start < cues[i - 1].end - 1e-6) throw new Error(`Cues ${i} and ${i + 1} overlap`);

fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'output', `${slug}.srt`), srt);
fs.writeFileSync(path.join(ROOT, 'output', `${slug}.txt`), txt);
console.log(`wrote output/${slug}.srt (${cues.length} cues, last ends ${stamp(cues[cues.length - 1].end)}) and output/${slug}.txt (${story.scenes.length} paragraphs) | ${spoken.split(' ').length} words verified`);
