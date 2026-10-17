import * as THREE from 'three';
import { rng, clamp, smoothstep, vnoise2 } from '../util/math';
import { loftGeometry, limbGeometry, paintVertices, spotField } from '../util/Loft';

/**
 * quadruped-v1 — one parametric four-legged animal generator with species presets (dogs, cat, horse, zebra, deer,
 * elephant, wolf, fox, bear, sheep, pig, lion, giraffe). Metres, facing +Z, feet on y = 0. Lofted torso, neck and head
 * with soft fur sheen and painted coats (belly shading, saddles, spots, stripes, giraffe patches, dark points),
 * three-segment legs with hooves or paws, and species parts (manes, antlers, ossicones, trunk, tusks, wool, snout).
 * `pose(t, { gait })` drives idle breathing, walk, trot and gallop gaits (correct footfall orders), head look/graze,
 * tail and ears as a pure function of time; `speed(gait)` gives the matching ground speed for moving the root.
 */
export type Species = 'dog' | 'shepherd' | 'dalmatian' | 'terrier' | 'cat' | 'horse' | 'zebra' | 'deer' | 'elephant' | 'wolf' | 'fox' | 'bear' | 'sheep' | 'pig' | 'lion' | 'giraffe';
export type Gait = 'idle' | 'walk' | 'trot' | 'gallop';
type Ear = 'pointy' | 'floppy' | 'round' | 'elephant' | 'horse' | 'sheep';
type Tail = 'thin' | 'bushy' | 'tuft' | 'stub' | 'curly' | 'horse';
type Pattern = 'none' | 'spots' | 'stripes' | 'saddle' | 'patches' | 'tabby';

interface Spec {
  withers: number; body: number; girth: number; width: number; rump: number; waist: number; backSlope?: number;
  neck: number; neckRise: number; neckGirth: number;
  head: number; headGirth: number; muzzle: number; muzzleGirth: number; headDrop: number;
  leg: number; columnar?: boolean;
  ear: Ear; earSize: number; tail: Tail; tailLen: number;
  coat: number; belly: number; accent: number; pattern: Pattern; patternScale?: number;
  /** Dark lower legs, ears, muzzle and tail tip (bay horses, foxes, sheep faces). */
  points?: boolean; tailTip?: number;
  hooves?: boolean; antlers?: boolean; ossicones?: boolean; trunk?: boolean; tusks?: boolean; mane?: 'horse' | 'lion' | 'short'; wool?: boolean; snout?: boolean;
  sheen: number; roughness: number;
}
const DOG: Spec = { withers: 0.57, body: 0.5, girth: 0.16, width: 0.78, rump: 0.88, waist: 0.78, neck: 0.22, neckRise: 0.8, neckGirth: 0.55, head: 0.25, headGirth: 0.085, muzzle: 0.45, muzzleGirth: 0.58, headDrop: 0.25,
  leg: 0.27, ear: 'floppy', earSize: 0.1, tail: 'thin', tailLen: 0.4, coat: 0xc79c5e, belly: 0xdcc39a, accent: 0x2a2018, pattern: 'none', sheen: 0.7, roughness: 0.8 };
export const SPECIES: Record<Species, Spec> = {
  dog: DOG,
  shepherd: { ...DOG, withers: 0.62, body: 0.56, girth: 0.17, width: 0.72, ear: 'pointy', earSize: 0.12, tail: 'bushy', tailLen: 0.44, coat: 0xa86f35, belly: 0xc99d63, accent: 0x1d1813, pattern: 'saddle' },
  dalmatian: { ...DOG, withers: 0.58, coat: 0xeeeae2, belly: 0xf2efe9, accent: 0x15130f, pattern: 'spots', patternScale: 22, girth: 0.15 },
  terrier: { ...DOG, withers: 0.3, body: 0.3, girth: 0.1, neck: 0.12, head: 0.15, headGirth: 0.06, muzzle: 0.4, ear: 'pointy', earSize: 0.055, tail: 'stub', tailLen: 0.12, coat: 0xe2dacd, belly: 0xece6dc, accent: 0x9b6a3c, pattern: 'saddle' },
  cat: { ...DOG, withers: 0.25, body: 0.27, girth: 0.085, width: 0.8, rump: 0.95, waist: 0.82, neck: 0.1, neckRise: 0.7, head: 0.11, headGirth: 0.055, muzzle: 0.28, muzzleGirth: 0.7, headDrop: 0.05, leg: 0.26,
    ear: 'pointy', earSize: 0.045, tail: 'thin', tailLen: 0.3, coat: 0x8d7c69, belly: 0xc8baa6, accent: 0x3b3129, pattern: 'tabby', patternScale: 30, sheen: 0.8 },
  horse: { withers: 1.6, body: 1.0, girth: 0.37, width: 0.74, rump: 1.0, waist: 0.86, neck: 0.78, neckRise: 0.9, neckGirth: 0.52, head: 0.58, headGirth: 0.13, muzzle: 0.55, muzzleGirth: 0.72, headDrop: 1.05,
    leg: 0.19, ear: 'horse', earSize: 0.14, tail: 'horse', tailLen: 0.75, mane: 'horse', hooves: true, coat: 0x6e4327, belly: 0x6e4327, accent: 0x17100b, pattern: 'none', points: true, sheen: 0.45, roughness: 0.6 },
  zebra: { withers: 1.35, body: 0.86, girth: 0.33, width: 0.76, rump: 1.0, waist: 0.88, neck: 0.62, neckRise: 0.85, neckGirth: 0.55, head: 0.5, headGirth: 0.12, muzzle: 0.5, muzzleGirth: 0.72, headDrop: 1.0,
    leg: 0.2, ear: 'horse', earSize: 0.16, tail: 'tuft', tailLen: 0.55, mane: 'short', hooves: true, coat: 0xf1ede5, belly: 0xf1ede5, accent: 0x111111, pattern: 'stripes', patternScale: 13, sheen: 0.35, roughness: 0.65 },
  deer: { withers: 1.0, body: 0.72, girth: 0.24, width: 0.7, rump: 0.95, waist: 0.82, neck: 0.42, neckRise: 1.0, neckGirth: 0.5, head: 0.3, headGirth: 0.085, muzzle: 0.5, muzzleGirth: 0.6, headDrop: 0.45,
    leg: 0.17, ear: 'pointy', earSize: 0.15, tail: 'stub', tailLen: 0.12, antlers: true, hooves: true, coat: 0x9c6b40, belly: 0xe8dfcf, accent: 0x3a2a1c, pattern: 'none', tailTip: 0xf4f0e8, sheen: 0.5, roughness: 0.75 },
  elephant: { withers: 2.8, body: 1.5, girth: 0.85, width: 0.82, rump: 0.96, waist: 0.97, neck: 0.3, neckRise: 0.35, neckGirth: 0.78, head: 0.75, headGirth: 0.48, muzzle: 0.22, muzzleGirth: 0.6, headDrop: 0.35,
    leg: 0.33, columnar: true, ear: 'elephant', earSize: 0.95, tail: 'tuft', tailLen: 0.95, trunk: true, tusks: true, coat: 0x7f7872, belly: 0x77706a, accent: 0x5f5853, pattern: 'none', sheen: 0, roughness: 0.92 },
  wolf: { ...DOG, withers: 0.78, body: 0.66, girth: 0.19, width: 0.66, rump: 0.85, ear: 'pointy', earSize: 0.11, tail: 'bushy', tailLen: 0.48, coat: 0x8c8781, belly: 0xd2cdc4, accent: 0x45413d, pattern: 'saddle', muzzle: 0.5 },
  fox: { ...DOG, withers: 0.38, body: 0.42, girth: 0.11, width: 0.72, neck: 0.15, head: 0.17, headGirth: 0.06, muzzle: 0.52, muzzleGirth: 0.5, ear: 'pointy', earSize: 0.085, tail: 'bushy', tailLen: 0.42,
    coat: 0xc5612a, belly: 0xf1e9dd, accent: 0x1b1612, points: true, tailTip: 0xf4efe6, pattern: 'none' },
  bear: { withers: 1.0, body: 0.9, girth: 0.4, width: 0.86, rump: 1.05, waist: 0.95, neck: 0.25, neckRise: 0.2, neckGirth: 0.8, head: 0.36, headGirth: 0.17, muzzle: 0.42, muzzleGirth: 0.55, headDrop: 0.2,
    leg: 0.36, columnar: true, ear: 'round', earSize: 0.07, tail: 'stub', tailLen: 0.08, coat: 0x5b3b23, belly: 0x4d3220, accent: 0x2a1c12, pattern: 'none', sheen: 0.8, roughness: 0.9 },
  sheep: { withers: 0.72, body: 0.62, girth: 0.25, width: 0.86, rump: 1.0, waist: 0.98, neck: 0.2, neckRise: 0.6, neckGirth: 0.6, head: 0.26, headGirth: 0.075, muzzle: 0.5, muzzleGirth: 0.65, headDrop: 0.55,
    leg: 0.14, ear: 'sheep', earSize: 0.08, tail: 'stub', tailLen: 0.1, wool: true, hooves: true, coat: 0xece6d8, belly: 0xe2dccd, accent: 0x2a2420, points: true, pattern: 'none', sheen: 0.9, roughness: 0.95 },
  pig: { withers: 0.6, body: 0.7, girth: 0.26, width: 0.88, rump: 1.0, waist: 1.0, neck: 0.1, neckRise: 0.15, neckGirth: 0.9, head: 0.3, headGirth: 0.14, muzzle: 0.48, muzzleGirth: 0.5, headDrop: 0.15,
    leg: 0.16, ear: 'floppy', earSize: 0.1, tail: 'curly', tailLen: 0.15, snout: true, hooves: true, coat: 0xe7b2a5, belly: 0xedc0b3, accent: 0xc98a7c, pattern: 'none', sheen: 0.2, roughness: 0.6 },
  lion: { withers: 1.05, body: 0.9, girth: 0.3, width: 0.74, rump: 0.92, waist: 0.8, neck: 0.32, neckRise: 0.55, neckGirth: 0.62, head: 0.4, headGirth: 0.15, muzzle: 0.4, muzzleGirth: 0.62, headDrop: 0.15,
    leg: 0.26, ear: 'round', earSize: 0.06, tail: 'tuft', tailLen: 0.85, mane: 'lion', coat: 0xc29b5c, belly: 0xd8bc8c, accent: 0x5e3b20, pattern: 'none', sheen: 0.6, roughness: 0.8 },
  giraffe: { withers: 3.1, body: 1.1, girth: 0.44, width: 0.68, rump: 0.86, waist: 0.86, backSlope: 0.45, neck: 1.95, neckRise: 1.12, neckGirth: 0.42, head: 0.55, headGirth: 0.12, muzzle: 0.55, muzzleGirth: 0.65, headDrop: 0.95,
    leg: 0.17, ear: 'pointy', earSize: 0.15, tail: 'tuft', tailLen: 0.9, ossicones: true, hooves: true, mane: 'short', coat: 0xf0dfbd, belly: 0xf1e6cf, accent: 0x8b4a21, pattern: 'patches', patternScale: 2.6, sheen: 0.3, roughness: 0.75 },
};
export const SPECIES_LIST = Object.keys(SPECIES) as Species[];

export interface QuadrupedOptions {
  species: Species; seed?: number; scale?: number;
  /** Override the coat (and optionally belly/accent) colours. */
  coat?: THREE.ColorRepresentation; belly?: THREE.ColorRepresentation; accent?: THREE.ColorRepresentation;
  /** Deer: antlers on (stag) or off (doe); defaults to the preset. */
  antlers?: boolean;
}
export interface QuadrupedPose {
  gait?: Gait;
  /** Head turn (rad, + = toward +X) and nod (rad, + = down); graze 0..1 lowers the head to the ground. */
  headYaw?: number; headPitch?: number; graze?: number;
  /** Tail wag amount 0..1 (dogs) and ear flick amount 0..1. */
  tailWag?: number; earFlick?: number;
  /** Gait phase offset in cycles (de-synchronise a herd). */
  phase?: number;
}

const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
/** Worley-style network: 1 inside a patch, 0 on the separating lines (giraffe reticulation). */
function patches(x: number, y: number, scale: number, seed: number) {
  const px = x * scale, py = y * scale, ix = Math.floor(px), iy = Math.floor(py);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, h = vnoise2(cx * 7.13 + 0.5, cy * 3.71 + 0.5, seed), k = vnoise2(cx * 2.31 + 0.5, cy * 9.17 + 0.5, seed + 3);
    const d = Math.hypot(cx + 0.15 + 0.7 * h - px, cy + 0.15 + 0.7 * k - py);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return smoothstep(0.06, 0.13, f2 - f1);
}

interface Leg { root: THREE.Group; j: THREE.Group[]; rest: number[]; front: boolean; side: number; offset: number; len: number }

export class Quadruped {
  readonly root = new THREE.Group();
  readonly spec: Spec; readonly species: Species;
  private torso = new THREE.Group(); private neck = new THREE.Group(); private head = new THREE.Group();
  private tailJ: THREE.Group[] = []; private trunkJ: THREE.Group[] = []; private ears: THREE.Group[] = [];
  private legs: Leg[] = [];
  private bodyY: number; private torsoMesh!: THREE.Mesh; private tailBase = 1.5; private tailCurl = 0;
  readonly height: number;

  constructor(o: QuadrupedOptions) {
    this.species = o.species;
    const sp = this.spec = { ...SPECIES[o.species] }, r = rng(o.seed ?? 5), seed = (o.seed ?? 5) * 13 + 1;
    if (o.antlers !== undefined) sp.antlers = o.antlers;
    // Small per-individual variation keeps herds from looking cloned.
    const vary = (v: number, a = 0.05) => v * (1 + (r() * 2 - 1) * a);
    sp.withers = vary(sp.withers, 0.04); sp.girth = vary(sp.girth); sp.body = vary(sp.body, 0.04); sp.head = vary(sp.head, 0.03);
    const coat = new THREE.Color(o.coat ?? sp.coat).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.06, (r() - 0.5) * 0.05);
    const belly = new THREE.Color(o.belly ?? sp.belly), accent = new THREE.Color(o.accent ?? sp.accent);
    const g = sp.girth, H = sp.withers, s = o.scale ?? 1;
    this.root.scale.setScalar(s); this.height = H * s;
    this.root.add(this.torso);

    const fur = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: sp.roughness, sheen: sp.sheen, sheenRoughness: 0.75, sheenColor: coat.clone().lerp(new THREE.Color(0xffffff), 0.35) });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.55 });
    const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x0b0806, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
    const ivory = new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.45 });
    const horn = new THREE.MeshStandardMaterial({ color: 0x8c7356, roughness: 0.7 });
    const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

    // Coat painter shared by torso and neck (torso space), so spots, stripes and patches run continuously.
    const ps = sp.patternScale ?? 10;
    const paintCoat = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color, part: 'torso' | 'neck' | 'head' | 'leg' | 'tail', legU = 0) => {
      out.copy(coat).multiplyScalar(0.94 + 0.12 * vnoise2(p.x * 37 + p.z * 23, p.y * 41, seed + 11));
      if (part !== 'leg' && part !== 'tail') out.lerp(belly, smoothstep(-0.3, -0.75, n.y));
      if (sp.pattern === 'saddle' && part === 'torso') out.lerp(accent, smoothstep(0.25, 0.65, n.y) * smoothstep(-sp.body * 0.6, -sp.body * 0.1, p.z) * 0.92);
      if (sp.pattern === 'saddle' && (part === 'head' || part === 'neck')) out.lerp(accent, smoothstep(0.55, 0.9, n.y) * 0.5);
      if (sp.pattern === 'spots') out.lerp(accent, spotField(p.z + p.x * 0.6, p.y + p.x * 0.4, ps, 0.24, seed));
      if (sp.pattern === 'tabby') { const w = Math.sin((p.z * 1.0 - Math.abs(p.x) * 0.3) * ps * 1.2 + vnoise2(p.y * 9, p.z * 9, seed) * 2.5); out.lerp(accent, smoothstep(0.35, 0.8, w) * (0.35 + 0.6 * smoothstep(-0.2, 0.6, n.y))); }
      if (sp.pattern === 'stripes') { const warp = vnoise2(p.y * 4, p.z * 4, seed) * 1.6, ang = part === 'leg' ? p.y * 1.6 : p.z + 0.35 * p.y * (part === 'neck' ? 0 : 1);
        out.lerp(accent, smoothstep(0.1, 0.35, Math.sin((part === 'neck' || part === 'head' ? p.y * 1.3 + p.z * 0.4 : ang) * ps + warp)) * (part === 'leg' ? 0.9 : 1)); }
      if (sp.pattern === 'patches' && part !== 'head') out.lerp(accent, patches(p.z + p.x * 0.5, p.y + p.x * 0.3, ps * (part === 'leg' ? 1.8 : 1), seed) * (part === 'leg' ? smoothstep(0.9, 0.45, legU) : 1) * 0.95);
      if (sp.points && part === 'leg') out.lerp(accent, smoothstep(0.45, 0.7, legU));
    };

    // ---- torso (spine along Z: rump at −Z, chest at +Z)
    const zh = -sp.body / 2, zs = sp.body / 2, yc = H - g * 0.95, slope = sp.backSlope ?? 0;
    this.bodyY = 0;
    const spine = [new THREE.Vector3(0, yc - slope * 0.5 - g * 0.05, zh - g * sp.rump * 0.95), new THREE.Vector3(0, yc - slope * 0.5, zh), new THREE.Vector3(0, yc - slope * 0.05 - g * 0.04, 0), new THREE.Vector3(0, yc + slope * 0.5, zs), new THREE.Vector3(0, yc + slope * 0.5 - g * 0.12, zs + g * 0.88)];
    const ry = [g * 0.22, g * sp.rump * 0.86, g * sp.rump, g * sp.waist, g * 0.98, g, g * 0.8, g * 0.18];
    const rx = ry.map((v, i) => v * sp.width * (i === 2 || i === 5 ? 1.04 : 1));
    const woolBump = sp.wool ? (_u: number, a: number, p: THREE.Vector3) => 0.035 * (vnoise2(p.z * 14 + a * 3, p.y * 14, seed) * 0.8 + vnoise2(p.z * 30, a * 6, seed + 1) * 0.4 - 0.4) : undefined;
    const tg = loftGeometry(spine, rx, ry, { radial: 28, segments: 40, displace: woolBump });
    paintVertices(tg, (p, n, c) => paintCoat(p, n, c, 'torso'));
    this.torsoMesh = mesh(this.torso, tg, fur);

    // ---- neck and head (neck group pivots at the chest; head group at the neck tip)
    const neckBase = new THREE.Vector3(0, yc + slope * 0.5 + g * 0.3, zs + g * 0.45);
    this.neck.position.copy(neckBase); this.torso.add(this.neck);
    const nd = new THREE.Vector3(0, Math.sin(sp.neckRise), Math.cos(sp.neckRise));
    const nTip = nd.clone().multiplyScalar(sp.neck);
    const hFwd = new THREE.Vector3(0, -Math.sin(sp.headDrop), Math.cos(sp.headDrop));
    const nGeo = loftGeometry([new THREE.Vector3(0, -g * 0.35, -g * 0.25), new THREE.Vector3(0, 0, 0), nTip.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 0, g * 0.04)), nTip.clone(), nTip.clone().addScaledVector(hFwd, sp.head * 0.12)],
      [g * sp.neckGirth * 0.95, g * sp.neckGirth * 0.92, g * sp.neckGirth * 0.72, sp.headGirth * 0.95, sp.headGirth * 0.8, sp.headGirth * 0.6].map((v) => v * sp.width * 1.05),
      [g * sp.neckGirth * 1.1, g * sp.neckGirth, g * sp.neckGirth * 0.78, sp.headGirth * 1.05, sp.headGirth * 0.85, sp.headGirth * 0.65], { radial: 28, segments: 26, caps: true, displace: woolBump });
    paintVertices(nGeo, (p, n, c) => { const q = p.clone().add(neckBase); paintCoat(q, n, c, 'neck'); if (sp.wool) c.lerp(coat, 1); });
    mesh(this.neck, nGeo, fur);
    this.head.position.copy(nTip); this.neck.add(this.head);
    const hg = sp.headGirth, hl = sp.head, drop = sp.headDrop;
    const fwd = new THREE.Vector3(0, -Math.sin(drop), Math.cos(drop)), upH = new THREE.Vector3(0, Math.cos(drop), Math.sin(drop));
    const at = (f: number, u = 0) => fwd.clone().multiplyScalar(f * hl).addScaledVector(upH, u * hg);
    const skull = loftGeometry([at(-0.18, 0.1), at(0.05, 0.12), at(0.38, 0.04), at(0.7, -0.08), at(1.0, -0.12)],
      [hg * 0.72, hg * 1.0, hg * 1.0, hg * 0.85, hg * sp.muzzleGirth, hg * sp.muzzleGirth * 0.9, hg * 0.25].map((v) => v * (this.species === 'elephant' ? 1.0 : 0.92)),
      [hg * 0.78, hg * 1.06, hg * 1.0, hg * 0.8, hg * sp.muzzleGirth * 1.05, hg * sp.muzzleGirth * 0.95, hg * 0.25], { radial: 28, segments: 30, up: upH });
    paintVertices(skull, (p, n, c) => { paintCoat(p, n, c, 'head'); if (sp.points || sp.wool) c.lerp(accent, sp.wool ? 0.92 : smoothstep(0.55, 0.95, p.dot(fwd) / hl) * 0.8); });
    mesh(this.head, skull, fur);
    // Nose, eyes.
    const noseP = at(1.0, -0.1), eyeR = hg * (this.species === 'elephant' ? 0.07 : 0.14);
    if (sp.snout) { const disc = mesh(this.head, new THREE.CylinderGeometry(hg * 0.42, hg * 0.46, hg * 0.22, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd99486, roughness: 0.5 })); disc.position.copy(at(1.02, -0.12)); disc.lookAt(disc.position.clone().add(fwd)); disc.rotateX(Math.PI / 2);
      for (const x of [-1, 1]) { const n = mesh(this.head, new THREE.SphereGeometry(hg * 0.08, 8, 6), dark); n.position.copy(at(1.07, -0.12)).add(new THREE.Vector3(x * hg * 0.15, 0, 0)); } }
    else if (!sp.trunk) { const nose = mesh(this.head, new THREE.SphereGeometry(hg * 0.24, 14, 10).scale(1.15, 0.8, 0.9), this.species === 'horse' || this.species === 'zebra' || this.species === 'deer' || this.species === 'sheep' ? new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.5 }) : dark); nose.position.copy(noseP).addScaledVector(fwd, -hg * 0.08); }
    for (const x of [-1, 1]) {
      const e = mesh(this.head, new THREE.SphereGeometry(eyeR, 14, 10), eyeM);
      e.position.copy(at(0.3, 0.42)).add(new THREE.Vector3(x * hg * (this.species === 'cat' ? 0.62 : 0.78), 0, 0));
    }
    // Ears.
    const earBase = at(0.02, 0.85);
    for (const x of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.copy(earBase).add(new THREE.Vector3(x * hg * (sp.ear === 'elephant' ? 0.9 : 0.55), 0, 0)); this.head.add(ear); this.ears.push(ear);
      const es = sp.earSize;
      let geo: THREE.BufferGeometry;
      if (sp.ear === 'pointy' || sp.ear === 'horse') geo = new THREE.ConeGeometry(es * (sp.ear === 'horse' ? 0.3 : 0.36), es * 0.88, 14, 3, false).translate(0, es * 0.44, 0).scale(1, 1, 0.34);
      else if (sp.ear === 'round') geo = new THREE.SphereGeometry(es * 0.55, 12, 8).scale(1, 1, 0.45).translate(0, es * 0.3, 0);
      else if (sp.ear === 'elephant') geo = new THREE.SphereGeometry(es * 0.5, 20, 14).scale(0.12, 1.0, 0.85).translate(x * es * 0.06, -es * 0.25, -es * 0.32);
      else geo = new THREE.SphereGeometry(es * 0.5, 12, 8).scale(0.3, 1.05, 0.55).translate(0, -es * 0.42, 0);
      paintVertices(geo, (p, n, c) => { c.copy(sp.points || sp.wool ? accent : coat); if (this.species === 'fox') c.lerp(accent, smoothstep(0.3, 0.8, p.y / es)); });
      mesh(ear, geo, fur);
      ear.rotation.z = x * (sp.ear === 'floppy' ? 0.35 : sp.ear === 'sheep' ? 1.35 : sp.ear === 'elephant' ? 0.15 : -0.12);
      ear.rotation.x = sp.ear === 'pointy' || sp.ear === 'horse' ? drop - 0.22 : 0;   // stand along the skull's up axis, tipped back
      if (sp.ear === 'floppy') ear.rotation.x = 0.1;
    }
    // Species parts on the head.
    if (sp.antlers) {
      for (const x of [-1, 1]) {
        const base = at(0.0, 0.9).add(new THREE.Vector3(x * hg * 0.35, 0, 0));
        const beam = new THREE.CatmullRomCurve3([base, base.clone().add(new THREE.Vector3(x * 0.1, 0.16, -0.04)), base.clone().add(new THREE.Vector3(x * 0.18, 0.34, -0.1)), base.clone().add(new THREE.Vector3(x * 0.16, 0.52, -0.02))]);
        mesh(this.head, new THREE.TubeGeometry(beam, 16, 0.018, 7), horn);
        for (const [u, dx, dy, dz] of [[0.3, 0.04, 0.13, 0.1], [0.6, 0.06, 0.12, 0.07], [0.85, -0.03, 0.12, 0.05]]) {
          const p = beam.getPointAt(u), tine = new THREE.CatmullRomCurve3([p, p.clone().add(new THREE.Vector3(x * dx * 0.5, dy * 0.6, dz * 0.6)), p.clone().add(new THREE.Vector3(x * dx, dy, dz))]);
          mesh(this.head, new THREE.TubeGeometry(tine, 8, 0.012, 6), horn);
        }
      }
    }
    if (sp.ossicones) for (const x of [-1, 1]) { const o2 = at(0.02, 1.05).add(new THREE.Vector3(x * hg * 0.3, 0, 0)); const c = mesh(this.head, new THREE.CylinderGeometry(0.018, 0.024, 0.13, 8), fur.clone()); c.position.copy(o2).add(new THREE.Vector3(0, 0.06, 0)); ((c.material as THREE.MeshPhysicalMaterial).vertexColors = false); (c.material as THREE.MeshPhysicalMaterial).color.copy(accent);
      const k = mesh(this.head, new THREE.SphereGeometry(0.03, 10, 8), dark); k.position.copy(o2).add(new THREE.Vector3(0, 0.13, 0)); }
    if (sp.trunk) {
      let parent: THREE.Object3D = this.head; const n = 9, seg = hl * 1.9 / n;
      for (let i = 0; i < n; i++) {
        const j = new THREE.Group(); if (i === 0) { j.position.copy(at(0.95, -0.15)); j.rotation.x = -0.25; } else j.position.set(0, -seg, 0);
        const ra = hg * sp.muzzleGirth * 0.75 * (1 - i / n * 0.6), rb = hg * sp.muzzleGirth * 0.75 * (1 - (i + 1) / n * 0.6);
        const lg = limbGeometry(seg * 1.05, ra, rb, 14); paintVertices(lg, (_p, _n, c) => c.copy(coat).multiplyScalar(0.95));
        mesh(j, lg, fur); parent.add(j); parent = j; this.trunkJ.push(j);
      }
    }
    if (sp.tusks) for (const x of [-1, 1]) {
      const b = at(0.8, -0.35).add(new THREE.Vector3(x * hg * 0.35, 0, 0));
      const c = new THREE.QuadraticBezierCurve3(b, b.clone().add(new THREE.Vector3(x * 0.05, -0.45, 0.35)), b.clone().add(new THREE.Vector3(x * 0.12, -0.28, 0.75)));
      mesh(this.head, new THREE.TubeGeometry(c, 16, 0.045, 10), ivory);
    }
    // Manes.
    if (sp.mane === 'horse' || sp.mane === 'short') {
      const hair = new THREE.MeshStandardMaterial({ color: sp.mane === 'short' ? accent : accent.clone().multiplyScalar(1.1), roughness: 0.75, side: THREE.DoubleSide });
      const n = sp.mane === 'short' ? 18 : 22;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), p = nTip.clone().multiplyScalar(u * 0.98), len = sp.mane === 'short' ? g * 0.28 : g * (0.55 + 0.25 * r());
        const card = mesh(this.neck, new THREE.PlaneGeometry(g * 0.12, len).translate(0, -len / 2, 0), hair);
        card.position.copy(p).add(new THREE.Vector3(sp.mane === 'short' ? 0 : (i % 2 ? 1 : -1) * g * 0.05, g * sp.neckGirth * (1 - u * 0.35) * 0.95, -g * 0.02));
        card.rotation.set(sp.mane === 'short' ? Math.PI + sp.neckRise * 0.2 : 0.4 - sp.neckRise * 0.5, Math.PI / 2, sp.mane === 'short' ? 0 : (i % 2 ? -1 : 1) * 0.35);
      }
    }
    if (sp.mane === 'lion') {
      const mg = new THREE.IcosahedronGeometry(hg * 2.0, 4);
      const p = mg.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.22 * (vnoise2(v.x * 22 + v.z * 9, v.y * 22, seed) - 0.5) + 0.12 * vnoise2(v.x * 60, v.y * 60 + v.z * 30, seed + 2); v.multiplyScalar(k); v.z *= 0.75; p.setXYZ(i, v.x, v.y, v.z); }
      mg.computeVertexNormals(); paintVertices(mg, (q, _n, c) => c.copy(accent).lerp(coat, smoothstep(0.1, -0.2, q.z / hg) * 0.3 + 0.1 * vnoise2(q.x * 40, q.y * 40, seed)));
      const m = mesh(this.head, mg, fur); m.position.copy(at(0.05, -0.15));
    }
    // ---- tail (joint chain from the rump)
    {
      let parent: THREE.Object3D = this.torso; const n = sp.tail === 'stub' ? 2 : sp.tail === 'curly' ? 4 : 6, seg = sp.tailLen / n;
      // Joint rotation θ about X points a −Y limb along (0, −cos θ, −sin θ): ~0.3 hangs, π/2 streams back, >2 lifts.
      const cat = this.species === 'cat';
      [this.tailBase, this.tailCurl] = ({ thin: cat ? [0.95, 0.22] : [1.75, 0.12], bushy: [0.75, 0.08], tuft: [0.28, 0.03], stub: [2.3, 0], curly: [2.2, 0.9], horse: [0.3, 0.02] } as Record<Tail, [number, number]>)[sp.tail];
      const tipC = new THREE.Color(sp.tailTip ?? (sp.points ? accent.getHex() : coat.getHex()));
      for (let i = 0; i < n; i++) {
        const j = new THREE.Group();
        if (i === 0) { j.position.copy(spine[0]).add(new THREE.Vector3(0, g * 0.45, g * 0.12)); j.rotation.x = this.tailBase; }
        else j.position.set(0, -seg * 0.98, 0);
        const base = sp.tail === 'horse' ? g * 0.09 : sp.tail === 'stub' ? g * 0.12 : g * 0.07;
        // One radius profile for the whole chain, so neighbouring segments meet without steps (bushy tails swell mid-way).
        const R = (u: number) => Math.max(0.005, base * (1 - u * 0.7)) + (sp.tail === 'bushy' ? Math.sin(Math.min(1, u * 1.05 + 0.08) * Math.PI) * g * 0.26 + g * 0.03 * (1 - u) : 0);
        const ra = R(i / n), rb = R((i + 1) / n);
        const lg = limbGeometry(seg, ra, rb, 12);
        paintVertices(lg, (_p, _n, c) => c.copy(coat).lerp(tipC, smoothstep(n * 0.55, n, i + 0.5)));
        mesh(j, lg, sp.tail === 'horse' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }) : fur);
        if (sp.tail === 'tuft' && i === n - 1) { const tuft = mesh(j, new THREE.SphereGeometry(base * 2.4, 10, 8).scale(1, 2.2, 1).translate(0, -seg, 0), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.85 })); tuft.castShadow = true; }
        if (sp.tail === 'horse') { const hair = mesh(j, new THREE.ConeGeometry(g * 0.16 * (1 + i * 0.25), seg * 1.4, 10, 1, true).translate(0, -seg * 0.6, 0), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.75, side: THREE.DoubleSide })); hair.castShadow = true; }
        parent.add(j); parent = j; this.tailJ.push(j);
      }
    }
    // ---- legs: fore (shoulder) and hind (hip), three segments each with rest angles that put the feet on y = 0
    const legTop = g * sp.leg, foreZ = zs - g * 0.25, hindZ = zh + g * 0.2;
    for (const front of [true, false]) for (const side of [-1, 1]) {
      const attachY = (front ? yc + slope * 0.5 + g * 0.05 : yc - slope * 0.5 + g * 0.1);   // inside the body, so the upper limb emerges from it
      const fr = sp.columnar ? [0.5, 0.4, 0.1] : front ? [0.45, 0.37, 0.18] : [0.4, 0.38, 0.22];
      const rest = sp.columnar ? (front ? [0.04, -0.06, 0.02] : [-0.08, 0.14, -0.06]) : front ? [0.18, -0.3, 0.12] : [-0.45, 0.95, -0.5];
      let acc = 0, extent = 0; for (let k = 0; k < 3; k++) { acc += rest[k]; extent += fr[k] * Math.cos(acc); }
      const footH = sp.hooves ? 0.06 * H / 1.6 : legTop * 0.35, len = (attachY - footH) / extent;
      const leg: Leg = { root: new THREE.Group(), j: [], rest, front, side, offset: 0, len };
      leg.root.position.set(side * g * sp.width * (front ? 0.55 : 0.58), attachY, front ? foreZ : hindZ);
      this.torso.add(leg.root);
      let parent: THREE.Object3D = leg.root;
      const radii = sp.columnar ? [legTop * 1.25, legTop * 1.05, legTop * 0.98, legTop * 1.0] : front ? [legTop * 1.3, legTop * 0.8, legTop * 0.56, legTop * 0.5] : [legTop * 1.6, legTop * 0.9, legTop * 0.56, legTop * 0.5];
      let along = 0;
      for (let k = 0; k < 3; k++) {
        const j = new THREE.Group(); if (k > 0) j.position.set(0, -fr[k - 1] * len, 0);
        const lg = limbGeometry(fr[k] * len, radii[k], radii[k + 1], 14), u0 = along / 1, u1 = (along + fr[k]);
        paintVertices(lg, (p, n, c) => { const u = u0 + (-p.y / (fr[k] * len)) * (u1 - u0); const q = new THREE.Vector3(p.x + leg.root.position.x, attachY - u * len * extent, leg.root.position.z + p.z); paintCoat(q, n, c, 'leg', u); });
        along += fr[k];
        mesh(j, lg, fur); parent.add(j); parent = j; leg.j.push(j);
      }
      const foot = sp.hooves ? new THREE.CylinderGeometry(radii[3] * 1.05, radii[3] * 1.3, footH * 1.15, 14).translate(0, -fr[2] * len - footH * 0.45, radii[3] * 0.15)
        : new THREE.SphereGeometry(radii[3] * (sp.columnar ? 1.15 : 1.08), 14, 10).scale(1, 0.6, sp.columnar ? 1.1 : 1.4).translate(0, -fr[2] * len - footH * 0.25, radii[3] * (sp.columnar ? 0.1 : 0.4));
      if (sp.hooves) mesh(parent, foot, new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.55 }));
      else { paintVertices(foot, (_p, _n, c) => c.copy(sp.points ? accent : coat).multiplyScalar(0.92)); mesh(parent, foot, fur); }
      this.legs.push(leg);
    }
    this.pose(0, { gait: 'idle' });
  }

  private freq(gait: Gait) { const f = 0.33 * Math.sqrt(9.81 / this.spec.withers); return gait === 'trot' ? f * 1.45 : gait === 'gallop' ? f * 1.9 : f; }
  /** Ground speed (m/s, before `scale`) that matches the gait's stride, for moving the root without foot skating. */
  speed(gait: Gait) { const h = this.spec.withers; return gait === 'idle' ? 0 : gait === 'walk' ? 1.25 * h * this.freq('walk') : gait === 'trot' ? 1.9 * h * this.freq('trot') : 3.2 * h * this.freq('gallop'); }

  /** Set the full pose at absolute time t (seconds). */
  pose(t: number, o: QuadrupedPose = {}) {
    const sp = this.spec, gait = o.gait ?? 'idle', ph = t * this.freq(gait) + (o.phase ?? 0);
    // Footfall offsets (cycle fractions) and duty factor per gait: LH, LF, RH, RF order is [hind L, fore L, hind R, fore R].
    const off: Record<Gait, [number, number, number, number]> = { idle: [0, 0, 0, 0], walk: [0, 0.25, 0.5, 0.75], trot: [0, 0.5, 0.5, 0], gallop: [0, 0.6, 0.12, 0.7] };
    const duty = gait === 'walk' ? 0.64 : gait === 'trot' ? 0.5 : 0.38, amp = gait === 'walk' ? 0.3 : gait === 'trot' ? 0.4 : gait === 'gallop' ? 0.62 : 0;
    const flexAmt = gait === 'walk' ? 0.75 : gait === 'trot' ? 1.0 : gait === 'gallop' ? 1.25 : 0;
    let lift = 0;
    for (const leg of this.legs) {
      const i = (leg.side < 0 ? 0 : 2) + (leg.front ? 1 : 0), u = ((ph + off[gait][i]) % 1 + 1) % 1;
      let swing = 0, flex = 0;
      if (amp > 0) {
        if (u < duty) swing = 1 - 2 * (u / duty);                                                      // stance: foot travels backward
        else { const v = (u - duty) / (1 - duty); swing = -1 + 2 * (v * v * (3 - 2 * v)); flex = Math.sin(Math.PI * v); }   // swing: lift and reach
      }
      const sw = swing * amp * (sp.columnar ? 0.6 : 1), fl = flex * flexAmt * (sp.columnar ? 0.45 : 1);
      leg.j[0].rotation.x = leg.rest[0] - sw;
      if (leg.front) { leg.j[1].rotation.x = leg.rest[1] + fl * 0.35; leg.j[2].rotation.x = leg.rest[2] + fl * 1.1; }
      else { leg.j[1].rotation.x = leg.rest[1] + fl * 0.45; leg.j[2].rotation.x = leg.rest[2] - fl * 0.2; }
      lift += 1 - Math.cos(sw);
    }
    // Body: the hip-height drop when legs swing is taken out, plus a twice-per-stride bob (and gallop pitch).
    const bob = amp > 0 ? Math.cos(ph * Math.PI * 4) * 0.012 * sp.withers * (gait === 'gallop' ? 2.5 : 1) : 0;
    const breath = Math.sin(t * (gait === 'idle' ? 1.6 : 3)) * 0.012;
    this.torso.position.y = this.bodyY + bob - lift / 4 * 0.55 * sp.withers * 0.5;
    this.torso.rotation.x = gait === 'gallop' ? Math.sin(ph * Math.PI * 2) * 0.06 : 0;
    this.torsoMesh.scale.set(1 + breath, 1 + breath, 1);
    // Head and neck: look controls, graze, walking nod.
    const nod = gait === 'walk' ? Math.sin(ph * Math.PI * 4) * 0.05 : gait === 'idle' ? Math.sin(t * 0.7) * 0.02 : 0;
    const graze = clamp(o.graze ?? 0);
    this.neck.rotation.set(graze * (sp.neckRise + 0.35) + nod, (o.headYaw ?? 0) * 0.45, 0);
    this.head.rotation.set((o.headPitch ?? 0) + graze * 0.4, (o.headYaw ?? 0) * 0.55, 0);
    // Tail and ears.
    const wag = clamp(o.tailWag ?? (this.species === 'dog' ? 0.3 : 0.1));
    this.tailJ.forEach((j, i) => {
      const k = (i + 1) / this.tailJ.length;
      j.rotation.z = Math.sin(t * (wag > 0.4 ? 11 : 2.2) + i * 0.6) * (0.08 + wag * 0.35) * k;
      j.rotation.x = i === 0 ? this.tailBase + (gait === 'gallop' ? 0.35 : gait === 'trot' ? 0.15 : 0) : this.tailCurl;
    });
    this.trunkJ.forEach((j, i) => { if (i > 0) j.rotation.x = 0.06 + Math.sin(t * 0.9 + i * 0.5) * 0.06 + (i > 5 ? 0.18 : 0); j.rotation.z = Math.sin(t * 0.6 + i * 0.4) * 0.03; });
    const flick = clamp(o.earFlick ?? 0.3);
    this.ears.forEach((e, i) => { e.rotation.y = Math.max(0, Math.sin(t * 1.3 + i * 2.1) - 0.9) * 6 * flick * 0.35; });
  }

  /** World position of the head (between the eyes), e.g. for a camera target. */
  headWorld(out = new THREE.Vector3()) { return this.head.getWorldPosition(out); }
}
