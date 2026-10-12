// Original synthesized music bed and sound effects for "air-pressure-doubled".
// Effect levels are in dB relative to the narration's peak reference (see tools/soundtrack.mjs).
// Cue times come from cues.json, the same file the film's timeline reads.
import fs from 'node:fs';
import { SR, dB, NOTE, rng, stereo, mixMono, mixStereo, automate, smooth, envAR, noise, filter, pad, reverb, shape, tone, crackle } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./cues.json', import.meta.url), 'utf8'));
const N = (...names) => names.map(NOTE);

export function buildSoundtrack(duration) {
  const rand = rng(20261012);
  const music = stereo(duration), sfx = stereo(duration);
  const sec = (s) => Math.ceil(s * SR);

  // ---------------------------------------------------------------- music: D major / B minor pad, airy and slow
  const chords = [
    [0.0, 4.6, N('B2', 'F#3', 'B3', 'D4', 'C#5')],
    [3.6, 6.0, N('G2', 'D3', 'B3', 'D4')],
    [T.doubleIt - 0.3, 3.6, N('D2', 'A2', 'F#3', 'A3', 'D4')],
    [T.S03_start - 0.4, 5.4, N('E2', 'B2', 'G3', 'F#4')],
    [T.S03_start + 4.6, 5.4, N('C3', 'G3', 'B3', 'E4')],
    [T.S04_start - 0.2, 5.0, N('D3', 'A3', 'F#4', 'A4', 'E5')],
    [T.andes - 1.6, 5.0, N('A2', 'E3', 'C#4', 'E4', 'B4')],
    [T.S05_start - 0.1, 5.2, N('G2', 'D3', 'B3', 'G4')],
    [T.S05_start + 4.6, 5.4, N('B2', 'F#3', 'D4', 'A4')],
    [T.S06_start - 0.2, 4.4, N('D3', 'A3', 'F#4', 'D5')],
    [T.S06_start + 3.6, 4.6, N('A2', 'E3', 'C#4', 'A4', 'E5')],
    [T.S07_start - 0.3, 5.6, N('B1', 'F#2', 'D3', 'F#3')],
    [T.S07_start + 5.0, 5.8, N('G1', 'D2', 'B2', 'F#3')],
    [T.S08_start - 0.3, 6.8, N('G2', 'D3', 'F#3', 'B3', 'D4')],
    [T.S09_start - 0.4, 6.2, N('E2', 'B2', 'G3', 'D4')],
    [T.everything - 0.5, duration - T.everything + 0.6, N('D2', 'A2', 'F#3', 'E4', 'A4')],   // gentle resolution
  ];
  const padBus = stereo(duration + 4);
  chords.forEach(([at, dur, freqs], i) => mixStereo(padBus, pad({ freqs, dur, attack: 1.7, release: 2.0, bright: 2.0, detune: 6, seed: 51 + i }), Math.max(0, at), 1));
  // The pad hushes under water and in orbit, opens on the summit and fades with the last frame.
  automate(padBus, (t) => (1 - 0.45 * smooth(T.S03_start - 0.2, T.S03_start + 0.8, t) * (1 - smooth(T.S04_start - 0.4, T.S04_start + 0.6, t)))
    * (1 - 0.3 * smooth(T.S07_start, T.S07_start + 1.0, t) * (1 - smooth(T.S08_start - 0.5, T.S08_start + 0.8, t)))
    * (1 - 0.8 * smooth(duration - 1.4, duration - 0.05, t)));
  const wetPad = reverb({ L: padBus.L.subarray(0, sec(duration)), R: padBus.R.subarray(0, sec(duration)), sr: SR }, { decay: 3.6, mix: 0.42, tail: 0.5 });
  mixStereo(music, wetPad, 0, 1.0);
  // Deep, soft swell when the air doubles (sub-bass sine, no hit).
  const swell = shape(tone(2.6, (t) => 46 + 6 * t), (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / 2.6)), 2));
  mixMono(music, swell, T.doubleIt - 0.1, 0.55, 0);
  // Glassy bells at the reveals.
  const bells = stereo(duration + 4);
  const bell = (at, name, gain = 1, pan = 0) => {
    const f = NOTE(name), len = 2.6, y = new Float32Array(sec(len));
    for (const [m, a, d] of [[1, 1, 1.6], [2.76, 0.4, 2.8], [5.4, 0.2, 4.5], [8.9, 0.09, 7]]) { const s = tone(len, f * m); for (let i = 0; i < y.length; i++) y[i] += s[i] * a * Math.exp(-(i / SR) * d); }
    mixMono(bells, shape(y, (t) => smooth(0, 0.004, t)), at, 0.15 * gain, pan);
  };
  for (const [at, n, g, p] of [[0.25, 'F#5', 0.7, -0.3], [T.crumpleEnd, 'B4', 0.6, 0.2], [T.doubleIt + 0.1, 'D5', 0.8, -0.2], [T.tenMeters, 'A4', 0.5, 0.3],
    [T.maskOff + 0.2, 'A5', 0.7, 0.2], [T.andes, 'E5', 0.6, -0.2], [T.boil120, 'F#5', 0.6, 0.25], [T.wingbeat, 'A5', 0.6, -0.25], [T.co2, 'B4', 0.45, 0.1],
    [T.deeperRed, 'D5', 0.7, 0.2], [T.everything, 'A5', 0.9, -0.1], [T.everything + 0.45, 'D6', 0.6, 0.25]]) bell(at, n, g, p);
  mixStereo(music, reverb({ L: bells.L.subarray(0, sec(duration)), R: bells.R.subarray(0, sec(duration)), sr: SR }, { decay: 3.8, mix: 0.55, tail: 0.5 }), 0, 1.0);

  // ---------------------------------------------------------------- sound effects
  const fx = stereo(duration + 4);
  const put = (mono, at, gainDb, pan = 0) => mixMono(fx, mono, at, dB(gainDb), pan);
  const n = (dur, color) => noise(sec(dur), rand, color);
  const waves = (dur, rate = 0.16) => { const y = filter(n(dur, 'pink'), 'lowpass', 900), out = new Float32Array(y.length); for (let i = 0; i < y.length; i++) { const t = i / SR; out[i] = y[i] * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t + Math.sin(t * 0.5)), 3)); } return out; };
  const wind = (dur, f = 520, gust = (t) => 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.17 * t + 1.3)) => shape(filter(n(dur, 'pink'), 'bandpass', f, 0.6), gust);
  const gull = (at, gainDb, pan) => {
    const len = 0.32 + rand() * 0.2, f0 = 1500 + rand() * 500, y = new Float32Array(sec(len));
    for (const h of [1, 2, 3]) { const s = tone(len, (t) => f0 * h * (1 - 0.35 * t / len) * (1 + 0.03 * Math.sin(2 * Math.PI * 22 * t))); for (let k = 0; k < y.length; k++) y[k] += s[k] / (h * h); }
    put(shape(filter(y, 'bandpass', 2200, 0.9), (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / len)), 1.5)), at, gainDb, pan);
  };

  // S01-S02 harbor morning: waves on the quay and distant gulls.
  const hb = T.S03_start + 0.4;
  put(shape(waves(hb), (t) => envAR(t, hb, 0.3, 0.7)), 0, -31, -0.15);
  for (const [at, p] of [[1.5, 0.6], [2.0, 0.55], [6.2, -0.5], [10.4, 0.4]]) gull(at, -36, p);
  // Plastic crumple: dense crackle with a few louder snaps as the walls cave in.
  const cd = T.crumpleEnd + 0.3 - T.crumpleStart;
  put(shape(filter(crackle(cd, 70, rand, { lo: 1800, hi: 7500 }), 'highpass', 1200), (t) => smooth(0, 0.2, t) * (0.35 + 0.65 * smooth(T.crumpleMain - T.crumpleStart - 0.2, T.crumpleMain - T.crumpleStart + 0.3, t)) * (1 - smooth(cd - 0.35, cd, t))), T.crumpleStart, -15, 0.05);
  for (const dt of [0.1, 0.55, 0.95, 1.2, 1.5, 1.7]) put(shape(filter(n(0.05, 'white'), 'bandpass', 2600 + rand() * 2000, 1.2), (t) => Math.exp(-t * 70)), T.crumpleStart + dt * (cd / 1.9), -15 - rand() * 4, (rand() - 0.5) * 0.3);

  // S03 underwater: muffled calm, regulator exhales with bubble burble.
  const ud = T.S04_start - T.S03_start + 0.6;
  put(shape(filter(n(ud, 'brown'), 'lowpass', 220), (t) => envAR(t, ud, 0.6, 0.6) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.23 * t))), T.S03_start - 0.3, -33);
  for (const ex of [T.exhale1, T.exhale2]) {
    put(shape(filter(n(1.3, 'pink'), 'lowpass', 900), (t) => envAR(t, 1.3, 0.08, 0.6)), ex, -27, 0.1);
    for (let i = 0; i < 26; i++) {   // bubble blips: short upward chirps
      const at = ex + 0.05 + rand() * 1.1, len = 0.03 + rand() * 0.05, f0 = 280 + rand() * 520;
      put(shape(tone(len, (t) => f0 * (1 + 2.2 * t / len)), (t) => Math.sin(Math.PI * Math.min(1, t / len))), at, -30 - rand() * 6, (rand() - 0.5) * 0.6);
    }
  }

  // S04 summit: thin wind, one deep breath in, a frosty exhale.
  const sd = T.S05_start - T.S04_start;
  put(shape(wind(sd, 900, (t) => 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.11 * t + 0.4)), (t) => envAR(t, sd, 0.5, 0.2)), T.S04_start, -29, 0.25);
  put(shape(filter(n(1.6, 'pink'), 'bandpass', (t) => 900 + 700 * t, 0.8), (t) => smooth(0, 1.0, t) * (1 - smooth(1.2, 1.6, t))), T.breathIn, -25, -0.05);
  put(shape(filter(n(1.3, 'pink'), 'bandpass', 650, 0.7), (t) => smooth(0, 0.15, t) * Math.exp(-t * 2.2)), T.exhaleVapor, -27, -0.05);

  // S05 kitchen: gas hiss, then bubbling that rises to a rolling boil.
  const kd = T.S06_start - T.S05_start + 0.3;
  put(shape(filter(n(kd, 'white'), 'highpass', 3500), (t) => envAR(t, kd, 0.2, 0.5)), T.S05_start, -36, 0.1);
  const boilT0 = T.boil100 - 0.3, bd = T.S06_start + 0.3 - boilT0;
  const boilEnv = (t) => { const a = t + boilT0; return 0.12 + 0.88 * smooth(T.boil120, T.boilFull, a); };
  put(shape(filter(crackle(bd, 90, rand, { lo: 180, hi: 900 }), 'lowpass', 1600), (t) => boilEnv(t) * (1 - smooth(bd - 0.4, bd, t))), boilT0, -24, -0.05);
  put(shape(filter(n(bd, 'brown'), 'lowpass', 380), (t) => smooth(T.boil120 - boilT0, T.boilFull - boilT0, t) * (1 - smooth(bd - 0.4, bd, t))), boilT0, -33);

  // S06 cliff: wind that pushes harder after "twice as hard", distant surf, gulls on the updraft.
  const cl = T.S07_start - T.S06_start + 0.4;
  put(shape(wind(cl, 480, (t) => (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.19 * t)) * (0.7 + 0.6 * smooth(T.twiceHard - T.S06_start, T.twiceHard - T.S06_start + 0.8, t))), (t) => envAR(t, cl, 0.4, 0.7)), T.S06_start - 0.2, -26, -0.2);
  put(shape(waves(cl, 0.12), (t) => envAR(t, cl, 0.5, 0.7)), T.S06_start - 0.2, -34, 0.2);
  for (const [dt, p] of [[0.15, -0.4], [0.6, -0.25], [2.1, 0.3]]) gull(T.wingbeat + dt, -31, p);

  // S07 orbit: near silence with a faint high shimmer.
  const od = T.S08_start - T.S07_start;
  const shimmer = new Float32Array(sec(od)); for (const f of [2640, 3310, 3960]) { const s = tone(od, f); for (let i = 0; i < shimmer.length; i++) shimmer[i] += s[i] * (0.5 + 0.5 * Math.sin(2 * Math.PI * (0.13 + f / 40000) * i / SR)); }
  put(shape(shimmer, (t) => envAR(t, od, 1.0, 1.0)), T.S07_start, -44, 0.1);

  // S08 sunset cliff: slow surf below, the wind dropping.
  const ss = T.S09_start - T.S08_start + 0.4;
  put(shape(waves(ss, 0.1), (t) => envAR(t, ss, 0.6, 0.6)), T.S08_start - 0.2, -31, -0.1);
  put(shape(wind(ss, 420), (t) => envAR(t, ss, 0.5, 0.6) * (1 - 0.6 * smooth(0, ss, t))), T.S08_start - 0.2, -34, 0.3);

  // S09 evening harbor: waves on the quay and a distant halyard tapping a mast.
  const eh = duration - T.S09_start;
  put(shape(waves(eh, 0.14), (t) => envAR(t, eh, 0.5, 1.2)), T.S09_start, -32, 0.1);
  for (let at = T.S09_start + 0.8; at < duration - 1.5; at += 1.7 + rand() * 1.1) {
    const y = new Float32Array(sec(0.4)); for (const [f, a, d] of [[1240, 1, 18], [2930, 0.4, 26]]) { const s = tone(0.4, f); for (let i = 0; i < y.length; i++) y[i] += s[i] * a * Math.exp(-(i / SR) * d); }
    put(y, at, -40, 0.55);
  }

  const wetFx = reverb({ L: fx.L.subarray(0, sec(duration)), R: fx.R.subarray(0, sec(duration)), sr: SR }, { decay: 1.3, mix: 0.16, tail: 0.3 });
  mixStereo(sfx, wetFx, 0, 1);
  return { music, sfx };
}
