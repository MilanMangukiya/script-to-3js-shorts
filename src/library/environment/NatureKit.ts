import * as THREE from 'three';
import { rng, vnoise2, fbm2 } from '../util/math';
import { rockGeometry } from '../space/Asteroids';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PBRLibrary } from '../materials/PBR';

/**
 * nature-kit-v1 — ground-level natural props in metres (base on y = 0): weathered boulders (optionally PBR rock),
 * instanced rock scatter, leafy shrubs, wind-swayed flower patches in several species and saguaro cacti. Use them to
 * break up grass fields, deserts, coasts and parks. Wind-driven pieces animate from `update(t)` only.
 */
export interface BoulderOptions { size?: number; seed?: number; flatten?: number; color?: THREE.ColorRepresentation; pbr?: PBRLibrary; mossy?: number }
export class Boulder {
  readonly mesh: THREE.Mesh;
  constructor(o: BoulderOptions = {}) {
    const g = rockGeometry({ seed: o.seed ?? 3, detail: 5, craters: 0, roughness: 1.3, elongation: 0.35 });
    // rockGeometry's regolith colours are dark linear values (~0.15); use them only as relative variation around `tint`
    // (with a PBR set the texture supplies the albedo, so the default tint is near white).
    const p = g.attributes.position as THREE.BufferAttribute, col = g.attributes.color as THREE.BufferAttribute, f = o.flatten ?? 0.65, c = new THREE.Color(), moss = new THREE.Color(0x4f6b2f), tint = new THREE.Color(o.color ?? (o.pbr ? 0xe8e2d8 : 0x9a9286));
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i); y = y < 0 ? y * 0.35 : y * f; p.setY(i, y + 0.12);
      c.fromBufferAttribute(col, i); const vary = (c.r + c.g + c.b) / 3 / 0.13; c.copy(tint).multiplyScalar(Math.min(1.6, vary));
      const up = y / (f + 0.001), m = (o.mossy ?? 0.3) * THREE.MathUtils.smoothstep(up, 0.35, 0.9) * vnoise2(p.getX(i) * 3, p.getZ(i) * 3, 5);
      c.lerp(moss, m); col.setXYZ(i, c.r, c.g, c.b);
    }
    g.computeVertexNormals();
    const mat = o.pbr ? o.pbr.material('rock_face', { tile: 1.2 }) : new THREE.MeshStandardMaterial({ roughness: 0.92 });
    mat.vertexColors = true;
    if (o.pbr) { const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) + p.getZ(i) * 0.6; uv[i * 2 + 1] = p.getY(i) + p.getZ(i) * 0.3; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    this.mesh = new THREE.Mesh(g, mat); this.mesh.scale.setScalar(o.size ?? 1); this.mesh.castShadow = this.mesh.receiveShadow = true;
  }
}

/** Instanced pebbles-to-rocks scattered over an area, avoiding `reject(x, z)`; heights from `ground(x, z)`. */
export class RockScatter {
  readonly group = new THREE.Group();
  constructor(o: { area: [number, number, number, number]; count?: number; ground?: (x: number, z: number) => number; reject?: (x: number, z: number) => boolean; minSize?: number; maxSize?: number; seed?: number; color?: THREE.ColorRepresentation }) {
    const r = rng(o.seed ?? 8), shapes = 3, n = o.count ?? 400, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, color: o.color ?? 0xb0a898 });
    const meshes = Array.from({ length: shapes }, (_, k) => { const m = new THREE.InstancedMesh(rockGeometry({ seed: 40 + k, detail: 2, craters: 0, roughness: 1.4 }), mat, n); m.castShadow = m.receiveShadow = true; m.count = 0; this.group.add(m); return m; });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const [x0, x1, z0, z1] = o.area;
    for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
      const x = x0 + (x1 - x0) * r(), z = z0 + (z1 - z0) * r(); if (o.reject?.(x, z)) continue;
      const size = (o.minSize ?? 0.04) + ((o.maxSize ?? 0.5) - (o.minSize ?? 0.04)) * Math.pow(r(), 3);
      e.set(r() * 0.6, r() * Math.PI * 2, r() * 0.6); q.setFromEuler(e); s.set(size, size * (0.45 + r() * 0.35), size * (0.7 + r() * 0.5));
      v.set(x, (o.ground?.(x, z) ?? 0) + size * 0.15, z);
      const mesh = meshes[i % shapes]; mesh.setMatrixAt(mesh.count++, m4.compose(v, q, s)); i++;
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }
}

/** Leafy shrub: overlapping noise-displaced foliage lobes with leaf-scale normal breakup and colour variation. */
export class Shrub {
  readonly group = new THREE.Group(); private lobes: THREE.Mesh[] = []; private seed: number;
  constructor(o: { size?: number; seed?: number; color?: THREE.ColorRepresentation; flowers?: THREE.ColorRepresentation } = {}) {
    const r = rng(o.seed ?? 2), S = o.size ?? 1, base = new THREE.Color(o.color ?? 0x3f6b2c); this.seed = o.seed ?? 2;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: false });
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const g = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute('normal').deleteAttribute('uv')), p = g.attributes.position as THREE.BufferAttribute, col = new Float32Array(p.count * 3), c = new THREE.Color(), v = new THREE.Vector3(), sd = (o.seed ?? 2) * 31 + i * 7;
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k);
        const d = 1 + 0.28 * (fbm2(v.x * 2.2 + v.z, v.y * 2.2, sd, 4) - 0.5) + 0.12 * (vnoise2(v.x * 9 + v.y * 3, v.z * 9, sd + 1) - 0.5);
        v.multiplyScalar(d); p.setXYZ(k, v.x, v.y, v.z);
        c.copy(base).offsetHSL((vnoise2(v.x * 5, v.z * 5, sd + 2) - 0.5) * 0.05, 0, (vnoise2(v.x * 14, v.y * 14, sd + 3) - 0.5) * 0.14 + (v.y - 0.3) * 0.06);
        if (o.flowers !== undefined && vnoise2(v.x * 11 + 3, v.y * 11 + v.z * 5, sd + 9) > 0.78 && v.y > -0.2) c.set(o.flowers);
        col.set([c.r, c.g, c.b], k * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat), a = (i / n) * Math.PI * 2 + r(), rad = i === 0 ? 0 : S * (0.25 + r() * 0.3), ls = S * (0.32 + r() * 0.22);
      m.position.set(Math.cos(a) * rad, ls * 0.75 + (i === 0 ? S * 0.2 : r() * S * 0.25), Math.sin(a) * rad); m.scale.set(ls, ls * (0.8 + r() * 0.3), ls);
      m.castShadow = m.receiveShadow = true; this.group.add(m); this.lobes.push(m);
    }
  }
  /** Gentle wind sway (radians of lean). */
  update(t: number, wind = 0.04) { this.lobes.forEach((m, i) => { m.rotation.z = Math.sin(t * 1.3 + i * 1.7 + this.seed) * wind * (0.5 + i * 0.1); m.rotation.x = Math.sin(t * 0.9 + i * 2.3) * wind * 0.6; }); }
}

export type FlowerKind = 'daisy' | 'poppy' | 'tulip' | 'lavender' | 'sunflower';
const FLOWER: Record<FlowerKind, { petals: number; petal: [number, number]; color: number; center: number; height: [number, number]; head: number }> = {
  daisy: { petals: 12, petal: [0.022, 0.006], color: 0xf6f3ea, center: 0xf2b81c, height: [0.18, 0.32], head: 1 },
  poppy: { petals: 5, petal: [0.026, 0.02], color: 0xd8261b, center: 0x1b1712, height: [0.3, 0.5], head: 1 },
  tulip: { petals: 6, petal: [0.03, 0.016], color: 0xe9457a, center: 0xf0c040, height: [0.3, 0.45], head: 1 },
  lavender: { petals: 10, petal: [0.008, 0.006], color: 0x8a6fd1, center: 0x6f56b8, height: [0.35, 0.6], head: 1 },
  sunflower: { petals: 18, petal: [0.06, 0.018], color: 0xf7c21d, center: 0x4a2c12, height: [1.2, 1.9], head: 3 },
};
/** Instanced flowers (stems + heads) over an area, all bending with one wind field in the vertex shader. */
export class FlowerPatch {
  readonly group = new THREE.Group(); private uniforms = { uTime: { value: 0 }, uWind: { value: 0.12 } };
  constructor(o: { area: [number, number, number, number]; kinds?: FlowerKind[]; count?: number; ground?: (x: number, z: number) => number; seed?: number }) {
    const r = rng(o.seed ?? 12), kinds = o.kinds ?? ['daisy', 'poppy'], n = o.count ?? 600, [x0, x1, z0, z1] = o.area;
    // Wind bends every part by its height above the flower's own ground point (per-instance aGround), in model space
    // after instancing, so a stem tip and its head always move together.
    const sway = (m: THREE.Material, invH: number) => { m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, this.uniforms, { uInvH: { value: invH } });
      sh.vertexShader = 'uniform float uTime, uWind, uInvH; attribute float aGround;\n' + sh.vertexShader.replace('mvPosition = modelViewMatrix * mvPosition;', `
        { vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float hh = max(mvPosition.y - aGround, 0.0) * uInvH;
          float bend = (sin(uTime * 1.7 + wp.x * 0.6 + wp.z * 0.4) * 0.6 + sin(uTime * 3.1 + wp.x * 1.3) * 0.25) * uWind * hh * hh / uInvH;
          mvPosition.x += bend; mvPosition.z += bend * 0.4; }
        mvPosition = modelViewMatrix * mvPosition;`); }; return m; };
    kinds.forEach((kind, ki) => {
      const f = FLOWER[kind], per = Math.ceil(n / kinds.length);
      const stem = new THREE.CylinderGeometry(0.0035 * f.head, 0.005 * f.head, 1, 5).translate(0, 0.5, 0);
      const headG = new THREE.Group();
      const pg: THREE.BufferGeometry[] = [];
      for (let k = 0; k < f.petals; k++) { const a = (k / f.petals) * Math.PI * 2, g = new THREE.SphereGeometry(1, 6, 4).scale(f.petal[0], 0.003 * f.head, f.petal[1]).translate(f.petal[0] * 0.9, 0, 0).rotateY(a); if (kind === 'tulip' || kind === 'lavender') g.rotateZ(kind === 'tulip' ? 1.1 : 0.4); pg.push(g); }
      void headG;
      const petals = mergeGeometries(pg), center = new THREE.SphereGeometry(f.petal[0] * (kind === 'sunflower' ? 0.9 : 0.35), 10, 6).scale(1, 0.45, 1);
      const invH = 2 / (f.height[0] + f.height[1]);
      const sm = sway(new THREE.MeshStandardMaterial({ color: 0x4f7a32, roughness: 0.8 }), invH), pm = sway(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }), invH), cm = sway(new THREE.MeshStandardMaterial({ color: f.center, roughness: 0.7 }), invH);
      const stems = new THREE.InstancedMesh(stem, sm, per), heads = new THREE.InstancedMesh(petals, pm, per), centers = new THREE.InstancedMesh(center, cm, per);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color();
      const grounds = new Float32Array(per);
      for (let i = 0; i < per; i++) {
        const x = x0 + (x1 - x0) * r(), z = z0 + (z1 - z0) * r(), y = o.ground?.(x, z) ?? 0, h = f.height[0] + (f.height[1] - f.height[0]) * r();
        grounds[i] = y; q.setFromEuler(e.set(0, r() * 6.28, 0));   // upright stems, so each head sits exactly on its tip
        stems.setMatrixAt(i, m4.compose(v.set(x, y, z), q, s.set(1, h, 1)));
        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(kind === 'sunflower' ? 1.1 : (r() - 0.5) * 0.5, r() * 6.28, 0));
        heads.setMatrixAt(i, m4.compose(v.set(x, y + h, z), tilt, s.setScalar(0.8 + r() * 0.4))); centers.setMatrixAt(i, m4);
        heads.setColorAt(i, col.set(f.color).offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.1));
      }
      for (const m of [stems, heads, centers]) { m.geometry = m.geometry.clone(); m.geometry.setAttribute('aGround', new THREE.InstancedBufferAttribute(grounds, 1)); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); }
      void ki;
    });
  }
  update(t: number, wind = 0.12) { this.uniforms.uTime.value = t; this.uniforms.uWind.value = wind; }
}
// Local copy of BufferGeometryUtils.mergeGeometries for non-indexed petal pieces (same attribute sets).
function mergeGeometries(gs: THREE.BufferGeometry[]) {
  const ng = gs.map((g) => g.index ? g.toNonIndexed() : g), names = Object.keys(ng[0].attributes), out = new THREE.BufferGeometry();
  for (const a of names) { const parts = ng.map((g) => g.attributes[a].array as Float32Array), size = ng[0].attributes[a].itemSize, len = parts.reduce((n, p) => n + p.length, 0), arr = new Float32Array(len); let o = 0; for (const p of parts) { arr.set(p, o); o += p.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, size)); }
  return out;
}

/** Saguaro cactus: ribbed column with upturned arms, spines as fine vertex-colour speckle. */
export class Cactus {
  readonly group = new THREE.Group();
  constructor(o: { height?: number; arms?: number; seed?: number } = {}) {
    const H = o.height ?? 4, r = rng(o.seed ?? 6), R = H * 0.07, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    const ribbed = (len: number, rad: number) => {
      const g = new THREE.CylinderGeometry(rad, rad * 1.05, len, 48, 24).translate(0, len / 2, 0), p = g.attributes.position as THREE.BufferAttribute, col = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), rib = 1 + 0.07 * Math.cos(a * 16), top = y > len - rad ? Math.sqrt(Math.max(0, 1 - Math.pow((y - (len - rad)) / rad, 2))) : 1;
        p.setXYZ(i, x * rib * top, y, z * rib * top); c.set(0x4f7a3a).multiplyScalar(0.85 + 0.2 * Math.cos(a * 16) + (vnoise2(a * 30, y * 30, 3) > 0.8 ? 0.4 : 0)); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
    };
    const trunk = new THREE.Mesh(ribbed(H, R), mat); trunk.castShadow = trunk.receiveShadow = true; this.group.add(trunk);
    const arms = o.arms ?? 1 + Math.floor(r() * 3);
    for (let i = 0; i < arms; i++) {
      const side = i % 2 ? 1 : -1, y0 = H * (0.35 + r() * 0.25), out = R * (2.2 + r()), up = H * (0.25 + r() * 0.25), ar = R * 0.7, a = r() * 6.28;
      const arm = new THREE.Group(); arm.position.set(0, y0, 0); arm.rotation.y = a; this.group.add(arm);
      const elbow = new THREE.Mesh(new THREE.TorusGeometry(out / 2, ar, 16, 24, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a7337, roughness: 0.7 })); elbow.position.set(side * out / 2, out / 2 - out / 2, 0); elbow.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI; elbow.position.y = out / 2; elbow.castShadow = true; arm.add(elbow);
      const col = new THREE.Mesh(ribbed(up, ar), mat); col.position.set(side * out, out / 2, 0); col.castShadow = col.receiveShadow = true; arm.add(col);
    }
  }
}
