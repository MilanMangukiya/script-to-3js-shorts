import * as THREE from 'three';
import { mulberry32, clamp, smoothstep } from '../util/math';

/**
 * city-street-block-v1 — Metre-Scale Urban Street, Vehicles, Lamps & Aerial District
 *
 * Preserves all 12 registered parameters in assets/registry.json and makeCityCar()[cite: 1].
 * Upgraded with sequential simulation destruction & hazard controls:
 * - `carLiftProgress` (0..1): Lifts and tilts street vehicles first ("The cars go first...")
 * - `roofLiftProgress` (0..1): Lifts building roof slabs and streetlamps next ("...then the roofs")
 * - `vehicleChaos` (0..1): Swerves cars at hazard angles with flashing emergency lights
 * - `blackoutProgress` (0..1): Progressive block-by-block window and streetlight outage
 */

export interface CityCarOptions {
  color?: string;
  seed?: number;
}

export function makeCityCar(options: CityCarOptions = {}): THREE.Group {
  const group = new THREE.Group();
  const bodyColor = options.color ?? '#334155';

  const lowerGeo = new THREE.BoxGeometry(1.82, 0.62, 4.2);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: 0.45,
    roughness: 0.32,
  });
  const lower = new THREE.Mesh(lowerGeo, bodyMat);
  lower.position.y = 0.52;
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  const cabinGeo = new THREE.BoxGeometry(1.56, 0.52, 2.2);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: '#0F172A',
    metalness: 0.8,
    roughness: 0.15,
  });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.04, -0.15);
  group.add(cabin);

  // Headlights & Taillights
  const headMat = new THREE.MeshBasicMaterial({ color: '#FEF08A' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#EF4444' });
  const lampGeo = new THREE.BoxGeometry(0.28, 0.14, 0.06);

  for (const sx of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(lampGeo, headMat);
    hl.position.set(sx, 0.56, 2.11);
    group.add(hl);

    const tl = new THREE.Mesh(lampGeo, tailMat);
    tl.position.set(sx, 0.58, -2.11);
    group.add(tl);
  }

  return group;
}

export interface CityStreetOptions {
  seed?: number;
  roadWidth?: number;
  sidewalkWidth?: number;
  blocks?: number;
  storeysMin?: number;
  storeysMax?: number;
  windowOccupancy?: number;
  wetness?: number;
  farFieldRadius?: number;
  vehicles?: number;
  lights?: boolean | number;
  time_s?: number;
  // New simulation escalation parameters
  carLiftProgress?: number;
  roofLiftProgress?: number;
  singularityOrigin?: [number, number, number];
  vehicleChaos?: number;
  blackoutProgress?: number;
}

interface DynamicVehicle {
  mesh: THREE.Group;
  basePos: THREE.Vector3;
  baseYaw: number;
  chaosYaw: number;
  chaosOffset: THREE.Vector3;
  seedOffset: number;
}

interface DynamicRoof {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  seedOffset: number;
}

export class CityStreet {
  public readonly group = new THREE.Group();
  private dynamicCars: DynamicVehicle[] = [];
  private dynamicRoofs: DynamicRoof[] = [];
  private windowMaterials: THREE.MeshBasicMaterial[] = [];

  public carLiftProgress = 0;
  public roofLiftProgress = 0;
  public singularityOrigin: [number, number, number] = [0, 18, -12];
  public vehicleChaos = 0;
  public blackoutProgress = 0;

  constructor(options: CityStreetOptions = {}) {
    const seed = options.seed ?? 404;
    const rng = mulberry32(seed);
    const roadWidth = options.roadWidth ?? 10;
    const sidewalkWidth = options.sidewalkWidth ?? 4;
    const blocks = options.blocks ?? 4;
    const storeysMin = options.storeysMin ?? 4;
    const storeysMax = options.storeysMax ?? 8;
    const wetness = options.wetness ?? 0.25;
    const vehicleCount = options.vehicles ?? 8;

    this.carLiftProgress = options.carLiftProgress ?? 0;
    this.roofLiftProgress = options.roofLiftProgress ?? 0;
    if (options.singularityOrigin) this.singularityOrigin = options.singularityOrigin;
    this.vehicleChaos = options.vehicleChaos ?? 0;
    this.blackoutProgress =
      options.lights === false ? 1 : typeof options.lights === 'number' ? 1 - options.lights : options.blackoutProgress ?? 0;

    const totalLength = blocks * 28;

    // 1. Roadway & Zebra Crossing at Origin[cite: 1]
    const roadGeo = new THREE.PlaneGeometry(roadWidth, totalLength);
    const roadMat = new THREE.MeshStandardMaterial({
      color: '#1E242B',
      roughness: clamp(0.75 - wetness * 0.55, 0.15, 0.85),
      metalness: wetness * 0.35,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI * 0.5;
    road.receiveShadow = true;
    this.group.add(road);

    // Zebra stripes at z = 0
    const stripeGeo = new THREE.PlaneGeometry(0.55, 3.2);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#E2E8F0',
      roughness: 0.6,
    });
    for (let x = -roadWidth * 0.42; x <= roadWidth * 0.42; x += 1.15) {
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI * 0.5;
      stripe.position.set(x, 0.012, 0);
      this.group.add(stripe);
    }

    // 2. Sidewalks & Building Blocks + Detachable Roof Slabs
    const facadeStartX = roadWidth * 0.5 + sidewalkWidth;
    const sidewalkGeo = new THREE.BoxGeometry(sidewalkWidth, 0.18, totalLength);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.7,
    });

    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(sidewalkGeo, sidewalkMat);
      sw.position.set(side * (roadWidth * 0.5 + sidewalkWidth * 0.5), 0.09, 0);
      sw.receiveShadow = true;
      this.group.add(sw);

      for (let b = -blocks; b < blocks; b++) {
        const storeys =
          storeysMin + Math.floor(rng() * (storeysMax - storeysMin + 1));
        const bHeight = storeys * 3.4;
        const bDepth = 12.5;
        const bWidth = 14.0;
        const zCenter = b * 14.0 + 7.0;
        const xCenter = side * (facadeStartX + bWidth * 0.5);

        const wallMat = new THREE.MeshStandardMaterial({
          color: b % 2 === 0 ? '#334155' : '#475569',
          roughness: 0.78,
        });
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(bWidth, bHeight, bDepth),
          wallMat
        );
        building.position.set(xCenter, bHeight * 0.5, zCenter);
        building.castShadow = true;
        building.receiveShadow = true;
        this.group.add(building);

        // Emissive Window Band
        const winMat = new THREE.MeshBasicMaterial({
          color: '#FDE68A',
          transparent: true,
          opacity: options.windowOccupancy ?? 0.75,
        });
        this.windowMaterials.push(winMat);
        const winPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(bDepth * 0.82, bHeight * 0.78),
          winMat
        );
        winPlane.position.set(
          side * (facadeStartX + 0.04),
          bHeight * 0.52,
          zCenter
        );
        winPlane.rotation.y = side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
        this.group.add(winPlane);

        // Detachable Roof Cap (for "then the roofs" escalation)
        const roofGeo = new THREE.BoxGeometry(bWidth + 0.4, 0.45, bDepth + 0.4);
        const roofMat = new THREE.MeshStandardMaterial({
          color: '#1E293B',
          roughness: 0.65,
        });
        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        const baseRoofPos = new THREE.Vector3(xCenter, bHeight + 0.22, zCenter);
        roofMesh.position.copy(baseRoofPos);
        this.group.add(roofMesh);
        this.dynamicRoofs.push({
          mesh: roofMesh,
          basePos: baseRoofPos,
          seedOffset: rng(),
        });
      }
    }

    // 3. Unbranded City Vehicles[cite: 1]
    const carPalette = ['#E2E8F0', '#38BDF8', '#F59E0B', '#EF4444', '#64748B', '#1E293B'];
    for (let i = 0; i < vehicleCount; i++) {
      const laneSide = i % 2 === 0 ? -1 : 1;
      const laneX = laneSide * (roadWidth * 0.24);
      const zPos = (i - vehicleCount * 0.5) * 11.5 + (i >= vehicleCount * 0.5 ? 5.5 : -5.5);
      const car = makeCityCar({
        color: carPalette[i % carPalette.length],
        seed: seed + i,
      });
      const basePos = new THREE.Vector3(laneX, 0, zPos);
      const baseYaw = laneSide > 0 ? Math.PI : 0;
      const chaosYaw = baseYaw + (rng() - 0.5) * 0.85;
      const chaosOffset = new THREE.Vector3((rng() - 0.5) * 1.4, 0, (rng() - 0.5) * 1.2);

      car.position.copy(basePos);
      car.rotation.y = baseYaw;
      this.group.add(car);

      this.dynamicCars.push({
        mesh: car,
        basePos,
        baseYaw,
        chaosYaw,
        chaosOffset,
        seedOffset: rng(),
      });
    }

    if (options.time_s !== undefined) {
      this.update(options.time_s);
    }
  }

  public update(time_s: number): void {
    const [ox, oy, oz] = this.singularityOrigin;
    const chaos = clamp(this.vehicleChaos, 0, 1);
    const carLift = clamp(this.carLiftProgress, 0, 1);
    const roofLift = clamp(this.roofLiftProgress, 0, 1);
    const blackout = clamp(this.blackoutProgress, 0, 1);

    // 1. Update Cars ("The cars go first...")
    for (let i = 0; i < this.dynamicCars.length; i++) {
      const c = this.dynamicCars[i];
      const staggeredLift = smoothstep(0, 1, clamp(carLift * 1.3 - c.seedOffset * 0.3, 0, 1));
      const pos = c.basePos.clone().addScaledVector(c.chaosOffset, chaos);

      if (staggeredLift > 0) {
        const pull = staggeredLift * staggeredLift;
        pos.x = pos.x * (1 - pull * 0.75) + ox * (pull * 0.75);
        pos.y = oy * pull + staggeredLift * 6.5;
        pos.z = pos.z * (1 - pull * 0.75) + oz * (pull * 0.75);
      }

      c.mesh.position.copy(pos);
      c.mesh.rotation.set(
        staggeredLift * 1.6,
        c.baseYaw + (c.chaosYaw - c.baseYaw) * chaos + staggeredLift * 2.2,
        staggeredLift * 1.1
      );
    }

    // 2. Update Roofs ("...then the roofs")
    for (let i = 0; i < this.dynamicRoofs.length; i++) {
      const r = this.dynamicRoofs[i];
      const staggeredRoof = smoothstep(0, 1, clamp(roofLift * 1.35 - r.seedOffset * 0.35, 0, 1));
      const pos = r.basePos.clone();

      if (staggeredRoof > 0) {
        const pull = staggeredRoof * staggeredRoof;
        pos.x = pos.x * (1 - pull * 0.65) + ox * (pull * 0.65);
        pos.y = pos.y + staggeredRoof * 5.0 + (oy - pos.y) * pull * 0.5;
        pos.z = pos.z * (1 - pull * 0.65) + oz * (pull * 0.65);
      }

      r.mesh.position.copy(pos);
      r.mesh.rotation.set(
        staggeredRoof * 0.9,
        staggeredRoof * 1.2,
        staggeredRoof * 0.75
      );
    }

    // 3. Progressive Window Blackout Wave
    for (let i = 0; i < this.windowMaterials.length; i++) {
      const threshold = i / Math.max(1, this.windowMaterials.length);
      const isOut = blackout > threshold;
      this.windowMaterials[i].opacity = isOut ? 0.04 : 0.78;
    }
  }
}