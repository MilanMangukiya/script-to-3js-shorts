import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { OvercastShell } from '../../../library/planet/OvercastShell';
import { Starfield } from '../../../library/space/Starfield';
import { smoothstep } from '../../../library/util/math';
import { Base, type Timing } from './common';

export const EARTH_SUN = new THREE.Vector3(1, 0.25, 0.45).normalize();

/** Earth from orbit (1 unit = 1 Earth radius): today's real clouds, then one grey shell over the whole planet. */
export class EarthStage extends Base {
  earth: Earth;
  shell = new OvercastShell({ radius: 1.009, coverage: 0, sunDirection: EARTH_SUN, seed: 5 });
  stars = new Starfield({ count: 2600, radius: 400, brightness: 0.3 });

  constructor(private T: Timing, tex: EarthTextures) {
    super();
    this.scene.background = new THREE.Color(0x01040a);
    this.camera.near = 0.05; this.camera.far = 1000;
    this.earth = new Earth(tex, { radius: 1, cloudOpacity: 0.9, atmosphereStrength: 0.85, sunDirection: EARTH_SUN, nightLights: 1.6 });
    this.earth.setView(14, 13); this.earth.spinRate = 0.0035; this.earth.cloudDrift = 0.0004;
    this.earth.group.add(this.shell.mesh);
    this.scene.add(this.earth.group, this.stars.points);
  }

  /** 0 = today's clouds, 1 = the planet-wide deck. */
  coverageAt(t: number, shot: ShotInfo): number {
    if (shot.sceneId === 'S08') return 1;
    if (shot.key !== 'S02/SH02') return 0;
    const sh = this.T['S02/SH02'];
    return smoothstep(sh.start + 0.1, sh.start + 1.75, t);
  }

  update(t: number, shot: ShotInfo) {
    const c = this.coverageAt(t, shot);
    this.shell.coverage = c; this.shell.update(t);
    this.earth.cloudOpacity = 0.9 + 0.1 * c;
    this.earth.scatter = 1 + 0.5 * c;   // keep the blue limb readable around the grey deck
    this.earth.update(t);
    this.stars.follow(this.camera);
  }
}
