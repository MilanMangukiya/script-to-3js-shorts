import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../util/math';

export interface VillageHousesOptions {
  /** One house per site: [x, z, yaw radians]; yaw 0 faces +Z, so −π/2 faces −X. */
  sites: [number, number, number][];
  /** Ground height under a site (default 0). */
  ground?: (x: number, z: number) => number;
  seed?: number;
  /** Ranges in metres: width (along the front), depth, wall height. */
  width?: [number, number]; depth?: [number, number]; height?: [number, number];
  /** Roof rise as a fraction of the width (default 0.32–0.45). */
  roofPitch?: [number, number];
  wallColors?: THREE.ColorRepresentation[]; roofColors?: THREE.ColorRepresentation[];
  /** Warm interior light colour of lit windows, and the fraction of windows lit. */
  windowColor?: THREE.ColorRepresentation; litFraction?: number;
  /** Stilt height in metres (0 = built on the ground). */
  stilts?: number;
}

/**
 * Seeded row of small gabled houses (walls, overhanging roofs, doors, lit and dark windows, optional stilts), merged
 * into four draw calls. Static geometry; `glow` scales the window light for dusk, storms or flicker.
 */
export class VillageHouses {
  readonly group = new THREE.Group();
  private windowMat: THREE.MeshBasicMaterial;

  constructor(o: VillageHousesOptions) {
    const r = rng(o.seed ?? 7), ground = o.ground ?? (() => 0);
    const W = o.width ?? [4, 6], D = o.depth ?? [3.6, 5], H = o.height ?? [2.6, 3.4], P = o.roofPitch ?? [0.32, 0.45];
    const walls = (o.wallColors ?? [0xd9cbb0, 0xc9b79a, 0xb7c4c0, 0xd4b8a0, 0xe0d6c4, 0xa9b49c]).map((c) => new THREE.Color(c));
    const roofs = (o.roofColors ?? [0x5a3a2e, 0x4a4d52, 0x6b4a36, 0x3e4a4f]).map((c) => new THREE.Color(c));
    const warm = new THREE.Color(o.windowColor ?? 0xffb46a), dark = new THREE.Color(0x10141a), door = new THREE.Color(0x3a2c22);
    const stilt = o.stilts ?? 0, lit = o.litFraction ?? 0.6;
    const parts: Record<'wall' | 'roof' | 'glass' | 'wood', THREE.BufferGeometry[]> = { wall: [], roof: [], glass: [], wood: [] };
    const tint = (g: THREE.BufferGeometry, c: THREE.Color) => {
      const geo = g.index ? g.toNonIndexed() : g, n = geo.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.toArray(a, i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      return geo;
    };
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
    const lerp = (a: [number, number]) => a[0] + r() * (a[1] - a[0]);
    for (const [x, z, yaw] of o.sites) {
      const w = lerp(W), d = lerp(D), h = lerp(H), rise = w * lerp(P), y0 = ground(x, z) + stilt;
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, ground(x, z), z);
      const add = (k: keyof typeof parts, g: THREE.BufferGeometry, c: THREE.Color) => parts[k].push(tint(g, c).applyMatrix4(m));
      const wall = pick(walls);
      add('wall', new THREE.BoxGeometry(w, h, d).translate(0, y0 + h / 2, 0), wall);
      // Gabled roof: two sloped planes and two gable triangles, overhanging the walls.
      const ow = w / 2 + 0.3, od = d / 2 + 0.35, ry = y0 + h, roof = new THREE.BufferGeometry();
      const v = [
        -ow, ry, -od, -ow, ry, od, 0, ry + rise, od, -ow, ry, -od, 0, ry + rise, od, 0, ry + rise, -od,
        ow, ry, od, ow, ry, -od, 0, ry + rise, -od, ow, ry, od, 0, ry + rise, -od, 0, ry + rise, od,
      ];
      roof.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); roof.computeVertexNormals();
      add('roof', roof, pick(roofs));
      const gable = new THREE.BufferGeometry(), gw = w / 2, gz = d / 2 + 0.005;
      gable.setAttribute('position', new THREE.Float32BufferAttribute([-gw, ry, gz, gw, ry, gz, 0, ry + rise * (gw / ow), gz, gw, ry, -gz, -gw, ry, -gz, 0, ry + rise * (gw / ow), -gz], 3));
      gable.computeVertexNormals(); add('wall', gable, wall.clone().multiplyScalar(0.92));
      // Front: a door and windows either side; one window per side wall.
      add('wood', new THREE.PlaneGeometry(0.9, 1.9).translate(-w * 0.22, y0 + 0.95, d / 2 + 0.01), door);
      for (const fx of [w * 0.14, w * 0.36]) add('glass', new THREE.PlaneGeometry(0.75, 0.85).translate(fx, y0 + h * 0.58, d / 2 + 0.012), r() < lit ? warm : dark);
      for (const s of [-1, 1]) add('glass', new THREE.PlaneGeometry(0.75, 0.85).rotateY(s * Math.PI / 2).translate(s * (w / 2 + 0.012), y0 + h * 0.58, 0), r() < lit ? warm : dark);
      if (stilt > 0) for (const sx of [-1, 1]) for (const sz of [-1, 1])
        add('wood', new THREE.CylinderGeometry(0.09, 0.11, stilt + 0.3, 6).translate(sx * (w / 2 - 0.2), ground(x, z) + (stilt + 0.3) / 2 - 0.3, sz * (d / 2 - 0.2)), door);
    }
    const merged = (k: keyof typeof parts) => (parts[k].length ? mergeGeometries(parts[k]) : new THREE.BufferGeometry());
    this.windowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) });
    const meshes = [
      new THREE.Mesh(merged('wall'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })),
      new THREE.Mesh(merged('roof'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })),
      new THREE.Mesh(merged('wood'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })),
      new THREE.Mesh(merged('glass'), this.windowMat),
    ];
    for (const mesh of meshes) { mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh); }
  }

  /** Window light multiplier (1.6 by default). */
  set glow(v: number) { this.windowMat.color.setScalar(v); }
}
