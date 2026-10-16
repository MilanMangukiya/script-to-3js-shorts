import * as THREE from 'three';
import { makeClassicCityCar } from '../../../library/environment/CityStreetClassic';
import { Humanoid, POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { applyGroundedPose, seatedPose } from '../../../library/characters/CharacterMotion';

export const SIDEWALK_Y = 0.1;

/** Speed keyframes [t, v] (m/s), linear between keys and held outside; returns distance travelled since t0. */
export function distanceAt(t: number, t0: number, keys: [number, number][]): number {
  const speed = (x: number) => {
    if (x <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [a, va] = keys[i], [b, vb] = keys[i + 1];
      if (x <= b) return va + (vb - va) * (x - a) / (b - a);
    }
    return keys[keys.length - 1][1];
  };
  // Exact for piecewise-linear speed: trapezoids between breakpoints.
  const pts = [t0, ...keys.map(k => k[0]).filter(k => k > Math.min(t0, t) && k < Math.max(t0, t)), t].sort((a, b) => a - b);
  let d = 0;
  for (let i = 0; i < pts.length - 1; i++) d += (speed(pts[i]) + speed(pts[i + 1])) * 0.5 * (pts[i + 1] - pts[i]);
  return t >= t0 ? d : -d;
}
export function gaitPose(phase: number, amount: number): HumanoidPose {
  const s = Math.sin(phase) * amount;
  return { ...POSE_STAND, legL: [s, .06 + Math.max(0, -s) * .65], legR: [-s, .06 + Math.max(0, s) * .65],
    armL: [-s * .5, .08, .16], armR: [s * .5, .08, .16], breath: Math.sin(phase * .5) * .12 };
}

export interface WalkPlan { start: [number, number]; heading: number; t0: number; speed: [number, number][]; ground?: number; step?: number }
export interface PersonStyle { height: number; coat: number; trousers: number; skin: number; hair?: number; hat?: boolean }
/** A Humanoid whose full pose is set from absolute time on every call (walking, standing or seated). */
export class Person {
  readonly h: Humanoid;
  constructor(parent: THREE.Object3D, o: PersonStyle) {
    this.h = new Humanoid({ height: o.height, coat: 'jacket', coatColor: o.coat, trouserColor: o.trousers, skinColor: o.skin, hairColor: o.hair ?? 0x241a14, hat: o.hat, scarfColor: null });
    parent.add(this.h.root);
    this.h.root.visible = false;
  }
  walk(t: number, p: WalkPlan, act?: { pose: Partial<HumanoidPose>; w: number }) {
    const d = distanceAt(t, p.t0, p.speed), v = Math.abs(distanceAt(t + .02, p.t0, p.speed) - distanceAt(t - .02, p.t0, p.speed)) / .04;
    const step = (p.step ?? .69) * this.h.root.scale.y;
    const gait = gaitPose(Math.PI * d / step, .4 * Math.min(1, v / .9));
    const pose = act && act.w > 0 ? lerpPose(gait, { ...gait, ...act.pose }, act.w) : gait;
    this.h.root.visible = true;
    this.h.root.position.set(p.start[0] + Math.sin(p.heading) * d, 0, p.start[1] + Math.cos(p.heading) * d);
    this.h.root.rotation.set(0, p.heading, 0);
    applyGroundedPose(this.h, pose, p.ground ?? SIDEWALK_Y);
  }
  stand(at: [number, number], heading: number, pose: Partial<HumanoidPose>, ground = SIDEWALK_Y) {
    this.h.root.visible = true;
    this.h.root.position.set(at[0], 0, at[1]);
    this.h.root.rotation.set(0, heading, 0);
    applyGroundedPose(this.h, { ...POSE_STAND, ...pose }, ground);
  }
  /** Seated on a chair whose seat top is `seatY` (world), feet flat on `ground`. */
  sit(at: [number, number], heading: number, seatY: number, acting: Partial<HumanoidPose>, ground = SIDEWALK_Y) {
    this.h.root.visible = true;
    this.h.root.position.set(at[0], 0, at[1]);
    this.h.root.rotation.set(0, heading, 0);
    const base = seatedPose(this.h, seatY, ground);
    applyGroundedPose(this.h, { ...base, ...acting, hipsY: base.hipsY, legL: acting.legL ?? base.legL, legR: acting.legR ?? base.legR }, ground);
  }
}

export interface CarRig { g: THREE.Group; head: THREE.MeshBasicMaterial[]; tail: THREE.MeshBasicMaterial[] }
export function carRig(parent: THREE.Object3D, color: number): CarRig {
  const g = makeClassicCityCar(color), head: THREE.MeshBasicMaterial[] = [], tail: THREE.MeshBasicMaterial[] = [];
  g.traverse(o => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) {
      const c = o.material.color; (c.r > 2 ? head : c.g < .2 && c.r > 1 ? tail : []).push(o.material);
    }
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  parent.add(g);
  return { g, head, tail };
}
export function setCarLights(c: CarRig, head: number, tail: 'off' | 'run' | 'brake') {
  for (const m of c.head) m.color.setRGB(.1 + 2.3 * head, .1 + 2.4 * head, .1 + 2.3 * head);
  const k = tail === 'brake' ? [3.4, .16, .08] : tail === 'run' ? [.9, .05, .03] : [.12, .02, .02];
  for (const m of c.tail) m.color.setRGB(k[0], k[1], k[2]);
}
