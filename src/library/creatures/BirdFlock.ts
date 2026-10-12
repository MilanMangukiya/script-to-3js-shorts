import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, clamp } from '../util/math';

export interface BirdFlockOptions {
  count?: number; seed?: number;
  /** Half-extents of the formation (along travel, vertical, lateral) in metres. */
  spread?: [number, number, number];
  /** Wingspan in metres (model is authored at about 1.36 m). */
  wingspan?: number;
  bodyColor?: THREE.ColorRepresentation; wingColor?: THREE.ColorRepresentation; tipColor?: THREE.ColorRepresentation;
  sunDirection?: THREE.Vector3; sunColor?: THREE.ColorRepresentation; ambient?: THREE.ColorRepresentation;
}
export interface BirdFlockState {
  /** Formation centre and unit travel direction. */
  center: THREE.Vector3; heading: THREE.Vector3;
  /** Extra downward displacement in metres (per-bird variation and delay are applied internally). */
  sink?: number;
  /** Wing-beat frequency multiplier (1 = relaxed gull). */
  flapRate?: number;
  /** Nose-down pitch in radians. */
  pitch?: number;
  /** 0 = flapping, 1 = wings held in a gliding pose (default 0, so existing shots are unchanged). */
  glide?: number;
}

/**
 * Instanced gull-like birds with two-segment flapping wings animated in the vertex shader.
 * `update(time_s, state)` is deterministic; sink and flap rate let a shot show birds struggling or soaring.
 */
export class BirdFlock {
  readonly mesh: THREE.InstancedMesh;
  private mat: THREE.ShaderMaterial;
  private offsets: Float32Array; private seeds: Float32Array;
  private dummy = new THREE.Object3D();
  private spread: [number, number, number]; private scale: number;

  constructor(o: BirdFlockOptions = {}) {
    const n = o.count ?? 9, r = rng(o.seed ?? 12);
    this.spread = o.spread ?? [9, 2.2, 6]; this.scale = (o.wingspan ?? 1.36) / 1.36;
    // Body along +X (forward).
    const body = new THREE.SphereGeometry(0.5, 12, 8); body.scale(0.62, 0.15, 0.16);
    const nb = body.attributes.position.count;
    body.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(nb * 2), 2)); // (side, span)
    const wing = (side: number) => {
      // stations: root, mid, tip; each with leading/trailing edge x.
      const st = [[0.13, -0.13, 0], [0.11, -0.1, 0.6], [0.0, -0.06, 1]];
      const pos: number[] = [], aw: number[] = [], nor: number[] = [], uv: number[] = [];
      const push = (s: number[], lead: boolean) => { pos.push(lead ? s[0] : s[1], 0.02, 0); aw.push(side, s[2]); nor.push(0, 1, 0); uv.push(0, 0); };
      for (let i = 0; i < 2; i++) { push(st[i], true); push(st[i], false); push(st[i + 1], true); push(st[i], false); push(st[i + 1], false); push(st[i + 1], true); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(aw, 2));
      return g;
    };
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.26, 0.01, 0, -0.5, 0.01, 0.1, -0.5, 0.01, -0.1], 3));
    tail.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    tail.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(6).fill(0), 2)); tail.setAttribute('aWing', new THREE.Float32BufferAttribute(new Array(6).fill(0), 2));
    const geo = mergeGeometries([body.toNonIndexed(), wing(1), wing(-1), tail])!;
    this.offsets = new Float32Array(n * 3); this.seeds = new Float32Array(n * 3);
    const aPhase = new Float32Array(n), aRate = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.offsets.set([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1], i * 3);
      this.seeds.set([r() * 6.283, 0.8 + r() * 0.4, r() * 0.5], i * 3); // bob phase, sink factor, sink delay
      aPhase[i] = r() * 6.283; aRate[i] = 0.9 + r() * 0.25;
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
    geo.setAttribute('aRate', new THREE.InstancedBufferAttribute(aRate, 1));
    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, fog: false,
      uniforms: {
        uPhase: { value: 0 }, uGlide: { value: 0 }, uBody: { value: new THREE.Color(o.bodyColor ?? 0xf2f2ee) }, uWing: { value: new THREE.Color(o.wingColor ?? 0xb9bfc6) }, uTip: { value: new THREE.Color(o.tipColor ?? 0x1c1d22) },
        uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(-0.5, 0.3, -0.8)).clone().normalize() }, uSunColor: { value: new THREE.Color(o.sunColor ?? 0xffd9a8) }, uAmbient: { value: new THREE.Color(o.ambient ?? 0x6f86a8) },
      },
      vertexShader: /* glsl */ `attribute vec2 aWing; attribute float aPhase, aRate; uniform float uPhase, uGlide; varying vec3 vN; varying vec3 vP; varying float vSpan; varying float vIsWing;
        void main(){ vec3 p = position; vec3 n = normal; vSpan = aWing.y; vIsWing = abs(aWing.x);
          if (aWing.x != 0.0) {
            float ph = uPhase*aRate + aPhase;
            float a1 = sin(ph)*0.6 + 0.1, a2 = a1 + sin(ph - 0.9)*0.55;
            float g1 = 0.12 + sin(ph*0.31)*0.03;                       // glide: slight dihedral, tips a little lower
            a1 = mix(a1, g1, uGlide); a2 = mix(a2, g1 - 0.16, uGlide);
            float inner = min(aWing.y, 0.6)/0.6, outer = max(aWing.y - 0.6, 0.0)/0.4;
            p.y += sin(a1)*0.36*inner + sin(a2)*0.27*outer;
            p.z = aWing.x * (0.06 + cos(a1)*0.36*inner + cos(a2)*0.27*outer);
            n = normalize(vec3(0.0, cos(a1), -aWing.x*sin(a1)));
          }
          mat4 m = modelMatrix*instanceMatrix; vN = normalize(mat3(m)*n); vec4 w = m*vec4(p,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uBody, uWing, uTip, uSunDir, uSunColor, uAmbient; varying vec3 vN; varying vec3 vP; varying float vSpan; varying float vIsWing;
        void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vP);
          vec3 base = mix(uBody, mix(uWing, uTip, smoothstep(0.72, 0.95, vSpan)), vIsWing);
          float d = dot(N, uSunDir); float diff = mix(abs(d)*0.7 + 0.15, max(d, 0.0), 1.0 - vIsWing);   // thin wings transmit some light
          float back = pow(max(dot(-V, uSunDir), 0.0), 4.0) * vIsWing * 0.6;
          vec3 col = base * (uAmbient*0.9 + uSunColor * (diff*1.5 + back));
          gl_FragColor = vec4(col, 1.0); }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, n);
    this.mesh.frustumCulled = false;
  }

  /**
   * @param flapPhase accumulated wing-beat phase in radians. Pass an analytic integral of the flap frequency so
   *                  rate changes stay smooth and deterministic (e.g. 2π·f·t for a constant rate).
   */
  update(time_s: number, s: BirdFlockState, flapPhase: number) {
    this.mat.uniforms.uPhase.value = flapPhase;
    this.mat.uniforms.uGlide.value = s.glide ?? 0;
    const d = this.dummy, h = s.heading, side = new THREE.Vector3(-h.z, 0, h.x).normalize();
    const yaw = Math.atan2(-h.z, h.x), sink = s.sink ?? 0;
    for (let i = 0; i < this.mesh.count; i++) {
      const a = this.offsets[i * 3] * this.spread[0], b = this.offsets[i * 3 + 1] * this.spread[1], c = this.offsets[i * 3 + 2] * this.spread[2];
      const bob = Math.sin(time_s * 1.1 + this.seeds[i * 3]) * 0.3;
      const k = this.seeds[i * 3 + 1];
      d.position.set(s.center.x + h.x * a + side.x * c, s.center.y + b + bob - sink * k, s.center.z + h.z * a + side.z * c);
      d.rotation.set(Math.sin(time_s * 0.8 + this.seeds[i * 3]) * 0.12, yaw, -(s.pitch ?? 0) * clamp(k));
      d.scale.setScalar(this.scale);
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
