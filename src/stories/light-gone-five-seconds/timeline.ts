import T from './timeline.json';
export { T };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** Piecewise-linear lookup through [x, y] keys, held flat outside them. */
export function keyed(keys: number[][], x: number) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [a, va] = keys[i], [b, vb] = keys[i + 1]; if (x <= b) return va + (vb - va) * (x - a) / (b - a); }
  return keys[keys.length - 1][1];
}
/** End of the five seconds without light. */
export const dark1 = () => T.dark0 + T.darkS;
/** True while no light exists anywhere. */
export const isDark = (t: number) => t >= T.dark0 && t < dark1();
/** Story seconds since light came back (drives the sunlight countdown; the film compresses the 8 minutes). */
export const tauAt = (t: number) => (t < dark1() ? 0 : keyed(T.tauKeys, t));
/** Seconds of sunlight still in transit. */
export const sunLeft = (t: number) => Math.max(0, T.sunTravelS - tauAt(t));
/** Daylight is back once the sunlight has crossed the gap. */
export const daylight = (t: number) => t < T.dark0 || t >= T.sunBack;
/**
 * Fraction of full sunlight: 1 before the dark, 0 until the new light arrives, then the Sun's disc refills from the centre
 * out over 2.32 s (its radius in light-seconds); with limb darkening (I = 0.4 + 0.6 mu) half the light is back in 0.6 s.
 */
export function sunFill(t: number) {
  if (t < T.dark0) return 1;
  if (t < T.sunBack) return 0;
  const m = 1 - clamp01((t - T.sunBack) / 2.32);
  return (1 - m * m + 1 - m * m * m) / 2;
}
/** Years since the dark, for the returning stars (S08). */
export const yearsAt = (t: number) => keyed(T.yearKeys, t);
