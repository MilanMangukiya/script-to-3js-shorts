import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../util/math';

export interface PenguinColonyOptions {
  /** Number of adults and downy chicks. */
  adults?: number; chicks?: number; seed?: number;
  /** Colony footprint radii (x, z) in metres. */
  spread?: [number, number];
  /** Adult standing height in metres (emperor penguins are about 1.1–1.2 m). */
  height?: number;
}

/**
 * Instanced emperor-penguin colony (adults with yellow ear patches plus grey chicks) for mid-distance shots.
 * Birds sway and shuffle with a deterministic waddle; they stand on the plane y = 0 of `group`.
 */
export class PenguinColony {
  readonly group = new THREE.Group();
  private adults: THREE.InstancedMesh; private chicks: THREE.InstancedMesh;
  private data: { p: THREE.Vector3; yaw: number; ph: number; s: number }[][] = [[], []];
  private dummy = new THREE.Object3D();

  constructor(o: PenguinColonyOptions = {}) {
    const r = rng(o.seed ?? 21), H = o.height ?? 1.15, spread = o.spread ?? [5, 3];
    const colored = (g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) => {
      const g2 = g.toNonIndexed(); g2.computeVertexNormals();
      const p = g2.attributes.position as THREE.BufferAttribute, n = g2.attributes.normal as THREE.BufferAttribute, c = new Float32Array(p.count * 3), v = new THREE.Vector3(), nn = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { const col = fn(v.fromBufferAttribute(p, i), nn.fromBufferAttribute(n, i)); c.set([col.r, col.g, col.b], i * 3); }
      g2.setAttribute('color', new THREE.BufferAttribute(c, 3)); g2.deleteAttribute('uv');
      return g2;
    };
    const black = new THREE.Color(0x14161b), white = new THREE.Color(0xf3f1ea), yellow = new THREE.Color(0xf2b233), grey = new THREE.Color(0xa9adb3), beak = new THREE.Color(0x2a2320), feet = new THREE.Color(0x1d1b1a);
    const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
    // Unit bird: height 1, facing +Z.
    const build = (chick: boolean) => {
      const body = new THREE.LatheGeometry([[0, 0.02], [0.17, 0.04], [0.215, 0.2], [0.21, 0.42], [0.165, 0.62], [0.1, 0.74], [0, 0.78]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
      body.scale(1, 1, 0.86);
      const head = new THREE.SphereGeometry(0.1, 14, 10).translate(0, 0.84, 0.01);
      const bk = new THREE.ConeGeometry(0.028, 0.14, 8).rotateX(Math.PI / 2).translate(0, 0.845, 0.14);
      const parts = [
        colored(body, (p, n) => chick ? mix(grey, white, (n.z - 0.2) * 0.8) : mix(mix(black, white, (n.z + 0.05) * 3.2), yellow, Math.max(0, (p.y - 0.6) * 5) * Math.max(0, n.z * 1.5) * 0.7)),
        colored(head, (p, n) => chick ? mix(black, white, (p.z - 0.0) * 14 * Math.max(0, 1 - Math.abs(p.y - 0.83) * 9)) : mix(black, yellow, Math.max(0, Math.abs(n.x) - 0.45) * 2.2 * Math.max(0, 1 - Math.abs(p.y - 0.83) * 14) * (p.z > -0.03 ? 1 : 0))),
        colored(bk, () => beak),
      ];
      for (const side of [1, -1]) {
        parts.push(colored(new THREE.SphereGeometry(0.5, 10, 8).scale(0.05, 0.38, 0.13).rotateZ(side * 0.16).translate(side * 0.215, 0.46, 0), () => (chick ? grey : black)));
        parts.push(colored(new THREE.SphereGeometry(0.5, 8, 6).scale(0.11, 0.04, 0.18).translate(side * 0.08, 0.02, 0.07), () => feet));
      }
      return mergeGeometries(parts)!;
    };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    const nA = o.adults ?? 36, nC = o.chicks ?? 12;
    this.adults = new THREE.InstancedMesh(build(false), mat, nA);
    this.chicks = new THREE.InstancedMesh(build(true), mat, nC);
    const place = (n: number, list: any[], scale: () => number, near?: any[]) => {
      for (let i = 0; i < n; i++) {
        let p = new THREE.Vector3(), ok = false, guard = 0;
        while (!ok && guard++ < 60) {
          if (near && near.length) { const host = near[Math.floor(r() * near.length)].p; p.set(host.x + (r() - 0.5) * 0.9, 0, host.z + 0.25 + r() * 0.5); }
          else { const a = r() * 6.283, d = Math.sqrt(r()); p.set(Math.cos(a) * d * spread[0], 0, Math.sin(a) * d * spread[1]); }
          ok = [...this.data[0], ...this.data[1]].every((q) => q.p.distanceTo(p) > 0.48);
        }
        list.push({ p, yaw: (r() - 0.5) * 2.4, ph: r() * 6.283, s: scale() });
      }
    };
    place(nA, this.data[0], () => H * (0.92 + r() * 0.16));
    place(nC, this.data[1], () => H * (0.42 + r() * 0.12), this.data[0]);
    for (const m of [this.adults, this.chicks]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); }
    this.update(0);
  }

  update(time_s: number) {
    const d = this.dummy;
    [this.adults, this.chicks].forEach((mesh, k) => {
      this.data[k].forEach((b, i) => {
        const w = Math.sin(time_s * (k ? 3.1 : 1.7) + b.ph);
        d.position.set(b.p.x + Math.sin(time_s * 0.23 + b.ph) * 0.05, 0, b.p.z);
        d.rotation.set(0, b.yaw + Math.sin(time_s * 0.4 + b.ph * 2) * 0.25, w * (k ? 0.07 : 0.04));
        d.scale.setScalar(b.s); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
}
