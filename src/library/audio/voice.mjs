// Voice finishing for synthesized narration (all local, deterministic DSP; no time shifts, so caption timing holds):
//  - integratedLoudness(): ITU-R BS.1770-4 K-weighted, gated loudness of a mono clip (LUFS), for matching scenes;
//  - voiceChain(): rumble high-pass, low-mid clean-up, presence lift, air shelf, split-band de-esser and soft-knee
//    compression, so every scene and cast voice sounds broadcast-clear and consistent before mixing;
//  - addRoom(): a subtle small-room ambience by FFT convolution with a seeded impulse response (sparse early
//    reflections + a diffuse tail whose highs die first), which sits the dry synthetic voice in a space without the
//    metallic flutter of a short comb reverb.
import { filter, eq, rng } from './synth.mjs';

function envelope(x, sr, attack, release) {
  const a = Math.exp(-1 / (attack * sr)), r = Math.exp(-1 / (release * sr)), e = new Float32Array(x.length); let v = 0;
  for (let i = 0; i < x.length; i++) { const s = Math.abs(x[i]); v = s > v ? a * v + (1 - a) * s : r * v + (1 - r) * s; e[i] = v; }
  return e;
}
/** Soft-knee compressor: threshold (dBFS of the envelope), ratio, knee (dB); returns a new signal and, via `stats`,
 *  the mean gain reduction (dB) over samples where it was active. */
export function compress(x, sr, { threshold = -22, ratio = 2.5, knee = 6, attack = 0.006, release = 0.09, makeup = 0 } = {}, stats = {}) {
  const env = envelope(x, sr, attack, release), y = new Float32Array(x.length);
  let sum = 0, active = 0;
  for (let i = 0; i < x.length; i++) {
    const lvl = 20 * Math.log10(env[i] + 1e-9), over = lvl - threshold;
    const gr = over <= -knee / 2 ? 0 : over >= knee / 2 ? over * (1 - 1 / ratio) : (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee);
    if (gr > 0.05) { sum += gr; active++; }
    y[i] = x[i] * Math.pow(10, (makeup - gr) / 20);
  }
  stats.meanReductionDb = active ? sum / active : 0; stats.activeFraction = active / Math.max(1, x.length);
  return y;
}
/** De-esser: compress only the band above `split` Hz when its envelope exceeds the threshold. */
export function deEss(x, sr, { split = 5200, threshold = -32, ratio = 4 } = {}, stats = {}) {
  const hi = filter(filter(x, 'highpass', split, 0.707, sr), 'highpass', split, 0.707, sr), y = new Float32Array(x.length);
  const hc = compress(hi, sr, { threshold, ratio, knee: 4, attack: 0.002, release: 0.05 }, stats);
  for (let i = 0; i < x.length; i++) y[i] = x[i] - hi[i] + hc[i];
  return y;
}

/** Leveled input level the chain's thresholds are set for (see `levelTo`). */
export const VOICE_TARGET_LUFS = -18;
/**
 * Broadcast voice chain for speech already leveled near VOICE_TARGET_LUFS: 24 dB/oct rumble cut, −2.2 dB boxiness dip,
 * +2.4 dB presence, +1 dB air, de-essing of sibilants only, then ~4 dB of soft-knee compression (4 ms attack, so
 * transients do not poke out; tuned on leveled Kokoro speech, see build/voice-finish-review).
 * `stats` receives { deEssDb, compressionDb } (mean gain reduction while active).
 */
export function voiceChain(x, sr, stats = {}) {
  let y = filter(filter(x, 'highpass', 72, 0.707, sr), 'highpass', 72, 0.707, sr);
  y = eq(y, 'peaking', 290, -2.2, 1.0, sr);
  y = eq(y, 'peaking', 3300, 2.4, 0.85, sr);
  y = eq(y, 'highshelf', 9800, 1.0, 0.7, sr);
  const ds = {}, cs = {};
  y = deEss(y, sr, { split: 5200, threshold: -29, ratio: 4 }, ds);
  y = compress(y, sr, { threshold: -22, ratio: 2.2, knee: 8, attack: 0.004, release: 0.12 }, cs);
  stats.deEssDb = ds.meanReductionDb; stats.compressionDb = cs.meanReductionDb;
  return y;
}

// ---- BS.1770 loudness ------------------------------------------------------------------------------------------
function biquad(x, [b0, b1, b2, a0, a1, a2]) {
  const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
/** K-weighting at any sample rate (the BS.1770 pre-filter and RLB high-pass, as parameterised in pyloudnorm). */
function kWeight(x, sr) {
  const shelf = (G, Q, fc) => { const A = 10 ** (G / 40), w = 2 * Math.PI * fc / sr, c = Math.cos(w), al = Math.sin(w) / (2 * Q), s = 2 * Math.sqrt(A) * al;
    return [A * ((A + 1) + (A - 1) * c + s), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - s), (A + 1) - (A - 1) * c + s, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - s]; };
  const highpass = (Q, fc) => { const w = 2 * Math.PI * fc / sr, c = Math.cos(w), al = Math.sin(w) / (2 * Q); return [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al]; };
  return biquad(biquad(x, shelf(3.99984385397, 0.7071752369554193, 1681.9744509555319)), highpass(0.5003270373253953, 38.13547087613982));
}
/** Integrated loudness (LUFS) of a mono signal: 400 ms blocks, 75 % overlap, −70 LUFS absolute and −10 LU relative gates. */
export function integratedLoudness(x, sr) {
  const k = kWeight(x, sr), block = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), L = (ms) => -0.691 + 10 * Math.log10(ms);
  const cs = new Float64Array(k.length + 1);
  for (let i = 0; i < k.length; i++) cs[i + 1] = cs[i] + k[i] * k[i];
  if (k.length < block) return k.length ? L(cs[k.length] / k.length) : -Infinity;
  const z = [];
  for (let s = 0; s + block <= k.length; s += hop) z.push((cs[s + block] - cs[s]) / block);
  const mean = (a) => a.reduce((n, v) => n + v, 0) / a.length;
  const abs = z.filter((m) => L(m) > -70);
  if (!abs.length) return -Infinity;
  const rel = L(mean(abs)) - 10, gated = abs.filter((m) => L(m) > rel);
  return L(mean(gated));
}
/** Gain (linear) that brings a clip to `target` LUFS, limited to ±`maxDb` so a near-silent clip is never blown up. */
export function levelTo(x, sr, target = VOICE_TARGET_LUFS, maxDb = 18) {
  const lufs = integratedLoudness(x, sr);
  if (!Number.isFinite(lufs)) return { gain: 1, lufs, gainDb: 0 };
  const gainDb = Math.max(-maxDb, Math.min(maxDb, target - lufs));
  return { gain: 10 ** (gainDb / 20), lufs, gainDb };
}

// ---- Room ---------------------------------------------------------------------------------------------------------
/** In-place iterative radix-2 complex FFT (length a power of two). */
function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < half; j++) {
        const p = i + j, q = p + half, br = re[q] * cr - im[q] * ci, bi = re[q] * ci + im[q] * cr;
        re[q] = re[p] - br; im[q] = im[p] - bi; re[p] += br; im[p] += bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
/** Linear convolution by FFT overlap-add; the output has the input's length (the tail past the end is dropped). */
export function convolve(x, h) {
  let n = 1; while (n < 2 * h.length) n <<= 1;
  const step = n - h.length + 1, Hr = new Float64Array(n), Hi = new Float64Array(n), out = new Float32Array(x.length);
  Hr.set(h); fft(Hr, Hi);
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let s = 0; s < x.length; s += step) {
    re.fill(0); im.fill(0);
    const end = Math.min(x.length, s + step);
    for (let i = s; i < end; i++) re[i - s] = x[i];
    fft(re, im);
    for (let i = 0; i < n; i++) { const r = re[i] * Hr[i] - im[i] * Hi[i]; im[i] = re[i] * Hi[i] + im[i] * Hr[i]; re[i] = r; }
    fft(re, im, true);
    const lim = Math.min(n, x.length - s);
    for (let i = 0; i < lim; i++) out[s + i] += re[i];
  }
  return out;
}
/** Seeded small-room impulse response without the direct sound, normalised to unit energy. */
export function roomImpulse(sr, { rt60 = 0.3, predelay = 0.003, seed = 7 } = {}) {
  const n = Math.ceil(rt60 * 1.3 * sr), ir = new Float64Array(n), r = rng(seed);
  // Sparse early reflections (walls, desk, ceiling) at 4–30 ms with alternating polarity and falling level.
  const early = [[0.0041, 0.46], [0.0068, -0.36], [0.0093, 0.29], [0.0127, -0.25], [0.0158, 0.21], [0.0197, -0.17], [0.0239, 0.14], [0.0284, -0.11]];
  for (const [t, g] of early) {
    const i = Math.round((t + predelay) * sr);
    for (let k = -1; k <= 1; k++) if (i + k >= 0 && i + k < n) ir[i + k] += g * (k === 0 ? 0.6 : 0.2) * (0.9 + 0.2 * r());
  }
  // Diffuse tail: filtered noise under an exponential decay, its cutoff falling with time (air and soft furnishings).
  let lp = 0;
  const t0 = 0.012;
  for (let i = Math.round(t0 * sr); i < n; i++) {
    const t = i / sr, rise = Math.min(1, (t - t0) / 0.018), env = Math.exp(-6.9078 * t / rt60) * rise * rise;
    const fc = 1400 + 6600 * Math.exp(-t / 0.08), a = 1 - Math.exp(-2 * Math.PI * Math.min(fc, sr * 0.45) / sr);
    lp += a * ((r() * 2 - 1) - lp);
    ir[i] += lp * env * 0.6;
  }
  let e = 0; for (const v of ir) e += v * v;
  const g = 1 / Math.sqrt(e || 1);
  return Float64Array.from(ir, (v) => v * g);
}
/** Dry voice plus a room return `mix` (energy ratio; 0.1 ≈ −20 dB) from roomImpulse(). */
export function addRoom(x, sr, { mix = 0.1, ...room } = {}) {
  const wet = convolve(x, roomImpulse(sr, room)), y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] + wet[i] * mix;
  return y;
}
