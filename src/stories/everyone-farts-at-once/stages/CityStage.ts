import * as THREE from 'three';
import { CityStreetClassic } from '../../../library/environment/CityStreetClassic';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { AshPuffs } from '../../../library/fx/AshCloud';
import { GLSL_NOISE } from '../../../library/util/glsl';
import { POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { applyGroundedPose } from '../../../library/characters/CharacterMotion';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt } from '../timeline';
import { Person, gaitPose, SIDEWALK_Y } from './common';

// A sunny city street along Z, 1 unit = 1 m. S04: a passer-by walks toward the lens along the left sidewalk and the
// faint haze around them thins out within a few steps. S05: everyone's gas, pooled into one bubble (~500,000 m³,
// 98 m across), hangs over the rooftops.
const SUN = new THREE.Vector3(0.45, 0.78, 0.43).normalize();
export const BUBBLE = { center: new THREE.Vector3(-4, 74, -175), radius: 49 };
const START = new THREE.Vector2(-9.5, -8.0), STOP = new THREE.Vector2(-9.0, 3.4), WALK_V = 1.3;

export class CityStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 6000);
  private city = new CityStreetClassic({ seed: 2603, blocks: 7, storeysMin: 5, storeysMax: 8, wetness: 0, farFieldRadius: 900, vehicles: true });
  private rig: SunSkylightRig;
  private you: Person; private passers: Person[] = [];
  private puff: AshPuffs; private puffSeeds: { x: number; y: number; z: number; s: number }[] = [];
  private bubble: THREE.Mesh; private bubbleMat: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3d7ad0, horizonColor: 0xaecbea, hazeColor: 0xd5e3f1, groundColor: 0x8d867c,
      hazeAmount: 0.28, sunGlow: 0.35, discRadiance: 14, glareStrength: 1.0, shadowMapSize: 4096, discDistance: 5000 });
    this.scene.add(this.city.group);
    this.you = new Person(this.scene, { height: 1.74, coat: 0x7d3c98, trousers: 0x2c3e50, skin: 0xc68642, hair: 0x3b2a1e });
    for (const [c, s] of [[0x2e4053, 0xe0ac69], [0x922b21, 0x8d5524]] as const) this.passers.push(new Person(this.scene, { height: 1.72, coat: c, trousers: 0x1f2937, skin: s }));
    this.puff = new AshPuffs(30, { ashColor: 0xbfc76a, ambient: 0xffffff, sunColor: 0xffffff, hazeColor: 0xffffff, hazeDensity: 0 });
    this.puff.setLook({ light: 0.3 }); this.puff.mesh.renderOrder = 20; this.scene.add(this.puff.mesh);
    const r = rng(5); for (let i = 0; i < 30; i++) this.puffSeeds.push({ x: (r() - 0.5) * 0.7, y: 0.4 + r() * 1.3, z: (r() - 0.5) * 0.6, s: r() });
    // The bubble: a thin tinted skin with slow swirls inside (diegetic stand-in for an invisible gas).
    this.bubbleMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uSun: { value: SUN } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vW; varying vec3 vL; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform float uTime, uAmt; uniform vec3 uSun; varying vec3 vN; varying vec3 vW; varying vec3 vL;
        ${GLSL_NOISE}
        void main(){
          vec3 V = normalize(cameraPosition - vW); float f = 1.0 - abs(dot(normalize(vN), V));
          float sw = fbm3(normalize(vL) * 2.2 + vec3(uTime * 0.05, 0.0, uTime * 0.03));
          float lit = 0.6 + 0.4 * max(dot(normalize(vN), uSun), 0.0);
          vec3 col = mix(vec3(0.5, 0.68, 0.16), vec3(0.78, 0.88, 0.42), sw) * lit;
          float a = uAmt * (0.2 + 0.6 * pow(f, 2.0) + 0.18 * sw);
          gl_FragColor = vec4(col, a); }`,
    });
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.bubbleMat); this.bubble.renderOrder = 15; this.scene.add(this.bubble);
  }

  update(t: number, shot: ShotInfo) {
    const s05 = shot.sceneId === 'S05', cam = this.camera.getWorldPosition(new THREE.Vector3());
    this.rig.apply(this.scene, this.camera, { sunDirection: SUN, sunIntensity: 7.5, sunColor: 0xfff3e2, skyAmount: 1, groundAmount: 1, envIntensity: 1, hazeDensity: 0.0006,
      focus: s05 ? new THREE.Vector3(0, 10, -40) : new THREE.Vector3(-9, 1, 2), shadowHalfWidth: s05 ? 120 : 30, shadowHalfHeight: s05 ? 120 : 30, shadowDepth: 400 });
    this.city.update(t, { lights: 0, wetness: 0 });
    // ---- S05: the bubble inflates as everyone's gas is added up, then holds with a slow wobble.
    const grow = s05 ? windowAt(t, T.inflate0, T.inflate1) : 0;
    this.bubble.visible = grow > 0.001;
    const R = BUBBLE.radius * Math.cbrt(Math.max(1e-4, grow)) * (1 + 0.012 * Math.sin(t * 1.3));
    this.bubble.position.copy(BUBBLE.center); this.bubble.scale.setScalar(R);
    this.bubbleMat.uniforms.uTime.value = t; this.bubbleMat.uniforms.uAmt.value = Math.min(1, grow * 3);
    // ---- S04: a passer-by walks toward the lens and stops for a breath; others go about their day.
    this.you.h.root.visible = false; for (const p of this.passers) p.h.root.visible = false;
    if (!s05) {
      const t0 = T.bounds[3], walkEnd = T.dilute[1] - 0.2, L = START.distanceTo(STOP);
      const dist = Math.max(0, Math.min(L, L - WALK_V * (walkEnd - t))), pos = START.clone().lerp(STOP, dist / L);
      const heading = Math.atan2(STOP.x - START.x, STOP.y - START.y);
      const breathe = windowAt(t, walkEnd + 0.3, walkEnd + 1.2) * (1 - windowAt(t, walkEnd + 2.4, walkEnd + 3.2));
      let pose: HumanoidPose = t < walkEnd ? gaitPose(Math.PI * dist / 0.7, 0.42 * (1 - windowAt(t, walkEnd - 0.5, walkEnd))) : { ...POSE_STAND };
      pose = lerpPose(pose, { ...pose, breath: 1.0, headPitch: -0.3, shrug: 0.35, armL: [0.1, 0.45, 0.3], armR: [0.1, 0.45, 0.3] }, breathe);
      this.you.h.root.visible = true; this.you.h.root.position.set(pos.x, 0, pos.y); this.you.h.root.rotation.set(0, heading + 0.4 * breathe, 0);
      applyGroundedPose(this.you.h, pose, SIDEWALK_Y);
      for (const [k, p] of this.passers.entries()) p.walk(t, { start: [k ? -8.2 : 9.0, k ? -24 : 18], heading: k ? 0 : Math.PI, t0: t0 - 2, speed: [[0, 1.3]] });
      // The haze around you drifts downwind and thins to nothing within a few steps.
      const age = t - t0, thin = Math.max(0, 1 - age / 2.6);
      const puffs = this.puffSeeds.map((q, i) => {
        const spread = 1 + age * 1.6, drift = age * 0.9;
        return { x: pos.x + q.x * spread + drift * 0.8, y: q.y + age * 0.15, z: pos.y + q.z * spread + drift * 0.3, size: (0.35 + 0.4 * q.s) * spread, alpha: 0.3 * thin * thin * (0.6 + 0.4 * Math.sin(i + t)), glow: 0, seed: q.s };
      });
      this.puff.set(puffs, this.camera);
    } else this.puff.set([], this.camera);
    void cam;
  }
}
