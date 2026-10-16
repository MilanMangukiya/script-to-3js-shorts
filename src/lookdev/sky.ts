// Lookdev: PhysicalSky through a day (sun altitude sweeps with time) over a meadow with trees.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { PhysicalSky } from '../library/environment/PhysicalSky';
import { BroadleafTree } from '../library/environment/BroadleafTree';
import { PBRLibrary, projectUVs } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'linear' });
export const spec = { duration_s: 8, quality: 'cinematic' as const,
  scenes: [{ id: 'S01', start_s: 0, end_s: 8, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: 0, end_s: 8, camera: { projection: 'perspective', fov_or_scale: 55, keyframes: [kf(0, [0, 1.6, 8], [0, 9, -40]), kf(8, [0, 1.6, 8], [0, 9, -40])] } }] }] };
/** Sun altitude (deg) by time: night → dawn → morning → noon → evening → sunset → dusk. */
const ALT = [-18, -6, -1, 4, 20, 55, 15, 2, -3, -9];
class SkyStage implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 3000);
  sky = new PhysicalSky({ cloudCover: 0.42, stars: 2500 }); key = new THREE.DirectionalLight(0xffffff, 2.5); hemi = new THREE.HemisphereLight(0xbcd2ff, 0x3a3328, 0.5);
  sunDirection = new THREE.Vector3();
  constructor(pbr: PBRLibrary) {
    this.sky.addTo(this.scene);
    const ground = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)), pbr.material('aerial_grass_rock', { tint: 0xb8c49a })); ground.receiveShadow = true; this.scene.add(ground);
    for (let i = 0; i < 9; i++) { const t = new BroadleafTree({ height: 7 + (i % 3), canopyWidth: 5, leafCount: 2400, seed: 40 + i, leafColor: 0x51713a }); t.position.set((i - 4) * 9 + (i % 2) * 3, 0, -30 - (i % 3) * 12); this.scene.add(t); }
    this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048); Object.assign(this.key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 });
    this.scene.add(this.key, this.key.target, this.hemi); this.key.target.position.set(0, 0, -30);
  }
  update(t: number, _s: ShotInfo) {
    const k = Math.min(ALT.length - 1.001, (t / 8) * (ALT.length - 1)), i = Math.floor(k), alt = THREE.MathUtils.degToRad(ALT[i] + (ALT[i + 1] - ALT[i]) * (k - i));
    this.sunDirection.set(0.25, Math.sin(alt), -Math.cos(alt)).normalize(); this.sky.setSun(this.sunDirection); this.sky.update(t * 20); this.sky.follow(this.camera);
    const day = THREE.MathUtils.smoothstep(Math.sin(alt), -0.05, 0.25);
    this.key.position.copy(this.sunDirection).multiplyScalar(100).add(this.key.target.position); this.key.intensity = 2.8 * day; this.key.color.copy(this.sky.horizonColor()).lerp(new THREE.Color(1, 0.96, 0.9), Math.min(1, Math.sin(alt) * 2.5 + 0.2));
    this.hemi.color.copy(this.sky.zenithColor()).multiplyScalar(2.2); this.hemi.intensity = 0.15 + 0.7 * day;
    this.scene.fog = new THREE.FogExp2(this.sky.horizonColor(), 0.0018);
  }
}
export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['aerial_grass_rock']);
  const stage = new SkyStage(pbr);
  return { shots: { 'S01/SH01': { stage, post: { exposure: 1.0, bloomStrength: 0.35, vignette: 0.25, grain: 0.004, shafts: 0.5, vibrance: 0.15 } } } };
}
