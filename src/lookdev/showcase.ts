// Showcase reel (36 s): the v1.3 library in motion. Times Square push-in → tourists at the red steps → crane over the
// traffic → sidewalk tracking shot (human variety) → rooftop party with fireworks → Milky Way hilltop → solar system →
// Saturn pass → the Sun. Render: node tools/lookdev.mjs showcase --video build/lookdev/showcase.mp4 --scale 1
import * as THREE from 'three';
import type { FilmDefinition } from '../library/render/FilmPipeline';
import { PBRLibrary } from '../library/materials/PBR';
import { loadEarthTextures } from '../library/planet/Earth';
import { TimesSquare } from './timesquare';
import { Rooftop, Hilltop, Space } from './nightsky';

const kf = (t: number, p: number[], l: number[], ease = 'smoothstep') => ({ t_s: t, position: p, look_at: l, ease });
type Tr = { type: string; duration_s: number };
const scene = (id: string, a: number, b: number, keys: ReturnType<typeof kf>[], fov: number, tr: Tr = { type: 'cut', duration_s: 0 }, sway = 0) =>
  ({ id, start_s: a, end_s: b, transition_out: tr, shots: [{ id: 'SH01', start_s: a, end_s: b, camera: { projection: 'perspective', fov_or_scale: fov, keyframes: keys, ...(sway ? { handheld_sway: sway } : {}) } }] });
const whip: Tr = { type: 'whip_pan', duration_s: 0.36 }, wipe: Tr = { type: 'light_wipe', duration_s: 0.7 }, fade: Tr = { type: 'cross_dissolve', duration_s: 0.8 };
export const spec = { duration_s: 36, quality: 'cinematic' as const, scenes: [
  scene('S01', 0, 5, [kf(0, [1.2, 1.65, 20], [0.4, 6, -120]), kf(5, [0.6, 1.65, 8], [0.2, 7.5, -120])], 50, whip, 0.3),
  scene('S02', 5, 9, [kf(5, [-6.5, 1.4, -5], [1, 3.5, -26]), kf(9, [-3.8, 1.55, -9.5], [1.5, 3.8, -26])], 42, whip),
  scene('S03', 9, 12.5, [kf(9, [3, 4, 14], [0, 8, -90]), kf(12.5, [2, 24, -4], [0, 12, -110])], 50, whip),
  scene('S04', 12.5, 16.5, [kf(12.5, [11.0, 1.55, 2], [12.6, 1.3, -14]), kf(16.5, [11.2, 1.6, -4.5], [12.6, 1.3, -20])], 36, wipe, 0.25),
  scene('S05', 16.5, 21.5, [kf(16.5, [-7, 1.7, 10], [0, 7.5, -20]), kf(21.5, [-2.5, 2.4, 7.5], [2, 9.5, -22])], 52, wipe, 0.2),
  scene('S06', 21.5, 25.5, [kf(21.5, [0, 1.25, 8], [0.3, 2.5, -20]), kf(25.5, [1.2, 1.3, 7.2], [0, 16, -20])], 54, fade),
  scene('S07', 25.5, 29.5, [kf(25.5, [0, 130, 260], [0, 0, 0]), kf(29.5, [90, 70, 205], [0, 0, 0])], 46, whip),
  scene('S08', 29.5, 33, [kf(29.5, [0, 0, 0], [0, 0, 0]), kf(33, [0, 0, 0], [0, 0, 0])], 40, fade),
  scene('S09', 33, 36, [kf(33, [0, 7, 44], [0, 0, 0]), kf(36, [9, 3.5, 34], [0, 0, 0])], 40),
] };

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['asphalt_02', 'concrete_tiles_02', 'rectangular_facade_tiles', 'concrete_wall_008', 'beige_wall_001', 'cotton_jersey', 'denim_fabric', 'velour_velvet', 'brown_leather', 'red_brick_03', 'brick_wall_001', 'large_sandstone_blocks', 'white_plaster_02', 'clay_roof_tiles_02', 'grey_roof_tiles', 'wood_table_001', 'aerial_grass_rock', 'rock_face']);
  const city = new TimesSquare(ctx.renderer, pbr), roof = new Rooftop(ctx.renderer, pbr), hill = new Hilltop(pbr), space = new Space(await loadEarthTextures(ctx.base));
  space.saturnScene = 'S08'; space.sunScene = 'S09';
  const neon = { exposure: 1.0, bloomStrength: 0.6, bloomRadius: 0.65, bloomThreshold: 0.8, vignette: 0.32, grain: 0.006, ao: 0.6, aoRadius: 0.5, vibrance: 0.3, saturation: 1.1, chroma: 0.25, shadowTint: [0.92, 0.95, 1.12] as [number, number, number], highlightTint: [1.06, 1.0, 0.95] as [number, number, number] };
  const night = { exposure: 1.0, bloomStrength: 0.7, bloomRadius: 0.7, bloomThreshold: 0.7, vignette: 0.32, grain: 0.006, vibrance: 0.3, saturation: 1.08 };
  return { shots: {
    'S01/SH01': { stage: city, post: neon }, 'S02/SH01': { stage: city, post: { ...neon, dof: 7, dofAperture: 0.004 } }, 'S03/SH01': { stage: city, post: neon },
    'S04/SH01': { stage: city, post: { ...neon, dof: 5.5, dofAperture: 0.006 } },
    'S05/SH01': { stage: roof, post: { ...night, ao: 0.5, aoRadius: 0.5 } }, 'S06/SH01': { stage: hill, post: { ...night, exposure: 1.25, bloomStrength: 0.5 } },
    'S07/SH01': { stage: space, post: { ...night, tonemap: 'agx' as const, bloomStrength: 0.9 } }, 'S08/SH01': { stage: space, post: { ...night, tonemap: 'agx' as const } },
    'S09/SH01': { stage: space, post: { ...night, exposure: 0.9, bloomStrength: 0.55, bloomThreshold: 0.9 } },
  } };
}
