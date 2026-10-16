import * as THREE from 'three';
import { rng } from '../util/math';

/**
 * Beach set dressing: a striped parasol (scalloped gores sagging between ribs, a scalloped valance, wooden pole tilted
 * into the sun) and a striped towel draped over the sand. Metres; origins on the ground. Colours are parameters, so
 * every beach can look different. Static (wind flutter via `BeachParasol.update(time_s, wind)` is deterministic).
 */
export interface BeachParasolOptions {
  radius?: number; height?: number; gores?: number;
  colors?: THREE.ColorRepresentation[];
  /** Pole tilt (radians) and the azimuth it tilts toward. */
  tilt?: number; tiltDir?: number;
}

export class BeachParasol {
  readonly group = new THREE.Group();
  private canopy: THREE.Group = new THREE.Group();
  constructor(o: BeachParasolOptions = {}) {
    const R = o.radius ?? 1.05, H = o.height ?? 2.15, G = o.gores ?? 8, cols = (o.colors ?? [0xe0533d, 0xf4efe4]).map((c) => new THREE.Color(c));
    const wood = new THREE.MeshStandardMaterial({ color: 0xc9a36b, roughness: 0.55 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, H, 10).translate(0, H / 2, 0), wood); pole.castShadow = true; this.group.add(pole);
    // Canopy: G gores, each a radial/angular grid that sags between its two ribs; vertex colours alternate per gore.
    const pos: number[] = [], col: number[] = [], idx: number[] = [], NR = 8, NU = 6;
    for (let g = 0; g < G; g++) {
      const a0 = (g / G) * Math.PI * 2, a1 = ((g + 1) / G) * Math.PI * 2, c = cols[g % cols.length], base = pos.length / 3;
      for (let i = 0; i <= NR; i++) for (let j = 0; j <= NU; j++) {
        const r = i / NR, u = j / NU, a = a0 + (a1 - a0) * u, sag = 0.07 * R * r * Math.sin(Math.PI * u) * (0.6 + 0.4 * r);
        const y = 0.36 * R * (1 - Math.pow(r, 1.7)) - sag, rr = R * r * (1 - 0.04 * Math.sin(Math.PI * u));
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); col.push(c.r, c.g, c.b);
      }
      for (let i = 0; i < NR; i++) for (let j = 0; j < NU; j++) { const k = base + i * (NU + 1) + j; idx.push(k, k + 1, k + NU + 1, k + 1, k + NU + 2, k + NU + 1); }
      // Scalloped valance hanging from the rim.
      const vb = pos.length / 3;
      for (let j = 0; j <= NU; j++) {
        const u = j / NU, a = a0 + (a1 - a0) * u, rr = R * (1 - 0.04 * Math.sin(Math.PI * u)), y0 = -0.07 * R * Math.sin(Math.PI * u), drop = 0.09 + 0.035 * Math.sin(Math.PI * u);
        pos.push(Math.cos(a) * rr, y0, Math.sin(a) * rr, Math.cos(a) * rr * 1.01, y0 - drop, Math.sin(a) * rr * 1.01);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      for (let j = 0; j < NU; j++) { const k = vb + j * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
    const c = new THREE.Mesh(geo, cloth); c.castShadow = c.receiveShadow = true; this.canopy.add(c);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), wood); fin.position.y = 0.36 * R + 0.02; this.canopy.add(fin);
    // Pole and canopy tilt together about the pole's foot; the group yaw picks the tilt direction.
    const tilt = o.tilt ?? 0.12, along = H - 0.38 * R;
    pole.rotation.z = this.canopy.rotation.z = tilt; this.canopy.position.set(-Math.sin(tilt) * along, Math.cos(tilt) * along, 0);
    this.group.add(this.canopy); this.group.rotation.y = o.tiltDir ?? 0;
  }
  update(time_s: number, wind = 0.5) { this.canopy.rotation.x = 0.012 * wind * Math.sin(time_s * 2.1) + 0.006 * wind * Math.sin(time_s * 5.3); }
}

export interface BeachTowelOptions {
  width?: number; length?: number; colors?: THREE.ColorRepresentation[]; stripes?: number;
  /** Ground height under the towel (world x, z) so it drapes over the sand; the towel's own placement is applied first. */
  ground?: (x: number, z: number) => number; position?: [number, number]; yaw?: number; seed?: number;
}

export class BeachTowel {
  readonly mesh: THREE.Mesh;
  constructor(o: BeachTowelOptions = {}) {
    const W = o.width ?? 0.85, L = o.length ?? 1.75, [px, pz] = o.position ?? [0, 0], yaw = o.yaw ?? 0, ground = o.ground ?? (() => 0), r = rng(o.seed ?? 7);
    const geo = new THREE.PlaneGeometry(W, L, 24, 48).rotateX(-Math.PI / 2), p = geo.attributes.position as THREE.BufferAttribute, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const w1 = r() * 6, w2 = r() * 6;
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), lz = p.getZ(i), x = px + lx * cy + lz * sy, z = pz - lx * sy + lz * cy;
      const wrinkle = 0.006 * Math.sin(lz * 9 + w1) * Math.sin(lx * 7 + w2) + 0.004 * Math.sin(lz * 23 + lx * 5);
      p.setXYZ(i, x, ground(x, z) + 0.012 + wrinkle, z);
    }
    geo.computeVertexNormals();
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d')!;
    const cols = (o.colors ?? [0x2f7fbf, 0xf3efe6, 0xf2b93b]).map((c) => `#${new THREE.Color(c).getHexString()}`), n = o.stripes ?? 9;
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(0, (i / n) * 256, 64, 256 / n + 1); }
    g.globalAlpha = 0.08; for (let i = 0; i < 1200; i++) { g.fillStyle = i % 2 ? '#000' : '#fff'; g.fillRect((i * 37) % 64, (i * 53) % 256, 1, 1); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    this.mesh.receiveShadow = true; this.mesh.castShadow = false;
  }
}
