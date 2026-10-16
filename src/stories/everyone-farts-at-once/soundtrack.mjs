import fs from 'node:fs';
import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, dB, smooth, reverb } from '../../library/audio/synth.mjs';
import { applyPreImpactVacuum } from '../../library/audio/synth.mjs';

const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));

/** Playful original score and Foley; event times come from timeline.json, shared with the picture. */
export function buildSoundtrack(D) {
  const music = stereo(D), sfx = stereo(D), r = rng(830), B = T.bounds, n = Math.ceil(D * SR);
  const inLift = (t) => t < B[1] || (t >= B[2] && t < B[3]) || t >= B[7];
  // A soft electric-piano note: decaying sine pair with a little tremolo.
  const ep = (buf, at, note, g, len = 1.4, pan = 0) => {
    const f = NOTE(note), x = tone(len, f), y = tone(len, f * 2.001);
    for (let i = 0; i < x.length; i++) { const u = i / SR; x[i] = (x[i] + 0.35 * y[i]) * Math.exp(-u * 2.4) * (1 - Math.exp(-u * 250)) * (0.85 + 0.15 * Math.sin(u * 30)); }
    mixMono(buf, x, at, g, pan);
  };
  // Muted brass blip: a few harmonics with a downward bend, low-passed (comic, not crude).
  const brass = (buf, at, f0, g, len = 0.55, bend = 0.75, pan = 0) => {
    const fn = (u) => f0 * (1 - (1 - bend) * Math.min(1, u / len));
    const h = [1, 2, 3, 4].map((k) => tone(len, (u) => fn(u) * k)), x = new Float32Array(h[0].length);
    for (let i = 0; i < x.length; i++) { const u = i / SR; x[i] = (h[0][i] + 0.5 * h[1][i] + 0.3 * h[2][i] + 0.18 * h[3][i]) * envAR(u, len, 0.025, len * 0.6); }
    mixMono(buf, filter(x, 'lowpass', 900), at, g, pan);
  };
  const pluck = (buf, at, note, g, pan = 0) => mixMono(buf, shape(tone(0.45, NOTE(note)), (u) => Math.exp(-u * 11) * (1 - Math.exp(-u * 400))), at, g, pan);

  // ---- music
  // Elevator muzak (S01, S03, S08): Fmaj7 Em7 Dm7 G7 on soft electric piano with a walking bass.
  const prog = [['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['G2', 'B3', 'D4', 'F4']], bass = ['F2', 'E2', 'D2', 'G2'];
  for (let t = 0, k = 0; t < D - 0.3; t += 1.2, k++) {
    if (!inLift(t) || (t > T.fart - 0.6 && t < T.fart + 0.1)) continue;   // nothing new starts just before the moment
    const c = prog[k % 4];
    c.forEach((nn, j) => ep(music, t + j * 0.02, nn, 0.24, 1.3, j % 2 ? 0.25 : -0.25));
    pluck(music, t, bass[k % 4], 0.34); pluck(music, t + 0.6, bass[k % 4], 0.22);
  }
  // A sustained, slightly cheesy pad under the muzak, so the pre-moment silence is felt.
  for (const [a0, b0] of [[0, B[1]], [B[2], B[3]], [B[7], D]]) mixStereo(music, pad({ freqs: ['F3', 'A3', 'C4', 'E4', 'G4'].map(NOTE), dur: b0 - a0 + 0.6, attack: 0.05, release: 0.5, detune: 4, bright: 1.2, seed: Math.round(a0 * 10) + 3 }), a0, 0.55);
  // Outside (S04-S05): a bouncy pizzicato groove.
  for (let t = B[3] + 0.1, k = 0; t < B[5] - 0.3; t += 0.3, k++) pluck(music, t, ['C4', 'E4', 'G4', 'E4', 'A4', 'G4', 'E4', 'D4'][k % 8], k % 4 === 0 ? 0.12 : 0.08, k % 2 ? 0.3 : -0.3);
  for (let t = B[3] + 0.1, k = 0; t < B[5] - 0.3; t += 0.6, k++) pluck(music, t, ['C3', 'G2', 'A2', 'E2'][k % 4], 0.12);
  // Orbit (S02, S06): a deep, faintly ridiculous brass choir and an airy pad.
  mixStereo(music, pad({ freqs: ['F2', 'C3', 'A3'].map(NOTE), dur: B[2] - B[1] + 0.8, attack: 0.3, release: 0.8, detune: 6, bright: 1.2, seed: 5 }), B[1], 0.1);
  mixStereo(music, pad({ freqs: ['D3', 'A3', 'F4', 'C5'].map(NOTE), dur: B[6] - B[5] + 0.8, attack: 1.2, release: 1.0, detune: 5, bright: 2.0, seed: 9 }), B[5], 0.18);
  // Pasture (S07): a light country pluck.
  for (let t = B[6] + 0.2, k = 0; t < B[7] - 0.3; t += 0.4, k++) pluck(music, t, ['G3', 'B3', 'D4', 'B3', 'C4', 'E4', 'G4', 'E4'][k % 8], 0.08, k % 2 ? 0.25 : -0.25);
  // Ending button: a pizzicato "ba-dum" and a soft brass blip.
  pluck(music, D - 1.3, 'C4', 0.2, -0.2); pluck(music, D - 1.05, 'G3', 0.22, 0.2); brass(music, D - 1.05, NOTE('C2'), 0.18, 0.7, 0.98);
  automate(music, (t) => smooth(0, 0.04, t) * (1 - smooth(D - 0.4, D, t)));

  // ---- ambience in the bed (ducked with the music by the storyboard silence)
  const hum = filter(noise(n, r, 'pink'), 'lowpass', 220), street = filter(noise(n, r, 'pink'), 'lowpass', 1500), wind = filter(noise(n, r, 'pink'), 'bandpass', 600, 0.6);
  for (let i = 0; i < n; i++) {
    const t = i / SR, lift = inLift(t), out = t >= B[3] && t < B[5], field = t >= B[6] && t < B[7];
    hum[i] *= lift ? 0.05 : 0; street[i] *= out ? 0.025 : 0; wind[i] *= field ? 0.02 : out ? 0.01 : 0;
  }
  mixMono(music, hum, 0, 1.8); mixMono(music, street, 0, 1.4, -0.1); mixMono(music, wind, 0, 1.4, 0.2);
  const chirp = (s, f, g, pan) => { const c = tone(0.11, (u) => f + 1400 * Math.sin(u * 58)); for (const d of [0, 0.14]) mixMono(music, shape(c, (u) => envAR(u, 0.11, 0.01, 0.07)), s + d, g, pan); };
  for (const [s, f, p] of [[B[3] + 0.6, 3900, 0.5], [B[3] + 2.9, 4300, -0.4], [B[6] + 0.9, 3600, 0.6], [B[6] + 3.3, 4100, -0.5]]) chirp(s, f, dB(-36), p);

  // ---- Foley and stings
  // S01: the moment. Muzak and hum drop out for a beat (storyboard silence), then one low comic brass blip.
  brass(sfx, T.fart, NOTE('A1'), dB(-15), 0.5, 0.72);
  pluck(sfx, T.includingYou + 0.35, 'E5', dB(-22), 0.3);
  // S02: everyone at once: the same blip as a planet-sized low chord.
  for (const [k, f] of [['F1', 0], ['C2', 0.01], ['F2', 0.02]]) brass(sfx, B[1] + 0.05 + f, NOTE(k), dB(-31), 1.1, 0.8);
  mixMono(sfx, shape(filter(noise(Math.round(1.6 * SR), r, 'brown'), 'lowpass', 120), (u) => envAR(u, 1.6, 0.05, 1.2)), B[1] + 0.05, dB(-29));
  // S03: awkward silence; a cough, a sniff, then three button jabs.
  for (const d of [0, 0.22]) mixMono(sfx, shape(filter(noise(Math.round(0.16 * SR), r, 'white'), 'bandpass', 850, 1.4), (u) => envAR(u, 0.16, 0.01, 0.12)), B[2] + 1.75 + d, dB(-26), 0.35);
  const sniff = (s, g, pan) => mixMono(sfx, shape(filter(noise(Math.round(0.18 * SR), r, 'white'), 'bandpass', 3200, 1.0), (u) => envAR(u, 0.18, 0.12, 0.05)), s, g, pan);
  sniff(T.react - 0.5, dB(-28), -0.2); sniff(T.react - 0.25, dB(-28), -0.2);
  for (const d of [0, 0.45, 0.9]) { const s = T.react + 0.35 + d; mixMono(sfx, shape(filter(noise(Math.round(0.03 * SR), r, 'white'), 'bandpass', 2600, 2), (u) => Math.exp(-u * 240)), s, dB(-18), -0.4); mixMono(sfx, shape(tone(0.05, 300), (u) => Math.exp(-u * 70)), s, dB(-26), -0.4); }
  // S04: a breeze and a long relieved breath in.
  mixMono(sfx, shape(filter(noise(Math.round(2.2 * SR), r, 'pink'), 'bandpass', (u) => 400 + 500 * u, 0.7), (u) => envAR(u, 2.2, 0.6, 1.2)), B[3] + 0.3, dB(-26), 0.4);
  mixMono(sfx, shape(filter(noise(Math.round(0.9 * SR), r, 'white'), 'bandpass', (u) => 900 + 700 * u, 1.2), (u) => envAR(u, 0.9, 0.6, 0.2)), T.dilute[1] + 0.15, dB(-24), -0.2);
  // S05: the bubble stretches as it inflates, then a ta-da stab.
  { const len = T.inflate1 - T.inflate0, x = tone(len, (u) => 140 + 260 * (u / len) + 18 * Math.sin(u * 40)); mixMono(sfx, filter(shape(x, (u) => envAR(u, len, 0.2, 0.15) * (0.5 + 0.5 * Math.sin(u * 23))), 'lowpass', 1400), T.inflate0, dB(-22), 0); }
  for (const k of ['F3', 'A3', 'C4', 'F4']) brass(sfx, T.tada, NOTE(k), dB(-20), 0.5, 1.0);
  // S06: a slide whistle down as the bubble shrinks to a speck and spreads to nothing.
  mixMono(sfx, shape(tone(1.2, (u) => 1500 * Math.pow(0.22, Math.min(1, u / 1.1))), (u) => envAR(u, 1.2, 0.04, 0.3)), T.spread0 - 0.05, dB(-24), 0);
  // S07: cow burps, each where a cow lifts its head.
  T.burps.forEach((b, k) => {
    const len = 0.45 + 0.1 * (k % 2), x = tone(len, (u) => 62 + 10 * Math.sin(u * 30) - 12 * u), y = filter(noise(x.length, r, 'pink'), 'bandpass', 320, 1.2);
    for (let i = 0; i < x.length; i++) { const u = i / SR; x[i] = (0.8 * x[i] + 0.6 * y[i] * (0.6 + 0.4 * Math.sin(u * 140))) * envAR(u, len, 0.03, 0.2); }
    mixMono(sfx, filter(x, 'lowpass', 700), b, dB(k === 0 ? -12 : -22 - k), [-0.1, 0.4, -0.4, 0.25, -0.3][k % 5]);
  });
  // S08: elevator ding, doors, footsteps out, the next passenger's sniff and recoil sting.
  for (const [f, g] of [[1318.5, 1], [2637, 0.35]]) mixMono(sfx, shape(tone(1.4, f), (u) => Math.exp(-u * 3) * (1 - Math.exp(-u * 600))), T.doorsOpen, dB(-14) * g, 0.1);
  mixMono(sfx, shape(filter(noise(Math.round(0.9 * SR), r, 'pink'), 'bandpass', 500, 0.8), (u) => envAR(u, 0.9, 0.1, 0.4)), T.doorsOpen + 0.05, dB(-30), 0);
  for (let s = T.doorsOpen + 0.5, k = 0; s < T.recoil - 0.2; s += 0.27, k++) mixMono(sfx, shape(filter(noise(Math.round(0.07 * SR), r, 'pink'), 'lowpass', 1600), (u) => envAR(u, 0.07, 0.004, 0.05)), s, dB(-30), Math.sin(k * 1.7) * 0.4);
  sniff(T.recoil - 0.35, dB(-24), 0.15); sniff(T.recoil - 0.12, dB(-24), 0.15);
  pluck(sfx, T.recoil + 0.05, 'C6', dB(-20), 0.2); pluck(sfx, T.recoil + 0.15, 'F#5', dB(-22), 0.2);

  const wet = reverb(sfx, { decay: 0.9, mix: 0.12, damp: 0.5, tail: 0.2 });
  for (let i = 0; i < sfx.L.length; i++) { sfx.L[i] = wet.L[i]; sfx.R[i] = wet.R[i]; }
  applyPreImpactVacuum({ sampleRate: SR, length: sfx.L.length, left: sfx.L, right: sfx.R }, { at_s: T.fart - 0.3, duration_s: 0.3, duckDb: -24 });
  return { music, sfx };
}
