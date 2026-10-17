import * as THREE from 'three';
import { clamp, vnoise2 } from './math';

/**
 * Organic modeling helpers: lofted tubes with elliptical, smoothly varying cross-sections (bodies, necks, trunks,
 * fuselages), rounded tapered limbs and per-vertex colour painting. Metres; deterministic.
 */
export interface LoftOptions {
  /** Ring vertices (default 20) and rings along the spine (default 32). */
  radial?: number; segments?: number;
  /** World direction treated as "up" for the cross-section frame (default +Y). */
  up?: THREE.Vector3;
  /** Close both ends with a vertex at the spine tip (default true). */
  caps?: boolean;
  /** Optional radial displacement: (u along spine 0..1, angle rad, point) → metres added along the ring normal. */
  displace?: (u: number, angle: number, p: THREE.Vector3) => number;
}
const catmull = (a: number, b: number, c: number, d: number, t: number) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
/** Smoothly interpolate a radius array at u in [0,1] (Catmull–Rom through the control values, clamped ≥ 0). */
export function sampleRadius(r: number[], u: number) {
  const n = r.length - 1, x = clamp(u) * n, i = Math.min(n - 1, Math.floor(x)), t = x - i;
  return Math.max(0, catmull(r[Math.max(0, i - 1)], r[i], r[i + 1], r[Math.min(n, i + 2)], t));
}
/**
 * Loft an elliptical tube along a Catmull–Rom spine. `rx` (sideways) and `ry` (toward `up`) are control radii spread
 * evenly along the spine; give tiny end radii for rounded tips.
 */
export function loftGeometry(spine: THREE.Vector3[], rx: number[], ry: number[], o: LoftOptions = {}) {
  const radial = o.radial ?? 20, segs = o.segments ?? 32, up = (o.up ?? new THREE.Vector3(0, 1, 0)).clone().normalize();
  const curve = new THREE.CatmullRomCurve3(spine, false, 'centripetal');
  const pos: number[] = [], idx: number[] = [], uvs: number[] = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), Q = new THREE.Vector3(), prevN = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, P); curve.getTangentAt(u, T).normalize();
    // Frame from the fixed up vector; near-vertical spines fall back to the previous ring's normal (no flips).
    N.copy(up).addScaledVector(T, -up.dot(T));
    if (N.lengthSq() < 1e-6) N.copy(prevN.lengthSq() ? prevN : new THREE.Vector3(0, 0, 1)); else N.normalize();
    prevN.copy(N); B.crossVectors(T, N).normalize();
    const ax = sampleRadius(rx, u), ay = sampleRadius(ry, u);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      Q.copy(P).addScaledVector(N, c * ay).addScaledVector(B, s * ax);
      if (o.displace) { const d = o.displace(u, a, Q); const nx = c / Math.max(ay, 1e-4), ny = s / Math.max(ax, 1e-4), l = Math.hypot(nx, ny) || 1; Q.addScaledVector(N, d * nx / l).addScaledVector(B, d * ny / l); }
      pos.push(Q.x, Q.y, Q.z); uvs.push(j / radial, u);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  if (o.caps !== false) {
    for (const [end, ring] of [[0, 0], [1, segs]] as const) {
      curve.getPointAt(end, P); const c = pos.length / 3; pos.push(P.x, P.y, P.z); uvs.push(0.5, end);
      for (let j = 0; j < radial; j++) { const a = ring * row + j; if (end === 0) idx.push(c, a, a + 1); else idx.push(c, a + 1, a); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Rounded, tapered limb along −Y from the origin: radius r1 at the top joint, r2 at the bottom, length `len`. */
export function limbGeometry(len: number, r1: number, r2: number, radial = 14) {
  const pts: THREE.Vector2[] = [], k = 6;
  for (let i = 0; i <= k; i++) { const a = (i / k) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r1 + 1e-4, Math.cos(a) * r1)); }
  for (let i = 0; i <= k; i++) { const a = Math.PI / 2 + (i / k) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r2 + 1e-4, -len + Math.cos(a) * r2)); }
  return new THREE.LatheGeometry(pts, radial);
}

/** Paint per-vertex colours from a function of the (geometry-space) position and normal; returns the geometry. */
export function paintVertices(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void) {
  const pos = g.attributes.position as THREE.BufferAttribute; if (!g.attributes.normal) g.computeVertexNormals();
  const nrm = g.attributes.normal as THREE.BufferAttribute, col = new Float32Array(pos.count * 3), p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i); fn(p, n, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Cellular-ish spot field in [0,1] (1 = inside a spot) from value noise: `scale` spots per metre, `size` 0..1. */
export function spotField(x: number, y: number, scale: number, size: number, seed: number) {
  const n = vnoise2(x * scale, y * scale, seed) * 0.7 + vnoise2(x * scale * 2.3, y * scale * 2.3, seed + 7) * 0.3;
  return THREE.MathUtils.smoothstep(n, 1 - size, 1 - size + 0.06);
}
