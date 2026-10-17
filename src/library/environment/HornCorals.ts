import * as THREE from 'three';
import { rng } from '../util/math';

export interface HornCoralsOptions {
  /** Number of corals and the [xMin, xMax, zMin, zMax] footprint in metres. */
  count?: number; area?: [number, number, number, number];
  /** Ground height under a coral (world y) and an optional rejection test. */
  ground?: (x: number, z: number) => number; reject?: (x: number, z: number) => boolean;
  /** Length range of the horn in metres (Devonian rugose corals were commonly 5–30 cm). */
  minSize?: number; maxSize?: number;
  /** Yearly growth bands on each horn and fine growth ridges drawn between two bands (schematic density). */
  bands?: number; ridgesPerBand?: number;
  bodyColor?: THREE.ColorRepresentation; polypColor?: THREE.ColorRepresentation;
  seed?: number;
}

/**
 * Solitary rugose ("horn") corals of Palaeozoic reefs: curved, widening cups with yearly constriction bands, fine
 * growth ridges (normal-mapped), radial septa inside the calyx and a crown of short polyp tentacles. Instanced and
 * seated on the supplied ground; `update(time_s)` only sways the polyp crowns (deterministic).
 * Ridge density is illustrative — real daily ridges are ~0.1 mm apart.
 */
export class HornCorals {
  readonly group = new THREE.Group();
  readonly body: THREE.InstancedMesh; readonly crown: THREE.InstancedMesh;
  /** Instance data: base position, yaw, lean and length (exposed so a stage can frame a particular coral). */
  readonly items: { position: THREE.Vector3; yaw: number; lean: number; size: number; mouth: THREE.Vector3 }[] = [];
  private seedPhase: number[] = [];

  constructor(o: HornCoralsOptions = {}) {
    const n = o.count ?? 24, [x0, x1, z0, z1] = o.area ?? [-2, 2, -2, 2], ground = o.ground ?? (() => 0), rand = rng(o.seed ?? 21);
    const bands = o.bands ?? 4, ridges = o.ridgesPerBand ?? 60;
    const bodyGeo = hornGeometry(bands), crownGeo = crownGeometry();
    const bodyMat = new THREE.MeshStandardMaterial({ color: o.bodyColor ?? 0xd9c3a0, roughness: 0.78, metalness: 0, vertexColors: true,
      normalMap: ridgeNormalMap(), normalScale: new THREE.Vector2(0.9, 0.9) });
    bodyMat.normalMap!.repeat.set(1, (bands * ridges) / 8);
    const crownMat = new THREE.MeshStandardMaterial({ color: o.polypColor ?? 0xe7a99a, roughness: 0.55, metalness: 0, emissive: o.polypColor ?? 0xe7a99a, emissiveIntensity: 0.08 });
    this.body = new THREE.InstancedMesh(bodyGeo, bodyMat, n); this.crown = new THREE.InstancedMesh(crownGeo, crownMat, n);
    this.body.castShadow = this.body.receiveShadow = true; this.crown.castShadow = true;
    for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
      const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
      if (o.reject?.(x, z)) continue;
      const size = (o.minSize ?? 0.1) + rand() * ((o.maxSize ?? 0.25) - (o.minSize ?? 0.1));
      const it = { position: new THREE.Vector3(x, ground(x, z) - size * 0.08, z), yaw: rand() * Math.PI * 2, lean: 0.15 + rand() * 0.35, size, mouth: new THREE.Vector3() };
      this.items.push(it); this.seedPhase.push(rand() * 10); i++;
    }
    this.body.count = this.crown.count = this.items.length;
    const m = new THREE.Matrix4();
    this.items.forEach((it, i) => { this.place(m, it, 0); this.body.setMatrixAt(i, m); it.mouth.copy(MOUTH).applyMatrix4(m); });
    this.update(0);
    this.group.add(this.body, this.crown);
  }

  private place(m: THREE.Matrix4, it: { position: THREE.Vector3; yaw: number; lean: number; size: number }, sway: number) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(sway * 0.6, it.yaw, it.lean + sway, 'YXZ'));
    return m.compose(it.position, q, new THREE.Vector3(it.size, it.size, it.size));
  }

  /** @param time_s absolute film time: polyp crowns sway gently in the current. */
  update(time_s: number) {
    const m = new THREE.Matrix4(), b = new THREE.Matrix4(), off = new THREE.Matrix4();
    this.items.forEach((it, i) => {
      this.place(b, it, 0);
      const s = 0.05 * Math.sin(time_s * 1.3 + this.seedPhase[i]) + 0.03 * Math.sin(time_s * 2.9 + this.seedPhase[i] * 2.1);
      off.compose(MOUTH, new THREE.Quaternion().setFromEuler(new THREE.Euler(s, 0, s * 0.7)), new THREE.Vector3(1, 1 + 0.06 * Math.sin(time_s * 0.9 + i), 1));
      m.multiplyMatrices(b, off); this.crown.setMatrixAt(i, m);
    });
    this.crown.instanceMatrix.needsUpdate = true;
  }
}

// Unit horn (length 1): centre line curves toward +X while rising; radius widens toward the calyx at s = 1.
const CURVE = (s: number) => new THREE.Vector3(0.32 * s * s, s, 0);
const RADIUS = 0.2;
const MOUTH = CURVE(1).clone();

function hornGeometry(bands: number) {
  const NS = 220, NA = 40, pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const frame = (s: number) => { const p = CURVE(s), t = CURVE(Math.min(1, s + 1e-3)).sub(CURVE(Math.max(0, s - 1e-3))).normalize(); const nrm = new THREE.Vector3(0, 0, 1).cross(t).normalize(); return { p, t, n: nrm, b: t.clone().cross(nrm) }; };
  const radius = (s: number) => {
    const band = s * bands, k = band - Math.round(band);
    return RADIUS * (0.04 + 0.96 * Math.pow(s, 0.8)) * (1 - 0.09 * Math.exp(-k * k * 140)) * (1 + 0.012 * Math.sin(s * 90));
  };
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, f = frame(s), r = radius(s);
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2, d = f.n.clone().multiplyScalar(Math.cos(a)).add(f.b.clone().multiplyScalar(Math.sin(a)));
      pos.push(...f.p.clone().addScaledVector(d, r).toArray()); uv.push(j / NA, s);
      const band = s * bands, k = band - Math.round(band), dark = 0.78 + 0.22 * s - 0.12 * Math.exp(-k * k * 90);
      col.push(dark, dark * 0.97, dark * 0.92);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  // Calyx: a shallow cup with radial septa inside the rim.
  const base = pos.length / 3, f = frame(1), rim = radius(1), NR = 10, SEPTA = 26;
  for (let i = 0; i <= NR; i++) {
    const u = i / NR, depth = -0.3 * rim * (1 - u * u);
    for (let j = 0; j <= NA * 2; j++) {
      const a = (j / (NA * 2)) * Math.PI * 2, sept = Math.pow(Math.abs(Math.cos(a * SEPTA / 2)), 12) * 0.05 * rim * u;
      const d = f.n.clone().multiplyScalar(Math.cos(a)).add(f.b.clone().multiplyScalar(Math.sin(a)));
      pos.push(...f.p.clone().addScaledVector(d, rim * u * 0.97).addScaledVector(f.t, depth + sept).toArray()); uv.push(j / (NA * 2), 1);
      const c = 0.62 + 0.3 * u; col.push(c, c * 0.9, c * 0.84);
    }
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA * 2; j++) { const a = base + i * (NA * 2 + 1) + j, b = a + NA * 2 + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Ring of short tapered polyp tentacles, authored around the origin with the calyx axis along the horn tangent at s = 1. */
function crownGeometry() {
  const f = CURVE(1).sub(CURVE(1 - 1e-3)).normalize(), nrm = new THREE.Vector3(0, 0, 1).cross(f).normalize(), bin = f.clone().cross(nrm);
  const parts: THREE.BufferGeometry[] = [], rim = RADIUS * 0.82, N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, d = nrm.clone().multiplyScalar(Math.cos(a)).add(bin.clone().multiplyScalar(Math.sin(a)));
    const len = 0.17 + 0.05 * Math.sin(i * 2.3), dir = f.clone().multiplyScalar(0.75).addScaledVector(d, 0.65).normalize();
    const g = new THREE.ConeGeometry(0.018, len, 6, 1).translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(d.x * rim, d.y * rim, d.z * rim); parts.push(g);
  }
  const disc = new THREE.SphereGeometry(rim * 0.8, 16, 8).scale(1, 0.25, 1);
  disc.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), f)); parts.push(disc);
  return mergeGeometries(parts);
}

function mergeGeometries(parts: THREE.BufferGeometry[]) {
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (const p of parts) {
    const base = pos.length / 3;
    const P = p.attributes.position, N = p.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); }
    if (p.index) for (let i = 0; i < p.index.count; i++) idx.push(base + p.index.getX(i)); else for (let i = 0; i < P.count; i++) idx.push(base + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}

/** Tileable normal map of 8 sharp growth ridges along v. */
function ridgeNormalMap() {
  const W = 16, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!, img = g.createImageData(W, H);
  const h = (v: number) => { const k = (v * 8) % 1; return Math.pow(Math.sin(Math.PI * k), 0.5); };
  for (let y = 0; y < H; y++) {
    const v = y / H, dh = (h(v + 1 / H) - h(v - 1 / H)) * H / 2 * 0.012;
    const nx = 0, ny = -dh, nz = 1, l = Math.hypot(nx, ny, nz);
    for (let x = 0; x < W; x++) { const j = (y * W + x) * 4; img.data[j] = 128; img.data[j + 1] = Math.round((ny / l * 0.5 + 0.5) * 255); img.data[j + 2] = Math.round((nz / l * 0.5 + 0.5) * 255); img.data[j + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}
