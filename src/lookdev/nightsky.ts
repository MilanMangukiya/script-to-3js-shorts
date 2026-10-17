// Lookdev: night life and starry skies. S01 rooftop party (dance floor, beams, string lights, skyline fireworks),
// S02 Milky Way over a hilltop camp (stargazers, campfire, fireflies, meteors), S03–S04 the solar system
// (wide orbit view, Saturn close pass), S05 the Sun.
import * as THREE from 'three';
import type { FilmDefinition, ShotInfo, Stage } from '../library/render/FilmPipeline';
import { MilkyWaySky } from '../library/space/MilkyWay';
import { SolarSystem } from '../library/space/SolarSystem';
import { Fireworks } from '../library/fx/Fireworks';
import { StringLights, StageBeams, LedDanceFloor, stageDeck } from '../library/environment/NightlifeKit';
import { NeonSign, LedScreen } from '../library/environment/NeonDistrict';
import { Building } from '../library/environment/BuildingKit';
import { Crowd } from '../library/characters/CrowdKit';
import { InsectSwarm } from '../library/creatures/InsectSwarm';
import { ConiferStand, scatterTrees } from '../library/environment/ConiferStand';
import { Flame } from '../library/fx/Flame';
import { MeteorStreaks } from '../library/fx/MeteorStreaks';
import { Boulder } from '../library/environment/NatureKit';
import { PBRLibrary, projectUVs } from '../library/materials/PBR';
import { loadEarthTextures } from '../library/planet/Earth';
import { rng } from '../library/util/math';

const kf = (t: number, p: number[], l: number[], ease = 'smoothstep') => ({ t_s: t, position: p, look_at: l, ease });
const shot = (id: string, a: number, b: number, p0: number[], l0: number[], p1: number[], l1: number[], fov = 44) =>
  ({ id: 'S0' + id, start_s: a, end_s: b, transition_out: { type: 'cut', duration_s: 0 }, shots: [{ id: 'SH01', start_s: a, end_s: b, camera: { projection: 'perspective', fov_or_scale: fov, keyframes: [kf(a, p0, l0), kf(b, p1, l1)] } }] });
export const spec = { duration_s: 20, quality: 'cinematic' as const, scenes: [
  shot('1', 0, 4, [-7, 1.7, 10], [0, 7.5, -20], [-3, 2.2, 8], [2, 9, -22], 52),
  shot('2', 4, 8, [0, 1.3, 8], [0, 8, -20], [1.5, 1.2, 7], [0, 14, -20], 52),
  shot('3', 8, 12, [0, 120, 250], [0, 0, 0], [80, 70, 210], [0, 0, 0], 46),
  shot('4', 12, 16, [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], 40),
  shot('5', 16, 20, [0, 6, 40], [0, 0, 0], [8, 3, 34], [0, 0, 0], 40),
] };

/** Rooftop party above a lit skyline, fireworks bursting behind it. */
export class Rooftop implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(48, 9 / 16, 0.05, 6000);
  sky = new MilkyWaySky({ ground: true, lightPollution: 1, band: 0.5, stars: 0.6 }); fw: Fireworks; flash = new THREE.PointLight(0xffffff, 0, 0, 0); floorLight = new THREE.PointLight(0xff3bb0, 0, 18, 2);
  lights: StringLights[] = []; beams = new StageBeams({ count: 7, span: 10, length: 16 }); floor = new LedDanceFloor({ width: 8, depth: 7 }); crowd: Crowd; skyline: Building[] = []; screens: LedScreen[] = []; sign: NeonSign;
  constructor(renderer: THREE.WebGLRenderer, pbr: PBRLibrary) {
    const s = this.scene; this.sky.addTo(s); s.add(this.flash, this.floorLight, new THREE.HemisphereLight(0x3a4a7a, 0x1a1418, 0.35));
    const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene(); env.background = new THREE.Color(0x0a0d18); s.environment = pm.fromScene(env).texture; pm.dispose(); s.environmentIntensity = 1;
    const deck = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(26, 0.3, 26)), pbr.material('wood_table_001', { tint: 0x8a6a52, roughness: 0.55, tile: 1.6 })); deck.position.set(0, -0.15, -6); deck.receiveShadow = true; s.add(deck);
    const wall = pbr.material('concrete_wall_008', { tint: 0x5a5a60 });
    for (const [x, z, w, d] of [[0, 7, 26, 0.3], [-13, -6, 0.3, 26], [13, -6, 0.3, 26]] as const) { const m = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(w, 1.1, d)), wall); m.position.set(x, 0.55, z); s.add(m); }
    this.floor.mesh.position.set(0, 0.01, -4); s.add(this.floor.mesh);
    const st = stageDeck({ width: 10, depth: 4 }); st.position.set(0, 0, -9); s.add(st); this.beams.group.position.set(0, 6.6, -9.6); this.beams.group.rotation.x = -0.35; s.add(this.beams.group);
    for (let i = 0; i < 4; i++) this.lights.push(new StringLights({ anchors: [new THREE.Vector3(-12, 4.2, 5 - i * 4.5), new THREE.Vector3(-4, 3.8, 3 - i * 4), new THREE.Vector3(4, 4.0, 4 - i * 4.4), new THREE.Vector3(12, 4.2, 5 - i * 4.6)], multicolor: i % 2 === 1, seed: i }));
    for (const l of this.lights) s.add(l.group);
    for (const [x, z] of [[-12, 5], [12, 5], [-12, -13], [12, -13]]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4.4, 8), new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.5 })); pole.position.set(x, 2.2, z); s.add(pole); }
    this.sign = new NeonSign({ text: 'ROOFTOP', color: 0xff3bb0, height: 1.2, script: true, seed: 5 }); this.sign.mesh.position.set(-9, 2.2, -12.6); s.add(this.sign.mesh);
    this.crowd = new Crowd({ seed: 41, vibe: 'nightout', pbr, childShare: 0, elderShare: 0.04, groups: [
      { center: new THREE.Vector3(0, 0, -4), count: 16, radius: 3.4, activity: 'dance' },
      { center: new THREE.Vector3(0.5, 0, -6.5), count: 5, radius: 2.5, activity: ['cheer', 'cheer', 'photo', 'dance'], target: new THREE.Vector3(0, 2, -9) },
      { center: new THREE.Vector3(-8.5, 0, 1.5), count: 3, radius: 0.8, activity: ['talk', 'talk', 'phone'] },
      { center: new THREE.Vector3(8.5, 0, 0), count: 4, radius: 0.9, activity: ['talk', 'photo', 'talk', 'wave'] } ] });
    s.add(this.crowd.group);
    // Skyline: lit towers beyond the parapet, a few with screens.
    const r = rng(3);
    for (let i = 0; i < 26; i++) { const b = new Building({ style: r() < 0.6 ? 'tower' : 'office', width: 18 + r() * 16, depth: 18, floors: 12 + Math.floor(r() * 30), litFraction: 0.65, seed: 200 + i }, pbr);
      b.group.position.set(-220 + i * 17 + r() * 6, -45, -120 - r() * 160); s.add(b.group); this.skyline.push(b);
      if (r() < 0.25) { const sc = new LedScreen({ width: 14, height: 9, seed: 300 + i, programs: [0, 1, 4] }); sc.group.position.set(b.group.position.x, -45 + 30 + r() * 20, b.group.position.z + 9.3); s.add(sc.group); this.screens.push(sc); } }
    this.fw = new Fireworks(Fireworks.show({ start: -2.5, end: 20, rate: 1.6, width: 200, height: [60, 110], seed: 9, finale: true }), { starSize: 2.2 }); this.fw.group.position.set(0, -20, -95); s.add(this.fw.group);   // in front of the skyline towers
    s.fog = new THREE.FogExp2(0x101426, 0.0018);
  }
  update(t: number, _s: ShotInfo) {
    this.sky.update(t, this.camera); this.fw.update(t, 1100);
    this.flash.position.set(0, 70, -95); this.flash.color.copy(this.fw.flashColor); this.flash.intensity = this.fw.flash * 0.9;
    this.floor.update(t); this.beams.update(t); for (const l of this.lights) l.update(t); this.sign.update(t);
    this.floorLight.position.set(0, 2.5, -4); this.floorLight.color.setHSL((Math.floor(t * 124 / 60 / 4) * 0.13) % 1, 0.9, 0.55); this.floorLight.intensity = 30 * (0.6 + 0.4 * Math.max(0, Math.cos(t * 124 / 60 * Math.PI * 2)));
    this.crowd.update(t, 1); for (const b of this.skyline) { b.setLight(1, 0x0b1028, 0x2a2440); b.update(t); } for (const sc of this.screens) sc.update(t);
  }
}

/** Hilltop camp under the Milky Way. */
export class Hilltop implements Stage {
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(52, 9 / 16, 0.05, 6000);
  sky = new MilkyWaySky({ ground: true, lightPollution: 0.12, band: 1.6, stars: 1.2, center: new THREE.Vector3(0.25, 0.3, -1), along: new THREE.Vector3(0.45, 1, -0.2) }); fire = new Flame({ width: 0.9, height: 1.3, turbulence: 1, brightness: 3.5, seed: 4 });
  fireLight = new THREE.PointLight(0xff9a4a, 8, 14, 2); flies = new InsectSwarm({ kind: 'firefly', count: 120, radius: 9, height: [0.2, 2.4], center: new THREE.Vector3(0, 0, -3) });
  meteors = new MeteorStreaks({ count: 5, seed: 6, window: [4.2, 8], box: { min: new THREE.Vector3(-300, 260, -500), max: new THREE.Vector3(300, 420, -300) }, velocity: new THREE.Vector3(-90, -60, 0), trail: 60, width: 1.2 });
  crowd: Crowd;
  constructor(pbr: PBRLibrary) {
    const s = this.scene; this.sky.addTo(s); s.add(this.fireLight, this.flies.group, this.meteors.mesh, new THREE.HemisphereLight(0x23305a, 0x0a0a0c, 0.25));
    const moon = new THREE.DirectionalLight(0x7f95c8, 0.25); moon.position.set(-40, 60, 30); s.add(moon);
    const geo = new THREE.PlaneGeometry(400, 400, 160, 160).rotateX(-Math.PI / 2), p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z + 4); p.setY(i, -Math.pow(Math.max(0, d - 10), 1.4) * 0.05 + Math.sin(x * 0.05) * Math.cos(z * 0.04) * 1.5 * Math.min(1, d / 30)); }
    geo.computeVertexNormals(); projectUVs(geo); const ground = new THREE.Mesh(geo, pbr.material('aerial_grass_rock', { tint: 0x55663e, tile: 5 })); ground.receiveShadow = true; s.add(ground);
    const trees = new ConiferStand({ positions: scatterTrees(120, 3, [-160, 160, -220, -40], (x, z) => -Math.pow(Math.max(0, Math.hypot(x, z + 4) - 10), 1.4) * 0.05), minHeight: 9, maxHeight: 18, color: 0x1a2a20 }); s.add(trees.mesh);
    this.fire.mesh.position.set(0.4, 0.1, -2.6); s.add(this.fire.mesh); this.fireLight.position.set(0.4, 0.8, -2.6);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, b = new Boulder({ size: 0.22, seed: 30 + i, pbr, mossy: 0 }); b.mesh.position.set(0.4 + Math.cos(a) * 0.65, 0, -2.6 + Math.sin(a) * 0.65); s.add(b.mesh); }
    this.crowd = new Crowd({ seed: 77, vibe: 'winter', pbr, childShare: 0.2, groups: [{ center: new THREE.Vector3(0.4, 0, -2.6), count: 4, radius: 1.9, activity: ['lookup', 'talk', 'lookup', 'wave'], target: new THREE.Vector3(0, 40, -60) }] });
    s.add(this.crowd.group); s.fog = new THREE.FogExp2(0x0a0d18, 0.004);
  }
  update(t: number, _s: ShotInfo) {
    this.sky.update(t, this.camera); this.fire.update(t, 1, this.camera); this.fireLight.intensity = 7 + 2.5 * Math.sin(t * 13) * Math.sin(t * 7.3);
    this.flies.update(t); this.meteors.update(t, this.camera); this.crowd.update(t, 1);
  }
}

/** The solar system with a Milky Way backdrop; S04 follows Saturn, S05 frames the Sun. */
export class Space implements Stage {
  /** Scene id whose camera rides past Saturn (sunward side), over that shot's own time window. */
  saturnScene = 'S04';
  /** Scene id of the Sun close-up (orbit rings hidden so they do not cross the disk). */
  sunScene = 'S05';
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 20000); sky = new MilkyWaySky({ band: 1.3, stars: 1.1, center: new THREE.Vector3(-1, 0.35, -0.6), along: new THREE.Vector3(1, 0.9, 0.2) }); system: SolarSystem;
  constructor(earth: Awaited<ReturnType<typeof loadEarthTextures>>) {
    const s = this.scene; this.sky.addTo(s); this.system = new SolarSystem({ earthTextures: earth, timeScale: 3 }); s.add(this.system.group, new THREE.AmbientLight(0x202838, 0.4));
  }
  update(t: number, sh: ShotInfo) {
    this.system.update(t, this.camera); this.sky.update(t, this.camera); this.system.orbitOpacity = sh.sceneId === this.sunScene ? 0 : 0.28;
    if (sh.sceneId === this.saturnScene) {   // Saturn pass: the camera rides just outside the rings toward the planet's day side
      const p = this.system.planetWorld('saturn'), u = (t - sh.start_s) / Math.max(0.1, sh.end_s - sh.start_s), dir = p.clone().normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      this.camera.position.copy(p).addScaledVector(dir, -(20 - u * 5)).addScaledVector(side, 24 - u * 10).add(new THREE.Vector3(0, 5 + u * 2.5, 0));   // sunward side: the lit face
      this.camera.lookAt(p.clone().add(new THREE.Vector3(0, 0.5, 0))); this.camera.updateMatrixWorld(true);
    }
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const pbr = await new PBRLibrary().load(ctx.base, ['wood_table_001', 'concrete_wall_008', 'rectangular_facade_tiles', 'beige_wall_001', 'large_sandstone_blocks', 'brick_wall_001', 'aerial_grass_rock', 'rock_face', 'cotton_jersey', 'denim_fabric', 'velour_velvet', 'brown_leather']);
  const roof = new Rooftop(ctx.renderer, pbr), hill = new Hilltop(pbr), space = new Space(await loadEarthTextures(ctx.base));
  const post = { exposure: 1.0, bloomStrength: 0.7, bloomRadius: 0.7, bloomThreshold: 0.7, vignette: 0.32, grain: 0.006, vibrance: 0.3, saturation: 1.08 };
  return { shots: { 'S01/SH01': { stage: roof, post: { ...post, ao: 0.5, aoRadius: 0.5 } }, 'S02/SH01': { stage: hill, post: { ...post, exposure: 1.25, bloomStrength: 0.5 } },
    'S03/SH01': { stage: space, post: { ...post, tonemap: 'agx' as const, bloomStrength: 0.9 } }, 'S04/SH01': { stage: space, post: { ...post, tonemap: 'agx' as const } }, 'S05/SH01': { stage: space, post: { ...post, tonemap: 'agx' as const, exposure: 0.85, bloomStrength: 0.55, bloomThreshold: 0.9 } } } };
}
