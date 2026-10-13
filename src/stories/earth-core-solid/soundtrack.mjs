import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, crackle, dB, smooth } from '../../library/audio/synth.mjs';

// Cue times come from the storyboard so the sound always follows the picture's scene windows.
const story = JSON.parse(fs.readFileSync(new URL('../../../stories/earth-core-solid.json', import.meta.url), 'utf8'));
const S = Object.fromEntries(story.scenes.map((sc) => [sc.id, sc]));
const shot = (key) => { const [a, b] = key.split('/'); return S[a].shots.find((x) => x.id === b); };
const at = (key, f) => { const w = key.includes('/') ? shot(key) : S[key]; return w.start_s + f * (w.end_s - w.start_s); };

/** Felt-piano note: soft hammer, quick bloom, long decay, a little second harmonic. */
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

/** Original D-minor score with a molten drone, glassy freeze and field shimmer, and per-scene sound design. */
export function buildSoundtrack(duration) {
  const music = stereo(duration), sfx = stereo(duration), random = rng(61021);
  const win = (a, b, fadeIn = 0.4, fadeOut = 0.4) => (t) => smooth(a - fadeIn, a, t) * (1 - smooth(b, b + fadeOut, t));

  // ---- Music: pads per scene; open fifths for the frozen core, D major as the molten core returns.
  const chords = [
    [0.6, S.S01.end_s + 0.4, ['D2', 'A2', 'D3', 'F3', 'A3'], 0.2],
    [S.S02.start_s, S.S02.end_s, ['Bb1', 'F2', 'Bb2', 'D3', 'F3', 'A3'], 0.24],
    [S.S03.start_s, S.S03.end_s, ['G2', 'D3', 'G3', 'Bb3', 'D4'], 0.22],
    [S.S04.start_s, S.S04.end_s, ['F2', 'C3', 'F3', 'A3', 'C4'], 0.22],
    [S.S05.start_s, S.S05.end_s, ['D2', 'A2', 'E3', 'F3', 'A3'], 0.22],
    [S.S06.start_s, shot('S06/SH02').start_s, ['C2', 'G2', 'C3', 'E3', 'G3'], 0.22],
    [shot('S06/SH02').start_s, S.S06.end_s, ['A1', 'E2', 'A2', 'C#3', 'E3'], 0.22],
    [S.S07.start_s, duration, ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'], 0.3],
  ];
  chords.forEach(([a, b, notes, g], i) => mixStereo(music, pad({ freqs: notes.map(NOTE), dur: b - a + 1.6, attack: 1.3, release: 1.8, bright: 1.4, detune: 5, seed: 41 + i }), a, g));
  const notes = [[1.0, 'A4'], [2.8, 'F5'], [5.6, 'D5'], [8.2, 'A4'], [10.6, 'F5'], [14.6, 'D5'], [16.8, 'G5'], [19.4, 'Bb4'], [22.4, 'A4'], [24.6, 'C5'],
    [28.4, 'E5'], [31.0, 'A4'], [34.0, 'F4'], [38.2, 'G4'], [40.6, 'E5'], [42.4, 'C#5'], [45.2, 'A4'], [47.6, 'D5'], [50.2, 'F#5'], [52.4, 'A5']];
  notes.forEach(([t, n], i) => mixMono(music, felt(n), t, i === 0 ? 0.08 : 0.055, ((i % 5) - 2) * 0.18));

  // ---- Molten churn: a deep viscous roar whenever the core is liquid; it thins away as the core freezes.
  const s01 = S.S01, s03 = S.S03, s07 = S.S07;
  const churnEnv = (t) => win(0, s01.end_s, 0.01, 0.3)(t) * (1 - smooth(at('S01', 0.3), at('S01', 0.95), t)) + win(S.S02.start_s, S.S02.end_s, 0.4, 0.2)(t)
    + win(s03.start_s, s03.end_s, 0.2, 0.3)(t) * (1 - smooth(at('S03', 0.55), at('S03', 0.9), t)) + win(s07.start_s, duration, 0.6, 0.01)(t) * 0.9;
  mixMono(sfx, band(duration, random, (t) => churnEnv(t) * (0.65 + 0.35 * Math.sin(t * 1.1) * Math.sin(t * 0.43)), 25, 160, 'brown'), 0, dB(-18.5), 0);
  const bubbles = crackle(duration, 6, random, { lo: 120, hi: 500 });
  for (let i = 0; i < bubbles.length; i++) bubbles[i] *= churnEnv(i / SR);
  mixMono(sfx, bubbles, 0, dB(-24), -0.1);

  // ---- Freeze: glassy crackling and a falling shimmer as the front sweeps out (S01, S03).
  const freezeEnv = (t) => win(at('S01', 0.3), at('S01', 0.95), 0.3, 0.4)(t) + win(at('S03', 0.55), at('S03', 0.9), 0.3, 0.4)(t);
  const ice = crackle(duration, 30, random, { lo: 2500, hi: 8500 });
  for (let i = 0; i < ice.length; i++) ice[i] *= freezeEnv(i / SR);
  mixMono(sfx, ice, 0, dB(-21), 0.15);
  for (const [a, b] of [[at('S01', 0.3), at('S01', 0.95)], [at('S03', 0.55), at('S03', 0.9)]]) {
    const len = b - a, sweep = shape(tone(len, (u) => 2400 - 1500 * (u / len)), (u) => envAR(u, len, 0.4, 0.8) * (0.6 + 0.4 * Math.sin(u * 2 * Math.PI * 6)));
    mixMono(sfx, sweep, a, dB(-34), -0.2);
  }

  // ---- The field: a soft electrical shimmer that blooms with the field lines and dies with them; it returns at the end.
  const fieldEnv = (t) => win(at('S03', 0.02), at('S03', 0.55), 0.5, 1.2)(t) + win(at('S07', 0.35), duration, 1.2, 0.01)(t) * 0.8 + win(0, at('S01', 0.4), 0.01, 1.2)(t) * 0.6;
  for (const f of [1180, 1770, 2360]) {
    const sh = tone(duration, f + 3 * Math.sin(f));
    for (let i = 0; i < sh.length; i++) { const t = i / SR; sh[i] *= fieldEnv(t) * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * (4 + f / 900))); }
    mixMono(sfx, sh, 0, dB(-40), f > 2000 ? 0.3 : -0.2);
  }

  // ---- Compass: tiny metallic ticks as the needle wanders.
  const cs = shot('S04/SH01');
  for (let k = 0; k < 9; k++) {
    const t = cs.start_s + 0.5 + k * 0.23 + 0.06 * Math.sin(k * 2.7);
    if (t > cs.end_s - 0.1) break;
    mixMono(sfx, shape(filter(noise(Math.ceil(0.04 * SR), random, 'white'), 'bandpass', 4200, 3), (u) => Math.exp(-u * 160)), t, dB(-30), 0.1);
  }
  // ---- Sea wind and wingbeats; underwater flow.
  const sea = shot('S04/SH02'), fish = shot('S04/SH03');
  mixMono(sfx, band(duration, random, win(sea.start_s, sea.end_s, 0.25, 0.2), 300, 2500), 0, dB(-24), -0.2);
  for (let k = 0; k < 6; k++) {
    const t = sea.start_s + 0.2 + k * 0.26; if (t > sea.end_s) break;
    mixMono(sfx, shape(filter(noise(Math.ceil(0.12 * SR), random, 'pink'), 'bandpass', 380, 1.2), (u) => envAR(u, 0.12, 0.03, 0.08)), t, dB(-32), 0.25);
  }
  mixMono(sfx, band(duration, random, (t) => win(fish.start_s, fish.end_s, 0.2, 0.3)(t) * (0.7 + 0.3 * Math.sin(t * 0.9)), 40, 380, 'brown'), 0, dB(-17), 0);

  // ---- Polar night: still cold air and a faint high shimmer that fades with the aurora.
  const night = shot('S05/SH01');
  mixMono(sfx, band(duration, random, win(night.start_s, night.end_s, 0.3, 0.3), 200, 1200), 0, dB(-30), 0);
  const aur = tone(duration, 2960);
  for (let i = 0; i < aur.length; i++) { const t = i / SR; aur[i] *= win(night.start_s, night.end_s, 0.3, 0.2)(t) * (1 - smooth(at('S05/SH01', 0.25), at('S05/SH01', 0.9), t)) * (0.5 + 0.5 * Math.sin(t * 5.1)); }
  mixMono(sfx, aur, 0, dB(-42), 0.3);

  // ---- Solar wind: soft continuous rushing past the planets.
  const windEnv = win(shot('S05/SH02').start_s, S.S05.end_s, 0.4, 0.4);
  mixMono(sfx, band(duration, random, (t) => windEnv(t) * (0.6 + 0.4 * Math.sin(t * 0.7)), 350, 3200), 0, dB(-25), -0.25);
  mixMono(sfx, band(duration, random, windEnv, 600, 5200, 'white'), 0, dB(-36), 0.25);

  // ---- Volcano: deep rumble with lava bursts; then a slow grinding churn for the mantle.
  const vol = shot('S06/SH01'), mantle = shot('S06/SH02'), volEnv = win(vol.start_s, vol.end_s, 0.3, 0.4);
  mixMono(sfx, band(duration, random, (t) => volEnv(t) * (0.7 + 0.3 * Math.sin(t * 2.3)), 20, 140, 'brown'), 0, dB(-17.5), 0);
  const lava = crackle(duration, 12, random, { lo: 300, hi: 2400 });
  for (let i = 0; i < lava.length; i++) lava[i] *= volEnv(i / SR);
  mixMono(sfx, lava, 0, dB(-22), 0.1);
  for (const f of [0.15, 0.45, 0.75]) mixMono(sfx, shape(filter(noise(Math.ceil(0.6 * SR), random, 'brown'), 'lowpass', 300), (u) => Math.exp(-u * 6) * (1 - Math.exp(-u * 200))), at('S06/SH01', f), dB(-19), 0);
  const grind = crackle(duration, 7, random, { lo: 150, hi: 600 });
  for (let i = 0; i < grind.length; i++) grind[i] *= win(mantle.start_s, mantle.end_s, 0.4, 0.4)(i / SR);
  mixMono(sfx, grind, 0, dB(-24), -0.1);
  mixMono(sfx, band(duration, random, win(mantle.start_s, mantle.end_s, 0.4, 0.4), 30, 200, 'brown'), 0, dB(-19), 0);

  automate(music, (t) => smooth(0, 0.8, t) * (t > duration - 1.2 ? 1 - (t - (duration - 1.2)) / 1.2 * 0.6 : 1));
  automate(sfx, (t) => (t > duration - 0.8 ? 1 - (t - (duration - 0.8)) / 0.8 : 1));
  return { music, sfx };
}
