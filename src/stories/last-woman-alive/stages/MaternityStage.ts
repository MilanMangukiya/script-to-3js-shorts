import * as THREE from 'three';
import { RoomBox, tableLamp, plant } from '../../../library/environment/RoomBox';
import { NewbornHand } from '../../../library/characters/NewbornHand';
import { surface, solid, box, rod } from '../../../library/util/Modeling';
import { SetStage, lightSet } from './common';
import { windowAt } from '../timeline';

/** A possible later birth, contingent on the conditions spoken in S08. */
export class MaternityStage extends SetStage {
  private baby = new NewbornHand({ skinColor: 0xc38e79 });
  private blanket: THREE.Mesh; private finger: THREE.Group;
  constructor() {
    super(); this.camera.near = .003; this.scene.background = new THREE.Color(0x71827d);
    const room = new RoomBox({ width: 5, depth: 5, wallColor: 0xb9c8be, floorColor: 0x7c8b82 });
    this.scene.add(room); lightSet(this.scene, true); tableLamp(room, [-1.8, .8, -2], 0xffc58f, 5); plant(room, [1.8, 0, -4.3]);
    const white = surface(0xd8ded7, .4, .2), chrome = surface(0xa6b6bb, .28, .75);
    box(this.scene, [.72, .06, 1.1], white, [0, .82, -1.5]);
    this.blanket = solid(this.scene, new THREE.SphereGeometry(1, 48, 32).scale(.31, .065, .49), surface(0xb8b8a5, .95), [0, .88, -1.5]);
    for (const x of [-.34, .34]) for (const z of [-1.98, -1.02]) rod(this.scene, [x, .1, z], [x, 1.03, z], .018, chrome);
    for (const x of [-.34, .34]) rod(this.scene, [x, 1.02, -2], [x, 1.02, -1], .016, chrome);
    this.baby.group.position.set(0, 1, -1.5); this.baby.group.rotation.y = -.15; this.scene.add(this.baby.group);
    this.finger = new THREE.Group(); this.finger.position.set(-.005, .985, -1.47); this.finger.rotation.y = Math.PI / 2; this.scene.add(this.finger);
    const skin = new THREE.MeshPhysicalMaterial({ color: 0xc59a7e, roughness: .66, sheen: .25, sheenColor: 0xecc1a4 });
    solid(this.finger, new THREE.CapsuleGeometry(.0075, .05, 12, 24).rotateX(Math.PI / 2), skin, [0, 0, .012]);
    solid(this.finger, new THREE.SphereGeometry(1, 24, 18).scale(.0055, .0007, .009), surface(0xe6c5b7, .38), [0, .0072, .035]);
    solid(this.scene, new THREE.CylinderGeometry(.014, .014, .01, 24, 1, true).rotateX(Math.PI / 2), surface(0xe5e6d9), [0, .998, -1.532]);
    const closeFill = new THREE.PointLight(0xffd7b7, .55, .9, 2); closeFill.position.set(.18, 1.25, -1.1); this.scene.add(closeFill);
  }
  update(t: number) {
    this.baby.update(t, .9 * windowAt(t, 43.2, 46.8));
    this.baby.group.position.y = 1 + Math.sin(t * 1.3) * .0006;
    this.blanket.scale.y = 1 + Math.sin(t * 1.3) * .012;
    this.finger.position.x = -.005 + .025 * (1 - windowAt(t, 41.2, 43.2));
  }
}
