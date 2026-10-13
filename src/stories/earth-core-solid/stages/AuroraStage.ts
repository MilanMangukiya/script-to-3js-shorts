import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { Starfield } from '../../../library/space/Starfield';
import { AuroraCurtains } from '../../../library/environment/AuroraCurtains';
import { ConiferStand, scatterTrees } from '../../../library/environment/ConiferStand';
import { smoothstep } from '../../../library/util/math';
import { Base, frac, type Timing } from './common';

/** Polar night: snowy ground and conifers under stars; aurora curtains that fade away. */
export class AuroraStage extends Base {
  sky = new SkyDome({ radius: 9000, zenithColor: 0x020610, horizonColor: 0x0c1a26, groundColor: 0x05080c, hazeColor: 0x10242e, hazeAmount: 0.3, sunIntensity: 0, sunGlow: 0 });
  stars = new Starfield({ count: 3200, radius: 600, brightness: 0.7, minY: 0.02 });
  aurora = new AuroraCurtains({ count: 4, seed: 6, center: new THREE.Vector3(0, 0, -5200), span: 10000, height: 2800, altitude: 800, depth: 1600 });
  trees: ConiferStand;
  private hemi = new THREE.HemisphereLight(0x3d7a66, 0x05070a, 0.6);

  constructor(private T: Timing) {
    super();
    this.camera.far = 12000;
    const snow = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9d6e2, roughness: 0.92 }));
    const pts = scatterTrees(220, 14, [-160, 160, -260, -14], () => 0, (x, z) => Math.abs(x) < 18 && z > -60);
    this.trees = new ConiferStand({ positions: pts, seed: 3, minHeight: 6, maxHeight: 14, color: 0x13261c, trunkColor: 0x2a1d14, snow: 0.7, snowColor: 0xdfe8f0 });
    this.scene.add(this.sky.mesh, this.stars.points, this.aurora.group, snow, this.trees.mesh, this.hemi);
    this.scene.fog = new THREE.FogExp2(0x0a1620, 0.0045);
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t), k = 1 - smoothstep(0.25, 0.9, u);
    this.aurora.intensity = k; this.aurora.update(t);
    // Aurora light tints the snow green; it leaves only cold starlight as it fades.
    this.hemi.color.setRGB(0.12 + 0.12 * k, 0.2 + 0.32 * k, 0.28 + 0.12 * k); this.hemi.intensity = 0.35 + 0.5 * k;
    this.stars.follow(this.camera);
  }
}
