import * as THREE from 'three';
import { rng } from '../util/math';
import { projectUVs, type PBRLibrary } from '../materials/PBR';
import { Building, type BuildingStyle } from './BuildingKit';
import { BroadleafTree } from './BroadleafTree';
import { HumanV2, walkPose, idlePose } from '../characters/HumanV2';
import { LightBeam } from '../fx/LightBeam';

/**
 * City kit: a street (asphalt road with markings, raised kerbs and paved sidewalks) lined with varied BuildingKit
 * blocks, street lamps that pool warm light on the pavement, trees, clear-coated cars (moving traffic with head/tail
 * lights) and walking HumanV2 pedestrians. Metres; the street runs along Z (toward −Z is "down the street").
 * `setLight(night, zenith, horizon)` switches the whole block between day and night; `update(t)` animates traffic,
 * walkers and window life. Everything is a deterministic function of time.
 */
export interface CityStreetV2Options {
  length?: number; roadWidth?: number; sidewalk?: number; seed?: number;
  /** Building styles to draw from (both sides), floors range and fraction of lit rooms at night. */
  styles?: BuildingStyle[]; floors?: [number, number]; litFraction?: number;
  cars?: number; pedestrians?: number; trees?: boolean; lampSpacing?: number;
  pbr: PBRLibrary;
}

const PAINT = [0x9e1b1b, 0x1d3f72, 0xe8e6e1, 0x1b1d20, 0x5c6670, 0x2f5d3a, 0xc9a227, 0x7a2f55, 0x3a7ca5, 0xb5b8bb];
/** Polished procedural car: bevelled extruded body with clear-coat paint, glass greenhouse, wheels and lights. */
export class Car {
  readonly group = new THREE.Group();
  readonly lights: THREE.MeshStandardMaterial[] = [];
  readonly wheels: THREE.Object3D[] = [];
  constructor(o: { kind?: 'sedan' | 'hatch' | 'suv' | 'van' | 'taxi'; color?: THREE.ColorRepresentation; seed?: number } = {}) {
    const kind = o.kind ?? 'sedan', r = rng(o.seed ?? 3);
    const L = { sedan: 4.6, hatch: 4.0, suv: 4.7, van: 5.0, taxi: 4.6 }[kind], Wd = kind === 'van' || kind === 'suv' ? 1.9 : 1.8, Hb = kind === 'van' ? 1.9 : kind === 'suv' ? 1.65 : 1.42;
    const paint = new THREE.MeshPhysicalMaterial({ color: kind === 'taxi' ? 0xf2c200 : (o.color ?? PAINT[Math.floor(r() * PAINT.length)]), metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1418, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.3 });
    // Side profile (x along the car, y up): bumper, hood, windshield, roof, rear.
    const s = new THREE.Shape(), h = L / 2, wb = 0.32;
    s.moveTo(-h, wb); s.lineTo(-h, 0.75); s.quadraticCurveTo(-h + 0.1, 0.92, -h + 0.85, 0.95);
    if (kind === 'van') { s.lineTo(-h + 1.05, Hb - 0.1); s.quadraticCurveTo(-h + 1.15, Hb, -h + 1.5, Hb); s.lineTo(h - 0.1, Hb); s.quadraticCurveTo(h, Hb, h, Hb - 0.15); }
    else { const roofF = kind === 'hatch' ? -0.2 : -0.35, roofR = kind === 'hatch' ? h - 0.35 : kind === 'suv' ? h - 0.5 : 0.85;
      s.lineTo(roofF - 0.55, 1.0); s.quadraticCurveTo(roofF - 0.1, Hb, roofF + 0.25, Hb); s.lineTo(roofR - 0.35, Hb); s.quadraticCurveTo(roofR, Hb, roofR + 0.45, 1.02);
      if (kind === 'sedan' || kind === 'taxi') s.lineTo(h - 0.15, 0.98); s.quadraticCurveTo(h, 0.96, h, 0.78); }
    s.lineTo(h, wb); s.lineTo(-h, wb);
    const body = new THREE.ExtrudeGeometry(s, { depth: Wd - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 5, curveSegments: 24 }).translate(0, 0, -(Wd - 0.16) / 2);
    const bm = new THREE.Mesh(body, paint); bm.castShadow = bm.receiveShadow = true; this.group.add(bm);
    // Glass band: a slightly narrower copy of the cabin only.
    const gl = new THREE.Mesh(new THREE.BoxGeometry(kind === 'van' ? L - 1.7 : L * 0.48, Hb - 1.05, Wd - 0.02), glass);
    gl.position.set(kind === 'van' ? 0.35 : kind === 'hatch' ? 0.25 : 0.05, 1.02 + (Hb - 1.05) / 2 - 0.02, 0); gl.scale.set(1, 0.9, 1); this.group.add(gl);
    for (const [x, z] of [[-h + 0.85, 1], [-h + 0.85, -1], [h - 0.9, 1], [h - 0.9, -1]]) {
      const w = new THREE.Group(); w.position.set(x, 0.34, z * (Wd / 2 - 0.12));
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 }));
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.25, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.25, metalness: 0.9 }));
      w.add(tire, rim); tire.castShadow = true; this.group.add(w); this.wheels.push(w);
    }
    const head = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1d6, emissiveIntensity: 0.2, roughness: 0.2 });
    const tail = new THREE.MeshStandardMaterial({ color: 0x6a0d0d, emissive: 0xff2a1a, emissiveIntensity: 0.15, roughness: 0.3 });
    this.lights.push(head, tail);
    for (const z of [1, -1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.36), head); hl.position.set(-h - 0.06, 0.78, z * (Wd / 2 - 0.3)); this.group.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.42), tail); tl.position.set(h + 0.06, 0.82, z * (Wd / 2 - 0.28)); this.group.add(tl);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, Wd * 0.45), trim); grille.position.set(-h - 0.05, 0.55, 0); this.group.add(grille);
    if (kind === 'taxi') { const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c0, emissiveIntensity: 0.4 })); sign.position.set(0.0, Hb + 0.1, 0); this.group.add(sign); this.lights.push(sign.material as THREE.MeshStandardMaterial); }
  }
  /** Headlights and tail lights on (0..1). */
  set lit(v: number) { this.lights[0].emissiveIntensity = 0.2 + 6 * v; this.lights[1].emissiveIntensity = 0.15 + 3 * v; if (this.lights[2]) this.lights[2].emissiveIntensity = 0.4 + 2.5 * v; }
}

let _pool: THREE.Texture | undefined;
const poolTexture = () => _pool ??= (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();

/** Street lamp with a glowing head and a soft pool of light on the ground (additive decal; no shadow cost). */
/**
 * Street lamp on a curved arm. At night (`lit` 0..1) the head glows, a soft volumetric cone hangs beneath it and a
 * light pool warms the ground; with `{ light: true }` a real spotlight (no shadows) also lights the people, grass and
 * props around it — use it for the few lamps near the camera.
 */
export class StreetLamp {
  readonly group = new THREE.Group(); readonly head: THREE.MeshStandardMaterial; private pool: THREE.Mesh; private cone: LightBeam;
  readonly spot?: THREE.SpotLight; private spotPeak = 0;
  constructor(height = 5.5, armDir = 1, color: THREE.ColorRepresentation = 0xffc58a, opts: { light?: boolean; intensity?: number } = {}) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.45, metalness: 0.8 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, height, 12), metal); pole.position.y = height / 2; pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 8, 20, Math.PI / 2), metal); arm.rotation.z = armDir > 0 ? 0 : Math.PI; arm.rotation.y = 0; arm.position.set(armDir * 0.6, height - 0.6, 0);
    this.head = new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: color, emissiveIntensity: 0, roughness: 0.3 });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.16, 16), metal); lens.position.set(armDir * 1.2, height - 0.02, 0);
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), this.head); bulb.position.set(armDir * 1.2, height - 0.11, 0);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: poolTexture(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.pool.position.set(armDir * 1.2, 0.03, 0); this.pool.renderOrder = 3;
    this.cone = new LightBeam({ length: height - 0.2, radius: 1.9, color, intensity: 0.07, edge: 2.2, falloff: 0.9, nearFade: 2.5, radialSegments: 28 });
    this.cone.mesh.position.set(armDir * 1.2, height - 0.12, 0); this.cone.level = 0;
    this.group.add(pole, arm, lens, bulb, this.pool, this.cone.mesh);
    if (opts.light) {
      const sp = new THREE.SpotLight(color, 0, 0, 1.05, 0.75, 2); sp.position.set(armDir * 1.2, height - 0.16, 0); sp.target.position.set(armDir * 1.2, 0, 0);
      this.spotPeak = opts.intensity ?? 26; this.group.add(sp, sp.target); this.spot = sp;
    }
  }
  set lit(v: number) {
    this.head.emissiveIntensity = 7 * v; (this.pool.material as THREE.MeshBasicMaterial).opacity = (this.spot ? 0.1 : 0.32) * v; this.cone.level = v;
    if (this.spot) this.spot.intensity = this.spotPeak * v;   // stays in the scene at 0 by day (toggling visibility would recompile every shader)
  }
}

export class CityStreetV2 {
  readonly group = new THREE.Group();
  readonly buildings: Building[] = []; readonly lamps: StreetLamp[] = []; readonly cars: { car: Car; lane: number; z0: number; v: number }[] = [];
  readonly people: { h: HumanV2; x: number; z0: number; v: number; seed: number }[] = [];
  readonly length: number;
  constructor(o: CityStreetV2Options) {
    const r = rng(o.seed ?? 11), L = (this.length = o.length ?? 120), RW = o.roadWidth ?? 9, SW = o.sidewalk ?? 4, pbr = o.pbr;
    const road = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(RW, L).rotateX(-Math.PI / 2)), pbr.material('asphalt_02', { tint: 0x8c8c8c, roughness: 0.82 })); road.receiveShadow = true; road.position.z = -L / 2 + 10; this.group.add(road);
    const paint = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.6 });
    for (let z = 8; z > -L + 10; z -= 6) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3).rotateX(-Math.PI / 2), paint); m.position.set(0, 0.006, z); this.group.add(m); }
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.2).rotateX(-Math.PI / 2), paint); m.position.set(-RW / 2 + 0.8 + i * ((RW - 1.6) / 7), 0.006, -L * 0.45); m.rotation.y = 0; this.group.add(m); }
    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(SW, 0.16, L)), pbr.material('concrete_tiles_02', { tint: 0xb6b0a6 })); sw.position.set(side * (RW / 2 + SW / 2), 0.08, -L / 2 + 10); sw.receiveShadow = true; this.group.add(sw);
      const kerb = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(0.22, 0.18, L)), pbr.material('concrete_wall_008', { tint: 0xc9c5bc })); kerb.position.set(side * (RW / 2 + 0.11), 0.09, -L / 2 + 10); this.group.add(kerb);
      // Buildings.
      const styles = o.styles ?? ['townhouse', 'shop', 'apartment', 'townhouse', 'office', 'apartment', 'shop', 'tower'];
      let z = 10;
      while (z > -L + 12) {
        const style = styles[Math.floor(r() * styles.length)], w = style === 'tower' ? 16 + r() * 6 : style === 'office' ? 14 + r() * 5 : style === 'cottage' ? 8 + r() * 2 : 8 + r() * 6;
        const [f0, f1] = o.floors ?? [3, 8], floors = style === 'tower' ? 14 + Math.floor(r() * 12) : style === 'cottage' ? 2 : f0 + Math.floor(r() * (f1 - f0 + 1));
        const b = new Building({ style, width: w, depth: 12, floors, seed: Math.floor(r() * 1e5), balconies: style === 'apartment' && r() < 0.7, litFraction: o.litFraction ?? 0.62,
          wallTint: [0xffffff, 0xf3e7d9, 0xe9e2d6, 0xf5efe6, 0xdcd6cc][Math.floor(r() * 5)],
          shop: style === 'shop' ? { sign: ['Café', 'Books', 'Bakery', 'Pharmacy', 'Noodles', 'Florist', 'Deli', 'Market'][Math.floor(r() * 8)], color: [0xffd27a, 0x9fe0ff, 0xff9fb0, 0xb6ff9f][Math.floor(r() * 4)], awning: r() < 0.6 ? [0x2f5a8f, 0x9c2f2f, 0x2f6f4f, 0x8a6a2f][Math.floor(r() * 4)] : null } : null }, pbr);
        z -= w / 2; b.group.position.set(side * (RW / 2 + SW + 6), 0.16, z); b.group.rotation.y = -side * Math.PI / 2; z -= w / 2 + 0.3 + r() * 0.6;
        this.group.add(b.group); this.buildings.push(b);
      }
      // Lamps and trees along the kerb.
      for (let lz = 6; lz > -L + 10; lz -= o.lampSpacing ?? 16) { const lamp = new StreetLamp(5.6, -side); lamp.group.position.set(side * (RW / 2 + 0.6), 0.16, lz); this.group.add(lamp.group); this.lamps.push(lamp); }
      if (o.trees !== false) for (let tz = -2; tz > -L + 12; tz -= 16) { const t = new BroadleafTree({ height: 6 + r() * 2, canopyWidth: 3.6, leafCount: 1600, seed: Math.floor(r() * 999), leafColor: 0x4f7036 }); t.position.set(side * (RW / 2 + 1.6), 0.16, tz); this.group.add(t); }
    }
    // Traffic (two lanes, opposite directions) and pedestrians on both sidewalks.
    const kinds = ['sedan', 'hatch', 'suv', 'van', 'taxi', 'sedan', 'hatch'] as const;
    for (let i = 0; i < (o.cars ?? 10); i++) { const lane = i % 2 ? 1 : -1, car = new Car({ kind: kinds[Math.floor(r() * kinds.length)], seed: Math.floor(r() * 1e4) });
      car.group.rotation.y = lane > 0 ? Math.PI / 2 : -Math.PI / 2; this.group.add(car.group); this.cars.push({ car, lane, z0: r() * L, v: 6 + r() * 5 }); }
    for (let i = 0; i < (o.pedestrians ?? 16); i++) { const side = i % 2 ? 1 : -1, h = new HumanV2(HumanV2.random(Math.floor(r() * 1e5), { pbr }));
      this.group.add(h.root); this.people.push({ h, x: side * (RW / 2 + 1.2 + r() * (SW - 1.8)), z0: r() * L, v: (r() < 0.5 ? -1 : 1) * (1.0 + r() * 0.5) * (r() < 0.15 ? 0 : 1), seed: i }); }
  }
  setLight(night: number, zenith: THREE.ColorRepresentation, horizon: THREE.ColorRepresentation) {
    for (const b of this.buildings) b.setLight(night, zenith, horizon);
    for (const l of this.lamps) l.lit = night;
    for (const c of this.cars) c.car.lit = night;
  }
  update(t: number) {
    const L = this.length, zMin = -L + 10, zMax = 10, wrap = (d: number) => ((d % L) + L) % L;
    for (const b of this.buildings) b.update(t);
    for (const c of this.cars) {   // lane +1 drives toward +Z, lane −1 toward −Z
      const d = wrap(c.z0 + c.v * t), z = c.lane > 0 ? zMin + d : zMax - d;
      c.car.group.position.set(c.lane * 2.2, 0, z); for (const w of c.car.wheels) w.rotation.z = -(c.v * t) / 0.34;
    }
    for (const p of this.people) {
      if (p.v === 0) { p.h.root.position.set(p.x, 0.16, zMax - wrap(p.z0)); p.h.setPose(idlePose(t, p.seed)); continue; }
      const d = wrap(p.z0 + Math.abs(p.v) * t), z = p.v > 0 ? zMax - d : zMin + d;   // v > 0 walks toward −Z
      p.h.root.position.set(p.x, 0.16, z); p.h.root.rotation.y = p.v > 0 ? Math.PI : 0; p.h.setPose(walkPose(t * Math.abs(p.v) * 4.4 + p.seed, 1));
    }
  }
}
