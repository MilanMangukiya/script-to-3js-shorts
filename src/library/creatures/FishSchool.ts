import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../util/math';

export interface FishSchoolOptions {
  count?: number; seed?: number;
  /** Body length in metres. */
  length?: number;
  /** School half-extents (along travel, vertical, lateral) in metres. */
  spread?: [number, number, number];
  /** Cruise speed in metres per second. */
  speed?: number;
  color?: THREE.ColorRepresentation; backColor?: THREE.ColorRepresentation;
  fogColor?: THREE.ColorRepresentation; fogDensity?: number;
  lightDirection?: THREE.Vector3;
}

/**
 * Instanced fish school. Each fish follows the moving school centre with its own seeded offset and slow wander;
 * tails beat in the vertex shader. `update(time_s, center, heading)` is a pure function of its arguments.
 */
export class FishSchool {
  readonly mesh: THREE.InstancedMesh;
  private mat: THREE.ShaderMaterial;
  private offsets: Float32Array; private phases: Float32Array;
  private dummy = new THREE.Object3D();
  private spread: [number, number, number];

  constructor(o: FishSchoolOptions = {}) {
    const n = o.count ?? 140, r = rng(o.seed ?? 3), L = o.length ?? 0.18;
    this.spread = o.spread ?? [3.4, 1.1, 1.7];
    const body = new THREE.SphereGeometry(0.5, 14, 10); body.scale(1, 0.3, 0.13);
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.42, 0, 0, -0.74, 0.2, 0, -0.66, 0, 0, -0.42, 0, 0, -0.66, 0, 0, -0.74, -0.2, 0]), 3));
    tail.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    tail.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2));
    const fin = new THREE.BufferGeometry();
    fin.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.12, 0.13, 0, -0.18, 0.13, 0, -0.1, 0.25, 0]), 3));
    fin.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    fin.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
    const geo = mergeGeometries([body.toNonIndexed(), tail, fin])!;
    this.offsets = new Float32Array(n * 3); this.phases = new Float32Array(n * 4);
    const aPhase = new Float32Array(n), aTint = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Ellipsoidal distribution, denser toward the middle.
      const u = r() * 2 - 1, a = r() * 6.283, rad = Math.pow(r(), 0.6), s = Math.sqrt(1 - u * u);
      this.offsets.set([s * Math.cos(a) * rad, u * rad, s * Math.sin(a) * rad], i * 3);
      this.phases.set([r() * 6.283, r() * 6.283, r() * 6.283, 0.8 + r() * 0.45], i * 4);
      aPhase[i] = r() * 6.283; aTint[i] = r();
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 1));
    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, fog: false,
      uniforms: {
        uTime: { value: 0 }, uSwim: { value: 11 }, uColor: { value: new THREE.Color(o.color ?? 0xc9d6dc) }, uBack: { value: new THREE.Color(o.backColor ?? 0x25404f) },
        uFogColor: { value: new THREE.Color(o.fogColor ?? 0x124a5a) }, uFogDensity: { value: o.fogDensity ?? 0.055 },
        uLight: { value: (o.lightDirection ?? new THREE.Vector3(-0.3, 1, -0.2)).clone().normalize() },
      },
      vertexShader: /* glsl */ `attribute float aPhase, aTint; uniform float uTime, uSwim; varying vec3 vN; varying vec3 vP; varying float vTint; varying float vLy;
        void main(){ vec3 p = position; float tail = smoothstep(0.25, -0.7, p.x);
          p.z += sin(p.x*6.0 + uTime*uSwim + aPhase) * 0.11 * tail;
          vLy = normal.y; vTint = aTint;
          mat4 m = modelMatrix*instanceMatrix; vN = normalize(mat3(m)*normal); vec4 w = m*vec4(p,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor, uBack, uFogColor, uLight; uniform float uFogDensity; varying vec3 vN; varying vec3 vP; varying float vTint; varying float vLy;
        void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vP); if (dot(N, V) < 0.0) N = -N;
          float dist = length(cameraPosition - vP);
          vec3 base = mix(uColor, uBack, smoothstep(-0.1, 0.75, vLy)) * (0.85 + 0.3*vTint);
          float diff = 0.35 + 0.65*max(dot(N, uLight), 0.0);
          float flash = pow(max(dot(N, normalize(V + uLight)), 0.0), 22.0);
          vec3 col = base * diff * vec3(0.75, 1.0, 1.0) + vec3(0.8, 1.0, 0.98) * flash * 1.1;
          float f = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist);
          gl_FragColor = vec4(mix(col, uFogColor, clamp(f, 0.0, 1.0)), 1.0); }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.userData.length = L;
  }

  /** Change the school's half-extents (along travel, vertical, lateral) at any time, e.g. to crowd or relax it. */
  setSpread(spread: [number, number, number]) { this.spread = spread; }

  /**
   * @param center school centre at this time (world/local coordinates of the parent)
   * @param heading unit travel direction
   */
  update(time_s: number, center: THREE.Vector3, heading: THREE.Vector3) {
    this.mat.uniforms.uTime.value = time_s;
    const L = this.mesh.userData.length as number, d = this.dummy, n = this.mesh.count;
    const side = new THREE.Vector3(-heading.z, 0, heading.x).normalize();
    const yaw = Math.atan2(-heading.z, heading.x);
    for (let i = 0; i < n; i++) {
      const ox = this.offsets[i * 3], oy = this.offsets[i * 3 + 1], oz = this.offsets[i * 3 + 2];
      const p1 = this.phases[i * 4], p2 = this.phases[i * 4 + 1], p3 = this.phases[i * 4 + 2], sc = this.phases[i * 4 + 3];
      const wx = Math.sin(time_s * 0.7 + p1) * 0.3, wy = Math.sin(time_s * 0.9 + p2) * 0.14, wz = Math.sin(time_s * 0.6 + p3) * 0.3;
      const a = ox * this.spread[0] + wx, b = oy * this.spread[1] + wy, c = oz * this.spread[2] + wz;
      d.position.set(center.x + heading.x * a + side.x * c, center.y + b + heading.y * a, center.z + heading.z * a + side.z * c);
      d.rotation.set(0, yaw + Math.cos(time_s * 0.6 + p3) * 0.12, Math.sin(time_s * 0.9 + p2) * 0.08 + Math.asin(Math.max(-1, Math.min(1, heading.y))));
      d.scale.setScalar(L * sc);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
