import * as THREE from 'three';

export interface CompassOptions {
  /** Case radius in metres (default 3.5 cm). */
  radius?: number;
  caseColor?: THREE.ColorRepresentation; cardColor?: string; inkColor?: string; northColor?: string;
}

/** Rose card drawn on a canvas: degree ticks, cardinal letters and an eight-point star. */
function roseTexture(card: string, ink: string, north: string) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!, m = S / 2;
  g.fillStyle = card; g.fillRect(0, 0, S, S);
  g.translate(m, m);
  for (let d = 0; d < 360; d += 2) {
    const a = (d * Math.PI) / 180, long = d % 30 === 0, mid = d % 10 === 0;
    g.strokeStyle = ink; g.lineWidth = long ? 5 : mid ? 3 : 1.6;
    const r0 = m * 0.86, r1 = r0 - (long ? 46 : mid ? 30 : 16);
    g.beginPath(); g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); g.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1); g.stroke();
  }
  g.font = 'bold 30px Georgia, serif'; g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = 30; d < 360; d += 30) if (d % 90) { const a = (d * Math.PI) / 180; g.fillText(String(d), Math.sin(a) * m * 0.66, -Math.cos(a) * m * 0.66); }
  // Eight-point star.
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, len = k % 2 ? m * 0.33 : m * 0.52, w = k % 2 ? 0.07 : 0.1;
    for (const side of [-1, 1]) {
      g.fillStyle = side < 0 ? ink : '#b9ab8c';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a) * len, -Math.cos(a) * len); g.lineTo(Math.sin(a + side * w * 3.2) * m * 0.12, -Math.cos(a + side * w * 3.2) * m * 0.12); g.closePath(); g.fill();
    }
  }
  g.font = 'bold 92px Georgia, serif';
  [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, d]) => {
    const a = ((d as number) * Math.PI) / 180; g.fillStyle = t === 'N' ? north : ink;
    g.fillText(t as string, Math.sin(a) * m * 0.62, -Math.cos(a) * m * 0.62);
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

/**
 * Brass pocket compass: lathe-turned case and bezel, printed rose card, glass cover, bow ring and a two-tone needle
 * on a pivot. The card lies in the XZ plane facing +Y with north toward −Z; `heading` turns the needle (radians,
 * clockwise seen from above; 0 = pointing at the card's N).
 */
export class Compass {
  readonly group = new THREE.Group();
  private needle = new THREE.Group();

  constructor(o: CompassOptions = {}) {
    const R = o.radius ?? 0.035, brass = new THREE.MeshStandardMaterial({ color: o.caseColor ?? 0xb08d4a, metalness: 1, roughness: 0.32 });
    const profile = [[0, 0], [R * 0.98, 0], [R * 1.04, R * 0.05], [R * 1.06, R * 0.22], [R * 1.0, R * 0.3], [R * 0.95, R * 0.3], [R * 0.95, R * 0.08], [0, R * 0.08]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), brass);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(R * 0.985, R * 0.045, 16, 120).rotateX(Math.PI / 2), brass); bezel.position.y = R * 0.3;
    const card = new THREE.Mesh(new THREE.CircleGeometry(R * 0.93, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: roseTexture(o.cardColor ?? '#efe4c8', o.inkColor ?? '#2a2622', o.northColor ?? '#b3261e'), roughness: 0.8, envMapIntensity: 0.15 }));
    card.position.y = R * 0.09;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.28, R * 0.05, 12, 48), brass); ring.position.set(0, R * 0.16, -R * 1.28);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.08, R * 0.1, R * 0.22, 24).rotateX(Math.PI / 2), brass); stem.position.set(0, R * 0.16, -R * 1.08);
    // Needle: north half red, south half pale steel, each a thin diamond.
    const half = (len: number) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(R * 0.075, 0); s.lineTo(0, len); s.lineTo(-R * 0.075, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: R * 0.012, bevelEnabled: false }).rotateX(-Math.PI / 2); };
    const north = new THREE.Mesh(half(R * 0.78), new THREE.MeshStandardMaterial({ color: 0xb3261e, metalness: 0.3, roughness: 0.4 }));
    const south = new THREE.Mesh(half(R * 0.78).rotateY(Math.PI), new THREE.MeshStandardMaterial({ color: 0xd9dde0, metalness: 0.8, roughness: 0.3 }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 0.06, 20, 12), brass);
    this.needle.add(north, south, cap); this.needle.position.y = R * 0.15;
    const glass = new THREE.Mesh(new THREE.CircleGeometry(R * 0.96, 96).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xdfe8ef, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, depthWrite: false }));
    glass.position.y = R * 0.27;
    this.group.add(body, bezel, card, ring, stem, this.needle, glass);
    this.group.traverse((m) => { m.castShadow = true; m.receiveShadow = true; });
  }

  /** Needle angle in radians, clockwise seen from above (0 = card north). */
  set heading(v: number) { this.needle.rotation.y = -v; }
}
