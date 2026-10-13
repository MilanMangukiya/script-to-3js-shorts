import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { RockyPlanet } from '../../../library/planet/RockyPlanet';
import { SolarWind } from '../../../library/space/SolarWind';
import { Starfield } from '../../../library/space/Starfield';
import { smoothstep } from '../../../library/util/math';
import { Base, frac, type Timing } from './common';

export const MARS_AT = new THREE.Vector3(400, 0, 0);
const SUNWARD = new THREE.Vector3(-1, 0.12, 0.25).normalize();   // toward the Sun (the wind blows the other way, +X)

/** Space: the solar wind striking an unshielded Earth, and Mars trailing its escaping air. */
export class SolarWindStage extends Base {
  earth: Earth;
  mars = new RockyPlanet({ radius: 1, seed: 4, capSize: 0.1, atmosphereStrength: 0.55, sunDirection: SUNWARD });
  windEarth = new SolarWind({ radius: 1, count: 1150, seed: 3, width: 2.6, atmosphere: 1.06 });
  windMars = new SolarWind({ radius: 1, count: 1000, seed: 5, width: 2.4, atmosphere: 1.04, plumeCount: 1200 });
  stars = new Starfield({ count: 2600, radius: 300, brightness: 0.3 });

  constructor(private T: Timing, tex: EarthTextures) {
    super();
    this.scene.background = new THREE.Color(0x01040a);
    this.camera.near = 0.05; this.camera.far = 900;
    this.earth = new Earth(tex, { radius: 1, sunDirection: SUNWARD, cloudOpacity: 0.85, atmosphereStrength: 1.0, nightLights: 0.8 });
    this.mars.group.position.copy(MARS_AT); this.windMars.group.position.copy(MARS_AT);
    this.windEarth.shield = 0; this.windMars.shield = 0; this.windMars.escape = 1;
    this.scene.add(this.earth.group, this.mars.group, this.windEarth.group, this.windMars.group, this.stars.points);
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t);
    const onEarth = shot.key === 'S05/SH02';
    this.earth.update(t);
    this.windEarth.escape = 0.85 * smoothstep(0.1, 0.9, u); this.windEarth.update(t);
    this.windEarth.group.visible = onEarth; this.windMars.group.visible = !onEarth;
    this.mars.group.rotation.y = 0.4 + t * 0.03; this.windMars.update(t);
    this.stars.follow(this.camera);
  }
}
