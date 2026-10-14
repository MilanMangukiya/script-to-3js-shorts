import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

/** Original score and Foley; impacts align to the authored collision frames, with 120 ms stagger. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(622100);
  [[0, 10.5, ['D2', 'A2', 'F3']], [10.5, 21.1, ['Bb1', 'F2', 'A3']], [21.1, 26.7, ['G2', 'D3', 'A3']],
    [26.7, 39.8, ['Bb2', 'F3', 'C4']], [39.8, 45.8, ['G2', 'D3', 'A3']], [45.8, D, ['D2', 'A2', 'F3']]].forEach(([a, b, notes], i) =>
    mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + 1.8, attack: .9, release: 2, detune: 3, bright: .55, seed: 130 + i }), a, .3));
  for (let t = .1, i = 0; t < 26; t += .78, i++) {
    mixMono(music, shape(tone(.19, 110 + (i % 4) * 55), u => Math.exp(-u * 35) * (1 - Math.exp(-u * 180))), t, .07, Math.sin(i) * .18);
  }
  for (const [i, t] of [27.2, 30.8, 34.4, 37.3, 43, 47.8].entries()) {
    mixMono(music, shape(tone(2.6, NOTE(['D5', 'A4', 'F5'][i % 3])), u => Math.exp(-u * 2.1) * (1 - Math.exp(-u * 70))), t, .045, .15);
  }
  // Put ambience in the bed, so its silence drop is applied together with music by tools/soundtrack.mjs.
  const city = filter(noise(Math.ceil(D * SR), r, 'pink'), 'lowpass', 2300);
  for (let i = 0; i < city.length; i++) { const t = i / SR; city[i] *= t < 5.5 || (t >= 10.5 && t < 15.8) || t >= 45.8 ? .05 : .008; }
  mixMono(music, city, 0, 1);
  const wash = shape(filter(noise(Math.round(1.3 * SR), r, 'pink'), 'bandpass', 1400), u => envAR(u, 1.3, .05, .95));
  mixMono(sfx, wash, .65, dB(-23), -.25);
  for (const [i, t] of [12, 12.12, 12.24].entries()) {
    mixMono(sfx, shape(tone(.85, u => 86 - 45 * Math.min(u, .8)), u => Math.exp(-u * 7) * (1 - Math.exp(-u * 200))), t, dB(-15 - i * 2), i % 2 ? .35 : -.2);
    mixMono(sfx, shape(filter(noise(Math.round(.65 * SR), r, 'white'), 'highpass', 700 + i * 500), u => Math.exp(-u * 13) * (1 - Math.exp(-u * 180))), t, dB(-21 - i * 2), i % 2 ? .3 : -.2);
  }
  const machinery = shape(filter(noise(Math.ceil(4 * SR), r, 'brown'), 'lowpass', 800), u => envAR(u, 4, .15, 3));
  mixMono(sfx, machinery, 16.1, dB(-27));
  for (let t = 21.4; t < 26.2; t += .58) mixMono(sfx, shape(filter(noise(Math.round(.09 * SR), r, 'pink'), 'lowpass', 1800), u => envAR(u, .09, .006, .07)), t, dB(-31), -.15);
  for (const t of [22, 23, 24, 25]) mixMono(sfx, shape(tone(.15, 680), u => envAR(u, .15, .01, .1)), t, dB(-36), .3);
  const hiss = shape(filter(noise(Math.ceil(6 * SR), r, 'pink'), 'highpass', 1800), u => envAR(u, 6, .7, 1.4));
  mixMono(sfx, hiss, 39.8, dB(-32), -.2);
  mixMono(sfx, shape(tone(.65, 640), u => Math.exp(-u * 8) * (1 - Math.exp(-u * 250))), 42.8, dB(-31));
  mixMono(sfx, wash, 52.1, dB(-27), .2);
  automate(music, t => smooth(0, .1, t) * (1 - smooth(D - .3, D, t)));
  // Foley tails are also ducked during the 0.3-second pre-impact interval; speech remains clear.
  const modern = { sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R };
  applyPreImpactVacuum(modern, { at_s: 11.7, duration_s: .3, duckDb: -24 });
  return { music, sfx };
}
