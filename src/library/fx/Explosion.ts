import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { clamp } from '../util/math';

/**
 * explosion-v1 — a deterministic blast in metres, keyed to `start_s`: an incandescent fireball (noise-displaced
 * sphere whose emission cools from white-yellow to dull red and then to dark smoke as it rises), a fast spherical
 * condensation shock shell, a ground-hugging dust ring racing outward, and a `flash` level for scene lighting.
 * Radii follow a Sedov-like r ∝ t^0.4 law up to `radius`. `update(t)` sets everything from absolute time.
 */
const BALL_VS = /* glsl */ `uniform float uTime, uAge; varying vec3 vN; varying vec3 vP; varying float vNoise;
  ${GLSL_NOISE}
  void main(){ vec3 d = normalize(position); float n = fbm3(d * 2.4 + vec3(0.0, -uAge * 0.6, uTime * 0.05)) ; vNoise = n;
    vec3 p = position * (0.82 + 0.4 * n); vec4 w = modelMatrix * vec4(p, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * d); gl_Position = projectionMatrix * viewMatrix * w; }`;
const BALL_FS = /* glsl */ `uniform float uHeat, uSmoke, uAge; varying vec3 vN; varying vec3 vP; varying float vNoise;
  ${GLSL_NOISE}
  void main(){
    vec3 V = normalize(cameraPosition - vP); float rim = 1.0 - abs(dot(normalize(vN), V));
    float t = clamp(uHeat * (0.6 + 0.8 * vNoise) - rim * 0.25, 0.0, 1.0);
    vec3 fire = mix(vec3(0.35, 0.04, 0.0), vec3(1.0, 0.45, 0.08), smoothstep(0.1, 0.5, t)); fire = mix(fire, vec3(1.0, 0.92, 0.7), smoothstep(0.55, 0.95, t));
    vec3 smoke = vec3(0.13, 0.12, 0.11) * (0.6 + 0.6 * vNoise);
    vec3 col = mix(fire * (1.0 + 7.0 * t * t), smoke, uSmoke * (1.0 - t * 0.7));
    gl_FragColor = vec4(col, 1.0);
  }`;
const RING_FS = /* glsl */ `uniform float uLevel; uniform vec3 uColor; varying vec2 vUv; void main(){ float x = abs(vUv.y - 0.5) * 2.0; gl_FragColor = vec4(uColor, exp(-x * x * 6.0) * uLevel * 0.85); }`;
const RING_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export class Explosion {
  readonly group = new THREE.Group(); flash = 0;
  private ball: THREE.Mesh; private shell: THREE.Mesh; private dust: THREE.Mesh; private uB: Record<string, THREE.IUniform>; private uS: Record<string, THREE.IUniform>; private uD: Record<string, THREE.IUniform>;
  constructor(private o: { start_s: number; radius?: number; duration?: number; shock?: boolean } ) {
    this.uB = { uTime: { value: 0 }, uAge: { value: 0 }, uHeat: { value: 1 }, uSmoke: { value: 0 } };
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 6), new THREE.ShaderMaterial({ uniforms: this.uB, vertexShader: BALL_VS, fragmentShader: BALL_FS }));
    this.ball.castShadow = false; this.group.add(this.ball);
    this.uS = { uLevel: { value: 0 }, uColor: { value: new THREE.Color(0xdfe8f2) } };
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ uniforms: this.uS, vertexShader: RING_VS, fragmentShader: /* glsl */ `uniform float uLevel; uniform vec3 uColor; varying vec2 vUv; void main(){ gl_FragColor = vec4(uColor * uLevel * 0.25, 1.0); }`, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.group.add(this.shell);
    this.uD = { uLevel: { value: 0 }, uColor: { value: new THREE.Color(0x9c8a72) } };
    this.dust = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 12, 96).rotateX(Math.PI / 2), new THREE.ShaderMaterial({ uniforms: this.uD, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, blending: THREE.NormalBlending }));
    this.group.add(this.dust);
    this.update(0);
  }
  update(t: number) {
    const age = t - this.o.start_s, R = this.o.radius ?? 40, D = this.o.duration ?? 8;
    const vis = age >= 0; this.ball.visible = this.shell.visible = this.dust.visible = vis;
    if (!vis) { this.flash = 0; return; }
    const grow = Math.min(1, Math.pow(age / (D * 0.25), 0.4));
    const r = R * grow * (0.15 + 0.85 * grow);
    this.ball.scale.setScalar(Math.max(0.01, r)); this.ball.position.y = r * 0.6 + Math.max(0, age - D * 0.2) * R * 0.08;   // the hot ball rises
    this.uB.uTime.value = t; this.uB.uAge.value = age; this.uB.uHeat.value = clamp(1 - age / (D * 0.55)); this.uB.uSmoke.value = clamp((age - D * 0.15) / (D * 0.5));
    const shockR = R * 3.2 * Math.pow(Math.min(age, D) / D, 0.45); this.shell.scale.setScalar(Math.max(0.01, shockR)); this.uS.uLevel.value = (this.o.shock ?? true) ? clamp(1 - age / (D * 0.35)) : 0;
    const ringR = R * 2.5 * Math.pow(Math.min(age, D) / D, 0.55); this.dust.scale.set(Math.max(0.01, ringR), ringR * 0.25 + 2, Math.max(0.01, ringR)); this.uD.uLevel.value = clamp(age / 0.6) * clamp(1 - age / D);
    this.flash = age < 0 ? 0 : Math.exp(-age * 3.2) * 1.5;
  }
}
