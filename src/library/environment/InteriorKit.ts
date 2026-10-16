import * as THREE from 'three';
import { rng } from '../util/math';
import { projectUVs, type PBRLibrary } from '../materials/PBR';

/**
 * Interior dressing kit (metres; each item's origin is documented on its class): pleated curtains on a rod, framed
 * art with procedurally painted pictures, patterned rugs with fringes, and a bookshelf filled with varied books.
 * Everything is seeded and deterministic, so rooms can be furnished differently film to film.
 */

/** Two pleated curtain panels on a rod. Origin: centre of the rod; panels hang toward −Y in the XY plane (face +Z). */
export interface CurtainOptions { width?: number; height?: number; color?: THREE.ColorRepresentation; openFraction?: number; pbr?: PBRLibrary; fabricSet?: string; sheer?: boolean }
export class Curtains {
  readonly group = new THREE.Group();
  private panels: THREE.Mesh[] = []; private base: Float32Array[] = [];
  constructor(o: CurtainOptions = {}) {
    const W = o.width ?? 1.6, H = o.height ?? 1.6, open = o.openFraction ?? 0.62, pw = (W / 2) * (1 - open * 0.72);
    const mat = o.pbr ? o.pbr.material(o.fabricSet ?? 'cotton_jersey', { tint: o.color ?? 0xd9cdb8, tile: 0.6, side: THREE.DoubleSide, normalScale: 0.8 })
      : new THREE.MeshStandardMaterial({ color: o.color ?? 0xd9cdb8, roughness: 0.9, side: THREE.DoubleSide });
    if (o.sheer) { mat.transparent = true; mat.opacity = 0.55; }
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x3b3027, roughness: 0.4, metalness: 0.5 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, W + 0.3, 12).rotateZ(Math.PI / 2), rodMat); rod.castShadow = true; this.group.add(rod);
    for (const side of [-1, 1]) {
      const g = new THREE.PlaneGeometry(pw, H, 48, 24), p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), v = (y + H / 2) / H, u = (x + pw / 2) / pw;
        const pleat = Math.sin(u * Math.PI * 2 * Math.max(3, Math.round(pw / 0.11))) * (0.028 + 0.012 * (1 - v));   // deeper folds toward the hem
        const tie = side * 0.04 * (1 - v) * (1 - v) * Math.sin(u * Math.PI);   // hem swings slightly toward the wall
        p.setXYZ(i, x + side * (W / 2 - pw / 2) + tie, y - H / 2 - 0.03, pleat + 0.035);
      }
      g.computeVertexNormals(); projectUVs(g);
      const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; this.group.add(m); this.panels.push(m);
      this.base.push(Float32Array.from(p.array as Float32Array));
    }
  }
  /** Gentle deterministic billow (0 = still). */
  update(time_s: number, breeze = 0) {
    if (breeze <= 0) return;
    this.panels.forEach((m, k) => {
      const p = m.geometry.attributes.position as THREE.BufferAttribute, b = this.base[k];
      for (let i = 0; i < p.count; i++) { const y = b[i * 3 + 1], hang = Math.max(0, -y); p.setZ(i, b[i * 3 + 2] + breeze * 0.03 * hang * Math.sin(time_s * 1.3 + b[i * 3] * 4 + k)); }
      p.needsUpdate = true; m.geometry.computeVertexNormals();
    });
  }
}

/** Framed picture. Origin: centre of the frame's back, picture facing +Z. */
export interface FramedPictureOptions { width?: number; height?: number; art?: 'landscape' | 'abstract' | 'botanical' | 'seascape'; frameColor?: THREE.ColorRepresentation; mat?: boolean; seed?: number }
export class FramedPicture {
  readonly group = new THREE.Group();
  constructor(o: FramedPictureOptions = {}) {
    const W = o.width ?? 0.6, H = o.height ?? 0.45, F = 0.035, r = rng(o.seed ?? 3);
    const frame = new THREE.MeshStandardMaterial({ color: o.frameColor ?? 0x2b2420, roughness: 0.45, metalness: 0.1 });
    for (const [w, h, x, y] of [[W + 2 * F, F, 0, H / 2 + F / 2], [W + 2 * F, F, 0, -H / 2 - F / 2], [F, H, -W / 2 - F / 2, 0], [F, H, W / 2 + F / 2, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), frame); b.position.set(x, y, 0.015); b.castShadow = true; this.group.add(b);
    }
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * H / W); const g = c.getContext('2d')!, cw = c.width, ch = c.height;
    const pad = o.mat === false ? 0 : Math.round(cw * 0.08);
    g.fillStyle = '#f2ede3'; g.fillRect(0, 0, cw, ch);
    const ax = pad, ay = pad, aw = cw - 2 * pad, ah = ch - 2 * pad, art = o.art ?? 'landscape';
    const hue = Math.floor(r() * 360);
    if (art === 'landscape' || art === 'seascape') {
      const sky = g.createLinearGradient(0, ay, 0, ay + ah * 0.6); sky.addColorStop(0, `hsl(${(hue + 200) % 360},45%,72%)`); sky.addColorStop(1, `hsl(${(hue + 30) % 360},70%,82%)`);
      g.fillStyle = sky; g.fillRect(ax, ay, aw, ah);
      g.fillStyle = `hsl(${(hue + 30) % 360},85%,70%)`; g.beginPath(); g.arc(ax + aw * (0.3 + r() * 0.4), ay + ah * 0.45, aw * 0.07, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 4; k++) {   // layered hills (or swells), receding in tone
        const base = ay + ah * (0.5 + k * 0.13), l = 30 + k * 10;
        g.fillStyle = art === 'seascape' ? `hsl(${195 + k * 5},${45 + k * 5}%,${55 - k * 8}%)` : `hsl(${(hue + 90 + k * 12) % 360},${30 + k * 8}%,${l}%)`;
        g.beginPath(); g.moveTo(ax, ay + ah); for (let x = 0; x <= aw; x += 8) g.lineTo(ax + x, base + Math.sin(x * 0.012 * (k + 1) + k * 2 + r()) * ah * 0.05); g.lineTo(ax + aw, ay + ah); g.fill();
      }
    } else if (art === 'abstract') {
      g.fillStyle = `hsl(${hue},30%,88%)`; g.fillRect(ax, ay, aw, ah);
      for (let k = 0; k < 7; k++) { g.fillStyle = `hsla(${(hue + k * 47) % 360},${50 + r() * 30}%,${45 + r() * 25}%,0.85)`;
        if (r() < 0.5) { g.beginPath(); g.arc(ax + r() * aw, ay + r() * ah, aw * (0.06 + r() * 0.16), 0, Math.PI * 2); g.fill(); } else g.fillRect(ax + r() * aw * 0.7, ay + r() * ah * 0.7, aw * (0.1 + r() * 0.3), ah * (0.08 + r() * 0.25)); }
    } else {
      g.fillStyle = '#efe7d6'; g.fillRect(ax, ay, aw, ah); g.strokeStyle = '#4c6b45'; g.lineWidth = 3;
      for (let k = 0; k < 9; k++) { const x0 = ax + aw * 0.5, y0 = ay + ah * 0.92, a = -Math.PI / 2 + (k - 4) * 0.22; g.beginPath(); g.moveTo(x0, y0);
        const x1 = x0 + Math.cos(a) * ah * 0.7, y1 = y0 + Math.sin(a) * ah * 0.7; g.quadraticCurveTo(x0 + Math.cos(a) * ah * 0.3, y0 + Math.sin(a) * ah * 0.5, x1, y1); g.stroke();
        g.fillStyle = `hsl(${100 + k * 6},35%,${38 + k * 3}%)`; g.beginPath(); g.ellipse(x1, y1, aw * 0.04, ah * 0.07, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.6, clearcoat: 0.6, clearcoatRoughness: 0.08 }));
    pic.position.z = 0.012; pic.receiveShadow = true; this.group.add(pic);
  }
}

/** Patterned rug with fringes. Origin: rug centre on the floor (y = 0), length along Z. */
export interface RugOptions { width?: number; length?: number; colors?: THREE.ColorRepresentation[]; pattern?: 'kilim' | 'border' | 'stripes'; seed?: number }
export class Rug {
  readonly group = new THREE.Group();
  constructor(o: RugOptions = {}) {
    const W = o.width ?? 1.4, L = o.length ?? 2.0, r = rng(o.seed ?? 5), cols = (o.colors ?? [0x8c3b2f, 0xe8dcc4, 0x2f4f6a, 0xc9953f]).map((c) => `#${new THREE.Color(c).getHexString()}`);
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * L / W); const g = c.getContext('2d')!, cw = c.width, ch = c.height, pat = o.pattern ?? 'kilim';
    g.fillStyle = cols[0]; g.fillRect(0, 0, cw, ch);
    g.fillStyle = cols[1]; g.fillRect(12, 12, cw - 24, ch - 24); g.fillStyle = cols[0]; g.fillRect(22, 22, cw - 44, ch - 44);
    if (pat === 'kilim') for (let y = 40; y < ch - 40; y += 46) for (let x = 40; x < cw - 30; x += 46) {
      g.fillStyle = cols[2 + ((x + y) / 46 | 0) % (cols.length - 2)]; g.beginPath(); g.moveTo(x, y + 18); g.lineTo(x + 18, y); g.lineTo(x + 36, y + 18); g.lineTo(x + 18, y + 36); g.fill();
      g.fillStyle = cols[1]; g.fillRect(x + 14, y + 14, 8, 8); }
    else if (pat === 'stripes') for (let y = 30; y < ch - 30; y += 18) { g.fillStyle = cols[1 + ((y / 18) | 0) % (cols.length - 1)]; g.fillRect(22, y, cw - 44, 9); }
    else { g.strokeStyle = cols[2] ?? cols[1]; g.lineWidth = 6; g.strokeRect(40, 40, cw - 80, ch - 80); g.fillStyle = cols[3] ?? cols[1]; g.beginPath(); g.ellipse(cw / 2, ch / 2, cw * 0.18, ch * 0.12, 0, 0, Math.PI * 2); g.fill(); }
    // Woven grain.
    g.globalAlpha = 0.07; for (let y = 0; y < ch; y += 2) { g.fillStyle = y % 4 ? '#000' : '#fff'; g.fillRect(0, y, cw, 1); } g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(W, L, 20, 28).rotateX(-Math.PI / 2), p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, 0.006 + 0.003 * Math.sin(p.getX(i) * 9 + r() * 0.2) * Math.sin(p.getZ(i) * 7));
    geo.computeVertexNormals();
    const rug = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96 })); rug.receiveShadow = true; this.group.add(rug);
    const fringe = new THREE.MeshStandardMaterial({ color: 0xe9dfc9, roughness: 1 });
    for (const end of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.96, 0.06).rotateX(-Math.PI / 2), fringe); f.position.set(0, 0.004, end * (L / 2 + 0.03)); f.receiveShadow = true; this.group.add(f); }
  }
}

/** Bookshelf against a wall. Origin: floor centre of the case, front facing +Z. */
export interface BookshelfOptions { width?: number; height?: number; depth?: number; shelves?: number; fill?: number; seed?: number; pbr?: PBRLibrary; woodTint?: THREE.ColorRepresentation }
export class Bookshelf {
  readonly group = new THREE.Group();
  constructor(o: BookshelfOptions = {}) {
    const W = o.width ?? 0.9, H = o.height ?? 1.8, Dp = o.depth ?? 0.3, N = o.shelves ?? 5, r = rng(o.seed ?? 21), T = 0.02;
    const wood = o.pbr ? o.pbr.material('wood_table_001', { tint: o.woodTint ?? 0x9a7a5a, tile: 0.8 }) : new THREE.MeshStandardMaterial({ color: o.woodTint ?? 0x7a5a3e, roughness: 0.6 });
    const add = (w: number, h: number, d: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(w, h, d)), wood); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; this.group.add(m); };
    add(T, H, Dp, -W / 2 + T / 2, H / 2, 0); add(T, H, Dp, W / 2 - T / 2, H / 2, 0); add(W, T, Dp, 0, H - T / 2, 0); add(W, 0.06, Dp, 0, 0.03, 0); add(W, H, 0.01, 0, H / 2, -Dp / 2 + 0.005);
    const gap = (H - 0.08) / N, books: { w: number; h: number; d: number; x: number; y: number; lean: number; c: THREE.Color }[] = [];
    const PAL = [0x7b2d26, 0x2d4a6b, 0x35563b, 0xc79a3c, 0x5b3a62, 0xe3d6bd, 0x2a2a2a, 0x9c5b2e, 0x4f7f8f, 0xb8452f];
    for (let s = 0; s < N; s++) {
      const y0 = 0.06 + s * gap; if (s > 0) add(W - 2 * T, T, Dp - 0.01, 0, y0, 0.005);
      let x = -W / 2 + T + 0.01; const end = W / 2 - T - (0.06 + r() * 0.2) * (1 - (o.fill ?? 0.8));
      while (x < end) {
        const w = 0.018 + r() * 0.03, h = Math.min(gap - 0.03, 0.17 + r() * 0.12), lean = r() < 0.08 ? 0.22 : 0;
        if (x + w > end) break;
        books.push({ w, h, d: Dp * (0.7 + r() * 0.2), x: x + w / 2, y: y0 + T / 2, lean, c: new THREE.Color(PAL[Math.floor(r() * PAL.length)]).multiplyScalar(0.85 + r() * 0.3) });
        x += w + (lean ? 0.03 : 0.001);
        if (r() < 0.06) x += 0.05 + r() * 0.06;   // a gap here and there
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), books.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    books.forEach((b, i) => { e.set(0, 0, b.lean); q.setFromEuler(e); m.compose(new THREE.Vector3(b.x, b.y, -Dp / 2 + 0.01 + b.d / 2), q, new THREE.Vector3(b.w, b.h, b.d)); inst.setMatrixAt(i, m); inst.setColorAt(i, b.c); });
    inst.castShadow = inst.receiveShadow = true; this.group.add(inst);
  }
}
