import * as THREE from 'three';
import { SkyDome } from '../../../library/environment/SkyDome';
import { Humanoid, POSE_STAND, type HumanoidPose } from '../../../library/characters/Humanoid';
import { surface, solid, box } from '../../../library/util/Modeling';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';

export abstract class SetStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 9 / 16, .015, 15000);
  abstract update(t: number, shot: ShotInfo): void;
}
export function lightSet(scene: THREE.Scene, warm = false) {
  scene.add(new THREE.HemisphereLight(warm ? 0xe3e9e5 : 0x9bbddf, warm ? 0x77645a : 0x394453, 1.3));
  const key = new THREE.DirectionalLight(warm ? 0xffd3af : 0xffdfb5, 2.1);
  key.position.set(-8, 16, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -18, right: 18, top: 20, bottom: -20, near: .1, far: 80 });
  key.shadow.bias = -.0002; key.shadow.normalBias = .018; scene.add(key);
  const fill = new THREE.DirectionalLight(0x9bc6ff, .6); fill.position.set(10, 6, -8); scene.add(fill);
}
export function outdoor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const sky = new SkyDome({ zenithColor: 0x172e4f, horizonColor: 0x68889b,
    groundColor: 0x1d2c39, hazeColor: 0x8b9caa, hazeAmount: .18, sunIntensity: 0, sunGlow: .05 });
  scene.add(sky.mesh); scene.environment = sky.toEnvironment(renderer); scene.environmentIntensity = .65;
  scene.fog = new THREE.FogExp2(0x4a6378, .006); lightSet(scene); return sky;
}
export function person(parent: THREE.Object3D, at: [number, number, number], i: number, uniform = false, female = false) {
  const h = new Humanoid({ height: 1.62 + (i % 4) * .035, coat: 'jacket',
    coatColor: uniform ? [0x3b7e83, 0x668c8b, 0x47637d][i % 3] : [0xac7d69, 0x536d7b, 0xa86b75][i % 3],
    trouserColor: 0x283a4a, skinColor: [0xb17f60, 0x82523d, 0xd6ad8a][i % 3], scarfColor: null });
  h.root.position.set(...at); parent.add(h.root);
  if (female) solid(h.head, new THREE.SphereGeometry(.058, 14, 10), surface(0x30251e), [0, .1, -.11]);
  if (uniform) box(h.root, [.065, .085, .012], surface(0xe2e6da), [.11, 1.22, .15]);
  return h;
}
export function movingPose(h: Humanoid, t: number, i: number, extra: Partial<HumanoidPose> = {}) {
  const phase = t * 3.8 + i * 1.7, s = Math.sin(phase) * .32;
  h.setPose({ ...POSE_STAND, legL: [s, .08 + Math.max(0, -s) * .6], legR: [-s, .08 + Math.max(0, s) * .6],
    armL: [-s * .45, .1, .22], armR: [s * .45, .1, .22], headYaw: Math.sin(t * .8 + i) * .15,
    breath: Math.sin(t * 1.5 + i) * .25, ...extra });
}
