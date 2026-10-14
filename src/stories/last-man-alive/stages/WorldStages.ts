import * as THREE from 'three';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { PortKit } from '../../../library/environment/PortKit';
import { ContainerShip } from '../../../library/vehicles/ContainerShip';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { SetStage, outdoor } from './common';

export class GlobeStage extends SetStage {
  private earth: Earth;
  private stars = new Starfield({ count: 1800, radius: 700, seed: 236, maxSize: 1.5, brightness: .7 });
  constructor(maps: EarthTextures) {
    super(); this.scene.background = new THREE.Color(0x020611); this.camera.near = .01;
    this.earth = new Earth(maps, { radius: 1, sunDirection: new THREE.Vector3(-.7, .3, 1), nightLights: 1.1, atmosphereStrength: .7 });
    this.earth.setView(15, 15); this.scene.add(this.earth.group, this.stars.points);
  }
  update(t: number) { this.earth.update(t); this.stars.follow(this.camera); }
}
export class HarbourStage extends SetStage {
  private port = new PortKit({ seed: 38, cranes: 4, truckCount: 3, containerRows: 8 });
  private ship = new ContainerShip({ deckLights: true });
  private ocean = new OceanSurface({ size: 9000, deepColor: 0x0a2433, horizonColor: 0x8b736a,
    zenithColor: 0x163555, waveHeight: .15, waveScale: .6, glitter: .1, fogDensity: .00025 });
  private sky: ReturnType<typeof outdoor>;
  constructor(renderer: THREE.WebGLRenderer) {
    super(); this.camera.near = .2; this.sky = outdoor(this.scene, renderer, true);
    this.ship.position.set(0, 0, -278); this.ship.rotation.y = Math.PI / 2;
    this.scene.add(this.port, this.ship, this.ocean.mesh);
    const key = new THREE.DirectionalLight(0xffd2a6, 2.1); key.position.set(-120, 210, 80); this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0xa9c8e0, 0x635348, .8));
  }
  update(t: number, _shot: ShotInfo) {
    this.port.update(t, { stopAt_s: 16.1, stopDuration_s: .9 });
    this.ship.update(t, { rpm: 0 }); this.ship.rotation.x = Math.sin(t * .7) * .002;
    this.ocean.update(t); this.sky.follow(this.camera);
  }
}
