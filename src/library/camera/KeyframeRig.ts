import * as THREE from 'three';

/**
 * camera-keyframe-rig-v1 — Storyboard Keyframe Camera Rig with POV Sway & Impact Shake
 *
 * Evaluates storyboard camera keyframes deterministically at any absolute time `time_s`.
 * Upgraded to support:
 * - `handheld_sway` (0..1): Seeded, deterministic human eye-level breathing & walking motion.
 * - `impulse_shake` ({ at_s, duration_s, intensity }): Exponentially damped impact jolt.
 * - Full backward compatibility with all existing perspective and orthographic shots.
 */

export type CameraEase = 'linear' | 'smoothstep' | 'ease_in_out_cubic' | 'hold';

export interface CameraKeyframe {
  t_s: number;
  position: [number, number, number];
  look_at: [number, number, number];
  ease?: CameraEase;
}

export interface CameraImpulseShake {
  at_s: number;
  duration_s: number;
  intensity: number;
}

export interface CameraRigSpec {
  projection?: 'perspective' | 'orthographic';
  fov_or_scale?: number;
  keyframes: CameraKeyframe[];
  handheld_sway?: number;
  handheldSway?: number;
  impulse_shake?: CameraImpulseShake;
  impulseShake?: CameraImpulseShake;
  seed?: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function evaluateCameraEase(u: number, ease: CameraEase = 'smoothstep'): number {
  const t = clamp01(u);
  switch (ease) {
    case 'hold':
      return 0;
    case 'linear':
      return t;
    case 'ease_in_out_cubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'smoothstep':
    default:
      return t * t * (3 - 2 * t);
  }
}

/**
 * Deterministic multi-octave harmonic wave for organic camera motion.
 * Pure function of `time_s` and `seed` — zero frame-to-frame state accumulation.
 */
function harmonicWave(time_s: number, freqHz: number, phaseSeed: number): number {
  const w = time_s * freqHz * Math.PI * 2;
  return (
    0.6 * Math.sin(w + phaseSeed) +
    0.28 * Math.sin(w * 1.73 + phaseSeed * 2.17) +
    0.12 * Math.cos(w * 2.91 - phaseSeed * 1.31)
  );
}

/**
 * Evaluates interpolants, POV handheld breathing sway, and impact shake at `time_s`.
 */
export function evaluateCameraPose(
  spec: CameraRigSpec,
  time_s: number
): {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  rollRad: number;
  fovOrScale: number;
} {
  const kfs = spec.keyframes;
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();

  if (!kfs || kfs.length === 0) {
    pos.set(0, 1.65, 5);
    look.set(0, 1.5, 0);
    return { position: pos, lookAt: look, rollRad: 0, fovOrScale: spec.fov_or_scale ?? 38 };
  }

  if (kfs.length === 1 || time_s <= kfs[0].t_s) {
    pos.fromArray(kfs[0].position);
    look.fromArray(kfs[0].look_at);
  } else if (time_s >= kfs[kfs.length - 1].t_s) {
    const last = kfs[kfs.length - 1];
    pos.fromArray(last.position);
    look.fromArray(last.look_at);
  } else {
    let idx = 0;
    for (let i = 0; i < kfs.length - 1; i++) {
      if (time_s >= kfs[i].t_s && time_s <= kfs[i + 1].t_s) {
        idx = i;
        break;
      }
    }
    const a = kfs[idx];
    const b = kfs[idx + 1];
    const span = Math.max(1e-5, b.t_s - a.t_s);
    const rawU = (time_s - a.t_s) / span;
    const u = evaluateCameraEase(rawU, a.ease ?? 'smoothstep');

    pos.set(
      a.position[0] + (b.position[0] - a.position[0]) * u,
      a.position[1] + (b.position[1] - a.position[1]) * u,
      a.position[2] + (b.position[2] - a.position[2]) * u
    );
    look.set(
      a.look_at[0] + (b.look_at[0] - a.look_at[0]) * u,
      a.look_at[1] + (b.look_at[1] - a.look_at[1]) * u,
      a.look_at[2] + (b.look_at[2] - a.look_at[2]) * u
    );
  }

  const seed = spec.seed ?? Math.round((kfs[0]?.t_s ?? 0) * 137 + 41);
  let rollRad = 0;

  // 1. POV Handheld Breathing Sway
  // Auto-enable subtle 0.18 sway on ground-level perspective cameras (0.8m <= y <= 2.1m)
  // unless handheld_sway is explicitly set.
  const isEyeLevelPerspective =
    (spec.projection ?? 'perspective') === 'perspective' &&
    pos.y >= 0.8 &&
    pos.y <= 2.1 &&
    pos.distanceTo(look) > 2.5;

  const swayAmount =
    spec.handheld_sway ??
    spec.handheldSway ??
    (isEyeLevelPerspective ? 0.18 : 0.0);

  if (swayAmount > 0.001) {
    const breathY = harmonicWave(time_s, 0.72, seed) * 0.018 * swayAmount;
    const swayX = harmonicWave(time_s, 0.43, seed + 17) * 0.014 * swayAmount;
    const dist = Math.max(1.0, pos.distanceTo(look));
    const angularPan = Math.min(dist * 0.006, 0.12) * swayAmount;

    pos.x += swayX;
    pos.y += breathY;
    look.x += harmonicWave(time_s, 0.38, seed + 31) * angularPan;
    look.y += harmonicWave(time_s, 0.64, seed + 53) * angularPan * 0.8;
    rollRad += harmonicWave(time_s, 0.48, seed + 79) * 0.0045 * swayAmount;
  }

  // 2. Exponentially Damped Impact Camera Shake
  const shake = spec.impulse_shake ?? spec.impulseShake;
  if (shake && shake.intensity > 0 && time_s >= shake.at_s) {
    const dt = time_s - shake.at_s;
    if (dt >= 0 && dt <= shake.duration_s) {
      const normT = dt / Math.max(0.01, shake.duration_s);
      // Fast attack, exponential trauma decay
      const attack = Math.min(1.0, dt / 0.035);
      const envelope = attack * Math.exp(-4.2 * normT) * (1 - normT);
      const amp = shake.intensity * envelope;

      const dist = Math.max(1.0, pos.distanceTo(look));
      const posAmp = 0.045 * amp;
      const lookAmp = Math.min(dist * 0.018, 0.35) * amp;

      pos.x += harmonicWave(time_s, 14.5, seed + 101) * posAmp;
      pos.y += harmonicWave(time_s, 18.2, seed + 131) * posAmp * 1.25;
      pos.z += harmonicWave(time_s, 12.1, seed + 163) * posAmp * 0.6;

      look.x += harmonicWave(time_s, 16.0, seed + 197) * lookAmp;
      look.y += harmonicWave(time_s, 21.4, seed + 229) * lookAmp;
      rollRad += harmonicWave(time_s, 15.3, seed + 263) * 0.018 * amp;
    }
  }

  return {
    position: pos,
    lookAt: look,
    rollRad,
    fovOrScale: spec.fov_or_scale ?? 38,
  };
}

/**
 * Applies evaluated keyframe pose, FOV/orthographic scale, and roll to a Three.js camera.
 */
export function applyCameraKeyframes(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  spec: CameraRigSpec,
  time_s: number
): void {
  const pose = evaluateCameraPose(spec, time_s);

  camera.position.copy(pose.position);
  camera.up.set(0, 1, 0);

  if (Math.abs(pose.rollRad) > 1e-5) {
    const forward = pose.lookAt.clone().sub(pose.position).normalize();
    camera.up.applyAxisAngle(forward, pose.rollRad);
  }

  camera.lookAt(pose.lookAt);

  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const pCam = camera as THREE.PerspectiveCamera;
    if (spec.fov_or_scale && Math.abs(pCam.fov - pose.fovOrScale) > 1e-3) {
      pCam.fov = pose.fovOrScale;
      pCam.updateProjectionMatrix();
    }
  } else if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    const oCam = camera as THREE.OrthographicCamera;
    const halfH = pose.fovOrScale;
    const aspect = 1080 / 1920;
    const halfW = halfH * aspect;
    if (Math.abs(oCam.top - halfH) > 1e-3) {
      oCam.top = halfH;
      oCam.bottom = -halfH;
      oCam.left = -halfW;
      oCam.right = halfW;
      oCam.updateProjectionMatrix();
    }
  }
}

export class KeyframeRig {
  private spec: CameraRigSpec;

  constructor(spec: CameraRigSpec) {
    this.spec = spec;
  }

  public apply(
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    time_s: number
  ): void {
    applyCameraKeyframes(camera, this.spec, time_s);
  }

  public update(
    time_s: number,
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  ): void {
    applyCameraKeyframes(camera, this.spec, time_s);
  }
}

// ---- Backward compatibility: the earlier storyboard camera entry point used by FilmPipeline.
export interface CameraSpec {
  projection: 'perspective' | 'orthographic';
  fov_or_scale: number;
  keyframes: { t_s: number; position: number[]; look_at: number[]; ease?: CameraEase }[];
  handheld_sway?: number; handheldSway?: number;
  impulse_shake?: CameraImpulseShake; impulseShake?: CameraImpulseShake;
  seed?: number;
}
const _legacyPos = new THREE.Vector3(), _legacyLook = new THREE.Vector3(), _legacyB = new THREE.Vector3();
/**
 * Drive a perspective camera from storyboard keyframes at an absolute time and return the look-at target. Specs that
 * set handheld_sway or impulse_shake use evaluateCameraPose (sway, shake, roll); all others keep the earlier
 * interpolation exactly (clamped, destination keyframe's easing), so existing films render unchanged.
 */
export function applyCameraSpec(camera: THREE.PerspectiveCamera, spec: CameraSpec, time_s: number, aspect: number): THREE.Vector3 {
  const modern = spec.handheld_sway !== undefined || spec.handheldSway !== undefined || spec.impulse_shake !== undefined || spec.impulseShake !== undefined;
  camera.fov = spec.fov_or_scale;
  camera.aspect = aspect;
  camera.up.set(0, 1, 0);
  if (modern) {
    const pose = evaluateCameraPose(spec as unknown as CameraRigSpec, time_s);
    camera.position.copy(pose.position);
    if (Math.abs(pose.rollRad) > 1e-5) camera.up.applyAxisAngle(pose.lookAt.clone().sub(pose.position).normalize(), pose.rollRad);
    _legacyLook.copy(pose.lookAt);
  } else {
    const k = spec.keyframes;
    let i = 0;
    while (i < k.length - 2 && time_s >= k[i + 1].t_s) i++;
    const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
    const u = evaluateCameraEase((time_s - a.t_s) / Math.max(1e-6, b.t_s - a.t_s), b.ease ?? 'smoothstep');
    _legacyPos.fromArray(a.position).lerp(_legacyB.fromArray(b.position), u);
    _legacyLook.fromArray(a.look_at).lerp(_legacyB.fromArray(b.look_at), u);
    camera.position.copy(_legacyPos);
  }
  camera.lookAt(_legacyLook);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return _legacyLook.clone();
}
