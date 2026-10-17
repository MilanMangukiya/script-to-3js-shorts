import * as THREE from 'three';
import { rng } from '../util/math';
import type { PBRLibrary } from '../materials/PBR';

export interface SundialOptions {
  /** Dial plate radius and pedestal height (to the underside of the plate) in metres. */
  dialRadius?: number; pedestalHeight?: number;
  /** Latitude the dial is laid out for, degrees north: sets the gnomon angle and the hour-line spacing. */
  latitudeDeg?: number;
  /** Hours in the solar day the engraving divides (24 = an ordinary dial), and the first/last engraved hour. */
  hoursPerDay?: number; firstHour?: number; lastHour?: number;
  stoneColor?: THREE.ColorRepresentation; metalColor?: THREE.ColorRepresentation;
  /** Optional photo-scanned relief (normal + roughness) for the stone, from a loaded PBR set (default concrete_wall_008). */
  pbr?: PBRLibrary; stoneSet?: string;
  seed?: number;
}

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/**
 * Horizontal garden sundial on a turned stone pedestal. Local frame: +Y up, north along −Z, east along +X; rotate the
 * group so −Z points to geographic north. Hour lines follow tan θ = sin φ · tan H and the gnomon's style edge points at
 * the celestial pole, so the renderer's real cast shadow (castShadow on, dial receives) reads the true solar time.
 * Static: there is no time state; only the scene's sun direction moves the shadow.
 */
export class Sundial {
  readonly group = new THREE.Group();
  /** Height of the dial face above the group origin. */
  readonly faceY: number;
  /** Unit vector along the style edge (toward the celestial pole) in local coordinates. */
  readonly styleDirection: THREE.Vector3;

  constructor(o: SundialOptions = {}) {
    const R = o.dialRadius ?? 0.3, H = o.pedestalHeight ?? 0.95, lat = THREE.MathUtils.degToRad(o.latitudeDeg ?? 40);
    const hours = o.hoursPerDay ?? 24, first = o.firstHour ?? 6, last = o.lastHour ?? 18, noon = hours / 2;
    const rand = rng(o.seed ?? 11);
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(rand, new THREE.Color(o.stoneColor ?? 0xbcb097)), roughness: 0.88, metalness: 0 });
    if (o.pbr) { const p = o.pbr.material(o.stoneSet ?? 'concrete_wall_008', { tile: 0.7 }); stone.normalMap = p.normalMap; stone.normalScale.set(1.3, 1.3); stone.roughnessMap = p.roughnessMap; stone.roughness = 1; stone.aoMap = p.aoMap; }
    const bronze = new THREE.Color(o.metalColor ?? 0x9b7442);

    // Turned baluster pedestal (profile in metres, revolved).
    const prof: [number, number][] = [[0, 0], [0.24, 0], [0.24, 0.07], [0.2, 0.09], [0.2, 0.12], [0.15, 0.15], [0.11, 0.24], [0.1, 0.5], [0.12, 0.66],
      [0.1, 0.78], [0.13, 0.84], [0.19, H - 0.05], [0.21, H - 0.03], [0.21, H], [0, H]];
    const ped = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 72), stone);
    ped.castShadow = ped.receiveShadow = true; this.group.add(ped);

    // Bronze dial plate: rim cylinder plus an engraved top face (canvas: north at top, east at right).
    const T = 0.014; this.faceY = H + T;
    const rimMat = new THREE.MeshStandardMaterial({ color: bronze, roughness: 0.36, metalness: 0.9 });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.01, T, 96), rimMat);
    rim.position.y = H + T / 2; rim.castShadow = rim.receiveShadow = true; this.group.add(rim);
    const lineAngle = (h: number) => Math.atan(Math.sin(lat) * Math.tan(((h - noon) / hours) * Math.PI * 2));
    const faceTex = dialTexture(rand, bronze, R, lat, first, last, noon, hours, lineAngle);
    const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.995, 96).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: faceTex.map, roughnessMap: faceTex.rough, roughness: 1, metalness: 0.85, color: 0xffffff }));
    face.position.y = this.faceY + 0.0004; face.receiveShadow = true; this.group.add(face);

    // Gnomon: triangular plate in the meridian plane; the style edge rises north at the latitude angle.
    const L = R * 0.78, tip = new THREE.Vector3(0, L * Math.tan(lat), -L);
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, L * Math.tan(lat)), new THREE.Vector2(L, 0)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 });
    g.translate(0, 0, -0.003); g.rotateY(Math.PI / 2);   // shape x → −Z (north), extrusion → ±X
    const gnomon = new THREE.Mesh(g, rimMat);
    gnomon.position.y = this.faceY; gnomon.castShadow = true; gnomon.receiveShadow = true; this.group.add(gnomon);
    this.styleDirection = tip.normalize();
  }
}

function stoneTexture(rand: () => number, base: THREE.Color) {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d')!;
  g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) {   // speckle, pores and lichen flecks
    const x = rand() * N, y = rand() * N, r = 0.4 + rand() * rand() * 3.2, k = rand();
    g.fillStyle = k < 0.6 ? `rgba(70,60,48,${0.05 + rand() * 0.12})` : k < 0.9 ? `rgba(255,250,235,${0.05 + rand() * 0.1})` : `rgba(150,160,90,${0.12 + rand() * 0.2})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 14; i++) {   // weathering streaks down the column (texture v runs up the lathe)
    const x = rand() * N; g.strokeStyle = `rgba(60,52,40,${0.05 + rand() * 0.06})`; g.lineWidth = 2 + rand() * 9;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rand() * 30 - 15, N * 0.3, x + rand() * 30 - 15, N * 0.7, x + rand() * 20 - 10, N); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.anisotropy = 8;
  return t;
}

function dialTexture(rand: () => number, bronze: THREE.Color, R: number, lat: number, first: number, last: number, noon: number, hours: number,
  lineAngle: (h: number) => number) {
  const N = 2048, make = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const col = make(), rough = make(), g = col.getContext('2d')!, r = rough.getContext('2d')!;
  const C = N / 2, S = (N / 2) / R;   // pixels per metre
  g.fillStyle = `#${bronze.getHexString()}`; g.fillRect(0, 0, N, N);
  r.fillStyle = '#5f5f5f'; r.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) {   // patina mottling and verdigris in the low spots
    const x = rand() * N, y = rand() * N, s = 4 + rand() * rand() * 60, k = rand();
    g.fillStyle = k < 0.55 ? `rgba(60,40,22,${0.04 + rand() * 0.07})` : k < 0.85 ? `rgba(230,190,120,${0.03 + rand() * 0.06})` : `rgba(70,140,115,${0.05 + rand() * 0.12})`;
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    r.fillStyle = `rgba(${k < 0.85 ? 200 : 235},${k < 0.85 ? 200 : 235},${k < 0.85 ? 200 : 235},${0.05 + rand() * 0.08})`; r.beginPath(); r.arc(x, y, s, 0, Math.PI * 2); r.fill();
  }
  const ink = 'rgba(32,20,10,0.92)', polish = 'rgba(255,226,170,0.35)';
  const ring = (rad: number, w: number) => { for (const [ctx, st] of [[g, ink], [r, '#ffffff']] as const) { ctx.strokeStyle = st; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(C, C, rad, 0, Math.PI * 2); ctx.stroke(); } };
  ring(R * 0.95 * S, 6); ring(R * 0.7 * S, 4); ring(R * 0.66 * S, 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // Hour lines radiate from the gnomon root at the centre; morning lines lie west (left), afternoon east (right).
  for (let h = first; h <= last + 1e-6; h += 0.25) {
    const th = lineAngle(h), whole = Math.abs(h - Math.round(h)) < 1e-6, half = Math.abs(h * 2 - Math.round(h * 2)) < 1e-6;
    const dx = Math.sin(th), dy = -Math.cos(th), r0 = (whole ? 0.12 : half ? 0.58 : 0.62) * R * S, r1 = 0.7 * R * S;
    const len = (rad: number) => (Math.abs(dy) > 1e-3 && dy > 0 ? 0 : rad);   // keep lines on the north half only
    for (const [ctx, st] of [[g, ink], [r, '#ffffff']] as const) {
      ctx.strokeStyle = st; ctx.lineWidth = whole ? 7 : half ? 4 : 3; ctx.beginPath();
      ctx.moveTo(C + dx * len(r0), C + dy * len(r0)); ctx.lineTo(C + dx * len(r1), C + dy * len(r1)); ctx.stroke();
    }
    if (whole) {
      const hr = ((Math.round(h) % 12) + 12) % 12, rad = 0.83 * R * S, x = C + dx * rad, y = C + dy * rad;
      g.save(); g.translate(x, y); g.rotate(th); g.font = `700 ${Math.round(R * S * 0.13)}px "Playfair Display", Georgia, serif`;
      g.fillStyle = polish; g.fillText(ROMAN[hr], 2, 3); g.fillStyle = ink; g.fillText(ROMAN[hr], 0, 0); g.restore();
    }
  }
  // North mark and a small motto band at the south.
  g.font = `700 ${Math.round(R * S * 0.11)}px "Playfair Display", Georgia, serif`; g.fillStyle = ink; g.fillText('N', C, C - 0.88 * R * S + 0);
  g.font = `600 ${Math.round(R * S * 0.06)}px "Playfair Display", Georgia, serif`; g.fillText('LUX · HORAS · DOCET', C, C + 0.42 * R * S);
  g.fillText(`${Math.round((lat * 180) / Math.PI)}° N`, C, C + 0.52 * R * S);
  if (hours !== 24) g.fillText(`${hours}-HOUR DAY`, C, C + 0.6 * R * S);
  const map = new THREE.CanvasTexture(col), roughMap = new THREE.CanvasTexture(rough);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = roughMap.anisotropy = 8;
  return { map, rough: roughMap };
}
