// Lookdev: every Quadruped species on a sunlit meadow (lineup), side-on gait checks (walk / trot / gallop) and head
// close-ups. Frames: 15 = lineup, 75/90/105 = gaits, 150 = big animals, 200 = heads.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { PhysicalSky } from '../library/environment/PhysicalSky';
import { Quadruped, SPECIES_LIST, type Gait, type Species } from '../library/creatures/Quadruped';
import { PBRLibrary, projectUVs } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'smoothstep' });
const shot = (id: string, a: number, b: number, p0: number[], l0: number[], p1: number[], l1: number[], fov = 40) =>
  ({ id: 'S0' + id, start_s: a, end_s: b, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: a, end_s: b, camera: { projection: 'perspective', fov_or_scale: fov, keyframes: [kf(a, p0, l0), kf(b, p1, l1)] } }] });
export const spec = { duration_s: 6, quality: 'cinematic' as const, scenes: [
  shot('1', 0, 1, [0, 0.5, 8.6], [0, 0.32, 0], [0, 0.5, 8.6], [0, 0.32, 0], 40),
  shot('2', 1, 2, [0, 0.8, 11.5], [0, 0.5, -3], [0, 0.8, 11.5], [0, 0.5, -3], 40),
  shot('3', 2, 3, [0, 1.1, 8.5], [0, 0.75, -4], [0, 1.1, 8.5], [0, 0.75, -4], 42),
  shot('4', 3, 4, [0, 1.3, 16], [0, 1.0, -8], [0, 1.3, 16], [0, 1.0, -8], 40),
  shot('5', 4, 5, [0, 2.2, 8], [0, 2.0, -16], [0, 2.2, 8], [0, 2.0, -16], 42),
  shot('6', 5, 6, [1.1, 0.75, 1.9], [0, 0.55, 0], [1.05, 0.75, 1.85], [0, 0.55, 0], 30),
] };

const SUN = new THREE.Vector3(0.55, 0.62, 0.55).normalize();
class Meadow implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.03, 5000); sunDirection = SUN.clone();
  sky = new PhysicalSky({ cloudCover: 0.3, stars: 0 });
  lineup: Quadruped[] = []; gaits: { q: Quadruped; gait: Gait; x0: number }[] = []; big: Quadruped[] = []; heads: Quadruped[] = [];
  constructor(renderer: THREE.WebGLRenderer, pbr: PBRLibrary) {
    const s = this.scene; this.sky.addTo(s); this.sky.setSun(SUN);
    s.environment = this.sky.bakeEnvironment(renderer); s.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xfff1dc, 2.8); key.position.copy(SUN).multiplyScalar(40); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 120 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03;
    s.add(key, key.target, new THREE.HemisphereLight(0xcfe0ff, 0x4a4632, 0.55));
    const ground = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)), pbr.material('aerial_grass_rock', { tint: 0x8aa060, tile: 4 })); ground.receiveShadow = true; s.add(ground);
    s.fog = new THREE.FogExp2(this.sky.horizonColor(), 0.006);
    // Side-on lineups: species spaced by their own length so silhouettes can be compared (S01 small, S03 large).
    const row = (list: Species[], z: number, gap: number, into: Quadruped[], seed: number) => {
      const qs = list.map((sp, i) => new Quadruped({ species: sp, seed: seed + i })), lens = qs.map((q) => q.spec.body * 1.9 + gap);
      let x = -lens.reduce((a, b) => a + b, 0) / 2;
      qs.forEach((q, i) => { x += lens[i] / 2; q.root.position.set(x, 0, z); q.root.rotation.y = Math.PI / 2; s.add(q.root); into.push(q); x += lens[i] / 2; });
    };
    row(['cat', 'terrier', 'fox', 'dog'], 0, 0.2, this.lineup, 3);
    row(['dalmatian', 'shepherd', 'wolf', 'pig', 'sheep'], -3, 0.25, this.lineup, 9);
    // Gaits side-on (S03): walk, trot, gallop crossing the frame.
    ([['dog', 'walk', -0.5], ['horse', 'trot', -3.5], ['deer', 'gallop', -7]] as [Species, Gait, number][]).forEach(([sp, gait, z], i) => {
      const q = new Quadruped({ species: sp, seed: 21 + i }); q.root.position.set(0, 0, z); q.root.rotation.y = Math.PI / 2; s.add(q.root); this.gaits.push({ q, gait, x0: -1.2 - i * 1.5 });
    });
    row(['horse', 'zebra', 'deer', 'bear', 'lion'], -8, 0.6, this.big, 40);
    row(['elephant', 'giraffe'], -16, 1.5, this.big, 50);
    // Heads (S04): shepherd and lion three-quarter.
    (['shepherd', 'lion'] as Species[]).forEach((sp, i) => { const q = new Quadruped({ species: sp, seed: 60 + i, scale: i ? 0.55 : 1 }); q.root.position.set(-0.25 + i * 0.75, 0, -0.35 - i * 0.6); q.root.rotation.y = 1.3; s.add(q.root); this.heads.push(q); });
    void SPECIES_LIST;
  }
  update(t: number, s: ShotInfo) {
    this.sky.update(t); this.sky.follow(this.camera);
    const sc = s.sceneId;
    this.lineup.forEach((q, i) => { q.root.visible = sc === 'S01' || sc === 'S02'; q.pose(t, { gait: 'idle', headYaw: Math.sin(t * 0.8 + i) * 0.3, phase: i * 0.13 }); });
    this.gaits.forEach(({ q, gait, x0 }, i) => { q.root.visible = sc === 'S03'; q.root.position.x = x0 + q.speed(gait) * ((t - 2) * 0.35); q.pose(t, { gait, phase: i * 0.21 }); });
    this.big.forEach((q, i) => { q.root.visible = sc === 'S04' || sc === 'S05'; q.pose(t, { gait: 'idle', headYaw: Math.sin(t * 0.6 + i) * 0.25, graze: i === 0 ? 0.6 : 0 }); });
    this.heads.forEach((q, i) => { q.root.visible = sc === 'S06'; q.pose(t, { gait: 'idle', headYaw: -0.2 + i * 0.2 }); });
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['aerial_grass_rock']);
  const stage = new Meadow(ctx.renderer, pbr);
  const post = { exposure: 1.0, bloomStrength: 0.12, vignette: 0.3, grain: 0.004, ao: 0.7, aoRadius: 0.5, vibrance: 0.12 };
  return { shots: { 'S01/SH01': { stage, post }, 'S02/SH01': { stage, post }, 'S03/SH01': { stage, post }, 'S04/SH01': { stage, post }, 'S05/SH01': { stage, post }, 'S06/SH01': { stage, post: { ...post, dof: 2.1, dofAperture: 0.012 } } } };
}
