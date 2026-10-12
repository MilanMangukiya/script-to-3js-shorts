import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, fbm2 } from '../util/math';

export interface SeaIceOptions {
  seed?: number;
  /** Number of drifting floes and the rectangle [xMin, xMax, zMin, zMax] they fill. */
  floeCount?: number; area?: [number, number, number, number];
  /** Floe radius range in metres. */
  minRadius?: number; maxRadius?: number;
  /** Total floe thickness in metres; about one tenth rides above the water, as real ice does. */
  thickness?: number;
  /** Optional large flat platform (fast ice) centred at the origin with this radius. */
  platformRadius?: number;
  /** Optional tabular iceberg: position, footprint (x, z) and freeboard height in metres. */
  iceberg?: { position: THREE.Vector3; size: [number, number]; freeboard: number };
  /** Keep-out circles [x, z, r] where no floes are placed (e.g. open leads for the camera). */
  avoid?: [number, number, number][];
}

/**
 * Floating sea ice: irregular snow-topped floes, an optional fast-ice platform and an optional tabular iceberg.
 * Geometry is authored relative to a waterline at y = 0. `sink` lowers every piece by a number of metres,
 * with a per-piece delay, for counterfactual or melting shots; `bob` adds a gentle swell motion.
 */
export class SeaIce {
  readonly group = new THREE.Group();
  private pieces: { mesh: THREE.Mesh; base: THREE.Vector3; ph: number; delay: number; big: boolean }[] = [];

  constructor(o: SeaIceOptions = {}) {
    const r = rng(o.seed ?? 14), th = o.thickness ?? 1.6, free = th * 0.1;
    const snow = new THREE.Color(0xf4f7fb), side = new THREE.Color(0x8fd0df), deep = new THREE.Color(0x3d8fa6);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
    const slab = (radius: number, n: number, jitter: number, top: number, bottom: number, bump = 0.06) => {
      const shape = new THREE.Shape(), seed = r() * 100;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rad = radius * (1 - jitter + r() * jitter * 2);
        if (i === 0) shape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else shape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: true, bevelThickness: Math.min(0.12, (top - bottom) * 0.1), bevelSize: Math.min(0.25, radius * 0.03), bevelSegments: 2, curveSegments: 1 });
      g.rotateX(-Math.PI / 2); g.translate(0, bottom, 0);
      const g2 = g.toNonIndexed(); g2.computeVertexNormals();
      const p = g2.attributes.position as THREE.BufferAttribute, nrm = g2.attributes.normal as THREE.BufferAttribute, c = new Float32Array(p.count * 3), col = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const up = nrm.getY(i), y = p.getY(i), shade = 0.9 + bump * 2 * (fbm2(p.getX(i) * 0.35 + seed, p.getZ(i) * 0.35, 3, 3) - 0.5);
        if (up > 0.6) col.copy(snow).multiplyScalar(shade); else col.copy(side).lerp(deep, Math.min(1, Math.max(0, (top - y) / (top - bottom)))).lerp(snow, Math.max(0, (y - top + 0.5) * 0.8));
        c.set([col.r, col.g, col.b], i * 3);
      }
      g2.setAttribute('color', new THREE.BufferAttribute(c, 3)); g2.deleteAttribute('uv');
      return g2;
    };
    const add = (g: THREE.BufferGeometry, x: number, z: number, big = false) => {
      const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); m.rotation.y = r() * 6.283; m.castShadow = true; m.receiveShadow = true;
      this.group.add(m); this.pieces.push({ mesh: m, base: m.position.clone(), ph: r() * 6.283, delay: r(), big });
    };
    if (o.platformRadius) add(slab(o.platformRadius, 14, 0.12, free * 1.6, -th), 0, 0, true);
    const area = o.area ?? [-150, 150, -400, -20], n = o.floeCount ?? 70, placed: [number, number, number][] = [...(o.avoid ?? [])];
    if (o.platformRadius) placed.push([0, 0, o.platformRadius * 1.08]);
    let guard = 0, count = 0;
    while (count < n && guard++ < n * 60) {
      const rad = (o.minRadius ?? 3) + Math.pow(r(), 1.8) * ((o.maxRadius ?? 22) - (o.minRadius ?? 3));
      const x = area[0] + r() * (area[1] - area[0]), z = area[2] + r() * (area[3] - area[2]);
      if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + rad * 1.06)) continue;
      placed.push([x, z, rad]); add(slab(rad, 7 + Math.floor(r() * 4), 0.2, free, -th * (0.7 + r() * 0.5)), x, z); count++;
    }
    if (o.iceberg) {
      const { position, size, freeboard } = o.iceberg;
      // Tabular berg: a tall slab with fractured cliff faces; roughly one eighth is above the waterline.
      const g = slab(1, 16, 0.14, freeboard, -freeboard * 6, 0.02); g.scale(size[0] / 2, 1, size[1] / 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0 && y < freeboard * 0.98) { const k = 1 + (fbm2(p.getX(i) * 0.05 + y * 0.2, p.getZ(i) * 0.05, 9, 3) - 0.5) * 0.06; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
      g.computeVertexNormals();
      add(g, position.x, position.z, true);
    }
  }

  /**
   * @param sink metres to lower the ice (0 = floating). Pieces start sinking at slightly different moments.
   * @param sinkSpan total metres over which the staggered delays are spread
   */
  update(time_s: number, sink = 0, sinkSpan = 6) {
    for (const p of this.pieces) {
      const s = Math.max(0, sink - p.delay * sinkSpan * (p.big ? 0.3 : 1));
      const bob = p.big ? 0 : Math.sin(time_s * 0.6 + p.ph) * 0.05;
      p.mesh.position.y = p.base.y + bob - s;
      p.mesh.rotation.z = p.big ? 0 : Math.sin(time_s * 0.45 + p.ph) * 0.012 + Math.min(0.5, s * 0.03) * Math.sin(p.ph);
      p.mesh.visible = s < 400;
    }
  }
}
