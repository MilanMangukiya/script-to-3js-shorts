import * as THREE from 'three';
import { CityStreetClassic, makeClassicCityCar } from '../../../library/environment/CityStreetClassic';
import { PedestrianCrowd } from '../../../library/characters/PedestrianCrowd';
import { POSE_STAND } from '../../../library/characters/Humanoid';
import { applyCameraSpec } from '../../../library/camera/KeyframeRig';
import { box, solid, surface, rod, glow } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { SetStage, outdoor, person, movingPose } from './common';
import { T, windowAt } from '../timeline';

export class StreetStage extends SetStage {
  private city = new CityStreetClassic({ seed: 6221, blocks: 7, farFieldRadius: 900, wetness: .85, vehicles: true });
  private crowd = new PedestrianCrowd({ seed: 8852, count: 20, width: 12, depth: 5, umbrellaCount: 0,
    heightRange: [1.58, 1.84], flagFraction: .5, childFraction: .08, dissolve: true, vanishStart_s: T.vanish });
  private sky: ReturnType<typeof outdoor>;
  private cars = [makeClassicCityCar(0xb86c48), makeClassicCityCar(0x6c8a9c)];
  private debris = new THREE.Group(); private shards: { mesh: THREE.Mesh; x: number; z: number; v: number }[] = [];
  private repair = new THREE.Group(); private workers: ReturnType<typeof person>[] = [];
  private survivor: ReturnType<typeof person>;
  private signal: THREE.Mesh;
  private drops: THREE.Mesh[] = [];
  constructor(renderer: THREE.WebGLRenderer) {
    super(); this.sky = outdoor(this.scene, renderer);
    this.scene.add(this.city.group, this.crowd.group, this.debris, this.repair, ...this.cars);
    // The retained crowd kit supplies roots, material erosion and seeded paths. Gait is analytic through Humanoid.
    for (const a of this.crowd.agents) if (!a.flagged) {
      solid(a.figure.head, new THREE.SphereGeometry(.054, 12, 8), surface(0x2a211c), [0, .08, -.11]);
    }
    const r = rng(446);
    for (let i = 0; i < 22; i++) {
      const mesh = box(this.debris, [.035 + r() * .09, .012, .04 + r() * .12], surface(i % 3 ? 0x9ab0bb : 0x292e35, .25, .4));
      this.shards.push({ mesh, x: r() * 2.5, z: (r() - .5) * 3, v: 1 + r() * 2 });
    }
    for (let i = 0; i < 3; i++) {
      const p = box(this.scene, [.15, .018, .08], surface(0x26364a, .3), [i - 2, 1.1, .5 + i * .6]); this.drops.push(p);
    }
    for (let i = 0; i < 2; i++) {
      const h = person(this.repair, [6.6 - i * 1.3, .15, -2.6 - i * .7], i, false);
      h.root.rotation.y = i ? 1.4 : -.8; this.workers.push(h);
      const vest = glow(0xbac74b, .04); box(h.root, [.34, .12, .27], vest, [0, 1.2, 0]);
      solid(h.head, new THREE.SphereGeometry(.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * .55), surface(0xe4dfb8), [0, .1, 0]);
    }
    rod(this.repair, [6.7, .15, -3], [6.7, 2.3, -3], .045, surface(0x5b6971, .4, .7));
    box(this.repair, [.28, .65, .25], surface(0x17242f), [6.7, 2.25, -3]);
    this.signal = solid(this.repair, new THREE.CircleGeometry(.072, 18), glow(0x48c989, 2), [6.7, 2.12, -2.865]);
    const tools = box(this.repair, [.5, .2, .3], surface(0x9d6548), [5.8, .25, -1.5]);
    rod(tools, [-.2, .08, 0], [.2, .08, 0], .018, surface(0x9ca9ad, .4, .8));
    this.survivor = person(this.repair, [5.8, .15, -.7], 2, false, false);
    this.survivor.root.rotation.y = .8;
    // A single amber-jacket survivor is seen in the ending reverse shot and on the cover.
    this.survivor.root.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.color.getHex() === 0x7c5c6c) o.material.color.set(0xb59240); });
    box(this.survivor.root, [.44, .24, .3], surface(0x9e794f), [0, 1.0, .3]);
  }
  update(t: number, shot: ShotInfo) {
    const ending = shot.sceneId === 'S09', memory = ending && shot.shotId === 'SH03';
    const clock = memory ? 2.5 * (1 - windowAt(t, 52, 54.8)) : ending ? t - 44 : t;
    const event = ending && !memory ? 5 : clock;
    this.crowd.group.position.z = shot.sceneId === 'S03' ? 3 : 0;
    this.crowd.dissolveEnabled = true; this.crowd.visibleCount = 20;
    this.crowd.vanishStart_s = T.vanish; this.crowd.survivorStop_s = 999;
    this.crowd.update(event, clock);
    for (let i = 0; i < this.crowd.agents.length; i++) {
      const a = this.crowd.agents[i];
      if (!a.flagged && event > 2 && !memory) {
        // Surviving people continue walking; selected near figures visibly turn and signal danger.
        if (i % 3 === 0) a.figure.setPose({ ...POSE_STAND, breath: Math.sin(t * 1.3 + i) * .25,
          headYaw: Math.sin(t * .8 + i) * .45, armR: [-1.0, .2, 1.2],
          legL: [Math.sin(clock * 3 + i) * .2, .1], legR: [-Math.sin(clock * 3 + i) * .2, .1] });
      }
      // Crowd material dissolve doesn't alter shadow material; vanished people must cast no shadows.
      if (a.flagged) a.root.visible = event < T.vanish + (i % 6) * .12 + 1.8;
    }
    this.repair.visible = ending && !memory;
    const repairT = t - 45.8;
    this.workers.forEach((h, i) => {
      movingPose(h, t, i, { armL: [-1.2 + Math.sin(t * 1.1 + i) * .12, .16, .85], armR: [-.7, .12, 1.1], headPitch: .2 });
    });
    this.survivor.root.position.set(5.8 + .18 * Math.sin(repairT * .4), .15, -.7 - .32 * Math.min(Math.max(repairT, 0), 3));
    movingPose(this.survivor, t, 4, { armL: [-.75, .1, 1.2], armR: [-.75, .1, 1.2] });
    this.survivor.root.visible = ending && shot.shotId === 'SH01';
    (this.signal.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 * windowAt(t, 46.3, 47.2);
    for (let i = 0; i < this.cars.length; i++) {
      const hit = T.collision + i * .12, dt = Math.max(0, t - hit);
      const approach = windowAt(t, 10.5 + i * .12, hit);
      const x = 2 + i * .3 + 4.3 * approach, z = -17 - i * 6 + 11 * approach;
      this.cars[i].visible = !ending && t >= 10.5;
      this.cars[i].position.set(x + .15 * Math.sin(dt * 20) * Math.exp(-dt * 4), dt ? Math.abs(Math.sin(dt * 12)) * .08 * Math.exp(-dt * 3) : 0, z);
      this.cars[i].rotation.set(.03 * Math.sin(dt * 18) * Math.exp(-dt * 4), .5 * approach + i * .3, -.025 * Math.sin(dt * 17) * Math.exp(-dt * 3));
    }
    this.debris.visible = !ending && t >= 12.24;
    for (const { mesh, x, z, v } of this.shards) {
      const dt = Math.max(0, t - 12.24), age = Math.min(dt, 1.05);
      mesh.position.set(6.3 + x * Math.min(age * 2, 1), Math.max(.025, v * age - 4.9 * age * age), -6 + z * age);
      mesh.rotation.set(age * v * 4, age * v, age * 5);
    }
    this.drops.forEach((m, i) => { const age = Math.max(0, event - T.vanish - i * .12); m.visible = age > 0 && !ending;
      m.position.y = Math.max(.025, 1.1 - 4.9 * age * age); m.rotation.z = Math.min(age * 3, 1.2); });
    this.city.update(t, { wetness: .85, lights: 1 });
    this.sky.follow(this.camera);
    if (memory) {
      // Interpolate the sway clock as well as the camera keyframes, so the closing pose meets frame zero.
      applyCameraSpec(this.camera, { ...shot.camera, handheld_sway: 0 }, t, 9 / 16);
      const u = windowAt(t, 52, 54.8), d = 1 - u;
      this.camera.position.x += Math.sin((t - 52) * 1.7) * .004 * d;
      this.camera.updateMatrixWorld(true);
    }
  }
}
