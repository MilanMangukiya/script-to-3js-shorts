import * as THREE from 'three';
import { rng } from '../util/math';

/**
 * fireworks-v1 — a deterministic fireworks show computed entirely on the GPU from absolute time. Each shell rises as
 * a sparking comet, then bursts into stars that fly out with air drag and fall under gravity, leaving glowing trails.
 * Shell types: peony (clean sphere), chrysanthemum (sparkling trails), willow (long golden drooping trails), ring
 * (a tilted circle), crossette (stars that split into four) and palm (few heavy comets). `flash` / `flashColor`
 * after update() light the scene (drive a PointLight or sky exposure). Units: metres; place `group` at the launch site.
 */
export type ShellType = 'peony' | 'chrysanthemum' | 'willow' | 'ring' | 'crossette' | 'palm';
export interface ShellSpec {
  /** Launch time (s), launch point and burst height (m above the launch point). */
  t: number; x?: number; z?: number; height?: number;
  type?: ShellType; color?: THREE.ColorRepresentation; color2?: THREE.ColorRepresentation;
  /** Burst radius scale (m at full spread) and star count. */
  size?: number; stars?: number;
}
const COLORS = [0xff3b4e, 0x3bd1ff, 0xffd23b, 0x7bff4f, 0xd25bff, 0xff8a2b, 0xffffff, 0x3b6bff, 0xff4fc3];

const VS = /* glsl */ `
  attribute vec4 aBurst;   // burst time, burst position xyz
  attribute vec4 aVel;     // direction xyz * speed, star life
  attribute vec4 aLook;    // r g b, kind (0 star, 1 launch comet, 2 crossette child)
  attribute vec4 aExtra;   // drag, gravity, trail index (0 = head), seed
  attribute vec4 aLaunch;  // launch time, launch xyz
  uniform float uTime, uSize, uPx; varying vec3 vCol; varying float vA;
  float h(float n){ return fract(sin(n) * 43758.5453); }
  vec3 fly(vec3 p0, vec3 v, float drag, float g, float dt){
    float e = (1.0 - exp(-drag * dt)) / drag;
    return p0 + v * e + vec3(0.0, -g * (dt - e) / drag, 0.0);    // drag-limited ballistic path (terminal velocity g/drag)
  }
  void main(){
    float lag = aExtra.z * 0.035, t = uTime - lag, dt = t - aBurst.x, a = 0.0; vec3 p = vec3(0.0, -1e5, 0.0);
    if (aLook.w < 0.5 || aLook.w > 1.5) {
      float life = aVel.w;
      if (dt > 0.0 && dt < life) {
        vec3 v = aVel.xyz;
        if (aLook.w > 1.5) {   // crossette: the star splits at 40% of its life into a child heading along a new direction
          float ts = life * 0.4; vec3 ps = fly(aBurst.yzw, v, aExtra.x, aExtra.y, ts);
          if (dt < ts) p = fly(aBurst.yzw, v, aExtra.x, aExtra.y, dt); else { vec3 vs = v * exp(-aExtra.x * ts) * 0.4 + normalize(vec3(h(aExtra.w), h(aExtra.w + 1.0), h(aExtra.w + 2.0)) - 0.5) * length(v) * 0.6; p = fly(ps, vs, aExtra.x, aExtra.y, dt - ts); }
        } else p = fly(aBurst.yzw, v, aExtra.x, aExtra.y, dt);
        float u = dt / life; a = pow(1.0 - u, 1.6) * smoothstep(0.0, 0.03, dt);
        a *= 0.75 + 0.25 * sin(uTime * 37.0 + aExtra.w * 11.0);          // shimmer
        if (aExtra.z > 0.0) a *= 0.55 * pow(0.78, aExtra.z);             // trail samples fade
      }
    } else {   // launch comet: rises with deceleration toward the burst point
      float lt = t - aLaunch.x, rise = aBurst.x - aLaunch.x;
      if (lt > 0.0 && lt < rise) { float u = lt / rise; vec3 top = aBurst.yzw; p = mix(aLaunch.yzw, top, 1.0 - (1.0 - u) * (1.0 - u)); p.x += sin(u * 9.0 + aExtra.w) * 0.6 * u; a = 0.9 * (aExtra.z > 0.0 ? 0.5 * pow(0.7, aExtra.z) : 1.0); }
    }
    vCol = aLook.rgb; vA = a;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = a > 0.0 ? clamp(uSize * uPx / max(-mv.z, 1.0) * (aExtra.z > 0.0 ? 0.7 : 1.0), 1.0, 64.0) : 0.0;
    gl_Position = projectionMatrix * mv;
  }`;
const FS = /* glsl */ `varying vec3 vCol; varying float vA;
  void main(){ float d = length(gl_PointCoord - 0.5); float core = exp(-d * d * 60.0), halo = exp(-d * d * 9.0) * 0.35; if (vA <= 0.0) discard;
    gl_FragColor = vec4((vCol * (core * 4.0 + halo) + vec3(1.0) * core * 1.5) * vA, 1.0); }`;

export class Fireworks {
  readonly points: THREE.Points; readonly group = new THREE.Group(); readonly shells: Required<ShellSpec>[];
  flash = 0; readonly flashColor = new THREE.Color();
  private u: Record<string, THREE.IUniform>;
  constructor(shells: ShellSpec[], o: { seed?: number; trail?: number; starSize?: number } = {}) {
    const r = rng(o.seed ?? 8), K = o.trail ?? 6;
    this.shells = shells.map((s, i) => ({ x: 0, z: 0, height: 120, type: 'peony', color: COLORS[i % COLORS.length], color2: COLORS[(i + 3) % COLORS.length], size: 1, stars: 0, ...s } as Required<ShellSpec>));
    const B: number[] = [], V: number[] = [], C: number[] = [], E: number[] = [], Lh: number[] = [], c1 = new THREE.Color(), c2 = new THREE.Color();
    const push = (burst: number[], vel: number[], col: number[], ex: number[], launch: number[]) => { for (let k = 0; k <= K; k++) { B.push(...burst); V.push(...vel); C.push(...col); E.push(ex[0], ex[1], k, ex[3]); Lh.push(...launch); } };
    for (const s of this.shells) {
      const rise = 1.6 + s.height / 160, tb = s.t + rise, bp = [s.x + (r() - 0.5) * 6, s.height, s.z + (r() - 0.5) * 6], launch = [s.t, s.x, 0, s.z];
      c1.set(s.color); c2.set(s.color2);
      push([tb, ...bp], [0, 0, 0, 0], [1, 0.85, 0.6, 1], [0, 0, 0, r() * 100], launch);   // the launch comet
      const type = s.type, n = s.stars || ({ peony: 140, chrysanthemum: 160, willow: 120, ring: 90, crossette: 40, palm: 18 } as const)[type];
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 1.2 - 0.6, r() * 6.28, r() * 1.2 - 0.6)), d = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        if (type === 'ring') { const a = (i / n) * Math.PI * 2; d.set(Math.cos(a), 0, Math.sin(a)).applyQuaternion(tilt); }
        else { const z = 1 - 2 * (i + 0.5) / n, a = i * 2.39996 + r() * 0.2, rr = Math.sqrt(1 - z * z); d.set(Math.cos(a) * rr, z, Math.sin(a) * rr); }
        const speed = (type === 'willow' ? 26 : type === 'palm' ? 40 : 34) * s.size * (0.9 + r() * 0.2), drag = type === 'willow' ? 0.9 : type === 'palm' ? 0.5 : 1.25, g = type === 'willow' ? 14 : 9.8;
        const life = type === 'willow' ? 4.5 + r() : type === 'palm' ? 3.2 : 2.2 + r() * 0.8, col = type === 'willow' ? [1.0, 0.72, 0.32] : (i % 2 && type !== 'peony') ? [c2.r, c2.g, c2.b] : [c1.r, c1.g, c1.b];
        push([tb, ...bp], [d.x * speed, d.y * speed, d.z * speed, life], [...col, type === 'crossette' ? 2 : 0], [drag, g, 0, r() * 100 + i], launch);
        if (type === 'crossette') for (let k = 0; k < 3; k++) push([tb, ...bp], [d.x * speed, d.y * speed, d.z * speed, life], [...col, 2], [drag, g, 0, r() * 100 + i + k * 17], launch);
      }
    }
    const geo = new THREE.BufferGeometry(), n = B.length / 4;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aBurst', new THREE.Float32BufferAttribute(B, 4)); geo.setAttribute('aVel', new THREE.Float32BufferAttribute(V, 4)); geo.setAttribute('aLook', new THREE.Float32BufferAttribute(C, 4));
    geo.setAttribute('aExtra', new THREE.Float32BufferAttribute(E, 4)); geo.setAttribute('aLaunch', new THREE.Float32BufferAttribute(Lh, 4));
    this.u = { uTime: { value: 0 }, uSize: { value: o.starSize ?? 1.6 }, uPx: { value: 1100 } };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false; this.group.add(this.points);
  }
  /** A seeded show: `rate` shells per second between start and end, spread across `width` metres. */
  static show(o: { start: number; end: number; rate?: number; width?: number; height?: [number, number]; seed?: number; finale?: boolean; types?: ShellType[] }): ShellSpec[] {
    const r = rng(o.seed ?? 4), out: ShellSpec[] = [], types = o.types ?? ['peony', 'chrysanthemum', 'willow', 'ring', 'crossette', 'palm', 'peony'], W = o.width ?? 160, [h0, h1] = o.height ?? [90, 150];
    for (let t = o.start; t < o.end; t += (1 / (o.rate ?? 0.8)) * (0.5 + r())) out.push({ t, x: (r() - 0.5) * W, z: (r() - 0.5) * W * 0.3, height: h0 + r() * (h1 - h0), type: types[Math.floor(r() * types.length)], color: COLORS[Math.floor(r() * COLORS.length)], color2: COLORS[Math.floor(r() * COLORS.length)], size: 0.8 + r() * 0.5 });
    if (o.finale) for (let i = 0; i < 14; i++) out.push({ t: o.end - 2 + r() * 1.5, x: (r() - 0.5) * W, z: (r() - 0.5) * W * 0.3, height: h0 + r() * (h1 - h0), type: types[i % types.length], color: COLORS[i % COLORS.length], size: 1 });
    return out;
  }
  /** Set the time; `pixelScale` ≈ output height in pixels × 0.57 keeps star sizes consistent across render scales. */
  update(t: number, pixelScale = 1100) {
    this.u.uTime.value = t; this.u.uPx.value = pixelScale;
    let f = 0; this.flashColor.setRGB(0, 0, 0); const c = new THREE.Color();
    for (const s of this.shells) { const tb = s.t + 1.6 + s.height / 160, dt = t - tb; if (dt < 0 || dt > 1.5) continue; const k = Math.exp(-dt * 4) * s.size; f += k; this.flashColor.add(c.set(s.color).multiplyScalar(k)); }
    this.flash = f; if (f > 0) this.flashColor.multiplyScalar(1 / f);
  }
}
