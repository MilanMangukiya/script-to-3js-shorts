/**
 * audio-synth-kit-v1 — Pure-JS Deterministic Audio Synthesis Kit
 *
 * Preserves all registered synthesis helpers in assets/registry.json:
 * - Seeded RNG, white/pink/brown noise, detuned additive pads, RBJ biquad filters
 *   with frequency sweeps, Freeverb-style stereo reverb, crackle generator,
 *   ADSR envelopes, and stereo buffer mixing.
 *
 * Upgraded with viral simulation sound-design primitives:
 * - `staggeredDestructionHit()`: Multi-tap sub-bass & debris transients spaced by 80-180ms
 * - `applyPreImpactVacuum()`: -24 dB acoustic ducking envelope before shockwaves
 * - `countdownPulse()`: Rhythmic simulation timer pulse
 */

export const DEFAULT_SAMPLE_RATE = 48000;

export function mulberry32(seed = 1) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

export function createStereoBuffer(duration_s, sampleRate = DEFAULT_SAMPLE_RATE) {
  const length = Math.max(1, Math.ceil(duration_s * sampleRate));
  return {
    sampleRate,
    length,
    duration_s,
    left: new Float32Array(length),
    right: new Float32Array(length),
  };
}

export function mixIn(
  target,
  source,
  offset_s = 0,
  gain = 1.0,
  pan = 0.0
) {
  const sr = target.sampleRate || DEFAULT_SAMPLE_RATE;
  const startIdx = Math.round(offset_s * sr);
  const panAngle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  const gainL = gain * Math.cos(panAngle);
  const gainR = gain * Math.sin(panAngle);

  const srcL = source.left || source;
  const srcR = source.right || source.left || source;
  const len = srcL.length;

  for (let i = 0; i < len; i++) {
    const dstIdx = startIdx + i;
    if (dstIdx < 0 || dstIdx >= target.length) continue;
    target.left[dstIdx] += srcL[i] * gainL;
    target.right[dstIdx] += srcR[i] * gainR;
  }
  return target;
}

export function envelopeADSR(
  t_s,
  duration_s,
  attack_s = 0.02,
  decay_s = 0.1,
  sustainLevel = 0.7,
  release_s = 0.2
) {
  if (t_s < 0 || t_s > duration_s) return 0;
  if (t_s < attack_s) {
    return t_s / Math.max(1e-5, attack_s);
  }
  const sustainEnd = Math.max(attack_s, duration_s - release_s);
  if (t_s < attack_s + decay_s && t_s < sustainEnd) {
    const u = (t_s - attack_s) / Math.max(1e-5, decay_s);
    return 1.0 + (sustainLevel - 1.0) * u;
  }
  if (t_s < sustainEnd) {
    return sustainLevel;
  }
  const relU = (t_s - sustainEnd) / Math.max(1e-5, release_s);
  return Math.max(0, sustainLevel * (1.0 - relU));
}

export function generateNoise({
  duration_s = 1.0,
  sampleRate = DEFAULT_SAMPLE_RATE,
  seed = 101,
  color = 'pink',
  gain = 0.25,
} = {}) {
  const buf = createStereoBuffer(duration_s, sampleRate);
  const rng = mulberry32(seed);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let brown = 0;

  for (let i = 0; i < buf.length; i++) {
    const whiteL = rng() * 2 - 1;
    const whiteR = rng() * 2 - 1;
    let outL = whiteL;
    let outR = whiteR;

    if (color === 'pink') {
      b0 = 0.99886 * b0 + whiteL * 0.0555179;
      b1 = 0.99332 * b1 + whiteL * 0.0750759;
      b2 = 0.96900 * b2 + whiteL * 0.1538520;
      b3 = 0.86650 * b3 + whiteL * 0.3104856;
      b4 = 0.55000 * b4 + whiteL * 0.5329522;
      b5 = -0.7616 * b5 - whiteL * 0.0168980;
      outL = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteL * 0.5362) * 0.11;
      b6 = whiteL * 0.115926;
      outR = outL * 0.92 + whiteR * 0.08;
    } else if (color === 'brown') {
      brown = (brown + 0.02 * whiteL) / 1.02;
      outL = brown * 3.5;
      outR = (brown + 0.015 * whiteR) * 3.5;
    }

    buf.left[i] = outL * gain;
    buf.right[i] = outR * gain;
  }
  return buf;
}

/**
 * RBJ Audio EQ Cookbook Biquad Filter with optional frequency sweep.
 */
export function biquadFilter(
  buffer,
  {
    type = 'lowpass',
    freq = 800,
    freqEnd = null,
    q = 0.707,
  } = {}
) {
  const sr = buffer.sampleRate || DEFAULT_SAMPLE_RATE;
  const len = buffer.length;
  const fStart = Math.max(20, Math.min(sr * 0.45, freq));
  const fFinal = freqEnd !== null ? Math.max(20, Math.min(sr * 0.45, freqEnd)) : fStart;

  const processChannel = (chan) => {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const u = i / Math.max(1, len - 1);
      const currentF = fStart * Math.pow(fFinal / fStart, u);
      const w0 = (2 * Math.PI * currentF) / sr;
      const cosw0 = Math.cos(w0);
      const sinw0 = Math.sin(w0);
      const alpha = sinw0 / (2 * Math.max(0.1, q));

      let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
      if (type === 'highpass') {
        b0 = (1 + cosw0) / 2;
        b1 = -(1 + cosw0);
        b2 = (1 + cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      } else if (type === 'bandpass') {
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      } else {
        // lowpass default
        b0 = (1 - cosw0) / 2;
        b1 = 1 - cosw0;
        b2 = (1 - cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      }

      const x0 = chan[i];
      const y0 =
        (b0 / a0) * x0 +
        (b1 / a0) * x1 +
        (b2 / a0) * x2 -
        (a1 / a0) * y1 -
        (a2 / a0) * y2;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = Number.isFinite(y0) ? y0 : 0;
      chan[i] = y1;
    }
  };

  processChannel(buffer.left);
  processChannel(buffer.right);
  return buffer;
}

/**
 * Detuned additive pad synth for cinematic tension beds.
 */
export function synthPad({
  freqs = [130.81, 196.0, 261.63, 311.13],
  duration_s = 8.0,
  sampleRate = DEFAULT_SAMPLE_RATE,
  attack = 1.2,
  release = 1.8,
  bright = 0.35,
  detune = 0.004,
  gain = 0.18,
} = {}) {
  const buf = createStereoBuffer(duration_s, sampleRate);
  const detuneFactors = [-1.5 * detune, -0.5 * detune, 0.5 * detune, 1.5 * detune];

  for (let i = 0; i < buf.length; i++) {
    const t = i / sampleRate;
    const env = envelopeADSR(t, duration_s, attack, 0.5, 0.85, release);
    let sumL = 0;
    let sumR = 0;

    for (let fIdx = 0; fIdx < freqs.length; fIdx++) {
      const baseF = freqs[fIdx];
      for (let d = 0; d < detuneFactors.length; d++) {
        const f = baseF * (1 + detuneFactors[d]);
        const phase = 2 * Math.PI * f * t + d * 1.1;
        const sig =
          Math.sin(phase) +
          bright * 0.45 * Math.sin(phase * 2) +
          bright * 0.2 * Math.sin(phase * 3);
        if (d % 2 === 0) sumL += sig;
        else sumR += sig;
      }
    }

    const norm = gain * env / Math.max(1, freqs.length * 2);
    buf.left[i] = sumL * norm;
    buf.right[i] = sumR * norm;
  }

  return buf;
}

/**
 * Crackle / debris texture generator.
 */
export function synthCrackle({
  duration_s = 2.0,
  sampleRate = DEFAULT_SAMPLE_RATE,
  seed = 77,
  rate = 45,
  gain = 0.3,
} = {}) {
  const buf = createStereoBuffer(duration_s, sampleRate);
  const rng = mulberry32(seed);
  const prob = rate / sampleRate;

  let env = 0;
  for (let i = 0; i < buf.length; i++) {
    if (rng() < prob) {
      env = 0.4 + 0.6 * rng();
    }
    env *= 0.992;
    const sample = (rng() * 2 - 1) * env * gain;
    buf.left[i] = sample;
    buf.right[i] = sample * 0.95;
  }
  return buf;
}

/**
 * Lightweight stereo Schroeder/Freeverb-style reverb.
 */
export function applyReverb(buffer, { decay = 0.72, mix = 0.28 } = {}) {
  const sr = buffer.sampleRate || DEFAULT_SAMPLE_RATE;
  const combDelays = [1116, 1188, 1277, 1356].map((d) =>
    Math.round((d * sr) / 44100)
  );

  const processSide = (input, offsetDelay) => {
    const out = new Float32Array(input.length);
    for (const baseD of combDelays) {
      const delay = baseD + offsetDelay;
      const combBuf = new Float32Array(delay);
      let idx = 0;
      for (let i = 0; i < input.length; i++) {
        const delayed = combBuf[idx];
        const next = input[i] + delayed * decay;
        combBuf[idx] = Number.isFinite(next) ? next : 0;
        out[i] += delayed * 0.25;
        idx = (idx + 1) % delay;
      }
    }
    for (let i = 0; i < input.length; i++) {
      input[i] = input[i] * (1 - mix) + out[i] * mix;
    }
  };

  processSide(buffer.left, 0);
  processSide(buffer.right, 23);
  return buffer;
}

/**
 * NEW: Multi-tap staggered sub-bass + debris destruction transient
 * Replicates the viral staggered SFX timing praised in @boltgameshq's comment section.
 */
export function staggeredDestructionHit(
  targetBuffer,
  {
    start_s = 0,
    taps = 4,
    spacing_s = 0.12,
    baseFreq = 68,
    gain = 0.55,
    seed = 303,
  } = {}
) {
  const sr = targetBuffer.sampleRate || DEFAULT_SAMPLE_RATE;
  const rng = mulberry32(seed);

  for (let tap = 0; tap < taps; tap++) {
    const tapOffset = start_s + tap * spacing_s + (rng() - 0.5) * 0.018;
    const tapDur = 0.55 + tap * 0.08;
    const hitBuf = createStereoBuffer(tapDur, sr);
    const f0 = baseFreq * Math.pow(0.92, tap);
    const pan = (tap % 2 === 0 ? -1 : 1) * (0.18 + 0.08 * tap);

    for (let i = 0; i < hitBuf.length; i++) {
      const t = i / sr;
      const pitchDrop = f0 * Math.exp(-t * 5.2) + 28;
      const sub = Math.sin(2 * Math.PI * pitchDrop * t) * Math.exp(-t * 6.5);
      const transient = (rng() * 2 - 1) * Math.exp(-t * 28.0) * 0.65;
      const val = (sub * 0.85 + transient * 0.45);
      hitBuf.left[i] = val;
      hitBuf.right[i] = val;
    }

    mixIn(targetBuffer, hitBuf, Math.max(0, tapOffset), gain * Math.pow(0.88, tap), pan);
  }
  return targetBuffer;
}

/**
 * NEW: Applies a 0.25-0.40s pre-impact acoustic vacuum (-24 dB duck)
 * immediately before major counterfactual shockwaves.
 */
export function applyPreImpactVacuum(
  targetBuffer,
  { at_s = 0, duration_s = 0.32, duckDb = -24 } = {}
) {
  const sr = targetBuffer.sampleRate || DEFAULT_SAMPLE_RATE;
  const startIdx = Math.max(0, Math.floor(at_s * sr));
  const endIdx = Math.min(targetBuffer.length - 1, Math.ceil((at_s + duration_s) * sr));
  const minGain = dbToGain(duckDb);
  const span = Math.max(1, endIdx - startIdx);

  for (let i = startIdx; i <= endIdx; i++) {
    const u = (i - startIdx) / span;
    // Fast 15% ramp down, hold at -24 dB, sharp release on impact frame
    let env = minGain;
    if (u < 0.18) {
      env = 1.0 - (1.0 - minGain) * (u / 0.18);
    } else if (u > 0.88) {
      env = minGain + (1.0 - minGain) * ((u - 0.88) / 0.12);
    }
    targetBuffer.left[i] *= env;
    targetBuffer.right[i] *= env;
  }
  return targetBuffer;
}

/**
 * NEW: Tense simulation countdown / telemetry tick pulse.
 */
export function countdownPulse(
  targetBuffer,
  {
    start_s = 0,
    duration_s = 6.0,
    bpm = 120,
    freq = 220,
    gain = 0.22,
  } = {}
) {
  const sr = targetBuffer.sampleRate || DEFAULT_SAMPLE_RATE;
  const step_s = 60 / Math.max(30, bpm);

  for (let t = start_s; t < start_s + duration_s; t += step_s) {
    const tickDur = 0.09;
    const tick = createStereoBuffer(tickDur, sr);
    for (let i = 0; i < tick.length; i++) {
      const localT = i / sr;
      const env = Math.exp(-localT * 42);
      const s =
        (Math.sin(2 * Math.PI * freq * localT) +
          0.4 * Math.sin(2 * Math.PI * freq * 2.5 * localT)) *
        env;
      tick.left[i] = s;
      tick.right[i] = s;
    }
    mixIn(targetBuffer, tick, t, gain, 0);
  }
  return targetBuffer;
}

// Earlier API (SR, dB, NOTE, stereo, mixMono, pad, noise, filter, reverb, ...) for soundtracks written against it.
export * from './synthLegacy.mjs';
