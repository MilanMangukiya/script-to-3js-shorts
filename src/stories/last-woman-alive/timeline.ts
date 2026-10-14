/** All state evaluates from these absolute film times. */
export const T = { vanish: .65, cup: 1.35, phone: 1.47, lid: 1.59, collision: 12,
  care: 13.2, call: 16.5, storage: 22, embryos: 28, wombResearch: 34.5,
  daughter: 41, choice: 48, rewind: 52, end: 55 };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
