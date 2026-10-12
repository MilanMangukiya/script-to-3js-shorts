import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../util/math';

export interface ConiferStandOptions {
  /** Tree base positions (world/local). Use `scatterTrees` to generate them. */
  positions: THREE.Vector3[];
  seed?: number;
  /** Tree height range in metres. */
  minHeight?: number; maxHeight?: number;
  color?: THREE.ColorRepresentation; trunkColor?: THREE.ColorRepresentation;
  /** 0 = bare green, 1 = heavily snow-laden upper surfaces. */
  snow?: number; snowColor?: THREE.ColorRepresentation;
}

/** Seeded scatter helper: `count` points inside [xMin,xMax]×[zMin,zMax] at height y(x,z), skipping rejected spots. */
export function scatterTrees(count: number, seed: number, area: [number, number, number, number], y: (x: number, z: number) => number = () => 0, reject: (x: number, z: number) => boolean = () => false): THREE.Vector3[] {
  const r = rng(seed), out: THREE.Vector3[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const x = area[0] + r() * (area[1] - area[0]), z = area[2] + r() * (area[3] - area[2]);
    if (!reject(x, z)) out.push(new THREE.Vector3(x, y(x, z), z));
  }
  return out;
}

/**
 * Instanced stylised conifers (tiered cones on a trunk) with optional snow load painted by surface slope.
 * Static geometry: a cheap mid-ground and background forest for winter, mountain and night scenes.
 */
export class ConiferStand {
  readonly mesh: THREE.InstancedMesh;

  constructor(o: ConiferStandOptions) {
    const r = rng(o.seed ?? 4), parts: THREE.BufferGeometry[] = [];
    const green = new THREE.Color(o.color ?? 0x1c3324), trunk = new THREE.Color(o.trunkColor ?? 0x2e2118), white = new THREE.Color(o.snowColor ?? 0xeef3fa), snow = o.snow ?? 0;
    const paint = (g: THREE.BufferGeometry, base: THREE.Color, snowy: boolean) => {
      const g2 = g.toNonIndexed(); g2.computeVertexNormals();
      const n = g2.attributes.normal as THREE.BufferAttribute, p = g2.attributes.position as THREE.BufferAttribute, c = new Float32Array(p.count * 3), col = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        // Snow sits on the outer, upward-facing parts of each tier.
        const radial = Math.hypot(p.getX(i), p.getZ(i));
        const k = snowy ? Math.min(1, Math.max(0, (n.getY(i) - 0.25) * 2.2 + (radial - 0.25) * 0.9)) * snow : 0;
        col.copy(base).lerp(white, k); c.set([col.r, col.g, col.b], i * 3);
      }
      g2.setAttribute('color', new THREE.BufferAttribute(c, 3)); g2.deleteAttribute('uv');
      return g2;
    };
    // Unit tree: height 1, base radius about 0.24.
    parts.push(paint(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 6).translate(0, 0.11, 0), trunk, false));
    for (let k = 0; k < 4; k++) parts.push(paint(new THREE.ConeGeometry(0.25 - k * 0.05, 0.36 - k * 0.03, 9, 1, true).translate(0, 0.3 + k * 0.2, 0), green, true));
    const geo = mergeGeometries(parts)!;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, o.positions.length);
    const d = new THREE.Object3D(), hMin = o.minHeight ?? 7, hMax = o.maxHeight ?? 16;
    o.positions.forEach((p, i) => {
      const h = hMin + r() * (hMax - hMin);
      d.position.copy(p); d.rotation.y = r() * 6.283; d.scale.set(h * (0.85 + r() * 0.4), h, h * (0.85 + r() * 0.4)); d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
  }
}
