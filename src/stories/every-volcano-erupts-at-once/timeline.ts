import T from './timeline.json';
export { T };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
export type Era = 'morning' | 'flank' | 'ashfall' | 'day3' | 'nextSummer';
/** Which state of the street/volcano world a scene shows. */
export function eraOf(sceneId: string): Era {
  return sceneId === 'S03' ? 'flank' : sceneId === 'S04' ? 'ashfall' : sceneId === 'S05' ? 'day3' : sceneId === 'S09' ? 'nextSummer' : 'morning';
}
/** Arc length (m) reached by the S03 ash-flow front: 42 m/s (150 km/h) down the gully. */
export const pdcFront = (t: number) => T.pdcFront0 + T.pdcSpeed * (t - T.s03Cut);
/** Down-slope advance (m) of the S03 lava lobe since the scene began: 0.3 m/s (about 1 km/h). */
export const lavaAdvance = (t: number) => T.lavaSpeed * (t - T.bounds[2]);
/** Lightning in the S01 column: brief flashes at the listed times. */
export const flashAt = (t: number) => T.flashes.reduce((m: number, f: number) => Math.max(m, t >= f && t < f + 0.16 ? (1 - (t - f) / 0.16) * (0.6 + 0.4 * Math.sin((t - f) * 90)) : 0), 0);
