import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));

/** Original score and Foley; event times come from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(7031), B = T.bounds;
  const chord = (a, b, notes, gain, o = {}) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + (o.tail ?? 1.4), attack: o.attack ?? .7, release: o.release ?? 1.2, detune: o.detune ?? 4, bright: o.bright ?? 1.6, seed: o.seed ?? Math.round(a * 37) }), a, gain);

  // ---- score: easy morning that turns uneasy, relief behind glass, wry jam, crystalline stratosphere, warm night
  chord(0, B[2], ['F3', 'A3', 'C4', 'E4'], .26, { attack: .05, bright: 1.3 });
  chord(B[1], B[4], ['B5', 'C6'], .05, { attack: 1.2, bright: 3, seed: 9 });                       // thin uneasy high drone
  chord(B[2], B[4], ['D2', 'A2', 'F3', 'C4'], .26, { attack: .6, bright: 2.0, seed: 21 });
  chord(B[4], T.hatch1 - .3, ['Bb1', 'F2', 'Db3', 'Ab3'], .26, { attack: .5, release: .25, tail: .3, bright: 2.2, seed: 33 });
  chord(T.hatch1, B[7], ['F2', 'C3', 'A3', 'E4', 'G4'], .26, { attack: .15, bright: 1.4, seed: 45 });
  chord(B[7], B[9], ['E2', 'B2', 'G#3', 'D#4', 'F#4'], .24, { attack: 1.0, bright: 1.5, seed: 57 });
  chord(B[9] - .3, D, ['Db3', 'F3', 'Ab3', 'C4', 'Eb4'], .28, { attack: .8, bright: 1.35, seed: 69 });
  // Wry plucks under the traffic-jam line.
  for (const [i, t] of [0, .42, .84, 1.5, 1.92].entries()) mixMono(music, shape(tone(.5, NOTE(['C4', 'E4', 'G4', 'E4', 'C5'][i])), u => Math.exp(-u * 9) * (1 - Math.exp(-u * 300))), B[6] + 1.9 + t, .1, (i % 2 ? .3 : -.3));
  // Night groove: soft brushed ticks and a walking bass.
  for (let t = B[9] + .1, k = 0; t < D - .4; t += .42, k++) {
    mixMono(music, shape(filter(noise(Math.round(.06 * SR), r, 'white'), 'highpass', 5000), u => Math.exp(-u * 60)), t, k % 2 ? .05 : .08, k % 2 ? .4 : -.4);
    if (k % 2 === 0) mixMono(music, shape(tone(.4, NOTE(['Db2', 'F2', 'Ab2', 'C3'][(k / 2) % 4])), u => Math.exp(-u * 5) * (1 - Math.exp(-u * 150))), t, .22);
  }
  automate(music, t => smooth(0, .1, t) * (1 - smooth(D - .4, D, t)));

  // ---- ambience in the bed so the storyboard silence ducks it with the music
  const n = Math.ceil(D * SR), street = filter(filter(noise(n, r, 'pink'), 'lowpass', 1600), 'highpass', 80);
  const murmur = filter(noise(n, r, 'pink'), 'bandpass', 550, .9), air = filter(noise(n, r, 'pink'), 'highpass', 3000);
  for (let i = 0; i < n; i++) {
    const t = i / SR, outside = t < B[5], inside = (t >= B[5] && t < B[7]) || (t >= T.s09Cut && t < B[9]), strat = t >= B[7] && t < B[8], night = t >= B[9];
    const space = (t >= B[1] && t < T.s02Cut) || (t >= B[8] && t < T.s09Cut);
    street[i] *= space || strat ? 0 : outside ? .05 : inside ? .018 : .03;
    murmur[i] *= (outside && !space ? .02 : night ? .05 : 0) * (.6 + .4 * Math.sin(t * 6.3 + Math.sin(t * 2.1) * 3));
    air[i] *= strat ? .03 : space ? .012 : 0;
  }
  mixMono(music, street, 0, 1.5); mixMono(music, murmur, 0, 1.4, .1); mixMono(music, air, 0, 1);

  // ---- Foley
  const ping = (at, f, g, pan = 0) => mixMono(sfx, shape(tone(.5, f), u => Math.exp(-u * 18) * (1 - Math.exp(-u * 500))), at, g, pan);
  const click = (at, g, pan = 0, hi = 3000) => { mixMono(sfx, shape(filter(noise(Math.round(.03 * SR), r, 'white'), 'bandpass', hi, 2), u => Math.exp(-u * 260)), at, g, pan); mixMono(sfx, shape(tone(.05, 220), u => Math.exp(-u * 80)), at, g * .5, pan); };
  // Morning terrace: cups and the odd bird (outside scenes only).
  for (const [i, t] of [.6, 1.9, 3.3, 16.2, 18.4, 20.6].entries()) ping(t, 2600 + (i % 3) * 700, dB(-30), Math.sin(i * 2) * .6);
  for (const t of [1.2, 2.7, 10.1, 15.9, 21.3]) { const c = tone(.11, u => 3600 + 1400 * Math.sin(u * 60)); mixMono(sfx, shape(c, u => envAR(u, .11, .01, .06)), t, dB(-34), .5); mixMono(sfx, shape(c, u => envAR(u, .11, .01, .06)), t + .16, dB(-36), .5); }
  // The meter: power click, needle sweep and the rattle against the stop.
  click(T.meterOn, dB(-16), .2, 2400);
  mixMono(sfx, shape(filter(noise(Math.round(.75 * SR), r, 'white'), 'bandpass', u => 900 + 1600 * u, 4), u => envAR(u, .75, .05, .2)), T.meterOn + .02, dB(-30), .2);
  for (let k = 0; k < 6; k++) click(T.meterPin + k * .09, dB(-24 - k * 2), .2, 4200);
  // Newspaper page turn, footsteps into the shade.
  mixMono(sfx, shape(filter(noise(Math.round(.5 * SR), r, 'pink'), 'highpass', 1500), u => envAR(u, .5, .05, .3)), T.pageTurn, dB(-22), -.3);
  for (let t = B[4] + .25, k = 0; t < T.shade + .1; t += .5, k++) mixMono(sfx, shape(filter(noise(Math.round(.08 * SR), r, 'pink'), 'lowpass', 1400), u => envAR(u, .08, .004, .06)), t, dB(-24), k % 2 ? .15 : -.15);
  // The hatch: a rolling slide, then the seal thunk right after the silence; the needle swings down.
  mixMono(sfx, shape(filter(noise(Math.round((T.hatch1 - T.hatch0) * SR), r, 'brown'), 'bandpass', 420, 1.4), u => envAR(u, T.hatch1 - T.hatch0, .08, .1)), T.hatch0, dB(-14), -.2);
  mixMono(sfx, shape(tone(.5, u => 95 * Math.pow(.6, u)), u => Math.exp(-u * 9) * (1 - Math.exp(-u * 400))), T.hatch1, dB(-8));
  click(T.hatch1, dB(-12), -.2, 1800);
  mixMono(sfx, shape(filter(noise(Math.round(.6 * SR), r, 'white'), 'bandpass', u => 2400 - 1500 * u, 5), u => envAR(u, .6, .02, .3)), T.hatch1 + .03, dB(-28));
  // Muffled horns behind glass during the jam.
  for (const [i, t] of [B[6] + .8, B[6] + 2.9, B[6] + 4.2].entries()) {
    const h = new Float32Array(Math.round(.45 * SR)); for (let k = 0; k < h.length; k++) { const s = k / SR; h[k] = (Math.sign(Math.sin(2 * Math.PI * (390 + i * 40) * s)) * .5 + Math.sin(2 * Math.PI * (490 + i * 40) * s) * .5) * envAR(s, .45, .02, .1); }
    mixMono(sfx, filter(h, 'lowpass', 700), t, dB(-30), i % 2 ? .4 : -.4);
  }
  // Stratosphere: a crystalline tick when each O2 splits, two bind ticks 120 ms apart.
  for (const s of T.splits) {
    ping(s, 3150, dB(-14), 0);
    mixMono(sfx, shape(filter(noise(Math.round(.25 * SR), r, 'white'), 'highpass', 4500), u => Math.exp(-u * 30)), s, dB(-24));
    ping(s + T.bindDelay, NOTE('E6'), dB(-16), -.35); ping(s + T.bindDelay + .12, NOTE('B6'), dB(-17), .35);
  }
  // Night terrace clinks.
  for (const [i, t] of [B[9] + .7, B[9] + 1.9, B[9] + 3.2, B[9] + 4.4, B[9] + 5.6].entries()) ping(t, 2400 + (i % 3) * 800, dB(-26), Math.sin(i * 1.7) * .7);
  const wet = reverb(sfx, { decay: 1.0, mix: .14, damp: .45, tail: .2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  // Foley also drops out during the pre-reveal silence; the seal itself lands after it.
  applyPreImpactVacuum({ sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R }, { at_s: T.hatch1 - .3, duration_s: .3, duckDb: -24 });
  return { music, sfx };
}
