import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb, crackle } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));
const SLOW = (T.end - T.hit) / 5, ft = (k) => T.hit + k * SLOW; // event-seconds after the hit -> film time

/** Original score and Foley; event times come from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(1000), B = T.bounds;
  const chord = (a, b, notes, gain, o = {}) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + (o.tail ?? 1.4), attack: o.attack ?? .7, release: o.release ?? 1.2, detune: o.detune ?? 4, bright: o.bright ?? 1.6, seed: o.seed ?? Math.round(a * 37) }), a, gain);
  const n = Math.ceil(D * SR), hot = (t) => t >= T.hit && t < T.end;

  // ---- score: a bright morning for one second, a stretched heat drone for the five slowed seconds, sober aftermath
  chord(0, T.hit, ['F3', 'A3', 'C4', 'E4'], .24, { attack: .03, release: .05, tail: .05, bright: 1.3, seed: 3 });
  for (const [i, t] of [0, .22, .44, .66].entries()) mixMono(music, shape(tone(.4, NOTE(['C5', 'E5', 'G5', 'A5'][i])), u => Math.exp(-u * 10) * (1 - Math.exp(-u * 400))), .05 + t, .09, i % 2 ? .3 : -.3);
  chord(T.hit, T.end, ['Bb1', 'F2', 'C3'], .3, { attack: 1.5, release: .04, tail: .04, bright: 1.2, detune: 6, seed: 11 });
  chord(B[2], T.end, ['E5', 'F5'], .045, { attack: 6, release: .04, tail: .04, bright: 2.6, seed: 17 });                  // thin dissonance that creeps in
  chord(B[6], T.end, ['Gb2', 'Db3', 'Ab3'], .16, { attack: 3, release: .04, tail: .04, bright: 1.8, seed: 23 });          // tension under the fires
  chord(T.end + .1, B[8], ['D2', 'A2', 'F3', 'E4'], .34, { attack: .4, bright: 1.4, seed: 29 });
  chord(B[8], B[9], ['Bb1', 'F2', 'D3', 'A3'], .2, { attack: 1.0, bright: 1.3, seed: 31 });
  chord(B[9] - .2, D, ['F2', 'C3', 'A3', 'E4', 'G4'], .25, { attack: .9, bright: 1.35, seed: 37 });
  // Slowed heartbeat while the air is hot: lub-dub, a little louder toward the fires.
  for (let t = T.hit + .5; t < T.end - .3; t += 1.55) {
    const g = .18 + .1 * smooth(B[5], B[7], t);
    for (const [d, k] of [[0, 1], [.28, .7]]) mixMono(music, filter(shape(tone(.3, u => 58 - 18 * u), u => Math.exp(-u * 14) * (1 - Math.exp(-u * 300))), 'lowpass', 180), t + d, g * k);
  }
  // Sparse low piano-like notes in the aftermath.
  for (const [i, t] of [B[8] + .6, B[8] + 2.4, B[8] + 4.6, B[9] + .8, B[9] + 3.2].entries()) mixMono(music, shape(tone(1.6, NOTE(['A3', 'F3', 'D4', 'C4', 'A3'][i])), u => Math.exp(-u * 2.6) * (1 - Math.exp(-u * 300))), t, .08, i % 2 ? .25 : -.25);
  automate(music, t => smooth(0, .05, t) * (1 - smooth(D - .5, D, t)));

  // ---- ambience in the bed so the storyboard silences duck it with the music
  const air = filter(noise(n, r, 'pink'), 'lowpass', 1300), roar = filter(filter(noise(n, r, 'brown'), 'lowpass', 260), 'highpass', 25);
  const city = filter(noise(n, r, 'pink'), 'lowpass', 700);
  for (let i = 0; i < n; i++) {
    const t = i / SR, h = hot(t), after = t >= T.end, nextDay = t >= B[8];
    air[i] *= h ? 0 : nextDay ? .022 : after ? (t >= T.s08Cut ? .07 : .03) : .035;
    roar[i] *= h ? (.09 + .02 * smooth(B[6], T.end, t)) * (.85 + .15 * Math.sin(t * .9 + Math.sin(t * .37) * 2)) * smooth(T.hit, T.hit + .15, t) : 0;
    city[i] *= h ? 0 : nextDay ? .012 : after ? .025 : .02;
  }
  mixMono(music, air, 0, 1.2); mixMono(music, roar, 0, 2.2); mixMono(music, city, 0, 1.1, -.2);
  const chirp = (at, f, g, pan) => { const c = tone(.12, u => f + 1500 * Math.sin(u * 55)); for (const d of [0, .15]) mixMono(music, shape(c, u => envAR(u, .12, .01, .07)), at + d, g, pan); };
  chirp(.15, 3700, dB(-30), .5); chirp(.55, 4200, dB(-32), -.4);
  chirp(B[8] + 2.2, 3400, dB(-40), .7); chirp(B[9] + 3.6, 3900, dB(-42), -.6);                                           // a few birds far away next day
  // Distant sirens after the heat (wailing, low-passed).
  for (const [k, at] of [[0, T.s08Cut - .4], [1, T.s08Cut + .8]]) {
    const len = B[8] - at + .8, s = tone(len, u => 750 + 330 * Math.sin(u * 2 * Math.PI / (2.6 + k * .7)));
    mixMono(music, filter(shape(s, u => envAR(u, len, .8, .8)), 'lowpass', 1800), at, dB(-22 + k * 2), k ? .55 : -.5);
  }

  // ---- Foley
  const thud = (at, g, pan = 0, lp = 900) => { mixMono(sfx, shape(filter(noise(Math.round(.12 * SR), r, 'pink'), 'lowpass', lp), u => envAR(u, .12, .004, .09)), at, g, pan); mixMono(sfx, shape(filter(noise(Math.round(.06 * SR), r, 'white'), 'bandpass', 2600, 1.5), u => Math.exp(-u * 60)), at, g * .35, pan); };
  // Jogging footsteps, then slowed footfalls (one every 2.6 s of film) until you stop.
  for (const t of [.1, .46, .82]) thud(t, dB(-20), .05);
  for (let t = T.hit + .36 * SLOW; t < ft(T.decel[1]) - 1; t += .36 * SLOW) mixMono(sfx, shape(filter(noise(Math.round(.5 * SR), r, 'brown'), 'lowpass', 260), u => envAR(u, .5, .01, .4)), t, dB(-22));
  // The hit: a deep whoomp and a rushing wall of air.
  mixMono(sfx, shape(tone(1.6, u => 30 + 55 * Math.exp(-u * 3)), u => Math.exp(-u * 2.2) * (1 - Math.exp(-u * 200))), T.hit, dB(-18));
  mixMono(sfx, shape(filter(noise(Math.round(1.8 * SR), r, 'brown'), 'lowpass', 500), u => envAR(u, 1.8, .02, 1.5)), T.hit, dB(-22));
  mixMono(sfx, shape(filter(noise(Math.round(1.4 * SR), r, 'white'), 'bandpass', u => 3200 - 2400 * Math.min(1, u / 1.2), 1.2), u => envAR(u, 1.4, .03, 1.1)), T.hit, dB(-28));
  // Dry grass ticking from S03, the paper charring from S04, a faint sizzle in the canopy in S05.
  mixMono(sfx, filter(shape(crackle(B[4] - B[2] - 1.2, 5, r), u => envAR(u, B[4] - B[2] - 1.2, 1.5, 1.5)), 'highpass', 1500), B[2] + 1.2, dB(-26), .35);
  const charLen = ft(T.paperIgnite) - ft(T.paperSmoke);
  mixMono(sfx, shape(crackle(charLen, 4, r), u => smooth(0, charLen * .8, u) * .7 + .3 * smooth(0, 1.5, u)), ft(T.paperSmoke), dB(-24), -.3);
  mixMono(sfx, shape(filter(noise(Math.round((B[5] - B[4]) * SR), r, 'white'), 'highpass', 5200), u => envAR(u, B[5] - B[4], 1, 1) * (.7 + .3 * Math.sin(u * 7))), B[4], dB(-34), .2);
  // S07: smouldering crackle builds; after the silence the paper and three litter patches ignite in turn.
  const preLen = ft(T.paperIgnite) - B[6];
  mixMono(sfx, shape(crackle(preLen, 14, r, { lo: 700, hi: 4200 }), u => .35 + .65 * smooth(0, preLen, u)), B[6], dB(-20), -.15);
  const whump = (at, g, pan) => {
    mixMono(sfx, shape(tone(.6, u => 110 * Math.exp(-u * 1.4)), u => Math.exp(-u * 6) * (1 - Math.exp(-u * 300))), at, g, pan);
    mixMono(sfx, shape(filter(noise(Math.round(.6 * SR), r, 'brown'), 'lowpass', 700), u => envAR(u, .6, .01, .45)), at, g * .9, pan);
    mixMono(sfx, shape(filter(noise(Math.round(.5 * SR), r, 'white'), 'bandpass', u => 600 + 2600 * Math.min(1, u / .4), 1.4), u => envAR(u, .5, .02, .35)), at, g * .35, pan);
  };
  whump(ft(T.paperIgnite), dB(-12), -.2);
  T.grassIgnite.forEach((g, q) => whump(ft(g), dB(-15 - q), [.4, -.35, .15][q]));
  // Slowed fire roar while the air is still hot, then normal-speed crackle and a hiss of condensing steam.
  const slowFire = T.end - ft(T.paperIgnite);
  mixMono(sfx, shape(filter(noise(Math.round(slowFire * SR), r, 'brown'), 'bandpass', 240, .8), u => smooth(0, .3, u) * (1 - smooth(slowFire - .03, slowFire, u))), ft(T.paperIgnite), dB(-31));
  const fireLen = B[8] - T.end + .5;
  mixMono(sfx, shape(crackle(fireLen, 26, r), u => envAR(u, fireLen, .02, 1.2) * (u > T.s08Cut - T.end ? .85 : 1)), T.end, dB(-19), -.2);
  mixMono(sfx, shape(filter(noise(Math.round(fireLen * SR), r, 'pink'), 'bandpass', 420, .9), u => envAR(u, fireLen, .02, 1.2) * (u > T.s08Cut - T.end ? .85 : 1)), T.end, dB(-26), -.2);
  mixMono(sfx, shape(filter(noise(Math.round(4.5 * SR), r, 'white'), 'highpass', 3400), u => envAR(u, 4.5, .15, 3.5)), T.end + .05, dB(-26), .25);

  // Under the smoke shot: wind and the nearby fires roaring at normal speed.
  const sm = B[8] - T.s08Cut + .6;
  mixMono(sfx, shape(filter(noise(Math.round(sm * SR), r, 'pink'), 'bandpass', 320, .7), u => envAR(u, sm, .3, .9)), T.s08Cut - .1, dB(-7), .1);
  const wet = reverb(sfx, { decay: 1.1, mix: .14, damp: .45, tail: .2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  // Foley also drops out during both pre-impact silences; the whoomp and the ignition land after them.
  for (const [at, dur] of [[T.hit - .3, .3], [ft(T.paperIgnite) - .25, .25]]) applyPreImpactVacuum({ sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R }, { at_s: at, duration_s: dur, duckDb: -24 });
  return { music, sfx };
}
