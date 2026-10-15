import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));

/** Original score and Foley. Every event time comes from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(5150);
  const chord = (a, b, notes, gain, o = {}) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + (o.tail ?? 1.6), attack: o.attack ?? .8, release: o.release ?? 1.4, detune: o.detune ?? 4, bright: o.bright ?? 1.7, seed: o.seed ?? Math.round(a * 31) }), a, gain);
  const B = T.bounds;

  // ---- score: airy noon that collapses with the sky, tension in the shade, star shimmer, cold dusk, bright switch-on
  chord(0, T.drain0 + .2, ['C3', 'G3', 'E4', 'D5'], .32, { attack: .05, release: .5, bright: 1.2, tail: .4 });
  chord(T.drain1, B[3], ['A1', 'E2', 'C3', 'B3'], .3, { attack: .6, bright: 2.1 });
  chord(B[3], B[5], ['F1', 'C2', 'Ab2', 'G3'], .3, { attack: .5, bright: 2.2, seed: 77 });
  chord(B[5], B[6], ['E2', 'B2', 'G#3', 'D#4', 'F#5'], .26, { attack: 1.0, bright: 1.4, seed: 91 });
  chord(B[6], T.sunset - .3, ['D2', 'A2', 'E3', 'A3'], .28, { attack: 1.2, release: .25, bright: 1.6, tail: .3, seed: 103 });
  chord(T.sunset, T.sunrise - .3, ['C1', 'G1', 'Eb2'], .3, { attack: .02, release: .3, bright: 2.4, tail: .3, seed: 117 });
  chord(T.sunrise, D, ['C3', 'G3', 'E4', 'B4', 'D5'], .34, { attack: .02, release: .6, bright: 1.25, tail: .2, seed: 131 });
  // Star shimmer: glassy bells as the stars come out.
  for (const [i, t] of [0, .45, .8, 1.3, 1.65, 2.1, 2.4, 2.85].entries()) {
    const f = NOTE(['E6', 'B5', 'G#6', 'D#6', 'F#6', 'B6', 'E6', 'G#6'][i]);
    mixMono(music, shape(tone(2.2, f), u => Math.exp(-u * 2.6) * (1 - Math.exp(-u * 90))), T.s06Cut + .1 + t, .06, Math.sin(i * 1.7) * .6);
  }
  // Heartbeat under the blind crossing and the near miss.
  for (let t = T.s04Edge - .2; t < T.s05Reveal - .35; t += .82) for (const [k, dt] of [[1, 0], [.6, .17]]) {
    mixMono(music, shape(tone(.22, u => 62 - 18 * u), u => Math.exp(-u * 22) * (1 - Math.exp(-u * 400))), t + dt, .5 * k);
  }
  // Low descending drain as the blue goes.
  mixMono(music, shape(tone(1.6, u => 118 * Math.pow(.5, u / 1.1)), u => envAR(u, 1.6, .12, .9)), T.drain0, .55);
  automate(music, t => smooth(0, .08, t) * (1 - smooth(D - .35, D, t)));

  // ---- ambience in the bed (so the storyboard silences duck it with the music)
  const n = Math.ceil(D * SR), city = filter(filter(noise(n, r, 'pink'), 'lowpass', 1400), 'highpass', 70);
  const waves = filter(noise(n, r, 'pink'), 'lowpass', 700);
  for (let i = 0; i < n; i++) {
    const t = i / SR, noon = t < B[6], inCar = t >= B[4] && t < B[5];
    city[i] *= (noon ? (inCar ? .015 : .05) : t < T.sunset ? .025 : .012);
    const sea = t >= B[6] && t < B[8] ? .5 + .5 * Math.sin(2 * Math.PI * t / 6.5) ** 2 : 0;
    waves[i] *= .05 * sea * (t >= T.s07Cut ? 1.6 : .7);
  }
  mixMono(music, city, 0, 1.6); mixMono(music, waves, 0, 1.4, -.1);

  // ---- foreground Foley
  const click = (at, gain, pan = 0, hi = 3200) => {
    mixMono(sfx, shape(filter(noise(Math.round(.03 * SR), r, 'white'), 'bandpass', hi, 1.8), u => Math.exp(-u * 260)), at, gain, pan);
    mixMono(sfx, shape(tone(.06, 180), u => Math.exp(-u * 70)), at, gain * .5, pan);
  };
  const thump = (at, gain, f0 = 70, len = 1.2) => mixMono(sfx, shape(tone(len, u => f0 * Math.pow(.55, u)), u => Math.exp(-u * 3.2) * (1 - Math.exp(-u * 300))), at, gain);
  // Footsteps across the crossing (1.45 m/s, 0.69 m steps), muffled once in the shade.
  for (let t = B[3] + .15, k = 0; t < B[4] - .2; t += .48, k++) {
    const shade = t > T.s04Edge;
    mixMono(sfx, shape(filter(noise(Math.round(.09 * SR), r, 'pink'), 'lowpass', shade ? 900 : 1800), u => envAR(u, .09, .004, .07)), t, dB(shade ? -27 : -24), k % 2 ? .15 : -.15);
  }
  // Crossing the shadow edge: a pressure-like muffle.
  mixMono(sfx, shape(filter(noise(Math.round(1.0 * SR), r, 'pink'), 'lowpass', u => 1200 - 900 * u), u => envAR(u, 1.0, .25, .6)), T.s04Edge - .1, dB(-20));
  // Car interior hum, an oncoming pass-by, brake squeal, thump and horn.
  const hum = shape(filter(noise(Math.ceil((B[5] - B[4]) * SR), r, 'brown'), 'lowpass', 260), u => envAR(u, B[5] - B[4], .3, .5));
  mixMono(sfx, hum, B[4], dB(-17));
  mixMono(sfx, shape(tone(B[5] - B[4], u => 46 + (u < T.s05Brake - B[4] ? 0 : -16 * Math.min(1, (u - (T.s05Brake - B[4])) / 1.6))), u => envAR(u, B[5] - B[4], .3, .5)), B[4], dB(-26));
  mixMono(sfx, shape(filter(noise(Math.round(2.4 * SR), r, 'pink'), 'bandpass', u => 500 + 700 * Math.exp(-(((u - 1.2) / .45) ** 2)), 1.2), u => Math.exp(-(((u - 1.2) / .55) ** 2))), 23.5, dB(-21), -.5);
  const squeal = shape(filter(noise(Math.round(1.6 * SR), r, 'white'), 'bandpass', u => 2600 + 260 * Math.sin(u * 23), 9), u => envAR(u, 1.6, .03, .5) * (1 - .35 * u));
  mixMono(sfx, squeal, T.s05Brake, dB(-15), .1);
  thump(T.s05Brake, dB(-10), 80, .9);
  const horn = new Float32Array(Math.round(.62 * SR));
  for (let i = 0; i < horn.length; i++) { const t = i / SR, sq = (f) => Math.sign(Math.sin(2 * Math.PI * f * t)) * .5 + Math.sin(2 * Math.PI * f * t) * .5; horn[i] = (sq(415) + sq(523)) * .5 * envAR(t, .62, .01, .08); }
  mixMono(sfx, filter(horn, 'lowpass', 2400), T.s05Brake + .2, dB(-19), .1);
  // Night drops: deep boom, then windows switching on 120 ms apart.
  thump(T.sunset, dB(-8), 52, 2.2);
  mixMono(sfx, shape(filter(noise(Math.round(1.8 * SR), r, 'brown'), 'lowpass', 180), u => Math.exp(-u * 2.2) * (1 - Math.exp(-u * 200))), T.sunset, dB(-12));
  for (let i = 0; i < 8; i++) click(T.sunset + .15 + i * .12, dB(-17 - (i % 3)), Math.sin(i * 2.1) * .7, 2600 + (i % 4) * 400);
  // The sun switches on: a switch clack with a body thump, then lamps clicking off 140 ms apart.
  click(T.sunrise, dB(-9), 0, 2200); thump(T.sunrise, dB(-12), 95, .6);
  for (let i = 0; i < 14; i++) click(T.sunrise + .4 + i * .14, dB(-21 - (i % 4)), Math.sin(i * 1.3) * .8, 3000 + (i % 3) * 500);
  // A short, quiet reverb glues the Foley to the street.
  const wet = reverb(sfx, { decay: .9, mix: .12, damp: .5, tail: .2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  // Foley tails also drop out during each pre-impact silence (the tool ducks the bed); the hit itself lands after it.
  const modern = { sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R };
  for (const at of [T.drain0 - .3, T.s05Reveal - .3, T.sunset - .3, T.sunrise - .3]) applyPreImpactVacuum(modern, { at_s: at, duration_s: .3, duckDb: -24 });
  return { music, sfx };
}
