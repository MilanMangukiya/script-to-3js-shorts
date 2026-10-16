// Lookdev: a furnished living room (InteriorKit curtains, art, rug, bookshelf) in photo-scanned materials, lit by
// afternoon sun through the window and a warm table lamp, with two HumanV2 people for scale and variety.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { RoomBox, tableLamp, plant } from '../library/environment/RoomBox';
import { Curtains, FramedPicture, Rug, Bookshelf } from '../library/environment/InteriorKit';
import { HumanV2, idlePose } from '../library/characters/HumanV2';
import { POSE_STAND } from '../library/characters/Humanoid';
import { PBRLibrary, projectUVs, loadEnvironment } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'smoothstep' });
export const spec = { duration_s: 4, quality: 'cinematic' as const, scenes: [{ id: 'S01', start_s: 0, end_s: 4, transition_out: { type: 'cut', duration_s: 0 },
  shots: [{ id: 'SH01', start_s: 0, end_s: 4, camera: { projection: 'perspective', fov_or_scale: 50, keyframes: [kf(0, [0.9, 1.5, 0.3], [-0.6, 1.1, -4]), kf(4, [0.5, 1.45, -0.4], [-0.6, 1.1, -4])] } }] }] };

const W = 4.2, H = 2.7, D = 4.6;
class Room implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.03, 500);
  people: HumanV2[] = []; curtains: Curtains;
  constructor(pbr: PBRLibrary, env: THREE.Texture) {
    const s = this.scene; s.environment = env; s.environmentIntensity = 0.35; s.background = new THREE.Color(0x9fb8d8);
    const room = new RoomBox({ width: W, height: H, depth: D, window: { wall: 'back', center: -0.9, sill: 0.85, width: 1.4, height: 1.4, frameColor: 0xeee8dc } }); s.add(room);
    const wallM = pbr.material('plastered_wall_04', { tint: 0xe9dcc6, tile: 2.2 }), floorM = pbr.material('laminate_floor_02', { tile: 2.0 });
    room.traverse((m) => { const mesh = m as THREE.Mesh; if (!mesh.isMesh) return; mesh.castShadow = mesh.receiveShadow = true; const bb = new THREE.Box3().setFromObject(mesh), size = bb.getSize(new THREE.Vector3());
      if (size.y < 0.11 && bb.max.y <= 0.01) { projectUVs(mesh.geometry); mesh.material = floorM; } else if ((size.x > 1 || size.z > 1) && size.y > 0.3) { projectUVs(mesh.geometry); mesh.material = wallM; } });
    this.curtains = new Curtains({ width: 2.0, height: 1.75, color: 0x5f7f6a, openFraction: 0.55, pbr }); this.curtains.group.position.set(-0.9, 2.4, -D + 0.07); s.add(this.curtains.group);
    for (const [x, y, w, h, art, seed] of [[0.9, 1.6, 0.8, 0.55, 'landscape', 4], [1.6, 1.45, 0.35, 0.45, 'abstract', 9], [1.6, 1.98, 0.35, 0.3, 'botanical', 2]] as const) {
      const pic = new FramedPicture({ width: w, height: h, art, seed }); pic.group.position.set(x, y, -D + 0.012); s.add(pic.group); }
    const rug = new Rug({ width: 1.8, length: 2.4, pattern: 'border', colors: [0x2f4f6a, 0xe6d8bf, 0xc9953f, 0x8c3b2f] }); rug.group.position.set(0.2, 0, -2.6); s.add(rug.group);
    const shelf = new Bookshelf({ width: 0.9, height: 1.9, seed: 33, pbr }); shelf.group.position.set(W / 2 - 0.18, 0, -2.2); shelf.group.rotation.y = -Math.PI / 2; s.add(shelf.group);
    tableLamp(s, [-1.75, 0, -1.4], 0xffc58c, 4); plant(s, [-1.7, 0, -3.9], 1.1);
    for (const [x, z, seed, yaw] of [[-0.3, -2.9, 711, 0.4], [0.7, -2.2, 712, -0.5]]) { const h = new HumanV2({ ...HumanV2.random(seed), pbr }); h.root.position.set(x, 0, z); h.root.rotation.y = yaw; s.add(h.root); this.people.push(h); }
    const sun = new THREE.DirectionalLight(0xffe2b8, 6); sun.position.set(-3.5, 6, -12); sun.target.position.set(-0.5, 0, -2.5); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); sun.shadow.normalBias = 0.02; s.add(sun, sun.target, new THREE.HemisphereLight(0xcfd8e6, 0x6a5038, 0.35));
    // Invisible shadow caster closing the open front, so the sun only enters by the window.
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, H + 0.4), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide })); front.position.set(0, H / 2, 0.02); front.castShadow = true; s.add(front);
  }
  update(t: number, _s: ShotInfo) { this.people.forEach((h, i) => h.setPose(idlePose(t, i * 5, POSE_STAND))); this.curtains.update(t, 0.6); }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['plastered_wall_04', 'laminate_floor_02', 'cotton_jersey', 'denim_fabric', 'velour_velvet', 'brown_leather', 'wood_table_001']);
  const stage = new Room(pbr, await loadEnvironment(ctx.renderer, ctx.base, 'room'));
  return { shots: { 'S01/SH01': { stage, post: { exposure: 1.05, bloomStrength: 0.25, vignette: 0.25, grain: 0.004, vibrance: 0.15, ao: 0.8, aoRadius: 0.45 } } } };
}
