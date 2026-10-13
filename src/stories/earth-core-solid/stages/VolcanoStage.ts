import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { Volcano } from '../../../library/environment/Volcano';
import { Base, type Timing } from './common';

const SUN = new THREE.Vector3(-0.62, 0.1, -0.55).normalize();   // low dusk sun behind the cone

/** A cone volcano erupting at dusk: lava fountains, glowing flows and an ash plume. */
export class VolcanoStage extends Base {
  sky = new SkyDome({ radius: 20000, zenithColor: 0x0b0f26, horizonColor: 0x5a3446, groundColor: 0x120c10, hazeColor: 0x6e3e48, hazeAmount: 0.45, sunDirection: SUN, sunColor: 0xff8a5a, sunIntensity: 1.2, sunGlow: 0.35, sunSize: 0.01 });   // blue hour: the lava is the main light
  volcano = new Volcano({ height: 1200, radius: 3400, crater: 240, seed: 7, sunDirection: SUN, sunColor: 0xc06a50, ambient: 0x262c48, fogColor: 0x3a2836, fogDensity: 0.0001,
    channels: [[1.62, 2350], [1.36, 1500], [1.92, 1850], [2.35, 1300], [0.95, 1250], [0.3, 1100], [2.9, 1200], [3.9, 1000], [4.8, 1300], [5.6, 1100]] });

  constructor(private T: Timing) {
    super();
    this.camera.near = 2; this.camera.far = 40000;
    this.scene.add(this.sky.mesh, this.volcano.group);
    void this.T;
  }

  update(t: number, _shot: ShotInfo) {
    this.volcano.eruption = 1; this.volcano.lavaGlow = 1;
    this.volcano.update(t);
  }
}
