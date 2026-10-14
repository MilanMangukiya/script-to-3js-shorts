import * as THREE from 'three';
import { ClinicInterior } from '../../../library/environment/ClinicInterior';
import { RoomBox, tableLamp, chair, plant } from '../../../library/environment/RoomBox';
import { NewbornHand } from '../../../library/characters/NewbornHand';
import { POSE_STAND } from '../../../library/characters/Humanoid';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { box, rod, solid, surface, glow } from '../../../library/util/Modeling';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { SetStage, lightSet, person, movingPose } from './common';
import { windowAt } from '../timeline';

export class CareStage extends SetStage {
  private clinic = new ClinicInterior();
  private workers: ReturnType<typeof person>[] = [];
  constructor() {
    super(); this.scene.background = new THREE.Color(0x718892); this.scene.add(this.clinic); lightSet(this.scene, true);
    const points: [number, number, number][] = [[-.1, 0, 1.5], [2.7, .04, 2.1], [-2.4, 0, .2], [.65, 0, -4]];
    points.forEach((p, i) => { const h = person(this.clinic, p, i, true); h.root.rotation.y = i === 1 ? -.8 : 0; this.workers.push(h); });
    box(this.workers[0].handL, [.18, .23, .018], surface(0x24414f), [0, -.04, .03]);
    this.clinic.beds.forEach((bed, i) => {
      const p = person(bed, [0, .8, -.5], i, false); p.root.rotation.x = -Math.PI / 2; p.root.rotation.y = Math.PI;
      p.root.scale.multiplyScalar(.7); p.setPose({ ...POSE_STAND, armL: [-.1, .1, .4], armR: [-.1, .1, .4] });
    });
  }
  update(t: number) {
    this.clinic.update(t); const dt = t - 21.1;
    this.workers[0].root.position.set(-.1, 0, 1.5 + Math.min(dt, 2.7) * .65);
    this.workers.forEach((h, i) => movingPose(h, t, i, i === 0 ? { armL: [-.8, .1, 1.1], armR: [-.7, .1, 1.2] }
      : i === 1 ? { legL: [0, .08], legR: [0, .1], armL: [-1.35 + .12 * Math.sin(t * .9), .13, .7], lean: .17, headPitch: .2 } : {}));
    this.workers[3].root.position.z = -4 + dt * .55; this.clinic.cart.position.set(.65, 0, -3.2 + dt * .55);
  }
}
export class MaternityStage extends SetStage {
  private baby = new NewbornHand({ skinColor: 0xc38e79 });
  private clinician: ReturnType<typeof person>;
  private blanket: THREE.Mesh; private finger: THREE.Group; private palm = new THREE.Group();
  constructor() {
    super(); this.camera.near = .003; this.scene.background = new THREE.Color(0x6e797a);
    const room = new RoomBox({ width: 5, depth: 5, wallColor: 0xb8c6bd, floorColor: 0x7a8580 });
    this.scene.add(room); lightSet(this.scene, true); tableLamp(room, [-1.8, .8, -2], 0xffc58f, 5); plant(room, [1.8, 0, -4.3]); chair(room, -1.3, -2.5, .2);
    const white = surface(0xd0d8d1, .4, .2), chrome = surface(0xa6b6bb, .28, .75);
    box(this.scene, [.72, .06, 1.1], white, [0, .82, -1.5]);
    this.blanket = solid(this.scene, new THREE.SphereGeometry(1, 48, 32).scale(.31, .065, .49), surface(0x8fa9a1, .95), [0, .88, -1.5]);
    for (const x of [-.34, .34]) for (const z of [-1.98, -1.02]) rod(this.scene, [x, .1, z], [x, 1.03, z], .018, chrome);
    for (const x of [-.34, .34]) rod(this.scene, [x, 1.02, -2], [x, 1.02, -1], .016, chrome);
    this.baby.group.position.set(0, 1.0, -1.5); this.baby.group.rotation.y = -.15; this.scene.add(this.baby.group);
    this.finger = new THREE.Group(); this.finger.position.set(-.005, .985, -1.47); this.finger.rotation.y = Math.PI / 2;
    const skin = new THREE.MeshPhysicalMaterial({ color: 0xc59a7e, roughness: .66, sheen: .25, sheenColor: 0xecc1a4 });
    solid(this.finger, new THREE.CapsuleGeometry(.0075, .05, 12, 24).rotateX(Math.PI / 2), skin, [0, 0, .012]);
    solid(this.finger, new THREE.SphereGeometry(1, 24, 18).scale(.0055, .0007, .009), surface(0xe6c5b7, .38), [0, .0072, .035]);
    this.palm.add(this.finger); this.scene.add(this.palm);
    const band = solid(this.scene, new THREE.CylinderGeometry(.014, .014, .01, 24, 1, true).rotateX(Math.PI / 2), surface(0xe5e6d9), [0, .998, -1.532]); band.rotation.y = -.15;
    const closeFill = new THREE.PointLight(0xffd7b7, .8, .9, 2); closeFill.position.set(.18, 1.25, -1.1); this.scene.add(closeFill);
    this.clinician = person(this.scene, [1.1, 0, -2.3], 0, true); this.clinician.root.rotation.y = -.75;
  }
  update(t: number, shot: ShotInfo) {
    const grasp = windowAt(t, 34.4, 38.5);
    this.baby.update(t, grasp * .9); this.baby.group.position.y = 1.0 + Math.sin(t * 1.3) * .0006;
    this.blanket.scale.y = 1 + Math.sin(t * 1.3) * .012;
    this.finger.position.x = -.005 + .03 * (1 - windowAt(t, 30.5, 33.5));
    movingPose(this.clinician, t, 1, { legL: [0, .03], legR: [0, .03], lean: .18, armL: [-1.1, .15, .8], armR: [-1.2, .1, .8], headPitch: .3 });
    this.clinician.root.visible = shot.sceneId === 'S06';
  }
}
export class StorageStage extends SetStage {
  private canister = new THREE.Group(); private vapour: SmokeWisp[] = [];
  constructor() {
    super(); this.scene.background = new THREE.Color(0x344e60);
    const room = new RoomBox({ width: 6, depth: 6, wallColor: 0x809ba7, floorColor: 0x486474 });
    this.scene.add(room); lightSet(this.scene);
    const steel = new THREE.MeshPhysicalMaterial({ color: 0xa4b6c1, roughness: .27, metalness: .86, clearcoat: .3 });
    const trim = surface(0x334b59, .35, .6), white = surface(0xdce5df);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); g.position.set((i - 1) * 1.25, 0, -1 - Math.abs(i - 1) * .8); this.scene.add(g);
      solid(g, new THREE.CylinderGeometry(.38, .34, 1.0, 48), steel, [0, .58, 0]);
      solid(g, new THREE.TorusGeometry(.35, .035, 10, 48).rotateX(Math.PI / 2), trim, [0, .1, 0]);
      solid(g, new THREE.CylinderGeometry(.22, .34, .16, 40), steel, [0, 1.16, 0]);
      solid(g, new THREE.CylinderGeometry(.12, .12, .14, 32, 1, true), trim, [0, 1.3, 0]);
      box(g, [.24, .15, .008], white, [0, .85, .376]);
      for (const s of [-1, 1]) rod(g, [s * .32, .94, 0], [s * .45, 1.08, 0], .023, trim);
      const w = new SmokeWisp({ height: .52, baseWidth: .045, topWidth: .18, curl: .11, riseSpeed: .15, color: 0xd9edf1, opacity: .3, seed: 52 + i });
      w.mesh.position.copy(g.position).add(new THREE.Vector3(0, 1.37, 0)); this.scene.add(w.mesh); this.vapour.push(w);
    }
    this.canister.position.set(0, 1.06, -1); this.scene.add(this.canister);
    solid(this.canister, new THREE.CylinderGeometry(.08, .08, .24, 24, 1, true), surface(0x829aaa, .35, .8));
    rod(this.canister, [0, 0, 0], [0, .3, 0], .009, steel);
    const colours = [0xddb45b, 0xd98682, 0x78b6c1, 0xc8dacb];
    for (let i = 0; i < 12; i++) { const a = i * 2.399; solid(this.canister, new THREE.CylinderGeometry(.004, .004, .2, 8), surface(colours[i % 4], .3), [Math.cos(a) * .052, .12, Math.sin(a) * .052]); }
    for (const x of [-2.1, 2.1]) box(room, [.04, 2.2, .04], glow(0x8abce0, 1.4), [x, 1.35, -5.9]);
  }
  update(t: number) {
    this.canister.position.y = 1.02 + .42 * windowAt(t, 41.4, 43.1);
    this.vapour.forEach(w => w.update(t, 12, .26, this.camera));
  }
}
