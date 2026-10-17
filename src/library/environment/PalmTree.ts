import * as THREE from 'three';
import { rng } from '../util/math';
import type { PBRLibrary } from '../materials/PBR';

/**
 * Coconut palm: a leaning, gently curved ringed trunk (bark texture), a crown of arching pinnate fronds built from
 * leaflet strips with a vein-shaded canvas map, and a cluster of coconuts. Metres; origin at the trunk base.
 * `update(time_s, wind)` sways fronds and crown deterministically.
 */
export interface PalmTreeOptions { height?: number; lean?: number; leanDir?: number; fronds?: number; seed?: number; leafColor?: THREE.ColorRepresentation; pbr?: PBRLibrary }

export class PalmTree {
  readonly group = new THREE.Group();
  private crown = new THREE.Group(); private fronds: THREE.Object3D[] = []; private phase: number[] = [];
  constructor(o: PalmTreeOptions = {}) {
    const H = o.height ?? 7, r = rng(o.seed ?? 3), lean = o.lean ?? 0.28, dir = o.leanDir ?? r() * Math.PI * 2;
    // Trunk: curved tube with ring bands.
    const curve = new THREE.CatmullRomCurve3([0, 0.25, 0.5, 0.75, 1].map((t) => new THREE.Vector3(Math.sin(dir) * lean * H * t * t, H * t, Math.cos(dir) * lean * H * t * t)));
    const trunkGeo = new THREE.TubeGeometry(curve, 48, 1, 14, false), pos = trunkGeo.attributes.position as THREE.BufferAttribute, uv = trunkGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const t = uv.getX(i), p = curve.getPointAt(t), rad = (0.22 - 0.07 * t) * (1 + 0.06 * Math.max(0, Math.sin(t * 160))), v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(p).normalize().multiplyScalar(rad); pos.setXYZ(i, p.x + v.x, p.y + v.y, p.z + v.z); uv.setXY(i, uv.getY(i) * 3, t * H * 1.5); }
    trunkGeo.computeVertexNormals();
    const bark = o.pbr ? o.pbr.material('bark_willow_02', { tint: 0xbfa98a, tile: 1.0 }) : new THREE.MeshStandardMaterial({ color: 0x8a7457, roughness: 0.95 });
    const trunk = new THREE.Mesh(trunkGeo, bark); trunk.castShadow = trunk.receiveShadow = true; this.group.add(trunk);
    const top = curve.getPointAt(1); this.crown.position.copy(top); this.group.add(this.crown);
    // Fronds.
    const leaf = new THREE.MeshStandardMaterial({ map: frondTexture(new THREE.Color(o.leafColor ?? 0x4f7a2e)), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.65 });
    const n = o.fronds ?? 13;
    for (let i = 0; i < n; i++) {
      const az = (i / n) * Math.PI * 2 + r() * 0.3, droop = 0.35 + r() * 0.5, len = H * (0.42 + r() * 0.12);
      const g = frondGeometry(len, droop, r), m = new THREE.Mesh(g, leaf); m.castShadow = true;
      const holder = new THREE.Group(); holder.rotation.set(0, az, 0); holder.add(m); m.rotation.z = -0.25 - r() * 0.35; this.crown.add(holder); this.fronds.push(m); this.phase.push(r() * 6.28);
    }
    const nut = new THREE.MeshStandardMaterial({ color: 0x5a4a22, roughness: 0.7 });
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), nut); s.position.set(Math.cos(i * 1.3) * 0.18, -0.25 - (i % 2) * 0.08, Math.sin(i * 1.3) * 0.18); this.crown.add(s); }
  }
  update(time_s: number, wind = 0.4) {
    this.fronds.forEach((f, i) => { f.rotation.x = Math.sin(time_s * 1.3 + this.phase[i]) * 0.05 * wind; f.rotation.y = Math.sin(time_s * 0.9 + this.phase[i] * 1.7) * 0.04 * wind; });
    this.crown.rotation.z = Math.sin(time_s * 0.6) * 0.02 * wind;
  }
}

/** One frond: an arching spine strip (along +X) whose texture carries the leaflets; width tapers to the tip. */
function frondGeometry(len: number, droop: number, r: () => number) {
  const segs = 22, w = len * 0.42, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, x = t * len, y = Math.sin(t * Math.PI * 0.55) * len * 0.18 - droop * len * t * t * 0.55, half = w * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)) * (1 - 0.25 * t);
    const fold = half * 0.25;   // leaflets angle up from the spine (V-shaped cross-section)
    pos.push(x, y + fold, -half, x, y, 0, x, y + fold, half); uv.push(t, 0, t, 0.5, t, 1);
  }
  for (let i = 0; i < segs; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  void r; return g;
}
const _fronds = new Map<number, THREE.Texture>();
function frondTexture(color: THREE.Color) {
  const key = color.getHex(); if (_fronds.has(key)) return _fronds.get(key)!;
  const W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {   // leaflets: thin tapered blades from the spine to both edges
    const x = (i / 70) * W, len = H * 0.5 * (0.75 + 0.25 * Math.sin(i * 1.7)), shade = 0.82 + 0.18 * Math.sin(i * 2.3);
    for (const sgn of [-1, 1]) {
      g.fillStyle = `rgb(${Math.round(color.r * 255 * shade)},${Math.round(color.g * 255 * shade)},${Math.round(color.b * 255 * shade)})`;
      g.beginPath(); g.moveTo(x, H / 2); g.quadraticCurveTo(x + 6, H / 2 + sgn * len * 0.5, x + 9, H / 2 + sgn * len); g.lineTo(x + 4, H / 2 + sgn * len * 0.95); g.quadraticCurveTo(x + 1, H / 2 + sgn * len * 0.4, x - 2, H / 2); g.fill();
    }
  }
  g.fillStyle = '#6b5a2e'; g.fillRect(0, H / 2 - 2, W, 4);   // spine
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; _fronds.set(key, t); return t;
}
