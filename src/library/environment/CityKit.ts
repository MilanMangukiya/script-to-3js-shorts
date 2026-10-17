import * as THREE from 'three';
import { rng } from '../util/math';
import { projectUVs, type PBRLibrary } from '../materials/PBR';
import { Building, type BuildingStyle } from './BuildingKit';
import { BroadleafTree } from './BroadleafTree';
import { HumanV2, walkPose, idlePose } from '../characters/HumanV2';
import { LightBeam } from '../fx/LightBeam';
import { Vehicle, type VehicleKind } from '../vehicles/RoadVehicles';

/**
 * City kit: a street (asphalt road with markings, raised kerbs and paved sidewalks) lined with varied BuildingKit
 * blocks, street lamps that pool warm light on the pavement, trees, RoadVehicles traffic (moving cars, taxis, vans
 * and buses with head/tail lights) and walking HumanV2 pedestrians. Metres; the street runs along Z (toward −Z is "down the street").
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

/** Kept for CityStreetV2 and older callers: now a RoadVehicles vehicle (glass greenhouse, spoked wheels, liveries). */
export class Car extends Vehicle {
  constructor(o: { kind?: VehicleKind; color?: THREE.ColorRepresentation; seed?: number } = {}) { super(o); }
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
    const kinds = ['sedan', 'hatch', 'suv', 'van', 'taxi', 'sedan', 'hatch', 'pickup'] as const;
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
