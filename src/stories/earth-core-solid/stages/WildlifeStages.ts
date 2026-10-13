import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { BirdFlock } from '../../../library/creatures/BirdFlock';
import { Underwater } from '../../../library/environment/Underwater';
import { FishSchool } from '../../../library/creatures/FishSchool';
import { lerp } from '../../../library/util/math';
import { Base, frac, type Timing } from './common';

const DUSK_SUN = new THREE.Vector3(0.75, 0.07, -0.66).normalize();

/** Open sea at dusk with a loose flock of migrating birds high overhead. */
export class SeaStage extends Base {
  sky = new SkyDome({ zenithColor: 0x1d2f5c, horizonColor: 0xf3a27a, groundColor: 0x1a2232, hazeColor: 0xf6b38a, hazeAmount: 0.6, sunDirection: DUSK_SUN, sunColor: 0xffc48a, sunIntensity: 6, sunGlow: 0.8, sunSize: 0.012 });
  sea = new OceanSurface({ size: 6000, waveHeight: 0.35, waveScale: 1.2, deepColor: 0x0f2436, horizonColor: 0xe89a78, zenithColor: 0x1d2f5c, sunDirection: DUSK_SUN, sunColor: 0xffb27a, glitter: 0.8, fogColor: 0xe0a07e, fogDensity: 0.0009 });
  birds = new BirdFlock({ count: 22, seed: 31, spread: [16, 3.5, 9], wingspan: 1.5, bodyColor: 0x1d1b1f, wingColor: 0x262428, tipColor: 0x111014, sunDirection: DUSK_SUN, sunColor: 0xffb27a, ambient: 0x3a4466 });

  constructor(private T: Timing) {
    super();
    this.camera.far = 8000;
    this.scene.add(this.sky.mesh, this.sea.mesh, this.birds.mesh);
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t);
    this.sea.update(t);
    this.birds.update(t, { center: new THREE.Vector3(lerp(-34, 30, u), 19 + Math.sin(t * 0.4), -14), heading: new THREE.Vector3(1, 0.02, 0.12).normalize(), flapRate: 1.1 }, 2 * Math.PI * 2.4 * t);
  }
}

/** Open blue-green water with a school of salmon swimming past. */
export class SalmonStage extends Base {
  sea = new Underwater({ depth: 16, extent: 40, waterColor: 0x1f6f7a, deepColor: 0x06303c, surfaceColor: 0xb8f0e8, sunDirection: new THREE.Vector3(0.2, 1, 0.25), rayStrength: 0.8, rayCount: 12, fogDensity: 0.07, grassCount: 0, particleCount: 1400, seed: 12, rockCount: 0 });
  fish = new FishSchool({ count: 70, seed: 9, length: 0.62, spread: [3.4, 0.9, 2.2], speed: 1.4, color: 0xd5dfd8, backColor: 0x3c5a4c, fogColor: 0x1f6f7a, fogDensity: 0.07, lightDirection: new THREE.Vector3(0.2, 1, 0.25) });

  constructor(private T: Timing) {
    super();
    this.camera.near = 0.05; this.camera.far = 300;
    this.scene.add(this.sea.group, this.fish.mesh);
    this.scene.fog = new THREE.FogExp2(this.sea.fogColor, this.sea.fogDensity);
    this.scene.add(new THREE.HemisphereLight(0xa8ecf0, 0x08303a, 1.3));
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t);
    this.sea.update(t, this.camera);
    this.fish.update(t, new THREE.Vector3(lerp(3.5, -3.8, u), -3.1 + 0.2 * Math.sin(t * 0.7), -3.2), new THREE.Vector3(-1, 0, 0.18).normalize());
  }
}
