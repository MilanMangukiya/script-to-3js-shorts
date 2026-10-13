import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { clamp, fbm2, rng, smoothstep } from '../../../library/util/math';
import { Base, frac, mat, mesh, type Timing } from './common';

/** Landmass height (m above the water) for a tabletop continent: an fbm-warped blob with gentle relief. */
function relief(cx: number, cz: number, sx: number, sz: number, seed: number) {
  return (x: number, z: number) => {
    const dx = (x - cx) / sx, dz = (z - cz) / sz;
    const shape = 1 - Math.sqrt(dx * dx + dz * dz) + (fbm2(x * 2.2 + seed, z * 2.2, seed) - 0.5) * 0.75;
    return shape > 0 ? 0.012 + Math.min(shape, 0.6) * 0.09 + (fbm2(x * 9, z * 9, seed + 4) - 0.5) * 0.02 : -0.04;
  };
}

/** Tabletop schematic of two continents joining: a land bridge rises, animal tokens cross, many southern tokens fade. */
export class DioramaStage extends Base {
  private north = relief(-0.05, -0.78, 0.95, 0.55, 3);
  private south = relief(0.18, 0.86, 0.55, 0.62, 9);
  private bridge: THREE.Mesh;
  private tokens: THREE.InstancedMesh;
  private agents: { home: THREE.Vector3; dest: THREE.Vector3; migrate: boolean; delay: number; fade: number; north: boolean; ph: number }[] = [];
  private tmp = new THREE.Object3D();

  constructor(private T: Timing) {
    super();
    this.scene.background = new THREE.Color(0x0c1016);
    this.camera.near = 0.05; this.camera.far = 60;
    this.scene.add(mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), mat(0x151a21, 0.85), [0, -0.05, 0]));
    const water = mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x2c6d8c, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.9 }), [0, 0, 0]);
    this.scene.add(water);
    const land = (h: (x: number, z: number) => number, cz: number) => {
      const g = new THREE.PlaneGeometry(2.2, 1.6, 180, 130).rotateX(-Math.PI / 2), p = g.attributes.position as THREE.BufferAttribute, col = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i) + cz, y = h(x, z); p.setXYZ(i, x, y, z);
        c.set(0x5f8a45).lerp(new THREE.Color(0xb08a4e), smoothstep(0.03, 0.08, y)).lerp(new THREE.Color(0xd8c8a0), smoothstep(-0.005, -0.03, y - 0.0)).toArray(col, i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
      return mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    };
    this.scene.add(land(this.north, -0.75), land(this.south, 0.8));
    // Land bridge: a narrow isthmus that rises from the water.
    const bg = new THREE.BoxGeometry(0.14, 0.05, 0.62, 8, 1, 24), bp = bg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) { const z = bp.getZ(i); bp.setX(i, bp.getX(i) * (0.8 + 0.4 * Math.abs(Math.sin(z * 9))) + 0.06 * Math.sin(z * 4)); }
    bg.computeVertexNormals();
    this.bridge = mesh(bg, new THREE.MeshStandardMaterial({ color: 0x6f8f4a, roughness: 0.9 }), [0.05, -0.05, 0.02]);
    this.scene.add(this.bridge);
    // Animal tokens: a rounded body with a small head; teal = northern, orange = southern.
    const body = new THREE.CapsuleGeometry(0.012, 0.022, 4, 8).rotateZ(Math.PI / 2).translate(0, 0.016, 0);
    const head = new THREE.SphereGeometry(0.009, 8, 6).translate(0.022, 0.026, 0);
    const tokenGeo = new THREE.BufferGeometry().copy(body); const merged = mergeTwo(tokenGeo, head);
    const n = 150; this.tokens = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 }), n);
    const r = rng(23), c = new THREE.Color();
    const sample = (h: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number) => { for (let k = 0; k < 400; k++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0); if (h(x, z) > 0.02) return new THREE.Vector3(x, h(x, z), z); } return new THREE.Vector3(0, 0.02, 0); };
    for (let i = 0; i < n; i++) {
      const isNorth = i < n / 2, migrate = r() < 0.42;
      const home = isNorth ? sample(this.north, -0.9, 0.85, -1.25, -0.4) : sample(this.south, -0.35, 0.7, 0.4, 1.35);
      const dest = isNorth ? sample(this.south, -0.35, 0.7, 0.45, 1.3) : sample(this.north, -0.9, 0.85, -1.2, -0.45);
      this.agents.push({ home, dest, migrate, delay: r() * 0.3, fade: !isNorth && r() < 0.55 ? 0.5 + r() * 0.32 : 2, north: isNorth, ph: r() * 6.283 });
      this.tokens.setColorAt(i, c.set(isNorth ? 0x4fd1c5 : 0xff9a3c).multiplyScalar(0.85 + r() * 0.3));
    }
    this.tokens.frustumCulled = false; this.scene.add(this.tokens);
    const key = new THREE.DirectionalLight(0xfff1e0, 2.2); key.position.set(-2, 4, 2);
    const rim = new THREE.DirectionalLight(0x9cc8ff, 0.9); rim.position.set(3, 2, -3);
    this.scene.add(key, rim, new THREE.HemisphereLight(0x8a9bb0, 0x101418, 0.55));
  }

  update(t: number, _shot: ShotInfo) {
    const u = frac(this.T, 'S06/SH01', t), rise = smoothstep(0.05, 0.25, u);
    this.bridge.position.y = -0.05 + 0.075 * rise;
    const bridgeN = new THREE.Vector3(0.02, 0.03, -0.3), bridgeS = new THREE.Vector3(0.08, 0.03, 0.33);
    this.agents.forEach((a, i) => {
      let p: THREE.Vector3;
      const k = a.migrate ? clamp((u - 0.25 - a.delay) / 0.4) : 0, e = k * k * (3 - 2 * k);
      if (!a.migrate || k <= 0) p = a.home.clone();
      else {   // home → bridge end → other bridge end → destination
        const [b0, b1] = a.north ? [bridgeN, bridgeS] : [bridgeS, bridgeN];
        p = e < 0.35 ? a.home.clone().lerp(b0, e / 0.35) : e < 0.65 ? b0.clone().lerp(b1, (e - 0.35) / 0.3) : b1.clone().lerp(a.dest, (e - 0.65) / 0.35);
        p.y = Math.max(p.y, 0.03);
      }
      const wob = Math.sin(t * 2.1 + a.ph) * 0.004, s = 1 - smoothstep(a.fade, a.fade + 0.1, u);
      this.tmp.position.set(p.x + wob, p.y, p.z + Math.cos(t * 1.7 + a.ph) * 0.004);
      const heading = a.migrate && k > 0 && k < 1 ? (a.north ? Math.PI / 2 : -Math.PI / 2) : a.ph;
      this.tmp.rotation.set(0, heading, 0); this.tmp.scale.setScalar(Math.max(s, 0.0001)); this.tmp.updateMatrix();
      this.tokens.setMatrixAt(i, this.tmp.matrix);
    });
    this.tokens.instanceMatrix.needsUpdate = true;
  }
}

/** Merge two non-indexed copies of geometries (positions and normals only). */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const A = a.index ? a.toNonIndexed() : a, B = b.index ? b.toNonIndexed() : b, out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal'] as const) {
    const x = A.attributes[name].array as Float32Array, y = B.attributes[name].array as Float32Array, m = new Float32Array(x.length + y.length);
    m.set(x); m.set(y, x.length); out.setAttribute(name, new THREE.BufferAttribute(m, 3));
  }
  return out;
}
