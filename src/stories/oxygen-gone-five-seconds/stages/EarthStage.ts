import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { rng, ramp, smoothstep, lerp } from '../../../library/util/math';
import { T } from '../timeline';

/** Centre and size of the schematic air-sample box (Earth radius = 1). */
export const SAMPLE_BOX = { center: new THREE.Vector3(0, 1.43, 0.6), size: new THREE.Vector3(0.56, 0.56, 0.3) };

/**
 * Orbital stage (Earth radius = 1 unit).
 *  S02: sunlit limb with a schematic sample of 100 air molecules that loses its 21 O2 molecules.
 *  S08/SH02: night side over Europe where city lights fade in illustrative patches.
 */
export class EarthStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.05, 2000);
  private earth: Earth; private stars: Starfield;
  private sample = new THREE.Group();
  private pairs: THREE.InstancedMesh; private argon: THREE.Mesh;
  private mol: { base: THREE.Vector3; ph: number[]; axis: THREE.Vector3; spin: number; o2: boolean }[] = [];
  private dummy = new THREE.Object3D();
  private sunDay = new THREE.Vector3(0.8, 0.32, 0.5).normalize();
  private sunNight = new THREE.Vector3(0.15, 0.55, -0.82).normalize();
  private molLight: THREE.DirectionalLight;

  constructor(tex: EarthTextures) {
    const s = this.scene;
    s.background = new THREE.Color(0x01030a);
    this.earth = new Earth(tex, { radius: 1, sunDirection: this.sunDay, atmosphereStrength: 1.0, nightLights: 2.6 });
    this.earth.spinRate = 0.0035;
    s.add(this.earth.group);
    this.stars = new Starfield({ seed: 19, count: 2600, radius: 900, brightness: 0.6, maxSize: 4.5 });
    s.add(this.stars.points);

    // --- Schematic sample: 78 N2 + 21 O2 dumbbells and 1 argon atom ---------------------------------------------
    const r = rng(77), B = SAMPLE_BOX;
    const sphere = new THREE.SphereGeometry(0.5, 14, 10);
    const dumbbell = mergeGeometries([sphere.clone().translate(-0.36, 0, 0), sphere.clone().translate(0.36, 0, 0)])!;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.0, emissive: 0x18202c, emissiveIntensity: 0.6 });
    this.pairs = new THREE.InstancedMesh(dumbbell, mat, 99);
    const n2 = new THREE.Color(0x7d9bd0), o2 = new THREE.Color(0xff6a52);
    // Jittered grid so molecules fill the box evenly without overlapping.
    const cells: THREE.Vector3[] = [];
    for (let ix = 0; ix < 5; ix++) for (let iy = 0; iy < 5; iy++) for (let iz = 0; iz < 4; iz++) cells.push(new THREE.Vector3((ix + 0.5) / 5 - 0.5, (iy + 0.5) / 5 - 0.5, (iz + 0.5) / 4 - 0.5));
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const o2Slots = new Set<number>(); while (o2Slots.size < 21) o2Slots.add(Math.floor(r() * 99));
    for (let i = 0; i < 100; i++) {
      const c = cells[i];
      const base = new THREE.Vector3((c.x + (r() - 0.5) * 0.09) * B.size.x * 0.9, (c.y + (r() - 0.5) * 0.09) * B.size.y * 0.9, (c.z + (r() - 0.5) * 0.12) * B.size.z * 0.85);
      this.mol.push({ base, ph: [r() * 6.28, r() * 6.28, r() * 6.28, 0.5 + r() * 0.7], axis: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), spin: (r() - 0.5) * 2.4, o2: i < 99 && o2Slots.has(i) });
      if (i < 99) this.pairs.setColorAt(i, o2Slots.has(i) ? o2 : n2);
    }
    this.pairs.instanceColor!.needsUpdate = true;
    this.pairs.frustumCulled = false;
    this.argon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd9c9ff, roughness: 0.3, emissive: 0x2a2440, emissiveIntensity: 0.6 }));
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(B.size.x, B.size.y, B.size.z)), new THREE.LineBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.38 }));
    const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -B.size.y / 2 - 0.085, 0), new THREE.Vector3(0, 1.02 - B.center.y, 0.24 - B.center.z)]),
      new THREE.LineDashedMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.4, dashSize: 0.02, gapSize: 0.014 }));
    leader.computeLineDistances();
    this.sample.add(this.pairs, this.argon, frame, leader);
    this.sample.position.copy(B.center);
    s.add(this.sample);
    this.molLight = new THREE.DirectionalLight(0xfff4e2, 3.0); this.molLight.position.copy(this.sunDay).multiplyScalar(10);
    s.add(this.molLight, new THREE.HemisphereLight(0x9fc0ff, 0x1a2238, 1.1));
  }

  update(t: number, shot: ShotInfo) {
    const night = shot.sceneId === 'S08';
    const e = this.earth;
    this.sample.visible = !night;
    if (night) {
      e.setView(12, 16); e.sunDirection = this.sunNight;
      e.scatter = 1; e.cloudOpacity = 0.55;
      e.outageScale = 9; e.outageSeed = 1.3;
      e.nightOutage = 0.6 * smoothstep(T.outageStart, T.outageEnd, t);
      this.stars.brightness = 1.25;
    } else {
      e.setView(17, 6); e.sunDirection = this.sunDay;
      e.cloudOpacity = 0.9; e.nightOutage = 0;
      // A fifth fewer molecules scatter a fifth less sunlight: the limb glow steps down with the oxygen.
      e.scatter = lerp(1, 0.8, ramp(t, T.moleculesOut, T.moleculesOut + 0.25));
      this.stars.brightness = 0.55;
      const gone = ramp(t, T.moleculesOut, T.moleculesOut + 0.22), pop = 1 + 0.35 * Math.sin(Math.min(1, gone * 2.2) * Math.PI);
      const d = this.dummy, size = 0.031;
      for (let i = 0; i < 100; i++) {
        const m = this.mol[i], k = m.ph[3];
        d.position.set(m.base.x + Math.sin(t * 0.55 * k + m.ph[0]) * 0.026, m.base.y + Math.sin(t * 0.47 * k + m.ph[1]) * 0.026, m.base.z + Math.sin(t * 0.5 * k + m.ph[2]) * 0.02);
        d.quaternion.setFromAxisAngle(m.axis, m.ph[0] + t * m.spin);
        if (i < 99) {
          d.scale.setScalar(m.o2 ? size * pop * (1 - gone) : size);
          d.updateMatrix(); this.pairs.setMatrixAt(i, d.matrix);
        } else { this.argon.position.copy(d.position); this.argon.scale.setScalar(size * 1.25); }
      }
      this.pairs.instanceMatrix.needsUpdate = true;
    }
    e.update(t);
    this.stars.follow(this.camera);
  }
}
