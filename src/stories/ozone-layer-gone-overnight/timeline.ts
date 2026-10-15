import T from './timeline.json';
export { T };
/** All state evaluates from these absolute film times. */
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** The service hatch slides shut between hatch0 and hatch1 (S06). */
export const hatchClosure = (t: number) => windowAt(t, T.hatch0, T.hatch1);
/** UV index at the counter: direct sun and open sky through the hatch, then only what passes the glass. */
export const uvAtCounter = (t: number) => T.uvBehindGlass + (T.uvIndoorOpen - T.uvBehindGlass) * Math.sqrt(1 - hatchClosure(t));
export const uvOutside = () => T.uvOutside;
/** A 0-16 meter: pinned (with a small tremble) whenever the true index exceeds the scale. */
export function meterValue(t: number, scene: string) {
  const pin = (uv: number, k: number) => uv >= 16 ? 15.86 + .14 * Math.sin(t * 47 + k) : uv;
  if (scene <= 'S02') return 0;
  if (scene <= 'S04') {
    if (t < T.meterOn) return 0;
    const u = (t - T.meterOn) / (T.meterPin - T.meterOn);
    return u < 1 ? 16 * u * u : pin(99, 1);
  }
  if (scene === 'S05') return pin(T.uvShade, 2);
  if (scene === 'S06') {
    // Pinned until the seal, then a damped swing down to the glass-filtered reading.
    if (t < T.hatch1) return pin(99, 3);
    const u = t - T.hatch1;
    return Math.max(0, Math.min(16, T.uvBehindGlass + 14 * Math.exp(-u * 5) * Math.cos(u * 8)));
  }
  return T.uvBehindGlass;
}
/** Time to a sunburn dose (s) while stepping into awning shade in S05: full sun, then only the scattered sky. */
export const burnTimeS05 = (t: number) => T.burnSeconds + (T.burnShade - T.burnSeconds) * windowAt(t, T.bounds[4] + .4, T.shade);
/** Sunburn doses (1 = minimal erythema dose for fair skin) the reader has absorbed by time t. */
export const readerDoses = (t: number) => T.doseAtS04 + (t - T.bounds[3]) / T.burnSeconds;
