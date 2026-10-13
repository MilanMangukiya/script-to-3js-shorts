import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, crackle, dB, smooth } from '../../library/audio/synth.mjs';

// Cue times come from the storyboard so the sound always follows the picture's scene windows.
const story = JSON.parse(fs.readFileSync(new URL('../../../stories/continents-one-landmass.json', import.meta.url), 'utf8'));
const S = Object.fromEntries(story.scenes.map((sc) => [sc.id, sc]));
const shot = (key) => { const [a, b] = key.split('/'); return S[a].shots.find((x) => x.id === b); };
const at = (key, f) => { const w = key.includes('/') ? shot(key) : S[key]; return w.start_s + f * (w.end_s - w.start_s); };

/** Felt-piano note: soft hammer, quick bloom, long exponential decay, a little second harmonic. */
function felt(note, dur = 3.0) {
  const f = NOTE(note), a = tone(dur, f), b = tone(dur, f * 2.003), y = new Float32Array(a.length);
  for (let i = 0; i < y.length; i++) { const t = i / SR; y[i] = (a[i] + 0.2 * b[i] * Math.exp(-t * 3)) * Math.exp(-t * 1.6) * (1 - Math.exp(-t * 140)); }
  return y;
}
/** Band-limited noise shaped by an envelope g(t) in absolute film time. */
function band(duration, random, g, lo, hi, color = 'pink') {
  const x = filter(filter(noise(Math.ceil(duration * SR), random, color), 'highpass', lo), 'lowpass', hi);
  for (let i = 0; i < x.length; i++) x[i] *= g(i / SR);
  return x;
}

/** Original C-minor ambient score and tectonic, weather and reef sound design (all synthesized). */
export function buildSoundtrack(duration) {
  const music = stereo(duration), sfx = stereo(duration), random = rng(52013);
  const win = (a, b, fadeIn = 0.4, fadeOut = 0.4) => (t) => smooth(a - fadeIn, a, t) * (1 - smooth(b, b + fadeOut, t));

  // ---- Music: pads follow the scenes; a warm Ab when the pieces lock, open Eb under the reef, bare fifths for the
  // brutal future, and C major to resolve as today's map returns.
  const chords = [
    [0.8, S.S01.end_s + 0.4, ['C2', 'G2', 'C3', 'Eb3', 'G3'], 0.18],
    [S.S02.start_s, S.S02.end_s, ['Ab1', 'Eb2', 'Ab2', 'C3', 'Eb3', 'G3'], 0.26],
    [S.S03.start_s, shot('S03/SH02').start_s, ['Eb2', 'Bb2', 'Eb3', 'G3', 'Bb3'], 0.24],
    [shot('S03/SH02').start_s, S.S03.end_s, ['Bb1', 'F2', 'Bb2', 'D3', 'F3'], 0.22],
    [S.S04.start_s, shot('S04/SH02').start_s, ['C2', 'G2', 'Eb3', 'G3', 'Bb3'], 0.22],
    [shot('S04/SH02').start_s, S.S04.end_s, ['Ab1', 'Eb2', 'C3', 'G3'], 0.22],
    [S.S05.start_s, shot('S05/SH02').start_s, ['F2', 'C3', 'F3', 'Ab3', 'C4'], 0.2],
    [shot('S05/SH02').start_s, S.S05.end_s, ['Db2', 'Ab2', 'Db3', 'F3'], 0.2],
    [S.S06.start_s, at('S06', 0.55), ['Ab1', 'Eb2', 'Ab2', 'C3', 'Eb3'], 0.22],
    [at('S06', 0.55), S.S06.end_s, ['F2', 'C3', 'F3', 'Ab3'], 0.22],
    [S.S07.start_s, S.S07.end_s, ['Eb2', 'Bb2', 'Eb3', 'G3', 'Bb3', 'D4'], 0.24],
    [S.S08.start_s, S.S08.end_s, ['C2', 'G2', 'C3', 'G3'], 0.24],
    [S.S09.start_s, duration, ['C2', 'G2', 'C3', 'E3', 'G3', 'C4'], 0.3],
  ];
  chords.forEach(([a, b, notes, g], i) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + 1.6, attack: 1.3, release: 1.8, bright: 1.5, detune: 5, seed: 31 + i }), a, g));
  // Sparse felt-piano notes in C minor; a falling pair under "vanished", a rising close in C major.
  const notes = [[1.2, 'G4'], [3.1, 'Eb5'], [5.4, 'C5'], [7.6, 'G5'], [9.6, 'Eb5'], [10.4, 'Ab5'], [13.2, 'Bb4'], [15.9, 'G5'], [18.6, 'F5'], [20.4, 'D5'],
    [22.6, 'G4'], [25.0, 'Eb5'], [27.6, 'C5'], [30.0, 'G4'], [37.2, 'Ab4'], [39.6, 'F4'], [41.6, 'Eb5'], [44.0, 'C5'], [at('S06', 0.62), 'Ab4'], [at('S06', 0.7), 'F4'],
    [52.0, 'Bb4'], [53.8, 'G5'], [55.6, 'Eb5'], [57.4, 'D5'], [60.2, 'G4'], [63.0, 'C5'], [69.4, 'G4'], [71.2, 'C5'], [72.6, 'E5'], [73.8, 'G5']];
  notes.forEach(([t, n], i) => mixMono(music, felt(n), t, i === 0 ? 0.08 : 0.055, ((i % 5) - 2) * 0.18));

  // ---- Tectonic rumble: deep grinding while the plates move (S01–S02, the seam close-up, the drift back in S09).
  const rumbleEnv = (t) => win(at('S01', 0.25), S.S02.start_s + 4.8, 0.8, 1.2)(t) * 0.9 + win(S.S03.start_s, at('S03/SH01', 0.72), 0.3, 0.3)(t) * 0.55
    + win(S.S09.start_s + 0.2, at('S09', 0.8), 0.6, 1.6)(t) * 0.8;
  const rumble = band(duration, random, (t) => rumbleEnv(t) * (0.6 + 0.4 * Math.sin(t * 1.3) * Math.sin(t * 0.37)), 25, 140, 'brown');
  mixMono(sfx, rumble, 0, dB(-15), 0);
  const grind = crackle(duration, 9, random, { lo: 180, hi: 700 });
  for (let i = 0; i < grind.length; i++) grind[i] *= rumbleEnv(i / SR);
  mixMono(sfx, grind, 0, dB(-22), -0.1);
  // A faint space hum under the opening.
  mixMono(sfx, band(duration, random, (t) => (1 - smooth(S.S01.end_s - 1, S.S01.end_s + 0.5, t)) * 0.5, 60, 300, 'brown'), 0, dB(-26), 0);
  // Pieces lock: a soft low thud when the supercontinent completes, and a click as the coasts meet in the close-up.
  const thud = (len, f0, f1) => shape(tone(len, (t) => f0 + (f1 - f0) * Math.min(1, t / len)), (t) => Math.exp(-t * 7) * (1 - Math.exp(-t * 300)));
  mixMono(sfx, thud(1.2, 62, 40), at('S02', 0.6), dB(-14), 0);
  const click = shape(filter(noise(Math.ceil(0.09 * SR), random, 'white'), 'bandpass', 1500, 1.4), (t) => Math.exp(-t * 60) * (1 - Math.exp(-t * 900)));
  mixMono(sfx, click, at('S03/SH01', 0.7), dB(-15), 0.05); mixMono(sfx, thud(0.6, 90, 60), at('S03/SH01', 0.7), dB(-16), 0);

  // ---- Winds: soft ocean wind over the moisture streams; hollow dry wind in the desert shots.
  const ocean = shot('S04/SH01'), dune = shot('S04/SH02'), walk = shot('S05/SH02'), hot = shot('S08/SH02');
  mixMono(sfx, band(duration, random, (t) => win(ocean.start_s, ocean.end_s, 0.3, 0.3)(t) * (0.6 + 0.4 * Math.sin(t * 0.8)), 250, 1400), 0, dB(-21), -0.2);
  const dryEnv = (t) => win(dune.start_s, dune.end_s, 0.3, 0.3)(t) + win(walk.start_s, walk.end_s, 0.3, 0.3)(t) * (1 - 0.75 * smooth(at('S05/SH02', 0.3), at('S05/SH02', 0.9), t))
    + win(hot.start_s, hot.end_s, 0.3, 0.3)(t) * 0.55;
  const whistle = filter(noise(Math.ceil(duration * SR), random, 'pink'), 'bandpass', (t) => 520 + 260 * Math.sin(t * 0.45) + 120 * Math.sin(t * 1.7), 4);
  for (let i = 0; i < whistle.length; i++) whistle[i] *= dryEnv(i / SR);
  mixMono(sfx, whistle, 0, dB(-15), 0.15);
  mixMono(sfx, band(duration, random, dryEnv, 120, 900, 'brown'), 0, dB(-19), -0.1);

  // ---- Monsoon coast: heavy rain, gusts, a lightning crack and rolling thunder.
  const coast = shot('S05/SH01'), rainEnv = win(coast.start_s, coast.end_s, 0.25, 0.35);
  mixMono(sfx, band(duration, random, rainEnv, 900, 7500), 0, dB(-22), -0.2);
  mixMono(sfx, band(duration, random, rainEnv, 1400, 9000), 0, dB(-25), 0.25);
  const drops = crackle(duration, 70, random, { lo: 1600, hi: 6000 });
  for (let i = 0; i < drops.length; i++) drops[i] *= rainEnv(i / SR);
  mixMono(sfx, drops, 0, dB(-26), 0.1);
  mixMono(sfx, band(duration, random, (t) => rainEnv(t) * Math.pow(0.5 + 0.5 * Math.sin(t * 0.9), 2), 80, 600, 'brown'), 0, dB(-23), 0);
  const flash = at('S05/SH01', 0.45);
  mixMono(sfx, shape(filter(noise(Math.ceil(0.5 * SR), random, 'white'), 'highpass', 900), (t) => Math.exp(-t * 14) * (1 - Math.exp(-t * 600))), flash + 0.05, dB(-20), -0.3);
  mixMono(sfx, shape(filter(noise(Math.ceil(3.2 * SR), random, 'brown'), 'lowpass', 220), (t) => envAR(t, 3.2, 0.15, 2.4) * (0.7 + 0.3 * Math.sin(t * 9) * Math.sin(t * 3.1))), flash + 0.35, dB(-16), -0.1);

  // ---- The traveller: soft footsteps in sand, then a few faint crickets once night falls.
  for (let k = 0; ; k++) {
    const t = walk.start_s + 0.2 + k * 0.526; if (t > walk.end_s - 0.1) break;
    const step = shape(filter(noise(Math.ceil(0.14 * SR), random, 'pink'), 'bandpass', 1100 + 300 * (k % 2), 1.1), (u) => Math.exp(-u * 30) * (1 - Math.exp(-u * 250)));
    mixMono(sfx, step, t, dB(-25), -0.15);
  }
  for (let k = 0; k < 7; k++) {
    const t = at('S05/SH02', 0.72) + k * 0.33 + (k % 2) * 0.05;
    const chirp = shape(tone(0.09, 4300 + (k % 3) * 120), (u) => envAR(u, 0.09, 0.01, 0.04) * (0.5 + 0.5 * Math.sin(u * 2 * Math.PI * 45)));
    mixMono(sfx, chirp, t, dB(-33), 0.4);
  }

  // ---- Tabletop: gentle wooden taps as the animal tokens cross the land bridge.
  const table = S.S06, taps = crackle(duration, 7, random, { lo: 700, hi: 2200 });
  for (let i = 0; i < taps.length; i++) { const t = i / SR; taps[i] *= win(at('S06', 0.12), at('S06', 0.55), 0.4, 0.6)(t); }
  mixMono(sfx, taps, 0, dB(-22), 0);
  mixMono(sfx, band(duration, random, win(table.start_s, table.end_s, 0.4, 0.4), 150, 500, 'brown'), 0, dB(-30), 0);

  // ---- Reef: muffled underwater wash with slow surges and a few rising bubbles.
  const reef = S.S07, reefEnv = win(reef.start_s, reef.end_s, 0.4, 0.5);
  mixMono(sfx, band(duration, random, (t) => reefEnv(t) * (0.65 + 0.35 * Math.sin(t * 0.7)), 40, 420, 'brown'), 0, dB(-18), 0);
  for (const [t0, pan] of [[0.15, -0.3], [0.3, 0.2], [0.42, 0.35], [0.6, -0.2], [0.78, 0.1]]) {
    for (let k = 0; k < 4; k++) {
      const len = 0.07 + 0.03 * (k % 2), f0 = 380 + 160 * k;
      mixMono(sfx, shape(tone(len, (u) => f0 + 900 * u / len), (u) => envAR(u, len, 0.008, 0.05)), at('S07', t0) + k * 0.11, dB(-27), pan);
    }
  }

  // ---- The brutal future: a low tense swell into the hot globe, dry heat crackle by the thermometer.
  const s08 = S.S08;
  mixMono(sfx, band(duration, random, (t) => win(s08.start_s, at('S08/SH01', 0.9), 0.6, 0.8)(t) * smooth(s08.start_s, at('S08/SH01', 0.8), t), 40, 260, 'brown'), 0, dB(-14), 0);
  const heat = crackle(duration, 18, random, { lo: 2200, hi: 7000 });
  for (let i = 0; i < heat.length; i++) { const t = i / SR; heat[i] *= win(at('S08/SH01', 0.5), hot.end_s, 0.6, 0.4)(t); }
  mixMono(sfx, heat, 0, dB(-21), 0.2);
  mixMono(sfx, band(duration, random, (t) => win(hot.start_s, hot.end_s, 0.4, 0.4)(t) * (0.6 + 0.4 * Math.sin(t * 7.3)), 3000, 8000), 0, dB(-31), -0.2);

  automate(music, (t) => smooth(0, 0.8, t) * (t > duration - 1.2 ? 1 - (t - (duration - 1.2)) / 1.2 * 0.6 : 1));
  automate(sfx, (t) => (t > duration - 0.8 ? 1 - (t - (duration - 0.8)) / 0.8 : 1));
  return { music, sfx };
}
