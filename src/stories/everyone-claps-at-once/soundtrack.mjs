import {
  DEFAULT_SAMPLE_RATE as SR,
  NOTE,
  pad,
  tone,
  shape,
  smooth,
  createStereoBuffer,
  mixIn,
  biquadFilter,
  applyPreImpactVacuum,
  dbToGain,
} from '../../library/audio/synth.mjs';
import { readWav, resample } from '../../../tools/lib/wav.mjs';

const C = 343;
const BOUNDS = [0, 3.8, 10.2, 16.8, 23.5, 28.8, 35.4, 42.4, 50];
const CLAPS = {
  a: { file: 'clap-owlstorm-a-48k.wav', measuredAttack_s: 0.0229375 },
  b: { file: 'clap-owlstorm-b-48k.wav', measuredAttack_s: 0.019395833333333334 },
  c: { file: 'clap-owlstorm-c-48k.wav', measuredAttack_s: 0.018979166666666665 },
};

// These are views/replays of the stipulated event, not repeated global clapping.
// Crowd layers model nearby arrivals only; their gains are editorial, never a
// calculation of world-wide sound pressure or a guarantee of distant audibility.
export const SOUND_EVENTS = Object.freeze([
  { id: 'opening-contact', clip: 'a', attackAt_s: 0.9, gain: 0.57, pan: 0,
    source: 'hero palms meet; close camera' },
  { id: 'crowd-contact-replay', clip: 'a', attackAt_s: 4.6, gain: 0.46, pan: 0,
    source: 'same simultaneous event replay, foreground actor' },
  { id: 'crowd-left-arrival', clip: 'b', attackAt_s: 4.6 + 5 / C, gain: 0.16, pan: -0.23,
    source: 'same event, nearby left-hand crowd contribution at illustrative 5m' },
  { id: 'crowd-right-arrival', clip: 'c', attackAt_s: 4.6 + 11 / C, gain: 0.13, pan: 0.3,
    source: 'same event, nearby right-hand crowd contribution at illustrative 11m' },
  { id: 'hand-contact-explanation', clip: 'a', attackAt_s: 12.0, gain: 0.4, pan: 0,
    source: 'slow explanatory contact replay; recorded clap retains natural pitch' },
  { id: 'travel-replay-source', clip: 'a', attackAt_s: 18.3, gain: 0.3, pan: -0.12,
    source: 'source-side contact at the start of the half-speed travel replay' },
  { id: 'conditional-one-km-arrival', clip: 'a', attackAt_s: 18.3 + (1000 / C) / 0.5,
    gain: 0.085, pan: 0.1, lowpass_hz: 1800,
    source: 'selected 1km listener arrival, half-speed simulation; audible only if the signal reaches the listener above background' },
  { id: 'isolated-source-control', clip: 'a', attackAt_s: 30.2 + 2 / C,
    gain: 0.38, pan: 0,
    source: 'isolated source replay, selected measurement point 2m away; no second clap or pressure calibration for the 4m control' },
  { id: 'alley-direct', clip: 'a', attackAt_s: 36.4, gain: 0.43, pan: 0,
    source: 'single local contact, real-time alley replay' },
  { id: 'alley-wall-reflection', clip: 'a', attackAt_s: 36.4 + 60 / C,
    gain: 0.16, pan: 0.35, lowpass_hz: 2600,
    source: 'weaker reflection of the same recording after 60m round trip to the 30m wall; hands releasing, no second contact' },
]);

function loadRecording(file) {
  const wav = readWav(new URL(`../../../assets/library/audio/${file}`, import.meta.url));
  if (!wav.channels.length || !wav.channels[0].length) throw new Error(`Empty recording: ${file}`);
  const left = resample(wav.channels[0], wav.sampleRate, SR);
  const right = wav.channels.length > 1
    ? resample(wav.channels[1], wav.sampleRate, SR)
    : new Float32Array(left);
  for (const channel of [left, right]) {
    for (const value of channel) if (!Number.isFinite(value)) throw new Error(`Nonfinite recording: ${file}`);
  }
  return { sampleRate: SR, length: left.length, duration_s: left.length / SR, left, right };
}

function recordedEvent(event, cache) {
  const key = `${event.clip}:${event.lowpass_hz ?? 0}`;
  if (cache.has(key)) return cache.get(key);
  const spec = CLAPS[event.clip];
  if (!spec) throw new Error(`Unknown recorded clap variant: ${event.clip}`);
  const clip = loadRecording(spec.file);
  let attackOffset_s = spec.measuredAttack_s;
  if (event.lowpass_hz) {
    biquadFilter(clip, { type: 'lowpass', freq: event.lowpass_hz });
    // Re-measure after filtering, rather than letting filter latency move the
    // actual audible attack away from the chosen travel/reflection arrival.
    const threshold = dbToGain(-38);
    const index = clip.left.findIndex((sample, i) => Math.max(Math.abs(sample), Math.abs(clip.right[i])) > threshold);
    if (index < 0) throw new Error(`No measurable filtered clap attack: ${key}`);
    attackOffset_s = index / SR;
  }
  const result = { clip, attackOffset_s, file: `assets/library/audio/${spec.file}` };
  cache.set(key, result);
  return result;
}

export function describeSoundEvents() {
  const cache = new Map();
  return SOUND_EVENTS.map(event => {
    const source = recordedEvent(event, cache);
    return {
      ...event,
      file: source.file,
      duration_s: source.clip.duration_s,
      transientOffset_s: source.attackOffset_s,
      clipStart_s: event.attackAt_s - source.attackOffset_s,
      scheduledAttack_s: (Math.round((event.attackAt_s - source.attackOffset_s) * SR) / SR) + source.attackOffset_s,
    };
  });
}

function originalMusic(duration_s, story) {
  const music = createStereoBuffer(duration_s, SR);
  const chords = [
    ['D3', 'A3', 'E4'], ['G3', 'D4', 'A4'], ['E3', 'B3', 'F4'], ['B2', 'F3', 'A3'],
    ['G3', 'D4', 'E4'], ['A2', 'E3', 'B3'], ['C3', 'G3', 'D4'], ['D3', 'A3', 'F4'],
  ];
  const windows = story?.scenes?.map(sc => [sc.start_s, sc.end_s])
    ?? BOUNDS.slice(0, -1).map((start, i) => [start, BOUNDS[i + 1]]);
  windows.forEach(([start, end], i) => {
    const length = Math.min(duration_s, end + 0.25) - start;
    if (length <= 0) return;
    const raw = pad({
      freqs: chords[i % chords.length].map(NOTE), dur: length,
      attack: 0.05, release: 0.32, detune: 1.4, bright: 0.8, harmonics: 2, seed: 830300 + i,
    });
    mixIn(music, { sampleRate: SR, length: raw.L.length, left: raw.L, right: raw.R }, start, 0.18);
    for (let at = start + 0.13, j = 0; at < end - 0.2; at += 0.7, j++) {
      // Leave contacts and decisive arrivals free of an unrelated musical tick.
      if (SOUND_EVENTS.some(event => Math.abs(event.attackAt_s - at) < 0.2)) continue;
      const duration = 0.34;
      const note = NOTE(['D5', 'A4', 'E5', 'G4'][j % 4]);
      const pluck = shape(tone(duration, note), t =>
        (1 - Math.exp(-t * 400)) * Math.exp(-t * 13) * (1 - smooth(duration - 0.025, duration, t)));
      mixIn(music, pluck, at, j % 2 ? 0.042 : 0.058, Math.sin(j * 0.7) * 0.18);
    }
  });
  return music;
}

// Every shot is a ground/aerial city or park view. No shot is in exterior space.
// Keep the same quiet environment continuous into the final alley hold.
export const AMBIENCE_WINDOWS = Object.freeze([[0, 50]]);

// Location remains the same while source perspective becomes more distant.
// Fade across cuts rather than interrupting or restarting the recording.
export const AMBIENCE_PERSPECTIVE = Object.freeze([
  { from_s: 6.7, to_s: 10.2, gain: 0.5, reason: '18m-high street overview' },
  { from_s: 13.3, to_s: 16.8, gain: 0.25, reason: '155m-high pulse overview' },
  { from_s: 19.5, to_s: 23.5, gain: 0.1, reason: '620m-high kilometre travel view' },
  { from_s: 32.0, to_s: 35.4, gain: Math.SQRT1_2, reason: '5.3m-high isolated-source overview' },
  { from_s: 38.1, to_s: 42.4, gain: Math.pow(10, -5 / 20), reason: '12m-high alley overview' },
]);

export function ambiencePerspectiveGain(t) {
  let gain = 1;
  for (const window of AMBIENCE_PERSPECTIVE) {
    const weight = smooth(window.from_s - 0.08, window.from_s + 0.08, t)
      * (1 - smooth(window.to_s - 0.08, window.to_s + 0.08, t));
    gain *= 1 - weight * (1 - window.gain);
  }
  return gain;
}

export function buildSoundtrack(duration_s, story) {
  if (!(Number.isFinite(duration_s) && duration_s > 0)) throw new Error('Invalid soundtrack duration');
  const music = originalMusic(duration_s, story);
  const sfx = createStereoBuffer(duration_s, SR);
  const ambience = createStereoBuffer(duration_s, SR);
  const birds = loadRecording('mafon2-park-birds-274175-48k.wav');
  // There is no loop: the actual field recording is longer than this entire film.
  for (let i = 0; i < ambience.length; i++) {
    const t = i / SR;
    const windowGain = Math.max(0, ...AMBIENCE_WINDOWS.map(([a, b]) =>
      smooth(a, a + 0.1, t) * (1 - smooth(b - 0.15, b, t))));
    const gain = windowGain * 1.1 * ambiencePerspectiveGain(t);
    ambience.left[i] = (birds.left[i] ?? 0) * gain;
    ambience.right[i] = (birds.right[i] ?? 0) * gain;
  }
  // tools/soundtrack.mjs ducks music before adding sfx. Duck this separate nature
  // bed here, then add contacts afterward so the .9s clap keeps its full attack.
  for (const scene of story?.scenes ?? []) {
    for (const cue of scene.audio_cues ?? []) {
      if (cue.kind === 'silence') applyPreImpactVacuum(ambience, {
        at_s: cue.at_s, duration_s: cue.duration_s, duckDb: cue.relative_db ?? -24,
      });
    }
  }
  mixIn(sfx, ambience, 0, 1, 0);
  const cache = new Map();
  for (const event of SOUND_EVENTS) {
    const recorded = recordedEvent(event, cache);
    mixIn(sfx, recorded.clip, event.attackAt_s - recorded.attackOffset_s, event.gain, event.pan);
  }
  for (let i = 0; i < music.length; i++) {
    const t = i / SR;
    const gain = smooth(0, 0.025, t) * (1 - smooth(duration_s - 0.25, duration_s, t));
    const travelEase = smooth(16.6, 16.8, t) * (1 - smooth(28.8, 29, t));
    const echoEase = smooth(35.2, 35.4, t) * (1 - smooth(42.4, 42.6, t));
    const scoreGain = gain * (1 - 0.35 * Math.max(travelEase, echoEase));
    music.left[i] *= scoreGain; music.right[i] *= scoreGain;
    sfx.left[i] *= gain; sfx.right[i] *= gain;
  }
  return { music, sfx };
}
