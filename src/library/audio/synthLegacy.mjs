// Earlier audio toolkit API (SR, dB, NOTE, stereo, pad, noise, filter, ...), kept unchanged for the soundtracks written
// against it; synth.mjs re-exports everything here that it does not define itself.
// Procedural audio toolkit (pure JS, deterministic): oscillator pads, coloured noise, biquad filters, reverb and
// mix helpers for original music beds and sound effects. No samples, no network. Runs in Node.
export const SR = 48000;
export const dB = (x) => Math.pow(10, x / 20);
export const NOTE = (name) => { // e.g. "D2", "F#3", "Bb1" → Hz (A4 = 440)
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name); const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (semis + (Number(m[3]) - 4) * 12) / 12);
};

/** Seeded PRNG (mulberry32). */
export function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const stereo = (seconds, sr = SR) => ({ L: new Float32Array(Math.ceil(seconds * sr)), R: new Float32Array(Math.ceil(seconds * sr)), sr });

/** Mix a mono Float32Array into a stereo buffer at a time offset with equal-power pan (-1..1). */
export function mixMono(dst, mono, at_s, gain = 1, pan = 0) {
  const o = Math.round(at_s * dst.sr), a = (pan + 1) * Math.PI / 4, gl = Math.cos(a) * gain * Math.SQRT2, gr = Math.sin(a) * gain * Math.SQRT2;
  for (let i = 0; i < mono.length; i++) { const j = o + i; if (j < 0) continue; if (j >= dst.L.length) break; dst.L[j] += mono[i] * gl; dst.R[j] += mono[i] * gr; }
}
export function mixStereo(dst, src, at_s = 0, gain = 1) {
  const o = Math.round(at_s * dst.sr);
  for (let i = 0; i < src.L.length; i++) { const j = o + i; if (j < 0) continue; if (j >= dst.L.length) break; dst.L[j] += src.L[i] * gain; dst.R[j] += src.R[i] * gain; }
}
/** Multiply a stereo buffer by a time-varying gain function g(t_seconds). */
export function automate(buf, g) { for (let i = 0; i < buf.L.length; i++) { const k = g(i / buf.sr); buf.L[i] *= k; buf.R[i] *= k; } return buf; }

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Raised-cosine attack/release envelope over a duration. */
export const envAR = (t, dur, attack, release) => smooth(0, attack, t) * (1 - smooth(dur - release, dur, t));

/** Coloured noise: 'white' | 'pink' | 'brown'. */
export function noise(n, rand, color = 'white') {
  const x = new Float32Array(n);
  if (color === 'white') { for (let i = 0; i < n; i++) x[i] = rand() * 2 - 1; return x; }
  if (color === 'brown') { let v = 0; for (let i = 0; i < n; i++) { v = (v + (rand() * 2 - 1) * 0.02) * 0.998; x[i] = v * 3.5; } return x; }
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; // Paul Kellet's pink filter coefficients (public domain)
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return x;
}

/** RBJ biquad. `freq` may be a number or a function of time (seconds) for sweeps; type: lowpass | highpass | bandpass. */
export function filter(x, type, freq, q = 0.707, sr = SR) {
  const y = new Float32Array(x.length), fn = typeof freq === 'function' ? freq : null;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (f) => {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    if (type === 'lowpass') { b0 = (1 - c) / 2 / a0; b1 = (1 - c) / a0; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + c) / 2 / a0; b1 = -(1 + c) / a0; b2 = b0; }
    else { b0 = al / a0; b1 = 0; b2 = -al / a0; }
    a1 = -2 * c / a0; a2 = (1 - al) / a0;
  };
  set(fn ? fn(0) : freq);
  for (let i = 0; i < x.length; i++) {
    if (fn && (i & 63) === 0) set(fn(i / sr));
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/**
 * Soft stereo pad chord: detuned additive voices with slow per-voice breathing.
 * @param o { freqs:number[], dur, attack, release, bright (harmonic roll-off exponent; higher = darker), detune (cents), seed, sr }
 */
export function pad(o) {
  const sr = o.sr ?? SR, n = Math.ceil(o.dur * sr), out = stereo(o.dur, sr), rand = rng(o.seed ?? 1);
  const bright = o.bright ?? 1.9, det = o.detune ?? 7, harmonics = o.harmonics ?? 5;
  for (const f of o.freqs) {
    for (let v = 0; v < 3; v++) {
      const cents = (v - 1) * det + (rand() - 0.5) * 2, fv = f * Math.pow(2, cents / 1200), pan = (v - 1) * 0.6 + (rand() - 0.5) * 0.3;
      const lfoF = 0.07 + rand() * 0.12, lfoP = rand() * 6.283, ph0 = rand() * 6.283;
      const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4), w = 2 * Math.PI * fv / sr;
      const hmax = Math.min(harmonics, Math.floor(sr * 0.4 / fv));
      for (let i = 0; i < n; i++) {
        const t = i / sr; let s = 0;
        for (let h = 1; h <= hmax; h++) s += Math.sin(w * h * i + ph0 * h) / Math.pow(h, bright);
        s *= (0.72 + 0.28 * Math.sin(2 * Math.PI * lfoF * t + lfoP)) * envAR(t, o.dur, o.attack ?? 2, o.release ?? 2);
        out.L[i] += s * gl; out.R[i] += s * gr;
      }
    }
  }
  const norm = 1 / (o.freqs.length * 3 * 0.9);
  for (let i = 0; i < n; i++) { out.L[i] *= norm; out.R[i] *= norm; }
  return out;
}

/** Freeverb-style stereo reverb (comb bank + allpasses). Returns a new wet+dry buffer extended by the tail. */
export function reverb(buf, { decay = 2.2, mix = 0.3, damp = 0.35, tail = 3 } = {}) {
  const sr = buf.sr, k = sr / 44100, n = buf.L.length + Math.ceil(tail * sr), out = { L: new Float32Array(n), R: new Float32Array(n), sr };
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  const run = (x, spread) => {
    const wet = new Float32Array(n);
    for (const c of combs) {
      const len = Math.round((c + spread) * k), line = new Float32Array(len), fb = Math.pow(10, (-3 * len / sr) / decay); let p = 0, lp = 0;
      for (let i = 0; i < n; i++) { const y = line[p]; lp = y * (1 - damp) + lp * damp; line[p] = (i < x.length ? x[i] : 0) + lp * fb; wet[i] += y; if (++p >= len) p = 0; }
    }
    for (const a of aps) {
      const len = Math.round((a + spread) * k), line = new Float32Array(len); let p = 0;
      for (let i = 0; i < n; i++) { const b = line[p], v = wet[i]; line[p] = v + b * 0.5; wet[i] = b - v; if (++p >= len) p = 0; }
    }
    return wet;
  };
  const wl = run(buf.L, 0), wr = run(buf.R, 23), g = mix / combs.length * 1.6;
  for (let i = 0; i < n; i++) { out.L[i] = (i < buf.L.length ? buf.L[i] * (1 - mix * 0.5) : 0) + wl[i] * g; out.R[i] = (i < buf.R.length ? buf.R[i] * (1 - mix * 0.5) : 0) + wr[i] * g; }
  return out;
}

/** Shape a mono signal with an envelope function e(t). */
export function shape(x, e, sr = SR) { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * e(i / sr); return y; }
/** Sine with optional frequency function f(t) (phase-continuous). */
export function tone(dur, freq, sr = SR) { const n = Math.ceil(dur * sr), y = new Float32Array(n), fn = typeof freq === 'function' ? freq : () => freq; let ph = 0; for (let i = 0; i < n; i++) { ph += 2 * Math.PI * fn(i / sr) / sr; y[i] = Math.sin(ph); } return y; }
/** Random short filtered clicks (fire crackle, pebbles, rain ticks). rate = events per second. */
export function crackle(dur, rate, rand, { lo = 900, hi = 5200, sr = SR } = {}) {
  const n = Math.ceil(dur * sr), y = new Float32Array(n);
  let t = 0;
  while (t < dur) {
    t += -Math.log(1 - rand()) / rate;
    const len = Math.round((0.002 + rand() * 0.012) * sr), o = Math.round(t * sr), g = Math.pow(rand(), 2.2), f = lo + rand() * (hi - lo);
    let ph = 0;
    for (let i = 0; i < len && o + i < n; i++) { ph += 2 * Math.PI * f / sr; y[o + i] += (rand() * 2 - 1 + Math.sin(ph)) * 0.5 * g * Math.exp(-i / (len * 0.35)); }
  }
  return y;
}
/** Peak of a stereo buffer. */
export const peak = (b) => { let m = 0; for (let i = 0; i < b.L.length; i++) m = Math.max(m, Math.abs(b.L[i]), Math.abs(b.R[i])); return m; };

/** RBJ peaking / shelving EQ: type 'peaking' | 'lowshelf' | 'highshelf', gain in dB (used by the voice finishing chain). */
export function eq(x, type, freq, gainDb, q = 0.9, sr = SR) {
  const A = Math.pow(10, gainDb / 40), w = 2 * Math.PI * Math.min(freq, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'peaking') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else { const sq = 2 * Math.sqrt(A) * al, k = type === 'lowshelf' ? -1 : 1;   // RBJ cookbook shelves (k = +1 high, −1 low)
    b0 = A * ((A + 1) + k * (A - 1) * c + sq); b1 = -k * 2 * A * ((A - 1) + k * (A + 1) * c); b2 = A * ((A + 1) + k * (A - 1) * c - sq);
    a0 = (A + 1) - k * (A - 1) * c + sq; a1 = k * 2 * ((A - 1) - k * (A + 1) * c); a2 = (A + 1) - k * (A - 1) * c - sq; }
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
