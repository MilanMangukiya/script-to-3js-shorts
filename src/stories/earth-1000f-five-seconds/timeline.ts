import T from './timeline.json';
export { T };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** Slow-motion factor while the air is hot: five event seconds fill the film from 'hit' to 'end'. */
export const SLOW = (T.end - T.hit) / 5;
/** World (event) time: normal before the hit, slowed during the five seconds, normal again after. */
export function worldTime(t: number) {
  if (t < T.hit) return t;
  if (t < T.end) return T.hit + (t - T.hit) / SLOW;
  return T.hit + 5 + (t - T.end);
}
/** Event clock: seconds since the air hit 1000 °F (negative before). */
export const tau = (t: number) => worldTime(t) - T.hit;
export const hot = (t: number) => t >= T.hit && t < T.end;
const F = (c: number) => c * 9 / 5 + 32;
/** Exposed skin surface: semi-infinite solid under ~15 kW/m2, so the rise grows with the square root of time. */
export const skinF = (k: number) => F(34 + 34 * Math.sqrt(clamp01(k / 5)) - (k > 5 ? 20 * (1 - Math.exp(-(k - 5) / 4)) : 0));
/** A leaf (~0.6 kJ/m2K) approaches the 538 °C air until its water boils at 100 °C. */
export const leafF = (k: number) => F(k <= 0 ? 25 : Math.min(100, 25 + 513 * (1 - Math.exp(-k / 6.5))));
/** Thin paper (~0.06 kJ/m2K) tracks the air within about a second. */
export const paperF = (k: number) => F(k <= 0 ? 25 : 25 + 513 * (1 - Math.exp(-k / 1.0)));
/** Jogger distance along the path (world time): steady 3 m/s, braking to a stop while covering the face. */
export function joggerZ(w: number) {
  const d0 = T.hit + T.decel[0], d1 = T.hit + T.decel[1], v = T.runSpeed, len = d1 - d0;
  if (w <= d0) return T.joggerStartZ - v * w;
  const u = Math.min(w - d0, len);
  return T.joggerStartZ - v * d0 - (v * u - .5 * (v / len) * u * u);
}
