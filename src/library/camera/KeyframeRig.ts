import * as THREE from 'three';
import { clamp, easeInOutCubic } from '../util/math';

export interface CameraKeyframe { t_s: number; position: number[]; look_at: number[]; ease: 'linear' | 'smoothstep' | 'ease_in_out_cubic' | 'hold' }
export interface CameraSpec { projection: 'perspective' | 'orthographic'; fov_or_scale: number; keyframes: CameraKeyframe[] }

const EASE: Record<string, (u: number) => number> = {
  linear: (u) => u,
  smoothstep: (u) => u * u * (3 - 2 * u),
  ease_in_out_cubic: easeInOutCubic,
  hold: () => 0,
};

const _p = new THREE.Vector3(), _l = new THREE.Vector3();

/**
 * Drive a perspective camera from storyboard keyframes at an absolute time. Time outside the keyframe span clamps,
 * so shots can be evaluated slightly early/late for dissolves. The segment uses the destination keyframe's easing.
 * Returns the interpolated look-at target (useful for focus-dependent effects).
 */
export function applyCameraSpec(camera: THREE.PerspectiveCamera, spec: CameraSpec, time_s: number, aspect: number): THREE.Vector3 {
  const k = spec.keyframes;
  let i = 0;
  while (i < k.length - 2 && time_s >= k[i + 1].t_s) i++;
  const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
  const span = Math.max(1e-6, b.t_s - a.t_s);
  const u = EASE[b.ease ?? 'smoothstep'](clamp((time_s - a.t_s) / span));
  _p.fromArray(a.position).lerp(new THREE.Vector3().fromArray(b.position), u);
  _l.fromArray(a.look_at).lerp(new THREE.Vector3().fromArray(b.look_at), u);
  camera.fov = spec.fov_or_scale;
  camera.aspect = aspect;
  camera.position.copy(_p);
  camera.up.set(0, 1, 0);
  camera.lookAt(_l);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return _l.clone();
}
