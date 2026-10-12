import * as THREE from 'three';
import { rng } from '../util/math';

export interface SailboatOptions {
  /** Hull length in metres (beam, mast and sails scale with it). */
  length?: number;
  hullColor?: THREE.ColorRepresentation; sailColor?: THREE.ColorRepresentation; deckColor?: THREE.ColorRepresentation;
  /** Sails up (sailing) or furled (moored: bare mast, sail covers). */
  sails?: boolean;
  seed?: number;
}
export interface SailboatState {
  /** Heel angle in radians; positive leans the mast toward local -Z, the side the sails are eased out to (leeward). */
  heel?: number;
  /** Bobbing amplitude multiplier (1 = moderate sea). */
  bob?: number;
}

/**
 * Small sloop: hull with sheer and a rounded section, deck and cabin, mast and boom, cambered mainsail and jib.
 * Local frame: bow toward +X, mast up +Y, waterline at y = 0, sails eased toward -Z (wind from +Z). `update(time_s, state)` applies heel and a gentle,
 * seeded bob, so sailing and moored boats stay deterministic.
 */
export class Sailboat {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private ph: number[];

  constructor(o: SailboatOptions = {}) {
    const L = o.length ?? 10, B = L * 0.33, r = rng(o.seed ?? 4);
    this.ph = [r() * 6.28, r() * 6.28, r() * 6.28];
    this.group.add(this.body);
    // Hull: stations along x with U-shaped sections; freeboard rises toward the bow. Vertex colours paint a navy
    // boot stripe at the waterline and dark antifouling below it.
    const halfAt = (u: number) => (B / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)), 0.55) * (u > 0.75 ? 1 - Math.pow((u - 0.75) / 0.25, 2) * 0.9 : 1);
    const nu = 40, nv = 14, pos: number[] = [], col: number[] = [], idx: number[] = [];
    const cHull = new THREE.Color(o.hullColor ?? 0xf4f2ec), cStripe = new THREE.Color(0x1e3a5c), cBottom = new THREE.Color(0x5a2a26);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, x = (u - 0.5) * L, half = Math.max(halfAt(u), 0.02);
      const fb = L * (0.07 + 0.035 * u), dr = L * 0.075 * Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05));
      for (let j = 0; j <= nv; j++) {
        const a = (j / nv) * Math.PI - Math.PI / 2, s = Math.sin(a), c = Math.cos(a);
        const y = fb - (fb + dr) * Math.pow(c, 0.7);
        pos.push(x, y, half * Math.sign(s) * Math.pow(Math.abs(s), 0.55));
        const k = y > L * 0.026 ? cHull : y > 0 ? cStripe : cBottom; col.push(k.r, k.g, k.b);
      }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const hullGeo = new THREE.BufferGeometry(); hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hullGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    hullGeo.setIndex(idx); hullGeo.computeVertexNormals();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide });
    const hull = new THREE.Mesh(hullGeo, hullMat); hull.castShadow = true; this.body.add(hull);
    // Deck and cabin.
    const deckShape = new THREE.Shape();
    for (let i = 0; i <= nu; i++) { const u = i / nu, x = (u - 0.5) * L; if (i === 0) deckShape.moveTo(x, -halfAt(u)); else deckShape.lineTo(x, -halfAt(u)); }
    for (let i = nu; i >= 0; i--) { const u = i / nu; deckShape.lineTo((u - 0.5) * L, halfAt(u)); }
    const deck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: o.deckColor ?? 0xb89a72, roughness: 0.8 }));
    deck.position.y = L * 0.08; this.body.add(deck);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, L * 0.05, B * 0.5), new THREE.MeshStandardMaterial({ color: o.hullColor ?? 0xf4f2ec, roughness: 0.35 })); cabin.position.set(-L * 0.05, L * 0.11, 0); cabin.castShadow = true; this.body.add(cabin);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(L * 0.22, L * 0.012, B * 0.52), new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.1, metalness: 0.4 }));
    glass.position.set(-L * 0.05, L * 0.115, 0); this.body.add(glass);
    // Rig.
    const metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.9 });
    const mastH = L * 1.35, mastX = L * 0.08;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.006, L * 0.008, mastH, 8).translate(0, mastH / 2, 0), metal); mast.position.set(mastX, L * 0.09, 0); mast.castShadow = true; this.body.add(mast);
    const boomLen = L * 0.42, boomY = L * 0.2;
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.005, L * 0.005, boomLen, 8).rotateZ(Math.PI / 2).translate(-boomLen / 2, 0, 0), metal);
    boom.position.set(mastX, boomY, 0); this.body.add(boom);
    const sailMat = new THREE.MeshStandardMaterial({ color: o.sailColor ?? 0xf7f5ef, roughness: 0.75, side: THREE.DoubleSide, emissive: 0x2a2620, emissiveIntensity: 0.25 });
    if (o.sails !== false) {
      // Mainsail: triangle luff (mast) - head - clew (boom end) with camber toward -Z (leeward when heeling to -Z).
      const main = sailGeometry(new THREE.Vector3(mastX, boomY, 0), new THREE.Vector3(mastX, L * 0.09 + mastH * 0.96, 0), new THREE.Vector3(mastX - boomLen * 0.98, boomY, 0), L * 0.06);
      // Boom and mainsail swing together about the mast, eased out to leeward.
      const ms = new THREE.Mesh(main, sailMat); ms.castShadow = true; ms.position.x = -mastX;
      const pivot = new THREE.Group(); pivot.position.x = mastX; pivot.add(ms); pivot.rotation.y = -0.32; this.body.add(pivot);
      boom.rotation.y = -0.32;
      const jib = sailGeometry(new THREE.Vector3(L * 0.48, L * 0.1, 0), new THREE.Vector3(mastX + L * 0.01, L * 0.09 + mastH * 0.82, 0), new THREE.Vector3(mastX - L * 0.04, L * 0.14, -B * 0.32), L * 0.05);
      const js = new THREE.Mesh(jib, sailMat); js.castShadow = true; this.body.add(js);
    } else {
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.018, L * 0.014, boomLen * 0.9, 8).rotateZ(Math.PI / 2).translate(-boomLen * 0.47, 0.01, 0), new THREE.MeshStandardMaterial({ color: 0x1f3f66, roughness: 0.8 }));
      cover.position.set(mastX, boomY, 0); this.body.add(cover);
    }
    // Forestay and backstay lines.
    const stay = new THREE.LineBasicMaterial({ color: 0x4a4f55, transparent: true, opacity: 0.55 });
    const top = new THREE.Vector3(mastX, L * 0.09 + mastH, 0);
    this.body.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([top, new THREE.Vector3(L * 0.49, L * 0.1, 0)]), stay));
    this.body.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([top, new THREE.Vector3(-L * 0.49, L * 0.1, 0)]), stay));
  }

  update(time_s: number, s: SailboatState = {}) {
    const b = s.bob ?? 1, p = this.ph;
    this.body.position.y = b * 0.06 * Math.sin(time_s * 0.9 + p[0]);
    this.body.rotation.set(-(s.heel ?? 0) + b * 0.03 * Math.sin(time_s * 0.7 + p[1]), 0, b * 0.02 * Math.sin(time_s * 0.8 + p[2]));
  }
}

/** Cambered triangular sail: luff from tack to head, foot from tack to clew; bulges by `camber` toward -Z. */
function sailGeometry(tack: THREE.Vector3, head: THREE.Vector3, clew: THREE.Vector3, camber: number) {
  const n = 14, pos: number[] = [], idx: number[] = [];
  const rows: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const v = i / n, row: number[] = [];
    const a = tack.clone().lerp(head, v), b = clew.clone().lerp(head, v);
    const m = n - i;
    for (let j = 0; j <= m; j++) {
      const u = m ? j / m : 0, p = a.clone().lerp(b, u);
      p.z -= camber * Math.sin(Math.PI * u) * (1 - v * 0.7) * 4 * (0.25 + 0.75 * u) * (1 - u) * 1.3;
      row.push(pos.length / 3); pos.push(p.x, p.y, p.z);
    }
    rows.push(row);
  }
  for (let i = 0; i < n; i++) {
    const r0 = rows[i], r1 = rows[i + 1];
    for (let j = 0; j < r1.length; j++) { idx.push(r0[j], r0[j + 1], r1[j]); if (j + 1 < r1.length) idx.push(r0[j + 1], r1[j + 1], r1[j]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
