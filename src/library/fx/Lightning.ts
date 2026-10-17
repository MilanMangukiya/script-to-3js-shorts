import * as THREE from 'three';
import { rng } from '../util/math';

/**
 * lightning-v1 — cloud-to-ground lightning: a seeded fractal bolt (midpoint displacement with forking branches) drawn
 * as additive glowing ribbons that always face the camera, a stroke sequence (leader, return stroke, 2–4 re-strikes
 * that flicker and fade) and a `flash` level for lighting the scene (drive a light or the sky exposure with it).
 * `strike(at_s, from, to)` schedules a bolt; `update(t, camera)` evaluates everything from absolute time.
 */
interface Seg { a: THREE.Vector3; b: THREE.Vector3; w: number; order: number }
function bolt(from: THREE.Vector3, to: THREE.Vector3, seed: number, branches = 6): Seg[] {
  const r = rng(seed), segs: Seg[] = [];
  const build = (a: THREE.Vector3, b: THREE.Vector3, depth: number, w: number, order: number) => {
    const len = a.distanceTo(b);
    if (depth === 0 || len < 0.4) { segs.push({ a, b, w, order }); return; }
    const mid = a.clone().lerp(b, 0.45 + r() * 0.1), side = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.3, r() - 0.5).normalize();
    mid.addScaledVector(side, len * (0.12 + r() * 0.1));
    build(a, mid, depth - 1, w, order); build(mid, b, depth - 1, w, order);
    if (order < 2 && depth > 2 && r() < branches / 20) {
      const dir = b.clone().sub(a).normalize().add(new THREE.Vector3(r() - 0.5, -0.2, r() - 0.5).multiplyScalar(1.2)).normalize();
      build(mid, mid.clone().addScaledVector(dir, len * (0.4 + r() * 0.5)), depth - 2, w * 0.5, order + 1);
    }
  };
  build(from, to, 8, 1, 0);
  return segs;
}

// Camera-facing ribbon: every vertex of a segment uses the same screen direction (start → end), so the cross-section
// profile (vSide −1..1) is consistent across the quad.
const VS = /* glsl */ `attribute vec3 aStart, aEnd; attribute float aSide, aWidth, aOrder; uniform float uWidth; varying float vSide; varying float vOrder;
  void main(){ vec4 p = modelViewMatrix * vec4(position, 1.0), a = modelViewMatrix * vec4(aStart, 1.0), b = modelViewMatrix * vec4(aEnd, 1.0);
    vec2 d = normalize(b.xy / b.z - a.xy / a.z + 1e-6); vec2 n = vec2(-d.y, d.x);
    p.xy += n * aSide * uWidth * aWidth * max(-p.z, 1.0) * 0.004; vSide = aSide; vOrder = aOrder; gl_Position = projectionMatrix * p; }`;
const FS = /* glsl */ `uniform vec3 uColor; uniform float uLevel; varying float vSide; varying float vOrder;
  void main(){ float core = exp(-vSide * vSide * 18.0), glow = exp(-vSide * vSide * 2.5) * 0.35; float o = vOrder < 0.5 ? 1.0 : vOrder < 1.5 ? 0.55 : 0.3;
    gl_FragColor = vec4(uColor * (core * 3.5 + glow) * uLevel * o, 1.0); }`;

export class Lightning {
  readonly group = new THREE.Group();
  private strikes: { at: number; mesh: THREE.Mesh; u: Record<string, THREE.IUniform>; seq: number[] }[] = [];
  /** Current scene flash level (0..~1.5) after update(). */
  flash = 0;
  constructor(private o: { color?: THREE.ColorRepresentation; width?: number } = {}) {}
  /** Schedule a strike at absolute time `at_s` from a cloud point to a ground point. */
  strike(at_s: number, from: THREE.Vector3, to: THREE.Vector3, seed = 1) {
    const segs = bolt(from, to, seed), n = segs.length, pos = new Float32Array(n * 12), sa = new Float32Array(n * 12), sb = new Float32Array(n * 12), side = new Float32Array(n * 4), wid = new Float32Array(n * 4), ord = new Float32Array(n * 4), idx: number[] = [];
    segs.forEach((s, i) => {
      const v = [s.a, s.a, s.b, s.b], sd = [-1, 1, 1, -1];
      for (let k = 0; k < 4; k++) { const j = i * 4 + k; pos.set([v[k].x, v[k].y, v[k].z], j * 3); sa.set([s.a.x, s.a.y, s.a.z], j * 3); sb.set([s.b.x, s.b.y, s.b.z], j * 3); side[j] = sd[k]; wid[j] = s.w; ord[j] = s.order; }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aStart', new THREE.BufferAttribute(sa, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(sb, 3));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); g.setAttribute('aWidth', new THREE.BufferAttribute(wid, 1)); g.setAttribute('aOrder', new THREE.BufferAttribute(ord, 1)); g.setIndex(idx);
    const u = { uColor: { value: new THREE.Color(this.o.color ?? 0xd8e4ff) }, uLevel: { value: 0 }, uWidth: { value: this.o.width ?? 1 } };
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false; mesh.visible = false; this.group.add(mesh);
    const r = rng(seed + 99), seq = [0, 0.09 + r() * 0.04, 0.2 + r() * 0.08, 0.34 + r() * 0.1].slice(0, 2 + Math.floor(r() * 3));
    this.strikes.push({ at: at_s, mesh, u, seq });
  }
  /** Brightness envelope of one strike at time-since-strike `dt` (s). */
  private level(dt: number, seq: number[]) {
    if (dt < -0.06 || dt > 0.9) return 0;
    if (dt < 0) return 0.15 * (1 + dt / 0.06);   // faint stepped leader
    let v = 0; for (const s of seq) { const d = dt - s; if (d >= 0) v = Math.max(v, Math.exp(-d * 28) * (s === 0 ? 1.4 : 1)); }
    return v;
  }
  update(t: number) {
    this.flash = 0;
    for (const s of this.strikes) { const l = this.level(t - s.at, s.seq); s.u.uLevel.value = l; s.mesh.visible = l > 0.002; this.flash = Math.max(this.flash, l); }
  }
}
