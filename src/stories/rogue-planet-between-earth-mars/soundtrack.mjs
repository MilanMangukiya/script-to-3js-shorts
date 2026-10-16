import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));

/** Original score and sound design. Event times come from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(9071), B = T.bounds, over = T.over;
  const chord = (a, b, notes, gain, o = {}) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + (o.tail ?? 1.4), attack: o.attack ?? 0.8, release: o.release ?? 1.2,
    detune: o.detune ?? 5, bright: o.bright ?? 1.8, seed: o.seed ?? Math.round(a * 37) }), a, gain);
  const n = Math.ceil(D * SR);

  // ---- score
  // Planet-rise: low D drone with a slow rising glass tone, then a wide awe chord on the reveal.
  chord(0, B[2], ['D1', 'A1', 'D2'], 0.42, { attack: 0.05, bright: 2.4, tail: 0.6, seed: 11 });
  mixMono(music, shape(tone(4.9, (u) => NOTE('A4') * Math.pow(2, (u / 4.9) * 5 / 12)), (u) => envAR(u, 4.9, 1.4, 0.8) * 0.5), 0.2, 0.16, 0.2);
  chord(B[1], B[2] + 0.2, ['D2', 'A2', 'F#3', 'E4', 'A4'], 0.3, { attack: 0.5, bright: 1.6, seed: 23 });
  // Mechanism: tense low cluster with a sub pulse that tightens toward "thirty times".
  chord(B[2], B[3], ['C2', 'G2', 'Ab2', 'Eb3'], 0.32, { attack: 0.4, bright: 2.2, seed: 37 });
  for (let t = B[2] + 0.4, k = 0; t < B[3] - 0.2; k++) {
    mixMono(music, shape(tone(0.5, (u) => 48 - 14 * u), (u) => Math.exp(-u * 7) * (1 - Math.exp(-u * 300))), t, 0.55 + 0.25 * smooth(B[2], B[3], t));
    t += 0.95 - 0.45 * smooth(13.0, 16.5, t);
  }
  // Flood: a rising swell into the held breath, then low brass-like weight after the overtopping.
  chord(B[3], over - 0.32, ['D1', 'D2', 'A2', 'C3', 'F3'], 0.38, { attack: 2.4, release: 0.05, bright: 2.0, tail: 0.0, seed: 41 });
  chord(over, B[4] + 0.2, ['G1', 'D2', 'Bb2', 'F3'], 0.36, { attack: 0.02, bright: 2.4, seed: 43 });
  // The Moon taken: glassy celestial tone bending up, over a hollow fifth.
  chord(B[4], B[5], ['E2', 'B2', 'F#3'], 0.26, { attack: 0.6, bright: 1.7, seed: 51 });
  for (const [i, f0] of [[0, 'B4'], [1, 'F#5'], [2, 'D#6']].entries()) {
    const f = NOTE(f0[1]), dur = 4.2;
    mixMono(music, shape(tone(dur, (u) => f * Math.pow(2, (u / dur) * 2 / 12)), (u) => envAR(u, dur, 0.9, 1.2) * (0.6 + 0.4 * Math.sin(u * 5 + i))), B[4] + 0.15 + i * 0.25, 0.09, [-0.5, 0.5, 0][i]);
  }
  // Nights: a sad thinning chord.
  chord(B[5], B[6], ['B1', 'F#2', 'D3', 'C#4'], 0.3, { attack: 0.7, bright: 1.9, seed: 61 });
  // Winter: cold open fifths, high and sparse.
  chord(B[6], B[7], ['A2', 'E3', 'B3', 'E5'], 0.24, { attack: 0.8, bright: 1.5, seed: 71 });
  // Space: orbital swell that resolves on the final line.
  chord(B[7], T.cuts.s08, ['D1', 'A1'], 0.36, { attack: 0.2, bright: 2.6, seed: 81 });
  chord(T.cuts.s08, B[8], ['D2', 'A2', 'E3', 'F#3', 'C#4'], 0.32, { attack: 1.2, bright: 1.5, seed: 83 });
  chord(B[8], D, ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4'], 0.34, { attack: 0.8, release: 2.0, bright: 1.4, tail: 0.2, seed: 89 });
  automate(music, (t) => 2.4 * smooth(0, 0.06, t) * (1 - smooth(D - 0.7, D, t)));

  // ---- ambience in the bed (ducked by the storyboard silence with the music)
  const sea = filter(noise(n, r, 'pink'), 'lowpass', 650), wind = filter(noise(n, r, 'pink'), 'bandpass', 520, 0.6), rush = filter(noise(n, r, 'pink'), 'lowpass', 1600);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const harbour = t < B[4] ? 1 : t < B[5] ? 0.55 : t < B[6] ? 0.7 : 0;
    sea[i] *= 0.06 * harbour * (0.6 + 0.4 * Math.sin(2 * Math.PI * t / 4.2) ** 2);
    wind[i] *= t >= B[6] && t < B[7] ? 0.07 * (0.55 + 0.45 * Math.sin(t * 1.3) * Math.sin(t * 0.47 + 1)) : 0;
    rush[i] *= 0.085 * smooth(B[3], over - 0.4, t) * (t < over - 0.3 ? 1 : 0) + 0.11 * smooth(over, over + 0.15, t) * (1 - smooth(B[4] + 1.2, B[5], t));
  }
  mixMono(music, sea, 0, 1.4, -0.1); mixMono(music, wind, 0, 1.6, 0.2); mixMono(music, rush, 0, 1.5, 0);

  // ---- foreground sound design
  const click = (at, gain, pan = 0, hi = 3000) => {
    mixMono(sfx, shape(filter(noise(Math.round(0.03 * SR), r, 'white'), 'bandpass', hi, 1.8), (u) => Math.exp(-u * 260)), at, gain, pan);
  };
  const thump = (at, gain, f0 = 70, len = 1.0) => mixMono(sfx, shape(tone(len, (u) => f0 * Math.pow(0.55, u)), (u) => Math.exp(-u * 3.4) * (1 - Math.exp(-u * 300))), at, gain);
  const splash = (at, gain, len = 1.2, lo = 300, hi = 4200) => mixMono(sfx, shape(filter(filter(noise(Math.round(len * SR), r, 'white'), 'highpass', lo), 'lowpass', (u) => hi * Math.exp(-u * 1.4) + 500), (u) => Math.exp(-u * 3.2) * (1 - Math.exp(-u * 120))), at, gain);
  // Time-lapse clock ticks through the drained harbour and the rising tide (tick-tock, accelerating with the time-lapse).
  for (let t = 0.12, k = 0; t < B[1] - 0.1; t += 0.5, k++) click(t, dB(-30 - (k % 2) * 3), 0.3, k % 2 ? 2400 : 3200);
  for (let t = B[3] + 0.1, k = 0; t < over - 0.35; k++) { click(t, dB(-27 - (k % 2) * 3), 0.3, k % 2 ? 2400 : 3200); t += Math.max(0.12, 0.42 - 0.3 * smooth(B[3], over - 0.4, t)); }
  // Gulls at dusk.
  for (const [at, f] of [[0.8, 1350], [2.6, 1500], [6.4, 1250]]) {
    mixMono(sfx, shape(tone(0.55, (u) => f * (1 + 0.25 * Math.sin(u * 22)) * (1 - 0.3 * u)), (u) => envAR(u, 0.55, 0.03, 0.25) * 0.6), at, dB(-34), 0.5);
  }
  // A phone shutter on the quay.
  click(8.45, dB(-26), -0.3, 4200); click(8.52, dB(-30), -0.3, 2600);
  // Low water: hull creak and a halyard tapping a mast.
  mixMono(sfx, shape(filter(noise(Math.round(1.6 * SR), r, 'brown'), 'bandpass', (u) => 180 + 140 * Math.sin(u * 3.2), 6), (u) => envAR(u, 1.6, 0.3, 0.6)), B[2] + 0.4, dB(-22), -0.2);
  for (const at of [10.6, 11.35, 11.9, 12.8, 13.3]) click(at, dB(-24), 0.25, 5200);
  // Silence before the overtopping, then staggered impacts aligned to the picture.
  const cues = Object.fromEntries(['slam', 'hull', 'scrape', 'car', 'lamp1', 'lamp2', 'lamp3'].map((k, i) => [k, [over, T.boats.adrift[0].hit, T.boats.adrift[0].hit2, T.cars[0].lift,
    T.lampsOut.first, T.lampsOut.first + T.lampsOut.step, T.lampsOut.first + 2 * T.lampsOut.step][i]]));
  thump(cues.slam, dB(-18.5), 58, 1.6); splash(cues.slam, dB(-20.5), 1.6);
  thump(cues.hull, dB(-20), 110, 0.5); mixMono(sfx, shape(filter(noise(Math.round(0.25 * SR), r, 'pink'), 'bandpass', 380, 2), (u) => Math.exp(-u * 14)), cues.hull, dB(-21), 0.1);
  mixMono(sfx, shape(filter(noise(Math.round(0.5 * SR), r, 'white'), 'bandpass', (u) => 900 - 400 * u, 3), (u) => envAR(u, 0.5, 0.02, 0.3)), cues.scrape, dB(-23), 0.15);
  thump(cues.car, dB(-21), 140, 0.35); mixMono(sfx, shape(filter(noise(Math.round(0.18 * SR), r, 'white'), 'bandpass', 1900, 4), (u) => Math.exp(-u * 30)), cues.car, dB(-24), -0.3);
  for (const [i, at] of [cues.lamp1, cues.lamp2, cues.lamp3].entries()) {
    const zap = new Float32Array(Math.round(0.14 * SR));
    for (let j = 0; j < zap.length; j++) { const t = j / SR; zap[j] = (Math.sign(Math.sin(2 * Math.PI * 100 * t)) * 0.4 + (r() - 0.5)) * Math.exp(-t * 26); }
    mixMono(sfx, filter(zap, 'bandpass', 2300, 0.9), at, dB(-23 - i), [0.35, -0.3, 0.6][i]);
  }
  // The Moon pulled: a deep gravitational groan.
  mixMono(sfx, shape(tone(4.0, (u) => 31 + 9 * smooth(0, 4, u)), (u) => envAR(u, 4.0, 1.0, 1.2) * (0.8 + 0.2 * Math.sin(u * 7))), B[4] + 0.2, dB(-19));
  // Nights pass: soft whooshes at each change of evening.
  const seg = (B[6] - B[5]) / T.nights.length;
  for (let k = 1; k < T.nights.length; k++) mixMono(sfx, shape(filter(noise(Math.round(0.6 * SR), r, 'pink'), 'bandpass', (u) => 300 + 1600 * u, 1.2), (u) => Math.sin(Math.PI * u / 0.6) ** 2), B[5] + k * seg - 0.3, dB(-26), 0);
  // Winter: ice creaks and footsteps in snow.
  for (const at of [32.0, 33.7, 35.6, 37.2]) mixMono(sfx, shape(tone(0.45, (u) => 95 + 260 * u * u), (u) => envAR(u, 0.45, 0.05, 0.25) * (0.5 + 0.5 * Math.sin(u * 90))), at, dB(-27), -0.2);
  for (let t = B[6] + 0.3, k = 0; t < T.cuts.s07 - 0.2; t += 0.56, k++) mixMono(sfx, shape(filter(noise(Math.round(0.12 * SR), r, 'white'), 'bandpass', 900, 0.8), (u) => envAR(u, 0.12, 0.01, 0.09)), t, dB(-31), k % 2 ? 0.2 : -0.1);
  // Into space: a deep falling whoosh, and a soft sweep as the map opens.
  mixMono(sfx, shape(filter(noise(Math.round(1.5 * SR), r, 'pink'), 'lowpass', (u) => 2400 * Math.exp(-u * 2.2) + 120), (u) => envAR(u, 1.5, 0.08, 1.1)), B[7] - 0.05, dB(-20));
  mixMono(sfx, shape(filter(noise(Math.round(1.2 * SR), r, 'pink'), 'bandpass', (u) => 400 + 1800 * u, 1.0), (u) => Math.sin(Math.PI * u / 1.2) ** 2), T.cuts.s08 - 0.2, dB(-22));
  const wet = reverb(sfx, { decay: 1.1, mix: 0.14, damp: 0.45, tail: 0.2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  // Foley tails drop out with the held breath; the slam lands after it.
  const modern = { sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R };
  applyPreImpactVacuum(modern, { at_s: over - 0.3, duration_s: 0.3, duckDb: -24 });
  return { music, sfx };
}
