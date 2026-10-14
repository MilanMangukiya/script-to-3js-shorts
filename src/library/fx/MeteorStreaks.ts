import * as THREE from 'three';
import { rng } from '../util/math';

/**
 * meteor-streaks-v1 — deterministic meteors burning up in the upper atmosphere: each one is a camera-facing ribbon
 * whose head (white-green, brightest) travels along a straight entry path while the trail behind it fades, leaving a
 * faint green ionisation train that lingers. Pure function of time: `update(time_s, camera)`.
 * Positions are in the stage's world units; `spawn` describes a box where heads start and the mean entry velocity.
 */
export interface MeteorSpawn {
  /** Absolute time each meteor appears (s) and how long its head is visible. */
  at_s: number; life_s?: number;
  /** Start point and velocity (world units, world units per second). */
  start: THREE.Vector3; velocity: THREE.Vector3;
  /** Trail length and ribbon half-width (world units) and brightness multiplier. */
  trail?: number; width?: number; brightness?: number;
}
export interface MeteorStreakOptions {
  /** Explicit meteors; or let the constructor scatter `count` of them inside `box` between `window`. */
  meteors?: MeteorSpawn[];
  count?: number; seed?: number; window?: [number, number];
  box?: { min: THREE.Vector3; max: THREE.Vector3 };
  velocity?: THREE.Vector3; speedJitter?: number;
  trail?: number; width?: number; life?: number;
}

export class MeteorStreaks {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  readonly meteors: MeteorSpawn[];

  constructor(o: MeteorStreakOptions = {}) {
    const r = rng(o.seed ?? 41);
    const list = o.meteors ?? Array.from({ length: o.count ?? 6 }, (_, i) => {
      const [t0, t1] = o.window ?? [0, 3], b = o.box ?? { min: new THREE.Vector3(-10, 0, -10), max: new THREE.Vector3(10, 10, 10) };
      const v = (o.velocity ?? new THREE.Vector3(30, -12, 5)).clone();
      v.applyAxisAngle(new THREE.Vector3(0, 1, 0), (r() - 0.5) * 0.9).multiplyScalar(1 + (r() - 0.5) * (o.speedJitter ?? 0.4));
      return {
        at_s: t0 + ((i + r() * 0.8) / (o.count ?? 6)) * (t1 - t0), life_s: (o.life ?? 0.55) * (0.7 + r() * 0.6),
        start: new THREE.Vector3(THREE.MathUtils.lerp(b.min.x, b.max.x, r()), THREE.MathUtils.lerp(b.min.y, b.max.y, r()), THREE.MathUtils.lerp(b.min.z, b.max.z, r())),
        velocity: v, trail: (o.trail ?? 8) * (0.7 + r() * 0.6), width: (o.width ?? 0.08) * (0.7 + r() * 0.6), brightness: 0.5 + Math.pow(r(), 2) * 1.5,
      } as MeteorSpawn;
    });
    this.meteors = list;
    const seg = 24, base = new THREE.PlaneGeometry(1, 1, seg, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.getAttribute('position')); geo.setAttribute('uv', base.getAttribute('uv'));
    const n = list.length, aStart = new Float32Array(n * 3), aVel = new Float32Array(n * 3), aInfo = new Float32Array(n * 4), aShape = new Float32Array(n * 3);
    list.forEach((m, i) => {
      aStart.set([m.start.x, m.start.y, m.start.z], i * 3); aVel.set([m.velocity.x, m.velocity.y, m.velocity.z], i * 3);
      aInfo.set([m.at_s, m.life_s ?? 0.55, m.brightness ?? 1, i], i * 4); aShape.set([m.trail ?? 8, m.width ?? 0.08, 0], i * 3);
    });
    geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(aStart, 3)); geo.setAttribute('aVel', new THREE.InstancedBufferAttribute(aVel, 3));
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(aInfo, 4)); geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(aShape, 3));
    geo.instanceCount = n;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uGain: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aStart, aVel, aShape; attribute vec4 aInfo;
        uniform float uT; uniform vec3 uCam;
        varying float vS, vSide, vHead, vTrain, vB;
        void main(){
          float age = uT - aInfo.x, life = aInfo.y;
          vec3 dir = normalize(aVel); float speed = length(aVel);
          float headAge = clamp(age, 0.0, life);
          vec3 head = aStart + aVel*headAge;
          // The glowing trail grows behind the head, then the train (whole path) lingers and fades.
          float len = min(aShape.x, speed*max(headAge, 0.0));
          float s = uv.x; vS = s;
          vec3 p = head - dir*len*(1.0 - s);
          vec3 side = normalize(cross(dir, normalize(p - uCam)));
          float w = aShape.y*mix(0.35, 1.0, s*s)*(1.0 + 1.6*pow(s, 10.0));
          vSide = uv.y*2.0 - 1.0;
          p += side*vSide*w*max(length(p - uCam)*0.0, 1.0);
          vHead = (age >= 0.0 && age <= life) ? smoothstep(0.0, 0.06, age)*(1.0 - smoothstep(life*0.7, life, age)) : 0.0;
          vTrain = age > 0.0 ? exp(-max(age - life*0.6, 0.0)/1.1)*smoothstep(0.0, 0.1, age) : 0.0;
          vB = aInfo.z;
          gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uGain; varying float vS, vSide, vHead, vTrain, vB;
        void main(){
          float core = exp(-vSide*vSide*6.0);
          vec3 hot = mix(vec3(1.0, 0.75, 0.45), vec3(0.85, 1.0, 0.9), smoothstep(0.6, 1.0, vS));
          float trail = pow(vS, 2.2)*vHead*2.2 + pow(vS, 18.0)*vHead*14.0;
          vec3 c = hot*trail + vec3(0.25, 1.0, 0.45)*vTrain*0.18*(0.4 + 0.6*vS);
          gl_FragColor = vec4(c*core*vB*uGain, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 10;
  }
  update(time_s: number, camera: THREE.Camera) { this.mat.uniforms.uT.value = time_s; this.mat.uniforms.uCam.value.copy(camera.position); }
  set gain(v: number) { this.mat.uniforms.uGain.value = v; }
}
