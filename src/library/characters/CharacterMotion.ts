import * as THREE from 'three';
import { Humanoid, POSE_STAND, POSE_SIT, type HumanoidPose } from './Humanoid';

const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
// This solver deliberately covers short, level steps; larger strides need authored pelvis travel.
const MAX_LOCAL_STEP = .25;
const MAX_LOCAL_CLEARANCE = .20;
const SUPPORT_EPSILON = 1e-10;

function rigScale(person: Humanoid): number {
  const { x, y, z } = person.root.scale;
  if (![x, y, z].every(Number.isFinite) || x <= 0 || y <= 0 || z <= 0
    || Math.abs(x / y - 1) > 1e-8 || Math.abs(z / y - 1) > 1e-8) {
    throw new Error('CharacterMotion: finite positive uniform rig scale required');
  }
  return y;
}

export const actionProgress = (t: number, start: number, end: number) => {
  const u = clamp01((t - start) / Math.max(end - start, .001));
  return u * u * (3 - 2 * u);
};

const shoeMeshes = new WeakMap<THREE.Object3D, THREE.Mesh>();
function setAnkle(person: Humanoid, side: 'L' | 'R', pitch: number) {
  const foot = side === 'L' ? person.footL : person.footR;
  let shoe = shoeMeshes.get(foot);
  if (!shoe) {
    shoe = foot.parent!.children.find(child => child instanceof THREE.Mesh
      && child.geometry instanceof THREE.BoxGeometry
      && Math.abs(child.geometry.parameters.width - .095) < 1e-8
      && child.position.distanceTo(foot.position) < 1e-8) as THREE.Mesh | undefined;
    if (!shoe) throw new Error('CharacterMotion: unsupported Humanoid shoe geometry');
    shoeMeshes.set(foot, shoe);
  }
  // Opt-in ankle compensation on the existing mesh; leave Humanoid's legacy poses untouched.
  foot.position.set(0, -.41 - .06 * Math.sin(pitch), .06 * Math.cos(pitch));
  shoe.position.copy(foot.position);
  foot.rotation.x = pitch; shoe.rotation.x = pitch;
}

/** The existing rig's foot anchors are shoe centres, with these box half-extents. */
export function soleHeight(person: Humanoid, side: 'L' | 'R'): number {
  person.root.updateMatrixWorld(true);
  const foot = side === 'L' ? person.footL : person.footR;
  let low = Infinity;
  for (const x of [-.0475, .0475]) for (const y of [-.0325, .0325]) for (const z of [-.125, .125]) {
    low = Math.min(low, new THREE.Vector3(x, y, z).applyMatrix4(foot.matrixWorld).y);
  }
  return low;
}

/** Planted acting; stage owns X/Z and heading. Intended for unrotated room parents. */
export function applyGroundedPose(person: Humanoid, pose: HumanoidPose, groundY = 0): void {
  rigScale(person);
  if (!Number.isFinite(groundY)) throw new Error('CharacterMotion: finite ground height required');
  person.root.position.y = groundY;
  person.setPose(pose);
  setAnkle(person, 'L', 0); setAnkle(person, 'R', 0);
  person.root.position.y += groundY - Math.min(soleHeight(person, 'L'), soleHeight(person, 'R'));
  person.root.updateMatrixWorld(true);
}

/** Match pelvis underside to a chair and keep both shoes flat on the floor.
 * Apply with applyGroundedPose after adding acting poses, so prior ankle compensation resets.
 */
export function seatedPose(person: Humanoid, seatY: number, groundY = 0): HumanoidPose {
  const s = rigScale(person), seatHeight = (seatY - groundY) / s;
  if (!Number.isFinite(seatY) || !Number.isFinite(groundY)
    || seatHeight < -SUPPORT_EPSILON || seatHeight > .81 + SUPPORT_EPSILON) {
    throw new Error(`CharacterMotion: flat-foot seated support requires a finite seat 0 to ${.81 * s} m above the floor`);
  }
  const hipsY = THREE.MathUtils.clamp(seatHeight, 0, .81) + .1125;
  const flex = Math.acos(THREE.MathUtils.clamp((hipsY - .4725) / .45, -1, 1));
  return { ...POSE_SIT, hipsY, legL: [flex, flex], legR: [flex, flex] };
}

/** Sagittal two-bone solve to the ankle; the level shoe extends 60mm forward. */
function legAtSole(z: number, soleY: number, hipsY: number): [number, number] {
  if (Math.abs(z - .06) < 1e-9 && Math.abs(soleY) < 1e-9 && Math.abs(hipsY - .9225) < 1e-9) return [0, 0];
  const thigh = .45, shin = .41, down = hipsY - .03 - soleY - .0325, ankleZ = z - .06;
  const distance = Math.hypot(ankleZ, down);
  if (distance > thigh + shin + 1e-7 || distance < Math.abs(thigh - shin) + 1e-7) {
    throw new Error('CharacterMotion: unreachable sole target');
  }
  const cosine = (v: number) => Math.acos(THREE.MathUtils.clamp(v, -1, 1));
  const hip = Math.atan2(ankleZ, down) + cosine((thigh ** 2 + distance ** 2 - shin ** 2) / (2 * thigh * distance));
  const knee = cosine((distance ** 2 - thigh ** 2 - shin ** 2) / (2 * thigh * shin));
  return [hip, knee];
}

export interface StraightWalkOptions {
  origin: [number, number, number]; heading?: number; groundY?: number;
  start_s: number; end_s: number; distance_m: number; steps: number;
  settle_s?: number; clearance_m?: number; pose?: Partial<HumanoidPose>;
}

/** Opt-in absolute-time straight travel with fixed stance X/Z and one final settling step.
 * Uniform rig scale and unrotated stage parent are required. Existing gait callers are untouched.
 * Step length <= 0.25 m and clearance <= 0.20 m at the rig's 1.72 m reference height.
 * The whole supported envelope is checked before posing, including on pre-walk/direct seeks.
 */
export function applyStraightWalk(person: Humanoid, t: number, options: StraightWalkOptions) {
  const { origin, start_s, end_s, distance_m, steps } = options;
  const s = rigScale(person);
  const finite = [...origin, t, start_s, end_s, distance_m, steps, options.heading ?? 0, options.groundY ?? origin[1],
    options.settle_s ?? .45, options.clearance_m ?? .045].every(Number.isFinite);
  if (!finite || end_s <= start_s || distance_m <= 0 || !Number.isSafeInteger(steps) || steps <= 0
    || (options.settle_s ?? .45) <= 0 || (options.clearance_m ?? .045) < 0) {
    throw new Error('CharacterMotion: finite positive travel, duration, safe-integer steps and settling time required');
  }
  const step = distance_m / steps, clearance = (options.clearance_m ?? .045) / s;
  if (step / s > MAX_LOCAL_STEP + SUPPORT_EPSILON || clearance > MAX_LOCAL_CLEARANCE + SUPPORT_EPSILON || step <= 0) {
    throw new Error(`CharacterMotion: short-step walk requires step length <= ${MAX_LOCAL_STEP * s} m and clearance <= ${MAX_LOCAL_CLEARANCE * s} m for this rig`);
  }
  const heading = options.heading ?? 0, groundY = options.groundY ?? origin[1];
  const distance = distance_m * actionProgress(t, start_s, end_s);
  const n = Math.min(steps, Math.floor((distance + 1e-10) / step));
  const u = clamp01((distance - n * step) / step), swing = u * u * (3 - 2 * u);
  const settle = actionProgress(t, end_s, end_s + (options.settle_s ?? .45));
  let stance = n * step, moving = Math.max(0, n - 1) * step + (n + 1 - Math.max(0, n - 1)) * step * swing;
  let lift = clearance * Math.sin(Math.PI * u) ** 2;
  if (n === steps) {
    stance = distance_m; moving = distance_m - step * (1 - settle);
    lift = clearance * Math.sin(Math.PI * settle) ** 2;
  }
  const walking = actionProgress(distance, 0, Math.min(step, .12)) * (1 - settle);
  const hipsY = .9225 - .0425 * walking;
  const plantedLeg = legAtSole((stance - distance) / s + .06, 0, hipsY);
  const movingLeg = legAtSole((moving - distance) / s + .06, lift, hipsY);
  person.root.position.set(origin[0] + Math.sin(heading) * distance, groundY, origin[2] + Math.cos(heading) * distance);
  person.root.rotation.set(0, heading, 0);
  person.setPose({ ...POSE_STAND, ...options.pose, hipsY,
    legL: n % 2 === 0 ? plantedLeg : movingLeg, legR: n % 2 === 0 ? movingLeg : plantedLeg });
  const left = n % 2 === 0 ? plantedLeg : movingLeg, right = n % 2 === 0 ? movingLeg : plantedLeg;
  setAnkle(person, 'L', left[0] - left[1]); setAnkle(person, 'R', right[0] - right[1]);
  person.root.updateMatrixWorld(true);
  return { distance_m: distance, finished: t >= end_s + (options.settle_s ?? .45), stance: n % 2 === 0 ? 'L' : 'R' };
}
