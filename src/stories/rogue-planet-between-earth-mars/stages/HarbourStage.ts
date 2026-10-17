import * as THREE from 'three';
import { CityStreetClassic } from '../../../library/environment/CityStreetClassic';
import { HarbourBasin, type HarbourBoatSpec } from '../../../library/environment/HarbourBasin';
import { VillageHouses } from '../../../library/environment/VillageHouses';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Starfield } from '../../../library/space/Starfield';
import { GasGiant } from '../../../library/planet/GasGiant';
import { Moon } from '../../../library/planet/Moon';
import { SeaIce } from '../../../library/environment/SeaIce';
import { Snowfall } from '../../../library/fx/Snowfall';
import { StringLights } from '../../../library/environment/NightlifeKit';
import { GLSL_GALAXY, galaxyUniforms } from '../../../library/space/MilkyWay';
import { photoPose, lookupPose, talkPose, phonePose } from '../../../library/characters/CrowdKit';
import { box, surface } from '../../../library/util/Modeling';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { type HumanoidPose } from '../../../library/characters/Humanoid';
import type { Top, Bottom } from '../../../library/characters/HumanV2';
import { Person, carRig, setCarLights, type CarRig } from './common';
import { T, B, DEG, clockAt, seaY, rogueAltAz, rogueDiam, sunAltAz, moonOffset, floodFront, nightAt, skyDir, windowAt, ease, clamp01 } from '../timeline';

const HW = 55, HEAD_Z = -104, MOUTH_Z = -290, MOUTH_HW = 13, SIDE = 20, MEAN_SEA = T.tide.meanSeaY;
const ROGUE_DIST = 4000, MOON_DIST = 3000;

/** Atmospheric extinction tint for a sky body at altitude (deg): orange and dim near the horizon. */
function extinction(altDeg: number, out = new THREE.Color()) {
  const s = Math.sin(Math.max(altDeg, -0.5) * DEG), am = Math.min(12, 1 / (Math.max(s, 0) + 0.15 * Math.pow(Math.max(altDeg, 0) + 3.885, -1.253)));
  return out.setRGB(Math.exp(-0.05 * am), Math.exp(-0.09 * am), Math.exp(-0.17 * am));
}

/** Camera-centred sky: night/twilight/day gradient, dusk glow toward the sun, Earth-shadow band, aureoles round the planet and Moon. */
class SkyShell {
  readonly mesh: THREE.Mesh;
  readonly u: Record<string, THREE.IUniform>;
  constructor() {
    this.u = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color(0x05070a) }, uCurve: { value: 0.5 },
      uSunDir: { value: new THREE.Vector3(0, -1, 0) }, uTwi: { value: new THREE.Color() }, uShadow: { value: new THREE.Color() }, uTwilight: { value: 0 },
      uRogueDir: { value: new THREE.Vector3(0, 1, 0) }, uRogueGlow: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonGlow: { value: new THREE.Color() },
      uSunGlow: { value: new THREE.Color() }, uSunDisc: { value: 0 }, uExposure: { value: 1 },
      // Autumn evening at 50 N: the galactic centre setting in the south-west, the band arching overhead to the north-east,
      // so the east-south-east views here see the dense star field without the band itself.
      ...galaxyUniforms({ center: skyDir(232, 4), along: skyDir(300, 78), stars: 1.25 }), uGalaxy: { value: 0 }, uGalPx: { value: 0.0006 },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: this.u,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 0.0); gl_Position = projectionMatrix * vec4(p.xyz, 1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uGround, uSunDir, uTwi, uShadow, uRogueDir, uRogueGlow, uMoonDir, uMoonGlow, uSunGlow;
        uniform float uCurve, uTwilight, uSunDisc, uExposure, uGalaxy, uGalPx;
        varying vec3 vDir;
        ${GLSL_GALAXY}
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), uCurve));
          vec2 dh = normalize(d.xz + 1e-5), sh = normalize(uSunDir.xz + 1e-5);
          float toward = dot(dh, sh);
          float band = exp(-max(h, 0.0) * 7.0);
          col += uTwi * uTwilight * band * pow(max(toward, 0.0), 1.6);
          float away = pow(max(-toward, 0.0), 1.2);
          col = mix(col, uShadow, uTwilight * away * smoothstep(0.10, 0.0, h) * 0.65);
          float rc = max(dot(d, uRogueDir), 0.0);
          col += uRogueGlow * (pow(rc, 1400.0) * 0.16 + pow(rc, 90.0) * 0.045 + pow(rc, 8.0) * 0.02) * smoothstep(-0.03, 0.04, h);
          float mc = max(dot(d, uMoonDir), 0.0);
          col += uMoonGlow * (pow(mc, 3000.0) * 0.3 + pow(mc, 160.0) * 0.12) * smoothstep(-0.03, 0.04, h);
          float sc = max(dot(d, uSunDir), 0.0);
          col += uSunGlow * (pow(sc, 6.0) * 0.25 + pow(sc, 90.0) * 0.9);
          col += vec3(4.0, 3.7, 3.2) * uSunDisc * smoothstep(0.99996, 0.99998, sc) * step(0.0, h);
          if (uGalaxy > 0.0 && h > 0.0) col += galaxy(d, uGalPx) * uGalaxy * exp(-0.12 / (h + 0.02));   // stars, dimmed by extinction near the horizon
          col = mix(col, uGround, smoothstep(0.0, -0.06, h));
          gl_FragColor = vec4(col * uExposure, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -100;
  }
}

/** Planet-lit flood: patch ocean-surface-v1 so water only covers land the overtopping front has reached, with foam and winter slush. */
function patchOcean(ocean: OceanSurface) {
  const m = ocean.mesh.material as THREE.ShaderMaterial, u = ocean.uniforms;
  Object.assign(u, { uFront: { value: -1 }, uFoam: { value: 0 }, uFoamCol: { value: new THREE.Color(0.6, 0.66, 0.72) }, uIce: { value: 0 }, uIceCol: { value: new THREE.Color(0.55, 0.6, 0.66) } });
  m.uniforms = u;
  m.fragmentShader = m.fragmentShader
    .replace('varying vec3 vP;', `varying vec3 vP;
        uniform float uFront, uFoam, uIce; uniform vec3 uFoamCol, uIceCol;
        // Distance (m) inland from the nearest basin edge, or -1 over open water.
        float landDist(vec2 p){
          float x = p.x, z = p.y, ax = abs(x);
          if (z <= ${(MOUTH_Z - 14).toFixed(1)}) return -1.0;
          if (ax < ${HW.toFixed(1)} && z < ${HEAD_Z.toFixed(1)} && z > ${MOUTH_Z.toFixed(1)}) return -1.0;
          if (ax < ${MOUTH_HW.toFixed(1)} && z <= ${MOUTH_Z.toFixed(1)}) return -1.0;
          float d = 1e5;
          if (z >= ${HEAD_Z.toFixed(1)}) d = z - ${HEAD_Z.toFixed(1)};
          if (ax >= ${HW.toFixed(1)}) d = min(d, ax - ${HW.toFixed(1)});
          if (z <= ${MOUTH_Z.toFixed(1)}) d = min(d, 0.5);
          return d;
        }`)
    .replace('void main(){', `void main(){
          float ld = landDist(vP.xz);
          float rag = (fbm(vP.xz * 0.22 + uTime * vec2(0.25, -0.18)) - 0.5) * 7.0;
          if (ld >= 0.0 && ld > uFront + rag + 0.9) discard;`)
    .replace('gl_FragColor = vec4(col, 1.0);', `
          float fn = fbm(vP.xz * 0.35 + uTime * vec2(0.9, -0.6));
          float behind = uFront + rag - ld;
          float fo = ld >= 0.0 ? (smoothstep(6.0, 0.0, behind) * smoothstep(0.25, 0.75, fn + 0.25 * smoothstep(1.5, 0.0, behind)) + smoothstep(2.5, 0.0, ld) * 0.5 * smoothstep(0.3, 0.8, fn)) : 0.0;
          col = mix(col, uFoamCol, clamp(fo * uFoam, 0.0, 1.0));
          float ic = uIce * smoothstep(0.38, 0.62, fbm(vP.xz * 0.07 + 3.0));
          col = mix(col, uIceCol * (0.85 + 0.3 * fbm(vP.xz * 0.8)), ic);
          gl_FragColor = vec4(col, ld >= 0.0 ? smoothstep(0.0, 0.9, behind + 0.9) : 1.0);`);
  m.transparent = true;
  m.needsUpdate = true;
}

/** Hide sky-body fragments below the sea horizon and scale the Moon's brightness (moon-body-v1 has no exposure control). */
function patchMoon(moon: Moon) {
  const m = moon.mesh.material as THREE.ShaderMaterial;
  m.uniforms.uClipY = { value: -2 }; m.uniforms.uGain = { value: 1 }; m.uniforms.uTintM = { value: new THREE.Color(1, 1, 1) };
  m.fragmentShader = m.fragmentShader
    .replace('varying vec2 vUv;', 'uniform float uClipY, uGain; uniform vec3 uTintM; varying vec2 vUv;')
    .replace('void main(){', 'void main(){ if (normalize(vP - cameraPosition).y < uClipY) discard;')
    .replace('gl_FragColor=vec4(col,1.);', 'gl_FragColor=vec4(col*uGain*uTintM,1.);');
}

/** Snow on every up-facing surface of the given materials (shared 0..1 amount). */
function addSnow(mat: THREE.Material, amount: THREE.IUniform) {
  if (!(mat instanceof THREE.MeshStandardMaterial) || mat.userData.snow) return;
  mat.userData.snow = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = amount;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSnowN; varying vec3 vSnowP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vSnowN = normalize(mat3(modelMatrix) * objectNormal); vSnowP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow; varying vec3 vSnowN; varying vec3 vSnowP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float up = smoothstep(0.42, 0.8, vSnowN.y);
          float n = fract(sin(dot(floor(vSnowP.xz * 2.5), vec2(12.9898, 78.233))) * 43758.5453);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.77, 0.82), up * uSnow * (0.8 + 0.2 * n)); }`);
  };
  mat.customProgramCacheKey = () => 'snow-cover';
}

const BOATS: HarbourBoatSpec[] = [
  { kind: 'yacht', x: -49, z: -130, heading: Math.PI / 2, length: 10, groundHeel: 0.32, seed: 3 },
  { kind: 'yacht', x: -49, z: -152, heading: Math.PI / 2, length: 9, color: 0xdfe6ea, groundHeel: -0.3, seed: 7 },
  { kind: 'fishing', x: -49, z: -172, heading: Math.PI / 2, length: 8.5, color: 0x2f5d8a, groundHeel: 0.28, seed: 4 },
  { kind: 'fishing', x: 49, z: -128, heading: -Math.PI / 2, length: 8, color: 0xa63a2c, groundHeel: -0.3, seed: 9 },
  { kind: 'yacht', x: 49, z: -150, heading: -Math.PI / 2, length: 11, groundHeel: 0.3, seed: 12 },
  { kind: 'fishing', x: -20, z: -110.5, heading: 0, length: 8, color: 0x3d7a4e, groundHeel: 0.26, seed: 15 },
  { kind: 'yacht', x: 1.0, z: -110.8, heading: Math.PI, length: 10, groundHeel: -0.34, seed: 18 },
  { kind: 'fishing', x: 28, z: -205, heading: 0.3, length: 9, color: 0x2a4f7a, groundHeel: 0.25, seed: 21 },
];
const HEAD_LAMPS: [number, number][] = [[-4, -100.6], [3, -100.6], [-21, -100.6], [23, -100.6], [-41, -100.6], [43, -100.6]];
const SIDE_LAMPS: [number, number][] = [[-62, -168], [-62, -128], [62, -128], [-62, -208], [-62, -248], [62, -168], [62, -208], [62, -248]];
/** Basin lamp order: the first five carry point lights (the two nearest the flood view and three on the side quays). */
const LAMPS: [number, number][] = [...HEAD_LAMPS.slice(0, 2), ...SIDE_LAMPS.slice(0, 3), ...HEAD_LAMPS.slice(2), ...SIDE_LAMPS.slice(3)];
/** Flood outage time per basin lamp: head-quay lamps from the middle outward, then the side quays as the water spreads along them. */
/** Festival string lights on the head-quay lamp posts (x of consecutive posts), each strand fed from the lamps at its ends. */
const STRAND_POSTS = [-41, -21, -4, 3, 23, 43];
const LAMP_OUT = (() => {
  const head = LAMPS.map((l, i) => ({ i, head: l[1] > -102, d: Math.abs(l[0]) })).filter((l) => l.head).sort((a, b) => a.d - b.d);
  return LAMPS.map((l, i) => { const r = head.findIndex((h) => h.i === i); return r >= 0 ? T.lampsOut.first + r * T.lampsOut.step : T.lampsOut.first + 0.6 + (-104 - l[1]) / 260; });
})();

type Act = 'photo' | 'lookup' | 'talk' | 'phone';
/** Onlookers at the head-quay railing (rail at z -101.8). `flee`: [turn time, run heading, speed] in S04; the others stay out of that shot. */
const ONLOOKERS: { id: string; seed: number; at: [number, number]; heading: number; act: Act; top: Top; bottom?: Bottom; child?: boolean; flee?: [number, number, number] }[] = [
  // In the S02 telephoto window beside the two arriving walkers.
  { id: 'o1', seed: 201, at: [-21.4, -101.2], heading: Math.PI - 0.12, act: 'photo', top: 'jacket' },
  { id: 'o2', seed: 202, at: [-17.5, -101.35], heading: Math.PI + 0.05, act: 'lookup', top: 'coat', bottom: 'trousers' },
  { id: 'o3', seed: 203, at: [-13.9, -100.9], heading: Math.PI + 0.9, act: 'talk', top: 'hoodie' },
  { id: 'o4', seed: 204, at: [-23.6, -101.0], heading: Math.PI - 0.5, act: 'talk', top: 'longsleeve', bottom: 'skirt' },
  { id: 'o5', seed: 205, at: [-16.7, -100.7], heading: Math.PI, act: 'lookup', top: 'hoodie', child: true },
  // Between the parked cars in the S04 flood view: they flee left, straight back and right.
  { id: 'o6', seed: 206, at: [-4.3, -101.4], heading: Math.PI, act: 'lookup', top: 'coat', flee: [19.3, -1.15, 3.4] },
  { id: 'o7', seed: 207, at: [0.3, -101.3], heading: Math.PI + 0.1, act: 'photo', top: 'jacket', bottom: 'trousers', flee: [18.9, 0.08, 3.5] },
  { id: 'o8', seed: 208, at: [3.3, -101.3], heading: Math.PI - 0.1, act: 'phone', top: 'longsleeve', flee: [19.55, 1.35, 3.2] },
];
function actPose(a: Act, t: number, seed: number, base: HumanoidPose): HumanoidPose {
  // Phones and pointing are aimed at the planet, low over the sea: heads stay near level rather than craned up.
  if (a === 'photo') { const p = photoPose(t, seed); return { ...p, headPitch: -0.04 + 0.03 * Math.sin(t * 0.7 + seed) }; }
  if (a === 'lookup') { const p = lookupPose(t, seed); return { ...p, headPitch: -0.12 + 0.04 * Math.sin(t * 0.5 + seed) }; }
  if (a === 'phone') return phonePose(t, seed);
  return talkPose(t, seed, base);
}

export class HarbourStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.3, 40000);
  private city = new CityStreetClassic({ seed: 2207, blocks: 6, storeysMin: 3, storeysMax: 5, wetness: 0.35, farFieldRadius: 0, vehicles: false });
  private basin: HarbourBasin;
  private ocean = new OceanSurface({ size: 60000, level: MEAN_SEA, deepColor: 0x0a1a24, horizonColor: 0x1a2a40, zenithColor: 0x0a1426, waveHeight: 0.42, waveScale: 0.55, glitter: 1, fogColor: 0x18263a, fogDensity: 0.00011 });
  private sky = new SkyShell();
  private stars = new Starfield({ seed: 77, count: 3200, radius: 9000, maxSize: 3.6, minY: -0.04 });
  private rogue = new GasGiant({ seed: 11, bands: 8, turbulence: 1.0, zoneColors: [0xebe5d7, 0xd6dee3], beltColors: [0x8a929c, 0xa08b78], poleColor: 0x7d8a9a,
    hazeColor: 0xa9c8ff, hazeStrength: 0.3, storms: [{ lat: -22, lon: 40, size: 6, color: 0xf3efe6, strength: 0.9, spin: 1 }, { lat: 18, lon: -70, size: 4, color: 0x5d4a44, strength: 0.75, spin: -1 }, { lat: -38, lon: 150, size: 3, color: 0xfaf7f0, strength: 0.8 }] });
  private moon = new Moon({ radius: 1, seed: 31 });
  private key = new THREE.DirectionalLight(0xc9d6ea, 1);
  private hemi = new THREE.HemisphereLight(0x223450, 0x0c0e10, 0.3);
  private people: Record<string, Person> = {};
  private strands: { s: StringLights; lamps: [number, number] }[] = [];
  private cars: CarRig[] = [];
  private snowU: THREE.IUniform = { value: 0 };
  private tNow = 0;
  private ice = new SeaIce({ seed: 5, floeCount: 70, area: [-52, 52, -284, -112], minRadius: 1.2, maxRadius: 4.2, thickness: 0.35,
    avoid: BOATS.map((b) => [b.x, b.z, 6] as [number, number, number]) });
  private snowfall = new Snowfall({ count: 3500, seed: 9, box: [40, 22, 40], fallSpeed: 0.85, drift: 0.6, brightness: 0.8 });
  private houses: VillageHouses[] = [];
  private plazaLights: THREE.PointLight[] = [];
  private moonStar = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 9.0; }',
    fragmentShader: 'uniform float uK; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(1.0 - d, 0.0), 2.5); gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * a * uK, 1.0); }' }));
  private shopMats: THREE.MeshStandardMaterial[] = [];
  /** World anchors for overlay callouts, updated every frame. */
  readonly anchors = { rogue: new THREE.Vector3(), moon: new THREE.Vector3(), sun: new THREE.Vector3(), boat: new THREE.Vector3(), frozenBoat: new THREE.Vector3(), rogueRadius: 0, moonRadius: 0 };

  private envNight: THREE.Texture; private envDay: THREE.Texture;

  /** Bake a reflection environment from a sky configuration (static per lighting state). */
  private bakeEnv(renderer: THREE.WebGLRenderer, set: (u: Record<string, THREE.IUniform>) => void) {
    const sky = new SkyShell(); set(sky.u); sky.mesh.scale.setScalar(10);
    const sc = new THREE.Scene(); sc.add(sky.mesh);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x07090c })); ground.position.y = -1; sc.add(ground);
    const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(sc, 0, 0.1, 100).texture; pm.dispose();
    return tex;
  }

  constructor(renderer: THREE.WebGLRenderer) {
    this.envNight = this.bakeEnv(renderer, (u) => { u.uZenith.value.setRGB(0.02, 0.035, 0.08); u.uHorizon.value.setRGB(0.05, 0.07, 0.11); u.uRogueDir.value.copy(skyDir(165, 24)); u.uRogueGlow.value.setRGB(1.6, 1.7, 1.9); });
    this.envDay = this.bakeEnv(renderer, (u) => { u.uZenith.value.setRGB(0.2, 0.3, 0.46); u.uHorizon.value.setRGB(0.5, 0.53, 0.56); u.uSunDir.value.copy(skyDir(141, 13.5)); u.uSunGlow.value.setRGB(0.6, 0.55, 0.45); });
    this.basin = new HarbourBasin({ seed: 31, halfWidth: HW, headZ: HEAD_Z, mouthZ: MOUTH_Z, sideQuayWidth: SIDE, mouthHalfWidth: MOUTH_HW, quayTop: 0, meanSea: MEAN_SEA,
      floorWall: -6.4, floorChannel: -8.3, lighthouse: 1, boats: BOATS, lamps: LAMPS, lights: 5,
      pavingHoles: [[-12.1, 12.1, HEAD_Z + 1, HEAD_Z + 40]] });
    this.moonStar.frustumCulled = false;
    this.scene.add(this.moonStar, this.sky.mesh, this.stars.points, this.city.group, this.basin.group, this.ocean.mesh, this.rogue.group, this.moon.group, this.key, this.key.target, this.hemi,
      this.ice.group, this.snowfall.points);
    patchOcean(this.ocean);
    patchMoon(this.moon);
    this.rogue.body.rotation.set(0.18, 0, 0.42);
    this.key.castShadow = true; this.key.shadow.mapSize.set(4096, 4096); this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.04;

    // Town ground, the coast either side of the harbour and its rock revetment.
    const ground = surface(0x26292b, 0.92), grass = surface(0x2f3529, 0.95), rock = surface(0x3d3b37, 0.9);
    box(this.scene, [1200, 0.1, 700], ground, [0, -0.09, HEAD_Z + 350]);
    for (const s of [-1, 1]) {
      box(this.scene, [525, 0.2, 200], grass, [s * (HW + SIDE + 262.5), -0.1, (MOUTH_Z - 14 + HEAD_Z) / 2]);
      const rev = box(this.scene, [525, 3.2, 9], rock, [s * (HW + SIDE + 262.5), -1.6, MOUTH_Z - 17]); rev.rotation.x = 0.55;
    }
    // Harbour houses: rows along both side quays and along the plaza's sides.
    const quaySites = (x: number, yaw: number) => { const s: [number, number, number][] = []; for (let z = HEAD_Z - 9; z > MOUTH_Z + 4; z -= 7.4) s.push([x, z, yaw]); return s; };
    const plazaSites = (x0: number, x1: number) => { const s: [number, number, number][] = []; for (let x = x0; x < x1; x += 7.6) s.push([x, -63, Math.PI]); return s; };
    const houseOpts = { width: [5.4, 7] as [number, number], depth: [6, 8] as [number, number], height: [6.2, 9.4] as [number, number], litFraction: 0.55,
      wallColors: [0xd9cbb0, 0xc9b79a, 0xb7c4c0, 0xd4b8a0, 0xe0d6c4, 0xa9b49c, 0xc7a28a, 0x9fb3bd] };
    for (const [sites, seed] of [[quaySites(-(HW + SIDE + 4.5), Math.PI / 2), 41], [quaySites(HW + SIDE + 4.5, -Math.PI / 2), 43], [plazaSites(-102, -30), 45], [plazaSites(31, 103), 47]] as const) {
      const h = new VillageHouses({ sites: sites as [number, number, number][], seed, ...houseOpts });
      this.houses.push(h); this.scene.add(h.group);
    }
    // Back rows on the slope behind the quays.
    for (const [x, yaw, seed] of [[-(HW + SIDE + 16), Math.PI / 2, 51], [HW + SIDE + 16, -Math.PI / 2, 53]] as const) {
      const sites: [number, number, number][] = []; for (let z = HEAD_Z - 5; z > MOUTH_Z + 10; z -= 8.2) sites.push([x, z, yaw]);
      const h = new VillageHouses({ sites, seed, ...houseOpts, height: [8, 11.5] }); h.group.position.y = 1.2; this.houses.push(h); this.scene.add(h.group);
    }

    // People and cars.
    // Townspeople (crowd-kit-v1 casting on human-figure-v2): an autumn night out on the quay, then a hard winter.
    // Saturated mid-tone tops (burgundy, navy, mustard, forest, rust, teal, plum...) so nobody reads as a pale mannequin under the planet light.
    const TOPS: Record<string, number> = { a: 0x7a1f2b, b: 0x1f3a5f, c: 0xc8942a, d: 0x2f5d3a, o1: 0xb3542d, o2: 0x1f6f6b, o3: 0x5b2a5e, o4: 0x3b5f8a, o5: 0xd9692a,
      o6: 0x8a2f4c, o7: 0x2f6a4a, o8: 0xb88a2a, w1: 0x7a1f2b, w2: 0x2f4f6f, w3: 0x3d5a3c, w4: 0xb3542d, w5: 0x4a3b5c, w6: 0xd9692a };
    const P = (k: string, o: ConstructorParameters<typeof Person>[1]) => (this.people[k] = new Person(this.scene, { ...o, extra: { ...o.extra, topColor: TOPS[k] } }));
    const autumn = (top: Top, bottom: Bottom = 'jeans') => ({ top, bottom, hat: null });
    P('a', { seed: 11, extra: autumn('jacket') }); P('b', { seed: 26, accessories: ['phone'], extra: autumn('hoodie', 'trousers') });
    P('c', { seed: 37, extra: autumn('coat') }); P('d', { seed: 44, extra: autumn('jacket', 'trousers') });
    for (const o of ONLOOKERS) P(o.id, { seed: o.seed, accessories: o.act === 'photo' || o.act === 'phone' ? ['phone'] : [],
      extra: { ...autumn(o.top, o.bottom), ...(o.child ? { age: 'child' as const, height: 1.22, build: 'slim' as const } : {}) } });
    const winter = (seed: number, acc: ('umbrella' | 'backpack' | 'tote')[] = [], child = false) => ({ seed, vibe: 'winter' as const, accessories: acc,
      extra: { top: 'coat' as const, bottom: 'trousers' as const, hat: 'beanie' as const, ...(child ? { age: 'child' as const, height: 1.18, build: 'slim' as const } : {}) } });
    P('w1', winter(52)); P('w2', winter(63, ['tote'])); P('w3', winter(71));
    P('w4', winter(84, ['tote'])); P('w5', winter(95, ['backpack'])); P('w6', winter(106, [], true));
    STRAND_POSTS.slice(0, -1).forEach((x0, i) => {
      const x1 = STRAND_POSTS[i + 1], s = new StringLights({ anchors: [new THREE.Vector3(x0, 4.3, -100.6), new THREE.Vector3(x1, 4.3, -100.6)], sag: 0.05, spacing: 0.55, multicolor: true, seed: 60 + i });
      this.strands.push({ s, lamps: [LAMPS.findIndex((l) => l[0] === x0 && l[1] === -100.6), LAMPS.findIndex((l) => l[0] === x1 && l[1] === -100.6)] }); this.scene.add(s.group);
    });
    for (const c of T.cars) { const r = carRig(this.scene, Number(c.color)); setCarLights(r, 0, 0); this.cars.push(r); }

    // Snow cover on everything static (not people, water, sky bodies).
    const amount = this.snowU;
    const snowRoots: THREE.Object3D[] = [this.city.group, this.basin.group, ...this.houses.map((h) => h.group), ...this.cars.map((c) => c.g)];
    for (const r of snowRoots) r.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.noSnow) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => addSnow(m, amount)); });
    this.scene.traverse((o) => { if (o instanceof THREE.Mesh && o.parent === this.scene && o.material instanceof THREE.MeshStandardMaterial) addSnow(o.material, amount); });

    this.city.near.traverse((o) => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.emissiveMap === null && o.material.emissive.getHex() !== 0 && !this.city.lampHeads.includes(o.material) && !this.shopMats.includes(o.material)) this.shopMats.push(o.material); });
    for (const m of this.shopMats) m.userData.base ??= m.emissiveIntensity;
    this.ice.group.position.y = MEAN_SEA;
    for (const x of [-7.0, 7.0]) { const l = new THREE.PointLight(0xffc98a, 60, 34, 1.6); l.position.set(x, 7.4, -81); this.scene.add(l); this.plazaLights.push(l); }
    const pit = new THREE.PointLight(0xffc68a, 70, 40, 1.4); pit.position.set(-57.5, 4.4, -168); this.scene.add(pit); this.plazaLights.push(pit);
  }

  // ---------------------------------------------------------------------------------------------------------------
  private placeSkyBody(obj: THREE.Object3D, dir: THREE.Vector3, dist: number, diamDeg: number) {
    obj.position.copy(this.camera.position).addScaledVector(dir, dist);
    obj.scale.setScalar(dist * Math.tan(diamDeg * DEG / 2));
  }
  private moonDirFrom(rogueDir: THREE.Vector3, off: [number, number], out = new THREE.Vector3()) {
    const right = new THREE.Vector3().crossVectors(rogueDir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, rogueDir).normalize();
    return out.copy(rogueDir).addScaledVector(right, Math.tan(off[0] * DEG)).addScaledVector(up, Math.tan(off[1] * DEG)).normalize();
  }
  private fitShadow(focus: THREE.Vector3, dir: THREE.Vector3, half: number) {
    this.key.position.copy(focus).addScaledVector(dir, 400); this.key.target.position.copy(focus);
    const c = this.key.shadow.camera; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 10; c.far = 900; c.updateProjectionMatrix();
    this.key.target.updateMatrixWorld();
  }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId, key = shot.key;
    const night = sc <= 'S05', nights = sc === 'S06', winter = sc === 'S07';
    for (const p of Object.values(this.people)) p.hide();
    this.camera.updateMatrixWorld(true);
    this.sky.mesh.position.copy(this.camera.position);
    this.stars.follow(this.camera);
    const su = this.sky.u, ou = this.ocean.uniforms;
    su.uGalPx.value = this.camera.fov * DEG / 1920 * 0.9;

    // ---- water level, flood front and boats
    const water = night ? seaY(t) : nights ? MEAN_SEA + 0.25 : MEAN_SEA;
    this.ocean.mesh.position.y = water;
    this.ocean.update(t);
    const front = night ? floodFront(t) : -1;
    (ou.uFront.value as number) = front; ou.uFront.value = front;
    ou.uFoam.value = night && t >= T.over ? 1 : 0;
    ou.uIce.value = winter ? 0.55 : 0;
    this.basin.update(t, water, t * 0.9);
    this.placeAdrift(t, sc, water);

    // ---- sky bodies and light
    const clock = night ? clockAt(t) : 20.5;
    const [raz, ralt] = rogueAltAz(clock), rogueDir = skyDir(raz, ralt);
    const [saz, salt] = night ? sunAltAz(clock) : winter ? [T.winter.sunAz, T.winter.sunAlt] : [285, -22];
    const sunDir = skyDir(saz, salt);
    const tint = extinction(ralt);
    const horizon = -(this.camera.position.y - water) / 30000;
    this.rogue.group.visible = night;
    this.moon.group.visible = night || nights;
    let moonDir = new THREE.Vector3(0, 1, 0), moonDiam = T.moon.diamEvening;
    if (night) {
      this.placeSkyBody(this.rogue.group, rogueDir, ROGUE_DIST, rogueDiam(clock));
      this.rogue.sunDirection = sunDir; this.rogue.tint = new THREE.Color(1, 1, 1).lerp(tint, 0.55); this.rogue.exposure = 1.15 / Math.max(0.6, 0.45 + 0.55 * tint.g); this.rogue.horizonClip = horizon;
      this.rogue.update(t, clock / T.rogue.spinHours * Math.PI * 2);
      moonDir = this.moonDirFrom(rogueDir, moonOffset(clock));
      moonDiam = clock > 22 ? T.moon.diamTransit : T.moon.diamEvening;
    } else if (nights) {
      const n = nightAt(t), rise = 0.35 + 1.9 * n.local;
      moonDir = skyDir(106.0 + [0.0, 0.25, -0.15, 0.3, -0.1, 0.2][n.i], rise);
      moonDiam = n.diam;
    }
    const mAlt = Math.asin(moonDir.y) / DEG;
    this.placeSkyBody(this.moon.group, moonDir, MOON_DIST, moonDiam);
    const mu = this.moon.mesh.material as THREE.ShaderMaterial;
    mu.uniforms.uClipY.value = Math.sin(horizon);
    mu.uniforms.uGain.value = nights ? 2.2 : 1.5;
    (mu.uniforms.uTintM.value as THREE.Color).setRGB(1, 1, 1).lerp(extinction(mAlt), 0.6);
    // The Moon is lit by the Sun from nearly behind the camera (gibbous), offset a little to one side.
    const moonSun = night ? sunDir.clone() : moonDir.clone().negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.22).add(new THREE.Vector3(0, -0.08, 0)).normalize();
    this.moon.sunDirection = moonSun;
    // A receding Moon too small to resolve still shines like a bright star: a point glow takes over as its disc shrinks.
    const pt = clamp01((0.2 - moonDiam) / 0.14) * (nights ? 1 : 0);
    this.moonStar.visible = pt > 0.01;
    this.moonStar.position.copy(this.moon.group.position);
    (this.moonStar.material as THREE.ShaderMaterial).uniforms.uK.value = pt * 1.6;
    this.anchors.rogue.copy(this.rogue.group.position); this.anchors.rogueRadius = this.rogue.group.scale.x;
    this.anchors.moon.copy(this.moon.group.position); this.anchors.moonRadius = this.moon.group.scale.x;

    if (night) {
      const dusk = clamp01((-salt - 5) / 9);                  // 0 at civil dusk, 1 by full night
      const twilight = 1 - dusk;
      su.uZenith.value.setRGB(0.007 + 0.02 * twilight, 0.014 + 0.03 * twilight, 0.036 + 0.06 * twilight);
      su.uHorizon.value.setRGB(0.030 + 0.03 * twilight, 0.042 + 0.04 * twilight, 0.070 + 0.05 * twilight);
      su.uTwilight.value = twilight; su.uTwi.value.setRGB(0.20, 0.12, 0.10); su.uShadow.value.setRGB(0.02, 0.03, 0.06);
      const g = clamp01((ralt + 2) / 12);
      su.uRogueGlow.value.setRGB(0.22, 0.25, 0.32).multiply(tint).multiplyScalar(0.5 + 0.5 * g);
      su.uMoonGlow.value.setRGB(0.25, 0.25, 0.27);
      su.uSunGlow.value.setRGB(0, 0, 0); su.uSunDisc.value = 0; su.uCurve.value = 0.55;
      su.uRogueDir.value.copy(rogueDir); su.uMoonDir.value.copy(moonDir); su.uSunDir.value.copy(sunDir);
      this.stars.brightness = 0.22 + 0.12 * dusk;
      su.uGalaxy.value = 0.22 + 0.18 * dusk;              // the planet- and moonlit sky hides the fainter stars
      // Planet-light: cool silver, orange and weak while it is low.
      const k = 0.15 + 1.0 * clamp01((ralt + 0.5) / 10);
      this.key.color.setRGB(0.78, 0.84, 0.95).multiply(tint).multiplyScalar(1 / Math.max(0.35, tint.r));
      this.key.intensity = 1.05 * k;
      this.hemi.color.setRGB(0.20 + 0.12 * twilight, 0.27 + 0.14 * twilight, 0.44 + 0.16 * twilight); this.hemi.groundColor.setRGB(0.06, 0.065, 0.07);
      this.hemi.intensity = 0.9;
      ou.uHorizon.value.copy(su.uHorizon.value); ou.uZenith.value.copy(su.uZenith.value);
      ou.uSunDir.value.copy(rogueDir); (ou.uSunColor.value as THREE.Color).setRGB(0.006, 0.007, 0.0085).multiply(tint);
      ou.uDeep.value.setRGB(0.02, 0.05, 0.07); ou.uFogColor.value.copy(su.uHorizon.value); ou.uGlitter.value = 1.0;
      this.fitShadow(this.shadowFocus(key), rogueDir.y > 0.02 ? rogueDir : skyDir(raz, 2), 70);
    } else if (nights) {
      su.uZenith.value.setRGB(0.006, 0.009, 0.02); su.uHorizon.value.setRGB(0.024, 0.03, 0.048); su.uTwilight.value = 0;
      su.uRogueGlow.value.setRGB(0, 0, 0); su.uMoonGlow.value.setRGB(0.2, 0.17, 0.14).multiply(extinction(mAlt)); su.uMoonDir.value.copy(moonDir);
      su.uSunGlow.value.setRGB(0, 0, 0); su.uSunDisc.value = 0; su.uCurve.value = 0.5;
      this.stars.brightness = 1.0;
      su.uGalaxy.value = 2.6;                             // weeks later: a dark sky full of stars (low here, so extinction dims them)
      this.key.color.setRGB(0.75, 0.8, 0.95); this.key.intensity = 0.06;
      this.hemi.color.setRGB(0.07, 0.10, 0.17); this.hemi.groundColor.setRGB(0.03, 0.03, 0.035); this.hemi.intensity = 0.4;
      ou.uHorizon.value.copy(su.uHorizon.value); ou.uZenith.value.copy(su.uZenith.value);
      ou.uSunDir.value.copy(moonDir); (ou.uSunColor.value as THREE.Color).setRGB(0.012, 0.011, 0.009).multiply(extinction(mAlt));
      ou.uDeep.value.setRGB(0.01, 0.025, 0.035); ou.uFogColor.value.copy(su.uHorizon.value); ou.uGlitter.value = 1;
      this.fitShadow(new THREE.Vector3(-30, 0, -140), moonDir.y > 0.05 ? moonDir : skyDir(104, 5), 60);
    } else {
      su.uZenith.value.setRGB(0.20, 0.30, 0.46); su.uHorizon.value.setRGB(0.50, 0.53, 0.56); su.uTwilight.value = 0; su.uCurve.value = 0.6;
      su.uRogueGlow.value.setRGB(0, 0, 0); su.uMoonGlow.value.setRGB(0, 0, 0);
      su.uSunDir.value.copy(sunDir); su.uSunGlow.value.setRGB(0.55, 0.5, 0.42); su.uSunDisc.value = 0.75;
      this.stars.brightness = 0;
      su.uGalaxy.value = 0;
      this.key.color.setRGB(1.0, 0.9, 0.78); this.key.intensity = 1.35;
      this.hemi.color.setRGB(0.50, 0.58, 0.70); this.hemi.groundColor.setRGB(0.32, 0.33, 0.36); this.hemi.intensity = 0.55;
      ou.uHorizon.value.copy(su.uHorizon.value); ou.uZenith.value.copy(su.uZenith.value);
      ou.uSunDir.value.copy(sunDir); (ou.uSunColor.value as THREE.Color).setRGB(0.25, 0.23, 0.2);
      ou.uDeep.value.setRGB(0.05, 0.08, 0.1); ou.uFogColor.value.setRGB(0.62, 0.66, 0.7); ou.uGlitter.value = 0.6;
      this.fitShadow(this.shadowFocus(key), sunDir, 60);
    }
    this.anchors.sun.copy(this.camera.position).addScaledVector(sunDir, 3000);

    // ---- reflections
    this.scene.environment = winter ? this.envDay : this.envNight;
    this.scene.environmentIntensity = winter ? 0.55 : nights ? 0.35 : key === 'S03/SH01' ? 1.6 : 0.8;

    // ---- practical lights
    this.city.update(t, { wetness: winter ? 0.15 : 0.45, lights: winter ? 0.0 : 1 });
    const lampOn = (i: number) => {
      if (winter) return 0;
      if (!night || t < T.over) return 1;
      const out = LAMP_OUT[i];
      if (t >= out) return 0;
      return t > out - 0.12 ? (Math.sin(t * 157) > 0 ? 1 : 0.15) : 1;
    };
    this.basin.setLamps(lampOn);
    // Festival strands share their posts' supply: they flicker and die with the lamps as the flood comes over.
    for (const { s, lamps } of this.strands) s.update(t, winter ? 0 : Math.min(lampOn(lamps[0]), lampOn(lamps[1])));
    for (const p of Object.values(this.people)) p.screenGlow = winter ? 0.4 : 2.4;
    // Street lamps short out as the flood front reaches them, nearest the quay first.
    this.city.lampHeads.forEach((m, i) => {
      const z = (i % 7) * 25 - 81, reach = T.over + (z - HEAD_Z) / T.front.speed + 0.1;
      m.emissiveIntensity = winter ? 0 : night && t >= reach ? 0 : 5;
    });
    this.city.lamps.forEach((l) => { l.intensity = winter ? 0 : night && t > T.over + 1.6 ? 0 : 25; });
    const plazaOut = T.over + (-81 - HEAD_Z) / T.front.speed + 0.1;
    this.plazaLights.forEach((l, i) => { l.intensity = winter ? 0 : i < 2 ? (night && t >= plazaOut ? 0 : 60) : (night && t >= T.over + 0.9 ? 0 : 70); });
    const shopsOut = night && t >= T.shopsOut.first;
    this.shopMats.forEach((m, i) => { m.emissiveIntensity = (m.userData.base as number) * (winter ? 0.2 : shopsOut && t > T.shopsOut.first + (i % 6) * T.shopsOut.step ? 0.05 : 1); });
    for (const h of this.houses) h.glow = winter ? 0.15 : 1;
    this.basin.beamStrength = winter ? 0 : sc <= 'S03' ? 0.05 : night ? 0.18 : 0.22;
    (this.basin.lighthouseLamp as THREE.MeshStandardMaterial).emissiveIntensity = winter ? 0.3 : 6;

    // ---- winter dressing
    this.snowU.value = winter ? 1 : 0;
    this.ice.group.visible = winter; this.ice.update(t);
    this.snowfall.points.visible = winter; this.snowfall.update(t);
    this.snowfall.points.position.copy(this.camera.position).add(new THREE.Vector3(0, -6, -12));

    // ---- cars and people
    this.placeCars(t, sc, water);
    this.tNow = t;
    if (sc >= 'S02' && sc <= 'S04') this.stageOnlookers(t, sc);
    if (sc === 'S02') this.stageRailing(t);
    if (sc === 'S04') this.stageRunners(t);
    if (winter) this.stageWinter(t);
    this.basin.boats[6].g.getWorldPosition(this.anchors.boat);
    this.basin.boats[0].g.getWorldPosition(this.anchors.frozenBoat);
  }

  private shadowFocus(key: string) {
    if (key === 'S03/SH01') return new THREE.Vector3(-46, -6, -168);
    if (key === 'S04/SH01') return new THREE.Vector3(-4, 0, -88);
    if (key.startsWith('S07')) return new THREE.Vector3(-30, 0, -110);
    return new THREE.Vector3(-20, 0, -104);
  }

  /** The hero yacht: lifted by the flood, slammed against the quay edge and railing, later left stranded on the plaza. */
  private placeAdrift(t: number, sc: string, water: number) {
    for (const a of T.boats.adrift) {
      const b = this.basin.boats[a.id], sp = b.spec;
      if (sc > 'S05') {
        b.g.position.set(a.to[0], 0.62, a.to[1]);
        b.g.rotation.set(0, sp.heading + a.yaw, 0);
        b.tilt.rotation.set(-0.3 * Math.sign(sp.groundHeel ?? 1), 0, 0.05);
        continue;
      }
      if (!(sc === 'S04' || sc === 'S05') || t < a.hit - 0.4) continue;
      const u = ease((t - (a.hit - 0.4)) / 0.4), scrape = windowAt(t, a.hit2 - 0.05, a.hit2 + 0.3);
      b.g.position.set(sp.x + (a.edge[0] - sp.x) * u, Math.max(water, -0.2) + Math.sin(t * 3.1) * 0.05, sp.z + (a.edge[1] - sp.z) * u);
      b.g.rotation.set(0, sp.heading + 0.12 * u + 0.1 * scrape, 0);
      b.tilt.rotation.set(0.06 * Math.sin(t * 2.3) - 0.08 * windowAt(t, a.hit - 0.05, a.hit + 0.15) * (1 - scrape), 0, 0.04 * Math.sin(t * 1.7));
    }
  }

  /** Parked plaza cars: floated and slewed by the flood, left where the water dropped them. */
  private placeCars(t: number, sc: string, water: number) {
    T.cars.forEach((c, i) => {
      const r = this.cars[i], after = sc > 'S05';
      const u = after ? 1 : sc === 'S04' || sc === 'S05' ? ease((t - c.lift) / 1.4) : 0;
      const depth = Math.max(0, water);
      const lift = after ? 0 : t >= c.lift ? Math.min(0.5, Math.max(0, depth - 0.35) * 0.8 + 0.12 * windowAt(t, c.lift, c.lift + 0.25)) : 0;
      r.g.position.set(c.at[0] + c.drift[0] * u, lift + (t >= c.lift && !after ? Math.sin(t * 2.6 + i) * 0.03 : 0), c.at[1] + c.drift[1] * u);
      r.g.rotation.set(after ? 0.02 : 0.03 * Math.sin(t * 1.9 + i) * u, c.heading + c.yaw * u, after ? 0.03 * (i - 1) : 0.04 * Math.sin(t * 2.2 + i * 2) * u);
      setCarLights(r, 0, 0);
    });
  }

  private stageRailing(t: number) {
    const t0 = B[1];
    const look: Partial<HumanoidPose> = { headPitch: -0.12, lean: -0.03 };
    const point = windowAt(t, 7.2, 7.8), phone = windowAt(t, 8.1, 8.7), turn = windowAt(t, 8.8, 9.4);
    this.people.a.walk(t, { start: [-18.6, -95.2], heading: Math.PI + 0.12, t0, speed: [[t0, 1.25], [t0 + 3.6, 1.25], [t0 + 4.3, 0]] },
      { pose: { ...look, armR: [-1.45, 0.25, 0.25], headYaw: 0.25 * turn }, w: Math.max(windowAt(t, 6.4, 7.0) * 0.5, point) });
    this.people.b.walk(t, { start: [-15.6, -95.6], heading: Math.PI - 0.05, t0, speed: [[t0, 1.15], [t0 + 4.4, 1.15], [t0 + 5.2, 0]] },
      { pose: { ...look, armR: [-1.2, 0.2, 1.65], armL: [-0.9, 0.1, 1.2], headPitch: -0.05, headYaw: -0.4 * turn }, w: Math.max(windowAt(t, 6.6, 7.2) * 0.4, phone) });
    // Two more townspeople walking along the quay further off, so the place feels inhabited.
    this.people.c.walk(t, { start: [-46, -99.0], heading: Math.PI / 2, t0, speed: [[t0, 1.2]] }, { pose: look, w: windowAt(t, 6.0, 7.0) * 0.6 });
    this.people.d.walk(t, { start: [-62.5, -150], heading: 0.05, t0, speed: [[t0, 1.3]] });
  }

  /** Townspeople who came out to see the planet: filming, pointing and talking at the head-quay railing (S02-S04). */
  private stageOnlookers(t: number, sc: string) {
    for (const o of ONLOOKERS) {
      const p = this.people[o.id];
      if (sc === 'S04' && !o.flee) { p.hide(); continue; }   // the S02 group stood further along the quay, outside this view
      if (sc === 'S04' && o.flee) { this.flee(p, o.at, o.flee[0], o.flee[1], o.flee[2], (b) => actPose(o.act, t, o.seed, b)); continue; }
      p.stand(o.at, o.heading, (b) => actPose(o.act, t, o.seed, b), 0, t);
    }
  }

  /** Watch the water from the railing (acting until the turn), turn the short way round and run inland. */
  private flee(p: Person, at: [number, number], turnAt: number, heading: number, v: number, act: (b: HumanoidPose) => HumanoidPose) {
    const t = this.tNow, go = turnAt + 0.38;
    if (t < go) {
      const turn = ease((t - turnAt) / 0.38), look = windowAt(t, turnAt - 0.5, turnAt - 0.1), dh = Math.atan2(Math.sin(heading - Math.PI), Math.cos(heading - Math.PI));
      p.stand(at, Math.PI + dh * turn, (b) => {
        const q = act(b);
        return { ...q, headPitch: q.headPitch * (1 - look) - 0.18 * look, headYaw: q.headYaw * (1 - turn) - 0.5 * look * (1 - turn), lean: q.lean * (1 - turn),
          armL: [q.armL[0] * (1 - turn), q.armL[1], q.armL[2] * (1 - turn) + 0.5 * turn], armR: [q.armR[0] * (1 - turn), q.armR[1], q.armR[2] * (1 - turn) + 0.5 * turn] };
      }, 0, t);
    } else p.walk(t, { start: at, heading, t0: go, speed: [[go, 0.8], [go + 0.45, v]], run: 1 });
  }

  private stageRunners(t: number) {
    // Two onlookers watch the water climb from the railing, then turn and run inland toward you as it comes over.
    const watch: Partial<HumanoidPose> = { headPitch: 0.42, lean: 0.12, armL: [-0.35, 0.1, 0.5], armR: [-0.35, 0.1, 0.5] };
    const watching = (b: HumanoidPose): HumanoidPose => ({ ...b, ...watch, headYaw: b.headYaw * 0.5, headPitch: watch.headPitch! + 0.04 * Math.sin(t * 0.9) });
    this.flee(this.people.a, [-1.4, -101.0], 19.75, -0.25, 3.6, watching);
    this.flee(this.people.c, [2.0, -100.9], 19.95, 0.3, 3.3, watching);
  }

  private stageWinter(t: number) {
    const t0 = B[6];
    const hunch: Partial<HumanoidPose> = { shrug: 0.55, lean: 0.06, headPitch: 0.12, armL: [0.1, 0.05, 0.6], armR: [0.1, 0.05, 0.6] };
    this.people.w1.walk(t, { start: [-34, -97.5], heading: Math.PI / 2 + 0.08, t0, speed: [[t0, 1.05]] }, { pose: hunch, w: 0.8 });
    this.people.w2.walk(t, { start: [-2, -95.5], heading: -Math.PI / 2, t0, speed: [[t0, 0.95]] }, { pose: hunch, w: 0.8 });
    this.people.w3.walk(t, { start: [-61, -124], heading: Math.PI, t0, speed: [[t0, 1.0], [33.6, 1.0], [34.3, 0]] },
      { pose: { ...hunch, headYaw: 0.9, headPitch: 0.35 }, w: windowAt(t, 33.8, 34.5) });
    // Across the frozen plaza past the stranded yacht: one carrying a bag, a parent and child heading the other way.
    this.people.w4.walk(t, { start: [-6.5, -94.0], heading: -Math.PI / 2, t0, speed: [[t0, 1.0]] }, { pose: hunch, w: 0.8 });
    this.people.w5.walk(t, { start: [-17.4, -90.2], heading: Math.PI / 2 - 0.1, t0, speed: [[t0, 0.85]] }, { pose: hunch, w: 0.7 });
    this.people.w6.walk(t, { start: [-17.2, -89.1], heading: Math.PI / 2 - 0.1, t0, speed: [[t0, 0.85]], step: 0.5 }, { pose: { ...hunch, headYaw: 0.35 }, w: 0.6 });
  }
}
