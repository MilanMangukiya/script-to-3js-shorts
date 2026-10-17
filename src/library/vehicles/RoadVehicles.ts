import * as THREE from 'three';
import { rng } from '../util/math';

/**
 * road-vehicles-v1 — procedural, unbranded road vehicles in metres (length along X, front toward −X, wheels on
 * y = 0): sedan, hatch, SUV, pickup, taxi, police, ambulance, van, city bus and box truck. Cars are built from a
 * bevelled side-profile body below the belt line plus a tapered glass greenhouse with painted pillars and roof, so
 * windows read correctly from every angle; clear-coat paint, rubber tyres with spoked rims, wheel-arch shadows,
 * mirrors, door seams, plates and emissive head/tail/brake/indicator lights. `update(t, distance)` turns the wheels
 * for the distance travelled and runs light bars or indicators; `lit` switches the lamps for night.
 */
export type VehicleKind = 'sedan' | 'hatch' | 'suv' | 'pickup' | 'taxi' | 'police' | 'ambulance' | 'van' | 'bus' | 'truck';
export const VEHICLE_KINDS: VehicleKind[] = ['sedan', 'hatch', 'suv', 'pickup', 'taxi', 'police', 'ambulance', 'van', 'bus', 'truck'];
export interface VehicleOptions { kind?: VehicleKind; color?: THREE.ColorRepresentation; seed?: number; /** Plate text (generic). */ plate?: string }

export const CAR_PAINTS = [0x9e1b1b, 0x1d3f72, 0xe8e6e1, 0x1b1d20, 0x5c6670, 0x2f5d3a, 0xc9a227, 0x7a2f55, 0x3a7ca5, 0xb5b8bb, 0x8a8f94, 0xd7d2c8];

interface Dims { L: number; W: number; belt: number; roof: number; wheelR: number; wheelbase: number; hood: number; trunk: number; ground: number }
const DIMS: Record<VehicleKind, Dims> = {
  sedan: { L: 4.7, W: 1.82, belt: 0.95, roof: 1.45, wheelR: 0.33, wheelbase: 2.8, hood: 1.15, trunk: 0.95, ground: 0.16 },
  hatch: { L: 4.05, W: 1.76, belt: 0.95, roof: 1.48, wheelR: 0.31, wheelbase: 2.6, hood: 0.95, trunk: 0.15, ground: 0.15 },
  suv: { L: 4.75, W: 1.92, belt: 1.12, roof: 1.75, wheelR: 0.38, wheelbase: 2.85, hood: 1.05, trunk: 0.12, ground: 0.22 },
  pickup: { L: 5.4, W: 1.95, belt: 1.15, roof: 1.85, wheelR: 0.4, wheelbase: 3.4, hood: 1.2, trunk: 1.85, ground: 0.25 },
  taxi: { L: 4.7, W: 1.82, belt: 0.95, roof: 1.45, wheelR: 0.33, wheelbase: 2.8, hood: 1.15, trunk: 0.95, ground: 0.16 },
  police: { L: 4.9, W: 1.86, belt: 0.97, roof: 1.47, wheelR: 0.34, wheelbase: 2.9, hood: 1.2, trunk: 1.0, ground: 0.17 },
  ambulance: { L: 5.9, W: 2.1, belt: 1.2, roof: 2.6, wheelR: 0.38, wheelbase: 3.6, hood: 0.85, trunk: 0, ground: 0.2 },
  van: { L: 5.2, W: 1.98, belt: 1.15, roof: 2.15, wheelR: 0.35, wheelbase: 3.3, hood: 0.75, trunk: 0, ground: 0.18 },
  bus: { L: 12, W: 2.55, belt: 1.1, roof: 3.05, wheelR: 0.5, wheelbase: 6.2, hood: 0, trunk: 0, ground: 0.3 },
  truck: { L: 8.5, W: 2.5, belt: 1.4, roof: 3.4, wheelR: 0.5, wheelbase: 4.8, hood: 0.4, trunk: 0, ground: 0.35 },
};

let _plateCache: Map<string, THREE.Texture> | undefined;
function plateTexture(text: string) {
  _plateCache ??= new Map();
  const hit = _plateCache.get(text); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d')!;
  g.fillStyle = '#f2f0e8'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#1b1d22'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = '#1b1d22'; g.font = '700 40px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; _plateCache.set(text, t); return t;
}

/** Wheel: rounded tyre (lathe), spoked alloy rim and hub; spins about its local Z (the axle). */
function wheel(r: number, width: number, rimColor: number, spokes: number) {
  const g = new THREE.Group();
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * Math.PI; prof.push(new THREE.Vector2(r - 0.05 + Math.cos(a) * 0.05, Math.sin(a) * width / 2)); }
  prof.unshift(new THREE.Vector2(r * 0.66, -width / 2)); prof.push(new THREE.Vector2(r * 0.66, width / 2));
  const tyre = new THREE.Mesh(new THREE.LatheGeometry(prof, 36).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.88 }));
  tyre.castShadow = true; g.add(tyre);
  const metal = new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.28, metalness: 0.9 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, width * 0.7, 28, 1, true).rotateX(Math.PI / 2), metal); g.add(rim);
  for (const z of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.RingGeometry(r * 0.5, r * 0.66, 28), metal); face.position.z = z * width * 0.34; face.rotation.y = z < 0 ? Math.PI : 0; g.add(face);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.13, r * 0.15, 0.04, 14).rotateX(Math.PI / 2), metal); hub.position.z = z * width * 0.33; g.add(hub);
    for (let i = 0; i < spokes; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 0.08, r * 0.42, 0.03), metal); const a = (i / spokes) * Math.PI * 2; sp.position.set(Math.sin(a) * r * 0.3, Math.cos(a) * r * 0.3, z * width * 0.32); sp.rotation.z = -a; g.add(sp); }
    const dark = new THREE.Mesh(new THREE.CircleGeometry(r * 0.5, 24), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.8 })); dark.position.z = z * width * 0.25; dark.rotation.y = z < 0 ? Math.PI : 0; g.add(dark);
  }
  return g;
}

export class Vehicle {
  readonly group = new THREE.Group();
  readonly kind: VehicleKind; readonly dims: Dims;
  readonly wheels: THREE.Object3D[] = [];
  private head: THREE.MeshStandardMaterial; private tail: THREE.MeshStandardMaterial; private brakeM: THREE.MeshStandardMaterial;
  private indL: THREE.MeshStandardMaterial; private indR: THREE.MeshStandardMaterial; private beacons: { m: THREE.MeshStandardMaterial; phase: number }[] = [];
  private signM?: THREE.MeshStandardMaterial; private litLevel = 0; private paint: THREE.MeshPhysicalMaterial;
  /** −1 left, 0 off, 1 right indicator; brake 0..1; light bar on/off (police/ambulance). */
  indicator = 0; brake = 0; siren = false;

  constructor(o: VehicleOptions = {}) {
    const kind = this.kind = o.kind ?? 'sedan', d = this.dims = DIMS[kind], r = rng(o.seed ?? 3);
    const color = kind === 'taxi' ? 0xf2c200 : kind === 'police' ? 0xf4f4f2 : kind === 'ambulance' ? 0xf6f5f0 : (o.color ?? CAR_PAINTS[Math.floor(r() * CAR_PAINTS.length)]);
    this.paint = new THREE.MeshPhysicalMaterial({ color, metalness: kind === 'bus' || kind === 'truck' || kind === 'ambulance' ? 0.2 : 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
    const glass = new THREE.MeshPhysicalMaterial({ color: kind === 'bus' || kind === 'truck' ? 0x1d2a33 : 0x0b1014, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.55, metalness: 0.25 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.18, metalness: 1 });
    this.head = new THREE.MeshStandardMaterial({ color: 0xfff7e6, emissive: 0xfff1d6, emissiveIntensity: 0.15, roughness: 0.15 });
    this.tail = new THREE.MeshStandardMaterial({ color: 0x5a0b0b, emissive: 0xff2414, emissiveIntensity: 0.1, roughness: 0.3 });
    this.brakeM = new THREE.MeshStandardMaterial({ color: 0x5a0b0b, emissive: 0xff2414, emissiveIntensity: 0.05, roughness: 0.3 });
    this.indL = new THREE.MeshStandardMaterial({ color: 0x6a3a08, emissive: 0xff9a18, emissiveIntensity: 0, roughness: 0.3 });
    this.indR = this.indL.clone();
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number] = [0, 0, 0], parent: THREE.Object3D = this.group) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    const h = d.L / 2, W = d.W, wr = d.wheelR, ax = d.wheelbase / 2;
    const isBox = kind === 'bus' || kind === 'truck' || kind === 'van' || kind === 'ambulance';

    // ---- lower body: side profile (x along, y up) extruded across the width, with wheel arches cut out
    const s = new THREE.Shape(), y0 = d.ground + 0.05, belt = d.belt;
    s.moveTo(-h, y0 + 0.12);
    if (isBox) { s.lineTo(-h, belt - 0.05); s.quadraticCurveTo(-h, belt, -h + 0.06, belt); }
    else { s.quadraticCurveTo(-h - 0.02, belt - 0.22, -h + 0.18, belt - 0.12); s.lineTo(-h + d.hood, belt); }
    s.lineTo(h - (isBox ? 0.06 : d.trunk > 0.5 ? 0.25 : 0.12), belt);
    s.quadraticCurveTo(h + 0.02, belt - (isBox ? 0.02 : 0.1), h, belt - (isBox ? 0.1 : 0.3)); s.lineTo(h, y0 + 0.1);
    // Rear arch, sill, front arch (clockwise along the bottom edge).
    for (const cx of [ax, -ax]) {
      const ar = wr + 0.06;
      s.lineTo(cx + ar, y0); s.absarc(cx, y0 + 0.02 + (d.ground - 0.12), ar, 0, Math.PI, false);
    }
    s.lineTo(-h + 0.08, y0); s.lineTo(-h, y0 + 0.12);
    const bodyDepth = W - 0.14;
    const lower = new THREE.ExtrudeGeometry(s, { depth: bodyDepth, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 4, curveSegments: 18 }).translate(0, 0, -bodyDepth / 2);
    add(lower, this.paint);
    // Wheel-arch liners (dark) so the cut-outs read as wells, not holes.
    for (const cx of [ax, -ax]) {
      const liner = add(new THREE.CylinderGeometry(wr + 0.07, wr + 0.07, W - 0.12, 24, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.9, side: THREE.DoubleSide }), [cx, d.ground - 0.07 + 0.02 + y0, 0]);
      liner.rotation.z = Math.PI; liner.castShadow = false;
    }

    // ---- greenhouse: glass band following the cabin profile, slightly narrower than the body, with pillars and roof
    const cab = new THREE.Shape(), gh = d.roof - belt;
    let cabX0: number, cabX1: number;
    if (kind === 'bus') { cabX0 = -h + 0.12; cabX1 = h - 0.12; cab.moveTo(cabX0, 0); cab.lineTo(cabX0 + 0.05, gh - 0.1); cab.lineTo(cabX1, gh - 0.1); cab.lineTo(cabX1, 0); }
    else if (kind === 'truck') { cabX0 = -h + 0.1; cabX1 = -h + 2.1; cab.moveTo(cabX0, 0); cab.lineTo(cabX0 + 0.2, gh * 0.55); cab.lineTo(cabX1 - 0.05, gh * 0.55); cab.lineTo(cabX1, 0); }
    else if (kind === 'van' || kind === 'ambulance') { cabX0 = -h + d.hood - 0.1; cabX1 = kind === 'ambulance' ? -h + d.hood + 1.3 : h - 0.12; cab.moveTo(cabX0, 0); cab.lineTo(cabX0 + 0.55, gh - 0.08); cab.lineTo(cabX1, gh - 0.08); cab.lineTo(cabX1, 0); }
    else {
      cabX0 = -h + d.hood - 0.05; cabX1 = kind === 'pickup' ? cabX0 + 2.1 : h - Math.max(d.trunk, 0.2) + 0.05;
      const ws = kind === 'suv' || kind === 'pickup' ? 0.55 : 0.75, rear = kind === 'hatch' || kind === 'suv' ? 0.25 : kind === 'pickup' ? 0.08 : 0.55;
      cab.moveTo(cabX0, 0); cab.quadraticCurveTo(cabX0 + ws * 0.55, gh * 0.75, cabX0 + ws, gh); cab.lineTo(cabX1 - rear - 0.05, gh); cab.quadraticCurveTo(cabX1 - rear * 0.25, gh * 0.85, cabX1, 0);
    }
    cab.lineTo(cabX0, 0);
    const taper = isBox ? 1 : 0.9, cabW = (W - 0.2) * (isBox ? 0.98 : 0.96);
    const gGeo = new THREE.ExtrudeGeometry(cab, { depth: cabW, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3, curveSegments: 16 }).translate(0, 0, -cabW / 2);
    { const p = gGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) * (1 - (1 - taper) * Math.max(0, y) / gh)); } gGeo.computeVertexNormals(); }
    const gm = add(gGeo, glass, [0, belt - 0.01, 0]);
    // Roof panel and pillars in body paint over the glass.
    const roofY = belt + (kind === 'truck' ? gh * 0.55 : kind === 'bus' || isBox ? gh - 0.08 : gh);
    if (kind !== 'bus' && kind !== 'van' && kind !== 'ambulance' && kind !== 'truck') {
      const rl = (cabX1 - cabX0) * 0.62, rx = (cabX0 + cabX1) / 2 + (kind === 'sedan' || kind === 'taxi' || kind === 'police' ? -0.02 : 0.08);
      add(new THREE.BoxGeometry(rl, 0.05, cabW * taper + 0.02), this.paint, [rx, roofY + 0.02, 0]);
      for (const z of [-1, 1]) {
        const zz = z * (cabW * (taper + 1) / 4 + 0.042);   // just proud of the glass and its bevel
        const pillar = (x0: number, x1: number, y1: number, w = 0.07) => { const dx = x1 - x0, dy = y1; const m = add(new THREE.BoxGeometry(Math.hypot(dx, dy), w, 0.025), this.paint, [(x0 + x1) / 2, belt + dy / 2, zz]); m.rotation.z = Math.atan2(dy, dx); };
        pillar(cabX0 + 0.02, cabX0 + (kind === 'suv' || kind === 'pickup' ? 0.55 : 0.75), gh);                // A
        const bx = (cabX0 + cabX1) / 2 + 0.05; add(new THREE.BoxGeometry(0.08, gh, 0.025), this.paint, [bx, belt + gh / 2, zz]);   // B
        if (kind === 'suv' || kind === 'hatch') add(new THREE.BoxGeometry(0.18, gh, 0.025), this.paint, [cabX1 - 0.35, belt + gh / 2, zz]);   // C
        add(new THREE.BoxGeometry(cabX1 - cabX0 - 0.1, 0.03, 0.03), chrome, [(cabX0 + cabX1) / 2, belt + 0.015, zz]);   // window sill trim
      }
    } else {
      // Box bodies: painted upper body behind the cab glass, pillars between bus windows.
      if (kind === 'van' || kind === 'ambulance') { const x0 = kind === 'ambulance' ? cabX1 : cabX1 - 2.4; add(new THREE.BoxGeometry(h - x0 - 0.04, gh, W - 0.12), this.paint, [(x0 + h) / 2 - 0.02, belt + gh / 2 - 0.02, 0]); }
      if (kind === 'truck') { add(new THREE.BoxGeometry(2.0, d.roof - belt, W - 0.1), this.paint, [-h + 1.1, belt + (d.roof - belt) * 0.5 - 0.6, 0]).scale.set(1, 0.55, 1);
        add(new THREE.BoxGeometry(d.L - 2.45, d.roof - 0.5, W), new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.6 }), [-h + 2.3 + (d.L - 2.45) / 2, 0.5 + (d.roof - 0.5) / 2 + 0.05, 0]); }
      if (kind === 'bus') { for (let x = cabX0 + 1.4; x < cabX1 - 0.4; x += 1.25) for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.12, gh - 0.1, 0.03), this.paint, [x, belt + (gh - 0.1) / 2, z * (cabW / 2 + 0.05)]);
        for (const z of [-1, 1]) add(new THREE.BoxGeometry(cabX1 - cabX0, 0.08, 0.03), this.paint, [(cabX0 + cabX1) / 2, belt + gh * 0.62, z * (cabW / 2 + 0.05)]);
        add(new THREE.BoxGeometry(d.L - 0.1, 0.12, W - 0.05), this.paint, [0, d.roof - 0.02, 0]); }
      add(new THREE.BoxGeometry(isBox ? (kind === 'truck' ? 2.0 : cabX1 - cabX0) : 1, 0.05, W - 0.14), this.paint, [kind === 'truck' ? -h + 1.1 : (cabX0 + cabX1) / 2, roofY + 0.02, 0]);
    }
    void gm;
    if (kind === 'pickup') {   // open bed walls
      const bx0 = cabX1 + 0.05, bl = h - bx0 - 0.05;
      for (const z of [-1, 1]) add(new THREE.BoxGeometry(bl, 0.5, 0.06), this.paint, [bx0 + bl / 2, belt + 0.22, z * (W / 2 - 0.08)]);
      add(new THREE.BoxGeometry(0.06, 0.5, W - 0.1), this.paint, [h - 0.06, belt + 0.22, 0]);
      add(new THREE.BoxGeometry(bl, 0.04, W - 0.16), trim, [bx0 + bl / 2, belt - 0.02, 0]);
    }

    // ---- details: lights, grille, bumpers, mirrors, seams, plates
    const fy = isBox ? belt - 0.25 : belt - 0.22;
    for (const z of [-1, 1]) {
      add(new THREE.BoxGeometry(0.08, 0.13, isBox ? 0.32 : 0.42), this.head, [-h - 0.02, fy, z * (W / 2 - 0.3)]);
      add(new THREE.BoxGeometry(0.06, 0.06, 0.14), z < 0 ? this.indL : this.indR, [-h + 0.02, fy - 0.12, z * (W / 2 - 0.16)]);
      add(new THREE.BoxGeometry(0.08, isBox ? 0.3 : 0.14, isBox ? 0.18 : 0.46), this.tail, [h + 0.01, isBox ? belt + 0.2 : belt - 0.16, z * (W / 2 - 0.25)]);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.12), z < 0 ? this.indL : this.indR, [h + 0.02, isBox ? belt - 0.05 : belt - 0.3, z * (W / 2 - 0.12)]);
      // Side mirror on a stalk.
      if (kind !== 'bus') { const mx = (kind === 'truck' ? -h + 0.25 : cabX0 + 0.35), my = belt + 0.06; add(new THREE.BoxGeometry(0.16, 0.12, 0.08), this.paint, [mx, my + 0.04, z * (W / 2 + 0.06)]); add(new THREE.BoxGeometry(0.02, 0.1, 0.06), glass, [mx + 0.08, my + 0.04, z * (W / 2 + 0.06)]); }
      // Door seams and handles.
      const doors = kind === 'bus' || kind === 'truck' ? [] : kind === 'van' || kind === 'ambulance' ? [cabX0 + 0.1, cabX0 + 1.2] : kind === 'hatch' || kind === 'pickup' ? [cabX0 + 0.05, cabX0 + 1.2] : [cabX0 + 0.05, (cabX0 + cabX1) / 2 + 0.05, cabX1 - 0.1];
      for (const x of doors) add(new THREE.BoxGeometry(0.012, belt - y0 - 0.25, 0.012), trim, [x, (belt + y0) / 2 + 0.05, z * (W / 2 + 0.005)]);
      for (let i = 0; i < doors.length - 1; i++) add(new THREE.BoxGeometry(0.14, 0.03, 0.03), chrome, [doors[i + 1] - 0.22, belt - 0.12, z * (W / 2 + 0.02)]);
    }
    add(new THREE.BoxGeometry(0.06, 0.2, W * (isBox ? 0.6 : 0.42)), trim, [-h - 0.02, fy - 0.05, 0]);   // grille
    add(new THREE.BoxGeometry(0.14, 0.16, W - 0.02), trim, [-h + 0.02, y0 + 0.12, 0]);                    // front bumper lip
    add(new THREE.BoxGeometry(0.14, 0.16, W - 0.02), trim, [h - 0.02, y0 + 0.12, 0]);                     // rear bumper
    add(new THREE.BoxGeometry(0.04, 0.24, 0.12), this.brakeM, [h - 0.15, roofY - 0.05, 0]).scale.set(1, 0.3, 4);   // high brake light
    const plate = new THREE.MeshStandardMaterial({ map: plateTexture(o.plate ?? `${'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(r() * 23)]}${'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(r() * 23)]}${Math.floor(r() * 90 + 10)} ${'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(r() * 23)]}${'KLMNPRSTUVWX'[Math.floor(r() * 12)]}${'ABCDEFGHJ'[Math.floor(r() * 9)]}`), roughness: 0.4 });
    for (const x of [-h - 0.065, h + 0.065]) { const m = add(new THREE.PlaneGeometry(0.52, 0.13), plate, [x, y0 + 0.32, 0]); m.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; m.castShadow = false; }

    // ---- livery and roof equipment
    if (kind === 'taxi') { this.signM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2b8, emissiveIntensity: 0.3, roughness: 0.4 }); add(new THREE.BoxGeometry(0.5, 0.16, 0.24), this.signM, [0, roofY + 0.12, 0]);
      for (const z of [-1, 1]) for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(0.16, 0.06, 0.006), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x111111 : 0xf2c200, roughness: 0.4 }), [-0.7 + i * 0.16, belt - 0.32, z * (W / 2 + 0.03)]); }
    if (kind === 'police' || kind === 'ambulance') {
      const stripe = new THREE.MeshStandardMaterial({ color: kind === 'police' ? 0x1b3f8f : 0x16a34a, roughness: 0.4 });
      for (const z of [-1, 1]) add(new THREE.BoxGeometry(d.L - (isBox ? 0.4 : 1.0), 0.16, 0.006), stripe, [isBox ? 0.1 : 0.05, belt - 0.32, z * (W / 2 + 0.035)]);
      const bar = new THREE.Group(); bar.position.set(kind === 'police' ? 0 : -h + d.hood + 0.7, roofY + 0.08, 0); this.group.add(bar);
      add(new THREE.BoxGeometry(0.28, 0.1, 1.2), trim, [0, 0, 0], bar);
      const colors = kind === 'police' ? [0x2050ff, 0xff2030] : [0xff2030, 0xff2030];
      [-0.42, -0.15, 0.15, 0.42].forEach((z, i) => { const m = new THREE.MeshStandardMaterial({ color: colors[i < 2 ? 0 : 1], emissive: colors[i < 2 ? 0 : 1], emissiveIntensity: 0, roughness: 0.25, transparent: true, opacity: 0.85 }); add(new THREE.BoxGeometry(0.24, 0.1, 0.24), m, [0, 0.06, z], bar); this.beacons.push({ m, phase: i % 2 ? 0.5 : 0 }); });
      if (kind === 'ambulance') for (const z of [-1, 1]) { const cross = new THREE.MeshStandardMaterial({ color: 0xd8141e, roughness: 0.4 }); add(new THREE.BoxGeometry(0.7, 0.22, 0.006), cross, [1.0, belt + 0.7, z * (W / 2 + 0.035)]); add(new THREE.BoxGeometry(0.22, 0.7, 0.006), cross, [1.0, belt + 0.7, z * (W / 2 + 0.035)]); }
    }
    if (kind === 'bus') { this.signM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffb02a, emissiveIntensity: 0.4, roughness: 0.4 }); const sign = add(new THREE.PlaneGeometry(1.4, 0.24), this.signM, [-h - 0.07, d.roof - 0.25, 0]); sign.rotation.y = -Math.PI / 2;
      const door = new THREE.MeshPhysicalMaterial({ color: 0x0b1014, roughness: 0.05, clearcoat: 1 }); add(new THREE.BoxGeometry(1.1, belt + gh - d.ground - 0.4, 0.04), door, [-h + 1.6, (d.ground + belt + gh) / 2 + 0.05, W / 2 + 0.01]); }

    // ---- wheels (dual rear wheels on the truck)
    for (const [x, z] of [[-ax, 1], [-ax, -1], [ax, 1], [ax, -1]]) {
      const w = wheel(wr, kind === 'bus' || kind === 'truck' ? 0.3 : 0.23, kind === 'bus' || kind === 'truck' ? 0x9aa0a6 : kind === 'police' ? 0x2a2c30 : 0xbfc3c8, kind === 'bus' || kind === 'truck' ? 10 : 5 + Math.floor(r() * 2));
      w.position.set(x, wr, z * (W / 2 - 0.13)); this.group.add(w); this.wheels.push(w);
    }
  }

  /** Head/tail lamps, signs and dashboards for night (0..1). */
  set lit(v: number) {
    this.litLevel = v; this.head.emissiveIntensity = 0.15 + 7 * v; this.tail.emissiveIntensity = 0.1 + 2.6 * v;
    if (this.signM) this.signM.emissiveIntensity = 0.3 + 2.2 * v;
  }
  get lit() { return this.litLevel; }

  /** Deterministic animation at absolute time t: wheel spin for `distance` metres travelled, indicators, brakes, light bar. */
  update(t: number, distance = 0) {
    const spin = -distance / this.dims.wheelR;
    for (const w of this.wheels) w.rotation.z = spin;
    const blink = Math.floor(t * 2.6) % 2 === 0 ? 1 : 0;
    this.indL.emissiveIntensity = this.indicator < 0 ? blink * 4 : 0; this.indR.emissiveIntensity = this.indicator > 0 ? blink * 4 : 0;
    this.brakeM.emissiveIntensity = 0.05 + 5 * this.brake; this.tail.emissiveIntensity = 0.1 + 2.6 * this.litLevel + 3.5 * this.brake;
    for (const b of this.beacons) { const on = this.siren && ((t * 3 + b.phase) % 1) < 0.45; b.m.emissiveIntensity = on ? 9 : 0.1; }
  }
}
