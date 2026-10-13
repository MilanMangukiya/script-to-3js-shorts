import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, crackle, dB, smooth } from '../../library/audio/synth.mjs';

// Cue times come from the storyboard so the sound always follows the picture's scene windows.
const story = JSON.parse(fs.readFileSync(new URL('../../../stories/rain-nonstop-everywhere.json', import.meta.url), 'utf8'));
const S = Object.fromEntries(story.scenes.map((sc) => [sc.id, sc]));
const shot = (key) => { const [a, b] = key.split('/'); return S[a].shots.find((x) => x.id === b); };

/** Felt-piano drop: soft hammer, quick bloom, long exponential decay, a little second harmonic. */
function drop(note, dur = 2.6) {
  const f = NOTE(note), a = tone(dur, f), b = tone(dur, f * 2.002), y = new Float32Array(a.length);
  for (let i = 0; i < y.length; i++) { const t = i / SR; y[i] = (a[i] + 0.22 * b[i] * Math.exp(-t * 3)) * Math.exp(-t * 1.9) * (1 - Math.exp(-t * 160)); }
  return y;
}

/** Band of rain hiss with an envelope g(t) in absolute film time. */
function hiss(duration, random, g, { lo = 1100, hi = 7000, color = 'pink' } = {}) {
  const x = filter(filter(noise(Math.ceil(duration * SR), random, color), 'highpass', lo), 'lowpass', hi);
  for (let i = 0; i < x.length; i++) x[i] *= g(i / SR);
  return x;
}

/** Original D-minor ambient score and gentle rain sound design (all synthesized). */
export function buildSoundtrack(duration) {
  const music = stereo(duration), sfx = stereo(duration), random = rng(41107);
  const win = (a, b, fadeIn = 0.4, fadeOut = 0.4) => (t) => smooth(a - fadeIn, a, t) * (1 - smooth(b, b + fadeOut, t));

  // ---- Music: pads follow the scenes; F major lifts the greening Sahara, bare fifths carry the twist, D major resolves.
  const chords = [
    [0.7, S.S01.end_s + 0.6, ['D2', 'A2', 'D3', 'F3', 'A3']],
    [S.S02.start_s, S.S02.end_s, ['Bb1', 'F2', 'Bb2', 'D3', 'F3']],
    [S.S03.start_s, S.S03.end_s, ['G2', 'D3', 'G3', 'Bb3']],
    [S.S04.start_s, shot('S04/SH02').start_s, ['D2', 'A2', 'D3', 'F3', 'C4']],
    [shot('S04/SH02').start_s, S.S04.end_s, ['Bb1', 'F2', 'D3', 'F3', 'A3']],
    [S.S05.start_s, S.S05.end_s, ['F2', 'C3', 'F3', 'A3', 'C4']],
    [S.S06.start_s, S.S06.end_s, ['C2', 'G2', 'C3', 'E3', 'G3']],
    [S.S07.start_s, S.S07.end_s, ['D2', 'A2', 'D3', 'F3', 'A3']],
    [S.S08.start_s, S.S08.end_s, ['D2', 'A2', 'D3', 'A3']],
    [S.S09.start_s, duration, ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4']],
  ];
  chords.forEach(([a, b, notes], i) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + 1.6, attack: 1.4, release: 1.8, bright: 1.6, detune: 5, seed: 11 + i }), a, i === 5 || i === 9 ? 0.3 : 0.24));
  // Piano drops: the first lands with the opening raindrop; sparse in space, denser in the rain.
  const drops = [[0.6, 'D5'], [2.3, 'A4'], [3.6, 'F5'], [6.2, 'C5'], [9.8, 'A4'], [14.4, 'G5'], [16.6, 'D5'], [18.3, 'A5'], [22.4, 'F5'], [25.0, 'C5'], [29.4, 'A5'], [30.6, 'G5'], [31.9, 'F5'], [33.0, 'D5'],
    [35.6, 'C5'], [38.4, 'F5'], [40.3, 'A5'], [42.2, 'C6'], [45.8, 'G5'], [48.6, 'E5'], [52.6, 'D5'], [55.0, 'A4'], [57.8, 'F5'], [59.8, 'D5'], [63.8, 'A4'], [68.4, 'D5'], [71.6, 'F#5'], [73.4, 'A5'], [74.4, 'D6']];
  drops.forEach(([at, n], i) => mixMono(music, drop(n), at, i === 0 ? 0.11 : 0.06, ((i % 5) - 2) * 0.18));

  // ---- Rain hiss: builds in S01, steady drizzle in the ground-level scenes, thinning in S08, fading out in S09.
  const s01 = S.S01, s05 = S.S05, s07 = S.S07, s09 = S.S09, s08b = shot('S08/SH02'), glass = shot('S04/SH02'), sea = shot('S04/SH01');
  const rainEnv = (t) =>
    smooth(s01.start_s + 1.0, s01.start_s + 3.8, t) * (1 - smooth(s01.end_s - 0.25, s01.end_s, t)) * 0.9
    + win(s05.start_s, s05.end_s, 0.2, 0.3)(t) * 0.55
    + win(s07.start_s, s07.end_s, 0.3, 0.3)(t) * 0.65
    + win(s08b.start_s, s08b.end_s, 0.3, 0.3)(t) * (0.7 - 0.55 * smooth(s08b.start_s, s08b.end_s, t))
    + win(s09.start_s, s09.start_s + 1.6, 0.3, 0.6)(t) * 0.45
    + win(sea.start_s, sea.end_s, 0.3, 0.3)(t) * 0.35;
  const rain = hiss(duration, random, rainEnv);
  mixMono(sfx, rain, 0, dB(-21), -0.15); mixMono(sfx, hiss(duration, random, rainEnv, { lo: 1400, hi: 8000 }), 0, dB(-23), 0.2);
  // Drizzle ticks on sand, glass and wood, panels.
  const tickEnv = (t) => smooth(s01.start_s + 0.9, s01.start_s + 3.5, t) * (1 - smooth(s01.end_s - 0.2, s01.end_s, t)) + win(glass.start_s, glass.end_s)(t) * 1.4
    + win(s05.start_s, s05.end_s)(t) * 0.5 + win(shot('S07/SH02').start_s, s07.end_s)(t) * 1.2 + win(s08b.start_s, s08b.end_s)(t) * (1 - 0.8 * smooth(s08b.start_s, s08b.end_s, t));
  const ticks = crackle(duration, 26, random, { lo: 1800, hi: 6500 });
  for (let i = 0; i < ticks.length; i++) ticks[i] *= tickEnv(i / SR);
  mixMono(sfx, filter(ticks, 'highpass', 900), 0, dB(-17), 0.1);
  // The first drop's tiny tap on dry sand.
  const tap = shape(filter(noise(Math.ceil(0.12 * SR), random, 'white'), 'bandpass', 1900, 1.2), (t) => Math.exp(-t * 55) * (1 - Math.exp(-t * 900)));
  mixMono(sfx, tap, s01.start_s + 0.6, dB(-14), 0);
  // Near-silent dry wind before the rain.
  mixMono(sfx, hiss(duration, random, (t) => (1 - smooth(0.4, 2.2, t)) * 0.6, { lo: 200, hi: 1400 }), 0, dB(-26), 0);

  // ---- Space: a low airy swell as the cloud shell closes; a reversed swell into the twist.
  const sh2 = shot('S02/SH02');
  mixMono(sfx, hiss(duration, random, (t) => win(sh2.start_s, sh2.end_s, 0.2, 0.5)(t) * smooth(sh2.start_s, sh2.end_s, t), { lo: 120, hi: 900, color: 'brown' }), 0, dB(-12), 0);
  const tw = S.S08.start_s;
  mixMono(sfx, hiss(duration, random, (t) => (t > tw - 1.2 && t < tw + 0.15 ? Math.pow(smooth(tw - 1.2, tw + 0.1, t), 3) : 0), { lo: 300, hi: 5000 }), 0, dB(-17), 0);

  // ---- S03: soft pattering while the column rains out.
  const c0 = S.S03.start_s + 3.3, c1 = S.S03.start_s + 5.8;
  const pat = crackle(duration, 40, random, { lo: 1200, hi: 4200 });
  for (let i = 0; i < pat.length; i++) { const t = i / SR; pat[i] *= smooth(c0 - 0.2, c0 + 0.6, t) * (1 - smooth(c1 - 0.6, c1 + 0.4, t)); }
  mixMono(sfx, pat, 0, dB(-19), -0.1);

  // ---- S04: sea wash under distant rain.
  const wash = filter(noise(Math.ceil(duration * SR), random, 'pink'), 'lowpass', 520);
  for (let i = 0; i < wash.length; i++) { const t = i / SR, w = win(sea.start_s, sea.end_s)(t) + win(s08b.start_s, s08b.end_s)(t) * 0.8; wash[i] *= w * (0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.9), 2)); }
  mixMono(sfx, wash, 0, dB(-14), -0.1);

  // ---- S05: a faint far bird as the Sahara greens.
  for (const [at, f0] of [[s05.start_s + 8.0, 3600], [s05.start_s + 8.25, 4100], [s05.start_s + 8.7, 3800]]) {
    const chirp = shape(tone(0.16, (t) => f0 + 1400 * Math.sin(Math.PI * t / 0.16)), (t) => envAR(t, 0.16, 0.02, 0.08));
    mixMono(sfx, chirp, at, dB(-31), 0.45);
  }

  // ---- S06: soft liquid fill (left) and drain (right) in the gauges.
  const g0 = S.S06.start_s;
  for (const [a, b, up, pan] of [[g0 + 0.85, g0 + 3.85, 1, -0.55], [g0 + 1.7, g0 + 4.7, -1, 0.55]]) {
    const len = b - a, x = filter(noise(Math.ceil(len * SR), random, 'white'), 'bandpass', (t) => (up > 0 ? 500 + 900 * t / len : 1400 - 900 * t / len), 3);
    const gl = crackle(len, 22, random, { lo: 500, hi: 1500 });
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (x[i] * 0.6 + gl[i]) * envAR(t, len, 0.4, 0.7); }
    mixMono(sfx, x, a, dB(-18), pan);
  }

  automate(music, (t) => smooth(0, 0.6, t) * (t > duration - 1.2 ? 1 - (t - (duration - 1.2)) / 1.2 * 0.6 : 1));
  automate(sfx, (t) => (t > duration - 0.8 ? 1 - (t - (duration - 0.8)) / 0.8 : 1));
  return { music, sfx };
}
