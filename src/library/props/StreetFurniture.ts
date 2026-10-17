import * as THREE from 'three';
import { rng } from '../util/math';

/**
 * street-furniture-v1 — generic, unbranded urban props in metres (origin at the base on y = 0, front toward +Z):
 * traffic signal with a deterministic cycle, fire hydrant, slatted bench, litter bin, mailbox, bus shelter with a
 * back-lit advert panel, bollards, traffic cones, parking meter and a manhole cover. Each class exposes `group`;
 * lit props take `lit` (0..1) for night. Use them to dress CityStreet/CityKit blocks so streets stop looking empty.
 */
const std = (color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const put = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
};

export type SignalState = 'red' | 'amber' | 'green';
/** Pole-mounted three-aspect signal (plus pedestrian head). State from `state` or the time-based cycle in update(). */
export class TrafficLight {
  readonly group = new THREE.Group();
  private lamps: Record<SignalState, THREE.MeshStandardMaterial>;
  private walk: THREE.MeshStandardMaterial; private dontWalk: THREE.MeshStandardMaterial;
  /** Cycle lengths in seconds (green, amber, red) and phase offset. */
  cycle: [number, number, number] = [8, 2.5, 9]; offset = 0;
  constructor(o: { height?: number; arm?: number } = {}) {
    const H = o.height ?? 3.4, arm = o.arm ?? 0, metal = std(0x2a2e33, 0.45, 0.7);
    put(this.group, new THREE.CylinderGeometry(0.07, 0.09, H, 14), metal, [0, H / 2, 0]);
    put(this.group, new THREE.CylinderGeometry(0.16, 0.2, 0.12, 16), metal, [0, 0.06, 0]);
    const head = new THREE.Group(); head.position.set(arm, H - 0.55, 0.1); this.group.add(head);
    if (arm) put(this.group, new THREE.BoxGeometry(arm, 0.08, 0.08), metal, [arm / 2, H - 0.12, 0]);
    put(head, new THREE.BoxGeometry(0.34, 0.95, 0.26), std(0x1c1f22, 0.5), [0, 0, 0]);
    const mk = (c: number) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).multiplyScalar(0.25), emissive: c, emissiveIntensity: 0, roughness: 0.25 });
    this.lamps = { red: mk(0xff2a1c), amber: mk(0xffa514), green: mk(0x22ff8a) };
    (['red', 'amber', 'green'] as SignalState[]).forEach((s, i) => {
      put(head, new THREE.CylinderGeometry(0.105, 0.105, 0.04, 24).rotateX(Math.PI / 2), this.lamps[s], [0, 0.3 - i * 0.3, 0.135]);
      const visor = put(head, new THREE.CylinderGeometry(0.13, 0.13, 0.16, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), std(0x15171a, 0.6), [0, 0.3 - i * 0.3, 0.2]); visor.rotation.z = Math.PI;
    });
    const ped = new THREE.Group(); ped.position.set(0, 1.9, 0.12); this.group.add(ped);
    put(ped, new THREE.BoxGeometry(0.3, 0.5, 0.18), std(0x1c1f22, 0.5));
    this.dontWalk = new THREE.MeshStandardMaterial({ color: 0x331008, emissive: 0xff5a1a, emissiveIntensity: 0, roughness: 0.3 });
    this.walk = new THREE.MeshStandardMaterial({ color: 0x0c2a20, emissive: 0xeafff4, emissiveIntensity: 0, roughness: 0.3 });
    put(ped, new THREE.PlaneGeometry(0.2, 0.18), this.dontWalk, [0, 0.11, 0.091]); put(ped, new THREE.PlaneGeometry(0.2, 0.18), this.walk, [0, -0.11, 0.091]);
    put(this.group, new THREE.BoxGeometry(0.12, 0.18, 0.1), std(0xd9b31a, 0.5), [0, 1.1, 0.1]);   // push-button box
  }
  /** Aspect at time t from the cycle (green → amber → red). */
  stateAt(t: number): SignalState {
    const [g, a, r] = this.cycle, p = (((t + this.offset) % (g + a + r)) + (g + a + r)) % (g + a + r);
    return p < g ? 'green' : p < g + a ? 'amber' : 'red';
  }
  update(t: number, force?: SignalState) {
    const s = force ?? this.stateAt(t);
    for (const k of Object.keys(this.lamps) as SignalState[]) this.lamps[k].emissiveIntensity = k === s ? 6 : 0.04;
    this.walk.emissiveIntensity = s === 'red' ? 3 : 0; this.dontWalk.emissiveIntensity = s !== 'red' ? (s === 'amber' ? (Math.floor(t * 2) % 2) * 3 : 3) : 0;
  }
}

export class FireHydrant {
  readonly group = new THREE.Group();
  constructor(color: THREE.ColorRepresentation = 0xc8231c) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 }), cap = std(0xd8d4c8, 0.4, 0.3);
    const prof = [[0.0, 0], [0.14, 0], [0.14, 0.06], [0.11, 0.08], [0.11, 0.52], [0.13, 0.55], [0.13, 0.6], [0.09, 0.64], [0.07, 0.7], [0.0, 0.72]].map(([x, y]) => new THREE.Vector2(x, y));
    put(this.group, new THREE.LatheGeometry(prof, 24), m);
    for (const s of [-1, 1]) { put(this.group, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 14).rotateZ(Math.PI / 2), m, [s * 0.15, 0.4, 0]); put(this.group, new THREE.CylinderGeometry(0.055, 0.055, 0.03, 6).rotateZ(Math.PI / 2), cap, [s * 0.215, 0.4, 0]); }
    put(this.group, new THREE.CylinderGeometry(0.065, 0.065, 0.1, 14).rotateX(Math.PI / 2), m, [0, 0.38, 0.14]); put(this.group, new THREE.CylinderGeometry(0.07, 0.07, 0.03, 6).rotateX(Math.PI / 2), cap, [0, 0.38, 0.2]);
    put(this.group, new THREE.CylinderGeometry(0.025, 0.035, 0.05, 5), cap, [0, 0.74, 0]);
  }
}

export class Bench {
  readonly group = new THREE.Group();
  constructor(o: { length?: number; wood?: THREE.ColorRepresentation } = {}) {
    const L = o.length ?? 1.8, wood = std(o.wood ?? 0x8a5a34, 0.7), iron = std(0x1f2326, 0.45, 0.6);
    for (let i = 0; i < 4; i++) put(this.group, new THREE.BoxGeometry(L, 0.035, 0.09), wood, [0, 0.45, -0.18 + i * 0.11]);
    for (let i = 0; i < 3; i++) { const m = put(this.group, new THREE.BoxGeometry(L, 0.09, 0.03), wood, [0, 0.62 + i * 0.13, -0.26 - i * 0.025]); m.rotation.x = -0.18; }
    for (const x of [-L / 2 + 0.15, L / 2 - 0.15]) {
      put(this.group, new THREE.BoxGeometry(0.05, 0.45, 0.05), iron, [x, 0.225, 0.14]); put(this.group, new THREE.BoxGeometry(0.05, 0.95, 0.05), iron, [x, 0.47, -0.26]).rotation.x = -0.12;
      put(this.group, new THREE.BoxGeometry(0.05, 0.05, 0.5), iron, [x, 0.42, -0.06]); put(this.group, new THREE.BoxGeometry(0.05, 0.04, 0.42), iron, [x, 0.66, -0.04]);
    }
  }
}

export class LitterBin {
  readonly group = new THREE.Group();
  constructor(color: THREE.ColorRepresentation = 0x2f4b3a) {
    const m = std(color, 0.5, 0.4);
    put(this.group, new THREE.CylinderGeometry(0.27, 0.24, 0.85, 24, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), [0, 0.47, 0]);
    put(this.group, new THREE.CylinderGeometry(0.29, 0.29, 0.06, 24), m, [0, 0.92, 0]);
    put(this.group, new THREE.TorusGeometry(0.15, 0.025, 8, 20), m, [0, 0.98, 0]).rotation.x = Math.PI / 2;
    put(this.group, new THREE.CylinderGeometry(0.24, 0.24, 0.04, 24), m, [0, 0.06, 0]);
    put(this.group, new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10), std(0x222222), [0, 0.02, 0]);
  }
}

export class Mailbox {
  readonly group = new THREE.Group();
  constructor(color: THREE.ColorRepresentation = 0x1f4f8f) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.5 });
    const s = new THREE.Shape(); s.moveTo(-0.26, 0); s.lineTo(-0.26, 0.85); s.absarc(0, 0.85, 0.26, Math.PI, 0, true); s.lineTo(0.26, 0); s.lineTo(-0.26, 0);
    put(this.group, new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 16 }).translate(0, 0.12, -0.25), m);
    put(this.group, new THREE.BoxGeometry(0.32, 0.04, 0.02), std(0x111111), [0, 0.92, 0.27]);
    for (const x of [-0.2, 0.2]) for (const z of [-0.18, 0.18]) put(this.group, new THREE.BoxGeometry(0.05, 0.12, 0.05), m, [x, 0.06, z]);
  }
}

/** Bus shelter: steel frame, glass sides/back, roof, bench and a back-lit advert panel (`lit` for night). */
export class BusShelter {
  readonly group = new THREE.Group(); private ad: THREE.MeshStandardMaterial;
  constructor(o: { width?: number; seed?: number } = {}) {
    const W = o.width ?? 3.2, D = 1.4, H = 2.45, steel = std(0x3a4046, 0.4, 0.8), r = rng(o.seed ?? 4);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xdfeaf0, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.22, depthWrite: false });
    for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2 - 0.2]) put(this.group, new THREE.BoxGeometry(0.07, H, 0.07), steel, [x, H / 2, z]);
    put(this.group, new THREE.BoxGeometry(W + 0.3, 0.08, D + 0.25), steel, [0, H + 0.04, 0]);
    const back = put(this.group, new THREE.BoxGeometry(W - 0.07, H - 0.25, 0.012), glass, [0, H / 2 + 0.05, -D / 2]); back.castShadow = false;
    const side = put(this.group, new THREE.BoxGeometry(0.012, H - 0.25, D - 0.3), glass, [-W / 2, H / 2 + 0.05, -0.1]); side.castShadow = false;
    put(this.group, new THREE.BoxGeometry(W * 0.55, 0.05, 0.36), std(0x6f767d, 0.4, 0.7), [0.3, 0.5, -D / 2 + 0.25]);
    // Advert: a generic abstract poster (no brands) in a light box at the closed end.
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d')!;
    const hue = Math.floor(r() * 360), grad = g.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, `hsl(${hue},70%,55%)`); grad.addColorStop(1, `hsl(${(hue + 60) % 360},70%,35%)`);
    g.fillStyle = grad; g.fillRect(0, 0, 256, 512); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(128, 210, 70 + r() * 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(40, 380, 176, 18); g.fillRect(60, 410, 136, 12);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.ad = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.3 });
    put(this.group, new THREE.BoxGeometry(0.14, 1.85, 1.0), steel, [W / 2, 1.1, -0.15]);
    for (const s of [-1, 1]) { const p = put(this.group, new THREE.PlaneGeometry(0.92, 1.72), this.ad, [W / 2 + s * 0.072, 1.1, -0.15]); p.rotation.y = s * Math.PI / 2; p.castShadow = false; }
  }
  set lit(v: number) { this.ad.emissiveIntensity = 0.25 + 1.8 * v; }
}

export class Bollard {
  readonly group = new THREE.Group();
  constructor(o: { height?: number; color?: THREE.ColorRepresentation; reflector?: boolean } = {}) {
    const H = o.height ?? 0.95, m = std(o.color ?? 0x2b2f33, 0.45, 0.6);
    put(this.group, new THREE.CylinderGeometry(0.09, 0.1, H, 18), m, [0, H / 2, 0]); put(this.group, new THREE.SphereGeometry(0.09, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, [0, H, 0]);
    if (o.reflector !== false) put(this.group, new THREE.CylinderGeometry(0.093, 0.093, 0.06, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.15, metalness: 0.5 }), [0, H - 0.15, 0]);
  }
}

export class TrafficCone {
  readonly group = new THREE.Group();
  constructor(height = 0.7) {
    const orange = new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.55 }), white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.25, metalness: 0.3 });
    put(this.group, new THREE.BoxGeometry(height * 0.55, 0.03, height * 0.55), new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.8 }), [0, 0.015, 0]);
    put(this.group, new THREE.ConeGeometry(height * 0.2, height * 0.95, 24, 1, true), orange, [0, height * 0.5, 0]);
    for (const [y, h] of [[0.42, 0.12], [0.66, 0.08]]) put(this.group, new THREE.CylinderGeometry(height * 0.2 * (1 - y - h / 2 + 0.03), height * 0.2 * (1 - y + h / 2 + 0.03), height * h, 24, 1, true), white, [0, height * y, 0]);
  }
}

export class ParkingMeter {
  readonly group = new THREE.Group();
  constructor() {
    const m = std(0x30353b, 0.45, 0.7);
    put(this.group, new THREE.CylinderGeometry(0.04, 0.05, 1.1, 12), m, [0, 0.55, 0]);
    put(this.group, new THREE.BoxGeometry(0.22, 0.34, 0.16), m, [0, 1.25, 0]);
    put(this.group, new THREE.BoxGeometry(0.15, 0.08, 0.01), new THREE.MeshStandardMaterial({ color: 0x0b1a10, emissive: 0x2dff9a, emissiveIntensity: 0.6 }), [0, 1.3, 0.081]);
    put(this.group, new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, [0, 1.42, 0]);
  }
}

/** Flat cast-iron cover (sits just above the road surface; receive-only shadows). */
export class ManholeCover {
  readonly group = new THREE.Group();
  constructor(radius = 0.32) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
    g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#4a4a48'; g.lineWidth = 6;
    for (let r = 30; r < 128; r += 22) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
    for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a / 12 * Math.PI * 2) * 122, 128 + Math.sin(a / 12 * Math.PI * 2) * 122); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.02, 32), [new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.6, metalness: 0.5 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x1e1e1e })]);
    m.position.y = 0.006; m.receiveShadow = true; this.group.add(m);
  }
}
