import * as THREE from 'three';
import { lerp, clamp } from '../util/math';

export interface HumanoidOptions {
  /** Standing height in metres. */
  height?: number;
  coatColor?: THREE.ColorRepresentation; trouserColor?: THREE.ColorRepresentation; skinColor?: THREE.ColorRepresentation;
  hairColor?: THREE.ColorRepresentation; shoeColor?: THREE.ColorRepresentation; scarfColor?: THREE.ColorRepresentation | null;
  /** 'long' adds a coat skirt (standing figures); 'jacket' leaves the legs free (seated figures). */
  coat?: 'long' | 'jacket';
  /** Knitted hat instead of visible hair. */
  hat?: boolean;
}

/** Joint angles in radians. Arms: [shoulderPitch (negative = forward/up), shoulderRoll (outward positive), elbowFlex (positive = bend)]. Legs: [hipFlex (positive = thigh forward), kneeFlex (positive = bend)]. */
export interface HumanoidPose {
  /** Pelvis height above the figure origin, metres at 1.72 m scale (standing ≈ 0.92, seated ≈ 0.46). */
  hipsY: number;
  lean: number; twist: number; sideLean: number;
  headPitch: number; headYaw: number;
  armL: [number, number, number]; armR: [number, number, number];
  legL: [number, number]; legR: [number, number];
  shrug: number; breath: number;
}

export const POSE_STAND: HumanoidPose = {
  hipsY: 0.92, lean: 0.02, twist: 0, sideLean: 0, headPitch: 0, headYaw: 0,
  armL: [0.04, 0.07, 0.12], armR: [0.04, 0.07, 0.12], legL: [0, 0], legR: [0, 0], shrug: 0, breath: 0,
};
export const POSE_SIT: HumanoidPose = {
  hipsY: 0.47, lean: 0.3, twist: 0, sideLean: 0, headPitch: -0.05, headYaw: 0,
  armL: [-0.75, 0.1, 0.95], armR: [-0.75, 0.1, 0.95], legL: [1.45, 1.5], legR: [1.45, 1.5], shrug: 0, breath: 0,
};

export function lerpPose(a: HumanoidPose, b: Partial<HumanoidPose>, t: number): HumanoidPose {
  const out: any = {};
  for (const k of Object.keys(a) as (keyof HumanoidPose)[]) {
    const va = a[k] as any, vb = (b[k] ?? va) as any;
    out[k] = Array.isArray(va) ? va.map((x: number, i: number) => lerp(x, vb[i], t)) : lerp(va, vb, t);
  }
  return out as HumanoidPose;
}

/**
 * Procedural articulated adult figure for respectful mid-distance, back-view and silhouette shots.
 * Built from capsules/spheres with a simple joint hierarchy; faces +Z in its local frame; origin at the feet.
 * Call `setPose` with joint angles (interpolate poses with `lerpPose`) — no internal time or state.
 */
export class Humanoid {
  readonly root = new THREE.Group();
  private hips = new THREE.Group(); private spine = new THREE.Group(); private chest = new THREE.Group();
  /** Head joint; use head.localToWorld() to find targets such as an ear. */
  readonly head = new THREE.Group();
  private shoulder: THREE.Group[] = []; private elbow: THREE.Group[] = [];
  private hip: THREE.Group[] = []; private knee: THREE.Group[] = [];
  private s: number;
  /** Local-space anchors useful for effects (chest centre and head centre), updated by setPose. */
  readonly chestAnchor = new THREE.Object3D(); readonly headAnchor = new THREE.Object3D();
  readonly handR = new THREE.Object3D(); readonly handL = new THREE.Object3D();
  /** Attachment anchors for gear such as packs, tanks, belts and fins (empty objects; no effect on the figure). */
  readonly backAnchor = new THREE.Object3D(); readonly waistAnchor = new THREE.Object3D();
  readonly footL = new THREE.Object3D(); readonly footR = new THREE.Object3D();

  constructor(o: HumanoidOptions = {}) {
    const s = (this.s = (o.height ?? 1.72) / 1.72);
    const std = (color: THREE.ColorRepresentation, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    const coat = std(o.coatColor ?? 0x2f3d55), trousers = std(o.trouserColor ?? 0x1d2028), skin = std(o.skinColor ?? 0xc99a78, 0.75);
    const hair = std(o.hairColor ?? 0x241a14, 0.95), shoe = std(o.shoeColor ?? 0x15151a, 0.7);
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    this.root.scale.setScalar(s);
    this.root.add(this.hips);
    // Pelvis
    add(this.hips, new THREE.SphereGeometry(0.15, 16, 12).scale(1.12, 0.75, 0.8), o.coat === 'jacket' ? trousers : coat);
    this.hips.add(this.spine);
    // Torso (slightly flattened capsule), chest group scales with breathing.
    this.spine.add(this.chest);
    const torso = add(this.chest, new THREE.CapsuleGeometry(0.155, 0.26, 8, 20), coat, 0, 0.28, 0); torso.scale.set(1.12, 1, 0.72);
    add(this.chest, new THREE.SphereGeometry(0.1, 14, 10).scale(2.35, 0.75, 1.0), coat, 0, 0.47, 0); // shoulder yoke
    if (o.coat !== 'jacket') {
      const skirt = add(this.hips, new THREE.CylinderGeometry(0.165, 0.235, 0.52, 20, 1, true), coat, 0, -0.2, 0); skirt.scale.set(1.08, 1, 0.76);
      (skirt.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    } else {
      const hem = add(this.hips, new THREE.CylinderGeometry(0.168, 0.185, 0.16, 20, 1, true), coat, 0, 0.03, 0); hem.scale.set(1.1, 1, 0.78);
      (hem.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    }
    if (o.scarfColor !== null) add(this.chest, new THREE.TorusGeometry(0.075, 0.034, 10, 20).rotateX(Math.PI / 2), std(o.scarfColor ?? 0xa9523f, 0.95), 0, 0.535, 0.005).scale.set(1.05, 1.25, 1);
    // Neck + head
    add(this.chest, new THREE.CylinderGeometry(0.045, 0.05, 0.09, 12), skin, 0, 0.56, 0);
    this.head.position.set(0, 0.6, 0); this.chest.add(this.head);
    add(this.head, new THREE.SphereGeometry(0.105, 22, 16).scale(0.9, 1.1, 1.0), skin, 0, 0.115, 0.005);
    add(this.head, new THREE.SphereGeometry(0.02, 8, 6).scale(0.6, 1.2, 0.9), skin, 0.096, 0.105, 0.0);   // ears
    add(this.head, new THREE.SphereGeometry(0.02, 8, 6).scale(0.6, 1.2, 0.9), skin, -0.096, 0.105, 0.0);
    if (o.hat) add(this.head, new THREE.SphereGeometry(0.112, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.93, 1.08, 1.03), std(o.scarfColor ?? 0x7a3b30, 0.98), 0, 0.135, -0.002);
    else add(this.head, new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(0.93, 1.1, 1.04).rotateX(-0.42), hair, 0, 0.128, -0.012);
    this.headAnchor.position.set(0, 0.115, 0); this.head.add(this.headAnchor);
    this.chestAnchor.position.set(0, 0.36, 0.02); this.chest.add(this.chestAnchor);
    this.backAnchor.position.set(0, 0.3, -0.12); this.chest.add(this.backAnchor);
    this.waistAnchor.position.set(0, 0.02, 0); this.hips.add(this.waistAnchor);
    // Arms (index 0 = left at +X, 1 = right at -X)
    for (const side of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(side * 0.2, 0.47, 0); this.chest.add(sh); this.shoulder.push(sh);
      add(sh, new THREE.CapsuleGeometry(0.05, 0.2, 6, 12), coat, 0, -0.14, 0);
      const el = new THREE.Group(); el.position.set(0, -0.29, 0); sh.add(el); this.elbow.push(el);
      add(el, new THREE.CapsuleGeometry(0.043, 0.18, 6, 12), coat, 0, -0.12, 0);
      add(el, new THREE.SphereGeometry(0.043, 12, 10).scale(0.85, 1.15, 0.6), skin, 0, -0.275, 0);
      const anchor = side === 1 ? this.handL : this.handR; anchor.position.set(0, -0.275, 0); el.add(anchor);
    }
    // Legs
    for (const side of [1, -1]) {
      const hp = new THREE.Group(); hp.position.set(side * 0.09, -0.03, 0); this.hips.add(hp); this.hip.push(hp);
      add(hp, new THREE.CapsuleGeometry(0.075, 0.3, 6, 12), trousers, 0, -0.22, 0);
      const kn = new THREE.Group(); kn.position.set(0, -0.45, 0); hp.add(kn); this.knee.push(kn);
      add(kn, new THREE.CapsuleGeometry(0.056, 0.29, 6, 12), trousers, 0, -0.2, 0);
      add(kn, new THREE.BoxGeometry(0.095, 0.065, 0.25), shoe, 0, -0.41, 0.06);
      const foot = side === 1 ? this.footL : this.footR; foot.position.set(0, -0.41, 0.06); kn.add(foot);
    }
    this.setPose(POSE_STAND);
  }

  setPose(p: HumanoidPose) {
    this.hips.position.y = p.hipsY;
    this.spine.rotation.set(p.lean, p.twist, p.sideLean);
    this.chest.scale.set(1 + p.breath * 0.035, 1 + p.breath * 0.012, 1 + p.breath * 0.07);
    this.head.rotation.set(p.headPitch, p.headYaw, 0, 'YXZ');
    const arms = [p.armL, p.armR];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1, [pitch, roll, flex] = arms[i];
      this.shoulder[i].position.y = 0.47 + p.shrug * 0.035;
      this.shoulder[i].rotation.set(pitch, 0, side * roll, 'ZXY');
      this.elbow[i].rotation.set(-flex, 0, 0);
    }
    const legs = [p.legL, p.legR];
    for (let i = 0; i < 2; i++) { this.hip[i].rotation.x = -legs[i][0]; this.knee[i].rotation.x = legs[i][1]; }
    this.root.updateMatrixWorld(true);
  }

  /**
   * Two-bone IK: bring a hand to a world-space target (e.g. an ear, a railing, a mug). Call after setPose.
   * @param poleWorld direction the elbow should swing toward
   * @param weight 0 keeps the posed arm, 1 reaches fully (blend for natural motion)
   */
  reachArm(side: 'L' | 'R', targetWorld: THREE.Vector3, poleWorld: THREE.Vector3, weight = 1) {
    if (weight <= 0) return;
    const i = side === 'L' ? 0 : 1, sh = this.shoulder[i], el = this.elbow[i], L1 = 0.29, L2 = 0.275;
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.chest.matrixWorld).invert();
    const to = targetWorld.clone().applyMatrix4(inv).sub(sh.position);
    const d = clamp(to.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3); to.normalize();
    const flex = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const pole = poleWorld.clone().transformDirection(inv);
    const perp = pole.sub(to.clone().multiplyScalar(pole.dot(to)));
    if (perp.lengthSq() < 1e-8) perp.set(-to.y, to.x, 0).add(new THREE.Vector3(0, -to.z, to.y)).normalize(); else perp.normalize();
    const u = to.clone().multiplyScalar(Math.cos(A)).add(perp.clone().multiplyScalar(Math.sin(A)));       // shoulder → elbow
    const f = to.clone().multiplyScalar(d).sub(u.clone().multiplyScalar(L1)).normalize();                 // elbow → hand
    const b = f.clone().sub(u.clone().multiplyScalar(f.dot(u)));
    if (b.lengthSq() < 1e-8) b.copy(perp).multiplyScalar(-1);
    b.normalize();
    const Y = u.clone().multiplyScalar(-1), X = new THREE.Vector3().crossVectors(Y, b).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, b));
    sh.quaternion.slerp(q, weight);
    el.rotation.x = lerp(el.rotation.x, -flex, weight);
    this.root.updateMatrixWorld(true);
  }
}
