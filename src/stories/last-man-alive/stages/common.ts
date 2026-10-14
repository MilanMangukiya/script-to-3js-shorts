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
  scene.add(new THREE.HemisphereLight(warm ? 0xd9e6e9 : 0x91b3df, warm ? 0x776656 : 0x354153, warm ? 1.1 : 1.4));
  const key = new THREE.DirectionalLight(warm ? 0xffd4ad : 0xffd3a5, warm ? 2 : 2.2);
  key.position.set(-8, 16, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -18, right: 18, top: 20, bottom: -20, near: .1, far: 80 });
  key.shadow.bias = -.0002; key.shadow.normalBias = .018; scene.add(key);
  const fill = new THREE.DirectionalLight(0x8abaff, .65); fill.position.set(10, 6, -8); scene.add(fill);
}
export function outdoor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, port = false) {
  const sky = new SkyDome({ zenithColor: 0x102848, horizonColor: port ? 0xc58b71 : 0x45617f,
    groundColor: 0x142536, hazeColor: 0x718597, hazeAmount: .2, sunIntensity: 0, sunGlow: .04 });
  scene.add(sky.mesh); scene.environment = sky.toEnvironment(renderer); scene.environmentIntensity = .6;
  scene.fog = new THREE.FogExp2(port ? 0x536b80 : 0x3a526a, port ? .0007 : .007);
  lightSet(scene); return sky;
}
export function person(parent: THREE.Object3D, at: [number, number, number], i: number, uniform = false, female = true) {
  const h = new Humanoid({ height: 1.62 + (i % 4) * .035, coat: 'jacket',
    coatColor: uniform ? [0x3e7c80, 0x668b8d, 0x405e7b][i % 3] : [0xa28567, 0x566c79, 0x7c5c6c][i % 3],
    trouserColor: 0x26384c, skinColor: [0xb17f60, 0x82523d, 0xd6ad8a][i % 3], scarfColor: null });
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
