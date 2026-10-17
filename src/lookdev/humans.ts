// Lookdev: a lineup of seeded HumanV2 people in a soft studio, a wide shot and a face close-up.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { HumanV2 } from '../library/characters/HumanV2';
import { POSE_STAND } from '../library/characters/Humanoid';
import { PBRLibrary, loadEnvironment, projectUVs } from '../library/materials/PBR';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'smoothstep' });
export const spec = {
  duration_s: 6, quality: 'cinematic' as const,
  scenes: [
    { id: 'S01', start_s: 0, end_s: 2, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: 0, end_s: 2, camera: { projection: 'perspective', fov_or_scale: 30, keyframes: [kf(0, [0, 1.3, 7.2], [0, 0.95, 0]), kf(2, [0.2, 1.3, 7.0], [0, 0.95, 0])] } }] },
    { id: 'S02', start_s: 2, end_s: 4, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: 2, end_s: 4, camera: { projection: 'perspective', fov_or_scale: 24, keyframes: [kf(2, [-0.45, 1.6, 1.25], [-0.45, 1.55, 0]), kf(4, [-0.4, 1.6, 1.2], [-0.45, 1.55, 0])] } }] },
    { id: 'S03', start_s: 4, end_s: 6, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: 4, end_s: 6, camera: { projection: 'perspective', fov_or_scale: 24, keyframes: [kf(4, [0.75, 1.55, 1.3], [0.75, 1.5, 0]), kf(6, [0.8, 1.55, 1.25], [0.75, 1.5, 0])] } }] },
  ],
};

class Studio implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.05, 200);
  people: HumanV2[] = [];
  constructor(env: THREE.Texture, pbr: PBRLibrary) {
    this.scene.environment = env; this.scene.environmentIntensity = 0.55; this.scene.background = new THREE.Color(0x20232a);
    const floor = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2)), pbr.material('concrete_tiles_02', { tint: 0x9a968e }));
    floor.receiveShadow = true; this.scene.add(floor);
    const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 }); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(0xbcd6ff, 1.6); rim.position.set(-4, 3, -4);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xdfe7f2, 0x3a342c, 0.35));
    const slots = [[-1.35, 0.4], [-0.45, 0.55], [0.45, 0.5], [1.35, 0.35], [-0.9, -0.6], [0, -0.75], [0.9, -0.6]];
    slots.forEach(([x, z], i) => {
      const o = HumanV2.random(101 + i * 17, { pbr });
      if (i === 1) Object.assign(o, { sex: 'female', hair: { style: 'curly', color: 0x2a1a12 }, skin: 0x8a5a3c, top: 'blouse', topColor: 0xd9895b, bottom: 'jeans' });
      if (i === 2) Object.assign(o, { sex: 'male', hair: { style: 'side-part', color: 0x3d2a1c }, skin: 0xe2b897, top: 'jacket', topColor: 0x2f4f6f, bottom: 'trousers', glasses: true });
      const h = new HumanV2(o); h.root.position.set(x, 0, z); h.root.rotation.y = -x * 0.12; this.scene.add(h.root); this.people.push(h);
    });
  }
  update(t: number, s: ShotInfo) {
    if (s.sceneId !== 'S01') {   // face close-ups aim at the real head of person 1 or 2
      const h = this.people[s.sceneId === 'S02' ? 1 : 2].head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.09, 0));
      this.camera.position.copy(h).add(new THREE.Vector3(0.12, 0.02, 0.62)); this.camera.lookAt(h); this.camera.updateMatrixWorld(true);
    }
    this.people.forEach((h, i) => h.setPose({ ...POSE_STAND, armL: [0.05, 0.1 + 0.02 * i, 0.15], armR: [0.05, 0.1, 0.12 + 0.03 * (i % 3)], headYaw: 0.15 * Math.sin(i * 1.7), breath: 0.3 * Math.sin(t * 1.4 + i) }));
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['cotton_jersey', 'denim_fabric', 'velour_velvet', 'brown_leather', 'concrete_tiles_02']);
  const stage = new Studio(await loadEnvironment(ctx.renderer, ctx.base, 'room'), pbr);
  const post = { exposure: 1.05, bloomStrength: 0.12, vignette: 0.25, grain: 0.004, ao: 0.8, aoRadius: 0.35, vibrance: 0.15 };
  return { shots: { 'S01/SH01': { stage, post }, 'S02/SH01': { stage, post: { ...post, dof: 1.3, dofAperture: 0.02 } }, 'S03/SH01': { stage, post: { ...post, dof: 1.35, dofAperture: 0.02 } } } };
}
