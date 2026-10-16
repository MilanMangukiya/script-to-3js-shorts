import * as THREE from 'three';
import T from './timeline.json';
export { T };

export const DEG = Math.PI / 180;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const B = T.bounds;

/** Sea level relative to normal (m) on the night of the pass, from the story clock (hours). */
export function tideRel(clock: number) {
  const k = T.tide, x = Math.PI * clamp01((clock - k.lowClock) / k.riseHours);
  return k.lowRel + (k.highRel - k.lowRel) * (1 - Math.cos(x)) / 2;
}
/** Story clock at which the sea reaches the quay top. */
export const OVER_CLOCK = (() => {
  const k = T.tide, need = (k.quayTop - k.meanSeaY - k.lowRel) / (k.highRel - k.lowRel);
  return k.lowClock + k.riseHours * Math.acos(1 - 2 * need) / Math.PI;
})();
/** Story clock (hours, 24+ after midnight) for film time t, per scene. */
export function clockAt(t: number): number {
  const c = T.clock;
  if (t < B[1]) return lerp(c.S01[0], c.S01[1], t / B[1]);
  if (t < B[2]) return lerp(c.S02[0], c.S02[1], (t - B[1]) / (B[2] - B[1]));
  if (t < B[3]) return lerp(c.S03[0], c.S03[1], (t - B[2]) / (B[3] - B[2]));
  if (t < B[4]) {
    if (t < T.over) return lerp(c.S04[0], OVER_CLOCK, ease((t - B[3]) / (T.over - B[3])) * 0.35 + 0.65 * (t - B[3]) / (T.over - B[3]));
    return lerp(OVER_CLOCK, c.S04[1], (t - T.over) / (B[4] - T.over));
  }
  if (t < B[5]) return lerp(c.S05[0], c.S05[1], (t - B[4]) / (B[5] - B[4]));
  return 20.5;
}
/** World sea level y for the night scenes (S01-S05). */
export function seaY(t: number) {
  const c = clockAt(t);
  // From dusk the harbour is still draining toward low water at 18:54.
  const rel = c < T.tide.lowClock ? lerp(-3.9, T.tide.lowRel, ease((c - T.clock.S01[0]) / (T.tide.lowClock - T.clock.S01[0]))) : tideRel(c);
  return T.tide.meanSeaY + rel;
}
export const seaRel = (t: number) => seaY(t) - T.tide.meanSeaY;

/** Horizontal sky direction convention: azimuth from north, clockwise; world -Z = east (90), +X = south (180). */
export function skyDir(azDeg: number, altDeg: number, out = new THREE.Vector3()) {
  const th = (azDeg - 90) * DEG, a = altDeg * DEG;
  return out.set(Math.sin(th) * Math.cos(a), Math.sin(a), -Math.cos(th) * Math.cos(a));
}
/** Altitude/azimuth (deg) of a body with declination `dec` at hour angle from its culmination clock. */
export function altAz(clock: number, dec: number, culm: number): [number, number] {
  const lat = T.lat * DEG, d = dec * DEG, H = (clock - culm) * 15 * DEG;
  const alt = Math.asin(Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(d) * Math.cos(lat)) + Math.PI;
  return [((az / DEG) % 360 + 360) % 360, alt / DEG];
}
export const rogueAltAz = (clock: number) => altAz(clock, T.rogue.dec, T.rogue.culmination);
/** Rogue angular diameter (deg) during the night (it is still approaching). */
export const rogueDiam = (clock: number) => lerp(T.rogue.diamEarly, T.rogue.diamLate, clamp01((clock - 18.6) / 6.4));
/** The Sun at the September equinox (declination 0) for the night clock. */
export const sunAltAz = (clock: number) => altAz(clock, 0, 12);

/** Moon offset from the rogue centre on the sky (deg, in the rogue's local right/up frame) for the night clock. */
export function moonOffset(clock: number): [number, number] {
  const m = T.moon, s = (clock - m.transitClock) * m.speedDegPerHour, n = [-m.dir[1], m.dir[0]];
  // Perpendicular offset points down-left of the rogue centre.
  return [-Math.abs(n[0]) * m.offsetDeg + m.dir[0] * s, -Math.abs(n[1]) * m.offsetDeg + m.dir[1] * s];
}

/** Flood front: distance (m) the overtopping water has spread inland from the quay edges. */
export function floodFront(t: number) { return t < T.over ? -1 : (t - T.over) * T.front.speed; }

/** S06: which evening (index into T.nights) and the local progress within it. */
export function nightAt(t: number) {
  const n = T.nights.length, u = clamp01((t - B[5]) / (B[6] - B[5])) * n, i = Math.min(n - 1, Math.floor(u));
  return { i, night: T.nights[i][0], diam: T.nights[i][1], local: u - i };
}
/** Moon distance (km) for the HUD in S06: log-interpolated across the evenings. */
export function moonDistanceNights(t: number) {
  const pts = T.moonDistanceKm.nights, { i, local } = nightAt(t);
  const a = pts[i][1], b = pts[Math.min(pts.length - 1, i + 1)][1];
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * (i < pts.length - 1 ? ease(local) * 0.25 : 0));
}

/** Format story clock hours as HH:MM. */
export function hhmm(clock: number) {
  const h = ((Math.floor(clock) % 24) + 24) % 24, m = Math.floor((clock - Math.floor(clock)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
