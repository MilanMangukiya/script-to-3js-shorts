// Original synthesized music bed and sound effects for "oxygen-gone-five-seconds".
// Levels are written relative to narration (0 dB = voice peak level reference handled by tools/soundtrack.mjs).
import { SR, dB, NOTE, rng, stereo, mixMono, mixStereo, automate, smooth, envAR, noise, filter, pad, reverb, shape, tone, crackle } from '../../library/audio/synth.mjs';

// Cue times mirror src/stories/oxygen-gone-five-seconds/timeline.ts.
const T = { candleOut: 2.3, moleculesOut: 8.7, pressureDrop: 13.7, earPop: 21.9, fireOut: 34.6, engineOut: 37.9, plunge: 47.4, oxygenBack: 55.2, fireBack: 56.3, outageStart: 59.2, outageEnd: 62.6, matchIn: 68.9, relight: 70.4 };
const N = (...names) => names.map(NOTE);

/** @returns {{music: {L,R,sr}, sfx: {L,R,sr}}} two stems at 48 kHz covering `duration` seconds. */
export function buildSoundtrack(duration) {
  const rand = rng(20261011);
  const music = stereo(duration), sfx = stereo(duration);
  const sec = (s) => Math.ceil(s * SR);

  // ---------------------------------------------------------------- music: slow D-minor pad progression
  const chords = [
    [0.0, 6.6, N('D2', 'A2', 'F3', 'A3', 'E4')],
    [5.0, 8.4, N('Bb1', 'F2', 'D3', 'A3', 'D4')],
    [12.2, 5.4, N('F2', 'C3', 'A3', 'C4', 'G4')],
    [16.4, 5.4, N('G2', 'D3', 'Bb3', 'D4', 'F4')],
    [20.6, 4.6, N('D2', 'A2', 'F3', 'A3', 'E4')],
    [24.0, 7.0, N('Bb1', 'F2', 'D3', 'F3', 'C4')],
    [29.8, 7.4, N('G2', 'D3', 'G3', 'Bb3', 'D4')],
    [36.0, 9.4, N('A2', 'E3', 'A3', 'B3', 'E4')],
    [44.4, 4.2, N('F2', 'C3', 'F3', 'A3', 'C4')],
    [47.4, 7.0, N('Bb1', 'F2', 'Bb2', 'D3', 'F3')],
    [53.2, 4.4, N('C2', 'G2', 'D3', 'G3', 'E4')],
    [56.3, 3.6, N('D2', 'A2', 'D3', 'F3', 'A3', 'E4')],
    [58.4, 6.0, N('Bb1', 'F2', 'D3', 'A3', 'D4')],
    [63.0, 8.4, N('D2', 'A2', 'F3', 'A3', 'E4')],
    [70.4, 3.4, N('D2', 'A2', 'F#3', 'A3', 'E4')], // gentle major resolution as the flame returns
  ];
  const padBus = stereo(duration + 4);
  chords.forEach(([at, dur, freqs], i) => mixStereo(padBus, pad({ freqs, dur, attack: 1.8, release: 2.2, bright: 2.0, detune: 6, seed: 11 + i }), at, 1));
  // The pad "inhales" (thins) whenever the oxygen is gone and breathes back when the scene resets.
  const thin = (t) => {
    const dips = [[T.candleOut, 5.0], [T.moleculesOut, 12.2], [T.pressureDrop, 15.8], [T.fireOut, 36.0], [T.engineOut, 44.4], [T.outageStart + 0.8, 63.2]];
    let g = 1;
    for (const [a, b] of dips) g *= 1 - 0.72 * smooth(a, a + 0.5, t) * (1 - smooth(b - 0.2, b + 1.0, t));
    return g * (1 - 0.75 * smooth(duration - 1.3, duration - 0.05, t));
  };
  automate(padBus, thin);
  // A single suspended high note that remains when the chord thins.
  const air = stereo(duration);
  for (const [f, pan, lf] of [[NOTE('A4'), -0.3, 0.11], [NOTE('E5'), 0.35, 0.083]]) {
    mixMono(air, shape(tone(duration, f), (t) => (0.5 + 0.5 * Math.sin(2 * Math.PI * lf * t)) * envAR(t, duration, 3, 2.5)), 0, 0.05, pan);
  }
  // Low pulse that grows through the mechanism and aircraft scenes.
  const pulse = shape(tone(duration, NOTE('D2') / 2), (t) => Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t - 1.2), 3) * (0.25 * smooth(10, 16, t) * (1 - smooth(27, 31, t)) + 0.3 * smooth(36, 39, t) * (1 - smooth(43, 46, t)) + 0.3 * smooth(58, 60, t) * (1 - smooth(62.5, 64, t))));
  mixMono(padBus, pulse, 0, 0.5, 0);
  const wetPad = reverb({ L: padBus.L.subarray(0, sec(duration)), R: padBus.R.subarray(0, sec(duration)), sr: SR }, { decay: 3.2, mix: 0.4, tail: 0.5 });
  mixStereo(music, wetPad, 0, 1.0);
  mixStereo(music, reverb(air, { decay: 3.5, mix: 0.5, tail: 0.5 }), 0, 1.0);

  // ---------------------------------------------------------------- sound effects
  const fx = stereo(duration + 4);
  const put = (mono, at, gainDb, pan = 0) => mixMono(fx, mono, at, dB(gainDb), pan);
  const n = (dur, color) => noise(sec(dur), rand, color);

  // Room tone so the track never falls to digital silence.
  put(filter(n(duration, 'pink'), 'lowpass', 900), 0, -46);

  // Soft "air leaving" breath used at each vanish.
  const vanish = (at, gainDb) => put(shape(filter(n(1.5, 'pink'), 'bandpass', (t) => 1300 * Math.exp(-t * 1.6) + 220, 1.1), (t) => smooth(0, 0.05, t) * Math.exp(-t * 2.6)), at, gainDb);
  vanish(T.candleOut - 0.03, -8);
  // Candle flutter before it dies and after it is relit.
  const flutter = (dur) => shape(filter(n(dur, 'brown'), 'lowpass', 500), (t) => 0.6 + 0.4 * Math.sin(2 * Math.PI * 11 * t + Math.sin(t * 3)));
  put(shape(flutter(2.3), (t) => envAR(t, 2.3, 0.3, 0.03)), 0, -30);
  put(shape(flutter(1.5), (t) => envAR(t, 1.5, 0.5, 0.6)), T.relight + 0.1, -30);

  // S02: glassy shimmer as the molecules disappear.
  const shimmer = new Float32Array(sec(1.4));
  for (const [f, a] of [[2093, 1], [3136, 0.7], [4186, 0.5], [5274, 0.35], [6272, 0.25]]) { const s = tone(1.4, f * (1 + (rand() - 0.5) * 0.004)); for (let i = 0; i < shimmer.length; i++) shimmer[i] += s[i] * a * Math.exp(-i / SR * (3 + f / 1500)); }
  put(shimmer, T.moleculesOut - 0.02, -27, 0.1);
  vanish(T.moleculesOut - 0.03, -14);

  // S03: low pressure thump.
  put(shape(tone(1.2, (t) => 38 + 34 * Math.exp(-t * 7)), (t) => smooth(0, 0.012, t) * Math.exp(-t * 4.2)), T.pressureDrop - 0.02, -13);
  vanish(T.pressureDrop - 0.03, -11);
  // Sea wash under the coast scenes (S03, S04, S07/SH01).
  const sea = (dur) => shape(filter(filter(n(dur, 'pink'), 'bandpass', 700, 0.5), 'lowpass', 2400), (t) => 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 0.13 * t + 1), 2));
  put(shape(sea(17.6), (t) => envAR(t, 17.6, 1.0, 0.8)), 12.4, -27, -0.2);
  put(shape(sea(3.0), (t) => envAR(t, 3.0, 0.3, 0.2)), 44.5, -26, 0.1);

  // S04: ear pop (dull thud) and a brief faint ring.
  put(shape(filter(n(0.12, 'white'), 'lowpass', 240), (t) => Math.exp(-t * 55)), T.earPop, -10);
  put(shape(tone(1.6, 3400), (t) => smooth(0, 0.05, t) * Math.exp(-t * 2.4)), T.earPop + 0.03, -36);

  // S05 / S08: campfire. Roar + crackle that stops dead when the flames vanish and returns with the oxygen.
  const fire = (dur) => { const roar = filter(n(dur, 'brown'), 'lowpass', 420), cr = filter(crackle(dur, 16, rand), 'highpass', 700), y = new Float32Array(roar.length); for (let i = 0; i < y.length; i++) y[i] = roar[i] * 0.5 * (0.7 + 0.3 * Math.sin(i / SR * 7.3)) + cr[i] * 1.5; return y; };
  const f1 = T.fireOut - 29.7;
  put(shape(fire(f1), (t) => smooth(0, 1.2, t) * (1 - smooth(f1 - 0.03, f1, t))), 29.7, -21, 0);
  vanish(T.fireOut - 0.02, -10);
  // Night air after the fire dies and before it returns.
  const nightAir = (dur) => shape(filter(n(dur, 'pink'), 'lowpass', 380), (t) => 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.2 * t));
  put(shape(nightAir(1.9), (t) => envAR(t, 1.9, 0.3, 0.3)), T.fireOut, -33);
  put(shape(nightAir(3.2), (t) => envAR(t, 3.2, 0.3, 0.3)), 53.3, -33);
  // Oxygen rushes back: rising inrush, then the fire catches with a soft low "fwoomp".
  put(shape(filter(n(1.2, 'pink'), 'bandpass', (t) => 240 + 1500 * Math.pow(t / 1.2, 2), 1.0), (t) => Math.pow(t / 1.2, 1.6) * (1 - smooth(1.12, 1.2, t))), T.oxygenBack - 0.15, -14);
  put(shape(tone(0.9, (t) => 46 + 40 * Math.exp(-t * 6)), (t) => smooth(0, 0.03, t) * Math.exp(-t * 4.5)), T.fireBack, -14);
  put(shape(filter(n(0.8, 'brown'), 'lowpass', 700), (t) => smooth(0, 0.06, t) * Math.exp(-t * 4)), T.fireBack, -10);
  const f2 = 58.5 - T.fireBack;
  put(shape(fire(f2), (t) => smooth(0, 0.5, t) * (1 - smooth(f2 - 0.35, f2, t))), T.fireBack, -20, 0);

  // S06: distant jet whine that spools down at the flame-out, leaving rushing air.
  const jetDur = 44.7 - 36.1, spool = (t) => Math.exp(-Math.max(0, t - (T.engineOut - 36.1)) * 0.55);
  const whine = new Float32Array(sec(jetDur));
  for (const [f, a] of [[1870, 1], [2810, 0.55], [3760, 0.3]]) { const s = tone(jetDur, (t) => f * (0.35 + 0.65 * spool(t))); for (let i = 0; i < whine.length; i++) whine[i] += s[i] * a; }
  put(shape(whine, (t) => envAR(t, jetDur, 0.5, 0.4) * Math.pow(spool(t), 1.6)), 36.1, -36, -0.25);
  put(shape(filter(n(jetDur, 'brown'), 'lowpass', 300), (t) => envAR(t, jetDur, 0.5, 0.4) * (0.25 + 0.75 * spool(t))), 36.1, -27, -0.2);
  put(shape(filter(n(jetDur, 'pink'), 'bandpass', 1500, 0.4), (t) => envAR(t, jetDur, 0.6, 0.4)), 36.1, -34, 0.15);
  vanish(T.engineOut - 0.03, -13);

  // S07: plunge and muffled underwater calm with a few bubbles.
  put(shape(filter(n(0.7, 'white'), 'lowpass', (t) => 4500 * Math.exp(-t * 7) + 260, 0.8), (t) => smooth(0, 0.02, t) * Math.exp(-t * 5)), T.plunge - 0.05, -16);
  const uw = 53.6 - T.plunge;
  put(shape(filter(n(uw, 'brown'), 'lowpass', 190), (t) => envAR(t, uw, 0.25, 0.5) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.3 * t))), T.plunge, -26);
  for (let i = 0; i < 16; i++) {
    const at = T.plunge + 0.05 + Math.pow(rand(), 1.6) * 4.6, len = 0.04 + rand() * 0.07, f0 = 500 + rand() * 600;
    put(shape(tone(len, (t) => f0 * (1 + 2.2 * t / len * 0.35)), (t) => Math.sin(Math.PI * t / len)), at, -28 - rand() * 6, rand() * 1.4 - 0.7);
  }

  // S08/SH02: a faint mains hum that sags and dies as the lights go out.
  const humDur = 5.0, hum = new Float32Array(sec(humDur));
  for (const [h, a] of [[1, 1], [2, 0.5], [3, 0.3], [5, 0.12]]) { const s = tone(humDur, (t) => 50 * h * (1 - 0.1 * smooth(T.outageStart - 58.4, T.outageEnd - 58.4, t))); for (let i = 0; i < hum.length; i++) hum[i] += s[i] * a; }
  put(shape(hum, (t) => smooth(0, 0.5, t) * (1 - smooth(T.outageStart - 58.4, T.outageEnd - 58.4 + 0.2, t))), 58.4, -27);

  // S09: match flare and the candle catching.
  put(shape(filter(n(0.22, 'white'), 'highpass', 2600), (t) => smooth(0, 0.01, t) * Math.exp(-t * 16)), T.matchIn - 0.25, -19, 0.5);
  put(shape(filter(n(0.9, 'pink'), 'bandpass', 900, 0.7), (t) => smooth(0, 0.05, t) * Math.exp(-t * 4.5)), T.matchIn - 0.2, -19, 0.5);
  put(shape(filter(n(0.5, 'brown'), 'lowpass', 600), (t) => smooth(0, 0.04, t) * Math.exp(-t * 7)), T.relight, -15, 0.05);

  const wetFx = reverb({ L: fx.L.subarray(0, sec(duration)), R: fx.R.subarray(0, sec(duration)), sr: SR }, { decay: 1.3, mix: 0.16, tail: 0.3 });
  mixStereo(sfx, wetFx, 0, 1);
  return { music, sfx };
}
