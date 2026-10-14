import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, smooth, dB } from '../../library/audio/synth.mjs';

// Original procedural score + sound design for "What if a mountain on Earth grew 100 kilometres tall?".
// Cue times come from the storyboard (scene/shot windows) and the measured narration word times in src timeline.
const story = JSON.parse(fs.readFileSync(new URL('../../../stories/mountain-grew-100-km-tall.json', import.meta.url), 'utf8'));
const S = Object.fromEntries(story.scenes.map((sc) => [sc.id, sc]));
const cues = story.scenes.flatMap((sc) => sc.audio_cues);
const VACUUM = cues.find((c) => c.kind === 'silence');
const IMPACTS = cues.filter((c) => c.kind === 'impact' && c.at_s > 45).map((c) => c.at_s);
const METEORS = [25.45, 25.95, 26.3, 26.85, 27.2, 27.55, 27.8];

const norm = (x) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] /= m; return x; };
/** Band-limited noise of `dur` seconds shaped by g(t) (t relative to the clip). */
function band(dur, random, lo, hi, g = () => 1, color = 'pink') {
  const x = filter(filter(noise(Math.ceil(dur * SR), random, color), 'highpass', lo), 'lowpass', hi);
  for (let i = 0; i < x.length; i++) x[i] *= g(i / SR);
  return x;
}
const win = (a, b, fi = 0.3, fo = 0.3) => (t) => smooth(a - fi, a, t) * (1 - smooth(b, b + fo, t));

/** Felt-piano note with a slow bloom. */
function felt(note, dur = 3.5) {
  const f = NOTE(note), a = tone(dur, f), b = tone(dur, f * 2.002), y = new Float32Array(a.length);
  for (let i = 0; i < y.length; i++) { const t = i / SR; y[i] = (a[i] + 0.22 * b[i] * Math.exp(-t * 2.5)) * Math.exp(-t * 1.25) * (1 - Math.exp(-t * 90)); }
  return y;
}
/** Deep impact: sub drop + broadband crack + debris tail. */
function slam(random, len = 1.8, f0 = 70, f1 = 28) {
  const n = Math.ceil(len * SR), y = new Float32Array(n);
  const sub = tone(len, (t) => f1 + (f0 - f1) * Math.exp(-t * 6));
  const crack = filter(noise(n, random, 'white'), 'bandpass', 2400, 0.8), body = filter(noise(n, random, 'brown'), 'lowpass', 420);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] = sub[i] * Math.exp(-t * 3.2) * 0.9 + crack[i] * Math.exp(-t * 28) * 0.9 + body[i] * Math.exp(-t * 2.4) * 1.6; }
  return norm(y);
}
function whoosh(random, len = 0.6, lo = 300, hi = 3800) {
  const x = filter(noise(Math.ceil(len * SR), random, 'pink'), 'bandpass', (t) => lo + (hi - lo) * Math.sin(Math.PI * Math.min(1, t / len)), 1.2);
  return norm(shape(x, (t) => envAR(t, len, len * 0.55, len * 0.4)));
}

export function buildSoundtrack(duration) {
  const music = stereo(duration), sfx = stereo(duration), random = rng(100100);
  const put = (mono, at, db, pan = 0) => mixMono(sfx, mono, at, dB(db) * 0.5, pan);   // dB relative to the voice peak (0.5)

  // ------------------------------------------------------------------ score (D minor, opens to fifths in space)
  const chords = [
    [0.0, 4.25, ['D2', 'A2', 'D3', 'F3'], 0.5],
    [4.2, 7.6, ['D2', 'A2', 'E3', 'A3', 'D4'], 0.75],
    [7.6, 11.5, ['Bb1', 'F2', 'D3', 'F3', 'C4'], 0.75],
    [11.5, 17.1, ['G1', 'D2', 'Bb2', 'D3', 'G3'], 0.65],
    [17.1, 22.7, ['Eb2', 'Bb2', 'G3', 'D4'], 0.6],
    [22.7, 28.2, ['C2', 'G2', 'Eb3', 'G3', 'D4'], 0.7],
    [28.2, 33.3, ['D2', 'A2', 'D3', 'A3', 'E4', 'A4'], 0.85],
    [33.3, 40.4, ['Bb1', 'F2', 'Bb2', 'D3', 'F3'], 0.7],
    [40.4, 45.6, ['A1', 'E2', 'A2', 'C#3', 'G3'], 0.8],
    [46.2, 51.4, ['D2', 'A2', 'F3', 'A3'], 0.55],
    [51.0, duration + 0.5, ['D2', 'A2', 'D3', 'F3'], 0.45],
  ];
  chords.forEach(([a, b, notes, g], i) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + 1.4, attack: i === 0 ? 0.05 : 0.9, release: 1.2, bright: 1.6, detune: 6, seed: 300 + i }), Math.max(0, a - 0.2), g));
  // Sparse piano motif; a rising line through the climb, a single high note at the summit, a falling pair at the slump.
  [[0.15, 'D4'], [2.2, 'A4'], [4.3, 'F5'], [6.1, 'E5'], [7.7, 'D5'], [9.6, 'A4'], [11.6, 'G4'], [13.7, 'Bb4'], [15.4, 'D5'], [17.2, 'Eb5'], [19.2, 'G5'],
   [22.8, 'G4'], [24.5, 'D5'], [26.3, 'G5'], [28.3, 'A5'], [31.9, 'D4'], [34.0, 'F4'], [37.3, 'D5'], [41.0, 'E5'], [43.0, 'G5'], [47.7, 'F5'], [49.1, 'D5'], [51.9, 'A4'], [53.6, 'D4']]
    .forEach(([t, n], i) => mixMono(music, felt(n), t, 0.09, ((i % 5) - 2) * 0.2));
  // Climb pulse: a soft low tick that quickens with altitude (S03-S05), silent at the summit.
  for (let t = 11.6; t < 28.1;) {
    const k = Math.min(1, (t - 11.6) / 16.5), tick = shape(tone(0.12, 92 + 40 * k), (u) => Math.exp(-u * 30) * (1 - Math.exp(-u * 600)));
    mixMono(music, tick, t, 0.22, 0); t += 0.62 - 0.22 * k;
  }
  // Tension riser into the crack, cut dead at the vacuum.
  const riserLen = VACUUM.at_s - 40.4;
  const riser = band(riserLen, random, 200, 6000, (t) => Math.pow(t / riserLen, 2.2));
  const riserTone = tone(riserLen, (t) => 110 * Math.pow(2, 1.5 * t / riserLen));
  for (let i = 0; i < riser.length; i++) riser[i] = riser[i] * 0.6 + riserTone[i] * 0.25 * Math.pow(i / riser.length, 1.6);
  mixMono(music, riser, 40.4, 0.5, 0);
  // Normalise the score to ~ -20 dBFS RMS so the mixer's music_level_db_below_voice lands as authored.
  let s2 = 0; for (let i = 0; i < music.L.length; i++) s2 += music.L[i] * music.L[i] + music.R[i] * music.R[i];
  const k = 0.1 / Math.sqrt(s2 / (2 * music.L.length)); for (let i = 0; i < music.L.length; i++) { music.L[i] *= k; music.R[i] *= k; }

  // ------------------------------------------------------------------ S01 / S09: the city crossing (same bed, so the loop is seamless)
  const city = (a, b) => {
    const len = b - a;
    put(band(len, random, 40, 380, win(0, len, 0.05, 0.3), 'brown'), a, -16, 0);
    put(band(len, random, 500, 2600, (t) => 0.5 + 0.5 * Math.sin(t * 0.7)), a, -26, 0.25);
    for (let t = a + 0.1; t < b - 0.05; t += 1.0) put(shape(tone(0.07, 2450), (u) => envAR(u, 0.07, 0.005, 0.02)), t, -30, -0.4);   // crossing beeper
    for (let t = a + 0.2, j = 0; t < b - 0.1; t += 0.52, j++) put(norm(shape(filter(noise(Math.ceil(0.09 * SR), random, 'pink'), 'bandpass', 900 + 200 * (j % 2), 1.4), (u) => Math.exp(-u * 45) * (1 - Math.exp(-u * 600)))), t, -27, j % 2 ? 0.3 : -0.2);
  };
  city(0, S.S01.end_s); city(S.S09.shots[1].start_s, duration);
  put(norm(band(3.4, random, 18, 120, (t) => smooth(0, 3.2, t) * (0.7 + 0.3 * Math.sin(t * 9)), 'brown')), 0.85, -12, 0);
  put(slam(random, 0.9, 60, 32), 1.0, -8, 0);
  put(whoosh(random, 0.9, 900, 5200), 1.2, -16, -0.5);
  for (let i = 0; i < 9; i++) put(norm(shape(filter(noise(Math.ceil(0.05 * SR), random, 'white'), 'bandpass', 1800 + i * 90, 2), (u) => Math.exp(-u * 70))), 1.25 + i * 0.07, -22, -0.5 + i * 0.03);

  // ------------------------------------------------------------------ S02: orbit and scale
  put(whoosh(random, 0.55), 4.15, -10, 0);
  put(norm(band(7.2, random, 50, 260, win(0, 6.9, 0.6, 0.4), 'brown')), 4.25, -22, 0);
  for (let i = 0; i < 11; i++) put(norm(shape(tone(0.5, 880 * Math.pow(2, i / 12)), (u) => Math.exp(-u * 9) * (1 - Math.exp(-u * 400)))), 7.7 + 0.12 * i, -16, -0.3 + i * 0.06);
  put(norm(band(2.4, random, 400, 2200, win(0, 2.3, 0.4, 0.3))), 9.1, -20, 0.2);

  // ------------------------------------------------------------------ S03: snow ridge at 8.85 km
  put(norm(band(5.6, random, 500, 5200, (t) => win(0, 5.5, 0.2, 0.3)(t) * (0.55 + 0.45 * Math.sin(t * 1.3) * Math.sin(t * 0.37 + 1)))), 11.5, -16, 0.15);
  put(norm(shape(tone(1.2, 1318.5), (u) => Math.exp(-u * 3.5) * (1 - Math.exp(-u * 300)))), 13.65, -18, 0.2);
  for (let t = 14.45, j = 0; t < 17.0; t += 1.1, j++) {
    put(norm(band(0.42, random, 600, 3200, (u) => envAR(u, 0.42, 0.12, 0.2))), t, -19, -0.1);           // inhale through the mask
    put(norm(band(0.55, random, 250, 1800, (u) => envAR(u, 0.55, 0.05, 0.35))), t + 0.5, -18, -0.1);   // exhale + valve
    put(norm(shape(filter(noise(Math.ceil(0.05 * SR), random, 'white'), 'highpass', 3000), (u) => Math.exp(-u * 80))), t + 0.52, -26, -0.1);
  }

  // ------------------------------------------------------------------ S04: 19 km — near silence, then the glass boils
  put(norm(band(5.6, random, 3000, 9000, win(0, 5.5, 0.3, 0.3))), 17.1, -30, -0.3);   // suit hiss
  { const len = 4.7, x = new Float32Array(Math.ceil(len * SR));
    for (let j = 0; j < 260; j++) { const t0 = Math.pow(random(), 0.6) * (len - 0.12), f = 300 + random() * 900, d = 0.03 + random() * 0.05;
      const pop = shape(tone(d, (u) => f * (1 + 2.5 * u / d)), (u) => Math.sin(Math.PI * u / d) * Math.exp(-u * 30));
      const amp = smooth(0, 0.6, t0) * (0.4 + 0.6 * smooth(0.6, 1.5, t0)); x.set(pop.map((v, i) => v * amp + (x[Math.round(t0 * SR) + i] || 0)), Math.round(t0 * SR)); }
    const rumble = band(len, random, 80, 700, (t) => smooth(0.4, 1.6, t), 'brown');
    for (let i = 0; i < x.length; i++) x[i] += rumble[i] * 0.6;
    put(norm(x), 18.0, -14, 0.05); }

  // ------------------------------------------------------------------ S05: black sky, meteors
  put(whoosh(random, 0.6, 200, 2600), 22.65, -12, 0);
  put(norm(band(2.4, random, 300, 1600, (t) => (1 - smooth(0, 2.3, t)) * 0.8)), 23.0, -22, 0);
  METEORS.forEach((t, i) => {
    const len = 0.9, sizzle = filter(noise(Math.ceil(len * SR), random, 'white'), 'bandpass', (u) => 5200 - 3200 * u / len, 2.5);
    const boom = shape(tone(len, (u) => 70 - 30 * u / len), (u) => envAR(u, len, 0.05, 0.6) * 0.5);
    const y = sizzle.map((v, k) => v * envAR(k / SR, len, 0.04, 0.55) + boom[k] * (i === 2 ? 1 : 0.3));
    put(norm(y), t, i === 2 ? -9 : -14, i % 2 ? 0.45 : -0.45);
  });

  // ------------------------------------------------------------------ S06: summit and the death zone
  put(norm(band(5.0, random, 2000, 7000, win(0, 4.9, 0.5, 0.5))), 28.2, -30, 0);
  put(slam(random, 2.2, 55, 24), 31.9, -10, 0);

  // ------------------------------------------------------------------ S07: storms against the wall, dry lee wind
  put(norm(band(7.1, random, 60, 900, (t) => win(0, 7.0, 0.4, 0.4)(t) * (0.6 + 0.4 * Math.sin(t * 0.9)), 'brown')), 33.3, -14, -0.1);
  put(norm(band(7.1, random, 900, 6000, (t) => win(0, 7.0, 0.4, 0.4)(t) * smooth(0, 3.5, t))), 33.3, -24, 0.2);
  put(norm(shape(filter(noise(Math.ceil(3.2 * SR), random, 'brown'), 'lowpass', 260), (t) => envAR(t, 3.2, 0.06, 2.6) * (0.7 + 0.3 * Math.sin(t * 11) * Math.sin(t * 3.3)))), 37.0, -10, -0.2);
  put(norm(shape(filter(noise(Math.ceil(0.4 * SR), random, 'white'), 'highpass', 1200), (t) => Math.exp(-t * 12))), 36.95, -18, -0.3);
  put(norm(band(2.0, random, 700, 2600, win(0, 1.9, 0.5, 0.3))), 38.4, -16, 0.3);

  // ------------------------------------------------------------------ S08: crack (vacuum is applied to the music by tools/soundtrack.mjs)
  put(norm(band(4.9, random, 30, 200, (t) => smooth(0, 4.9, t) * 0.8, 'brown')), 40.4, -18, 0);
  IMPACTS.forEach((t, i) => put(slam(random, 1.6 - i * 0.15, 80 - i * 8, 30), t, [-6, -7, -8, -9][i] ?? -9, [0, -0.35, 0.35, -0.15][i] ?? 0));
  for (let i = 0; i < 14; i++) put(norm(shape(filter(noise(Math.ceil(0.08 * SR), random, 'white'), 'bandpass', 700 + random() * 2500, 1.5), (u) => Math.exp(-u * 40))), 45.7 + random() * 1.6, -18, random() * 1.4 - 0.7);
  put(norm(band(2.0, random, 25, 300, (t) => envAR(t, 2.0, 0.05, 0.8) * (0.7 + 0.3 * Math.sin(t * 13)), 'brown')), 45.7, -10, 0);

  // ------------------------------------------------------------------ S09: geological sag, pitch falling, then the city again
  { const len = 3.8, g = band(len, random, 20, 240, (t) => envAR(t, len, 0.3, 1.4), 'brown'), drone = tone(len, (t) => 58 * Math.pow(2, -t / len)), y = new Float32Array(g.length);
    for (let i = 0; i < y.length; i++) y[i] = g[i] + drone[i] * 0.35 * envAR(i / SR, len, 0.3, 1.4);
    put(norm(y), 47.6, -12, 0); }

  // Keep every bed silent inside the pre-impact vacuum so the first crack lands in true quiet.
  const a = VACUUM.at_s, b = VACUUM.at_s + VACUUM.duration_s;
  for (let i = Math.floor((a - 0.05) * SR); i < Math.min(sfx.L.length, Math.ceil(IMPACTS[0] * SR)); i++) {
    const t = i / SR, gk = 1 - (1 - dB(-24)) * smooth(a - 0.05, a + 0.03, t);
    sfx.L[i] *= gk; sfx.R[i] *= gk;
  }
  return { music, sfx };
}
