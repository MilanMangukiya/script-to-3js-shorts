import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { CloudCeiling } from '../../../library/environment/CloudCeiling';

/** Scene and shot windows read from the storyboard, so stages never hard-code timestamps. */
export interface Timing { [key: string]: { start: number; end: number } }
export const local = (T: Timing, key: string, t: number) => t - T[key].start;
export const frac = (T: Timing, key: string, t: number) => (t - T[key].start) / (T[key].end - T[key].start);

/** Overcast palette shared by every ground-level stage (linear colours are derived by THREE.Color). */
export const OVERCAST = {
  zenith: 0x737c86, horizon: 0xa2a9b0, ground: 0x6f685e, haze: 0xa7aab0, fog: 0x9da4ab,
  cloudDark: 0x5b626b, cloudLight: 0xa4abb3, hemiSky: 0xc4ccd4, hemiGround: 0x7d7262,
};

export const mat = (c: THREE.ColorRepresentation, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
export const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0]) => { const x = new THREE.Mesh(g, m); x.position.set(...p); return x; };

export abstract class Base implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.05, 20000);
  abstract update(t: number, shot: ShotInfo): void;
}

/** Overcast sky: gradient dome, a cloud base overhead and an environment map baked from the dome for wet reflections. */
export function overcastSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer, o: { sunDirection?: THREE.Vector3; altitude?: number; fogDensity?: number } = {}) {
  const sun = o.sunDirection ?? new THREE.Vector3(-0.6, 0.18, -0.78);
  const sky = new SkyDome({ zenithColor: OVERCAST.zenith, horizonColor: OVERCAST.horizon, groundColor: OVERCAST.ground, hazeColor: OVERCAST.haze, hazeAmount: 0.35, sunDirection: sun, sunColor: 0xffd7a0, sunIntensity: 0, sunGlow: 0, sunSize: 0.012, curve: 0.8 });
  const ceiling = new CloudCeiling({ altitude: o.altitude ?? 700, darkColor: OVERCAST.cloudDark, lightColor: OVERCAST.cloudLight, hazeColor: OVERCAST.horizon, sunDirection: sun, sunGlow: 0.15 });
  scene.add(sky.mesh, ceiling.mesh);
  scene.environment = sky.toEnvironment(renderer, 0.05);
  scene.fog = new THREE.FogExp2(OVERCAST.fog, o.fogDensity ?? 0.006);
  const hemi = new THREE.HemisphereLight(OVERCAST.hemiSky, OVERCAST.hemiGround, 1.7);
  const key = new THREE.DirectionalLight(0xf4f1ea, 0.55); key.position.set(-6, 14, 5);
  scene.add(hemi, key);
  return { sky, ceiling, hemi, key, sun };
}
