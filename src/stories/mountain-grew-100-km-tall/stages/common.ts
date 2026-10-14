import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { PlanetAtmosphere, createAtmosphereUniforms, type EarthMapSet } from '../../../library/environment/PlanetAtmosphere';
import { GiantPeak } from '../../../library/environment/GiantPeak';

/** The peak stands in the Western Alps; every stage uses the same site frame (x east, y up, z south, km). */
export const SITE = { lat: 45.8, lon: 6.9 };
/** Noon sun, high in the south (site-local frame). */
export const SUN = new THREE.Vector3(0.22, 0.84, 0.5).normalize();

export interface Anchor { world: THREE.Vector3; label: string; value?: string; accent?: string; dx?: number; dy?: number; alpha?: number }

/** A stage that knows its true camera position (site-local km) and can expose labelled 3D anchors for callouts. */
export abstract class PlanetStage implements Stage {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  atmo: PlanetAtmosphere;
  peak: GiantPeak;
  readonly u: Record<string, THREE.IUniform>;
  /** True camera position this frame (km, site frame) and its altitude above the curved surface. */
  camKm = new THREE.Vector3(); camAlt = 0;
  constructor(maps: EarthMapSet, o: { sunPower?: number; skyGain?: number; cloudOpacity?: number; near?: number; far?: number; sun?: THREE.Vector3 } = {}) {
    this.camera = new THREE.PerspectiveCamera(40, 1080 / 1920, o.near ?? 0.1, o.far ?? 5000);
    this.u = createAtmosphereUniforms(maps, { lat: SITE.lat, lon: SITE.lon, sunDirection: o.sun ?? SUN, sunPower: o.sunPower ?? 4.5, cloudOpacity: o.cloudOpacity ?? 0.85, cloudAltitude: 5 });
    this.atmo = new PlanetAtmosphere(maps, {}, this.u);
    this.u.uSkyGain.value = o.skyGain ?? 1.5;
    this.peak = new GiantPeak(this.u, { height: 100, baseRadius: 200, profile: 1.6, seed: 7 });
    this.scene.add(this.atmo.mesh, this.peak.mesh);
  }
  /** Map the stage camera to true km through the peak's placement and update the sky. */
  syncSky(t: number) {
    this.camKm.copy(this.peak.setCamera(this.camera.position));
    this.camAlt = this.u.uCamAlt.value as number;
    this.atmo.follow(this.camera); this.atmo.time = t;
  }
  setClip(near: number, far: number) { this.camera.near = near; this.camera.far = far; this.camera.updateProjectionMatrix(); }
  abstract update(time_s: number, shot: ShotInfo): void;
  anchors(_t: number, _shot: ShotInfo): Anchor[] { return []; }
  /** Live secondary HUD line (e.g. air pressure), or undefined. */
  hudLine(_t: number, _shot: ShotInfo): string | undefined { return undefined; }
}

export const ease = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const win = (t: number, a: number, b: number) => ease((t - a) / (b - a));
