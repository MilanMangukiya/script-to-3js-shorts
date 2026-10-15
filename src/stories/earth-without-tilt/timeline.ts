import * as THREE from 'three';
import events from './timeline.json';

export const T = { ...events, lanternOn: events.lanternSwitch };
export const DEG = Math.PI / 180;
export const unit = (x: number) => Math.max(0, Math.min(1, x));
export const ramp = (t: number, a: number, b: number) => {
  const u = unit((t - a) / (b - a)); return u * u * (3 - 2 * u);
};
/** Local world axes: east +X, north +Z. Hour is local apparent solar time. */
export function zeroTiltSun(latitude: number, hour: number): THREE.Vector3 {
  const p = latitude * DEG, h = (hour - 12) * 15 * DEG;
  return new THREE.Vector3(-Math.sin(h), Math.cos(p) * Math.cos(h), -Math.sin(p) * Math.cos(h)).normalize();
}
/** Canonical fixed-point grid before SunSkylightRig's quantized environment cache. */
export function canonicalSun(v: THREE.Vector3): THREE.Vector3 {
  let n = v.clone().normalize(), previous = '';
  for (let k = 0; k < 16; k++) {
    const a = n.toArray().map(x => +x.toFixed(2)), key = a.join(',');
    n = new THREE.Vector3(...a as [number, number, number]).normalize();
    if (key === previous) return n;
    previous = key;
  }
  throw new Error('Sun direction did not reach a canonical environment state');
}
export const angleLatitude = (t: number) => 75 * ramp(t, T.latitude0, T.latitude1);
