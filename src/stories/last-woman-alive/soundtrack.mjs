import {
  SR, NOTE, rng, pad, tone, noise, filter, shape, envAR, smooth,
  createStereoBuffer, mixIn, countdownPulse, applyPreImpactVacuum,
} from '../../library/audio/synth.mjs';

const db = value => 10 ** (value / 20);
const asCurrent = buffer => ({ sampleRate: buffer.sr, length: buffer.L.length, left: buffer.L, right: buffer.R });

/** Original glass/felt instrument: deliberately inharmonic overtones, no sampled media. */
function glassNote(note, duration = 2.2, bright = 1) {
  const fundamental = NOTE(note), out = new Float32Array(Math.ceil(duration * SR));
  for (const [ratio, gain, decay] of [[1, 1, 2.8], [2.76, .25 * bright, 4.3], [4.21, .10 * bright, 6.2]]) {
    const partial = tone(duration, fundamental * ratio);
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      out[i] += partial[i] * gain * (1 - Math.exp(-t * 150)) * Math.exp(-t * decay) * (1 - smooth(duration - .12, duration, t));
    }
  }
  return out;
}

/** Small body resonance with a short filtered contact transient. */
function contact(random, { duration = .3, frequency = 180, cutoff = 1800, decay = 20, body = .6 } = {}) {
  const tonePart = tone(duration, t => frequency * (1 - .13 * Math.min(t * 5, 1)));
  const texture = filter(noise(tonePart.length, random, 'white'), 'lowpass', cutoff);
  return shape(tonePart, t => (1 - Math.exp(-t * 600)) * Math.exp(-t * decay) * body)
    .map((sample, i) => sample + texture[i] * Math.exp(-i / SR * decay * 1.6) * .65 * (1 - Math.exp(-i / SR * 500)));
}

/** Deterministic 55-second suspense score and physically timed illustrative Foley.
 * Ambient room tone lives in music so tools/soundtrack.mjs ducks the complete bed.
 * Foreground contacts remain in sfx, with their existing tails ducked before impacts.
 */
export function buildSoundtrack(D) {
  const music = createStereoBuffer(D), sfx = createStereoBuffer(D), random = rng(231013);
  const sections = [
    [0, 5.5, ['D2', 'A2', 'F3', 'E4'], .34],
    [5.5, 10.5, ['Bb1', 'F2', 'A3', 'D4'], .29],
    [10.5, 13.2, ['D2', 'Eb3', 'A3'], .32],
    [13.2, 16.5, ['G2', 'D3', 'F3'], .27],
    [16.5, 22, ['D2', 'A3', 'E4'], .24],
    [22, 28, ['Bb2', 'F3', 'C4', 'D4'], .34],
    [28, 34.5, ['G2', 'D3', 'A3'], .29],
    [34.5, 41, ['D2', 'A2', 'Eb3'], .27],
    [41, 48, ['D3', 'A3', 'F#4', 'C#5'], .32],
    [48, D, ['D2', 'A2', 'F3', 'E4'], .32],
  ];
  for (const [index, [at, end, names, gain]] of sections.entries()) {
    if (end <= at || at >= D) continue;
    const chord = pad({ freqs: names.map(NOTE), dur: end - at + 1.1, attack: index === 0 ? .035 : .65,
      release: 1.25, detune: index === 8 ? 2.5 : 4.2, bright: 1.9, harmonics: 3, seed: 303 + index });
    mixIn(music, asCurrent(chord), at, gain);
  }

  // Urgent opening pulse, a second acceleration before the collision, then space
  // around the father's call. The final pattern reprises the first frame's motif.
  countdownPulse(music, { start_s: .08, duration_s: 5.3, bpm: 116, freq: 110, gain: .38 });
  countdownPulse(music, { start_s: 5.65, duration_s: 4.5, bpm: 94, freq: 146.83, gain: .20 });
  countdownPulse(music, { start_s: 10.60, duration_s: 2.35, bpm: 132, freq: 98, gain: .38 });
  countdownPulse(music, { start_s: 13.4, duration_s: 2.7, bpm: 108, freq: 146.83, gain: .21 });
  countdownPulse(music, { start_s: 22.1, duration_s: 5.45, bpm: 92, freq: 146.83, gain: .17 });
  countdownPulse(music, { start_s: 34.7, duration_s: 5.7, bpm: 77, freq: 110, gain: .14 });
  countdownPulse(music, { start_s: 48.2, duration_s: 3.5, bpm: 101, freq: 110, gain: .23 });
  countdownPulse(music, { start_s: 52.08, duration_s: 2.7, bpm: 116, freq: 110, gain: .34 });

  const motif = [[.35, 'D5'], [.87, 'F5'], [2.20, 'E5'], [3.35, 'A4'],
    [6.25, 'D5'], [8.55, 'A4'], [17.7, 'E5'], [20.05, 'D5'],
    [22.05, 'D6'], [23.35, 'A5'], [25.1, 'F5'], [26.65, 'C6'],
    [29.25, 'D5'], [32.1, 'A5'], [35.4, 'Eb5'], [38.25, 'A4'],
    [41.25, 'D5'], [43.1, 'F#5'], [45.0, 'A5'], [46.75, 'E5'],
    [49.05, 'D5'], [50.6, 'E5'], [52.35, 'D5'], [52.87, 'F5'], [54.2, 'E5']];
  for (const [index, [at, note]] of motif.entries()) {
    const glassy = at >= 22 && at < 28;
    const gain = glassy ? .14 : at >= 41 && at < 48 ? .14 : .105;
    mixIn(music, glassNote(note, glassy ? 2.4 : 1.9, glassy ? 1 : .35), at, gain, Math.sin(index * 1.7) * .3);
    mixIn(music, glassNote(note, 1.4, .18), at + .27, gain * .17, -Math.sin(index * 1.7) * .4);
  }

  // The continuous air/traffic tone belongs to the duckable bed, never the SFX bus.
  const room = filter(noise(Math.ceil(D * SR), random, 'pink'), 'lowpass', 1800);
  const distantTraffic = filter(noise(Math.ceil(D * SR), random, 'brown'), 'lowpass', 330);
  for (let i = 0; i < room.length; i++) {
    const t = i / SR, street = t < 5.5 || t >= 10.5 && t < 13.2 || t >= 48;
    room[i] *= street ? .050 : t >= 22 && t < 41 ? .028 : .016;
    distantTraffic[i] *= street ? .055 : .003;
  }
  mixIn(music, room, 0, 1, -.14); mixIn(music, distantTraffic, 0, 1, .10);
  // Cryogenic breath sweeps into the glassy rehook without drowning its first word.
  const storageHiss = shape(filter(noise(Math.ceil(6 * SR), random, 'pink'), 'highpass', 1600), t => envAR(t, 6, .6, 1.5));
  mixIn(music, storageHiss, 22, .16, -.23);

  // Friend vanishes at .65. A short airy displacement precedes distinct floor contacts.
  const vanish = shape(filter(noise(Math.ceil(.78 * SR), random, 'pink'), 'bandpass', t => 2100 - t * 1300), t => envAR(t, .78, .025, .58));
  mixIn(sfx, vanish, .65, db(-25), -.25);
  mixIn(sfx, contact(random, { duration: .38, frequency: 165, cutoff: 850, decay: 16 }), 1.35, db(-15), -.28);
  const coffeeSplash = shape(filter(noise(Math.ceil(.34 * SR), random, 'pink'), 'bandpass', 950), t => envAR(t, .34, .004, .29));
  mixIn(sfx, coffeeSplash, 1.37, db(-25), -.30);
  mixIn(sfx, contact(random, { duration: .19, frequency: 390, cutoff: 2700, decay: 29 }), 1.47, db(-19), -.10);
  mixIn(sfx, contact(random, { duration: .16, frequency: 1050, cutoff: 3900, decay: 35, body: .25 }), 1.59, db(-24), .10);

  // Separate exact contact times: primary car, second car 120 ms later, then shards.
  for (const [index, at] of [12, 12.12, 12.24].entries()) {
    const body = shape(tone(.95, t => 42 + 60 * Math.exp(-t * 11)), t => (1 - Math.exp(-t * 400)) * Math.exp(-t * 6.4));
    const metal = shape(filter(noise(Math.ceil(.62 * SR), random, 'white'), 'bandpass', 880 + index * 460, 1.1), t => (1 - Math.exp(-t * 250)) * Math.exp(-t * 14));
    mixIn(sfx, body, at, db(-15 - index * 2.5), index % 2 ? .32 : -.25);
    mixIn(sfx, metal, at, db(-18 - index * 2), index % 2 ? .25 : -.18);
  }
  const shards = shape(filter(noise(Math.ceil(.75 * SR), random, 'white'), 'highpass', 4400), t => envAR(t, .75, .008, .69));
  mixIn(sfx, shards, 12.30, db(-29), .25);
  const passingCar = shape(filter(noise(Math.ceil(1.1 * SR), random, 'pink'), 'bandpass', t => 350 + t * 1400), t => envAR(t, 1.1, .3, .4));
  mixIn(sfx, passingCar, 10.65, db(-29), .3);

  // Ward equipment and footsteps stay quiet; the call becomes the human pivot.
  for (const [index, at] of [13.5, 14.05, 14.6, 15.15, 15.7].entries()) {
    mixIn(sfx, contact(random, { duration: .13, frequency: 145, cutoff: 800, decay: 37 }), at, db(-34), index % 2 ? -.15 : .15);
  }
  for (const at of [13.85, 15.05]) {
    mixIn(sfx, shape(tone(.13, 880), t => envAR(t, .13, .008, .07)), at, db(-38), .28);
  }
  // Original four-note phone ringtone, with gaps to preserve the narration.
  for (const [index, at] of [16.8, 17.02, 17.46, 17.68].entries()) {
    const ring = glassNote(index % 2 ? 'B5' : 'G5', .20, .45);
    mixIn(sfx, ring, at, db(-26), .20);
  }
  const phoneBuzz = shape(filter(noise(Math.ceil(1.45 * SR), random, 'brown'), 'bandpass', 180, 1.7), t => envAR(t, 1.45, .08, .3) * (.4 + .6 * Math.sin(Math.PI * t * 6) ** 2));
  mixIn(sfx, phoneBuzz, 16.8, db(-33), .18);
  mixIn(sfx, contact(random, { duration: .1, frequency: 770, cutoff: 2200, decay: 50, body: .3 }), 18.25, db(-33), .15);

  // Canister handle and rack emerge at 24–26 seconds. The physical sounds are small.
  mixIn(sfx, contact(random, { duration: .45, frequency: 630, cutoff: 3100, decay: 11, body: .35 }), 24.0, db(-30), -.12);
  const slide = shape(filter(noise(Math.ceil(1.8 * SR), random, 'pink'), 'bandpass', 1700, 1.2), t => envAR(t, 1.8, .15, .35));
  mixIn(sfx, slide, 24.10, db(-35), -.08);
  mixIn(sfx, contact(random, { duration: .38, frequency: 840, cutoff: 3500, decay: 14, body: .35 }), 26, db(-32), .12);
  for (const at of [28.6, 30.25, 32.0, 33.4]) {
    mixIn(sfx, contact(random, { duration: .08, frequency: 1400, cutoff: 2400, decay: 60, body: .2 }), at, db(-37), -.20);
  }
  // A normal incubator has ventilation and occasional quiet monitoring beeps.
  // There is deliberately no invented fetal voice or artificial-womb machinery.
  const incubatorAir = shape(filter(noise(Math.ceil(6.5 * SR), random, 'pink'), 'bandpass', 700), t => envAR(t, 6.5, .5, .7));
  mixIn(music, incubatorAir, 34.5, .12, .12);
  for (const at of [35.2, 37.7, 40.2]) mixIn(sfx, shape(tone(.12, 740), t => envAR(t, .12, .008, .08)), at, db(-39), -.2);
  const cloth = shape(filter(noise(Math.ceil(.8 * SR), random, 'pink'), 'bandpass', 2100), t => envAR(t, .8, .10, .5));
  mixIn(sfx, cloth, 42.1, db(-38), -.15); mixIn(sfx, cloth, 45.2, db(-39), .15);

  // Return to the phone and an airy memory rewind, landing on the opening motif.
  mixIn(sfx, contact(random, { duration: .10, frequency: 620, cutoff: 1900, decay: 48, body: .3 }), 49.2, db(-34), .12);
  const rewind = shape(filter(noise(Math.ceil(1.05 * SR), random, 'pink'), 'bandpass', t => 450 + 2900 * smooth(0, 1.05, t)), t => envAR(t, 1.05, .55, .30));
  mixIn(sfx, rewind, 51.75, db(-30), .2);
  mixIn(sfx, vanish, 52.65, db(-30), -.25);

  for (let i = 0; i < music.length; i++) {
    const t = i / SR, fade = smooth(0, .025, t) * (1 - smooth(D - .07, D, t));
    music.left[i] *= fade; music.right[i] *= fade;
    sfx.left[i] *= 1 - smooth(D - .07, D, t); sfx.right[i] *= 1 - smooth(D - .07, D, t);
  }
  // tools/soundtrack applies these same cue windows to the complete music bed.
  // Applying them to this foreground bus prevents Foley tails from filling them.
  applyPreImpactVacuum(sfx, { at_s: 1.05, duration_s: .30, duckDb: -24 });
  applyPreImpactVacuum(sfx, { at_s: 11.70, duration_s: .30, duckDb: -24 });
  return { music, sfx };
}
