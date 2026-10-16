import * as THREE from 'three';
import { rng, vnoise2 } from '../util/math';

/** A coin's physical size and mass (metres, kilograms). */
export interface CoinSpec { diameter: number; thickness: number; mass: number; color: THREE.ColorRepresentation }
/** US one-cent coin since 1982 (US Mint): 2.5 g, 19.05 mm across, 1.52 mm thick, copper-plated zinc. */
export const US_CENT: CoinSpec = { diameter: 0.01905, thickness: 0.00152, mass: 0.0025, color: 0xc27a4c };

export interface PileOptions {
  /** Fraction of a loose heap's volume filled by the coins' bounding cylinders (default 0.6). */
  packing?: number;
  /** Slope of the heap's flanks in degrees (default 24). */
  reposeDeg?: number;
}

/**
 * Loose heap of `n` coins: bounding-cylinder volume divided by the packing fraction, poured into a cone at the angle
 * of repose. Returns the cone's radius and height (m), its volume (m³) and the coins' mass (kg).
 */
export function pileShape(n: number, spec: CoinSpec = US_CENT, o: PileOptions = {}) {
  const packing = o.packing ?? 0.6, tan = Math.tan((o.reposeDeg ?? 24) * Math.PI / 180);
  const volume = n * Math.PI * (spec.diameter / 2) ** 2 * spec.thickness / packing;
  const radius = Math.cbrt((3 * volume) / (Math.PI * tan));
  return { volume, radius, height: radius * tan, tan, mass: n * spec.mass };
}

/**
 * Height of a heap at distance `r` from its axis, for a cone of radius `R` and height `H`: straight flanks, a rounded
 * crown over the inner 12% and a flared toe that reaches the ground with zero slope at 1.06 R.
 */
export function heapProfile(r: number, R: number, H: number) {
  if (R <= 0 || H <= 0) return 0;
  const u = r / R, c = 0.12, t = 0.06;
  if (u >= 1 + t) return 0;
  if (u > 1 - t) return (H * (1 + t - u) ** 2) / (4 * t);
  if (u < c) return H * (1 - c / 2) - (H * u * u) / (2 * c);
  return H * (1 - u);
}

/** Smooth minimum of two heights (blends the corner where a heap meets a clipping edge). */
export const softMin = (a: number, b: number, k = 0.02) => { const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k)); return b + (a - b) * h - k * h * (1 - h); };

let faceNormalCache: THREE.Texture | null = null;
/** Normal map for a coin face: a raised rim, a profile relief and a ring of lettering bumps. */
function coinFaceNormal() {
  if (faceNormalCache) return faceNormalCache;
  const N = 128, hgt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1, r = Math.hypot(u, v);
    let h = r > 0.86 && r < 0.99 ? 1 : 0;                                 // rim
    if (r > 0.66 && r < 0.8 && Math.sin(Math.atan2(v, u) * 26) > 0.35) h = 0.45; // lettering
    const bx = (u + 0.06) / 0.34, by = (v + 0.02) / 0.46;                 // a head-and-shoulders profile
    if (bx * bx + by * by < 1 && r < 0.62) h = Math.max(h, 0.7 * (1 - (bx * bx + by * by)) ** 0.4);
    hgt[y * N + x] = h;
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const g = (i: number, j: number) => hgt[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
    const dx = (g(x + 1, y) - g(x - 1, y)) * 1.6, dy = (g(x, y + 1) - g(x, y - 1)) * 1.6, l = Math.hypot(dx, dy, 1);
    data.set([(-dx / l * 0.5 + 0.5) * 255, (-dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], (y * N + x) * 4);
  }
  const tex = new THREE.DataTexture(data, N, N); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return (faceNormalCache = tex);
}

/** One coin: a short cylinder whose caps carry the face relief. */
export function coinGeometry(spec: CoinSpec = US_CENT) {
  return new THREE.CylinderGeometry(spec.diameter / 2, spec.diameter / 2, spec.thickness, 28, 1);
}

/** Polished-to-worn copper. Per-instance colour (InstancedMesh) varies the shine from new to old coins. */
export function coinMaterial(spec: CoinSpec = US_CENT, o: { metalness?: number; roughness?: number } = {}) {
  return new THREE.MeshStandardMaterial({ color: spec.color, metalness: o.metalness ?? 0.9, roughness: o.roughness ?? 0.3, normalMap: coinFaceNormal(), normalScale: new THREE.Vector2(0.9, 0.9) });
}

/**
 * Surface for a heap seen from a distance: overlapping coins (albedo + normal map) tiled in world XZ. `tile` is the
 * texture's size in metres; the default shows about six coins per tile.
 */
export function heapMaterial(spec: CoinSpec = US_CENT, seed = 3, o: { metalness?: number; roughness?: number } = {}) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d')!, hc = document.createElement('canvas'); hc.width = hc.height = S;
  const hg = hc.getContext('2d')!, r = rng(seed), base = new THREE.Color(spec.color);
  g.fillStyle = `#${base.clone().multiplyScalar(0.32).getHexString()}`; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#000'; hg.fillRect(0, 0, S, S);
  const R = S / 6.4 / 2;
  for (let k = 0; k < 260; k++) {
    // Later coins lie on top: each is a tilted disc (ellipse), lighter on its raised side; drawn wrapped so it tiles.
    const x = r() * S, y = r() * S, sx = 0.55 + 0.45 * r(), rot = r() * Math.PI, shade = 0.7 + 0.55 * r(), lift = 0.35 + 0.65 * r();
    const layers: [CanvasRenderingContext2D, THREE.Color][] = [[g, base.clone().multiplyScalar(shade)], [hg, new THREE.Color(lift, 0, 0)]];
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) for (const [ctx, c] of layers) {
      ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(rot); ctx.scale(1, sx);
      const grad = ctx.createRadialGradient(-R * 0.25, -R * 0.25, R * 0.1, 0, 0, R);
      grad.addColorStop(0, `#${c.clone().multiplyScalar(1.25).getHexString()}`); grad.addColorStop(0.86, `#${c.getHexString()}`); grad.addColorStop(1, `#${c.clone().multiplyScalar(0.55).getHexString()}`);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  // Height (red channel) to normals.
  const hd = hg.getImageData(0, 0, S, S).data, nd = new Uint8Array(S * S * 4);
  const H = (i: number, j: number) => hd[(((j + S) % S) * S + ((i + S) % S)) * 4] / 255;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (H(i + 1, j) - H(i - 1, j)) * 3, dy = (H(i, j + 1) - H(i, j - 1)) * 3, l = Math.hypot(dx, dy, 1);
    nd.set([(-dx / l * 0.5 + 0.5) * 255, (-dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], (j * S + i) * 4);
  }
  const normal = new THREE.DataTexture(nd, S, S); normal.needsUpdate = true; normal.generateMipmaps = true; normal.minFilter = THREE.LinearMipmapLinearFilter; normal.magFilter = THREE.LinearFilter;
  for (const t of [map, normal]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return new THREE.MeshStandardMaterial({ map, normalMap: normal, normalScale: new THREE.Vector2(1.1, 1.1), metalness: o.metalness ?? 0.82, roughness: o.roughness ?? 0.38 });
}

/**
 * Heightfield heap on a polar grid centred on the mesh origin. `update(extent, h)` rebuilds the surface over a disc of
 * radius `extent` from `h(x, z)` (local metres). Where h ≤ 0 the surface tucks just under the support, so only the heap
 * shows. UVs are world-scaled for `heapMaterial`.
 */
export class CoinHeap {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  constructor(material: THREE.Material, private rings = 56, private segments = 112, private tile = 0.12) {
    const n = 1 + rings * segments, idx: number[] = [];
    // Counter-clockwise seen from above, so the surface faces up.
    for (let i = 0; i < segments; i++) idx.push(0, 1 + ((i + 1) % segments), 1 + i);
    for (let r = 0; r < rings - 1; r++) for (let i = 0; i < segments; i++) {
      const a = 1 + r * segments + i, b = 1 + r * segments + ((i + 1) % segments), c = a + segments, d = b + segments;
      idx.push(a, b, c, b, d, c);
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
  }
  update(extent: number, h: (x: number, z: number) => number, lift = 0.0005) {
    const p = this.geo.attributes.position as THREE.BufferAttribute, uv = this.geo.attributes.uv as THREE.BufferAttribute;
    const set = (k: number, x: number, z: number) => { const y = h(x, z); p.setXYZ(k, x, y > 0 ? y + lift : -0.03, z); uv.setXY(k, x / this.tile, z / this.tile); };
    set(0, 0, 0);
    for (let r = 0; r < this.rings; r++) {
      const rr = extent * ((r + 1) / this.rings) ** 0.85;
      for (let i = 0; i < this.segments; i++) { const a = (i / this.segments) * Math.PI * 2; set(1 + r * this.segments + i, Math.cos(a) * rr, Math.sin(a) * rr); }
    }
    p.needsUpdate = true; uv.needsUpdate = true; this.geo.computeVertexNormals(); this.geo.computeBoundingSphere();
    this.mesh.visible = extent > 0;
  }
}

/** Seeded random parameters per coin instance (fixed for the life of the pile). */
export interface CoinSeed { a: number; b: number; c: number; d: number; e: number }

/**
 * Many individual coins in one InstancedMesh with per-coin seeds and tints. Callers place each visible coin with
 * `place(i, position, up, spin)`; `finish(count)` hides the rest. Every update sets the full state.
 */
export class CoinInstances {
  readonly mesh: THREE.InstancedMesh;
  readonly seeds: CoinSeed[] = [];
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private q2 = new THREE.Quaternion();
  private s = new THREE.Vector3(1, 1, 1); private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(readonly max: number, spec: CoinSpec = US_CENT, seed = 11, material?: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(coinGeometry(spec), material ?? coinMaterial(spec), max);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    const r = rng(seed), col = new THREE.Color();
    for (let i = 0; i < max; i++) {
      this.seeds.push({ a: r(), b: r(), c: r(), d: r(), e: r() });
      const k = 0.72 + 0.5 * r(); col.setRGB(k, k * (0.92 + 0.12 * r()), k * (0.85 + 0.2 * r()));
      this.mesh.setColorAt(i, col); this.mesh.setMatrixAt(i, this.zero);
    }
  }
  /** Place coin `i` with its axis along `up` (unit vector), spun by `spin` radians about that axis. */
  place(i: number, pos: THREE.Vector3, up: THREE.Vector3, spin: number, scale = 1) {
    this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up); this.q2.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin);
    this.q.multiply(this.q2); this.s.setScalar(scale);
    this.m.compose(pos, this.q, this.s); this.mesh.setMatrixAt(i, this.m);
  }
  hide(i: number) { this.mesh.setMatrixAt(i, this.zero); }
  finish(count: number) {
    for (let i = count; i < this.max; i++) this.mesh.setMatrixAt(i, this.zero);
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Surface normal of a heightfield by central differences. */
export function heightNormal(h: (x: number, z: number) => number, x: number, z: number, e = 0.004, out = new THREE.Vector3()) {
  return out.set(h(x - e, z) - h(x + e, z), 2 * e, h(x, z - e) - h(x, z + e)).normalize();
}

/** Low-amplitude seeded unevenness for a heap surface (−1..1), smooth at the scale `cell`. */
export const heapNoise = (x: number, z: number, cell: number, seed = 5) => vnoise2(x / cell, z / cell, seed) * 2 - 1;
