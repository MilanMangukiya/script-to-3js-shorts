import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { smoothstep, lerp } from '../../../library/util/math';
import { T } from '../timeline';

/** Earth orbit (Earth radius = 1): sunlit limb with the dusk terminator over the Atlantic. Used by S07. */
export class OrbitStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.05, 2000);
  private earth: Earth; private stars: Starfield;

  constructor(tex: EarthTextures) {
    const s = this.scene;
    s.background = new THREE.Color(0x01030a);
    this.earth = new Earth(tex, { radius: 1, sunDirection: new THREE.Vector3(0.95, 0.14, -0.28).normalize(), atmosphereStrength: 1.0, nightLights: 2.4, cloudOpacity: 0.9 });
    this.earth.setView(-20, 20); this.earth.spinRate = 0.003;
    s.add(this.earth.group);
    this.stars = new Starfield({ seed: 19, count: 2600, radius: 900, brightness: 0.45, maxSize: 4.2 });
    s.add(this.stars.points);
  }

  update(t: number, _shot: ShotInfo) {
    // Twice the air scatters more sunlight: the limb glow brightens (it does not get visibly taller).
    this.earth.scatter = lerp(1, 1.35, smoothstep(T.co2 - 0.2, T.co2 + 1.2, t));
    this.earth.update(t);
    this.stars.follow(this.camera);
  }
}
