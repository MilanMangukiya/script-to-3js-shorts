import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb, crackle } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));

/** Original score and Foley; event times come from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(1350), B = T.bounds, n = Math.ceil(D * SR);
  const chord = (a, b, notes, gain, o = {}) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + (o.tail ?? 1.2), attack: o.attack ?? 0.8, release: o.release ?? 1.0, detune: o.detune ?? 5, bright: o.bright ?? 1.4, seed: o.seed ?? Math.round(a * 31) }), a, gain);
  const at = (s) => s >= B[0] && s < B[1] ? 'S01' : s < B[2] ? 'S02' : s < B[3] ? 'S03' : s < B[4] ? 'S04' : s < B[5] ? 'S05' : s < B[6] ? 'S06' : s < B[7] ? 'S07' : s < B[8] ? 'S08' : 'S09';

  // ---- score
  chord(0, B[2], ['D1', 'A1', 'D2'], 0.22, { attack: 0.05, bright: 1.1, seed: 3 });                 // dread under the eruption
  chord(B[1], B[3], ['D2', 'F2', 'A2', 'E3'], 0.22, { attack: 1.0, bright: 1.6, seed: 9 });
  chord(B[3], B[5] - 2.3, ['C2', 'G2', 'Eb3'], 0.22, { attack: 0.6, release: 0.6, tail: 0.6, bright: 1.3, seed: 15 });
  chord(T.s05Tilt, B[6], ['E5', 'B5', 'F#6'], 0.07, { attack: 1.4, bright: 2.8, seed: 21 });           // the cold, dim sun
  chord(B[5], B[6], ['F2', 'C3', 'A3', 'E4', 'B4'], 0.2, { attack: 1.5, bright: 1.5, seed: 27 });
  chord(B[6], B[7], ['D2', 'A2', 'F3', 'C4'], 0.2, { attack: 0.9, bright: 1.3, seed: 33 });
  chord(B[7], B[8], ['Bb1', 'F2', 'Db3', 'Ab3'], 0.22, { attack: 0.9, bright: 1.2, seed: 39 });
  chord(B[8] - 0.2, D, ['F2', 'C3', 'A3', 'E4', 'G4'], 0.26, { attack: 1.0, bright: 1.35, seed: 45 });
  // Sparse piano-like notes over the snow and the ending.
  for (const [i, s] of [B[6] + 0.6, B[6] + 2.4, B[6] + 4.3, B[6] + 6.0, B[8] + 0.8, B[8] + 3.0, B[8] + 4.8].entries())
    mixMono(music, shape(tone(1.8, NOTE(['A3', 'F3', 'D4', 'C4', 'A3', 'C4', 'F3'][i])), (u) => Math.exp(-u * 2.4) * (1 - Math.exp(-u * 300))), s, 0.09, i % 2 ? 0.25 : -0.25);
  automate(music, (t) => smooth(0, 0.04, t) * (1 - smooth(D - 0.6, D, t)));

  // ---- ambience in the bed, so the storyboard silence ducks it with the music
  const city = filter(noise(n, r, 'pink'), 'lowpass', 1500), rumble = filter(filter(noise(n, r, 'brown'), 'lowpass', 120), 'highpass', 18);
  const wind = filter(filter(noise(n, r, 'pink'), 'bandpass', 500, 0.6), 'lowpass', 1800);
  for (let i = 0; i < n; i++) {
    const t = i / SR, s = at(t);
    city[i] *= s === 'S01' ? 0.04 : s === 'S04' ? 0.015 : s === 'S05' ? 0.02 : s === 'S09' ? 0.03 : 0;
    rumble[i] *= (s === 'S01' ? 0.14 : s === 'S02' ? 0.2 : s === 'S03' ? 0.14 : s === 'S04' ? 0.1 : 0) * (0.8 + 0.2 * Math.sin(t * 1.7 + Math.sin(t * 0.6) * 2));
    wind[i] *= s === 'S03' ? 0.03 : s === 'S07' ? 0.05 : s === 'S08' ? 0.035 : s === 'S06' ? 0.012 : 0;
  }
  mixMono(music, city, 0, 1.4, -0.1); mixMono(music, rumble, 0, 2.6); mixMono(music, wind, 0, 1.6, 0.15);
  const chirp = (s, f, g, pan) => { const c = tone(0.12, (u) => f + 1500 * Math.sin(u * 55)); for (const d of [0, 0.15]) mixMono(music, shape(c, (u) => envAR(u, 0.12, 0.01, 0.07)), s + d, g, pan); };
  chirp(0.3, 3900, dB(-32), 0.5); chirp(B[8] + 1.9, 3500, dB(-40), -0.6); chirp(B[8] + 4.1, 4100, dB(-42), 0.6);

  // ---- Foley
  // S01: the blast wave arrives after the silence: a deep boom, rattling windows, a car alarm.
  mixMono(sfx, shape(tone(1.6, (u) => 26 + 48 * Math.exp(-u * 2.5)), (u) => Math.exp(-u * 4.5) * (1 - Math.exp(-u * 160))), T.blast, dB(-13));
  mixMono(sfx, shape(filter(noise(Math.round(1.4 * SR), r, 'brown'), 'lowpass', 380), (u) => envAR(u, 1.4, 0.015, 1.1)), T.blast, dB(-25));
  for (let k = 0; k < 14; k++) mixMono(sfx, shape(filter(noise(Math.round(0.05 * SR), r, 'white'), 'bandpass', 2600 + 900 * Math.sin(k * 7), 4), (u) => Math.exp(-u * 70)), T.blast + 0.05 + k * 0.055 + 0.02 * Math.sin(k * 3), dB(-24 - k * 0.8), Math.sin(k * 1.9) * 0.6);
  { const len = B[1] - T.blast - 0.6, a = tone(len, (u) => (Math.floor(u * 2.2) % 2 ? 1150 : 860)); mixMono(sfx, filter(shape(a, (u) => envAR(u, len, 0.05, 0.3)), 'lowpass', 2400), T.blast + 0.6, dB(-36), 0.6); }
  for (const f of T.flashes) mixMono(sfx, shape(filter(noise(Math.round(0.25 * SR), r, 'white'), 'highpass', 2500), (u) => Math.exp(-u * 18)), f, dB(-40), -0.2);
  // S02: a planet-wide low swell.
  mixMono(sfx, shape(filter(noise(Math.round((B[2] - B[1]) * SR), r, 'brown'), 'lowpass', 90), (u) => envAR(u, B[2] - B[1], 1.0, 1.0)), B[1], dB(-16));
  // S03: lava crust crackle and glassy clinks, then the ash flow roar and the car passing.
  mixMono(sfx, filter(shape(crackle(T.s03Cut - B[2], 9, r, { lo: 1800, hi: 6500 }), (u) => envAR(u, T.s03Cut - B[2], 0.2, 0.2)), 'highpass', 1200), B[2], dB(-20), 0.3);
  for (let k = 0; k < 6; k++) mixMono(sfx, shape(tone(0.3, 3300 + 700 * Math.sin(k * 5)), (u) => Math.exp(-u * 30)), B[2] + 0.4 + k * 0.33, dB(-32), 0.3);
  for (let s = B[2] + 0.3, k = 0; s < T.s03Cut; s += 0.5, k++) mixMono(sfx, shape(filter(noise(Math.round(0.07 * SR), r, 'pink'), 'bandpass', 900, 1.2), (u) => envAR(u, 0.07, 0.004, 0.05)), s, dB(-28), k % 2 ? 0.1 : -0.1);
  const flowLen = B[3] - T.s03Cut;
  mixMono(sfx, shape(filter(noise(Math.round(flowLen * SR), r, 'brown'), 'lowpass', 420), (u) => smooth(0, 0.6, u) * (0.75 + 0.25 * Math.sin(u * 5.3))), T.s03Cut, dB(-28), -0.35);
  mixMono(sfx, shape(filter(noise(Math.round(flowLen * SR), r, 'pink'), 'bandpass', 1200, 0.8), (u) => smooth(0, 0.8, u) * 0.6), T.s03Cut, dB(-30), -0.35);
  { const len = 2.6, s0 = T.carCross - 1.3; const eng = tone(len, (u) => 95 * (1 + 0.12 * Math.tanh((1.3 - u) * 3)));
    mixMono(sfx, filter(shape(eng, (u) => Math.exp(-((u - 1.3) ** 2) * 2.2)), 'lowpass', 900), s0, dB(-27), 0);
    mixMono(sfx, shape(filter(noise(Math.round(len * SR), r, 'pink'), 'bandpass', 700, 0.7), (u) => Math.exp(-((u - 1.3) ** 2) * 2.5)), s0, dB(-25), 0); }
  // S04: ash pattering on the umbrella, distant thunder in the ash cloud, a passing car.
  { const len = B[4] - B[3], p = crackle(len, 160, r, { lo: 2500, hi: 7000 }); mixMono(sfx, filter(shape(p, (u) => envAR(u, len, 0.3, 0.4)), 'highpass', 2000), B[3], dB(-26), 0.05); }
  for (const s of [B[3] + 1.2, B[3] + 3.4]) mixMono(sfx, shape(filter(noise(Math.round(2.5 * SR), r, 'brown'), 'lowpass', 160), (u) => envAR(u, 2.5, 0.25, 2.0) * (0.7 + 0.3 * Math.sin(u * 9))), s, dB(-25), -0.3);
  // S05: broom strokes in time with the sweep (period 1.4 s, a stroke each way).
  for (let s = B[4] + 0.15; s < B[5] - 0.5; s += 0.7) mixMono(sfx, shape(filter(noise(Math.round(0.4 * SR), r, 'white'), 'bandpass', 3000, 0.9), (u) => envAR(u, 0.4, 0.06, 0.25)), s, dB(-24), -0.25);
  // S07: muffled snow hush. S08: frost crunching under the farmer's boots until he stops.
  mixMono(sfx, shape(filter(noise(Math.round((B[7] - B[6]) * SR), r, 'pink'), 'highpass', 5000), (u) => envAR(u, B[7] - B[6], 1.0, 1.0)), B[6], dB(-36), 0);
  for (let s = B[7] + 0.2, k = 0; s < B[7] + 4.0; s += 0.56, k++) {
    mixMono(sfx, shape(filter(noise(Math.round(0.16 * SR), r, 'white'), 'bandpass', 2400, 1.1), (u) => envAR(u, 0.16, 0.005, 0.12)), s, dB(-28), k % 2 ? 0.15 : -0.15);
    mixMono(sfx, shape(crackle(0.12, 120, r, { lo: 3000, hi: 8000 }), (u) => envAR(u, 0.12, 0.002, 0.1)), s, dB(-30), k % 2 ? 0.15 : -0.15);
  }
  // S09: your footsteps on the clean street.
  for (let s = B[8] + 0.3, k = 0; s < D - 0.6; s += 0.55, k++) mixMono(sfx, shape(filter(noise(Math.round(0.08 * SR), r, 'pink'), 'lowpass', 1400), (u) => envAR(u, 0.08, 0.004, 0.06)), s, dB(-34), k % 2 ? 0.1 : -0.1);

  const wet = reverb(sfx, { decay: 1.2, mix: 0.14, damp: 0.45, tail: 0.2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  // Foley also drops out in the pre-blast silence; the blast lands after it.
  applyPreImpactVacuum({ sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R }, { at_s: T.blast - 0.3, duration_s: 0.3, duckDb: -24 });
  return { music, sfx };
}
