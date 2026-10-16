// Lookdev: lush grass with wildflowers by day and by night (street lamp with a real spotlight, lighthouse beams),
// then a beach shore (turquoise shallows, foam, palms, parasol and towel, strollers).
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { PhysicalSky } from '../library/environment/PhysicalSky';
import { LushGrass } from '../library/environment/LushGrass';
import { StreetLamp } from '../library/environment/CityKit';
import { Lighthouse } from '../library/environment/Lighthouse';
import { OceanSurface } from '../library/environment/OceanSurface';
import { PalmTree } from '../library/environment/PalmTree';
import { BeachParasol, BeachTowel } from '../library/props/BeachSet';
import { HumanV2, walkPose } from '../library/characters/HumanV2';
import { PBRLibrary, projectUVs } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'smoothstep' });
const shot = (id: string, a: number, b: number, p0: number[], l0: number[], p1: number[], l1: number[], fov = 44) =>
  ({ id: 'S0' + id, start_s: a, end_s: b, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: a, end_s: b, camera: { projection: 'perspective', fov_or_scale: fov, keyframes: [kf(a, p0, l0), kf(b, p1, l1)] } }] });
export const spec = { duration_s: 9, quality: 'cinematic' as const, scenes: [
  shot('1', 0, 3, [0, 0.9, 5], [0, 0.5, -6], [0.4, 0.8, 4.2], [0, 0.45, -6]),
  shot('2', 3, 6, [0, 1.1, 5], [-2, 2, -12], [0.4, 1.0, 4.4], [-2, 2, -12]),
  shot('3', 6, 9, [1.9, 0.62, 4.5], [0, 1.25, -2], [1.6, 0.6, 3.9], [0, 1.2, -2]),
] };

const SUN_DAY = new THREE.Vector3(0.5, 0.42, -0.75).normalize(), SUN_NIGHT = new THREE.Vector3(0.3, -0.3, -0.9).normalize();
class Meadow implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(44, 9 / 16, 0.03, 5000); sunDirection = new THREE.Vector3();
  sky = new PhysicalSky({ cloudCover: 0.35, stars: 2500 }); key = new THREE.DirectionalLight(0xfff0dc, 2.6); hemi = new THREE.HemisphereLight(0xbcd2ff, 0x3a3328, 0.6);
  grass: LushGrass; lamp = new StreetLamp(4.2, 1, 0xffc27a, { light: true, intensity: 22 }); lighthouse: Lighthouse;
  constructor(private night: boolean, private renderer: THREE.WebGLRenderer, pbr: PBRLibrary) {
    const s = this.scene; this.sky.addTo(s); s.add(this.key, this.key.target, this.hemi);
    const ground = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2)), pbr.material('aerial_grass_rock', { tint: 0x7c9452, tile: 5 })); ground.receiveShadow = true; s.add(ground);
    this.grass = new LushGrass({ area: [-25, 25, -40, 8], ground: () => 0, focus: [0, 0], nearRadius: 8, density: 130, flowers: { count: 3000 }, seed: 5 }); s.add(this.grass.group);
    this.lamp.group.position.set(-1.6, 0, -2.5); s.add(this.lamp.group);
    this.lighthouse = new Lighthouse({ height: 15, pbr, rpm: 7, beamLength: 150 }); this.lighthouse.group.position.set(-14, 0, -30); s.add(this.lighthouse.group);
    this.key.castShadow = true; this.key.shadow.mapSize.set(4096, 4096); Object.assign(this.key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 80 });
    this.sunDirection.copy(night ? SUN_NIGHT : SUN_DAY); this.sky.setSun(this.sunDirection);
    s.environment = this.sky.bakeEnvironment(this.renderer); s.environmentIntensity = night ? 0.08 : 0.5;
    this.key.position.copy(this.sunDirection).multiplyScalar(40); this.key.intensity = night ? 0 : 2.6; this.hemi.intensity = night ? 0.14 : 0.8;
    s.fog = new THREE.FogExp2(this.sky.horizonColor(), 0.004);
  }
  update(t: number, _s: ShotInfo) {
    this.sky.update(t); this.sky.follow(this.camera); this.grass.update(t, { bend: 0.16, direction: new THREE.Vector2(0.4, 1), gust: 0.45, gustSpeed: 3 });
    this.lamp.lit = this.night ? 1 : 0; this.lighthouse.night = this.night ? 1 : 0; this.lighthouse.update(t, this.camera);
  }
}

const SHORE_Z = -11.1, sandY = (_x: number, z: number) => -0.055 * Math.max(0, -(z + 3.5));
class Beach implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(44, 9 / 16, 0.05, 20000); sunDirection = new THREE.Vector3(0.36, 0.82, 0.45).normalize();
  sky = new PhysicalSky({ cloudCover: 0.34, cloudScale: 1400, turbidity: 2.2, stars: 0 }); walkers: HumanV2[] = []; palms: PalmTree[] = []; parasol = new BeachParasol({ colors: [0xe0533d, 0xf6f1e4] });
  ocean = new OceanSurface({ size: 20000, level: -0.42, deepColor: 0x0a5c7c, sunDirection: this.sunDirection, waveHeight: 0.3, reflectivity: 0.55, shore: { origin: [0, SHORE_Z], direction: [0, -1], slope: 0.055 } });
  constructor(renderer: THREE.WebGLRenderer, pbr: PBRLibrary) {
    const s = this.scene; this.sky.addTo(s); this.sky.setSun(this.sunDirection); s.add(this.ocean.mesh);
    s.environment = this.sky.bakeEnvironment(renderer); s.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xfff3df, 2.6); key.position.copy(this.sunDirection).multiplyScalar(24); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 60 }); s.add(key, new THREE.HemisphereLight(0xcfe6ff, 0xe6d4b0, 0.7));
    const geo = new THREE.PlaneGeometry(120, 120, 120, 120).rotateX(-Math.PI / 2), p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, sandY(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals(); projectUVs(geo); const sm = pbr.material('coast_sand_01', { tile: 1.0 }); sm.color.setRGB(1.62, 1.48, 1.26);
    const sand = new THREE.Mesh(geo, sm); sand.receiveShadow = true; s.add(sand);
    for (const [x, z, h, seed] of [[-2.3, -2.6, 5.2, 3], [3.5, -6, 6.5, 8]]) { const pt = new PalmTree({ height: h, seed, lean: 0.3, leanDir: x < 0 ? 2.4 : -1.2, pbr }); pt.group.position.set(x, sandY(x, z), z); s.add(pt.group); this.palms.push(pt); }
    this.parasol.group.position.set(-3.8, sandY(-3.8, -5.5), -5.5); s.add(this.parasol.group);
    s.add(new BeachTowel({ position: [-3.1, -4.8], yaw: 0.4, ground: sandY, seed: 2 }).mesh);
    for (let i = 0; i < 4; i++) { const h = new HumanV2({ ...HumanV2.random(500 + i * 17, { bottom: 'shorts', shoes: 'none' }), pbr }); s.add(h.root); this.walkers.push(h); }
    s.fog = new THREE.FogExp2(this.sky.horizonColor(), 0.0018);
    this.ocean.uniforms.uHorizon.value.copy(this.sky.horizonColor()); this.ocean.uniforms.uZenith.value.copy(this.sky.zenithColor()); this.ocean.uniforms.uFogColor.value.copy(this.sky.horizonColor());
  }
  update(t: number, _s: ShotInfo) {
    this.walkers.forEach((h, i) => { const v = i % 2 ? -0.9 : 1.0, x = (i - 1.5) * 2.5 + v * (t - 6), z = SHORE_Z + 1.2 + (i % 3) * 0.4;
      h.root.position.set(x, sandY(x, z), z); h.root.rotation.y = v > 0 ? Math.PI / 2 : -Math.PI / 2; h.setPose(walkPose(t * Math.abs(v) * 4.4 + i, 0.9)); });
    for (const p of this.palms) p.update(t, 0.5);
    this.parasol.update(t, 0.5); this.sky.update(t); this.sky.follow(this.camera); this.ocean.update(t);
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['aerial_grass_rock', 'white_plaster_02', 'grey_roof_tiles', 'coast_sand_01', 'bark_willow_02', 'cotton_jersey', 'denim_fabric', 'velour_velvet', 'brown_leather']);
  const day = new Meadow(false, ctx.renderer, pbr), night = new Meadow(true, ctx.renderer, pbr), beach = new Beach(ctx.renderer, pbr);
  const look = { vignette: 0.25, grain: 0.004, vibrance: 0.18, ao: 0.4 };
  return { shots: {
    'S01/SH01': { stage: day, post: { ...look, exposure: 1.0, bloomStrength: 0.3, shafts: 0.3 } },
    'S02/SH01': { stage: night, post: { ...look, exposure: 1.55, bloomStrength: 0.35, ao: 0 } },
    'S03/SH01': { stage: beach, post: { ...look, exposure: 1.0, bloomStrength: 0.15 } },
  } };
}
