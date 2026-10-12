// Original synthesized music bed and sound effects for "ice-sank-instead-of-floating".
// Effect levels are in dB relative to the narration's peak reference (see tools/soundtrack.mjs).
import { SR, dB, NOTE, rng, stereo, mixMono, mixStereo, automate, smooth, envAR, noise, filter, pad, reverb, shape, tone, crackle } from '../../library/audio/synth.mjs';

// Cue times mirror src/stories/ice-sank-instead-of-floating/timeline.ts.
const T = { sink: 1.97, freezeStart: 7.7, freezeEnd: 12.3, descend: 17.8, underIce: 18.9, crystalsStart: 24.2, timelapseStart: 33.0, timelapseEnd: 40.5, seaIceOut: 51.6, colonyCut: 57.3, frostStart: 59.6, burstStart: 62.4, rise: 70.2, riseEnd: 71.8 };
const N = (...names) => names.map(NOTE);

export function buildSoundtrack(duration) {
  const rand = rng(20261012);
  const music = stereo(duration), sfx = stereo(duration);
  const sec = (s) => Math.ceil(s * SR);

  // ---------------------------------------------------------------- music: slow A-minor pad with glassy bells
  const chords = [
    [0.0, 5.6, N('A2', 'E3', 'A3', 'C4', 'B4')],
    [4.0, 6.6, N('F2', 'C3', 'A3', 'E4')],
    [9.4, 6.2, N('C3', 'G3', 'E4', 'D4')],
    [14.4, 5.2, N('A2', 'E3', 'C4', 'E4')],
    [18.4, 5.8, N('F2', 'C3', 'F3', 'A3')],
    [23.0, 5.4, N('D2', 'A2', 'F3', 'A3')],
    [27.4, 5.8, N('E2', 'B2', 'G3', 'B3')],
    [32.0, 5.4, N('A2', 'E3', 'A3', 'C4')],
    [36.4, 5.4, N('F2', 'C3', 'A3', 'C4')],
    [40.7, 5.4, N('D3', 'A3', 'C4', 'F4')],
    [45.0, 5.8, N('G2', 'D3', 'B3', 'D4')],
    [49.7, 5.8, N('A2', 'E3', 'A3', 'C4', 'B4')],
    [54.6, 5.4, N('E2', 'B2', 'G3', 'E4')],
    [58.9, 7.6, N('F3', 'C4', 'G4', 'A4')],
    [65.4, 5.6, N('A2', 'E3', 'C4', 'E4')],
    [70.2, 4.6, N('C3', 'G3', 'E4', 'D5')], // gentle major resolution as the cubes float again
  ];
  const padBus = stereo(duration + 4);
  chords.forEach(([at, dur, freqs], i) => mixStereo(padBus, pad({ freqs, dur, attack: 1.9, release: 2.2, bright: 2.1, detune: 6, seed: 31 + i }), at, 1));
  // Under water the pad sinks back; it also thins for a breath when the rule flips.
  automate(padBus, (t) => (1 - 0.45 * smooth(18.2, 19.4, t) * (1 - smooth(40.6, 41.6, t))) * (1 - 0.6 * smooth(T.sink, T.sink + 0.4, t) * (1 - smooth(3.6, 4.6, t))) * (1 - 0.75 * smooth(duration - 1.3, duration - 0.05, t)));
  const wetPad = reverb({ L: padBus.L.subarray(0, sec(duration)), R: padBus.R.subarray(0, sec(duration)), sr: SR }, { decay: 3.4, mix: 0.42, tail: 0.5 });
  mixStereo(music, wetPad, 0, 1.0);
  // Glassy bell: slightly inharmonic partials with a long reverb tail.
  const bells = stereo(duration + 4);
  const bell = (at, name, gain = 1, pan = 0) => {
    const f = NOTE(name), len = 2.6, y = new Float32Array(sec(len));
    for (const [m, a, d] of [[1, 1, 1.6], [2.76, 0.42, 2.8], [5.4, 0.22, 4.5], [8.9, 0.1, 7]]) { const s = tone(len, f * m); for (let i = 0; i < y.length; i++) y[i] += s[i] * a * Math.exp(-(i / SR) * d); }
    mixMono(bells, shape(y, (t) => smooth(0, 0.004, t)), at, 0.16 * gain, pan);
  };
  for (const [at, n, g, p] of [[0.2, 'E5', 0.8, -0.3], [4.1, 'A5', 0.7, 0.3], [12.3, 'E6', 1, 0.2], [14.8, 'C6', 0.6, -0.2], [23.4, 'D5', 0.6, 0.3], [32.4, 'A4', 0.5, -0.3], [41.1, 'F5', 0.6, 0.2], [50.0, 'E5', 0.7, -0.2], [59.3, 'G5', 0.8, 0.3], [65.9, 'E5', 0.6, -0.2], [71.8, 'G5', 1, 0.1], [72.3, 'E6', 0.7, 0.3]]) bell(at, n, g, p);
  mixStereo(music, reverb({ L: bells.L.subarray(0, sec(duration)), R: bells.R.subarray(0, sec(duration)), sr: SR }, { decay: 3.8, mix: 0.55, tail: 0.5 }), 0, 1.0);

  // ---------------------------------------------------------------- sound effects
  const fx = stereo(duration + 4);
  const put = (mono, at, gainDb, pan = 0) => mixMono(fx, mono, at, dB(gainDb), pan);
  const n = (dur, color) => noise(sec(dur), rand, color);
  put(filter(n(duration, 'pink'), 'lowpass', 900), 0, -46); // room tone

  // Small glass "tink" (ice against glass).
  const tink = (at, gainDb, pan = 0) => { const f = 2600 + rand() * 2400, len = 0.35, y = new Float32Array(sec(len)); for (const [m, a] of [[1, 1], [1.52, 0.5], [2.31, 0.3]]) { const s = tone(len, f * m); for (let i = 0; i < y.length; i++) y[i] += s[i] * a * Math.exp(-(i / SR) * (22 + m * 8)); } put(y, at, gainDb, pan); };
  // S01: cubes let go with a soft blub, then tick against the glass as they land.
  put(shape(tone(0.22, (t) => 190 - 380 * t), (t) => Math.sin(Math.PI * Math.min(1, t / 0.22))), T.sink + 0.02, -18);
  for (const [dt, g, p] of [[0.78, -20, -0.2], [0.93, -22, 0.25], [1.08, -21, 0.05], [1.3, -25, -0.1]]) tink(T.sink + dt, g, p);
  // S09: lighter ticks as they reach the surface again.
  for (const [dt, g, p] of [[1.15, -24, 0.2], [1.35, -25, -0.2], [1.55, -26, 0.05]]) tink(T.rise + dt, g, p);

  // S02: crystalline ticks while the lattice locks in.
  const ticks = (dur, rate) => filter(crackle(dur, rate, rand, { lo: 3500, hi: 9000 }), 'highpass', 2800);
  put(shape(ticks(T.freezeEnd - T.freezeStart, 9), (t) => envAR(t, T.freezeEnd - T.freezeStart, 0.4, 0.5)), T.freezeStart, -27, 0.1);

  // S03: skate glides, then the world goes muffled under the ice.
  for (const [at, pan] of [[14.95, -0.5], [16.05, -0.1], [17.1, 0.3]]) put(shape(filter(n(0.55, 'white'), 'bandpass', (t) => 2300 + 1500 * t, 1.4), (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.55)), 1.5)), at, -26, pan);
  const wind = (dur) => shape(filter(n(dur, 'pink'), 'bandpass', 520, 0.6), (t) => 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.17 * t + 1.3));
  put(shape(wind(3.6), (t) => envAR(t, 3.6, 0.6, 0.5)), 14.6, -31, -0.2);
  put(shape(filter(n(0.8, 'white'), 'lowpass', (t) => 3800 * Math.exp(-t * 6) + 220, 0.8), (t) => smooth(0, 0.05, t) * Math.exp(-t * 4)), T.descend + 0.45, -19);
  const lakeDur = 41.2 - 18.3;
  put(shape(filter(n(lakeDur, 'brown'), 'lowpass', 170), (t) => envAR(t, lakeDur, 0.5, 0.8) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.21 * t))), 18.3, -31);
  // Deep, soft ice groans.
  const groan = (at, f0, f1, gainDb) => put(shape(tone(1.9, (t) => (f0 + (f1 - f0) * t / 1.9) * (1 + 0.02 * Math.sin(2 * Math.PI * 5 * t))), (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / 1.9)), 1.4)), at, gainDb);
  groan(20.5, 118, 74, -27); groan(34.4, 96, 62, -27); groan(37.9, 84, 55, -26);

  // S04/S05: delicate falling crystal ticks.
  const cd = 40.6 - T.crystalsStart;
  put(shape(ticks(cd, 12), (t) => smooth(0, 2.5, t) * (1 - smooth(cd - 1.2, cd, t)) * (0.7 + 0.3 * Math.sin(t * 0.9))), T.crystalsStart, -31, 0);

  // S06: cold wind and small waves against the jetty.
  put(shape(wind(9.2), (t) => envAR(t, 9.2, 0.8, 0.8)), 40.9, -27, 0.1);
  const lap = new Float32Array(sec(8.6)), lapN = filter(n(8.6, 'pink'), 'lowpass', 1100);
  for (let i = 0; i < lap.length; i++) { const t = i / SR; lap[i] = lapN[i] * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 0.42 * t + Math.sin(t * 0.7)), 4); }
  put(shape(lap, (t) => envAR(t, 8.6, 0.6, 0.6)), 41.1, -27, -0.2);

  // S07: the ice cap slips away; polar wind and a few distant penguin calls before the cut.
  put(shape(filter(n(1.6, 'pink'), 'bandpass', (t) => 1200 * Math.exp(-t * 1.4) + 220, 1.1), (t) => smooth(0, 0.08, t) * Math.exp(-t * 2.2)), T.seaIceOut, -15);
  put(shape(wind(4.1), (t) => envAR(t, 4.1, 0.3, 0.4)), 55.2, -27, 0.15);
  for (let i = 0; i < 6; i++) {
    const at = 55.5 + rand() * 1.5, len = 0.16 + rand() * 0.12, f0 = 520 + rand() * 180, y = new Float32Array(sec(len));
    for (const h of [1, 2, 3, 4]) { const s = tone(len, (t) => f0 * h * (1 + 0.06 * Math.sin(2 * Math.PI * 28 * t))); for (let k = 0; k < y.length; k++) y[k] += s[k] / h; }
    put(shape(filter(y, 'bandpass', 1500, 1.2), (t) => Math.sin(Math.PI * Math.min(1, t / len))), at, -31 - rand() * 4, rand() * 1.2 - 0.6);
  }

  // S08: frost creeping, then one dull crack with a short metallic ring.
  put(shape(ticks(T.burstStart - T.frostStart, 14), (t) => smooth(0, 1.5, t)), T.frostStart, -31, 0);
  put(shape(filter(n(0.25, 'white'), 'lowpass', 2600), (t) => smooth(0, 0.004, t) * Math.exp(-t * 26)), T.burstStart + 0.05, -12);
  const ring = new Float32Array(sec(0.9));
  for (const [f, a, d] of [[1880, 1, 6], [3290, 0.5, 9], [4710, 0.25, 13]]) { const s = tone(0.9, f); for (let i = 0; i < ring.length; i++) ring[i] += s[i] * a * Math.exp(-(i / SR) * d); }
  put(ring, T.burstStart + 0.06, -25, 0.1);

  const wetFx = reverb({ L: fx.L.subarray(0, sec(duration)), R: fx.R.subarray(0, sec(duration)), sr: SR }, { decay: 1.4, mix: 0.18, tail: 0.3 });
  mixStereo(sfx, wetFx, 0, 1);
  return { music, sfx };
}
