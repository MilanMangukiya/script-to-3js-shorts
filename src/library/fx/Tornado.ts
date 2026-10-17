import * as THREE from 'three';
import { rng } from '../util/math';
import { GLSL_NOISE } from '../util/glsl';

/**
 * tornado-v1 — a rope-to-wedge tornado in metres: a lathed funnel whose shader scrolls rotating, upward-spiralling
 * condensation bands (soft edges, darker core, lit by the sun from `sunDirection`), a slow sinuous meander of the
 * whole column, an orbiting debris cloud (instanced chunks) and a dust skirt at the ground. `update(t)` only.
 */
const VS = /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vW; uniform float uTime, uMeander, uHeight;
  void main(){ vUv = uv; vec3 p = position; float h = clamp(p.y / uHeight, 0.0, 1.0);
    p.x += sin(uTime * 0.35 + h * 3.2) * uMeander * h * h; p.z += cos(uTime * 0.27 + h * 2.4) * uMeander * 0.6 * h * h;
    vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = /* glsl */ `uniform float uTime, uSpin, uDensity; uniform vec3 uSun, uColor, uShade; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  ${GLSL_NOISE}
  void main(){
    float h = vUv.y, a = vUv.x;
    vec2 q = vec2(a * 6.0 - uTime * uSpin * (1.6 - h) + h * 3.0, h * 9.0 - uTime * 0.8);
    float bands = fbm(q * vec2(1.0, 0.6)) * 0.7 + fbm(q * 3.0 + 7.0) * 0.3;
    vec3 V = normalize(cameraPosition - vW), N = normalize(vN);
    float facing = abs(dot(N, V)), edge = smoothstep(0.0, 0.45, facing);
    float dens = smoothstep(0.32, 0.75, bands) * edge * uDensity * (0.55 + 0.45 * smoothstep(0.0, 0.15, h)) * (1.0 - smoothstep(0.92, 1.0, h));
    float lit = 0.35 + 0.65 * max(dot(N, uSun), 0.0);
    vec3 col = mix(uShade, uColor, lit * (0.6 + 0.4 * bands));
    gl_FragColor = vec4(col, clamp(dens, 0.0, 1.0));
  }`;
export class Tornado {
  readonly group = new THREE.Group(); private u: Record<string, THREE.IUniform>; private debris: THREE.InstancedMesh; private items: { r: number; y: number; a: number; w: number; s: number; tumble: THREE.Vector3 }[] = [];
  private dust: THREE.Mesh; private H: number; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private sc = new THREE.Vector3();
  constructor(o: { height?: number; base?: number; top?: number; sunDirection?: THREE.Vector3; color?: THREE.ColorRepresentation; debris?: number; seed?: number } = {}) {
    const H = this.H = o.height ?? 600, rb = o.base ?? 25, rt = o.top ?? 180, r = rng(o.seed ?? 3);
    const prof = Array.from({ length: 40 }, (_, i) => { const u = i / 39; return new THREE.Vector2(rb + (rt - rb) * Math.pow(u, 2.4) + rb * 0.4 * Math.exp(-u * 30), u * H); });
    this.u = { uTime: { value: 0 }, uSpin: { value: 1.2 }, uDensity: { value: 1 }, uMeander: { value: rb * 2.5 }, uHeight: { value: H },
      uSun: { value: (o.sunDirection ?? new THREE.Vector3(0.4, 0.5, 0.6)).clone().normalize() }, uColor: { value: new THREE.Color(o.color ?? 0x9a958d) }, uShade: { value: new THREE.Color(0x3a3a3c) } };
    const funnel = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    funnel.frustumCulled = false; this.group.add(funnel);
    const inner = funnel.clone(); inner.scale.set(0.7, 1, 0.7); this.group.add(inner);
    const n = o.debris ?? 500;
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.3, 0.7), new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 }), n); this.debris.castShadow = true; this.debris.frustumCulled = false; this.group.add(this.debris);
    for (let i = 0; i < n; i++) this.items.push({ r: rb * (1.2 + r() * 2.5), y: Math.pow(r(), 2) * H * 0.35, a: r() * 6.28, w: 0.6 + r() * 0.8, s: 0.2 + Math.pow(r(), 3) * 2.5, tumble: new THREE.Vector3(r(), r(), r()).normalize() });
    const dustU = { ...this.u, uDensity: { value: 0.8 } };
    this.dust = new THREE.Mesh(new THREE.LatheGeometry(Array.from({ length: 16 }, (_, i) => { const u = i / 15; return new THREE.Vector2(rb * (1.2 + u * 3.5), Math.sin(u * Math.PI) * rb * 1.6); }), 48), new THREE.ShaderMaterial({ uniforms: dustU, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.dust.frustumCulled = false; this.group.add(this.dust);
    this.update(0);
  }
  /** Funnel density 0..1 (touchdown/rope-out) at absolute time t. */
  update(t: number, density = 1) {
    this.u.uTime.value = t; this.u.uDensity.value = density;
    this.items.forEach((it, i) => {
      const a = it.a + t * it.w * 1.4, rr = it.r * (0.8 + 0.2 * Math.sin(t * 0.7 + i));
      this.v.set(Math.cos(a) * rr, it.y + Math.sin(t * 0.9 + i) * 4, Math.sin(a) * rr);
      this.q.setFromAxisAngle(it.tumble, t * 3 + i); this.sc.setScalar(it.s * density);
      this.debris.setMatrixAt(i, this.m4.compose(this.v, this.q, this.sc));
    });
    this.debris.instanceMatrix.needsUpdate = true;
  }
}
