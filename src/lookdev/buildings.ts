// Lookdev: a CityKit street of BuildingKit blocks at night (lit rooms, lamps, traffic, walkers) and by day.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { CityStreetV2 } from '../library/environment/CityKit';
import { PBRLibrary, loadEnvironment } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'smoothstep' });
const cam = (a: number, b: number, p0: number[], l0: number[], p1: number[], l1: number[], fov = 48) => ({ projection: 'perspective', fov_or_scale: fov, keyframes: [kf(a, p0, l0), kf(b, p1, l1)] });
export const spec = {
  duration_s: 6, quality: 'cinematic' as const,
  scenes: [
    { id: 'S01', start_s: 0, end_s: 2, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: 0, end_s: 2, camera: cam(0, 2, [1.5, 1.6, 6], [-0.5, 4.5, -30], [1.5, 1.6, 4], [-0.5, 4.5, -30]) }] },
    { id: 'S02', start_s: 2, end_s: 4, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: 2, end_s: 4, camera: cam(2, 4, [1.5, 1.6, 6], [-0.5, 4.5, -30], [1.5, 1.6, 4], [-0.5, 4.5, -30]) }] },
    { id: 'S03', start_s: 4, end_s: 6, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: 4, end_s: 6, camera: cam(4, 6, [-14, 22, 12], [0, 6, -30], [-13, 21, 10], [0, 6, -30], 40) }] },
  ],
};
class Street implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(48, 9 / 16, 0.1, 3000); city: CityStreetV2;
  key = new THREE.DirectionalLight(0xffe2c0, 2.4); hemi = new THREE.HemisphereLight(0xbcd2ff, 0x3a3328, 0.5);
  constructor(pbr: PBRLibrary, private envDay: THREE.Texture, private envNight: THREE.Texture) {
    this.city = new CityStreetV2({ pbr, length: 140, seed: 21, cars: 12, pedestrians: 22 });
    this.scene.add(this.city.group);
    this.key.position.set(-40, 30, 25); this.key.castShadow = true; this.key.shadow.mapSize.set(4096, 4096); Object.assign(this.key.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 250 });
    this.scene.add(this.key, this.key.target, this.hemi); this.key.target.position.set(0, 0, -40);
  }
  update(t: number, s: ShotInfo) {
    const night = s.sceneId === 'S02' ? 0 : 1;
    this.scene.background = new THREE.Color(night ? 0x141b33 : 0x8fb4dc); this.scene.environment = night ? this.envNight : this.envDay; this.scene.environmentIntensity = night ? 0.12 : 0.85;
    this.key.intensity = night ? 0.06 : 2.6; this.hemi.intensity = night ? 0.12 : 0.7; this.hemi.color.set(night ? 0x3a4a7a : 0xbcd2ff);
    this.city.setLight(night, night ? 0x141b33 : 0x5d8cc8, night ? 0x4a3f55 : 0xd2dce6); this.city.update(t);
  }
}
export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['asphalt_02', 'concrete_tiles_02', 'red_brick_03', 'beige_wall_001', 'rectangular_facade_tiles', 'brick_wall_001', 'white_plaster_02', 'concrete_wall_008', 'clay_roof_tiles_02', 'grey_roof_tiles', 'large_sandstone_blocks', 'wood_table_001', 'cotton_jersey', 'denim_fabric', 'velour_velvet', 'brown_leather']);
  const stage = new Street(pbr, await loadEnvironment(ctx.renderer, ctx.base, 'kloofendal_48d_partly_cloudy_puresky'), await loadEnvironment(ctx.renderer, ctx.base, 'cobblestone_street_night'));
  const nightPost = { exposure: 1.15, bloomStrength: 0.55, bloomThreshold: 0.7, bloomRadius: 0.7, vignette: 0.32, grain: 0.004, ao: 0.6, aoRadius: 1.0, vibrance: 0.2 };
  return { shots: { 'S01/SH01': { stage, post: nightPost }, 'S02/SH01': { stage, post: { exposure: 1.0, bloomStrength: 0.15, vignette: 0.25, grain: 0.004, ao: 0.8, aoRadius: 1.2, vibrance: 0.15 } }, 'S03/SH01': { stage, post: nightPost } } };
}
