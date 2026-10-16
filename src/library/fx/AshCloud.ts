import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { rng } from '../util/math';

/**
 * Sunlit volcanic ash: instanced camera-facing puffs whose centres, sizes and opacity are evaluated on the CPU from
 * absolute time, sorted back-to-front each update and shaded as soft lit spheres (wrap diffuse from the real sun
 * direction, sky ambient, incandescent glow near the vent or flow base, distance haze). Two drivers share it:
 *  - EruptionColumn: a Plinian column rising from a vent to its neutral-buoyancy height and spreading into an
 *    umbrella cloud whose radius is set per frame.
 *  - PyroclasticFlow: a ground-hugging avalanche of hot ash and gas whose front advances along a path laid on the
 *    terrain, billowing and lifting off behind the front.
 * Deterministic: every state is a pure function of `time_s` and the seeded layout.
 */
export interface AshLook {
  ashColor?: THREE.ColorRepresentation; ambient?: THREE.ColorRepresentation; sunColor?: THREE.ColorRepresentation;
  glowColor?: THREE.ColorRepresentation; hazeColor?: THREE.ColorRepresentation; hazeDensity?: number;
}

export class AshPuffs {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  private center: THREE.InstancedBufferAttribute; private param: THREE.InstancedBufferAttribute;
  private order: number[] = [];
  private dist: Float32Array;

  constructor(readonly capacity: number, look: AshLook = {}) {
    const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
    this.center = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3); this.center.setUsage(THREE.DynamicDrawUsage);
    this.param = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.param.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aCenter', this.center); g.setAttribute('aParam', this.param); g.instanceCount = 0;
    this.dist = new Float32Array(capacity);
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() }, uSunCol: { value: new THREE.Color(look.sunColor ?? 0xfff1dc) },
      uAmb: { value: new THREE.Color(look.ambient ?? 0x7d8794) }, uAsh: { value: new THREE.Color(look.ashColor ?? 0x6b625a) },
      uGlowCol: { value: new THREE.Color(look.glowColor ?? 0xff6a1f) }, uHaze: { value: new THREE.Color(look.hazeColor ?? 0xb9c4cf) },
      uHazeD: { value: look.hazeDensity ?? 0.00005 }, uLight: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.uniforms,
      vertexShader: /* glsl */ `attribute vec3 aCenter; attribute vec4 aParam; varying vec2 vUv; varying vec4 vP; varying float vDist;
        void main(){ vUv = uv; vP = aParam;
          vec4 mv = viewMatrix * vec4(aCenter, 1.0); vDist = -mv.z;
          mv.xy += position.xy * aParam.x;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform vec3 uSun, uSunCol, uAmb, uAsh, uGlowCol, uHaze; uniform float uHazeD, uLight;
        varying vec2 vUv; varying vec4 vP; varying float vDist;
        ${GLSL_NOISE}
        void main(){
          vec2 q = vUv * 2.0 - 1.0; float seed = vP.w;
          float n = fbm(vUv * 2.6 + seed * 13.7), n2 = fbm(vUv * 6.0 - seed * 5.1);
          float d = length(q) + (n - 0.5) * 0.62 + (n2 - 0.5) * 0.18;
          float a = smoothstep(1.0, 0.45, d) * vP.y; if (a < 0.004) discard;
          // Soft sphere normal in view space, bumped by the noise so billows catch light unevenly.
          vec3 N = normalize(vec3(q * 0.95 + (vec2(n, n2) - 0.5) * 0.7, sqrt(max(0.0, 1.0 - dot(q, q) * 0.8)) + 0.2));
          vec3 L = normalize(mat3(viewMatrix) * uSun);
          float wrap = clamp(dot(N, L) * 0.72 + 0.28, 0.0, 1.0);
          vec3 c = uAsh * (0.7 + 0.6 * n) * (uAmb * (0.38 + 0.4 * N.y) + uSunCol * wrap * 1.6 * uLight);
          c += uGlowCol * vP.z * (0.7 + 0.6 * n) * (0.6 - 0.4 * q.y);
          float f = 1.0 - exp(-uHazeD * uHazeD * vDist * vDist);
          c = mix(c, uHaze, clamp(f, 0.0, 1.0) * (1.0 - vP.z * 0.5));
          gl_FragColor = vec4(c, a); }`,
    });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
  }

  /** Write puffs (centre, size, alpha, glow, seed) and sort them back-to-front for `camera`. */
  set(puffs: { x: number; y: number; z: number; size: number; alpha: number; glow: number; seed: number }[], camera: THREE.Camera) {
    const n = Math.min(puffs.length, this.capacity), cp = camera.getWorldPosition(new THREE.Vector3());
    this.order.length = 0;
    for (let i = 0; i < n; i++) { const p = puffs[i]; this.dist[i] = (p.x - cp.x) ** 2 + (p.y - cp.y) ** 2 + (p.z - cp.z) ** 2; if (p.alpha > 0.003 && p.size > 0) this.order.push(i); }
    this.order.sort((a, b) => this.dist[b] - this.dist[a] || a - b);
    const c = this.center.array as Float32Array, q = this.param.array as Float32Array;
    this.order.forEach((i, k) => { const p = puffs[i]; c[k * 3] = p.x; c[k * 3 + 1] = p.y; c[k * 3 + 2] = p.z; q[k * 4] = p.size; q[k * 4 + 1] = p.alpha; q[k * 4 + 2] = p.glow; q[k * 4 + 3] = p.seed; });
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = this.order.length;
    this.center.needsUpdate = true; this.param.needsUpdate = true;
  }

  setLook(o: { sun?: THREE.Vector3; sunColor?: THREE.ColorRepresentation; ambient?: THREE.ColorRepresentation; ash?: THREE.ColorRepresentation; haze?: THREE.ColorRepresentation; hazeDensity?: number; light?: number }) {
    const u = this.uniforms;
    if (o.sun) u.uSun.value.copy(o.sun).normalize();
    if (o.sunColor !== undefined) u.uSunCol.value.set(o.sunColor);
    if (o.ambient !== undefined) u.uAmb.value.set(o.ambient);
    if (o.ash !== undefined) u.uAsh.value.set(o.ash);
    if (o.haze !== undefined) u.uHaze.value.set(o.haze);
    if (o.hazeDensity !== undefined) u.uHazeD.value = o.hazeDensity;
    if (o.light !== undefined) u.uLight.value = o.light;
  }
}

type Puff = { x: number; y: number; z: number; size: number; alpha: number; glow: number; seed: number };

export interface EruptionColumnOptions extends AshLook {
  /** Vent position (world, metres), column top and neutral-buoyancy height above the vent, vent radius. */
  vent?: THREE.Vector3; top?: number; neutral?: number; ventRadius?: number;
  /** Puff counts for the rising column and the umbrella cloud. */
  columnPuffs?: number; umbrellaPuffs?: number; seed?: number;
  /** Horizontal wind drift of the column per metre of height (x, z). */
  wind?: [number, number];
  /** Column half-width growth per metre of height (entrainment spreading, default 0.13). */
  spread?: number;
  /** Puff size relative to the local column radius (default 1). */
  puffScale?: number;
}

/** Plinian eruption column and umbrella cloud. */
export class EruptionColumn {
  readonly puffs: AshPuffs; readonly vent: THREE.Vector3;
  readonly top: number; readonly neutral: number; readonly ventRadius: number;
  private col: { ph: number; sp: number; ang: number; rad: number; s: number; seed: number }[] = [];
  private umb: { ang: number; f: number; h: number; s: number; seed: number; sp: number }[] = [];
  private wind: [number, number]; private buf: Puff[] = []; private spread: number; private puffScale: number;

  constructor(o: EruptionColumnOptions = {}) {
    this.spread = o.spread ?? 0.13; this.puffScale = o.puffScale ?? 1;
    this.vent = (o.vent ?? new THREE.Vector3()).clone(); this.top = o.top ?? 20000; this.neutral = o.neutral ?? this.top * 0.72; this.ventRadius = o.ventRadius ?? 260;
    this.wind = o.wind ?? [0.06, 0.0];
    const r = rng(o.seed ?? 51), nc = o.columnPuffs ?? 700, nu = o.umbrellaPuffs ?? 420;
    for (let i = 0; i < nc; i++) this.col.push({ ph: r(), sp: 0.75 + r() * 0.5, ang: r() * Math.PI * 2, rad: Math.sqrt(r()), s: r(), seed: r() });
    for (let i = 0; i < nu; i++) this.umb.push({ ang: r() * Math.PI * 2, f: Math.pow(r(), 0.7), h: r(), s: r(), seed: r(), sp: (r() - 0.5) * 0.02 });
    this.puffs = new AshPuffs(nc + nu, o);
  }

  /** Column half-width at height y above the vent (entrainment widening). */
  radiusAt(y: number) { return this.ventRadius + this.spread * Math.max(0, y); }

  /**
   * amount 0..1 fades the whole cloud; height 0..1 grows the column toward its top (for a column still rising);
   * umbrella is the umbrella cloud's radius in metres; glow 0..1 the incandescent base.
   */
  update(time_s: number, camera: THREE.Camera, s: { amount?: number; height?: number; umbrella?: number; glow?: number } = {}) {
    const amt = s.amount ?? 1, grow = s.height ?? 1, U = s.umbrella ?? 0, glow = s.glow ?? 1, out = this.buf; out.length = 0;
    const nb = this.neutral * grow, [wx, wz] = this.wind, v = this.vent;
    for (const p of this.col) {
      const age = (time_s * 0.0105 * p.sp + p.ph) % 1;        // ~95 s to climb the column
      const y = nb * (1 - Math.pow(1 - age, 1.55));
      const R = this.radiusAt(y), sway = Math.sin(time_s * 0.05 + p.seed * 40 + y * 0.0006) * 0.18;
      const ang = p.ang + sway + y * 0.00008;
      out.push({ x: v.x + Math.cos(ang) * R * p.rad * 0.62 + wx * y, y: v.y + y + R * 0.15 * Math.sin(p.seed * 30 + time_s * 0.07), z: v.z + Math.sin(ang) * R * p.rad * 0.62 + wz * y,
        size: R * this.puffScale * (1.05 + 0.6 * p.s) * (0.85 + 0.15 * Math.sin(time_s * 0.09 + p.seed * 17)),
        alpha: amt * 0.85 * Math.min(1, age / 0.02) * (1 - smooth(0.9, 1.0, age) * (U > 0 ? 0.6 : 1)),
        glow: glow * (1 - smooth(0, 0.08, age)) * 0.9, seed: p.seed });
    }
    if (U > 0) {
      const R0 = this.radiusAt(nb), top = this.neutral + (this.top - this.neutral) * grow;
      for (const p of this.umb) {
        const rr = R0 + (Math.max(U, R0) - R0) * p.f, ang = p.ang + p.sp * time_s * 0.05;
        const lift = (top - nb) * (0.75 - 0.6 * p.f) * (0.6 + 0.4 * p.h);
        const size = (0.16 * Math.max(U, R0) + 1400) * (0.6 + 0.5 * p.s) * (1 - 0.35 * p.f);
        out.push({ x: v.x + Math.cos(ang) * rr + wx * nb, y: v.y + nb + lift + (p.h - 0.5) * 900, z: v.z + Math.sin(ang) * rr + wz * nb,
          size, alpha: amt * 0.62 * smooth(0, 0.15, (Math.max(U, R0) - rr * 0.98) / Math.max(1, U) + 0.2), glow: 0, seed: p.seed });
      }
    }
    this.puffs.set(out, camera);
  }
}

export interface PyroclasticFlowOptions extends AshLook {
  /** Path on the terrain from the vent downhill (world points, ordered). */
  path: THREE.Vector3[];
  puffs?: number; seed?: number;
  /** Flow width near the vent and at the end of the path, and the height its upper cloud lifts off behind the front. */
  width?: [number, number]; liftOff?: number;
}

/** Pyroclastic density current: a hot avalanche of ash and gas running down a path. */
export class PyroclasticFlow {
  readonly puffs: AshPuffs; readonly length: number;
  private cum: number[] = []; private pts: THREE.Vector3[];
  private p: { u: number; lat: number; s: number; seed: number; ph: number }[] = [];
  private width: [number, number]; private lift: number; private buf: Puff[] = [];

  constructor(o: PyroclasticFlowOptions) {
    this.pts = o.path.map((q) => q.clone()); this.width = o.width ?? [180, 700]; this.lift = o.liftOff ?? 900;
    let L = 0; this.cum = [0]; for (let i = 1; i < this.pts.length; i++) { L += this.pts[i].distanceTo(this.pts[i - 1]); this.cum.push(L); }
    this.length = L;
    const r = rng(o.seed ?? 83), n = o.puffs ?? 420;
    for (let i = 0; i < n; i++) this.p.push({ u: 1 - Math.pow(r(), 1.8), lat: r() - 0.5, s: r(), seed: r(), ph: r() * 6.28 });
    this.puffs = new AshPuffs(n, o);
  }

  /** Point on the path at arc length s (clamped). */
  pointAt(s: number, out = new THREE.Vector3()) {
    const c = this.cum, x = Math.max(0, Math.min(this.length, s));
    let i = 1; while (i < c.length - 1 && c[i] < x) i++;
    const u = (x - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]);
    return out.copy(this.pts[i - 1]).lerp(this.pts[i], u);
  }

  /** front: arc length reached by the flow front (m); amount fades the whole flow; glow 0..1 hot base. */
  update(time_s: number, camera: THREE.Camera, s: { front: number; amount?: number; glow?: number }) {
    const out = this.buf; out.length = 0; const F = Math.max(0, s.front), amt = s.amount ?? 1, glow = s.glow ?? 0.6;
    if (F <= 0 || amt <= 0) { this.puffs.set(out, camera); return; }
    const P = new THREE.Vector3(), A = new THREE.Vector3(), side = new THREE.Vector3();
    for (const q of this.p) {
      const sArc = q.u * F, behind = F - sArc;
      this.pointAt(sArc, P); this.pointAt(sArc + 20, A).sub(P);
      side.set(-A.z, 0, A.x).normalize();
      const w = this.width[0] + (this.width[1] - this.width[0]) * (sArc / Math.max(1, this.length));
      const size = Math.min(700, 90 + behind * 0.22 + q.s * 120) * (1 + 0.12 * Math.sin(time_s * 0.9 + q.ph));
      const rise = Math.min(this.lift, behind * 0.35) * (0.4 + 0.6 * q.s);
      out.push({ x: P.x + side.x * w * q.lat, y: P.y + size * 0.42 + rise, z: P.z + side.z * w * q.lat, size,
        alpha: amt * 0.78 * Math.min(1, behind / 60 + 0.35), glow: glow * Math.max(0, 1 - rise / 220) * Math.max(0, 1 - behind / 2500), seed: q.seed });
    }
    this.puffs.set(out, camera);
  }
}

function smooth(a: number, b: number, x: number) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
