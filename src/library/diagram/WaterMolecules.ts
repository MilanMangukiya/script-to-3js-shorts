import * as THREE from 'three';
import { rng, lerp } from '../util/math';

export interface WaterMoleculesOptions {
  seed?: number;
  /** Honeycomb patch radius in lattice cells and number of stacked layers. */
  cells?: number; layers?: number;
  /** O–O distance in scene units (sets the overall size). */
  bond?: number;
  oxygenColor?: THREE.ColorRepresentation; hydrogenColor?: THREE.ColorRepresentation; bondColor?: THREE.ColorRepresentation;
  /** Linear size of the liquid arrangement relative to the ice lattice. 0.971 gives the real ≈9% volume difference. */
  liquidScale?: number;
}

/**
 * Schematic water: the same H2O molecules shown as a jostling liquid or locked into an open hexagonal ice lattice.
 * `update(time_s, freeze)`: freeze 0 = liquid, 1 = ice. Not to scale and not a molecular simulation — a labelled
 * explanatory model whose only quantitative feature is the ≈9% volume difference between the two states.
 */
export class WaterMolecules {
  readonly group = new THREE.Group();
  /** Half-extents of the ice-state bounding box, for framing and outline boxes. */
  readonly halfSize = new THREE.Vector3();
  private O: THREE.InstancedMesh; private H: THREE.InstancedMesh; private bonds: THREE.LineSegments;
  private mol: { ice: THREE.Vector3; liq: THREE.Vector3; h: THREE.Vector3[]; ph: number[]; axis: THREE.Vector3 }[] = [];
  private dummy = new THREE.Object3D(); private liquidScale: number; private bondLen: number;

  constructor(o: WaterMoleculesOptions = {}) {
    const r = rng(o.seed ?? 6), d = (this.bondLen = o.bond ?? 1), cells = o.cells ?? 2, layers = o.layers ?? 2;
    this.liquidScale = o.liquidScale ?? 0.971;
    // Puckered honeycomb layers stacked in register, so the view down +Z shows open hexagonal channels (as ice Ih does along its c-axis).
    const a1 = new THREE.Vector2(Math.sqrt(3) * d, 0), a2 = new THREE.Vector2(Math.sqrt(3) / 2 * d, 1.5 * d), sites: THREE.Vector3[] = [];
    const lim = cells * Math.sqrt(3) * d + 0.01;
    for (let L = 0; L < layers; L++) for (let i = -cells * 2; i <= cells * 2; i++) for (let j = -cells * 2; j <= cells * 2; j++) for (const b of [0, 1]) {
      const x = a1.x * i + a2.x * j, y = a1.y * i + a2.y * j + (b ? d : 0) - d / 2;
      if (Math.hypot(x, y) > lim) continue;
      sites.push(new THREE.Vector3(x, y, (L - (layers - 1) / 2) * d * 1.35 + (b ? 0.17 : -0.17) * d));
    }
    const box = new THREE.Box3().setFromPoints(sites); box.getSize(this.halfSize).multiplyScalar(0.5).addScalar(d * 0.35);
    // Liquid arrangement: same molecules, disordered, in a volume about 9% smaller.
    const pairs: number[] = [];
    sites.forEach((s, i) => {
      const liq = new THREE.Vector3((r() * 2 - 1) * this.halfSize.x, (r() * 2 - 1) * this.halfSize.y, (r() * 2 - 1) * this.halfSize.z).multiplyScalar(this.liquidScale * 0.92);
      const near = sites.map((t, k) => ({ k, dist: t.distanceTo(s) })).filter((q) => q.k !== i && q.dist < d * 1.45).sort((p, q) => p.dist - q.dist);
      for (const q of near) if (q.k > i) pairs.push(i, q.k);
      // Hydrogens point toward two neighbours (or random directions at the patch edge).
      const dirs = near.slice(0, 2).map((q) => sites[q.k].clone().sub(s).normalize());
      while (dirs.length < 2) dirs.push(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize());
      this.mol.push({ ice: s, liq, h: dirs, ph: [r() * 6.283, r() * 6.283, r() * 6.283, 0.6 + r() * 0.8], axis: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize() });
    });
    const n = sites.length;
    const sphere = new THREE.SphereGeometry(1, 18, 14);
    this.O = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: o.oxygenColor ?? 0xe8503f, roughness: 0.35, emissive: 0x3a0c08, emissiveIntensity: 0.5 }), n);
    this.H = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: o.hydrogenColor ?? 0xf4f6fa, roughness: 0.3, emissive: 0x26303c, emissiveIntensity: 0.5 }), n * 2);
    this.O.frustumCulled = false; this.H.frustumCulled = false;
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pairs.length * 3), 3));
    bg.setIndex(null); (bg as any).userData = { pairs };
    this.bonds = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: o.bondColor ?? 0x9fd8ff, transparent: true, opacity: 0, depthWrite: false }));
    this.bonds.frustumCulled = false;
    this.group.add(this.bonds, this.O, this.H);
  }

  get count() { return this.mol.length; }

  /** @param freeze 0 = liquid, 1 = ice lattice (smoothly interpolated). */
  update(time_s: number, freeze: number) {
    const f = Math.min(1, Math.max(0, freeze)), d = this.dummy, rO = this.bondLen * 0.2, rH = this.bondLen * 0.12, q = new THREE.Quaternion(), v = new THREE.Vector3();
    const pos = this.bonds.geometry.attributes.position as THREE.BufferAttribute, centers: THREE.Vector3[] = [];
    const jig = lerp(0.3, 0.025, f) * this.bondLen;
    this.mol.forEach((m, i) => {
      // Each molecule locks in at a slightly different moment so the crystal appears to grow.
      const fi = Math.min(1, Math.max(0, (f * 1.35 - (m.ph[3] - 0.6) / 0.8 * 0.35)));
      const e = fi * fi * (3 - 2 * fi), k = m.ph[3];
      const c = new THREE.Vector3().lerpVectors(m.liq, m.ice, e);
      c.x += Math.sin(time_s * 1.9 * k + m.ph[0]) * jig * (1 - e * 0.9); c.y += Math.sin(time_s * 1.6 * k + m.ph[1]) * jig * (1 - e * 0.9); c.z += Math.sin(time_s * 1.7 * k + m.ph[2]) * jig * (1 - e * 0.9);
      centers.push(c);
      d.position.copy(c); d.quaternion.identity(); d.scale.setScalar(rO); d.updateMatrix(); this.O.setMatrixAt(i, d.matrix);
      q.setFromAxisAngle(m.axis, (1 - e) * (m.ph[0] + time_s * 1.4 * k));
      for (let h = 0; h < 2; h++) {
        v.copy(m.h[h]).applyQuaternion(q).multiplyScalar(this.bondLen * 0.3).add(c);
        d.position.copy(v); d.scale.setScalar(rH); d.updateMatrix(); this.H.setMatrixAt(i * 2 + h, d.matrix);
      }
    });
    const pairs = (this.bonds.geometry as any).userData.pairs as number[];
    for (let i = 0; i < pairs.length; i++) { const c = centers[pairs[i]]; pos.setXYZ(i, c.x, c.y, c.z); }
    pos.needsUpdate = true;
    (this.bonds.material as THREE.LineBasicMaterial).opacity = 0.55 * Math.max(0, (f - 0.55) / 0.45);
    this.O.instanceMatrix.needsUpdate = true; this.H.instanceMatrix.needsUpdate = true;
  }
}
