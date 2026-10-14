/** Absolute film seconds, shared with the procedural soundtrack and storyboard. */
export const T = { vanish: .65, collision: 12, secondCollision: 12.12, harbour: 15.8,
  clinic: 21.1, rehook: 26.7, birth: 32.8, storage: 39.8, rebuild: 45.8, rewind: 52, end: 55 };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
