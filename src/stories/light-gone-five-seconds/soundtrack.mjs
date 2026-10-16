import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));

/** Original score and Foley; every event time comes from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(5150), B = T.bounds, n = Math.ceil(D * SR);
  const dark0 = T.dark0, dark1 = T.dark0 + T.darkS, sun = T.sunBack, star1 = T.yearKeys[1][0], star2 = T.yearKeys[2][0];

  // ---- instruments
  const pluck = (buf, at, note, g, pan = 0, decay = 6) => {
    const f = NOTE(note), a = tone(0.8, f), b = tone(0.8, f * 2), c = tone(0.8, f * 3.01);
    for (let i = 0; i < a.length; i++) { const u = i / SR; a[i] = (a[i] + 0.35 * b[i] * Math.exp(-u * 12) + 0.12 * c[i] * Math.exp(-u * 30)) * Math.exp(-u * decay) * (1 - Math.exp(-u * 600)); }
    mixMono(buf, filter(a, 'lowpass', 5200), at, g, pan);
  };
  const bell = (buf, at, note, g, pan = 0, len = 2.6) => {
    const f = NOTE(note), x = new Float32Array(Math.ceil(len * SR));
    for (const [m, a, dk] of [[1, 1, 1.6], [2.0, 0.42, 2.4], [2.76, 0.3, 3.2], [5.4, 0.12, 6], [8.93, 0.05, 9]]) { const y = tone(len, f * m); for (let i = 0; i < x.length; i++) x[i] += a * y[i] * Math.exp(-(i / SR) * dk); }
    mixMono(buf, shape(x, (u) => 1 - Math.exp(-u * 700)), at, g, pan);
  };
  const chord = (buf, at, notes, dur, g, o = {}) => mixStereo(buf, pad({ freqs: notes.map(NOTE), dur, attack: o.attack ?? 0.6, release: o.release ?? 0.8, detune: o.detune ?? 5, bright: o.bright ?? 1.5, seed: o.seed ?? 3 }), at, g);
  const heartbeat = (at, g) => { for (const [d, k] of [[0, 1], [0.17, 0.6]]) { const x = tone(0.22, (u) => 58 - 22 * u); mixMono(music, shape(x, (u) => envAR(u, 0.22, 0.008, 0.18)), at + d, g * k, 0); } };

  // ---- music
  // S01: a bright, busy little city figure that stops dead when the light goes.
  chord(music, 0, ['C3', 'G3', 'E4', 'B4'], dark0 + 0.05, 0.3, { attack: 0.08, release: 0.03, bright: 1.3, seed: 2 });
  [['E5', 0.05], ['G5', 0.3], ['B5', 0.55], ['E6', 0.8], ['D6', 1.05]].filter(([, t]) => t < dark0 - 0.05).forEach(([nn, t], k) => pluck(music, t, nn, 0.16, k % 2 ? 0.3 : -0.3));
  // In the dark: a heartbeat and a held sub drone; a faint high whine (the eye's own noise has a sound of silence).
  mixStereo(music, pad({ freqs: [NOTE('A1'), NOTE('E2')], dur: T.darkS + 0.1, attack: 0.25, release: 0.2, detune: 3, bright: 2.6, seed: 5 }), dark0, 0.55);
  mixMono(music, shape(tone(T.darkS, (u) => 6100 + 40 * Math.sin(u * 3.1)), (u) => envAR(u, T.darkS, 0.6, 0.3) * (0.7 + 0.3 * Math.sin(u * 5.3))), dark0, dB(-34), 0.1);
  for (let k = 0; k < 6; k++) heartbeat(dark0 + 0.55 + k * 0.82, 0.5);
  // S02-S04: uneasy, waiting; a pulse that quickens as the sunlight races (S03), then a hush (S04).
  chord(music, dark1, ['D2', 'A2', 'F3', 'C4'], sun - dark1 - 0.25, 0.32, { attack: 1.2, release: 0.15, bright: 1.7, seed: 7 });
  for (let t = dark1 + 0.6, k = 0; t < sun - 0.4; k++) {
    const inS03 = t >= B[2] && t < B[3], dt = t < B[2] ? 0.5 : inS03 ? 0.5 - 0.3 * (t - B[2]) / (B[3] - B[2]) : 0.42 - 0.18 * (t - B[3]) / (sun - B[3]);
    pluck(music, t, k % 4 === 3 ? 'A2' : 'D3', 0.16 + (inS03 ? 0.06 : 0), 0, 9); t += dt;
  }
  // S03: a rising tone as the light front crosses the orbits.
  mixMono(music, shape(tone(B[3] - B[2], (u) => 220 * Math.pow(3, u / (B[3] - B[2]))), (u) => envAR(u, B[3] - B[2], 1.2, 0.4)), B[2], 0.09, -0.2);
  mixMono(music, shape(tone(B[3] - B[2], (u) => 330 * Math.pow(3, u / (B[3] - B[2]))), (u) => envAR(u, B[3] - B[2], 1.6, 0.4)), B[2], 0.05, 0.2);
  // Daylight: a held breath, then a bright release chord with a shimmer.
  chord(music, sun, ['D3', 'A3', 'F#4', 'A4', 'D5'], B[5] - sun + 0.4, 0.42, { attack: 0.35, release: 1.2, bright: 1.25, seed: 9 });
  [['A5', 0.05], ['D6', 0.18], ['F#6', 0.31], ['A6', 0.44], ['D7', 0.57]].forEach(([nn, d], k) => bell(music, sun + d, nn, 0.07, k % 2 ? 0.35 : -0.35, 2.0));
  // S06: a wide, quiet night.
  chord(music, B[5] - 0.2, ['A2', 'E3', 'B3', 'C4'], B[6] - B[5] + 0.6, 0.26, { attack: 1.0, release: 0.8, bright: 1.9, seed: 11 });
  // S07: a slow, wide chord; a soft low bell when the dark star is marked.
  chord(music, B[6] - 0.2, ['F2', 'C3', 'A3', 'E4'], B[7] - B[6] + 0.5, 0.32, { attack: 1.4, release: 0.7, bright: 1.6, seed: 13 });
  bell(music, T.ghostAt, 'E4', 0.08, 0.3, 2.4);
  // S08: years racing by (a fast, soft tick), a bright chime for Alpha Centauri, a lower one for Sirius, then resolve.
  chord(music, B[7] - 0.1, ['E2', 'B2', 'G#3', 'D#4'], D - B[7] + 0.1, 0.26, { attack: 0.8, release: 1.4, bright: 1.7, seed: 17 });
  for (let t = B[7] + 0.05; t < D - 1.2; t += 0.125) pluck(music, t, 'B5', 0.022, (r() - 0.5) * 0.6, 40);
  bell(music, star1, 'E6', 0.16, -0.2, 3.0); bell(music, star1 + 0.02, 'B6', 0.06, 0.2, 2.2);
  bell(music, star2, 'B5', 0.17, 0.15, 3.2); bell(music, star2 + 0.03, 'F#6', 0.06, -0.15, 2.4);
  chord(music, star2 - 0.1, ['E3', 'B3', 'E4', 'F#4', 'G#4'], D - star2 + 0.1, 0.3, { attack: 0.7, release: 1.2, bright: 1.4, seed: 19 });
  automate(music, (t) => smooth(0, 0.03, t) * (1 - smooth(D - 1.0, D - 0.05, t)));

  // ---- ambience (bed): a noon street, the waiting street, a summer night
  const traffic = filter(noise(n, r, 'brown'), 'lowpass', 260), crowd = filter(noise(n, r, 'pink'), 'bandpass', 900, 0.6), crickets = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, night = t >= B[5], lapse = t >= B[7];
    const drive = t < dark0 + 0.5 ? 1 : t < sun + 1.6 ? 0.35 : night ? 0.3 : 1;              // engines idle while everyone waits
    traffic[i] *= (lapse ? 0.12 : 1) * 0.05 * drive;
    const worry = t >= dark0 && t < sun ? 1.6 + 0.4 * Math.sin(t * 1.7) : 1;                 // the street talking in the dark
    crowd[i] *= (night ? 0.25 : 1) * 0.022 * worry * (0.75 + 0.25 * Math.sin(t * 0.9 + 1.3));
    if (night && !lapse) { const chirp = Math.max(0, Math.sin(2 * Math.PI * 3.1 * t)) ** 6; crickets[i] = Math.sin(2 * Math.PI * 4300 * t) * chirp * 0.006; }
  }
  mixMono(sfx, traffic, 0, 1.6); mixMono(sfx, crowd, 0, 1.4, 0.15); mixMono(sfx, crickets, 0, 1, 0.45); mixMono(sfx, crickets, 0.07, 0.7, -0.5);

  // ---- Foley
  const whoosh = (at, len, g, pan = 0, f0 = 400, f1 = 3000) => mixMono(sfx, shape(filter(noise(Math.round(len * SR), r, 'pink'), 'bandpass', (u) => f0 + (f1 - f0) * Math.min(1, u / len), 0.9), (u) => envAR(u, len, len * 0.55, len * 0.4)), at, g, pan);
  const screech = (at, len, g, pan) => {
    const x = tone(len, (u) => 2300 + 140 * Math.sin(u * 37) - 300 * u / len), nz = filter(noise(x.length, r, 'white'), 'bandpass', 2600, 2.5);
    for (let i = 0; i < x.length; i++) { const u = i / SR; x[i] = (x[i] * 0.5 + nz[i] * 0.9) * envAR(u, len, 0.06, len * 0.5); }
    mixMono(sfx, x, at, g, pan);
  };
  const horn = (at, len, g, pan) => { const a = tone(len, 410), b = tone(len, 512); for (let i = 0; i < a.length; i++) a[i] = Math.sign(a[i] + b[i]) * 0.5 * envAR(i / SR, len, 0.02, 0.05); mixMono(sfx, filter(a, 'lowpass', 1800), at, g, pan); };
  const gasp = (at, g, pan) => { const len = 0.32, x = filter(noise(Math.round(len * SR), r, 'pink'), 'bandpass', (u) => 1500 + 900 * u, 1.4); mixMono(sfx, shape(x, (u) => envAR(u, len, 0.03, 0.24)), at, g, pan); };
  const click = (at, g, pan) => mixMono(sfx, shape(filter(noise(Math.round(0.03 * SR), r, 'white'), 'highpass', 2500), (u) => Math.exp(-u * 260)), at, g, pan);
  const engine = (at, len, g, pan) => { const x = tone(len, (u) => 42 + 60 * smooth(0, len * 0.6, u)), y = filter(noise(x.length, r, 'brown'), 'lowpass', 400); for (let i = 0; i < x.length; i++) { const u = i / SR; x[i] = (Math.tanh(3 * x[i]) * 0.6 + y[i] * 1.5) * envAR(u, len, 0.3, len * 0.5); } mixMono(sfx, x, at, g, pan); };
  // S01: a car passes; then every light goes: a deep drop and the street gasps; brakes, a horn.
  whoosh(0.0, 1.1, dB(-30), 0.5, 300, 1200);
  { const len = 1.6, x = tone(len, (u) => 62 - 34 * u), y = filter(noise(x.length, r, 'brown'), 'lowpass', 140); for (let i = 0; i < x.length; i++) { const u = i / SR; x[i] = (x[i] + y[i] * 0.8) * Math.exp(-u * 2.4) * (1 - Math.exp(-u * 400)); } mixMono(sfx, x, dark0, dB(-10), 0); }
  [[0.12, -0.4], [0.2, 0.35], [0.29, -0.1], [0.38, 0.5], [0.5, -0.55], [0.63, 0.15]].forEach(([d, p], k) => gasp(dark0 + d, dB(-27 - k), p));
  screech(dark0 + 0.45, 1.3, dB(-29), -0.35); screech(dark0 + 0.8, 1.0, dB(-32), 0.4); horn(dark0 + 2.1, 0.45, dB(-31), 0.3); horn(dark0 + 2.7, 0.25, dB(-34), 0.3);
  // Light returns: a relay clunk and mains hum across the city, a phone chime in your hand; torches click on.
  click(dark1, dB(-20), 0); { const len = 1.8, h = tone(len, 100), h2 = tone(len, 200); for (let i = 0; i < h.length; i++) { const u = i / SR; h[i] = (h[i] + 0.4 * h2[i]) * envAR(u, len, 0.05, 1.2); } mixMono(sfx, h, dark1, dB(-30), 0); }
  bell(sfx, dark1 + 0.12, 'E6', dB(-24), 0.3, 0.6); bell(sfx, dark1 + 0.26, 'B6', dB(-26), 0.3, 0.7);
  [[1.65, -0.3], [1.78, 0.4], [1.92, -0.1]].forEach(([d, p]) => click(dark1 + d, dB(-26), p));
  // Daylight: air and noise flood back; engines pull away.
  whoosh(sun, 1.8, dB(-19), 0, 250, 5200);
  [[1.5, -0.3], [1.75, 0.35], [2.1, 0.1]].forEach(([d, p]) => engine(sun + d, 2.2, dB(-24), p));
  // S07-S08: a soft swish at the cut to Sirius.
  whoosh(T.s08Cut - 0.25, 0.6, dB(-30), 0.2, 500, 2200);

  const wet = reverb(sfx, { decay: 1.0, mix: 0.14, damp: 0.45, tail: 0.2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  // The held breath before the sunlight arrives (the bed gets the same cue from the storyboard).
  applyPreImpactVacuum({ sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R }, { at_s: sun - 0.3, duration_s: 0.3, duckDb: -24 });
  return { music, sfx };
}
