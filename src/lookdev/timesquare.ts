// Lookdev: neon district at night with crowds. S01 eye-level push down the avenue, S02 tourists at the red steps,
// S03 crane up over the traffic, S04 sidewalk close-up for human variety.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { PhysicalSky } from '../library/environment/PhysicalSky';
import { NeonDistrict } from '../library/environment/NeonDistrict';
import { Crowd, CrowdImpostors } from '../library/characters/CrowdKit';
import { PBRLibrary } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[], ease = 'smoothstep') => ({ t_s: t, position: p, look_at: l, ease });
const shot = (id: string, a: number, b: number, p0: number[], l0: number[], p1: number[], l1: number[], fov = 44) =>
  ({ id: 'S0' + id, start_s: a, end_s: b, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: a, end_s: b, camera: { projection: 'perspective', fov_or_scale: fov, keyframes: [kf(a, p0, l0), kf(b, p1, l1)] } }] });
export const spec = { duration_s: 16, quality: 'cinematic' as const, scenes: [
  shot('1', 0, 4, [1.2, 1.65, 18], [0.5, 6, -120], [0.8, 1.65, 9], [0.3, 7, -120], 50),
  shot('2', 4, 8, [-6.5, 1.4, -6], [1, 3.5, -26], [-4.5, 1.5, -9], [1.5, 3.5, -26], 42),
  shot('3', 8, 12, [3, 6, 12], [0, 8, -90], [2, 22, -2], [0, 12, -110], 50),
  shot('4', 12, 16, [12.6, 1.5, -2], [12.4, 1.2, -14], [12.2, 1.55, -5], [12.4, 1.2, -16], 34),
] };

export class TimesSquare implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(44, 9 / 16, 0.05, 3000);
  sky = new PhysicalSky({ cloudCover: 0.25, stars: 3000, nightZenith: 0x030616, nightHorizon: 0x2a1830 });
  district: NeonDistrict; crowd: Crowd; far: CrowdImpostors;
  constructor(private renderer: THREE.WebGLRenderer, pbr: PBRLibrary) {
    const s = this.scene; this.sky.addTo(s); this.sky.setSun(new THREE.Vector3(0.3, -0.35, -0.9).normalize());
    const base = this.sky.bakeEnvironment(renderer);
    this.district = new NeonDistrict({ pbr, baseEnvironment: base }); s.add(this.district.group);
    s.environment = this.district.environment ?? base; s.environmentIntensity = 0.55;
    s.add(new THREE.HemisphereLight(0x2a3a6a, 0x1a1012, 0.25));
    const moon = new THREE.DirectionalLight(0x8fa6d8, 0.35); moon.position.set(-30, 60, 20); s.add(moon);
    s.fog = new THREE.FogExp2(0x1a1424, 0.0028);
    const walk = (x: number) => ({ points: [new THREE.Vector3(x, 0.16, 46), new THREE.Vector3(x, 0.16, -60), new THREE.Vector3(x, 0.16, -190)], width: 2.4 });
    this.crowd = new Crowd({ seed: 11, vibe: 'nightout', pbr, childShare: 0.08, elderShare: 0.1,
      walkers: [{ path: walk(-12.5), count: 26, speed: [1.0, 1.55] }, { path: walk(12.5), count: 26, speed: [1.0, 1.55], phoneShare: 0.2 }],
      groups: [
        { center: new THREE.Vector3(0, 0.18, -13), count: 9, radius: 3, activity: ['lookup', 'photo', 'lookup', 'wave', 'photo'], target: new THREE.Vector3(-30, 20, -40) },
        { center: new THREE.Vector3(-1.5, 0.18, -34), count: 4, radius: 0.9, activity: ['talk', 'talk', 'phone', 'talk'] },
        { center: new THREE.Vector3(12.8, 0.16, -12), count: 3, radius: 0.75, activity: ['talk', 'talk', 'talk'] },
        { center: new THREE.Vector3(1.5, 0.18, -30), count: 5, radius: 1.5, activity: ['cheer', 'dance', 'photo', 'dance', 'cheer'] },
      ] });
    s.add(this.crowd.group);
    this.far = new CrowdImpostors({ seed: 4, vibe: 'nightout', lanes: [{ from: new THREE.Vector3(-12.5, 0.16, -60), to: new THREE.Vector3(-12.5, 0.16, -190), width: 2.6, count: 150 }, { from: new THREE.Vector3(12.5, 0.16, -60), to: new THREE.Vector3(12.5, 0.16, -190), width: 2.6, count: 150 }] });
    s.add(this.far.group);
  }
  update(t: number, _s: ShotInfo) {
    this.sky.update(t); this.sky.follow(this.camera);
    this.crowd.update(t, 1); this.far.update(t);
    this.district.update(t, this.renderer, this.scene, 1, this.camera);
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['asphalt_02', 'concrete_tiles_02', 'rectangular_facade_tiles', 'concrete_wall_008', 'beige_wall_001', 'cotton_jersey', 'denim_fabric', 'velour_velvet', 'brown_leather', 'red_brick_03', 'brick_wall_001', 'large_sandstone_blocks', 'white_plaster_02', 'clay_roof_tiles_02', 'grey_roof_tiles', 'wood_table_001']);
  const stage = new TimesSquare(ctx.renderer, pbr);
  const post = { exposure: 1.0, bloomStrength: 0.6, bloomRadius: 0.65, bloomThreshold: 0.8, vignette: 0.32, grain: 0.006, ao: 0.6, aoRadius: 0.5, vibrance: 0.3, saturation: 1.1, chroma: 0.25, shadowTint: [0.92, 0.95, 1.12] as [number, number, number], highlightTint: [1.06, 1.0, 0.95] as [number, number, number] };
  return { shots: { 'S01/SH01': { stage, post }, 'S02/SH01': { stage, post: { ...post, dof: 7, dofAperture: 0.004 } }, 'S03/SH01': { stage, post }, 'S04/SH01': { stage, post: { ...post, dof: 6, dofAperture: 0.006 } } } };
}
