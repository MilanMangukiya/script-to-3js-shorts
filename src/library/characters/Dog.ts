import * as THREE from 'three';

export interface DogOptions {
  /** Coat colour (default golden), lighter muzzle/chest colour, nose/eye colour. */
  coat?: THREE.ColorRepresentation; light?: THREE.ColorRepresentation; dark?: THREE.ColorRepresentation;
  /** Uniform scale (1 = a 0.55 m-at-the-shoulder retriever, about 0.95 m nose to tail base). */
  scale?: number;
}

export interface DogPose {
  /** 0 = standing, 1 = sitting (hips down, chest up). */
  sit?: number;
  /** Head roll (the quizzical tilt), yaw (+ turns toward the dog's left) and pitch (- looks up) in radians, about a level neck. */
  headTilt?: number; headYaw?: number; headPitch?: number;
  /** 0..1 mouth open (pant or bark). */
  mouth?: number;
  /** Tail wag angle (side to side) and lift (0 = relaxed down, 1 = up). */
  tailWag?: number; tailLift?: number;
  /** 0..1 ears lifted (alert). */
  ears?: number;
}

/**
 * dog-v1 — procedural stylised dog in metres facing +Z with its feet on y = 0: capsule body pivoting at the hips
 * (so it can sit), chest, four legs that stay vertical or fold, head with snout, nose, eyes, floppy ears and a tail.
 * setPose() blends standing/sitting and drives head tilt/turn, mouth (pant or bark), tail wag and ears; headWorld()
 * and mouthWorld() give anchor points. Every pose call sets the full state.
 */
export class Dog {
  readonly root = new THREE.Group();
  private hips = new THREE.Group(); private body = new THREE.Group();
  private neck = new THREE.Group(); private head = new THREE.Group(); private jaw = new THREE.Group(); private tail = new THREE.Group();
  private earL = new THREE.Group(); private earR = new THREE.Group();
  private front: THREE.Group[] = []; private hind: THREE.Group[] = [];
  private mouthPt = new THREE.Object3D(); private headPt = new THREE.Object3D();

  constructor(o: DogOptions = {}) {
    const coat = new THREE.MeshStandardMaterial({ color: o.coat ?? 0xc8923e, roughness: 0.85 });
    const light = new THREE.MeshStandardMaterial({ color: o.light ?? 0xe6c48a, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: o.dark ?? 0x1a1411, roughness: 0.35 });
    const add = (p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, pos: [number, number, number], rot?: [number, number, number]) => {
      const mesh = new THREE.Mesh(g, m); mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); mesh.castShadow = true; mesh.receiveShadow = true; p.add(mesh); return mesh;
    };
    this.root.scale.setScalar(o.scale ?? 1);
    // Hips pivot at the rear; the body extends forward (+Z) from it.
    this.root.add(this.hips); this.hips.add(this.body);
    add(this.body, new THREE.CapsuleGeometry(0.16, 0.42, 6, 14).rotateX(Math.PI / 2), coat, [0, 0, 0.27]);
    add(this.body, new THREE.SphereGeometry(0.155, 14, 10).scale(1, 1.0, 1.05), coat, [0, -0.01, 0.47]);
    add(this.body, new THREE.SphereGeometry(0.1, 12, 8).scale(1, 1.2, 0.8), light, [0, -0.06, 0.56]);
    // Legs: groups whose origin is the joint, mesh hanging down 0.42 m.
    const leg = (parent: THREE.Object3D, x: number, z: number, list: THREE.Group[]) => {
      const g = new THREE.Group(); g.position.set(x, -0.04, z); parent.add(g); list.push(g);
      add(g, new THREE.CylinderGeometry(0.045, 0.038, 0.4, 8), coat, [0, -0.2, 0]);
      add(g, new THREE.SphereGeometry(0.05, 8, 6).scale(1, 0.6, 1.3), light, [0, -0.41, 0.02]);
    };
    leg(this.body, -0.09, 0.5, this.front); leg(this.body, 0.09, 0.5, this.front);
    leg(this.hips, -0.1, 0.02, this.hind); leg(this.hips, 0.1, 0.02, this.hind);
    // Head on a short neck at the front of the body.
    this.neck.position.set(0, 0.17, 0.66); this.body.add(this.neck); this.neck.add(this.head);
    add(this.head, new THREE.SphereGeometry(0.135, 16, 12).scale(1, 0.95, 1.05), coat, [0, 0.03, 0]);
    add(this.head, new THREE.CapsuleGeometry(0.062, 0.12, 6, 10).rotateX(Math.PI / 2), coat, [0, -0.03, 0.15]);
    add(this.head, new THREE.SphereGeometry(0.045, 10, 8).scale(1, 0.7, 0.9), light, [0, -0.05, 0.2]);
    add(this.head, new THREE.SphereGeometry(0.032, 10, 8), dark, [0, -0.005, 0.265]);
    for (const sx of [-1, 1]) add(this.head, new THREE.SphereGeometry(0.022, 8, 6), dark, [sx * 0.065, 0.07, 0.105]);
    this.jaw.position.set(0, -0.07, 0.09); this.head.add(this.jaw);
    add(this.jaw, new THREE.CapsuleGeometry(0.03, 0.08, 4, 8).rotateX(Math.PI / 2), coat, [0, -0.012, 0.06]);
    this.mouthPt.position.set(0, 0, 0.15); this.jaw.add(this.mouthPt);
    this.headPt.position.set(0, 0.06, 0.05); this.head.add(this.headPt);
    for (const [g, sx] of [[this.earL, -1], [this.earR, 1]] as const) {
      g.position.set(sx * 0.1, 0.09, -0.02); this.head.add(g);
      add(g, new THREE.SphereGeometry(1, 10, 6).scale(0.03, 0.1, 0.06), new THREE.MeshStandardMaterial({ color: new THREE.Color(o.coat ?? 0xc8923e).multiplyScalar(0.6), roughness: 0.85 }), [sx * 0.02, -0.08, 0]);
    }
    this.tail.position.set(0, 0.07, -0.18); this.hips.add(this.tail);
    add(this.tail, new THREE.CapsuleGeometry(0.03, 0.3, 4, 8).rotateX(-0.6), coat, [0, 0.08, -0.13]);
    this.setPose({});
  }

  setPose(p: DogPose) {
    const s = Math.max(0, Math.min(1, p.sit ?? 0));
    // Standing: hips at 0.46 m, body level. Sitting: hips drop to 0.2 m and the body tips up 34 degrees.
    const tilt = s * 0.6, hipY = 0.46 - 0.26 * s;
    this.hips.position.set(0, hipY, -0.2);
    this.hips.rotation.x = -tilt;
    // Front legs stay vertical and reach the ground; hind legs fold forward when sitting.
    const shoulderY = hipY + Math.sin(tilt) * 0.5 - 0.04;
    for (const g of this.front) { g.rotation.x = tilt; g.scale.y = Math.max(0.6, (shoulderY + 0.02) / 0.44); }
    for (const g of this.hind) { g.rotation.x = tilt - 1.35 * s; g.scale.y = 1 - 0.25 * s; }
    this.neck.rotation.x = tilt;
    this.head.rotation.set(p.headPitch ?? 0, p.headYaw ?? 0, p.headTilt ?? 0, 'YXZ');
    this.jaw.rotation.x = 0.5 * Math.max(0, Math.min(1, p.mouth ?? 0));
    this.tail.rotation.set(-0.5 * (p.tailLift ?? 0.4) + tilt * 0.5, p.tailWag ?? 0, 0);
    const e = p.ears ?? 0; this.earL.rotation.set(-0.4 * e, 0, -0.15 - 0.3 * e); this.earR.rotation.set(-0.4 * e, 0, 0.15 + 0.3 * e);
    this.root.updateMatrixWorld(true);
  }

  headWorld(out = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.headPt.getWorldPosition(out); }
  mouthWorld(out = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.mouthPt.getWorldPosition(out); }
}
