// Lookdev: every RoadVehicles kind and the street-furniture set on a sunlit street (two 3/4 views), then the same
// street at night with head/tail lights, a police light bar, the shelter advert and traffic signals lit.
// Frames: 15 = cars, 45 = big vehicles, 75 = props, 105 = night.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { PhysicalSky } from '../library/environment/PhysicalSky';
import { Vehicle, type VehicleKind } from '../library/vehicles/RoadVehicles';
import { TrafficLight, FireHydrant, Bench, LitterBin, Mailbox, BusShelter, Bollard, TrafficCone, ParkingMeter, ManholeCover } from '../library/props/StreetFurniture';
import { StreetLamp } from '../library/environment/CityKit';
import { PBRLibrary, projectUVs } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'smoothstep' });
const shot = (id: string, a: number, b: number, p0: number[], l0: number[], p1: number[], l1: number[], fov = 40) =>
  ({ id: 'S0' + id, start_s: a, end_s: b, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: a, end_s: b, camera: { projection: 'perspective', fov_or_scale: fov, keyframes: [kf(a, p0, l0), kf(b, p1, l1)] } }] });
export const spec = { duration_s: 4, quality: 'cinematic' as const, scenes: [
  shot('1', 0, 1, [9, 2.6, 14], [-1, 0.8, 0], [9, 2.6, 14], [-1, 0.8, 0], 40),
  shot('2', 1, 2, [-12, 4, 22], [-6, 1.4, -6], [-12, 4, 22], [-6, 1.4, -6], 40),
  shot('3', 2, 3, [2.5, 1.5, 9.5], [2.5, 0.8, 5.2], [2.5, 1.5, 9.5], [2.5, 0.8, 5.2], 46),
  shot('4', 3, 4, [9, 2.2, 14], [-1, 0.9, 0], [9, 2.2, 14], [-1, 0.9, 0], 40),
] };

class Street implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 5000); sunDirection = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
  sky = new PhysicalSky({ cloudCover: 0.25, stars: 1500 }); key = new THREE.DirectionalLight(0xfff0dc, 2.8); hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a4438, 0.55);
  cars: Vehicle[] = []; lamps: StreetLamp[] = []; signals: TrafficLight[] = []; shelter = new BusShelter({ seed: 7 });
  private dayEnv: THREE.Texture; private nightEnv: THREE.Texture;
  constructor(renderer: THREE.WebGLRenderer, pbr: PBRLibrary) {
    const s = this.scene; this.sky.addTo(s); s.add(this.key, this.key.target, this.hemi);
    const road = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(400, 14).rotateX(-Math.PI / 2)), pbr.material('asphalt_02', { tint: 0x8a8a8a })); road.receiveShadow = true; road.position.z = -3; s.add(road);
    const walk = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(400, 0.15, 6)), pbr.material('concrete_tiles_02', { tint: 0xb4aea4 })); walk.position.set(0, 0.075, 7); walk.receiveShadow = true; s.add(walk);
    const far = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(400, 0.15, 6)), pbr.material('concrete_tiles_02', { tint: 0xb4aea4 })); far.position.set(0, 0.075, -13); far.receiveShadow = true; s.add(far);
    const paint = new THREE.MeshStandardMaterial({ color: 0xe9e5d8, roughness: 0.6 });
    for (let x = -60; x < 60; x += 6) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.14).rotateX(-Math.PI / 2), paint); m.position.set(x, 0.005, -3); s.add(m); }
    // Cars along the near lane, big vehicles behind.
    (['sedan', 'hatch', 'suv', 'pickup', 'taxi', 'police'] as VehicleKind[]).forEach((k, i) => { const v = new Vehicle({ kind: k, seed: 10 + i }); v.group.position.set(-12 + i * 5.6, 0, 1.2); s.add(v.group); this.cars.push(v); });
    (['ambulance', 'van', 'bus', 'truck'] as VehicleKind[]).forEach((k, i) => { const v = new Vehicle({ kind: k, seed: 30 + i }); v.group.position.set(-26 + [0, 7.5, 17, 31][i], 0, -6.5); s.add(v.group); this.cars.push(v); });
    this.cars[5].siren = true; this.cars[6].siren = true;
    // Kerb-side props.
    const at = (o: THREE.Object3D, x: number, z: number, ry = 0) => { o.position.set(x, 0.15, z); o.rotation.y = ry; s.add(o); };
    const sig = new TrafficLight({ arm: 0 }); at(sig.group, 6, 4.6); this.signals.push(sig);
    const sig2 = new TrafficLight({ arm: 0 }); sig2.offset = 9; at(sig2.group, -14, 4.6); this.signals.push(sig2);
    at(new FireHydrant().group, 0.2, 4.7); at(new Bench().group, 2.6, 6.3, Math.PI); at(new LitterBin().group, 4.3, 6.0); at(new Mailbox().group, -1.6, 5.2, Math.PI);
    at(this.shelter.group, -6, 7.6, Math.PI); [8.5, 9.6, 10.7].forEach((x) => at(new Bollard().group, x, 4.6)); [-3, -3.8].forEach((x, i) => at(new TrafficCone().group, x, 4.8 - i * 0.3, i));
    at(new ParkingMeter().group, 1.4, 4.6); const mh = new ManholeCover(); mh.group.position.set(3.5, 0, -1); s.add(mh.group);
    for (const x of [-18, -2, 14]) { const l = new StreetLamp(5.5, -1, 0xffc78a, { light: x === -2, intensity: 30 }); l.group.position.set(x, 0.15, 4.3); s.add(l.group); this.lamps.push(l); }
    this.key.castShadow = true; this.key.shadow.mapSize.set(4096, 4096); Object.assign(this.key.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 140 }); this.key.shadow.bias = -0.0003; this.key.shadow.normalBias = 0.03;
    this.sky.setSun(this.sunDirection); this.dayEnv = this.sky.bakeEnvironment(renderer);
    this.sky.setSun(new THREE.Vector3(0.2, -0.35, -0.9).normalize()); this.nightEnv = this.sky.bakeEnvironment(renderer);
  }
  update(t: number, sh: ShotInfo) {
    const night = sh.sceneId === 'S04' ? 1 : 0, s = this.scene;
    this.sunDirection.set(night ? 0.2 : -0.45, night ? -0.35 : 0.55, night ? -0.9 : 0.7).normalize(); this.sky.setSun(this.sunDirection);
    s.environment = night ? this.nightEnv : this.dayEnv; s.environmentIntensity = night ? 0.06 : 0.5;
    this.key.position.copy(this.sunDirection).multiplyScalar(60); this.key.intensity = night ? 0 : 2.8; this.hemi.intensity = night ? 0.05 : 0.6;
    s.fog = new THREE.FogExp2(this.sky.horizonColor(), night ? 0.01 : 0.004);
    this.sky.update(t); this.sky.follow(this.camera);
    this.cars.forEach((c, i) => { c.lit = night; c.indicator = i === 2 ? -1 : 0; c.brake = i === 0 && night ? 1 : 0; c.update(t, t * (i % 3)); });
    this.lamps.forEach((l) => (l.lit = night)); this.shelter.lit = night; this.signals.forEach((g) => g.update(t));
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['asphalt_02', 'concrete_tiles_02']);
  const stage = new Street(ctx.renderer, pbr);
  const post = { exposure: 1.0, bloomStrength: 0.2, vignette: 0.3, grain: 0.004, ao: 0.75, aoRadius: 0.6, vibrance: 0.1 };
  return { shots: { 'S01/SH01': { stage, post }, 'S02/SH01': { stage, post }, 'S03/SH01': { stage, post: { ...post, dof: 4.5, dofAperture: 0.006 } }, 'S04/SH01': { stage, post: { ...post, exposure: 1.6, bloomStrength: 0.65, bloomThreshold: 0.7 } } } };
}
