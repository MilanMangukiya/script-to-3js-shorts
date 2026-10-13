import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { Underwater } from '../../../library/environment/Underwater';
import { CoralMounds } from '../../../library/environment/CoralMounds';
import { FishSchool } from '../../../library/creatures/FishSchool';
import { Base, frac, type Timing } from './common';

const DEPTH = 7;

/** A shallow, sunlit coral garden that thins out into open blue water. */
export class ReefStage extends Base {
  sea = new Underwater({ depth: DEPTH, extent: 30, waterColor: 0x1b8aa8, deepColor: 0x063a5c, surfaceColor: 0xaff2f5, sunDirection: new THREE.Vector3(0.25, 1, 0.3), rayStrength: 0.9, rayCount: 14, causticScale: 0.6, causticStrength: 1.4, fogDensity: 0.05, grassCount: 260, particleCount: 1600, seed: 8, rockCount: 6 });
  // Seated on the real sand height; a winding sand channel down the middle stays open.
  corals = new CoralMounds({ count: 80, area: [-7, 7, -16, 3], ground: (x, z) => this.sea.floorHeight(x, z), minSize: 0.4, maxSize: 1.4, seed: 41, reject: (x, z) => Math.abs(x - 0.4 * Math.sin(z * 0.35)) < 0.9 && z < 2 });
  fish = new FishSchool({ count: 170, seed: 6, length: 0.16, spread: [3.2, 1.1, 3.2], speed: 1.1, color: 0xc6e2ee, backColor: 0x2f6f9a, fogColor: 0x1b8aa8, fogDensity: 0.05, lightDirection: new THREE.Vector3(0.25, 1, 0.3) });

  constructor(private T: Timing) {
    super();
    this.camera.near = 0.05; this.camera.far = 400;
    this.scene.add(this.sea.group, this.corals.group, this.fish.mesh);
    this.scene.fog = new THREE.FogExp2(this.sea.fogColor, this.sea.fogDensity);
    const hemi = new THREE.HemisphereLight(0x9fe6ee, 0x0b3a4f, 1.4), key = new THREE.DirectionalLight(0xe8fbff, 1.6);
    key.position.set(2.5, 10, 3); this.scene.add(hemi, key);
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t);
    this.sea.update(t, this.camera);
    // The school wheels over the reef ahead of the camera.
    const a = u * Math.PI * 1.2 + 0.4, center = new THREE.Vector3(1.6 * Math.sin(a), -4.4 + 0.3 * Math.sin(a * 1.7), -3.5 - 4.5 * u + 1.2 * Math.cos(a));
    this.fish.update(t, center, new THREE.Vector3(Math.cos(a), 0, -0.6 - Math.sin(a)).normalize());
  }
}
