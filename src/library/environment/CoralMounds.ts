import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, fbm2 } from '../util/math';

export interface CoralMoundsOptions {
  /** Instances per form (brain, branching, table) and the [xMin, xMax, zMin, zMax] footprint in metres. */
  count?: number; area?: [number, number, number, number];
  /** Ground height under a coral (world y) and an optional rejection test (e.g. sand channels). */
  ground?: (x: number, z: number) => number; reject?: (x: number, z: number) => boolean;
  /** Size range in metres and seeded warm palette. */
  minSize?: number; maxSize?: number; palette?: THREE.ColorRepresentation[];
  seed?: number;
}

/** Brain coral: a squashed sphere with meandering grooves pressed into it (unit size). */
function brainGeometry(seed: number) {
  const g = new THREE.SphereGeometry(0.5, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const groove = Math.abs(Math.sin(fbm2(v.x * 3.1 + seed, v.z * 3.1, seed) * 18)) * 0.05;
    v.multiplyScalar(1 - groove); v.y *= 0.72; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
/** Branching coral: a fan of tapered, slightly bent branches (unit size). */
function branchGeometry(r: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.5, tilt = 0.25 + r() * 0.45, h = 0.55 + r() * 0.45;
    const c = new THREE.CylinderGeometry(0.018, 0.045, h, 6, 3).translate(0, h / 2, 0);
    c.rotateZ(tilt); c.rotateY(a); parts.push(c);
    const tip = new THREE.SphereGeometry(0.03, 6, 4).translate(0, h, 0); tip.rotateZ(tilt); tip.rotateY(a); parts.push(tip);
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
/** Table coral: a wide, thin, slightly wavy plate on a short stem (unit size). */
function tableGeometry(seed: number) {
  const top = new THREE.CylinderGeometry(0.5, 0.42, 0.06, 32, 1).translate(0, 0.32, 0);
  const p = top.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + (fbm2(x * 4 + seed, z * 4) - 0.5) * 0.08); }
  const stem = new THREE.CylinderGeometry(0.06, 0.1, 0.32, 10).translate(0, 0.16, 0);
  const g = mergeGeometries([top.toNonIndexed(), stem.toNonIndexed()]); g.computeVertexNormals(); return g;
}

/**
 * Shallow-reef coral heads: three procedural forms (brain, branching, table) instanced with seeded positions, sizes,
 * rotations and a warm palette, rough and matte so they read under caustics and fog. Static; add `group` to a scene.
 */
export class CoralMounds {
  readonly group = new THREE.Group();

  constructor(o: CoralMoundsOptions = {}) {
    const r = rng(o.seed ?? 41), n = o.count ?? 40, [x0, x1, z0, z1] = o.area ?? [-6, 6, -8, 2];
    const ground = o.ground ?? (() => 0), reject = o.reject ?? (() => false);
    const palette = (o.palette ?? [0xd9774a, 0xe8a85a, 0xb8577a, 0x9c6fbf, 0xd6c06a, 0x6fb3a0, 0xe0866f]).map((c) => new THREE.Color(c));
    const forms = [brainGeometry(o.seed ?? 41), branchGeometry(r), tableGeometry((o.seed ?? 41) + 3)];
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
    const d = new THREE.Object3D(), c = new THREE.Color();
    forms.forEach((geo, f) => {
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      let k = 0, guard = 0;
      while (k < n && guard++ < n * 30) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (reject(x, z)) continue;
        const s = (o.minSize ?? 0.3) + Math.pow(r(), 1.5) * ((o.maxSize ?? 1.2) - (o.minSize ?? 0.3)) * (f === 1 ? 0.8 : 1);
        d.position.set(x, ground(x, z) - 0.02 * s, z); d.rotation.set((r() - 0.5) * 0.2, r() * Math.PI * 2, (r() - 0.5) * 0.2);
        d.scale.set(s, s * (0.8 + r() * 0.4), s); d.updateMatrix(); mesh.setMatrixAt(k, d.matrix);
        mesh.setColorAt(k, c.copy(palette[Math.floor(r() * palette.length)]).multiplyScalar(0.75 + r() * 0.35));
        k++;
      }
      mesh.count = k; mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh);
    });
  }
}
