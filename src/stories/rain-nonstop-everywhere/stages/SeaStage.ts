import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Snowfall } from '../../../library/fx/Snowfall';
import { Rain, RainShaft } from '../../../library/fx/Rain';
import { lerp, smoothstep } from '../../../library/util/math';
import { Base, OVERCAST, overcastSky, type Timing } from './common';

const SUN = new THREE.Vector3(-0.103, 0.157, -0.982).normalize();   // low sun, just left of the view axis
const GAP: [number, number] = [-594, -5650];                           // where that sunlight passes the cloud base

/** Open sea under a rain-cloud deck: illustrative vapour rising, distant rain shafts, a sunlit gap (S04) that is
 *  gone under unbroken overcast in S08, where the vapour fades and the rain thins. */
export class SeaStage extends Base {
  sea = new OceanSurface({ size: 40000, waveHeight: 0.55, deepColor: 0x142838, horizonColor: 0x8a929a, zenithColor: 0x5d6670, sunDirection: SUN, sunColor: 0xffe9c8, glitter: 1, fogColor: 0x8e969e, fogDensity: 0.00011 });
  rain = new Rain({ count: 16000, box: [40, 20, 40], fallSpeed: 4.5, wind: [0.9, 0.3], streakLength: 0.3, width: 0.0024, opacity: 0.45, brightness: 1.25, far: 34, seed: 9 });
  /** Illustrative vapour: luminous specks rising off the water (the snowfall particle system run upward). */
  vapour = new Snowfall({ count: 4200, seed: 23, box: [50, 24, 90], fallSpeed: -1.1, drift: 0.7, size: 70, minPx: 1.6, maxPx: 9, color: 0xe6f2ff, brightness: 1.2, additive: true, far: 160 });
  shafts: { s: RainShaft; base: number }[] = [];
  sky: ReturnType<typeof overcastSky>;

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.camera.near = 0.3; this.camera.far = 9000;
    this.sky = overcastSky(this.scene, renderer, { sunDirection: SUN, altitude: 900, fogDensity: 0.00017 });
    const su = this.sky.sky.uniforms; (su.uHorizon.value as THREE.Color).set(0x959da5); (su.uHaze.value as THREE.Color).set(0x9fa5aa); su.uHazeAmount.value = 0.25;
    const cu = this.sky.ceiling.uniforms; cu.uHazeDensity.value = 0.00009; (cu.uHaze.value as THREE.Color).set(0x959da5); cu.uScale.value = 650; (cu.uDark.value as THREE.Color).set(0x464c55); (cu.uLight.value as THREE.Color).set(0x8e969e);
    this.scene.add(this.sea.mesh, this.rain.mesh);
    this.vapour.points.position.set(0, 0, -25); this.scene.add(this.vapour.points);
    for (const [x, z, wd, op] of [[-390, -2800, 420, 0.6], [160, -3600, 560, 0.5], [520, -2300, 300, 0.55], [-120, -1700, 260, 0.45], [760, -4200, 700, 0.45]]) {
      const s = new RainShaft({ width: wd, height: 900, opacity: op, color: 0x58606a, seed: x * 0.001 + z * 0.0007 });
      s.mesh.position.set(x, 0, z); this.scene.add(s.mesh); this.shafts.push({ s, base: op });
    }
  }

  update(t: number, shot: ShotInfo) {
    const late = shot.sceneId === 'S08', sh = this.T[shot.key];
    const fade = late ? smoothstep(sh.start + 0.35, sh.end - 0.4, t) : 0;   // S08: vapour fades, rain thins
    const sun = late ? 0 : smoothstep(sh.start + 0.6, sh.start + 4.5, t);   // S04: sunlight breaks through the gap
    const s = this.sky;
    s.ceiling.setGap(GAP[0], GAP[1], 3600, late ? 0 : 0.35 + 0.65 * sun);
    s.ceiling.sunGlow = late ? 0.03 : 0.15 + 0.35 * sun; s.ceiling.update(t, t * 4, t * 1.5);
    s.sky.uniforms.uSunIntensity.value = late ? 0 : 7 * sun; s.sky.uniforms.uSunGlow.value = late ? 0 : 0.4 * sun;
    s.sky.scatter = late ? lerp(0.92, 0.82, fade) : 1;
    this.sea.uniforms.uGlitter.value = late ? 0 : 0.05 + 0.25 * sun;
    this.sea.skyScale = late ? lerp(0.85, 0.74, fade) : 1;
    this.sea.update(t);
    this.vapour.amount = late ? 1 - 0.85 * fade : 1; this.vapour.brightness = 0.9 + 0.5 * (late ? 0 : sun); this.vapour.update(t);
    for (const { s: sh2, base } of this.shafts) { sh2.opacity = base * (late ? 1 - 0.65 * fade : 1); sh2.update(t, this.camera); }
    this.rain.intensity = late ? lerp(0.6, 0.12, fade) : 0.22; this.rain.update(t, this.camera);
  }
}
