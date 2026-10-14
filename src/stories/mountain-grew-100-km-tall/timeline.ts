// Absolute film times (s) for picture events, taken from the measured narration word timings
// (build/mountain-grew-100-km-tall/audio/narration.json) so every reveal lands on its word.
export const T = {
  jolt: 1.0, birds: 1.2, growStart: 0.8, horizon: 2.17, climbWord: 3.27,
  hundred: 5.55, everests: 7.19, ringsStart: 7.7, ankles: 9.13,
  passEverest: 13.69, third: 15.43,
  boils: 18.51, bodyTemp: 19.21, saliva: 21.01,
  black: 24.47, eighty: 25.59, meteors: 26.21,
  space: 29.03, deathZone: 31.91,
  wall: 34.03, drowns: 37.35, desert: 39.37,
  feels: 42.53, crushes: 45.65, vacuum: 45.33,
  flows: 47.99, sinks: 49.05, flat: 50.61, where: 51.91,
  end: 55,
};
/** Staggered fracture bursts after the vacuum (s). */
export const CRACKS = [45.65, 45.79, 45.93, 46.08];
/** Peak growth (fraction of 100 km) through the opening: 0 → 0.45 in S01, → 1 by 6.6 s in orbit. */
export function growAt(t: number): number {
  if (t < 0.8) return 0;
  if (t < 4.2) { const u = (t - 0.8) / 3.4; return 0.45 * u * u * (1.6 - 0.6 * u); }
  if (t < 6.6) { const u = (t - 4.2) / 2.4; return 0.45 + 0.55 * (1 - Math.pow(1 - u, 2.2)); }
  return 1;
}
