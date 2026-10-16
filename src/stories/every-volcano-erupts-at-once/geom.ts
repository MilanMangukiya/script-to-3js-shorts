import * as THREE from 'three';
import type { Volcano } from '../../library/environment/Volcano';

/** The volcano "down your street": 2.9 km stratovolcano 15.7 km from the street, a little right of the street axis. */
export const VOLC = { x: 2400, z: -15500, height: 2900, radius: 9500, crater: 380, seed: 11, relief: 0 };
/** Azimuth (atan2(z, x) in the volcano's frame) of the city, of the S03 flank road camera and of the S03 ash-flow gully. */
export const CITY_THETA = Math.atan2(-VOLC.z, -VOLC.x);
export const FLANK = { theta: 1.62, r: 6300, flowTheta: 1.93, flowR0: 520, flowR1: 8800, roadR: 6230 };

/** World point on the volcano surface at azimuth theta and radius r, raised by `lift` metres. */
export function flankPoint(v: Pick<Volcano, 'heightAt'>, theta: number, r: number, lift = 0, out = new THREE.Vector3()) {
  const lx = Math.cos(theta) * r, lz = Math.sin(theta) * r;
  return out.set(VOLC.x + lx, v.heightAt(lx, lz) + lift, VOLC.z + lz);
}

/** Ash-flow path down the gully: points every 120 m from the crater rim, gently meandering. */
export function flowPath(v: Pick<Volcano, 'heightAt'>) {
  const pts: THREE.Vector3[] = [];
  for (let r = FLANK.flowR0; r <= FLANK.flowR1; r += 120) pts.push(flankPoint(v, FLANK.flowTheta + 0.035 * Math.sin(r * 0.0011) + 0.02 * Math.sin(r * 0.0031), r, 2));
  return pts;
}
