import * as THREE from 'three';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { SetStage } from './common';

export class GlobeStage extends SetStage {
  private earth: Earth;
  private stars = new Starfield({ count: 1800, radius: 700, seed: 7461, maxSize: 1.5, brightness: .7 });
  constructor(maps: EarthTextures) {
    super(); this.scene.background = new THREE.Color(0x020611); this.camera.near = .01;
    this.earth = new Earth(maps, { radius: 1, sunDirection: new THREE.Vector3(-.7, .3, 1), nightLights: 1.1, atmosphereStrength: .7 });
    this.earth.setView(15, 15); this.scene.add(this.earth.group, this.stars.points);
  }
  update(t: number) { this.earth.update(t); this.stars.follow(this.camera); }
}
