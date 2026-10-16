import * as THREE from 'three';
import { rng } from '../util/math';
import type { PBRLibrary } from '../materials/PBR';
import { POSE_STAND, type HumanoidPose } from './Humanoid';

/**
 * Human figure v2: a sculpted, skinned person (adult, child or elder) built from smooth lofted anatomy — superellipse
 * torso profiles, tapered limbs, hands with fingers, a face with lidded eyes, nose, lips, ears and brows — wearing
 * garments generated from the same body parameterisation (inflated, with boundary-following hems and necklines), all
 * skinned to one bone skeleton. Same pose API as humanoid-figure-v1 (HumanoidPose, setPose, anchors), plus walk/idle
 * pose helpers, so stages can swap it in. Local frame: origin at the feet, +Y up, facing +Z; L = the figure's left (+X).
 */
export type HairStyle = 'bald' | 'buzz' | 'short' | 'side-part' | 'bob' | 'long' | 'ponytail' | 'bun' | 'curly' | 'afro' | 'headscarf';
export type Top = 'none' | 'tshirt' | 'longsleeve' | 'shirt' | 'hoodie' | 'jacket' | 'coat' | 'tank' | 'dress' | 'blouse';
export type Bottom = 'none' | 'trousers' | 'jeans' | 'shorts' | 'skirt';
export type Shoes = 'none' | 'sneakers' | 'boots' | 'sandals' | 'dress';
export interface HumanV2Options {
  height?: number; sex?: 'female' | 'male'; build?: 'slim' | 'average' | 'athletic' | 'heavy'; age?: 'child' | 'adult' | 'elder';
  skin?: THREE.ColorRepresentation; eyes?: THREE.ColorRepresentation;
  hair?: { style: HairStyle; color: THREE.ColorRepresentation };
  top?: Top; topColor?: THREE.ColorRepresentation; bottom?: Bottom; bottomColor?: THREE.ColorRepresentation;
  shoes?: Shoes; shoeColor?: THREE.ColorRepresentation;
  glasses?: boolean; hat?: 'cap' | 'beanie' | 'sunhat' | null; hatColor?: THREE.ColorRepresentation; beard?: boolean;
  /** Closed eyelids (sleeping, blinking poses). */
  eyesClosed?: boolean;
  /** Fabric/leather textures from the shared PBR library (falls back to plain cloth shading). */
  pbr?: PBRLibrary;
  seed?: number;
}

// Bone indices.
const B = { hips: 0, spine: 1, chest: 2, neck: 3, head: 4, shL: 5, elL: 6, haL: 7, shR: 8, elR: 9, haR: 10, hiL: 11, knL: 12, anL: 13, hiR: 14, knR: 15, anR: 16 } as const;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/**
 * Smooth interpolation through [t, v] keys (clamped ends): monotone cubic Hermite (PCHIP, Fritsch–Butland slopes), so
 * surfaces flow through the keys without overshoot and without the flat ridge a per-segment ease leaves at every key.
 */
function prof(keys: number[][], t: number): number {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (t > keys[i + 1][0]) i++;
  const d = (k: number) => (keys[k + 1][1] - keys[k][1]) / (keys[k + 1][0] - keys[k][0]);
  const m = (k: number) => {
    if (k === 0) return d(0);
    if (k === n - 1) return d(n - 2);
    const d0 = d(k - 1), d1 = d(k); if (d0 * d1 <= 0) return 0;
    const h0 = keys[k][0] - keys[k - 1][0], h1 = keys[k + 1][0] - keys[k][0], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / d0 + w2 / d1);
  };
  const [t0, v0] = keys[i], [t1, v1] = keys[i + 1], h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m(i) + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * m(i + 1);
}
type W = [number, number][];
const norm4 = (w: W): W => { const s = [...w].filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4), t = s.reduce((x, y) => x + y[1], 0) || 1; return s.map(([i, v]) => [i, v / t]); };

/** Accumulates skinned, coloured, UV-mapped geometry. */
class Builder {
  pos: number[] = []; uv: number[] = []; col: number[] = []; si: number[] = []; sw: number[] = []; idx: number[] = []; seams: [number, number][] = [];
  vert(p: THREE.Vector3, u: number, v: number, w: W, c = [1, 1, 1]) {
    const n = norm4(w); this.pos.push(p.x, p.y, p.z); this.uv.push(u, v); this.col.push(c[0], c[1], c[2]);
    for (let k = 0; k < 4; k++) { this.si.push(n[k]?.[0] ?? 0); this.sw.push(n[k]?.[1] ?? 0); }
    return this.pos.length / 3 - 1;
  }
  /**
   * Loft of `rings` cross-sections with `segs` points (ring(i, θ) → point, weights, colour); θ runs counter-clockwise
   * seen from +Y/+axis so every loft has the same outward winding. keep(i, θ) trims faces (all four corners kept).
   * UV u = arc length around (m), v = arc length along (m), for metre-tiled fabric textures.
   */
  loft(rings: number, segs: number, ring: (i: number, th: number) => { p: THREE.Vector3; w: W; c?: number[] }, keep?: (i: number, th: number) => boolean, flip = false) {
    const base = this.pos.length / 3, P: { p: THREE.Vector3; w: W; c?: number[] }[][] = [];
    for (let i = 0; i < rings; i++) { P.push([]); for (let j = 0; j <= segs; j++) P[i].push(ring(i, (j / segs) * Math.PI * 2)); }
    const along = [0]; for (let i = 1; i < rings; i++) along.push(along[i - 1] + P[i][0].p.distanceTo(P[i - 1][0].p) * 0.5 + P[i][segs >> 1].p.distanceTo(P[i - 1][segs >> 1].p) * 0.5);
    const keepV: boolean[] = [];
    for (let i = 0; i < rings; i++) {
      let around = 0;
      for (let j = 0; j <= segs; j++) {
        const th = (j / segs) * Math.PI * 2, r = P[i][j];
        if (j > 0) around += r.p.distanceTo(P[i][j - 1].p);
        this.vert(r.p, around, along[i], r.w, r.c); keepV.push(keep ? keep(i, th) : true);
      }
      this.seams.push([base + i * (segs + 1), base + i * (segs + 1) + segs]);
    }
    for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + segs + 1;
      if (!(keepV[a] && keepV[a + 1] && keepV[b] && keepV[b + 1])) continue;
      if (flip) this.idx.push(base + a, base + a + 1, base + b, base + b, base + a + 1, base + b + 1);
      else this.idx.push(base + a, base + b, base + a + 1, base + b, base + b + 1, base + a + 1);
    }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx); g.computeVertexNormals();
    const n = g.attributes.normal as THREE.BufferAttribute;   // weld the u-seam normals
    for (const [a, b] of this.seams) { const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2, l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
    return g;
  }
}
function merge(dst: Builder, src: Builder) {
  const base = dst.pos.length / 3;
  dst.pos.push(...src.pos); dst.uv.push(...src.uv); dst.col.push(...src.col); dst.si.push(...src.si); dst.sw.push(...src.sw);
  dst.idx.push(...src.idx.map((i) => i + base)); dst.seams.push(...src.seams.map(([a, b]) => [a + base, b + base] as [number, number]));
}

/** Body measurements (metres, 1.72 m reference) from sex and build. */
function bodyShape(o: HumanV2Options) {
  const f = o.sex === 'female', b = o.build ?? 'average';
  const k = { slim: 0.92, average: 1, athletic: 1.03, heavy: 1.1 }[b], belly = b === 'heavy' ? 1.3 : b === 'athletic' ? 0.94 : b === 'slim' ? 0.95 : 1;
  const sh = (f ? 0.172 : 0.188) * (b === 'athletic' ? 1.04 : b === 'slim' ? 0.97 : 1);
  // Torso half-width (A), half-depth (Bk) and forward offset (C) by height y.
  // Belly widens the whole waist smoothly (a broad swell from the hips to the ribs, not a single roll).
  const bw = (w: number) => 1 + (belly - 1) * w;
  const A = [[0.8, 0.1], [0.86, f ? 0.178 : 0.163], [0.92, (f ? 0.186 : 0.168) * bw(0.25)], [0.98, (f ? 0.168 : 0.158) * bw(0.6)], [1.05, (f ? 0.132 : 0.145) * bw(0.9)], [1.12, (f ? 0.13 : 0.143) * bw(0.9)],
    [1.18, (f ? 0.138 : 0.15) * bw(0.6)], [1.24, (f ? 0.147 : 0.161) * bw(0.25)], [1.3, f ? 0.152 : 0.17], [1.35, sh * 0.95], [1.39, sh * 0.96], [1.41, sh * 0.92], [1.43, sh * 0.74], [1.45, 0.095], [1.47, 0.062]];
  const Bk = [[0.8, 0.07], [0.86, 0.104], [0.92, f ? 0.112 : 0.106], [0.98, 0.102], [1.05, 0.098 * belly * (b === 'heavy' ? 1.12 : 1)], [1.12, 0.098 * belly], [1.18, 0.102], [1.24, f ? 0.108 : 0.112],
    [1.3, f ? 0.108 : 0.114], [1.35, 0.106], [1.39, 0.096], [1.41, 0.088], [1.43, 0.076], [1.45, 0.063], [1.47, 0.054]];
  const C = [[0.8, -0.005], [0.92, -0.008], [1.0, 0.0], [1.08, 0.006 + (belly - 1) * 0.045], [1.18, 0.01], [1.27, 0.014], [1.35, 0.008], [1.42, -0.008], [1.47, -0.008]];
  return { f, k, sh, belly, A, Bk, C, bust: f ? 1 : 0 };
}
type Shape = ReturnType<typeof bodyShape>;

// Rest-pose joint heights (metres, 1.72 m reference).
const J = { hips: 0.92, chest: 1.17, neck: 1.46, head: 1.54, shY: 1.4, elY: 1.07, wrY: 0.83, hipX: 0.09, hipY: 0.89, knY: 0.48, anY: 0.075 };
const torsoW = (y: number): W => { const h = 1 - smooth(0.94, 1.06, y), c = smooth(1.12, 1.24, y); return [[B.hips, h], [B.spine, Math.max(0, 1 - h - c)], [B.chest, c]]; };
/** Superellipse point: half-axes a (x) and b (z), exponent n (2 = ellipse); θ = π/2 faces +Z. */
const sup = (th: number, a: number, b: number, n = 2.1) => { const c = Math.cos(th), s = Math.sin(th); return [a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]; };

function torsoRing(S: Shape, y: number, th: number, inflate = 0) {
  const a = prof(S.A, y) * S.k + inflate, b = prof(S.Bk, y) * S.k + inflate * 0.9, cz = prof(S.C, y);
  let [x, z] = sup(th, a, b, y > 1.38 ? 2.0 : 2.15);
  if (S.bust) z += Math.exp(-(((y - 1.262) / 0.055) ** 2)) * Math.exp(-(((Math.abs(x) - 0.072) / 0.048) ** 2)) * smooth(0, 0.5, Math.sin(th)) * 0.04 * S.k;
  z -= Math.exp(-(((y - 0.9) / 0.06) ** 2)) * smooth(0, -0.6, Math.sin(th)) * 0.018 * S.k;   // buttocks
  z -= Math.exp(-(((y - 1.36) / 0.05) ** 2)) * smooth(0, -0.6, Math.sin(th)) * 0.008;         // shoulder blades
  return new THREE.Vector3(x, y, z + cz);
}
/** Limb centre line from p0 to p1; cross-section half-axes a (side to side) and b (front to back). */
function limbPoint(p0: THREE.Vector3, p1: THREE.Vector3, t: number, th: number, a: number, b: number) {
  const [x, z] = sup(th, a, b, 2.05);
  return p0.clone().lerp(p1, t).add(new THREE.Vector3(x, 0, z));
}
function armR(t: number, S: Shape) { return prof([[0, 0.047], [0.05, 0.05], [0.16, 0.046], [0.32, 0.043], [0.5, 0.037], [0.58, 0.035], [0.66, 0.037], [0.8, 0.032], [0.94, 0.026], [1, 0.025]], t) * S.k * (S.f ? 0.92 : 1); }
function legR(t: number, S: Shape) { return prof([[0, 0.088], [0.08, 0.087], [0.25, 0.074], [0.42, 0.057], [0.5, 0.051], [0.6, 0.055], [0.7, 0.049], [0.85, 0.037], [0.97, 0.032], [1, 0.033]], t) * S.k * (S.f ? 1.02 : 1); }

/** Head surface (chin → crown) with jaw taper, brow ridge and shallow eye sockets. */
function headRing(S: Shape, y: number, th: number, inflate = 0) {
  const a = prof([[1.5, 0.03], [1.512, 0.046], [1.53, 0.053], [1.555, 0.059], [1.59, 0.068], [1.625, 0.075], [1.66, 0.076], [1.69, 0.069], [1.71, 0.054], [1.722, 0.03], [1.728, 0.003]], y) * (S.f ? 0.965 : 1);
  const b = prof([[1.5, 0.036], [1.512, 0.058], [1.53, 0.072], [1.555, 0.082], [1.59, 0.09], [1.625, 0.096], [1.66, 0.098], [1.69, 0.092], [1.71, 0.077], [1.722, 0.047], [1.728, 0.003]], y);
  const cz = prof([[1.5, 0.05], [1.52, 0.036], [1.54, 0.026], [1.565, 0.015], [1.6, 0.008], [1.65, 0.0], [1.7, -0.006], [1.728, -0.008]], y);
  let [x, z] = sup(th, a + inflate, b + inflate, 2.05);
  if (inflate === 0) {
    const front = Math.max(0, Math.sin(th));
    if (y < 1.59) x *= 1 - 0.24 * Math.pow(front, 2.2) * smooth(1.59, 1.505, y);                // chin narrower than the jaw
    z += Math.exp(-(((y - 1.638) / 0.011) ** 2)) * Math.pow(front, 6) * 0.005;                    // brow ridge
    z -= Math.exp(-(((y - 1.611) / 0.012) ** 2)) * Math.exp(-(((Math.abs(x) - 0.032) / 0.015) ** 2)) * front * 0.0035;   // eye sockets
    z += Math.exp(-(((y - 1.585) / 0.016) ** 2)) * Math.exp(-(((Math.abs(x) - 0.048) / 0.016) ** 2)) * front * 0.003;    // cheekbones
  }
  return new THREE.Vector3(x, y, z + cz);
}
/** Head surface point that never tucks in below `yMin` (hair falling straight from the widest contour). */
function hangRing(S: Shape, y: number, th: number, inflate: number, yMin = 1.6) { const p = headRing(S, Math.max(y, yMin), th, inflate); p.y = y; return p; }

export class HumanV2 {
  readonly root = new THREE.Group();
  readonly skeleton: THREE.Skeleton;
  readonly bones: THREE.Bone[];
  /** Head bone (use head.localToWorld for targets) and anchors for effects and gear (same names as humanoid-figure-v1). */
  readonly head: THREE.Bone;
  readonly chestAnchor = new THREE.Object3D(); readonly headAnchor = new THREE.Object3D();
  readonly handL = new THREE.Object3D(); readonly handR = new THREE.Object3D();
  readonly backAnchor = new THREE.Object3D(); readonly waistAnchor = new THREE.Object3D();
  readonly footL = new THREE.Object3D(); readonly footR = new THREE.Object3D();
  readonly meshes: THREE.SkinnedMesh[] = [];
  readonly options: HumanV2Options;
  private S: Shape;

  constructor(o: HumanV2Options = {}) {
    this.options = o;
    const S = (this.S = bodyShape(o)), child = o.age === 'child';
    const height = o.height ?? (child ? 1.3 : o.sex === 'female' ? 1.65 : 1.76);
    this.root.scale.setScalar(height / (child ? 1.55 : 1.72));
    // ---- skeleton (rest pose: standing, arms hanging straight down)
    const bone = (name: string, parent: THREE.Object3D | null, x: number, y: number, z = 0) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent?.add(b); return b; };
    const hips = bone('hips', null, 0, J.hips), spine = bone('spine', hips, 0, 0), chest = bone('chest', spine, 0, J.chest - J.hips);
    const neck = bone('neck', chest, 0, J.neck - J.chest), head = bone('head', neck, 0, J.head - J.neck);
    const shL = bone('shoulderL', chest, S.sh, J.shY - J.chest), elL = bone('elbowL', shL, 0, J.elY - J.shY), haL = bone('handL', elL, 0, J.wrY - J.elY);
    const shR = bone('shoulderR', chest, -S.sh, J.shY - J.chest), elR = bone('elbowR', shR, 0, J.elY - J.shY), haR = bone('handR', elR, 0, J.wrY - J.elY);
    const hiL = bone('hipL', hips, J.hipX, J.hipY - J.hips), knL = bone('kneeL', hiL, 0, J.knY - J.hipY), anL = bone('ankleL', knL, 0, J.anY - J.knY);
    const hiR = bone('hipR', hips, -J.hipX, J.hipY - J.hips), knR = bone('kneeR', hiR, 0, J.knY - J.hipY), anR = bone('ankleR', knR, 0, J.anY - J.knY);
    this.bones = [hips, spine, chest, neck, head, shL, elL, haL, shR, elR, haR, hiL, knL, anL, hiR, knR, anR];
    this.head = head;
    this.root.add(hips); this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.bones);
    this.headAnchor.position.set(0, 0.075, 0.01); head.add(this.headAnchor);
    this.chestAnchor.position.set(0, 0.12, 0.03); chest.add(this.chestAnchor);
    this.backAnchor.position.set(0, 0.12, -0.13); chest.add(this.backAnchor);
    this.waistAnchor.position.set(0, 0.03, 0); hips.add(this.waistAnchor);
    this.handL.position.set(0, -0.1, 0); haL.add(this.handL); this.handR.position.set(0, -0.1, 0); haR.add(this.handR);
    this.footL.position.set(0, -0.06, 0.07); anL.add(this.footL); this.footR.position.set(0, -0.06, 0.07); anR.add(this.footR);

    // ---- materials
    const skinColor = new THREE.Color(o.skin ?? 0xc68b67), sheen = skinColor.clone().lerp(new THREE.Color(0xffffff), 0.4);
    const skin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.52, metalness: 0, sheen: 0.3, sheenRoughness: 0.55, sheenColor: sheen });
    const skinPlain = new THREE.MeshPhysicalMaterial({ color: skinColor, roughness: 0.5, metalness: 0, sheen: 0.3, sheenRoughness: 0.55, sheenColor: sheen });
    const fab = (id: string, color: THREE.ColorRepresentation, rough = 1, tile = 0.35) => o.pbr ? o.pbr.material(id, { tint: color, roughness: rough, tile, normalScale: 0.8 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.85 * rough, metalness: 0 });
    const hairColor = new THREE.Color(o.hair?.color ?? 0x2a1d15);
    const hairMat = new THREE.MeshPhysicalMaterial({ color: hairColor, roughness: 0.45, metalness: 0, normalMap: strandNormals(), normalScale: new THREE.Vector2(0.7, 0.7), sheen: 0.6, sheenColor: hairColor.clone().lerp(new THREE.Color(0xffffff), 0.3), sheenRoughness: 0.35 });
    const top = o.top ?? 'tshirt', bottom = o.bottom ?? (top === 'dress' ? 'none' : 'trousers'), shoes = o.shoes ?? 'sneakers';
    const topColor = o.topColor ?? 0x4f6d8f, bottomColor = o.bottomColor ?? 0x2e3440, shoeColor = o.shoeColor ?? 0xe9e6df;
    const topMat = top === 'jacket' || top === 'coat' ? fab('velour_velvet', topColor, 1.1, 0.5) : top === 'hoodie' ? fab('cotton_jersey', topColor, 1.15, 0.5) : fab('cotton_jersey', topColor, 1, 0.3);
    const bottomMat = bottom === 'jeans' ? fab('denim_fabric', bottomColor, 1, 0.3) : fab('cotton_jersey', bottomColor, 1.05, 0.45);
    const shoeMat = shoes === 'boots' || shoes === 'dress' ? fab('brown_leather', shoeColor, 0.8, 0.25) : new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.6 });
    const soleMat = new THREE.MeshStandardMaterial({ color: shoes === 'sneakers' ? 0xf2f0ea : 0x2a221d, roughness: 0.7 });

    // ---- body
    const body = new Builder(), sk = [skinColor.r, skinColor.g, skinColor.b];
    const lipC = skinColor.clone().lerp(new THREE.Color(0x9c4448), 0.42), cheek = skinColor.clone().lerp(new THREE.Color(0xd06a5a), 0.12), shade = skinColor.clone().multiplyScalar(0.8);
    const TY0 = 0.8, TY1 = 1.47, TR = 46;
    body.loft(TR, 44, (i, th) => { const y = TY0 + (TY1 - TY0) * (i / (TR - 1)); const p = torsoRing(S, y, th);
      const w = torsoW(y), side = p.x >= 0 ? B.shL : B.shR, ws = smooth(0.12, 0.19, Math.abs(p.x)) * smooth(1.3, 1.4, y) * 0.55;   // shoulders follow the arms a little
      return { p, w: ws > 0 ? [...w.map(([b, v]) => [b, v * (1 - ws)] as [number, number]), [side, ws]] : w, c: sk }; });
    body.loft(10, 30, (i, th) => { const t = i / 9, y = 1.425 + t * 0.15, [x, z] = sup(th, 0.052 * S.k * (1 - 0.06 * t), 0.056 * S.k, 2);
      return { p: new THREE.Vector3(x, y, z + 0.004 + t * 0.008), w: [[B.chest, 1 - smooth(0.2, 0.6, t)], [B.neck, smooth(0.2, 0.6, t) * (1 - smooth(0.6, 1, t))], [B.head, smooth(0.6, 1, t)]], c: sk }; });
    const HR = 34, HS = 56;
    body.loft(HR, HS, (i, th) => { const y = 1.5 + (1.728 - 1.5) * (i / (HR - 1)), p = headRing(S, y, th), front = Math.max(0, Math.sin(th));
      const ck = Math.exp(-(((y - 1.578) / 0.02) ** 2)) * Math.exp(-(((Math.abs(p.x) - 0.045) / 0.02) ** 2)) * front;
      const sock = Math.exp(-(((y - 1.614) / 0.011) ** 2)) * Math.exp(-(((Math.abs(p.x) - 0.031) / 0.018) ** 2)) * front;
      const m = skinColor.clone().lerp(cheek, ck).lerp(shade, sock * 0.55);
      return { p, w: [[B.head, 1]], c: [m.r, m.g, m.b] }; });
    // Nose: bridge → tip → under the tip.
    const nose = new Builder(), faceZ = (y: number, x = 0) => { let best = headRing(S, y, Math.PI / 2); if (x) { const th = Math.PI / 2 - Math.asin(Math.min(0.95, x / prof([[1.5, 0.047], [1.6, 0.07], [1.66, 0.076]], y))); best = headRing(S, y, th); } return best.z; };
    nose.loft(16, 20, (i, th) => { const t = i / 15, y = 1.619 - 0.042 * Math.min(t, 0.82) - (t > 0.82 ? (t - 0.82) * 0.03 : 0);
      const tipRound = t > 0.82 ? Math.sqrt(1 - ((t - 0.82) / 0.18) ** 2) : 1;
      const w = (0.0055 + 0.0105 * Math.pow(Math.min(t, 0.85), 1.5)) * (0.55 + 0.45 * tipRound), pz = t < 0.82 ? 0.003 + 0.0165 * Math.pow(t / 0.82, 1.45) : 0.0195 - (1 - tipRound) * 0.012;
      const [x, z] = sup(th, w, 0.009 + 0.006 * t, 2.0);
      return { p: new THREE.Vector3(x, y, faceZ(y) - 0.006 + pz + Math.max(z, -0.004)), w: [[B.head, 1]], c: sk }; }, undefined, true);
    merge(body, nose);
    // Lips: two soft rolls across the mouth.
    for (const side of [1, -1]) {   // nostril wings
      const al = new Builder(); al.loft(8, 12, (i, th) => { const t = i / 7, r = Math.sin(Math.PI * t) * 0.0056 + 0.0005, [u, v] = sup(th, r, r * 0.8, 2);
        return { p: new THREE.Vector3(side * 0.0102 + u, 1.5785 + (t - 0.5) * 0.01, faceZ(1.578, 0.0102) + 0.0032 + v), w: [[B.head, 1]], c: sk }; });
      merge(body, al);
    }
    for (const [ly, lr, out] of [[1.5515, 0.0038, 0.0028], [1.5432, 0.0046, 0.0022]]) {
      const lips = new Builder();
      lips.loft(12, 12, (i, th) => { const t = i / 11, x = (t - 0.5) * 0.046, taper = Math.sin(Math.PI * t), r = lr * (0.25 + 0.75 * taper), [u, v] = sup(th, r, r * 1.1, 2);
        return { p: new THREE.Vector3(x, ly + u, faceZ(ly, Math.abs(x)) - 0.0035 + out * taper + v), w: [[B.head, 1]], c: [lipC.r, lipC.g, lipC.b] }; }, undefined, true);
      merge(body, lips);
    }
    for (const side of [1, -1]) {   // ears
      const ear = new Builder();
      ear.loft(10, 14, (i, th) => { const t = i / 9, y = 1.582 + t * 0.056, r = Math.sin(Math.PI * Math.min(1, t * 1.05)) * 0.016 + 0.002, [u, v] = sup(th, r * 0.32, r, 2);
        const hx = headRing(S, y, side > 0 ? 0 : Math.PI).x; return { p: new THREE.Vector3(hx + side * 0.002 + u, y, -0.006 + v * 0.9 - t * 0.004), w: [[B.head, 1]], c: sk }; });
      merge(body, ear);
    }
    // Arms and hands.
    for (const side of [1, -1]) {
      const sh = side > 0 ? B.shL : B.shR, el = side > 0 ? B.elL : B.elR, ha = side > 0 ? B.haL : B.haR;
      const p0 = new THREE.Vector3(side * (S.sh - 0.012), J.shY - 0.004, 0), p1 = new THREE.Vector3(side * (S.sh + 0.004), J.wrY, 0.004), AR = 34;
      body.loft(AR, 28, (i, th) => { const t = i / (AR - 1), r = armR(t, S), w = armW(t, sh, el, ha);
        return { p: limbPoint(p0, p1, t, th, r * (t < 0.04 ? 0.55 + 0.45 * Math.sqrt(t / 0.04) : 1), r * 0.92), w, c: sk }; }, undefined, true);
      hand(body, side, p1, ha, sk, S);
    }
    // Legs (and bare feet when the shoes leave them visible).
    for (const side of [1, -1]) {
      const hi = side > 0 ? B.hiL : B.hiR, kn = side > 0 ? B.knL : B.knR, an = side > 0 ? B.anL : B.anR;
      body.loft(44, 30, (i, th) => { const t = i / 43, r = legR(t, S); return { p: legPoint(S, side, t, th, r), w: legW(t, hi, kn, an), c: sk }; }, undefined, true);
      if (shoes === 'none' || shoes === 'sandals') { foot(body, side, an, 0, sk); toes(body, side, an, sk); }
    }
    this.addMesh(body.geometry(), skin);

    // ---- eyes with lids, brows
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xdcd2c6, roughness: 0.22 });
    const iris = new THREE.MeshPhysicalMaterial({ color: o.eyes ?? 0x3b2a1f, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05 });
    const brow = new THREE.MeshStandardMaterial({ color: hairColor.clone().multiplyScalar(0.85), roughness: 0.9 });
    for (const side of [1, -1]) {
      const ex = side * 0.0318, zf = faceZ(1.612, 0.0318), R = 0.0122;
      const eye = new THREE.Group(); eye.position.set(ex, 1.612 - J.head, zf - R + 0.0042); eye.rotation.y = -side * 0.035; head.add(eye);
      eye.add(new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), eyeWhite));
      const ir = new THREE.Mesh(new THREE.SphereGeometry(R * 1.005, 24, 8, 0, Math.PI * 2, 0, 0.66), iris); ir.rotation.x = Math.PI / 2; eye.add(ir);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, 16, 6, 0, Math.PI * 2, 0, 0.29), pupil); pu.rotation.x = Math.PI / 2; eye.add(pu);
      const lidU = new THREE.Mesh(new THREE.SphereGeometry(R * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI * (o.eyesClosed ? 0.78 : 0.36)), skinPlain); lidU.rotation.x = o.eyesClosed ? 0.04 : 0.16; eye.add(lidU);
      const lidL = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 24, 8, 0, Math.PI * 2, Math.PI * 0.74, Math.PI * 0.26), skinPlain); lidL.rotation.x = -0.1; eye.add(lidL);
      const br = new THREE.Group(); br.position.set(side * 0.033, 1.636 - J.head, faceZ(1.637, 0.033) + 0.0012); br.rotation.y = side * 0.25; head.add(br);
      for (const [dx, dy, rz, len] of [[-0.0075, -0.0006, 0.18, 0.012], [0.0055, 0.0004, -0.22, 0.013]]) { const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0026, len, 3, 8).rotateZ(Math.PI / 2), brow); seg.scale.set(1, 0.75, 0.6); seg.position.set(side * dx, dy, 0); seg.rotation.z = side * rz; br.add(seg); }
      eye.traverse((m) => { m.castShadow = false; m.receiveShadow = true; }); br.castShadow = false;
    }
    if (o.beard) this.addMesh(this.headShell(() => 1.505, (th) => 1.586 - 0.012 * Math.max(0, Math.sin(th)), () => 0.0035, 18, HS,
      (y, th) => Math.sin(th) > -0.35 && !(y > 1.533 && y < 1.556 && Math.abs(Math.cos(th)) < 0.34 && Math.sin(th) > 0)), hairMat);

    // ---- hair, garments, shoes, accessories
    const hs = o.hair?.style ?? (S.f ? 'long' : 'short');
    if (hs !== 'bald') this.addHair(hs, hairMat);
    if (top !== 'none') this.addTop(top, topMat);
    if (bottom !== 'none' && top !== 'dress') this.addBottom(bottom, bottomMat);
    if (shoes !== 'none') for (const side of [1, -1]) {
      const an = side > 0 ? B.anL : B.anR, s1 = new Builder(), s2 = new Builder();
      const strap = (t: number, th: number) => Math.sin(th) > -0.35 && ((t > 0.36 && t < 0.47) || (t > 0.62 && t < 0.7)) || (t < 0.08 && Math.sin(th) > -0.6);
      foot(s1, side, an, shoes === 'sandals' ? 0.0022 : 0.007, [1, 1, 1], shoes === 'boots' ? 0.16 : 0, shoes === 'sandals' ? strap : undefined); soleLoft(s2, side, an);
      this.addMesh(s1.geometry(), shoes === 'sandals' ? fab('brown_leather', 0x7a5236, 0.8, 0.25) : shoeMat);
      this.addMesh(s2.geometry(), shoes === 'sandals' ? new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.85 }) : soleMat);
    }
    if (o.glasses) this.addGlasses(faceZ);
    if (o.hat) this.addHat(o.hat, new THREE.MeshStandardMaterial({ color: o.hatColor ?? 0x2b3a4a, roughness: 0.85 }));
    if (child) head.scale.setScalar(1.18);   // after binding, so the skinned head grows with its bone
    this.setPose(POSE_STAND);
  }

  private addMesh(g: THREE.BufferGeometry, m: THREE.Material) {
    const mesh = new THREE.SkinnedMesh(g, m); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
    this.root.add(mesh); mesh.bind(this.skeleton); this.meshes.push(mesh); return mesh;   // bound in the rest pose (root scale included)
  }

  /**
   * A shell over the head whose lower and upper edges follow lo(θ)/hi(θ) exactly (clean hairlines, no stair steps);
   * inflate(y, θ) sets thickness; below 1.6 m the shell hangs straight down from the widest head contour.
   */
  private headShell(lo: (th: number) => number, hi: (th: number) => number, inflate: (y: number, th: number) => number, rings = 26, segs = 56, keep?: (y: number, th: number) => boolean, hangFrom = 1.6) {
    const b = new Builder(), S = this.S, Y = (i: number, th: number) => lo(th) + (hi(th) - lo(th)) * (i / (rings - 1));
    const crownZ = headRing(S, 1.728, Math.PI / 2, 0).z - 0.003;
    b.loft(rings, segs, (i, th) => { const y = Y(i, th), inf = inflate(y, th), p = y < hangFrom ? hangRing(S, y, th, inf, hangFrom) : headRing(S, y, th, inf);
      if (y > 1.69) { p.y += inf * smooth(1.69, 1.729, y); if (i === rings - 1 && y >= 1.725) { p.x = 0; p.z = crownZ; } }   // close the crown
      return { p, w: y > 1.5 ? [[B.head, 1]] : [[B.head, smooth(1.4, 1.5, y)], [B.neck, 0.5 * (1 - smooth(1.4, 1.5, y))], [B.chest, 0.5 * (1 - smooth(1.4, 1.5, y))]] }; },
      keep ? (i, th) => keep(Y(i, th), th) : undefined);
    return b.geometry();
  }

  private addHair(style: HairStyle, mat: THREE.Material) {
    const S = this.S, top = () => 1.729;
    const fr = (th: number) => Math.sin(th);
    // Short hairline: forehead 1.678, temples, above the ears 1.605, nape 1.555.
    const shortLine = (th: number) => 1.608 + 0.082 * smooth(0.55, 1.0, fr(th)) - 0.05 * smooth(0.0, -0.85, fr(th));
    const vol = (base: number, edge: (th: number) => number, bump = 0, freq = 9) => (y: number, th: number) =>
      (0.0015 + base * smooth(edge(th), edge(th) + 0.035, y)) + bump * (0.5 + 0.5 * Math.sin(th * freq + y * 150)) * (0.5 + 0.5 * Math.sin(th * (freq - 4) - y * 95)) * smooth(edge(th), edge(th) + 0.03, y);
    if (style === 'headscarf') {
      const b = new Builder(), R = 72, SEG = 120;   // high resolution keeps the trimmed face opening smooth
      b.loft(R, SEG, (i, th) => { const t = i / (R - 1), y = 1.4 + t * 0.335, y2 = Math.min(1.729, y);
        const p = y > 1.5 ? headRing(S, y2, th, 0.011 + 0.008 * Math.max(0, -fr(th))) : (() => { const q = headRing(S, 1.5, th, 0.014); return new THREE.Vector3(q.x * (1 + (1.5 - y) * 2.4), y, q.z * (1 + (1.5 - y) * 2.0) - 0.012); })();
        return { p, w: y > 1.5 ? [[B.head, 1]] : [[B.neck, 0.6], [B.chest, 0.4]] }; },
        (i, th) => { const y = 1.4 + (i / (R - 1)) * 0.335, f = fr(th), dx = Math.cos(th) / 0.62, dy = (y - 1.585) / 0.088; return !(f > 0 && dx * dx + dy * dy < 1); });
      this.addMesh(b.geometry(), mat); return;
    }
    if (style === 'buzz') { this.addMesh(this.headShell(shortLine, top, vol(0.0012, shortLine)), mat); return; }
    if (style === 'short' || style === 'side-part' || style === 'curly' || style === 'afro') {
      const base = style === 'afro' ? 0.045 : style === 'curly' ? 0.017 : 0.008, bump = style === 'afro' ? 0.014 : style === 'curly' ? 0.01 : 0.0015;
      const v = vol(base, shortLine, bump, style === 'afro' ? 11 : 9);
      this.addMesh(this.headShell(shortLine, top, (y, th) => v(y, th) + (style === 'side-part' ? 0.005 * Math.max(0, Math.cos(th)) * smooth(1.62, 1.7, y) : 0)), mat); return;
    }
    if (style === 'ponytail' || style === 'bun') {
      const pulled = (th: number) => 1.604 + 0.084 * smooth(0.55, 1.0, fr(th)) - 0.045 * smooth(0.0, -0.85, fr(th));
      this.addMesh(this.headShell(pulled, top, vol(0.0055, pulled)), mat);
      const b = new Builder();
      if (style === 'bun') b.loft(14, 20, (i, th) => { const t = i / 13, r = Math.sin(Math.PI * t) * 0.033 + 0.002, [x, z] = sup(th, r, r, 2); return { p: new THREE.Vector3(x, 1.695 + (t - 0.5) * 0.052, -0.09 + z), w: [[B.head, 1]] }; });
      else b.loft(18, 18, (i, th) => { const t = i / 17, r = 0.019 * (1 - 0.5 * t) + 0.005 * Math.sin(Math.PI * t), [x, z] = sup(th, r, r, 2);
        return { p: new THREE.Vector3(x, 1.645 - t * 0.21, -0.108 - 0.045 * Math.sin(t * 1.7) + z), w: t < 0.35 ? [[B.head, 1]] : [[B.head, 0.45], [B.neck, 0.55]] }; }, undefined, true);
      this.addMesh(b.geometry(), mat); return;
    }
    // Bob and long hair: the sides and back fall straight from the widest contour; the face stays open.
    const face = (th: number) => smooth(0.6, 0.8, fr(th));
    const lowSide = style === 'bob' ? 1.525 : 1.5, lowBack = style === 'bob' ? 1.515 : 1.33;
    const lower = (th: number) => { const f = face(th), base = lowSide + (lowBack - lowSide) * smooth(-0.1, -0.7, fr(th)); return base + (1.688 - base) * f; };
    const b = new Builder(), S2 = this.S, R = 40, SEG = 64;
    b.loft(R, SEG, (i, th) => { const lo = lower(th), y = lo + (1.729 - lo) * (i / (R - 1)), inf = 0.0016 + 0.011 * smooth(lo, lo + 0.03, y);
      let p = y < 1.6 ? hangRing(S2, y, th, inf + 0.004, 1.6) : headRing(S2, y, th, inf);
      if (y < 1.52) { const k = 1.52 - y; p = new THREE.Vector3(p.x * (1 + k * 0.5), y, p.z - k * (fr(th) < 0 ? 0.32 : 0.08)); }   // clear the neck and shoulders
      return { p, w: y > 1.5 ? [[B.head, 1]] : [[B.head, smooth(1.35, 1.5, y)], [B.neck, 0.4 * (1 - smooth(1.35, 1.5, y))], [B.chest, 0.6 * (1 - smooth(1.35, 1.5, y))]] }; });
    this.addMesh(b.geometry(), mat);
  }

  private addTop(top: Top, mat: THREE.Material) {
    const S = this.S, g = new Builder(), loose = top === 'jacket' || top === 'coat' ? 0.026 : top === 'hoodie' ? 0.02 : top === 'shirt' || top === 'blouse' ? 0.012 : 0.009;
    const hem = top === 'coat' ? 0.52 : top === 'jacket' ? 0.8 : top === 'dress' ? 0.98 : 0.86;
    const fr = (th: number) => Math.sin(th);
    // Neckline as an exact top edge: crew, V (shirts, jackets, coats) or scoop (blouse, dress, tank).
    const vee = (th: number) => Math.max(0, 1 - Math.abs(Math.atan2(Math.sin(th - Math.PI / 2), Math.cos(th - Math.PI / 2))) / 0.42);
    const neck = (th: number) => { const crew = 1.458 - 0.02 * smooth(0.3, 1, fr(th));
      if (top === 'shirt' || top === 'jacket' || top === 'coat') return crew - 0.075 * vee(th);
      if (top === 'blouse' || top === 'dress' || top === 'tank') return 1.452 - 0.055 * smooth(0.15, 1, fr(th)) - (top === 'tank' ? 0.02 : 0);
      return crew; };
    const R = 42;
    g.loft(R, 44, (i, th) => { const yTop = neck(th), y = hem + (yTop - hem) * (i / (R - 1)), flare = y < 0.95 ? (0.95 - y) * (top === 'coat' ? 0.22 : 0.16) : 0;
      const p = torsoRing(S, Math.max(y, 0.8), th, loose + 0.008 + flare + (y < 0.8 ? (0.8 - y) * 0.06 : 0));   // even ease all the way up (no ridge at the waist)
      if (y < 0.8) p.y = y;
      return { p, w: y < 0.86 ? [[B.hips, 0.6], [B.hiL, p.x > 0 ? 0.2 : 0], [B.hiR, p.x < 0 ? 0.2 : 0]] : torsoW(y) }; });
    if (top === 'hoodie') { const h = new Builder(); h.loft(10, 30, (i, th) => { const t = i / 9, p = torsoRing(S, 1.44 + t * 0.03, th, 0.03 + 0.02 * t); p.z -= 0.03 + t * 0.03; p.y += t * 0.03; return { p, w: [[B.chest, 1]] }; }, (i, th) => Math.sin(th) < 0.2); merge(g, h); }
    const sleeve = top === 'tshirt' || top === 'dress' || top === 'blouse' ? 0.36 : top === 'tank' ? -1 : 0.97;
    if (sleeve > 0) for (const side of [1, -1]) {
      const sh = side > 0 ? B.shL : B.shR, el = side > 0 ? B.elL : B.elR, ha = side > 0 ? B.haL : B.haR;
      const p0 = new THREE.Vector3(side * (S.sh - 0.012), J.shY - 0.004, 0), p1 = new THREE.Vector3(side * (S.sh + 0.004), J.wrY, 0.004), R2 = 30;
      const pIn = new THREE.Vector3(side * (S.sh - 0.05), J.shY + 0.03, 0);   // sleeve head tucked inside the shoulder
      g.loft(R2, 26, (i, th) => { const t = (i / (R2 - 1)) * (sleeve + 0.12) - 0.12, tc = Math.max(t, 0), r = armR(tc, S) + loose + (sleeve < 0.5 ? 0.007 * (tc / sleeve) : 0.004 + 0.004 * smooth(0.8, 1, tc));
        if (t < 0) { const k = 1 + t / 0.12; return { p: limbPoint(pIn.clone().lerp(p0, k), p0, 0, th, r * (0.55 + 0.45 * k), r * 0.94 * (0.6 + 0.4 * k)), w: armW(0, sh, el, ha) }; }
        return { p: limbPoint(p0, p1, tc, th, r, r * 0.94), w: armW(tc, sh, el, ha) }; }, undefined, true);
    }
    if (top === 'dress') {   // skirt from the waist, flaring to just below the knee
      const R3 = 22;
      g.loft(R3, 48, (i, th) => { const t = i / (R3 - 1), y = 1.0 - t * 0.47, p = torsoRing(S, Math.max(0.86, y), th, 0.014 + t * 0.11); p.y = y; const sx = Math.cos(th);
        return { p, w: [[B.hips, 1 - 0.55 * t], [B.hiL, sx > 0 ? 0.55 * t * sx : 0], [B.hiR, sx < 0 ? -0.55 * t * sx : 0]] }; }, undefined, true);
    }
    this.addMesh(g.geometry(), mat);
  }

  private addBottom(bottom: Bottom, mat: THREE.Material) {
    const S = this.S, g = new Builder(), loose = bottom === 'jeans' ? 0.006 : 0.01;
    g.loft(10, 44, (i, th) => { const y = 0.8 + 0.2 * (i / 9); return { p: torsoRing(S, y, th, loose + 0.003), w: torsoW(y) }; });   // waistband region
    if (bottom === 'skirt') {
      g.loft(20, 48, (i, th) => { const t = i / 19, y = 0.82 - t * 0.33, p = torsoRing(S, 0.86, th, 0.015 + t * 0.09); p.y = y; const sx = Math.cos(th);
        return { p, w: [[B.hips, 1 - 0.5 * t], [B.hiL, sx > 0 ? 0.5 * t * sx : 0], [B.hiR, sx < 0 ? -0.5 * t * sx : 0]] }; }, undefined, true);
    } else {
      const end = bottom === 'shorts' ? 0.38 : 0.985;
      for (const side of [1, -1]) {
        const hi = side > 0 ? B.hiL : B.hiR, kn = side > 0 ? B.knL : B.knR, an = side > 0 ? B.anL : B.anR;
        g.loft(34, 30, (i, th) => { const t = (i / 33) * end, r = (legR(t, S) + loose + (bottom === 'shorts' ? 0.012 * t : 0.004 + 0.013 * smooth(0.6, 1, t))) * (0.86 + 0.14 * smooth(0.0, 0.22, t));
          return { p: legPoint(S, side, t, th, r), w: legW(t, hi, kn, an) }; }, undefined, true);
      }
    }
    this.addMesh(g.geometry(), mat);
  }

  private addGlasses(faceZ: (y: number, x?: number) => number) {
    const frame = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.35, metalness: 0.3 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.16 });
    for (const side of [1, -1]) {
      const z = faceZ(1.613, 0.032) + 0.009;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0172, 0.0016, 6, 28), frame); rim.scale.set(1.18, 0.82, 1); rim.position.set(side * 0.0325, 1.613 - J.head, z);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0172, 24), glass); lens.scale.copy(rim.scale); lens.position.copy(rim.position);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.003, 0.092), frame); arm.position.set(side * 0.074, 1.618 - J.head, z - 0.047);
      this.head.add(rim, lens, arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.0022, 0.0022), frame); bridge.position.set(0, 1.62 - J.head, faceZ(1.62) + 0.009); this.head.add(bridge);
  }

  private addHat(kind: 'cap' | 'beanie' | 'sunhat', mat: THREE.Material) {
    const lo = kind === 'beanie' ? (th: number) => 1.63 + 0.03 * smooth(0.5, 1, Math.sin(th)) - 0.03 * smooth(0, -0.9, Math.sin(th)) : () => 1.655;
    this.addMesh(this.headShell(lo, () => 1.73, (y) => (kind === 'beanie' ? 0.016 : 0.012) + 0.004 * smooth(1.7, 1.73, y)), mat);
    if (kind === 'cap') { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.005, 28, 1, false, -Math.PI / 2 - 0.9, 1.8).scale(1, 1, 1.15), mat); v.position.set(0, 1.656 - J.head, headRing(this.S, 1.655, Math.PI / 2).z - 0.035); v.rotation.x = 0.12; this.head.add(v); }
    if (kind === 'sunhat') { const brim = new THREE.Mesh(new THREE.RingGeometry(0.088, 0.19, 48).rotateX(-Math.PI / 2), mat); (brim.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; brim.position.set(0, 1.656 - J.head, -0.004); this.head.add(brim); }
  }

  /** Same joint semantics as humanoid-figure-v1 (see HumanoidPose). */
  setPose(p: HumanoidPose) {
    const b = this.bones;
    b[B.hips].position.y = p.hipsY;
    b[B.spine].rotation.set(p.lean * 0.55, p.twist * 0.5, p.sideLean * 0.5);
    b[B.chest].rotation.set(p.lean * 0.45, p.twist * 0.5, p.sideLean * 0.5);
    b[B.chest].scale.set(1 + p.breath * 0.022, 1 + p.breath * 0.006, 1 + p.breath * 0.045);
    b[B.neck].rotation.set(p.headPitch * 0.35, p.headYaw * 0.35, 0);
    b[B.head].rotation.set(p.headPitch * 0.65, p.headYaw * 0.65, 0, 'YXZ');
    const arms = [p.armL, p.armR];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1, [pitch, roll, flex] = arms[i], sh = b[i === 0 ? B.shL : B.shR], el = b[i === 0 ? B.elL : B.elR];
      sh.position.y = J.shY - J.chest + p.shrug * 0.03;
      sh.rotation.set(pitch, 0, side * roll, 'ZXY');
      el.rotation.set(-flex, 0, 0);
    }
    const legs = [p.legL, p.legR];
    for (let i = 0; i < 2; i++) {
      b[i === 0 ? B.hiL : B.hiR].rotation.x = -legs[i][0]; b[i === 0 ? B.knL : B.knR].rotation.x = legs[i][1];
      b[i === 0 ? B.anL : B.anR].rotation.x = -(legs[i][1] - legs[i][0]) * 0.4;   // keep the feet roughly level
    }
    this.root.updateMatrixWorld(true);
  }

  /** A seeded, varied everyday person (skin tone, sex, build, hair, outfit, colours, accessories). */
  static random(seed: number, extra: Partial<HumanV2Options> = {}): HumanV2Options {
    const r = rng(seed * 7919 + 13), pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length) % a.length];
    const sex = r() < 0.5 ? 'female' : 'male', age = r() < 0.12 ? 'elder' : 'adult';
    const SKIN = [0x4e3324, 0x6a432d, 0x87573a, 0xa46e4c, 0xb98260, 0xc99572, 0xd8a886, 0xe7bfa0, 0xf0cfb6, 0x7b4e33];
    const HAIR = age === 'elder' ? [0xc9c4bc, 0xa7a29a, 0xe2ded7] : [0x1b1411, 0x2a1d15, 0x3d2a1c, 0x5a3c25, 0x8a5f3a, 0xb58a52, 0xd6b47a, 0x161616];
    const styles: HairStyle[] = sex === 'female' ? ['long', 'bob', 'ponytail', 'bun', 'curly', 'afro', 'headscarf', 'short'] : ['short', 'side-part', 'buzz', 'curly', 'bald', 'afro', 'short'];
    const TOPS: Top[] = sex === 'female' ? ['tshirt', 'blouse', 'longsleeve', 'jacket', 'dress', 'hoodie', 'coat'] : ['tshirt', 'shirt', 'longsleeve', 'jacket', 'hoodie', 'coat'];
    const top = pick(TOPS), CL = [0x2f4f6f, 0xb04a3c, 0xe2c26a, 0x3f6e4f, 0xd7d2c8, 0x23283a, 0x7b4b8f, 0xd9895b, 0x5c88b6, 0xf2efe9, 0x8c3a46, 0x37605f];
    return {
      sex, age, build: pick(['slim', 'average', 'average', 'athletic', 'heavy'] as const), skin: pick(SKIN), eyes: pick([0x3b2a1f, 0x2b1d14, 0x4a5d3a, 0x3a5a7a, 0x5a3e2a]),
      hair: { style: pick(styles), color: pick(HAIR) }, top, topColor: pick(CL), bottom: top === 'dress' ? 'none' : pick(sex === 'female' ? ['jeans', 'trousers', 'skirt', 'jeans'] as const : ['jeans', 'trousers', 'jeans', 'shorts'] as const),
      bottomColor: pick([0x2c3a52, 0x1d2129, 0x4a4136, 0x6b6250, 0x30475e, 0x8a7a63]), shoes: pick(['sneakers', 'sneakers', 'boots', 'dress'] as const), shoeColor: pick([0xeeeae2, 0x2a2420, 0x5a3a26, 0x3a4250]),
      glasses: r() < 0.22, beard: sex === 'male' && r() < 0.3, hat: r() < 0.1 ? pick(['cap', 'beanie'] as const) : null, hatColor: pick(CL),
      height: (sex === 'female' ? 1.6 : 1.72) + (r() - 0.5) * 0.14, seed, ...extra,
    };
  }
}

const armW = (t: number, sh: number, el: number, ha: number): W => {
  const w: W = [[sh, 1 - smooth(0.52, 0.66, t)], [el, smooth(0.52, 0.66, t) * (1 - smooth(0.93, 1, t))], [ha, smooth(0.93, 1, t)]];
  if (t < 0.12) { const k = 0.35 * (1 - t / 0.12); w[0][1] *= 1 - k; w.push([B.chest, k]); }
  return w;
};
const legW = (t: number, hi: number, kn: number, an: number): W => {
  const w: W = [[hi, 1 - smooth(0.44, 0.56, t)], [kn, smooth(0.44, 0.56, t) * (1 - smooth(0.95, 1, t))], [an, smooth(0.95, 1, t)]];
  if (t < 0.14) { const k = 0.5 * (1 - t / 0.14); w[0][1] *= 1 - k; w.push([B.hips, k]); }
  return w;
};
function legPoint(S: Shape, side: number, t: number, th: number, r: number) {
  const p0 = new THREE.Vector3(side * (J.hipX + 0.005), 0.96, -0.004), p1 = new THREE.Vector3(side * J.hipX, J.anY + 0.012, 0);
  const p = limbPoint(p0, p1, t, th, r, r * 1.05);
  p.x -= side * 0.012 * Math.sin(Math.PI * Math.min(1, t * 1.4));                               // gentle inward thigh line
  p.z -= 0.012 * Math.exp(-(((t - 0.62) / 0.12) ** 2)) * smooth(0, -0.8, Math.sin(th));          // calf
  void S; return p;
}
/** Palm and four fingers plus thumb, relaxed and slightly curled toward the palm (which faces the thigh at rest). */
function hand(b: Builder, side: number, wrist: THREE.Vector3, bone: number, c: number[], S: Shape) {
  const k = S.k * (S.f ? 0.93 : 1);
  b.loft(10, 18, (i, th) => { const t = i / 9, [x, z] = sup(th, 0.0125 * k, (0.036 + 0.006 * Math.sin(Math.PI * t)) * k, 2.4); return { p: new THREE.Vector3(wrist.x + side * 0.002 + x, wrist.y + 0.012 - t * 0.09 * k, wrist.z + z), w: [[bone, 1]], c }; }, undefined, true);
  for (const [fz, len] of [[-0.022, 0.068], [-0.0075, 0.079], [0.0075, 0.076], [0.022, 0.063]]) b.loft(9, 10, (i, th) => { const t = i / 8, curl = t * 0.38, r = (0.0085 - 0.0022 * t) * k * (len < 0.066 ? 0.9 : 1), [x, z] = sup(th, r, r, 2);
    return { p: new THREE.Vector3(wrist.x + side * (0.003 - Math.sin(curl) * 0.022 * t) + x, wrist.y - 0.076 * k - t * len * k * Math.cos(curl), wrist.z + fz * k + z), w: [[bone, 1]], c }; }, undefined, true);
  b.loft(9, 10, (i, th) => { const t = i / 8, r = (0.0098 - 0.002 * t) * k, [x, z] = sup(th, r, r, 2);
    return { p: new THREE.Vector3(wrist.x - side * (0.004 + t * 0.012) + x, wrist.y - 0.028 * k - t * 0.045 * k, wrist.z + 0.03 * k + t * 0.012 + z), w: [[bone, 1]], c }; }, undefined, true);
}
/** Foot (or shoe when inflated): heel to toes along +Z on a flat sole; `collar` raises a boot shaft over the ankle. */
function foot(b: Builder, side: number, bone: number, inflate: number, c: number[], collar = 0, keep?: (t: number, th: number) => boolean) {
  const x0 = side * J.hipX, R = keep ? 40 : 18;
  b.loft(R, 24, (i, th) => { const t = i / (R - 1), z = -0.05 + t * 0.25, h = prof([[0, 0.07], [0.25, 0.082], [0.5, 0.06], [0.75, 0.04], [0.92, 0.03], [1, 0.012]], t) + inflate * 1.4 + collar * (1 - smooth(0, 0.35, t));
    const w = prof([[0, 0.028], [0.2, 0.034], [0.6, 0.044], [0.85, 0.042], [1, 0.02]], t) + inflate, [x, y] = sup(th, w, h * 0.5, 2.6);
    return { p: new THREE.Vector3(x0 + x + side * 0.006 * t, Math.max(0.002, h * 0.5 + y + 0.004), z), w: [[bone, 1]], c }; }, keep ? (i, th) => keep(i / (R - 1), th) : undefined, true);
}
/** Five toes at the front of a bare foot (big toe on the inside). */
function toes(b: Builder, side: number, bone: number, c: number[]) {
  const x0 = side * J.hipX + side * 0.006;
  for (let k = 0; k < 5; k++) {
    const r = [0.0118, 0.0088, 0.0082, 0.0076, 0.0068][k], u = (k - 1.6) / 3.6, x = x0 - side * (0.031 - k * 0.0158), z = 0.191 - Math.abs(u) * 0.026 - (k === 0 ? 0 : 0.004), len = r * 1.9;
    b.loft(8, 12, (i, th) => { const t = i / 7, rr = r * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.94)) + 0.0006, [u2, v2] = sup(th, rr, rr * 0.82, 2);
      return { p: new THREE.Vector3(x + u2, 0.004 + rr * 0.82 + v2, z - len * 0.35 + t * len), w: [[bone, 1]], c }; }, undefined, true);
  }
}
function soleLoft(b: Builder, side: number, bone: number) {
  const x0 = side * J.hipX, R = 16;
  b.loft(R, 24, (i, th) => { const t = i / (R - 1), z = -0.056 + t * 0.262, w = prof([[0, 0.034], [0.2, 0.042], [0.6, 0.052], [0.85, 0.05], [1, 0.024]], t), [x, y] = sup(th, w, 0.008, 3);
    return { p: new THREE.Vector3(x0 + x + side * 0.006 * t, 0.008 + y, z), w: [[bone, 1]] }; }, undefined, true);
}
let _strands: THREE.Texture | undefined;
/** Shared tileable normal map of fine hair strands. */
function strandNormals() {
  if (_strands) return _strands;
  const W = 256, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!, img = g.createImageData(W, H), r = rng(91);
  const h = new Float32Array(W); for (let x = 0; x < W; x++) h[x] = r();
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { const dx = (h[(x + 1) % W] - h[(x + W - 1) % W]) * 0.9, j = (y * W + x) * 4, l = Math.hypot(dx, 1);
    img.data[j] = Math.round((-dx / l * 0.5 + 0.5) * 255); img.data[j + 1] = 128; img.data[j + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); img.data[j + 3] = 255; }
  g.putImageData(img, 0, 0);
  _strands = new THREE.CanvasTexture(c); _strands.wrapS = _strands.wrapT = THREE.RepeatWrapping; _strands.repeat.set(10, 3); _strands.colorSpace = THREE.NoColorSpace;
  return _strands;
}

// ---- pose helpers (pure functions of time/phase)
/** Natural walk cycle: phase in radians (2π per stride pair); amplitude 0..1. */
export function walkPose(phase: number, amp = 1, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const s = Math.sin(phase), c = Math.cos(phase), swing = 0.36 * amp;
  const knee = (ph: number) => 0.08 + amp * (0.55 * Math.max(0, Math.sin(ph + 1.2)) ** 1.5 + 0.08 * Math.max(0, -Math.sin(ph)));
  return { ...base, hipsY: base.hipsY - 0.012 * amp * Math.cos(2 * phase) - 0.006 * amp, lean: base.lean + 0.04 * amp, twist: 0.07 * amp * s, sideLean: 0.015 * amp * c,
    legL: [swing * s, knee(phase)], legR: [-swing * s, knee(phase + Math.PI)],
    armL: [0.3 * amp * s * -1 + 0.02, 0.08, 0.18 + 0.1 * amp * Math.max(0, -s)], armR: [0.3 * amp * s + 0.02, 0.08, 0.18 + 0.1 * amp * Math.max(0, s)], headPitch: base.headPitch, breath: 0.1 };
}
/** Subtle standing idle (breathing, weight shift, glances) from absolute time and a per-person seed. */
export function idlePose(t: number, seed = 0, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const w = (f: number, ph: number) => Math.sin(t * f + seed * 1.7 + ph);
  return { ...base, breath: 0.35 * w(1.3, 0), sideLean: 0.015 * w(0.31, 1), twist: 0.03 * w(0.23, 2), headYaw: base.headYaw + 0.18 * w(0.17, 3) * w(0.07, 4), headPitch: base.headPitch + 0.04 * w(0.21, 5),
    armL: [base.armL[0] + 0.02 * w(0.4, 6), base.armL[1], base.armL[2]], armR: [base.armR[0] + 0.02 * w(0.37, 7), base.armR[1], base.armR[2]] };
}
