import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));
const DAY = (d) => T.days[d - 1];

/** Light original score and Foley; event times come from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(3030), B = T.bounds, n = Math.ceil(D * SR);

  // ---- instruments
  // Marimba-like pluck: a fundamental and a bright fourth partial with a woody, quick decay.
  const mallet = (buf, at, note, g, pan = 0, decay = 7) => {
    const f = NOTE(note), a = tone(0.9, f), b = tone(0.9, f * 4.0), c = tone(0.9, f * 9.2);
    for (let i = 0; i < a.length; i++) { const u = i / SR; a[i] = (a[i] + 0.25 * b[i] * Math.exp(-u * 30) + 0.06 * c[i] * Math.exp(-u * 60)) * Math.exp(-u * decay) * (1 - Math.exp(-u * 500)); }
    mixMono(buf, a, at, g, pan);
  };
  const pizz = (buf, at, note, g, pan = 0) => {
    const f = NOTE(note), a = tone(0.6, f), b = tone(0.6, f * 2);
    for (let i = 0; i < a.length; i++) { const u = i / SR; a[i] = (a[i] + 0.3 * b[i]) * Math.exp(-u * 9) * (1 - Math.exp(-u * 260)); }
    mixMono(buf, filter(a, 'lowpass', 2400), at, g, pan);
  };
  const celesta = (buf, at, note, g, pan = 0) => {
    const f = NOTE(note), x = new Float32Array(Math.ceil(1.6 * SR));
    for (const [m, a] of [[1, 1], [2.0, 0.35], [3.0, 0.12], [4.16, 0.08]]) { const y = tone(1.6, f * m); for (let i = 0; i < x.length; i++) x[i] += a * y[i] * Math.exp(-(i / SR) * (2.6 + m)); }
    mixMono(buf, shape(x, (u) => 1 - Math.exp(-u * 900)), at, g, pan);
  };
  // Brassy chord stab: stacked saw-like harmonics through a soft low-pass, for passing the million.
  const brass = (buf, at, notes, g, len = 1.1) => {
    for (const [k, nn] of notes.entries()) {
      const f = NOTE(nn), x = new Float32Array(Math.ceil(len * SR));
      for (let h = 1; h <= 6; h++) { const y = tone(len, f * h * (1 + 0.002 * k)); for (let i = 0; i < x.length; i++) x[i] += y[i] / h; }
      mixMono(buf, filter(shape(x, (u) => envAR(u, len, 0.03, len * 0.7)), 'lowpass', 2200), at + 0.012 * k, g, (k % 2 ? 0.25 : -0.25));
    }
  };

  // ---- Foley voices
  // One coin: inharmonic bell partials with a click.
  const clink = (buf, at, g, pan = 0, pitch = 1) => {
    const f0 = (2100 + 1300 * r()) * pitch, len = 0.22, x = new Float32Array(Math.ceil(len * SR));
    for (const [m, a, dk] of [[1, 1, 26], [1.48, 0.6, 34], [2.21, 0.45, 44], [2.89, 0.3, 58], [3.65, 0.2, 72]]) { const y = tone(len, f0 * m); for (let i = 0; i < x.length; i++) x[i] += a * y[i] * Math.exp(-(i / SR) * dk); }
    const c = filter(noise(x.length, r, 'white'), 'highpass', 4000); for (let i = 0; i < x.length; i++) x[i] = x[i] * 0.5 + c[i] * Math.exp(-(i / SR) * 400) * 0.4;
    mixMono(buf, x, at, g, pan);
  };
  // A pour of coins over [at, at + len]: clinks at `rate` per second plus the hiss of coins sliding.
  const cascade = (at, len, rate, g, pan = 0, dark = 1) => {
    const hiss = filter(noise(Math.round(len * SR), r, 'pink'), 'bandpass', 3200 / dark, 0.6);
    mixMono(sfx, shape(hiss, (u) => envAR(u, len, Math.min(0.1, len * 0.2), Math.min(0.4, len * 0.5))), at, g * 0.9, pan);
    for (let t = at; t < at + len; t += -Math.log(1 - r()) / rate) clink(sfx, t, g * (0.15 + 0.3 * r()), pan + (r() - 0.5) * 0.7, 1 / Math.sqrt(dark));
  };
  // Wood under strain: a stick-slip groan.
  const creak = (at, len, g, pan = 0) => {
    const f = (u) => 70 + 50 * Math.sin(u * 2.3) + 30 * u / len, x = tone(len, f), nz = filter(noise(x.length, r, 'pink'), 'bandpass', 420, 1.5);
    for (let i = 0; i < x.length; i++) { const u = i / SR, slip = 0.5 + 0.5 * Math.sin(u * 2 * Math.PI * (22 + 10 * Math.sin(u * 3))); x[i] = (x[i] * 0.5 + nz[i] * 1.3) * slip * envAR(u, len, 0.15, 0.3); }
    mixMono(sfx, filter(x, 'lowpass', 1400), at, g, pan);
  };
  // A sharp crack of breaking timber with a low body thump.
  const crack = (at, g, pan = 0) => {
    const len = 0.5, nz = filter(noise(Math.round(len * SR), r, 'white'), 'highpass', 600), th = tone(len, (u) => 95 - 45 * u);
    const x = new Float32Array(nz.length); for (let i = 0; i < x.length; i++) { const u = i / SR; x[i] = nz[i] * Math.exp(-u * 28) * 0.9 + th[i] * Math.exp(-u * 9) * 0.8; }
    mixMono(sfx, x, at, g, pan);
  };
  const thud = (at, g, pan = 0, low = 55) => {
    const len = 0.9, th = tone(len, (u) => low * (1 - 0.35 * u)), nz = filter(noise(th.length, r, 'brown'), 'lowpass', 300);
    for (let i = 0; i < th.length; i++) { const u = i / SR; th[i] = (th[i] * 0.9 + nz[i] * 0.8) * Math.exp(-u * 5) * (1 - Math.exp(-u * 300)); }
    mixMono(sfx, th, at, g, pan);
  };
  // Window glass: a bright burst and a spray of tinkles.
  const shatter = (at, g, pan = 0) => {
    const len = 0.7, nz = filter(noise(Math.round(len * SR), r, 'white'), 'highpass', 2800);
    mixMono(sfx, shape(nz, (u) => Math.exp(-u * 14)), at, g * 0.8, pan);
    for (let k = 0; k < 18; k++) clink(sfx, at + 0.02 + r() * 0.5, g * (0.12 + 0.25 * r()), pan + (r() - 0.5) * 0.5, 1.9 + r());
  };
  const swish = (at, len, g, pan = 0) => mixMono(sfx, shape(filter(noise(Math.round(len * SR), r, 'pink'), 'bandpass', (u) => 600 + 1600 * Math.sin(Math.PI * Math.min(1, u / len)), 0.8), (u) => envAR(u, len, len * 0.4, len * 0.5)), at, g, pan);
  const chirp = (s, f, g, pan) => { const c = tone(0.11, (u) => f + 1400 * Math.sin(u * 58)); for (const d of [0, 0.14]) mixMono(music, shape(c, (u) => envAR(u, 0.11, 0.01, 0.07)), s + d, g, pan); };

  // ---- music
  // S01: a curious little figure while the million leaves.
  [['E5', 0.3], ['G5', 0.55], ['C6', 0.8], ['G5', 1.3], ['A5', 1.55], ['E5', 2.05], ['D5', 2.6], ['C5', 3.2]].forEach(([nn, t], k) => mallet(music, t, nn, 0.14, k % 2 ? 0.3 : -0.3));
  mixStereo(music, pad({ freqs: ['C3', 'G3', 'E4'].map(NOTE), dur: B[1] + 0.6, attack: 0.4, release: 0.6, detune: 4, bright: 1.2, seed: 2 }), 0, 0.32);
  // S02-S05: one rising note per doubling, so the time-lapse climbs a scale; low pulses under the strain.
  const scale = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7', 'A7', 'C8', 'D8', 'E8', 'G8'];
  for (let d = 2; d <= 25; d++) mallet(music, DAY(d), scale[Math.min(scale.length - 1, d - 2)], d < 15 ? 0.16 : 0.1, d % 2 ? 0.25 : -0.25, d < 15 ? 7 : 10);
  mixStereo(music, pad({ freqs: ['C3', 'G3', 'D4', 'E4'].map(NOTE), dur: B[2] - B[1] + 0.5, attack: 0.5, release: 0.5, detune: 5, bright: 1.4, seed: 4 }), B[1], 0.3);
  for (let t = B[2] + 0.1, k = 0; t < T.tableSnap - 0.35; t += 0.3, k++) pizz(music, t, k % 4 === 3 ? 'G1' : 'C2', 0.26);
  pizz(music, B[3] + 0.4, 'G2', 0.3, -0.1); pizz(music, B[3] + 0.75, 'C2', 0.34, 0.1);   // S04: a deflated "bwomp"
  for (let t = B[4] + 0.1, k = 0; t < T.floorBreak - 0.35; t += 0.25, k++) pizz(music, t, k % 4 === 3 ? 'Ab1' : 'C2', 0.22 + 0.12 * (t - B[4]) / (T.floorBreak - B[4]));
  // S06: outdoors; a bright chord the moment the million is passed.
  mixStereo(music, pad({ freqs: ['F3', 'C4', 'A4'].map(NOTE), dur: DAY(28) - B[5] + 0.3, attack: 0.6, release: 0.3, detune: 5, bright: 1.2, seed: 8 }), B[5], 0.26);
  // The chord lands right after the narration says it: "you finally beat the million."
  brass(music, T.millionChord, ['C4', 'E4', 'G4', 'C5'], 0.11, 1.3);
  [['C6', 0.05], ['E6', 0.12], ['G6', 0.19], ['C7', 0.26]].forEach(([nn, d]) => celesta(music, T.millionChord + d, nn, 0.08, 0.3));
  // S07: tension into the burst.
  for (let t = B[6] + 0.1, k = 0; t < T.houseBurst - 0.35; t += 0.2, k++) pizz(music, t, k % 2 ? 'C2' : 'Db2', 0.24);
  // S08: a shimmering swell as the last day's layer glows.
  mixStereo(music, pad({ freqs: ['C3', 'G3', 'B3', 'E4', 'G4'].map(NOTE), dur: B[8] - B[7] + 0.6, attack: 0.9, release: 0.6, detune: 6, bright: 2.0, seed: 12 }), B[7], 0.4);
  [['E6', 0], ['G6', 0.2], ['B6', 0.4], ['E7', 0.6]].forEach(([nn, d]) => celesta(music, T.cutaway + d, nn, 0.08, 0.2 - d * 0.6));
  // S09: resolve, and a little button on the briefcase.
  mixStereo(music, pad({ freqs: ['F3', 'A3', 'C4', 'E4'].map(NOTE), dur: D - B[8], attack: 0.5, release: 1.0, detune: 4, bright: 1.2, seed: 14 }), B[8], 0.3);
  pizz(music, D - 1.6, 'G3', 0.28, -0.2); pizz(music, D - 1.35, 'C3', 0.32, 0.2); celesta(music, D - 1.35, 'C6', 0.09, 0.3);
  automate(music, (t) => smooth(0, 0.03, t) * (1 - smooth(D - 0.9, D - 0.05, t)));

  // ---- ambience in the bed: a quiet room (fridge hum) indoors, birds and a distant road outdoors
  const room = filter(noise(n, r, 'pink'), 'lowpass', 180), air = filter(noise(n, r, 'pink'), 'bandpass', 900, 0.5);
  for (let i = 0; i < n; i++) { const t = i / SR, indoor = t < B[5]; room[i] *= indoor ? 0.03 : 0; air[i] *= indoor ? 0 : 0.03; }
  mixMono(music, room, 0, 1.6); mixMono(music, air, 0, 1.4, 0.1);
  for (const [s, f, p] of [[B[5] + 0.3, 3900, 0.5], [B[5] + 1.6, 4300, -0.4], [B[7] + 0.8, 3600, 0.6], [B[8] + 0.6, 4100, -0.5], [B[8] + 2.4, 3800, 0.4]]) chirp(s, f, dB(-34), p);

  // ---- Foley
  // S01: the briefcase lid snaps shut (two latches), then it is lifted away.
  for (const [d, p] of [[0, -0.1], [0.07, 0.1]]) { mixMono(sfx, shape(filter(noise(Math.round(0.05 * SR), r, 'white'), 'bandpass', 1800, 2), (u) => Math.exp(-u * 160)), T.caseClose + 0.33 + d, dB(-20), p); }
  thud(T.caseClose + 0.33, dB(-24), 0, 140);
  swish(T.caseClose + 0.45, T.caseGone - T.caseClose - 0.3, dB(-26), 0.4);
  clink(sfx, T.caseGone + 0.15, dB(-22), 0, 0.9);
  // S02-S05: each doubling arrives as coins: 1, 2, 4... clinks at first, then a pour that grows with the pile.
  for (let d = 2; d <= 25; d++) {
    const at = DAY(d);
    if (d <= 9) { const k = 2 ** (d - 2); for (let j = 0; j < Math.min(k, 24); j++) clink(sfx, at + (j / Math.max(1, Math.min(k, 24))) * 0.22, dB(-21 - Math.min(6, Math.log2(k + 1))), (r() - 0.5) * 0.6); }
    else cascade(at, 0.35 + 0.03 * (d - 9), 30 + 9 * (d - 9), dB(d < 15 ? -24 : -22 + 0.25 * (d - 15)), (r() - 0.5) * 0.3, 1 + 0.06 * (d - 9));
  }
  // S03: the overflow spilling off the edges, the table straining, a held breath, then it snaps.
  cascade(DAY(18), T.tableSnap - DAY(18), 22, dB(-30), 0.3, 1.2);
  creak(T.tableCreak, T.tableSnap - T.tableCreak - 0.32, dB(-20), -0.2);
  for (const [d, g, p] of [[0, -9, -0.2], [0.11, -13, 0.25], [0.24, -15, -0.1]]) crack(T.tableSnap + d, dB(g), p);
  thud(T.tableSnap + 0.38, dB(-10), 0, 60); cascade(T.tableSnap + 0.3, 1.4, 120, dB(-15), 0, 1.3);
  // S05: the floor groans for two days, goes quiet, then boards and joists give way one after another.
  creak(DAY(21), 0.9, dB(-24), 0.3); creak(DAY(22), 1.1, dB(-21), -0.3); creak(T.floorBreak - 1.4, 1.05, dB(-19), 0.1);
  for (const [d, g, p] of [[0, -9, 0.1], [0.09, -11, -0.3], [0.19, -12, 0.35], [0.31, -14, -0.15]]) crack(T.floorBreak + d, dB(g), p);
  thud(T.floorBreak + 0.42, dB(-8), 0, 45); cascade(T.floorBreak + 0.35, 1.6, 140, dB(-14), 0, 1.6);
  // S06: a muffled pour inside the house as it fills.
  for (let d = 26; d <= 28; d++) cascade(DAY(d), 0.5, 40, dB(-27), 0, 2.4);
  // S07: windows burst one after another, the coins roar out, a held breath, then the walls fall in sequence.
  [[-0.35, 0], [0.1, 0.09], [0.4, 0.19], [-0.5, 0.31], [0.55, 0.44], [-0.1, 0.58]].forEach(([p, d]) => shatter(T.windowsBurst + d, dB(-19), p));
  cascade(T.windowsBurst + 0.05, T.houseBurst - T.windowsBurst - 0.35, 90, dB(-22), 0, 1.5);
  [[0, -7, 0], [0.12, -9, 0.4], [0.24, -10, -0.4], [0.36, -12, 0.1]].forEach(([d, g, p]) => { thud(T.houseBurst + d, dB(g), p, 42); crack(T.houseBurst + d + 0.02, dB(g - 4), p); });
  cascade(T.houseBurst + 0.1, 1.4, 220, dB(-13), 0, 2.0);
  mixMono(sfx, shape(filter(noise(Math.round(1.8 * SR), r, 'brown'), 'lowpass', 160), (u) => envAR(u, 1.8, 0.1, 1.3)), T.houseBurst, dB(-14), 0);
  // S08: a glint as the last day's layer lights up.
  mixMono(sfx, shape(filter(noise(Math.round(1.5 * SR), r, 'white'), 'bandpass', (u) => 4000 + 3000 * u, 1.5), (u) => envAR(u, 1.5, 0.4, 0.9)), T.cutaway, dB(-30), 0.2);
  // S09: a single coin rolls off the mound and settles.
  for (let k = 0; k < 7; k++) clink(sfx, T.caseReveal + 0.9 + k * (0.18 - k * 0.018), dB(-24 - k), -0.2 + k * 0.05, 1.05);

  const wet = reverb(sfx, { decay: 0.8, mix: 0.12, damp: 0.45, tail: 0.2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  for (const at of [T.tableSnap, T.floorBreak, T.houseBurst]) applyPreImpactVacuum({ sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R }, { at_s: at - 0.3, duration_s: 0.3, duckDb: -24 });
  return { music, sfx };
}
