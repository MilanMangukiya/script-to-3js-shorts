import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { smoothstep } from '../../../library/util/math';

/** Scene and shot windows read from the storyboard, so stages never hard-code timestamps. */
export interface Timing { [key: string]: { start: number; end: number } }
/** Fraction of a window elapsed at time t (may run slightly outside 0..1 during dissolves). */
export const frac = (T: Timing, key: string, t: number) => (t - T[key].start) / (T[key].end - T[key].start);
/** Smooth 0..1 ramp between two fractions of a window. */
export const ramp = (T: Timing, key: string, t: number, a: number, b: number) => smoothstep(a, b, frac(T, key, t));

export const mat = (c: THREE.ColorRepresentation, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
export const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0]) => { const x = new THREE.Mesh(g, m); x.position.set(...p); return x; };

export abstract class Base implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.1, 5000);
  abstract update(t: number, shot: ShotInfo): void;
}
