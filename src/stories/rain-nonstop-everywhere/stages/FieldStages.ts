import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { GrassField } from '../../../library/environment/GrassField';
import { Terrain } from '../../../library/environment/Terrain';
import { Humanoid, POSE_STAND } from '../../../library/characters/Humanoid';
import { DialGauge } from '../../../library/props/DialGauge';
import { SolarPanelArray } from '../../../library/props/SolarPanelArray';
import { Rain } from '../../../library/fx/Rain';
import { clamp, lerp, smoothstep } from '../../../library/util/math';
import { Base, OVERCAST, mat, mesh, overcastSky, type Timing } from './common';

const FOG = 0.0016;
const rainKit = (seed: number) => new Rain({ count: 22000, box: [26, 13, 26], fallSpeed: 4, wind: [0.6, 0.2], streakLength: 0.26, width: 0.0022, opacity: 0.45, brightness: 1.25, color: 0xe4ecf4, far: 24, seed });

/** Ripe wheat flattened by rain under a sky that never clears, with a farmer looking up. */
export class FarmStage extends Base {
  wheat = new GrassField({
    area: [-32, 32, -45, 12], count: 70000, minHeight: 0.72, maxHeight: 0.98, width: 0.011, seed: 61,
    reject: (x, z) => Math.hypot(x, z + 2) < 0.4,
    baseColor: 0x6b6a40, tipColor: 0xb89c5c, dryColor: 0x8a7d4c, flowerFraction: 1, flowerColor: 0xd0ae66,
    sunDirection: new THREE.Vector3(-0.3, 0.9, 0.3), sunColor: 0xbfc3c4, skyColor: OVERCAST.hemiSky, fogColor: OVERCAST.fog, fogDensity: FOG,
  });
  farmer = new Humanoid({ height: 1.75, coat: 'jacket', coatColor: 0x3d4a35, trouserColor: 0x2d2b27, hat: true, scarfColor: 0x4d3c2c, shoeColor: 0x2a2018 });
  rain = rainKit(31);

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.camera.far = 6000;
    overcastSky(this.scene, renderer, { altitude: 650, fogDensity: FOG });
    const ground = mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), mat(0x4a4632, 0.95), [0, 0, -300]);
    const hills = new Terrain({ width: 1600, depth: 520, peakHeight: 85, segmentsX: 160, segmentsZ: 52, treeLine: 2000, snowLine: 3000, seed: 8 });
    hills.mesh.position.set(0, -6, -760);
    this.farmer.root.position.set(0, 0, -2); this.farmer.root.rotation.y = 0.75;
    this.scene.add(ground, hills.mesh, this.wheat.mesh, this.farmer.root, this.rain.mesh);
  }

  update(t: number, shot: ShotInfo) {
    const u = t - this.T[shot.key].start;
    const up = smoothstep(0.9, 2.3, u) * (1 - smoothstep(3.0, 4.1, u)), down = smoothstep(3.1, 4.2, u);
    this.farmer.setPose({ ...POSE_STAND, headPitch: -0.42 * up + 0.32 * down, headYaw: 0.1 * Math.sin(u * 0.4), shrug: 0.3, armL: [0.05, 0.1, 0.25], armR: [0.05, 0.1, 0.25], breath: 0.015 * Math.sin(t * 1.3) });
    this.wheat.update(t, { bend: 0.55, direction: new THREE.Vector2(1, 0.25), gust: 0.25, gustSpeed: 2.5 });
    this.rain.intensity = 0.55; this.rain.update(t, this.camera);
  }
}

/** Rain-soaked solar farm with an illustrative output dial whose needle sinks under the unbroken overcast. */
export class SolarStage extends Base {
  grass = new GrassField({
    area: [-16, 16, -14, 9], count: 42000, minHeight: 0.08, maxHeight: 0.24, width: 0.008, seed: 72,
    baseColor: 0x2f4128, tipColor: 0x6f8752, dryColor: 0x77784f,
    sunDirection: new THREE.Vector3(-0.3, 0.9, 0.3), sunColor: 0xbfc3c4, skyColor: OVERCAST.hemiSky, fogColor: OVERCAST.fog, fogDensity: FOG,
  });
  panels = new SolarPanelArray({ rows: 3, cols: 8, panelSize: [1.0, 1.7], tilt: 30, rowSpacing: 4.2, clearance: 0.6, wetness: 1 });
  dial = new DialGauge({ radius: 0.16, min: 1, max: 11, arcDegrees: 240, majorStep: 1, minorStep: 0.5, labelStep: 1000, title: 'SOLAR OUTPUT', depth: 0.04, bezel: 'steel',
    marks: [{ value: 2.2, color: '#c8553d', label: 'LOW' }, { value: 9.8, color: '#4f9d69', label: 'HIGH' }] });
  rain = rainKit(43);

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.camera.far = 6000;
    overcastSky(this.scene, renderer, { altitude: 650, fogDensity: FOG });
    const ground = mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), mat(0x34402b, 0.95), [0, 0, -300]);
    const hills = new Terrain({ width: 1600, depth: 520, peakHeight: 70, segmentsX: 160, segmentsZ: 52, treeLine: 2000, snowLine: 3000, seed: 15 });
    hills.mesh.position.set(200, -6, -820);
    this.panels.group.position.set(-0.5, 0, -3.6);
    const post = mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.12, 16), mat(0x6f767c, 0.5, 0.8), [2.37, 0.56, 1.55]);
    this.dial.group.position.set(2.37, 1.25, 1.6); this.dial.group.rotation.y = 0.5;
    this.scene.add(ground, hills.mesh, this.grass.mesh, this.panels.group, post, this.dial.group, this.rain.mesh);
  }

  update(t: number, shot: ShotInfo) {
    const u = t - this.T[shot.key].start;
    this.dial.value = lerp(9.3, 3.0, smoothstep(0.45, 3.05, u)) + 0.08 * Math.sin(t * 7.1) * clamp(1 - u / 4);
    this.grass.update(t, { bend: 0.2, direction: new THREE.Vector2(1, 0.3), gust: 0.3, gustSpeed: 2 });
    this.rain.intensity = 0.55; this.rain.update(t, this.camera);
  }
}
