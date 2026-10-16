import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));
const SPEED = 50 / 3.6;

/** Light original score and Foley; event times come from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(1717), B = T.bounds, n = Math.ceil(D * SR);
  const onStreet = (t) => t < B[1] || (t >= B[2] && t < B[4]) || (t >= B[5] && t < B[6]) || t >= B[7];

  // ---- instruments
  const pluck = (buf, at, note, g, pan = 0, decay = 11) => mixMono(buf, shape(tone(0.5, NOTE(note)), (u) => Math.exp(-u * decay) * (1 - Math.exp(-u * 400))), at, g, pan);
  // Pizzicato string: a pluck with a little body (second harmonic) and a softer attack.
  const pizz = (buf, at, note, g, pan = 0) => {
    const f = NOTE(note), a = tone(0.6, f), b = tone(0.6, f * 2);
    for (let i = 0; i < a.length; i++) { const u = i / SR; a[i] = (a[i] + 0.3 * b[i]) * Math.exp(-u * 9) * (1 - Math.exp(-u * 260)); }
    mixMono(buf, filter(a, 'lowpass', 2400), at, g, pan);
  };
  // Celesta: bright bell partials with a quick decay.
  const celesta = (buf, at, note, g, pan = 0) => {
    const f = NOTE(note), parts = [[1, 1], [2.0, 0.35], [3.0, 0.12], [4.16, 0.08]], x = new Float32Array(Math.ceil(1.6 * SR));
    for (const [m, a] of parts) { const y = tone(1.6, f * m); for (let i = 0; i < x.length; i++) x[i] += a * y[i] * Math.exp(-(i / SR) * (2.6 + m)); }
    mixMono(buf, shape(x, (u) => 1 - Math.exp(-u * 900)), at, g, pan);
  };
  // Woodblock tick for the countdown.
  const tick = (buf, at, f, g, pan = 0) => {
    const x = tone(0.08, f), y = tone(0.08, f * 1.48), c = filter(noise(x.length, r, 'white'), 'bandpass', 3000, 2);
    for (let i = 0; i < x.length; i++) { const u = i / SR; x[i] = (x[i] + 0.4 * y[i]) * Math.exp(-u * 70) + c[i] * Math.exp(-u * 400) * 0.6; }
    mixMono(buf, x, at, g, pan);
  };
  // Mono buffer into stereo with a pan that moves over time (cars passing).
  const mixMoving = (buf, x, at, g, panAt) => {
    const o = Math.round(at * SR);
    for (let i = 0; i < x.length; i++) { const j = o + i; if (j < 0) continue; if (j >= buf.L.length) break; const a = (panAt(i / SR) + 1) * Math.PI / 4; buf.L[j] += x[i] * g * Math.cos(a) * Math.SQRT2; buf.R[j] += x[i] * g * Math.sin(a) * Math.SQRT2; }
  };

  // ---- voices
  // "Ah" intake: a breathy noise rising in pitch.
  const inhale = (at, g, pan, len = 0.3, f0 = 650, f1 = 1500) => mixMono(sfx, shape(filter(noise(Math.round(len * SR), r, 'pink'), 'bandpass', (u) => f0 + (f1 - f0) * Math.min(1, u / len), 1.3), (u) => envAR(u, len, len * 0.75, len * 0.2)), at, g, pan);
  // "...CHOO": a hiss burst, then a rounded vowel falling in pitch. `stretch` slows the whole sneeze (slow motion).
  const choo = (buf, at, f0, g, pan = 0, stretch = 1) => {
    const len = 0.34 * stretch, x = new Float32Array(Math.ceil((len + 0.05) * SR)), ch = filter(noise(x.length, r, 'white'), 'highpass', 2600 / Math.sqrt(stretch));
    const fn = (u) => f0 * (1.18 - 0.32 * Math.min(1, u / len));
    const h = [1, 2, 3, 4, 5].map((k) => tone(len + 0.05, (u) => k * fn(u)));
    const v = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) v[i] = h[0][i] + 0.6 * h[1][i] + 0.4 * h[2][i] + 0.25 * h[3][i] + 0.15 * h[4][i];
    const vowel = filter(filter(v, 'bandpass', 360, 1.1), 'lowpass', 1100), breath = filter(noise(x.length, r, 'pink'), 'bandpass', 900, 1.0);
    for (let i = 0; i < x.length; i++) {
      const u = i / SR;
      x[i] = ch[i] * Math.exp(-u / (0.05 * stretch)) * (1 - Math.exp(-u * 700 / stretch)) * 0.9
        + (vowel[i] * 1.6 + breath[i] * 0.5) * envAR(Math.max(0, u - 0.025 * stretch), len, 0.03 * stretch, len * 0.55);
    }
    mixMono(buf, x, at, g, pan);
  };
  // A dog's "woof": buzzy harmonics with a quick rise and fall in pitch, a breathy edge and a short body.
  const woof = (at, g, pan = 0) => {
    const len = 0.24, fn = (u) => 290 + 260 * (u < 0.045 ? u / 0.045 : Math.exp(-(u - 0.045) / 0.07));
    const h = [1, 2, 3, 4, 5, 6, 7].map((k) => tone(len, (u) => k * fn(u))), x = new Float32Array(h[0].length), b = filter(noise(x.length, r, 'pink'), 'bandpass', 1300, 0.9);
    for (let i = 0; i < x.length; i++) { const u = i / SR; let s = 0; for (let k = 0; k < 7; k++) s += h[k][i] / Math.pow(k + 1, 0.75); x[i] = (s * 0.5 + b[i] * 0.9) * envAR(u, len, 0.008, 0.13); }
    mixMono(sfx, filter(filter(x, 'bandpass', 950, 0.7), 'lowpass', 3200), at, g, pan);
  };
  const sniff = (at, g, pan) => mixMono(sfx, shape(filter(noise(Math.round(0.18 * SR), r, 'white'), 'bandpass', 3200, 1.0), (u) => envAR(u, 0.18, 0.12, 0.05)), at, g, pan);
  // A car passing `lat` metres from the listener at 50 km/h, loudest at `tp`; pan swings from one side to the other.
  const car = (tp, lat, g, from = -1, to = 1, len = 3.2, notBefore = -1) => {
    const at = tp - len / 2, x = filter(noise(Math.round(len * SR), r, 'pink'), 'lowpass', (u) => 700 + 900 / (1 + Math.pow((u - len / 2) * SPEED / lat, 2)), 0.8);
    const eng = tone(len, (u) => 78 * (1 + 0.06 * Math.tanh((len / 2 - u) * SPEED / lat)));
    for (let i = 0; i < x.length; i++) { const u = i / SR, d = Math.hypot(lat, (u - len / 2) * SPEED); x[i] = (x[i] * 1.6 + eng[i] * 0.25) * (lat / d) * envAR(u, len, 0.3, 0.3) * smooth(notBefore - at - 0.03, notBefore - at + 0.12, u); }
    mixMoving(sfx, x, at, g, (u) => from + (to - from) * (0.5 + 0.5 * Math.tanh((u - len / 2) * SPEED / (lat * 1.5))));
  };

  // ---- music
  // S01: the countdown. Woodblock tick-tock on every half second left, a pizzicato pulse and a rising tone.
  for (let t = 0, k = 0; t < T.sneeze - 0.35; t += 0.5, k++) {
    tick(music, t, k % 2 ? 1500 : 1900, 0.16 + 0.05 * (t / T.sneeze), k % 2 ? 0.25 : -0.25);
    pizz(music, t, k % 2 ? 'A1' : 'D2', 0.32);
  }
  mixMono(music, shape(tone(T.sneeze, (u) => NOTE('D4') * Math.pow(1.5, u / T.sneeze)), (u) => Math.pow(smooth(0, T.sneeze - 0.3, u), 1.5) * 0.12 * (1 - smooth(T.sneeze - 0.32, T.sneeze - 0.3, u))), 0, 1, 0);
  // A reverse swell that peaks right at the cut, so the held breath lands as a real drop.
  { const len = 0.9; mixMono(music, shape(filter(noise(Math.round(len * SR), r, 'pink'), 'bandpass', (u) => 500 + 2500 * (u / len), 0.8), (u) => Math.pow(u / len, 2.5) * (1 - smooth(len - 0.02, len, u))), T.sneeze - 0.3 - len, 0.8); }
  // Straight after the sneeze: a pizzicato "ta-da".
  pizz(music, T.sneeze + 0.55, 'D4', 0.3, -0.2); pizz(music, T.sneeze + 0.7, 'A4', 0.32, 0.2);
  // S02 (globe): a wide, airy D major pad.
  mixStereo(music, pad({ freqs: ['D3', 'A3', 'E4', 'F#4', 'A4'].map(NOTE), dur: B[2] - B[1] + 0.8, attack: 0.4, release: 0.8, detune: 5, bright: 1.6, seed: 4 }), B[1], 0.5);
  // S03: a low pulse while the car rolls blind, then the dog's pizzicato motif.
  for (let t = B[2] + 0.05, k = 0; t < T.s03Cut - 0.1; t += 0.25, k++) pizz(music, t, k % 4 === 3 ? 'A1' : 'D2', k % 2 ? 0.2 : 0.3);
  mixStereo(music, pad({ freqs: ['D2', 'A2', 'D3'].map(NOTE), dur: T.s03Cut - B[2] + 0.3, attack: 0.6, release: 0.3, detune: 4, bright: 0.8, seed: 7 }), B[2], 0.35);
  const dogTheme = (t0, t1, g) => { const m = ['D5', 'F#5', 'A5', 'F#5', 'E5', 'G5', 'B5', 'G5']; for (let t = t0, k = 0; t < t1; t += 0.25, k++) pizz(music, t, m[k % 8], g * (k % 4 === 0 ? 1 : 0.7), k % 2 ? 0.3 : -0.3); };
  dogTheme(T.s03Cut + 0.05, B[3] - 0.1, 0.22);
  // S04: relief, a light groove.
  for (let t = B[3] + 0.05, k = 0; t < B[4] - 0.2; t += 0.3, k++) pizz(music, t, ['D4', 'F#4', 'A4', 'F#4', 'G4', 'B4', 'A4', 'F#4'][k % 8], k % 4 === 0 ? 0.18 : 0.12, k % 2 ? 0.3 : -0.3);
  for (let t = B[3] + 0.05, k = 0; t < B[4] - 0.2; t += 0.6, k++) pizz(music, t, ['D2', 'A1', 'G1', 'A1'][k % 4], 0.3);
  // S05: wonder, a shimmering pad and slow high plucks.
  mixStereo(music, pad({ freqs: ['G3', 'D4', 'A4', 'B4'].map(NOTE), dur: B[5] - B[4] + 0.6, attack: 0.8, release: 0.6, detune: 6, bright: 2.0, seed: 11 }), B[4], 0.45);
  for (let t = B[4] + 0.4, k = 0; t < B[5] - 0.3; t += 0.6, k++) pluck(music, t, ['D5', 'A5', 'B5', 'F#5', 'G5', 'D6'][k % 6], 0.07, k % 2 ? 0.4 : -0.4, 6);
  // S06: slow motion. A deep drone, a reverse swell into the sneeze, and a low swell on "Together".
  mixStereo(music, pad({ freqs: ['D1', 'A1', 'D2'].map(NOTE), dur: B[6] - B[5] + 0.6, attack: 0.8, release: 0.8, detune: 3, bright: 0.6, seed: 13 }), B[5], 0.45);
  { const len = T.s06Sneeze - B[5]; mixMono(music, shape(filter(noise(Math.round(len * SR), r, 'pink'), 'bandpass', (u) => 300 + 2200 * (u / len), 0.8), (u) => Math.pow(u / len, 2.2) * (1 - smooth(len - 0.04, len, u))), B[5], 0.5); }
  mixStereo(music, pad({ freqs: ['D2', 'A2', 'F#3', 'A3'].map(NOTE), dur: B[6] - T.s06Together + 0.5, attack: 0.9, release: 0.6, detune: 5, bright: 1.0, seed: 17 }), T.s06Together, 0.45);
  // S07: celesta twinkles at random over a light pluck, like the random sneezes of a normal day.
  for (let t = B[6] + 0.15, k = 0; t < B[7] - 0.3; t += 0.4, k++) pluck(music, t, ['D4', 'A4', 'F#4', 'A4'][k % 4], 0.07, k % 2 ? 0.25 : -0.25);
  for (let k = 0; k < 18; k++) { const t = B[6] + 0.2 + r() * (B[7] - B[6] - 0.8); celesta(music, t, ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'][Math.floor(r() * 6)], 0.06 + 0.04 * r(), r() * 1.6 - 0.8); }
  // S08: the dog's motif again, a held breath before "Except the dog", and a button after the bark.
  dogTheme(B[7] + 0.1, T.exceptDog - 0.3, 0.16);
  pizz(music, T.bark + 0.75, 'D4', 0.3, -0.2); pizz(music, T.bark + 1.0, 'A3', 0.34, 0.2); celesta(music, T.bark + 1.0, 'D6', 0.1, 0.3);
  automate(music, (t) => smooth(0, 0.03, t) * (1 - smooth(D - 1.2, D - 0.05, t)));

  // ---- ambience in the bed (ducked with the music by the storyboard silence)
  const traffic = filter(noise(n, r, 'pink'), 'lowpass', 900), air = filter(noise(n, r, 'pink'), 'bandpass', 2500, 0.5), wind = filter(noise(n, r, 'pink'), 'bandpass', 500, 0.6);
  for (let i = 0; i < n; i++) {
    const t = i / SR, st = onStreet(t), aerial = t >= B[4] && t < B[5], slow = t >= B[5] && t < B[6];
    traffic[i] *= st ? (slow ? 0.012 : 0.03) : aerial ? 0.022 : 0; air[i] *= st && !slow ? 0.008 : 0; wind[i] *= aerial ? 0.025 : 0;
  }
  mixMono(music, traffic, 0, 1.8, -0.1); mixMono(music, air, 0, 1.4, 0.15); mixMono(music, wind, 0, 1.4, 0.2);

  // ---- Foley
  // S01: the collective intake, a held breath (storyboard silence), then everyone's "CHOO" at once.
  const crowd = [[205, -0.05], [160, -0.55], [290, 0.5], [240, 0.25], [140, -0.7], [320, 0.75], [180, 0.05], [260, -0.3], [150, 0.6], [300, -0.65], [220, 0.4], [170, -0.2]];
  // Both intakes finish before the held breath starts at T.sneeze - 0.3.
  for (const [d, g] of [[-0.98, -24], [-0.66, -20]]) crowd.slice(0, 6).forEach(([, p], k) => inhale(T.sneeze + d + 0.015 * k, dB(g - 2 * (k % 3)), p, 0.22 + 0.02 * (k % 2)));
  choo(sfx, T.sneeze, 200, dB(-9), 0);                                                   // you
  crowd.forEach(([f, p], k) => choo(sfx, T.sneeze + 0.012 + 0.08 * r(), f, dB(-14 - 4 * r()), p));
  mixMono(sfx, shape(filter(noise(Math.round(1.4 * SR), r, 'pink'), 'bandpass', 1700, 0.6), (u) => envAR(u, 1.4, 0.01, 1.2)), T.sneeze + 0.02, dB(-24), 0);
  // The red car rolls past while your eyes are shut, then the far-lane car.
  car(T.sneeze + 5.4 / SPEED, 3.65, dB(-15), -0.2, 0.9, 3.2, T.sneeze);
  car(T.sneeze + 0.82 - 3.4 / SPEED, 10.4, dB(-25), 0.9, 0.6);
  sniff(T.sneeze + 0.9, dB(-27), -0.3); sniff(T.sneeze + 1.15, dB(-27), -0.3); sniff(T.sneeze + 1.3, dB(-29), 0.4);
  // S02: the whole planet at once, as a soft whoosh.
  mixMono(sfx, shape(filter(noise(Math.round(2.2 * SR), r, 'pink'), 'bandpass', (u) => 2400 - 1800 * Math.min(1, u / 2.2), 0.7), (u) => envAR(u, 2.2, 0.03, 1.8)), B[1] + 0.05, dB(-24), 0);
  // S03: the replayed sneezes from the curb (quiet, under the line) and the blind car rushing past the lens.
  [[200, -0.6], [260, -0.75], [170, -0.5]].forEach(([f, p], k) => choo(sfx, T.s03Sneeze + 0.03 * k, f, dB(-37), p));
  car(T.s03Sneeze + 11.5 / SPEED, 2.6, dB(-26), -0.1, 1);
  // The next car passes behind the camera while the dog follows it.
  car(T.s03Sneeze + T.whiteCar + 0.144 + 2.45 / SPEED, 2.6, dB(-23), -0.9, 0.9);
  // S04: traffic carries on (a far-lane car close by, a near-lane car across the road); a couple of sniffs.
  car(B[3] + 2.82 - 4.2 / SPEED, 3.2, dB(-22), -0.8, 0.9);
  car(B[3] + 1.744 + 4.2 / SPEED, 10, dB(-27), 0.7, -0.6);
  sniff(B[3] + 0.5, dB(-30), 0.5); sniff(B[3] + 0.7, dB(-30), 0.5);
  // S05: the sound arrives nearest first. A few clear sneezes from your street, then a wash from farther out that
  // gets quieter and duller (spreading and air absorption) and sinks under the traffic within about 1.5 s.
  [[0.04, 210, -0.3, -22], [0.12, 280, 0.5, -24], [0.21, 170, -0.6, -26]].forEach(([d, f, p, g]) => choo(sfx, T.s05Rings + d, f, dB(g), p));
  {
    const len = 2.2, w = { L: new Float32Array(Math.ceil(len * SR)), R: new Float32Array(Math.ceil(len * SR)), sr: SR };
    for (let k = 0; k < 70; k++) { const d = 0.15 + Math.sqrt(r()) * 1.7; choo(w, d, 150 + 170 * r(), 0.5 / (1 + d / 0.12), r() * 1.8 - 0.9); }
    const dull = (x) => filter(x, 'lowpass', (u) => 600 + 3400 * Math.exp(-u / 0.5), 0.7);
    mixStereo(sfx, { L: dull(w.L), R: dull(w.R), sr: SR }, T.s05Rings, dB(-20));
  }
  // S06: the slowed sneeze, a long low intake, the stretched "CHOO", and a fine mist hiss.
  inhale(B[5] + 0.05, dB(-27), -0.2, T.s06Sneeze - B[5] - 0.1, 220, 520);
  choo(sfx, T.s06Sneeze, 95, dB(-28), -0.2, 5);
  mixMono(sfx, shape(filter(noise(Math.round(5 * SR), r, 'white'), 'highpass', 5200), (u) => envAR(u, 5, 0.5, 3.6) * (0.85 + 0.15 * Math.sin(u * 3))), T.s06Sneeze + 0.1, dB(-35), 0.3);
  // S08: the owner sniffs; one bark right after "Except the dog."
  sniff(B[7] + 0.9, dB(-28), 0.35); sniff(B[7] + 1.1, dB(-28), 0.35);
  woof(T.bark, dB(-9), -0.1);

  const wet = reverb(sfx, { decay: 0.7, mix: 0.12, damp: 0.45, tail: 0.2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  applyPreImpactVacuum({ sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R }, { at_s: T.sneeze - 0.3, duration_s: 0.3, duckDb: -24 });
  return { music, sfx };
}
