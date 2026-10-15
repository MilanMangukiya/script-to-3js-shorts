import T from './timeline.json';
export { T };
/** All state evaluates from these absolute film times. */
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
export const DEG = Math.PI / 180;
/** Scattered skylight left in the noon scenes: 1 before the event, 0 after. */
export const skyAmountAt = (t: number) => 1 - windowAt(t, T.drain0, T.drain1);
/** True solar altitude (deg): the top limb meets the sea horizon at sunset and the dawn horizon at sunrise. */
export const sunsetAltitude = (t: number) => T.seaHorizonDeg - T.sunRadiusDeg - T.sunRateDegPerS * (t - T.sunset);
export const sunriseAltitude = (t: number) => T.dawnHorizonDeg - T.sunRadiusDeg + T.sunRateDegPerS * (t - T.sunrise);
/** Clock minutes at 30°N on an equinox: 0.214 deg/s of film is about 0.99 real minutes per film second. */
const MIN_PER_S = T.sunRateDegPerS / (15 * Math.cos(30 * DEG) / 60);
export const clockLabel = (t: number, anchor_s: number, anchorMinutes: number) => {
  const m = Math.floor(anchorMinutes + (t - anchor_s) * MIN_PER_S);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
};
/** Car speed (m/s) and camera z in S05: constant speed, then uniform braking to the stop line. */
export function carState(t: number) {
  const v = T.carSpeed, a = v / 1.59, tb = T.s05Brake, zb = T.carStopZ + v * v / (2 * a);
  if (t <= tb) return { v, z: zb + v * (tb - t) };
  const u = Math.min(t - tb, v / a);
  return { v: Math.max(0, v - a * u), z: zb - (v * u - 0.5 * a * u * u) };
}
