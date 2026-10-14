import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import type { EarthMapSet } from '../../../library/environment/PlanetAtmosphere';
import { depthClearer } from '../../../library/environment/GiantPeak';
import { CityStreetClassic } from '../../../library/environment/CityStreetClassic';
import { BirdFlock } from '../../../library/creatures/BirdFlock';
import { PlanetStage, SUN, type Anchor } from './common';
import { makeWalkers, poseWalker, type Walker } from './gear';
import { growAt, T } from '../timeline';

/** Metre-scale crossing 300 km south of the peak; the peak is a 1:100 backdrop placed so angles and haze are exact. */
export class StreetStage extends PlanetStage {
  city = new CityStreetClassic({ seed: 4075, blocks: 9, farFieldRadius: 900, wetness: 0.12, windowOccupancy: 0.4, vehicles: true });
  walkers: Walker[] = makeWalkers(311);
  birds = new BirdFlock({ count: 14, seed: 23, spread: [2.5, 0.8, 2.0], wingspan: 0.62, bodyColor: 0x8a8f96, wingColor: 0x6f757d, tipColor: 0x2b2e33, sunDirection: SUN });
  sun: THREE.DirectionalLight;
  private ref = new THREE.Vector3(3.0, 1.62, 1.0);
  readonly refKm = new THREE.Vector3(0, 0.00162, 300);
  constructor(maps: EarthMapSet, renderer: THREE.WebGLRenderer) {
    super(maps, { sunPower: 4.5, skyGain: 2.3, cloudOpacity: 0.32, near: 0.1, far: 12000 });
    this.u.uDensity.value = 0.8;
    this.peak.place(10, this.ref, this.refKm);
    this.peak.uniforms.uLogDepth.value = 1; this.peak.uniforms.uLogFar.value = 1.2e4;
    this.peak.mesh.renderOrder = -50;
    this.scene.add(depthClearer(-40), this.city.group, this.birds.mesh);
    for (const w of this.walkers) this.scene.add(w.person.root);
    // Keep a low-rise corridor down the avenue so the far horizon stays open.
    const lod = this.city.far.children[0] as THREE.InstancedMesh, m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < lod.count; i++) {
      lod.getMatrixAt(i, m); m.decompose(p, q, s);
      if (p.z < -60) {
        const corridor = Math.abs(p.x) < 120 ? 9 : Math.abs(p.x) < 300 ? 18 : 1e9;
        if (s.y > corridor) { s.y = corridor * (0.6 + 0.4 * ((i * 0.618) % 1)); p.y = s.y / 2; m.compose(p, q, s); lod.setMatrixAt(i, m); }
      }
    }
    lod.instanceMatrix.needsUpdate = true;
    this.sun = new THREE.DirectionalLight(0xfff0dc, 3.3);
    this.sun.position.copy(SUN).multiplyScalar(80); this.sun.target.position.set(0, 0, -6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -35, right: 35, top: 40, bottom: -40, near: 1, far: 200 });
    this.sun.shadow.bias = -0.0002; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target, new THREE.HemisphereLight(0xbcd3ea, 0x6b6155, 1.05));
    this.scene.fog = new THREE.FogExp2(0xc9d6e2, 0.00042);
    this.atmo.setCamera(this.refKm);
    this.scene.environment = this.atmo.toEnvironment(renderer); this.scene.environmentIntensity = 0.55;
  }
  update(t: number, shot: ShotInfo) {
    const opening = shot.sceneId === 'S01';
    this.peak.grow = opening ? growAt(t) : 0;
    this.peak.mesh.visible = opening;
    const clock = opening ? t : t - T.end;
    for (const w of this.walkers) poseWalker(w, clock, opening);
    // Birds lift off a cornice at the jolt and wheel north over the avenue.
    const fly = clock - T.birds;
    this.birds.mesh.visible = opening && fly > 0;
    if (fly > 0) {
      const head = new THREE.Vector3(0.35, 0.32, -1).normalize();
      this.birds.update(t, { center: new THREE.Vector3(-11.5 + head.x * 9 * fly, 19 + 2.5 * fly + head.y * 3 * fly, -14 + head.z * 9 * fly), heading: head, flapRate: 1.6 }, 2 * Math.PI * 4.2 * fly);
    }
    this.city.update(t, { wetness: 0.12, lights: 0.12 });
    this.syncSky(t);
  }
  anchors(t: number, shot: ShotInfo): Anchor[] { return []; }
}
