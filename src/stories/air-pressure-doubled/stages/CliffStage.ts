import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Terrain } from '../../../library/environment/Terrain';
import { GrassField } from '../../../library/environment/GrassField';
import { BirdFlock } from '../../../library/creatures/BirdFlock';
import { Sailboat } from '../../../library/vehicles/Sailboat';
import { Humanoid, POSE_STAND, POSE_SIT } from '../../../library/characters/Humanoid';
import { fbm2, smoothstep, lerp, rng } from '../../../library/util/math';
import { T } from '../timeline';

export const SEA_Y = -38;
export const BENCH_POS = new THREE.Vector3(4.8, 0, -2.4);
export const HIKER_POS = new THREE.Vector3(0.3, 0, -4.0);
const SUN_DAY = new THREE.Vector3(-0.55, 0.53, -0.64).normalize();
const SUN_SET = new THREE.Vector3(0.035, 0.026, -0.999).normalize();

export const edgeZ = (x: number) => -6 + 2.2 * (fbm2(x / 18, 0.3, 5, 3) - 0.5) * 2 + 1.2 * Math.sin(x / 13);
const plateau = (x: number, z: number) => 0.22 * (fbm2(x / 9, z / 9, 7, 3) - 0.5) + 0.12 * (fbm2(x / 30, z / 30, 2, 2) - 0.5);
/** Ground height: gently rolling plateau, a rounded lip and a near-vertical rock face down to the sea. */
export function groundY(x: number, z: number): number {
  const d = z - edgeZ(x), fall = smoothstep(0.6, -5.0, d);
  let h = plateau(x, z) * (1 - fall) + (SEA_Y - 1.5) * fall;
  h += fall * (1 - fall) * 4 * (fbm2(x / 3.5, z / 3.5, 9, 3) - 0.5) * 7;
  h += smoothstep(-5, -9, d) * (fbm2(x / 4, z / 4, 12, 3) - 0.42) * 3.2;     // boulders at the base
  return h;
}

/** Wind push (grass bend in radians, boat heel) in the comparison: today, then the same breeze in doubled air. */
export function windAt(t: number, scene: string) {
  if (scene === 'S08') return { bend: 0.12, heel: 0.12, k: 0 };
  const k = smoothstep(T.twiceHard - 0.1, T.twiceHard + 0.7, t);
  return { bend: lerp(0.25, 0.5, k), heel: lerp(0.19, 0.38, k), k };
}

interface SkyLook { zen: number; hor: number; haze: number; sun: number; sunI: number; glow: number }
const SET_TODAY: SkyLook = { zen: 0x2c3f78, hor: 0xe9904c, haze: 0xf6a066, sun: 0xff8f3a, sunI: 16, glow: 0.45 };
const SET_DOUBLED: SkyLook = { zen: 0x1a2050, hor: 0xa93a26, haze: 0xbd472a, sun: 0xff690e, sunI: 6, glow: 0.4 };

/**
 * Sea-cliff top (metres): wind-combed grass, a walker, gulls on the updraft and sloops heeling offshore in the
 * afternoon (S06); the same cliff at sunset with a person on a bench (S08), sky shifting from today's orange to the
 * deeper red of doubled air.
 */
export class CliffStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 40000);
  private sky: SkyDome; private ocean: OceanSurface; private grass: GrassField; private birds: BirdFlock;
  private boats: Sailboat[] = []; private figure: Humanoid; private bench = new THREE.Group();
  private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight; private fog: THREE.FogExp2;
  private envDay: THREE.Texture; private envSet: THREE.Texture;
  private c1 = new THREE.Color(); private c2 = new THREE.Color();

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene, r = rng(55);
    this.sky = new SkyDome({ zenithColor: 0x2f6cc0, horizonColor: 0xc4d8ea, groundColor: 0x4a5a66, hazeColor: 0xe6e2d8, hazeAmount: 0.3, sunDirection: SUN_DAY, sunColor: 0xfff2dc, sunIntensity: 24, sunGlow: 0.55, curve: 0.5 });
    s.add(this.sky.mesh);
    this.envDay = this.sky.toEnvironment(renderer);
    this.setSky(SET_TODAY, SUN_SET); this.envSet = this.sky.toEnvironment(renderer, 0.12);
    this.fog = new THREE.FogExp2(0xd2dae2, 0.00035); s.fog = this.fog;
    this.ocean = new OceanSurface({ level: SEA_Y, deepColor: 0x0b3550, horizonColor: 0xc4d8ea, zenithColor: 0x2f6cc0, sunDirection: SUN_DAY, sunColor: 0xfff2dc, waveHeight: 1.0, waveScale: 1.2, fogColor: 0xd2dae2, fogDensity: 0.00008, glitter: 0.8 });
    s.add(this.ocean.mesh);

    // Cliff heightfield.
    const W = 140, D = 95, nx = 400, nz = 272, geo = new THREE.PlaneGeometry(W, D, nx, nz).rotateX(-Math.PI / 2);
    geo.translate(0, 0, -2.5);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal as THREE.BufferAttribute, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const turf = new THREE.Color(0x3f5226), turf2 = new THREE.Color(0x5b6a33), rock = new THREE.Color(0x8a8172), rock2 = new THREE.Color(0x5d564c), wet = new THREE.Color(0x2c2a27), lichen = new THREE.Color(0xa49a58);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), steep = 1 - nrm.getY(i), n = fbm2(x / 5, z / 5 + y / 5, 3, 3);
      c.copy(turf).lerp(turf2, n);
      c.lerp(n > 0.5 ? rock : rock2, smoothstep(0.25, 0.5, steep));
      c.lerp(lichen, smoothstep(0.6, 0.75, fbm2(x / 2, y / 2, 4, 2)) * smoothstep(0.3, 0.6, steep) * smoothstep(-25, -5, y) * 0.6);
      c.lerp(wet, smoothstep(SEA_Y + 6, SEA_Y + 1, y));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    ground.receiveShadow = true; s.add(ground);
    for (const [x, z, w, h, seed] of [[-900, -1300, 1700, 95, 3], [1900, -2700, 2600, 150, 6], [-2600, -4200, 3000, 130, 14]] as const) {
      const t = new Terrain({ seed, width: w, depth: w * 0.55, segmentsX: 160, segmentsZ: 90, peakHeight: h, snowLine: 99999, treeLine: 99999 });
      t.mesh.position.set(x, SEA_Y, z); s.add(t.mesh);
    }

    // Grass (kept clear of the edge and of the very nearest camera positions).
    const camPath = [[3.6, 4.2], [2.6, 3.2], [6.5, 9.5], [5.0, 7.4], [0.8, -4.4], [0.6, -4.6]];
    const nearCam = (x: number, z: number) => camPath.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.55);
    this.grass = new GrassField({ area: [-18, 22, -10, 16], count: 95000, ground: groundY, reject: (x, z) => z < edgeZ(x) + 0.5 || nearCam(x, z), minHeight: 0.06, maxHeight: 0.32,
      baseColor: 0x2c3c1b, tipColor: 0x9aab5c, dryColor: 0xc0ab72, flowerFraction: 0.05, flowerColor: 0xe58fb4, sunDirection: SUN_DAY, sunColor: 0xfff0d6, skyColor: 0x9cbbe0, fogColor: 0xd2dae2, fogDensity: 0.004, seed: 8 });
    s.add(this.grass.mesh);

    // Sloops reaching across the onshore breeze (bow toward -X, sails eased toward +Z, leeward).
    for (const [x, z, L] of [[-100, -600, 10], [-300, -900, 11], [-240, -1300, 9.5]] as const) {
      const b = new Sailboat({ length: L, sails: true, seed: Math.floor(r() * 99) }); b.group.position.set(x, SEA_Y, z); b.group.rotation.y = Math.PI; s.add(b.group); this.boats.push(b);
    }
    this.birds = new BirdFlock({ count: 5, seed: 33, spread: [3.5, 1.4, 2.6], sunDirection: SUN_DAY, sunColor: 0xfff0d6, ambient: 0x8fa6c6 });
    s.add(this.birds.mesh);

    // Walker (S06) who becomes the seated sunset watcher (S08), and the bench.
    this.figure = new Humanoid({ height: 1.72, coatColor: 0x3f6b3a, trouserColor: 0x34363c, scarfColor: null, coat: 'jacket', hairColor: 0x3a281c });
    s.add(this.figure.root);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.85 }), iron = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.6 });
    for (let i = 0; i < 4; i++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.09), wood); slat.position.set(0, 0.44, -0.16 + i * 0.105); slat.castShadow = true; this.bench.add(slat); }
    for (let i = 0; i < 3; i++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.025), wood); slat.position.set(0, 0.58 + i * 0.12, 0.22 + i * 0.012); slat.rotation.x = -0.12; slat.castShadow = true; this.bench.add(slat); }
    for (const x of [-0.68, 0.68]) for (const z of [-0.16, 0.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), iron); leg.position.set(x, 0.22, z); this.bench.add(leg); }
    this.bench.position.set(BENCH_POS.x, groundY(BENCH_POS.x, BENCH_POS.z), BENCH_POS.z); this.bench.rotation.y = Math.PI; s.add(this.bench);

    this.sun = new THREE.DirectionalLight(0xfff0d6, 3.0); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 120 }); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
    this.hemi = new THREE.HemisphereLight(0xa8c4e8, 0x4a5030, 0.85);
    s.add(this.sun, this.sun.target, this.hemi);
  }

  private setSky(L: SkyLook, sunDir: THREE.Vector3, L2?: SkyLook, k = 0) {
    const u = this.sky.uniforms, mix = (a: number, b: number, out: THREE.Color) => out.set(a).lerp(this.c2.set(b), k);
    const b = L2 ?? L;
    mix(L.zen, b.zen, u.uZenith.value); mix(L.hor, b.hor, u.uHorizon.value); mix(L.haze, b.haze, u.uHaze.value); mix(L.sun, b.sun, u.uSunColor.value);
    u.uSunIntensity.value = lerp(L.sunI, b.sunI, k); u.uSunGlow.value = lerp(L.glow, b.glow, k); u.uHazeAmount.value = 0.4; u.uCurve.value = 0.45;
    u.uSunDir.value.copy(sunDir); u.uGround.value.set(0x231c22);
  }

  update(t: number, shot: ShotInfo) {
    const sunset = shot.sceneId === 'S08', s = this.scene, ou = this.ocean.uniforms, w = windAt(t, shot.sceneId);
    if (!sunset) {
      const u = this.sky.uniforms;
      u.uZenith.value.set(0x2f6cc0); u.uHorizon.value.set(0xc4d8ea); u.uHaze.value.set(0xe6e2d8); u.uSunColor.value.set(0xfff2dc);
      u.uSunIntensity.value = 24; u.uSunGlow.value = 0.55; u.uHazeAmount.value = 0.3; u.uCurve.value = 0.5; u.uSunDir.value.copy(SUN_DAY); u.uGround.value.set(0x4a5a66);
      s.environment = this.envDay; s.environmentIntensity = 0.8;
      this.sun.color.set(0xfff0d6); this.sun.intensity = 3.0; this.sun.position.copy(SUN_DAY).multiplyScalar(60);
      this.hemi.color.set(0xa8c4e8); this.hemi.groundColor.set(0x4a5030); this.hemi.intensity = 0.85;
      this.fog.color.set(0xd2dae2); this.fog.density = 0.00035;
      ou.uSunDir.value.copy(SUN_DAY); ou.uSunColor.value.set(0xfff2dc); ou.uHorizon.value.set(0xc4d8ea); ou.uZenith.value.set(0x2f6cc0); ou.uFogColor.value.set(0xd2dae2); ou.uDeep.value.set(0x0b3550); ou.uWaveH.value = 1.0;
      this.grass.setLight(SUN_DAY, 0xfff0d6, 0x9cbbe0, 0xd2dae2);
    } else {
      const k = smoothstep(T.deeperRed - 0.2, T.deeperRed + 1.8, t);
      this.setSky(SET_TODAY, SUN_SET, SET_DOUBLED, k);
      s.environment = this.envSet; s.environmentIntensity = lerp(0.6, 0.4, k);
      // Direct sunlight after ~20 air masses of Rayleigh extinction: today (1, 0.37, 0.03), doubled (1, 0.14, 0.004) and 2.7x dimmer.
      this.sun.color.setRGB(1, lerp(0.37, 0.14, k), lerp(0.03, 0.004, k)); this.sun.intensity = lerp(2.4, 0.9, k); this.sun.position.copy(SUN_SET).multiplyScalar(60);
      this.hemi.color.setRGB(lerp(0.45, 0.3, k), lerp(0.4, 0.22, k), lerp(0.55, 0.4, k)); this.hemi.groundColor.set(0x241a18); this.hemi.intensity = lerp(0.5, 0.35, k);
      const fogC = this.c1.set(0xd88a5a).lerp(this.c2.set(0x8c3a2e), k);
      this.fog.color.copy(fogC); this.fog.density = 0.0004;
      ou.uSunDir.value.copy(SUN_SET); ou.uSunColor.value.copy(this.sky.uniforms.uSunColor.value).multiplyScalar(lerp(1, 0.55, k));
      ou.uHorizon.value.copy(this.sky.uniforms.uHorizon.value); ou.uZenith.value.copy(this.sky.uniforms.uZenith.value); ou.uFogColor.value.copy(fogC); ou.uDeep.value.set(0x1a1622); ou.uWaveH.value = 0.6;
      this.grass.setLight(SUN_SET, this.sun.color.clone().multiplyScalar(lerp(1.1, 0.7, k)), this.hemi.color, fogC);
    }
    this.sun.target.position.set(2, 0, 0);
    this.ocean.update(t);
    this.grass.update(t, { bend: w.bend, direction: new THREE.Vector2(0.15, 1), gust: 0.4, gustSpeed: 5 });
    this.boats.forEach((b) => b.update(t, { heel: w.heel + 0.03 * Math.sin(t * 0.9 + b.group.position.x), bob: 1.2 }));

    // Figure: walker leaning into the wind (S06) or seated on the bench (S08).
    const fig = this.figure;
    if (sunset) {
      fig.root.position.copy(this.bench.position).add(new THREE.Vector3(0.15, 0.0, 0.05)); fig.root.rotation.y = Math.PI;
      fig.setPose({ ...POSE_SIT, lean: 0.12, headPitch: -0.05, armL: [-0.55, 0.12, 1.1], armR: [-0.55, 0.12, 1.1], breath: 0.5 + 0.5 * Math.sin(t * 1.2) });
    } else {
      fig.root.position.set(HIKER_POS.x, groundY(HIKER_POS.x, HIKER_POS.z), HIKER_POS.z); fig.root.rotation.y = Math.PI - 0.25;
      fig.setPose({ ...POSE_STAND, lean: lerp(0.05, 0.13, w.k) + 0.015 * Math.sin(t * 2.3), sideLean: 0.02, headPitch: -0.08, armL: [0.05, 0.16, 0.3], armR: [0.05, 0.16, 0.3], legL: [-0.06, 0.04], legR: [0.08, 0.06], breath: 0.5 + 0.5 * Math.sin(t * 1.5) });
    }

    // Gulls hang in the updraft facing the wind; after "wingbeat" they set their wings and rise.
    const tele = shot.shotId === 'SH02', rise = smoothstep(T.wingbeat, T.wingbeat + 1.8, t);
    const center = sunset ? new THREE.Vector3(-14 + 2.6 * (t - T.S08_start), 4.6, -60) : tele ? new THREE.Vector3(-2.0, 7.4 + 1.5 * rise, -26) : new THREE.Vector3(-3.0, 5.2, -15);
    center.x += sunset ? 0 : 0.4 * Math.sin(t * 0.37); center.y += sunset ? 0 : 0.25 * Math.sin(t * 0.53);
    const glide = sunset ? 1 : tele ? lerp(0.15, 1, rise) : 0.25;
    this.birds.update(t, { center, heading: sunset ? new THREE.Vector3(1, 0, 0.1).normalize() : new THREE.Vector3(0.1, 0, -1).normalize(), glide, pitch: -0.05 }, 2 * Math.PI * 2.2 * t);
  }
}
