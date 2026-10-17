// Lookdev: nature kit, energy kit, insects and weather/impact FX. Frames: 15 = meadow props + butterflies,
// 45 = desert cacti and boulders, 75 = wind farm with pylons, 105 = storm with lightning, 135 = tornado,
// 165 = explosion with shock shell and dust ring, 195 = fireflies at dusk.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { PhysicalSky } from '../library/environment/PhysicalSky';
import { Boulder, RockScatter, Shrub, FlowerPatch, Cactus } from '../library/environment/NatureKit';
import { WindTurbine, PowerPylon, PowerLine } from '../library/environment/EnergyKit';
import { InsectSwarm } from '../library/creatures/InsectSwarm';
import { Lightning } from '../library/fx/Lightning';
import { Tornado } from '../library/fx/Tornado';
import { Explosion } from '../library/fx/Explosion';
import { PBRLibrary, projectUVs } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'smoothstep' });
const shot = (id: string, a: number, b: number, p0: number[], l0: number[], p1: number[], l1: number[], fov = 42) =>
  ({ id: 'S0' + id, start_s: a, end_s: b, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: a, end_s: b, camera: { projection: 'perspective', fov_or_scale: fov, keyframes: [kf(a, p0, l0), kf(b, p1, l1)] } }] });
export const spec = { duration_s: 7, quality: 'cinematic' as const, scenes: [
  shot('1', 0, 1, [0, 1.0, 6], [0, 0.6, 0], [0.2, 1.0, 5.8], [0, 0.6, 0]),
  shot('2', 1, 2, [60, 1.6, 8], [60, 1.6, -2], [60.2, 1.6, 7.9], [60, 1.6, -2]),
  shot('3', 2, 3, [-80, 20, 160], [-80, 50, -60], [-80, 20, 160], [-80, 50, -60], 46),
  shot('4', 3, 4, [0, 30, 380], [0, 120, -400], [0, 30, 380], [0, 120, -400], 52),
  shot('5', 4, 5, [0, 40, 900], [0, 260, -500], [0, 40, 900], [0, 260, -500], 50),
  shot('6', 5, 6, [0, 25, 330], [0, 40, 0], [0, 25, 330], [0, 40, 0], 50),
  shot('7', 6, 7, [0, 1.0, 6], [0, 0.9, 0], [0, 1.0, 6], [0, 0.9, 0]),
] };

class Outdoors implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.05, 30000); sunDirection = new THREE.Vector3(0.5, 0.55, 0.6).normalize();
  sky = new PhysicalSky({ cloudCover: 0.3, stars: 2000 }); key = new THREE.DirectionalLight(0xfff0dc, 2.8); hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a4632, 0.6);
  shrubs: Shrub[] = []; flowers: FlowerPatch; butterflies = new InsectSwarm({ kind: 'butterfly', count: 18, radius: 3, height: [0.3, 1.6], center: new THREE.Vector3(0, 0, -0.5) });
  bees = new InsectSwarm({ kind: 'bee', count: 12, radius: 1.2, height: [0.2, 0.7], center: new THREE.Vector3(1.4, 0, 0.6) });
  fireflies = new InsectSwarm({ kind: 'firefly', count: 200, radius: 6, height: [0.2, 2.5] });
  turbines: WindTurbine[] = []; lightning = new Lightning(); tornado = new Tornado({ height: 650, sunDirection: this.sunDirection }); boom = new Explosion({ start_s: 5.0, radius: 30, duration: 6 });
  flash = new THREE.PointLight(0xcfd9ff, 0, 0, 0); envDay: THREE.Texture; envNight: THREE.Texture;
  constructor(private renderer: THREE.WebGLRenderer, pbr: PBRLibrary) {
    const s = this.scene; this.sky.addTo(s); s.add(this.key, this.key.target, this.hemi, this.flash);
    const ground = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2)), pbr.material('aerial_grass_rock', { tint: 0x8aa060, tile: 4 })); ground.receiveShadow = true; s.add(ground);
    const sand = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2)), pbr.material('coast_sand_01', { tint: 0xe0c8a0, tile: 3 })); sand.position.set(60, 0.01, -8); sand.receiveShadow = true; s.add(sand);
    // Meadow (S01, S07).
    [[-1.8, -1.2, 1.1, 0x3f6b2c, undefined], [1.9, -1.6, 0.9, 0x4a7a33, 0xf0d040], [0.4, -2.8, 1.3, 0x365f28, 0xe86a9a]].forEach(([x, z, sz, c, fl], i) => { const b = new Shrub({ size: sz as number, seed: 4 + i, color: c as number, flowers: fl as number | undefined }); b.group.position.set(x as number, 0, z as number); s.add(b.group); this.shrubs.push(b); });
    this.flowers = new FlowerPatch({ area: [-4, 4, -4, 2.5], kinds: ['daisy', 'poppy', 'lavender', 'tulip'], count: 900 }); s.add(this.flowers.group);
    const sf = new FlowerPatch({ area: [2.5, 5, -3, -1], kinds: ['sunflower'], count: 30, seed: 4 }); s.add(sf.group); this.sunflowers = sf;
    const b0 = new Boulder({ size: 0.8, seed: 9, pbr }); b0.mesh.position.set(-0.6, 0, -1.4); s.add(b0.mesh);
    s.add(new RockScatter({ area: [-4, 4, -4, 3], count: 160, maxSize: 0.18 }).group);
    s.add(this.butterflies.group, this.bees.group, this.fireflies.group);
    // Desert (S02).
    [[56, -3, 5.5], [63, -5, 4.2], [59, -9, 6.5]].forEach(([x, z, h], i) => { const c = new Cactus({ height: h, seed: 3 + i }); c.group.position.set(x, 0, z); s.add(c.group); });
    [[61, -1.5, 1.2], [57.5, -0.5, 0.6], [64, -2.5, 2]].forEach(([x, z, sz], i) => { const b = new Boulder({ size: sz, seed: 20 + i, color: 0xc49a6c, mossy: 0, pbr }); b.mesh.position.set(x, 0, z); s.add(b.mesh); });
    s.add(new RockScatter({ area: [52, 68, -12, 4], count: 300, maxSize: 0.25, color: 0xd0a878, seed: 3 }).group);
    // Wind farm and pylons (S03).
    for (let i = 0; i < 5; i++) { const w = new WindTurbine({ height: 90, rpm: 13 + i, phase: i * 1.3, yaw: 0.3 }); w.group.position.set(-160 + i * 55, 0, -140 - (i % 2) * 60); s.add(w.group); this.turbines.push(w); }
    const pyl = [0, 1, 2].map((i) => { const p = new PowerPylon({ height: 42 }); p.group.position.set(-40 + i * 90, 0, -40); p.group.rotation.y = 0; s.add(p.group); return p; });
    for (let i = 0; i < 2; i++) s.add(new PowerLine(pyl[i], pyl[i + 1]).group);
    // Storm and impacts (S04–S06).
    for (let k = 0; k < 3; k++) this.lightning.strike(3.2 + k * 0.28, new THREE.Vector3(-120 + k * 110, 520, -420), new THREE.Vector3(-90 + k * 80, 0, -380), 7 + k * 5);
    s.add(this.lightning.group); this.tornado.group.position.set(0, 0, -500); s.add(this.tornado.group); this.boom.group.position.set(0, 0, 0); s.add(this.boom.group);
    this.key.castShadow = true; this.key.shadow.mapSize.set(4096, 4096); Object.assign(this.key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 200 }); this.key.shadow.bias = -0.0003; this.key.shadow.normalBias = 0.03;
    this.sky.setSun(this.sunDirection); this.envDay = this.sky.bakeEnvironment(renderer); this.sky.setSun(new THREE.Vector3(0.4, -0.12, -0.9).normalize()); this.envNight = this.sky.bakeEnvironment(renderer);
  }
  private sunflowers: FlowerPatch;
  update(t: number, sh: ShotInfo) {
    const id = sh.sceneId, s = this.scene, storm = id === 'S04' || id === 'S05', dusk = id === 'S07';
    this.sunDirection.set(dusk ? 0.4 : 0.5, dusk ? -0.08 : storm ? 0.35 : 0.55, dusk ? -0.9 : 0.6).normalize(); this.sky.setSun(this.sunDirection);
    this.sky.cloudCover = storm ? 0.95 : 0.3; s.environment = dusk ? this.envNight : this.envDay; s.environmentIntensity = dusk ? 0.08 : storm ? 0.25 : 0.5;
    this.key.position.copy(this.sunDirection).multiplyScalar(60).add(this.camera.position.clone().setY(0)); this.key.target.position.copy(this.camera.position).setY(0);
    this.key.intensity = dusk ? 0 : storm ? 0.6 : 2.8; this.hemi.intensity = dusk ? 0.05 : storm ? 0.3 : 0.6;
    s.fog = storm ? new THREE.FogExp2(0x464b53, 0.0005) : new THREE.FogExp2(this.sky.horizonColor(), 0.0006);
    this.sky.update(t); this.sky.follow(this.camera);
    this.shrubs.forEach((b) => b.update(t)); this.flowers.update(t); this.sunflowers.update(t, 0.05);
    this.butterflies.update(t); this.bees.update(t); this.fireflies.update(t); this.fireflies.group.visible = dusk; this.butterflies.group.visible = this.bees.group.visible = !dusk;
    this.turbines.forEach((w) => w.update(t, dusk ? 1 : 0));
    this.lightning.update(t); this.flash.position.set(0, 500, -400); this.flash.intensity = this.lightning.flash * 6;
    this.tornado.update(t); this.tornado.group.visible = id === 'S05'; this.boom.update(t); this.boom.group.visible = id === 'S06';
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['aerial_grass_rock', 'coast_sand_01', 'rock_face']);
  const stage = new Outdoors(ctx.renderer, pbr);
  const post = { exposure: 1.0, bloomStrength: 0.25, vignette: 0.3, grain: 0.004, ao: 0.6, aoRadius: 0.4, vibrance: 0.12 };
  return { shots: { 'S01/SH01': { stage, post }, 'S02/SH01': { stage, post: { ...post, heatHaze: 0.4 } }, 'S03/SH01': { stage, post }, 'S04/SH01': { stage, post: { ...post, bloomStrength: 0.6, exposure: 0.55 } },
    'S05/SH01': { stage, post: { ...post, exposure: 0.7 } }, 'S06/SH01': { stage, post: { ...post, tonemap: 'agx' as const, bloomStrength: 0.6 } }, 'S07/SH01': { stage, post: { ...post, exposure: 1.4, bloomStrength: 0.7, bloomThreshold: 0.6 } } } };
}
