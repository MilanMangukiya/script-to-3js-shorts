import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { Underwater } from '../../../library/environment/Underwater';
import { FishSchool } from '../../../library/creatures/FishSchool';
import { T } from '../timeline';

/** Shallow reef just below the surface (metres, surface at y = 0); S07/SH02. Nothing here reacts to the event. */
export class UnderwaterStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 500);
  private water: Underwater; private school: FishSchool; private far: FishSchool;

  constructor() {
    const sun = new THREE.Vector3(-0.35, 1, -0.3).normalize();
    this.water = new Underwater({ depth: 9, extent: 60, sunDirection: sun, rayStrength: 0.4, rayCount: 18, fogDensity: 0.05, seed: 5 });
    this.scene.add(this.water.group);
    const fog = { fogColor: this.water.fogColor, fogDensity: this.water.fogDensity, lightDirection: sun };
    this.school = new FishSchool({ count: 180, seed: 3, length: 0.21, spread: [2.6, 1.0, 1.5], speed: 0.75, ...fog });
    this.far = new FishSchool({ count: 70, seed: 8, length: 0.22, spread: [4.5, 0.8, 2.2], ...fog });
    this.scene.add(this.school.mesh, this.far.mesh);
    this.water.setBubbleBurst(T.plunge - 0.05, new THREE.Vector3(0, -1.3, 4.4));
  }

  update(t: number, _shot: ShotInfo) {
    this.water.update(t, this.camera);
    const u = t - T.plunge;
    // Main school crosses right-to-left through the light shafts on a gently curving path.
    const c = new THREE.Vector3(2.4 - 0.8 * u, -3.9 + 0.3 * Math.sin(0.5 * t), -1.8 + 0.7 * Math.sin(0.4 * t));
    const h = new THREE.Vector3(-0.8, 0.15 * Math.cos(0.5 * t), 0.28 * Math.cos(0.4 * t)).normalize();
    this.school.update(t, c, h);
    const c2 = new THREE.Vector3(-12 + 1.5 * u, -6.2, -11 + 0.5 * Math.sin(0.3 * t));
    this.far.update(t, c2, new THREE.Vector3(1.5, 0, 0.15 * Math.cos(0.3 * t)).normalize());
  }
}
