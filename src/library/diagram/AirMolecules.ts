import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, smoothstep } from '../util/math';

export interface AirComposition { n2: number; o2: number; ar: number; co2: number }
export interface AirMoleculesOptions {
  /** Full extents of the box the molecules fill (centred on the group origin). */
  size: THREE.Vector3;
  /** Molecules shown at density 1, and the largest density the instance pool must hold. */
  count?: number; maxDensity?: number;
  /** Number fractions by species (normalised internally). Real dry air ≈ 0.78 / 0.21 / 0.0093 / 0.0004. */
  composition?: AirComposition;
  /** Atom radius in scene units (schematic, not to scale). */
  scale?: number;
  /** Thermal wander amplitude (scene units) and speed multiplier. */
  jitter?: number; speed?: number;
  seed?: number;
  colors?: Partial<{ n2: THREE.ColorRepresentation; o2: THREE.ColorRepresentation; ar: THREE.ColorRepresentation; co2: THREE.ColorRepresentation; carbon: THREE.ColorRepresentation }>;
  /** Fade molecules toward the top of the box over this fraction of its height (0 = none). */
  topFade?: number;
}

type Species = 'n2' | 'o2' | 'ar' | 'co2';

/**
 * Schematic gas sample: instanced N2/O2 dumbbells, argon atoms and O=C=O molecules filling a box with seeded,
 * stratified positions. `update(time_s, density)` shows `density × count` molecules: extra molecules pop in at seeded
 * empty slots between the existing ones, so a doubling reads as the same space holding twice as many molecules.
 */
export class AirMolecules {
  readonly group = new THREE.Group();
  private meshes: Record<'pair' | 'ar' | 'co2', THREE.InstancedMesh>;
  private mol: { sp: Species; base: THREE.Vector3; ph: [number, number, number]; k: number; axis: THREE.Vector3; spin: number; slot: number; order: number }[] = [];
  private dummy = new THREE.Object3D();
  private o: AirMoleculesOptions;
  private highlightMat: THREE.MeshStandardMaterial[] = [];

  constructor(o: AirMoleculesOptions) {
    this.o = o;
    const count = o.count ?? 400, cap = Math.ceil(count * (o.maxDensity ?? 2)), r = rng(o.seed ?? 9), S = o.size, a = o.scale ?? 0.03;
    const comp = o.composition ?? { n2: 0.7808, o2: 0.2095, ar: 0.0093, co2: 0.0004 };
    const tot = comp.n2 + comp.o2 + comp.ar + comp.co2;
    const col = { n2: 0x86a6dc, o2: 0xff6a52, ar: 0xd9c9ff, co2: 0xff6a52, carbon: 0x2b2d33, ...(o.colors ?? {}) };
    // Stratified slots: a jittered grid with at least `cap` cells, visited in a seeded shuffled order.
    const edge = Math.cbrt((S.x * S.y * S.z) / cap);
    const nx = Math.max(1, Math.round(S.x / edge)), nz = Math.max(1, Math.round(S.z / edge)), ny = Math.max(1, Math.ceil(cap / (nx * nz)));
    const slots: THREE.Vector3[] = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++)
      slots.push(new THREE.Vector3(((ix + 0.5 + (r() - 0.5) * 0.7) / nx - 0.5) * S.x, ((iy + 0.5 + (r() - 0.5) * 0.7) / ny - 0.5) * S.y, ((iz + 0.5 + (r() - 0.5) * 0.7) / nz - 0.5) * S.z));
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    const counts = { pair: 0, ar: 0, co2: 0 };
    for (let i = 0; i < Math.min(cap, slots.length); i++) {
      const q = r() * tot, sp: Species = q < comp.n2 ? 'n2' : q < comp.n2 + comp.o2 ? 'o2' : q < comp.n2 + comp.o2 + comp.ar ? 'ar' : 'co2';
      const kind = sp === 'ar' ? 'ar' : sp === 'co2' ? 'co2' : 'pair';
      this.mol.push({ sp, base: slots[i], ph: [r() * 6.28, r() * 6.28, r() * 6.28], k: 0.6 + r() * 0.8, axis: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), spin: (r() - 0.5) * 2.2, slot: counts[kind]++, order: i });
    }
    const sphere = new THREE.SphereGeometry(a, 14, 10);
    const mk = (geo: THREE.BufferGeometry, n: number, mat: THREE.MeshStandardMaterial) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.frustumCulled = false; m.count = n; this.group.add(m); return m; };
    const std = (c: THREE.ColorRepresentation, vertexColors = false) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0, emissive: 0x141a24, emissiveIntensity: 1, vertexColors }); this.highlightMat.push(m); return m; };
    const pair = mergeGeometries([sphere.clone().translate(-a * 0.72, 0, 0), sphere.clone().translate(a * 0.72, 0, 0)])!;
    const paint = (g: THREE.BufferGeometry, c: THREE.Color) => { const n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g; };
    const oC = new THREE.Color(col.co2), cC = new THREE.Color(col.carbon);
    const co2 = mergeGeometries([paint(sphere.clone().translate(-a * 1.45, 0, 0), oC), paint(sphere.clone().scale(1.05, 1.05, 1.05), cC), paint(sphere.clone().translate(a * 1.45, 0, 0), oC)])!;
    this.meshes = { pair: mk(pair, counts.pair, std(0xffffff)), ar: mk(sphere.clone().scale(1.15, 1.15, 1.15), counts.ar, std(col.ar)), co2: mk(co2, counts.co2, std(0xffffff, true)) };
    const n2c = new THREE.Color(col.n2), o2c = new THREE.Color(col.o2);
    for (const m of this.mol) if (m.sp === 'n2' || m.sp === 'o2') this.meshes.pair.setColorAt(m.slot, m.sp === 'n2' ? n2c : o2c);
    if (this.meshes.pair.instanceColor) this.meshes.pair.instanceColor.needsUpdate = true;
  }

  /** Emissive boost for schematic emphasis (e.g. highlight CO2 at 1, others 0). */
  setGlow(species: 'all' | 'co2', amount: number) {
    const mats = species === 'co2' ? [this.meshes.co2.material as THREE.MeshStandardMaterial] : this.highlightMat;
    for (const m of mats) { m.emissive.setHex(species === 'co2' ? 0xff5a3c : 0x2a3a58); m.emissiveIntensity = 0.4 + amount * 1.6; }
  }

  /**
   * @param density visible fraction of `count` (1 = base, 2 = doubled); new molecules scale in over 0.06 of density.
   * @param fade optional global scale-in (0..1), e.g. to fade the whole sample in or out.
   */
  update(time_s: number, density = 1, fade = 1) {
    const o = this.o, n = o.count ?? 400, jit = o.jitter ?? (o.scale ?? 0.03) * 1.6, sp = o.speed ?? 1, d = this.dummy, S = o.size, topFade = o.topFade ?? 0;
    const shown = density * n;
    for (const m of this.mol) {
      const k = m.k * sp, mesh = this.meshes[m.sp === 'ar' ? 'ar' : m.sp === 'co2' ? 'co2' : 'pair'];
      const appear = smoothstep(m.order - n * 0.06, m.order, shown);
      const pop = m.order >= n ? 1 + 0.35 * Math.sin(appear * Math.PI) : 1;
      const tf = topFade > 0 ? 1 - smoothstep(0.5 - topFade, 0.5, m.base.y / S.y) : 1;
      d.position.set(m.base.x + Math.sin(time_s * 0.9 * k + m.ph[0]) * jit, m.base.y + Math.sin(time_s * 0.8 * k + m.ph[1]) * jit, m.base.z + Math.sin(time_s * 0.85 * k + m.ph[2]) * jit);
      d.quaternion.setFromAxisAngle(m.axis, m.ph[0] + time_s * m.spin);
      d.scale.setScalar(Math.max(1e-4, appear * pop * fade * tf));
      d.updateMatrix(); mesh.setMatrixAt(m.slot, d.matrix);
    }
    for (const mesh of Object.values(this.meshes)) mesh.instanceMatrix.needsUpdate = true;
  }
}
