import * as THREE from 'three';
import { makeClassicCityCar } from '../../../library/environment/CityStreetClassic';
import { POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { HumanV2, walkPose, idlePose, type HumanV2Options } from '../../../library/characters/HumanV2';
import { diversePerson, attachAccessories, type Accessory, type Vibe } from '../../../library/characters/CrowdKit';

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
  const pts = [t0, ...keys.map((k) => k[0]).filter((k) => k > Math.min(t0, t) && k < Math.max(t0, t)), t].sort((a, b) => a - b);
  let d = 0;
  for (let i = 0; i < pts.length - 1; i++) d += (speed(pts[i]) + speed(pts[i + 1])) * 0.5 * (pts[i + 1] - pts[i]);
  return t >= t0 ? d : -d;
}
export function gaitPose(phase: number, amount: number, run = 0): HumanoidPose {
  const s = Math.sin(phase) * amount;
  return { ...POSE_STAND, lean: .02 + run * .16, legL: [s, .06 + Math.max(0, -s) * (.65 + run * .6)], legR: [-s, .06 + Math.max(0, s) * (.65 + run * .6)],
    armL: [-s * (.5 + run * .5), .08, .16 + run * .9], armR: [s * (.5 + run * .5), .08, .16 + run * .9], breath: Math.sin(phase * .5) * .12 };
}

export interface WalkPlan { start: [number, number]; heading: number; t0: number; speed: [number, number][]; ground?: number; step?: number; run?: number }
/** Casting for a townsperson (crowd-kit-v1): a seed and vibe, optional accessories and any HumanV2 overrides. */
export interface PersonStyle { seed: number; vibe?: Vibe; accessories?: Accessory[]; extra?: Partial<HumanV2Options> }

/** A sculpted HumanV2 townsperson whose full pose is set from absolute time on every call (walking, running or standing). */
export class Person {
  readonly h: HumanV2; readonly screen?: THREE.MeshStandardMaterial;
  private restSole = 0; private seed: number; private fl = new THREE.Vector3(); private fr = new THREE.Vector3();
  constructor(parent: THREE.Object3D, o: PersonStyle) {
    const cast = diversePerson(o.seed, { vibe: o.vibe ?? 'everyday', childShare: 0, elderShare: 0.15 }, o.extra);
    this.seed = o.seed;
    this.h = new HumanV2(cast);
    this.screen = attachAccessories(this.h, o.accessories ?? cast.accessories.filter((a) => a !== 'phone' && a !== 'umbrella'), o.seed).screen;
    parent.add(this.h.root);
    this.h.root.visible = false;
    this.h.root.traverse((m) => { if (m instanceof THREE.Mesh) { m.castShadow = true; m.receiveShadow = true; m.userData.noSnow = true; } });
    this.h.root.position.set(0, 0, 0); this.h.setPose(POSE_STAND); this.restSole = this.sole();
  }
  /** Lowest shoe sole (world y) for the current pose. */
  private sole() { this.h.footL.getWorldPosition(this.fl); this.h.footR.getWorldPosition(this.fr); return Math.min(this.fl.y, this.fr.y); }
  /** Pose, then lift or lower the root so the lower sole rests on the ground as it does when standing. */
  private ground(pose: HumanoidPose, groundY: number) {
    this.h.root.position.y = groundY; this.h.setPose(pose);
    this.h.root.position.y += groundY + this.restSole - this.sole(); this.h.root.updateMatrixWorld(true);
  }
  walk(t: number, p: WalkPlan, act?: { pose: Partial<HumanoidPose>; w: number }) {
    const d = distanceAt(t, p.t0, p.speed), v = Math.abs(distanceAt(t + .02, p.t0, p.speed) - distanceAt(t - .02, p.t0, p.speed)) / .04;
    const run = p.run ?? 0, step = (p.step ?? (.69 + run * .5)) * this.h.root.scale.y;
    const amt = Math.min(1, v / .9);
    const gait = run > 0 ? gaitPose(Math.PI * d / step, (.4 + run * .25) * amt, run * Math.min(1, v / 2)) : walkPose(Math.PI * d / step, amt);
    const pose = act && act.w > 0 ? lerpPose(gait, { ...gait, ...act.pose }, act.w) : gait;
    this.h.root.visible = true;
    this.h.root.position.set(p.start[0] + Math.sin(p.heading) * d, 0, p.start[1] + Math.cos(p.heading) * d);
    this.h.root.rotation.set(0, p.heading, 0);
    this.ground(pose, p.ground ?? 0);
  }
  /** Stand in place with breathing, weight shift and glances layered under the acting pose (never a frozen mannequin). */
  stand(at: [number, number], heading: number, pose: Partial<HumanoidPose> | ((base: HumanoidPose) => HumanoidPose), ground = 0, t = 0) {
    this.h.root.visible = true;
    this.h.root.position.set(at[0], 0, at[1]);
    this.h.root.rotation.set(0, heading, 0);
    const idle = idlePose(t, this.seed % 97);
    this.ground(typeof pose === 'function' ? pose(idle) : { ...idle, ...pose }, ground);
  }
  /** Phone screen glow (0 = dark). */
  set screenGlow(v: number) { if (this.screen) this.screen.emissiveIntensity = v; }
  hide() { this.h.root.visible = false; }
}

export interface CarRig { g: THREE.Group; body: THREE.Group; head: THREE.MeshBasicMaterial[]; tail: THREE.MeshBasicMaterial[] }
export function carRig(parent: THREE.Object3D, color: number): CarRig {
  const g = new THREE.Group(), body = makeClassicCityCar(color), head: THREE.MeshBasicMaterial[] = [], tail: THREE.MeshBasicMaterial[] = [];
  body.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) { const c = o.material.color; (c.r > 2 ? head : c.g < .2 && c.r > 1 ? tail : []).push(o.material); }
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  g.add(body); parent.add(g);
  return { g, body, head, tail };
}
export function setCarLights(c: CarRig, head: number, tail: number) {
  for (const m of c.head) m.color.setRGB(.08 + 2.3 * head, .08 + 2.4 * head, .08 + 2.3 * head);
  for (const m of c.tail) m.color.setRGB(.12 + .8 * tail, .02 + .03 * tail, .02 + .02 * tail);
}
