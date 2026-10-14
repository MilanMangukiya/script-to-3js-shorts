// Deterministic math helpers shared by every library component. No module-global mutable state.

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
/** 0→1 ramp between two absolute times with smoothstep easing. */
export const ramp = (t: number, t0: number, t1: number) => smoothstep(t0, t1, t);
/** Damped overshoot settle: 0 at x=0, converges to 1. */
export const settle = (x: number, freq = 9, damp = 5) => (x <= 0 ? 0 : 1 - Math.exp(-damp * x) * Math.cos(freq * x));

/** Seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash2 = (x: number, y: number, seed: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Smooth value noise in [0,1]. */
export function vnoise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

export function fbm2(x: number, y: number, seed = 0, octaves = 5, gain = 0.5, lac = 2.03): number {
  let amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise2(x, y, seed + i * 31);
    norm += amp; x = x * lac + 17.1; y = y * lac + 9.2; amp *= gain;
  }
  return sum / norm;
}

/** Ridged multifractal in [0,1], good for mountain crests. */
export function ridged2(x: number, y: number, seed = 0, octaves = 6): number {
  let amp = 0.5, sum = 0, norm = 0, prev = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(vnoise2(x, y, seed + i * 53) * 2 - 1);
    n *= n;
    sum += amp * n * prev; norm += amp; prev = clamp(n * 1.6);
    x = x * 2.07 + 3.3; y = y * 2.07 + 7.7; amp *= 0.5;
  }
  return sum / norm;
}

/** Smooth deterministic 1D wobble in [-1,1] built from incommensurate sines. */
export const wobble = (t: number, seed = 0) =>
  (Math.sin(t * 1.0 + seed * 1.7) + Math.sin(t * 2.31 + seed * 4.1) * 0.6 + Math.sin(t * 5.13 + seed * 9.3) * 0.3) / 1.9;

/** Same generator as rng (mulberry32), under the name some modules import. */
export const mulberry32 = rng;
