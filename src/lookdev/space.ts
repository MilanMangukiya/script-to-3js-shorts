// Lookdev: space kit. Frames: 15 = black hole (lensed disk + photon ring), 45 = black hole edge-on, 75 = asteroid
// belt with a hero rock, 105 = comet tails, 135 = rocket launch plume, 165 = satellite and station over Earth.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { BlackHole } from '../library/space/BlackHole';
import { Asteroid, AsteroidField, Comet } from '../library/space/Asteroids';
import { Rocket, Satellite, SpaceStation } from '../library/space/Spacecraft';
import { Starfield } from '../library/space/Starfield';
import { PhysicalSky } from '../library/environment/PhysicalSky';
import { Earth, loadEarthTextures } from '../library/planet/Earth';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const kf = (t: number, p: number[], l: number[]) => ({ t_s: t, position: p, look_at: l, ease: 'smoothstep' });
const shot = (id: string, a: number, b: number, p0: number[], l0: number[], p1: number[], l1: number[], fov = 40) =>
  ({ id: 'S0' + id, start_s: a, end_s: b, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: a, end_s: b, camera: { projection: 'perspective', fov_or_scale: fov, keyframes: [kf(a, p0, l0), kf(b, p1, l1)] } }] });
export const spec = { duration_s: 6, quality: 'cinematic' as const, scenes: [
  shot('1', 0, 1, [0, 3.2, 26], [0, 0, 0], [1, 3.0, 25.5], [0, 0, 0], 38),
  shot('2', 1, 2, [0, 0.4, 30], [0, 0, 0], [0, 0.4, 30], [0, 0, 0], 34),
  shot('3', 2, 3, [0, 6, 95], [0, 0, 45], [0, 6, 94], [0, 0, 45], 40),
  shot('4', 3, 4, [-30, 6, 40], [10, 0, 0], [-30, 6, 40], [10, 0, 0], 50),
  shot('5', 4, 5, [60, 18, 90], [0, 45, 0], [60, 18, 90], [0, 45, 0], 42),
  shot('6', 5, 6, [6, 2, 14], [0, -1, 0], [6, 2, 14], [0, -1, 0], 46),
] };

const SUN = new THREE.Vector3(0.8, 0.25, 0.5).normalize();
class Hole implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(38, 9 / 16, 0.05, 2000);
  hole = new BlackHole({ rs: 1, diskInner: 3, diskOuter: 15, diskNormal: new THREE.Vector3(0, 1, 0.18) });
  constructor() { this.hole.addTo(this.scene); }
  update(t: number, _s: ShotInfo) { this.hole.update(t); }
}
class Belt implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 5000);
  stars = new Starfield({ count: 4000, radius: 1500, brightness: 1 }); field = new AsteroidField({ count: 2400, inner: 30, outer: 80, thickness: 6, maxRadius: 1.8 });
  hero = new Asteroid({ seed: 4, radius: 6 }); comet = new Comet({ nucleus: 0.6, tailLength: 70 });
  constructor() {
    const s = this.scene; s.add(this.stars.points, this.field.group, this.hero.mesh, this.comet.group);
    const sun = new THREE.DirectionalLight(0xfff4e6, 3.2); sun.position.copy(SUN).multiplyScalar(200); s.add(sun, new THREE.AmbientLight(0x223044, 0.25));
    this.hero.mesh.position.set(0, 0, 45); this.comet.group.position.set(2, 2, -30);
  }
  update(t: number, sh: ShotInfo) {
    this.stars.points.position.copy(this.camera.position); this.field.update(t * 10); this.hero.update(t);
    this.hero.mesh.visible = sh.sceneId === 'S03'; this.field.group.visible = sh.sceneId === 'S03'; this.comet.group.visible = sh.sceneId === 'S04';
    this.comet.update(t, SUN.clone().negate().add(new THREE.Vector3(0, 0, -0.2)).normalize());
  }
}
class Pad implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.5, 20000); sunDirection = new THREE.Vector3(-0.3, 0.35, -0.85).normalize();
  sky = new PhysicalSky({ cloudCover: 0.2, stars: 0 }); rocket = new Rocket({ height: 70 });
  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene; this.sky.addTo(s); this.sky.setSun(this.sunDirection); s.environment = this.sky.bakeEnvironment(renderer); s.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight(0xffe6cc, 2.6); key.position.copy(this.sunDirection).multiplyScalar(200); s.add(key, new THREE.HemisphereLight(0xbcd2ff, 0x5a5048, 0.5));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8c8676, roughness: 0.95 })); s.add(ground);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(30, 32, 3, 48), new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 0.9 })); pad.position.y = 1.5; s.add(pad);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 90, 6), new THREE.MeshStandardMaterial({ color: 0x7a2c22, roughness: 0.7, metalness: 0.4 })); tower.position.set(-12, 45, 0); s.add(tower);
    s.add(this.rocket.group); s.fog = new THREE.FogExp2(this.sky.horizonColor(), 0.0012);
  }
  update(t: number, _s: ShotInfo) { this.sky.update(t); this.sky.follow(this.camera); const lt = t - 3 + 3.2; this.rocket.group.position.y = 3 + Rocket.ascent(lt, 0, 2.5, 9); this.rocket.update(t, 1, 0); }
}
class Orbit implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 50000);
  stars = new Starfield({ count: 3000, radius: 20000 }); sat = new Satellite({ size: 1.6 }); station = new SpaceStation({ scale: 0.06 }); earth: Earth;
  constructor(tex: Awaited<ReturnType<typeof loadEarthTextures>>, renderer: THREE.WebGLRenderer) {
    const s = this.scene; s.add(this.stars.points, this.sat.group, this.station.group);
    const pm = new THREE.PMREMGenerator(renderer); s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; s.environmentIntensity = 0.35; pm.dispose();
    this.earth = new Earth(tex, { radius: 6371, sunDirection: SUN }); this.earth.group.position.set(0, -6371 - 420, 0); this.earth.setView(10, 35); s.add(this.earth.group);
    const sun = new THREE.DirectionalLight(0xffffff, 3.0); sun.position.copy(SUN).multiplyScalar(100); s.add(sun, new THREE.AmbientLight(0x3a4a66, 0.35));
    this.station.group.position.set(-5, 2.5, -14);
  }
  update(t: number, _s: ShotInfo) { this.stars.points.position.copy(this.camera.position); this.sat.update(t, 0.4); this.station.update(t); this.earth.update(t); }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const hole = new Hole(), belt = new Belt(), pad = new Pad(ctx.renderer), orbit = new Orbit(await loadEarthTextures(ctx.base), ctx.renderer);
  const post = { exposure: 1.0, bloomStrength: 0.5, bloomThreshold: 0.75, vignette: 0.35, grain: 0.004 };
  return { shots: { 'S01/SH01': { stage: hole, post: { ...post, tonemap: 'agx' as const } }, 'S02/SH01': { stage: hole, post: { ...post, tonemap: 'agx' as const } }, 'S03/SH01': { stage: belt, post: { ...post, ao: 0.5 } },
    'S04/SH01': { stage: belt, post }, 'S05/SH01': { stage: pad, post: { ...post, tonemap: 'agx' as const, exposure: 0.75, bloomStrength: 0.45 } }, 'S06/SH01': { stage: orbit, post } } };
}
