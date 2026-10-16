import * as THREE from 'three';
import { CityStreetClassic } from '../../../library/environment/CityStreetClassic';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { Volcano } from '../../../library/environment/Volcano';
import { EruptionColumn, PyroclasticFlow } from '../../../library/fx/AshCloud';
import { Snowfall } from '../../../library/fx/Snowfall';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { GLSL_NOISE, GLSL_FOG } from '../../../library/util/glsl';
import { solid, surface, rod } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { HumanoidPose } from '../../../library/characters/Humanoid';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt, eraOf, pdcFront, lavaAdvance, flashAt, type Era } from '../timeline';
import { VOLC, FLANK, flankPoint, flowPath } from '../geom';
import { Person, carRig, setCarLights, SIDEWALK_Y, type CarRig } from './common';

// Street along Z (camera looks toward -Z); the volcano stands 15.7 km away beyond the end of the street.
// Morning sun low behind the camera's left; later scenes have a higher sun ahead of the camera, dimmed by haze.
const SUN_AM = new THREE.Vector3(0.5, 0.42, 0.76).normalize();
const SUN_LATER = new THREE.Vector3(0.12, 0.47, -0.875).normalize();
const VENT_Y = 2630;

/** Crusted lava tongue with glowing cracks, laid on the volcano flank and pushed downhill. */
class LavaLobe {
  readonly mesh: THREE.Mesh; readonly mat: THREE.ShaderMaterial;
  private down = new THREE.Vector3(); private base = new THREE.Vector3();
  constructor(v: Volcano, theta: number, rFront: number, len = 46, width = 9) {
    const g = new THREE.PlaneGeometry(1, 1, 70, 18), p = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
    const tan = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta)), q = new THREE.Vector3();
    this.base.copy(flankPoint(v, theta, rFront));
    const r = rng(17);
    for (let i = 0; i < p.count; i++) {
      const a = uv.getX(i), b = uv.getY(i);                 // a: 0 at the front, 1 up-slope; b: across
      const u = a * len, w = width * (0.55 + 0.45 * Math.min(1, a * 4)) * (1 + 0.12 * Math.sin(a * 9 + 1));
      const lat = (b - 0.5) * w;
      const edge = 1 - Math.pow(Math.abs(b - 0.5) * 2, 2.2), front = Math.min(1, Math.sqrt(a * len / 1.4));
      const thick = 1.25 * Math.sqrt(Math.max(0, edge)) * front * (0.85 + 0.3 * Math.sin(u * 0.7 + lat * 1.3) * 0.5 + 0.15 * r());
      flankPoint(v, theta, rFront - u, 0, q).addScaledVector(tan, lat);
      q.y = v.heightAt(q.x - VOLC.x, q.z - VOLC.z) + thick - 0.05;
      p.setXYZ(i, q.x - this.base.x, q.y - this.base.y, q.z - this.base.z);
    }
    g.computeVertexNormals();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSun: { value: SUN_AM.clone() }, uSunCol: { value: new THREE.Color(0xfff0dc) }, uAmb: { value: new THREE.Color(0x6f7c8f) },
        uFog: { value: new THREE.Color(0xd3e2f0) }, uFogD: { value: 0.00004 } },
      vertexShader: /* glsl */ `varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform float uTime, uFogD; uniform vec3 uSun, uSunCol, uAmb, uFog; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
        ${GLSL_NOISE}${GLSL_FOG}
        void main(){
          vec2 p = vW.xz * 0.9;
          float n = fbm(p * 0.6), cr = abs(vnoise(p * 1.7 + n * 1.5) - 0.5) + abs(vnoise(p * 3.9 - n) - 0.5) * 0.6;
          float crack = smoothstep(0.035, 0.0, cr) * (0.55 + 0.45 * sin(uTime * 1.3 + n * 12.0)) * smoothstep(0.35, 0.65, fbm(p * 0.25));
          float frontGlow = smoothstep(0.025, 0.0, vUv.x) * (0.5 + 0.5 * n) * smoothstep(0.4, 0.7, fbm(p * 0.6 + 3.0));
          vec3 N = normalize(vN);
          vec3 crust = vec3(0.075, 0.068, 0.064) * (0.6 + 0.8 * n);
          vec3 col = crust * (uAmb * 0.6 + uSunCol * max(dot(N, normalize(uSun)), 0.0) * 1.2);
          vec3 hot = mix(vec3(1.0, 0.24, 0.04), vec3(1.0, 0.62, 0.2), crack);
          col += hot * (crack * 1.1 + frontGlow * 0.9);
          col = fogMix(col, uFog, uFogD, length(vW - cameraPosition));
          gl_FragColor = vec4(col, 1.0); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.position.copy(this.base);
    const n = flankPoint(v, theta, rFront + 10).sub(this.base); this.down.copy(n).multiplyScalar(0.1);   // one metre downhill
  }
  advance(m: number) { this.mesh.position.copy(this.base).addScaledVector(this.down, m); }
}

/** A short contour road on the flank, draped on the terrain. */
function flankRoad(v: Volcano, th0: number, th1: number, R: number, width = 7.5) {
  const n = 420, pos: number[] = [], uvs: number[] = [], idx: number[] = [], q = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const th = th0 + (th1 - th0) * i / n;
    for (const s of [-1, 1]) { flankPoint(v, th, R + s * width / 2, 0.06, q); pos.push(q.x, q.y, q.z); uvs.push(s < 0 ? 0 : 1, i * R * Math.abs(th1 - th0) / n / 6); }
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d')!;
  x.fillStyle = '#4b4b4c'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d8d2bd'; x.fillRect(30, 0, 4, 34);
  const tex = new THREE.CanvasTexture(c); tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })); m.receiveShadow = true;
  return m;
}

export class VolcanoCityStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 90000);
  private city = new CityStreetClassic({ seed: 811, blocks: 7, storeysMin: 4, storeysMax: 7, wetness: 0, farFieldRadius: 240, vehicles: true });
  private rig: SunSkylightRig;
  readonly volcano: Volcano;
  private column: EruptionColumn; private flow: PyroclasticFlow;
  private bolts: THREE.LineSegments; private boltMat: THREE.LineBasicMaterial;
  private lobe: LavaLobe; private lavaSmoke: SmokeWisp[] = [];
  private steamPlume: SmokeWisp;
  private ash: Snowfall; private ashLayer: THREE.Mesh; private ashMat: THREE.MeshStandardMaterial;
  private people: Record<string, Person> = {};
  private flankCar: CarRig; private streetCars: CarRig[] = [];
  private umbrella = new THREE.Group(); private broom = new THREE.Group();
  private groundMat: THREE.MeshStandardMaterial;
  private murk: THREE.Mesh;

  constructor(renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3f78c9, horizonColor: 0xaecbe6, hazeColor: 0xcfdbe6, groundColor: 0x6f6a5c,
      hazeAmount: 0.3, sunGlow: 0.35, discRadiance: 14, glareStrength: 1.0, glareAngularRadius: 0.06, shadowMapSize: 4096, discDistance: 60000 });
    this.scene.add(this.city.group);
    // Open the view down the street: drop far-field blocks that would hide the volcano.
    this.city.far.traverse(o => {
      if (!(o instanceof THREE.InstancedMesh)) return;
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); m.decompose(p, q, s);
        const along = 18 - p.z, axisX = -9 + along * (VOLC.x + 9) / (18 - VOLC.z);
        if (p.z < -95 && Math.abs(p.x - axisX) < along * 0.42 + 35) o.setMatrixAt(i, zero);
      }
      o.instanceMatrix.needsUpdate = true;
    });
    // Plain around the city and the volcano's terrain tile (seamless at y = 0 with groundRelief 0).
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x4a4f36, roughness: 0.95 });
    const vx0 = VOLC.x - VOLC.radius * 1.5, vx1 = VOLC.x + VOLC.radius * 1.5, vz0 = VOLC.z - VOLC.radius * 1.5, vz1 = VOLC.z + VOLC.radius * 1.5, F = 70000;
    for (const [x0, x1, z0, z1] of [[-F, F, vz1, F], [-F, vx0, -F, vz1], [vx1, F, -F, vz1], [vx0, vx1, -F, vz0]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), this.groundMat);
      m.position.set((x0 + x1) / 2, -0.25, (z0 + z1) / 2); m.receiveShadow = true; this.scene.add(m);
    }
    this.volcano = new Volcano({ height: VOLC.height, radius: VOLC.radius, crater: VOLC.crater, seed: VOLC.seed, segments: 420, groundRelief: VOLC.relief,
      rockColor: 0x5a534a, plumeColor: 0x4a443e, sunDirection: SUN_AM, sunColor: 0xfff0dc, ambient: 0x7d8899, fogColor: 0xcfdbe6, fogDensity: 0.00004,
      ejecta: 1600, puffs: 1, channels: [[1.45, 4100], [1.98, 3600], [2.5, 5200], [0.9, 3800], [3.4, 4600], [4.6, 3000], [5.6, 4400], [1.2, 2600]] });
    this.volcano.group.position.set(VOLC.x, 0, VOLC.z);
    this.volcano.group.children[2].visible = false;      // the column below replaces the cone's small built-in plume
    this.scene.add(this.volcano.group);

    this.column = new EruptionColumn({ vent: new THREE.Vector3(VOLC.x, VENT_Y, VOLC.z), top: 21000, neutral: 15500, ventRadius: 320, wind: [0.1, 0.07], columnPuffs: 1100, umbrellaPuffs: 460, seed: 5, spread: 0.26, puffScale: 1.15,
      ashColor: 0x4a423a, ambient: 0x8792a0, sunColor: 0xfff0dc, hazeColor: 0xcfdbe6, hazeDensity: 0.00004 });
    this.scene.add(this.column.puffs.mesh);
    this.flow = new PyroclasticFlow({ path: flowPath(this.volcano), puffs: 700, seed: 9, width: [160, 520], liftOff: 700, ashColor: 0x8a8076, ambient: 0x8792a0, hazeColor: 0xcfdbe6, hazeDensity: 0.00004 });
    this.scene.add(this.flow.puffs.mesh);

    // Lightning inside the column: a few jagged bolts, shown only during flashes.
    const r = rng(404), seg: number[] = [];
    for (let b = 0; b < 4; b++) {
      let x = VOLC.x + (r() - 0.5) * 600, y = VENT_Y + 1200 + r() * 2000, z = VOLC.z + (r() - 0.5) * 400;
      for (let k = 0; k < 9; k++) { const nx = x + (r() - 0.5) * 420, ny = y - 180 - r() * 260, nz = z + (r() - 0.5) * 200; seg.push(x, y, z, nx, ny, nz); x = nx; y = ny; z = nz; }
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    this.boltMat = new THREE.LineBasicMaterial({ color: new THREE.Color(3, 3.2, 4), transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.bolts = new THREE.LineSegments(bg, this.boltMat); this.bolts.renderOrder = 8; this.scene.add(this.bolts);

    // Flank road, the lava lobe crossing it, and a car escaping along it.
    this.scene.add(flankRoad(this.volcano, 1.45, 2.05, FLANK.roadR));
    this.lobe = new LavaLobe(this.volcano, 1.75, FLANK.roadR - 5); this.scene.add(this.lobe.mesh);
    for (let i = 0; i < 3; i++) {
      const w = new SmokeWisp({ height: 7, baseWidth: 1.6, topWidth: 4, curl: 1.2, riseSpeed: 0.8, color: 0x8b8580, seed: 70 + i, opacity: 0.35 });
      w.mesh.position.copy(flankPoint(this.volcano, 1.75 + (i - 1) * 0.0006, FLANK.roadR - 14 - i * 9, 0.6)); this.scene.add(w.mesh); this.lavaSmoke.push(w);
    }
    this.flankCar = carRig(this.scene, 0x9a2b24);
    // A thin steam plume from the quiet crater (later scenes).
    this.steamPlume = new SmokeWisp({ height: 2600, baseWidth: 260, topWidth: 1400, curl: 300, riseSpeed: 25, color: 0xe8ecef, seed: 3, opacity: 0.45 });
    this.steamPlume.mesh.position.set(VOLC.x, VENT_Y - 40, VOLC.z); this.scene.add(this.steamPlume.mesh);

    // Ash: falling grains around the camera and a grey film over the street.
    this.ash = new Snowfall({ count: 5000, seed: 21, box: [40, 22, 40], fallSpeed: 0.9, drift: 0.5, size: 22, minPx: 1.2, maxPx: 4, color: 0x8d877f, brightness: 0.55, additive: false, glint: 0 });
    this.scene.add(this.ash.points);
    this.ashMat = new THREE.MeshStandardMaterial({ color: 0x8e8a84, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
    this.ashLayer = solid(this.scene, new THREE.PlaneGeometry(40, 182).rotateX(-Math.PI / 2), this.ashMat, [0, 0.16, -20]); this.ashLayer.renderOrder = 1;

    // People: you, neighbours, a man on the flank road.
    const P = (k: string, o: ConstructorParameters<typeof Person>[1]) => (this.people[k] = new Person(this.scene, o));
    P('you', { height: 1.74, coat: 0x2f4a3a, trousers: 0x2b3442, skin: 0xc49573, hair: 0x2a1f18 });
    P('n1', { height: 1.68, coat: 0x8a3b2e, trousers: 0x2a2a30, skin: 0x8d5524 });
    P('n2', { height: 1.81, coat: 0x4b5563, trousers: 0x1f2937, skin: 0xe0ac69, hair: 0x5a4632 });
    P('n3', { height: 1.62, coat: 0xd4a83a, trousers: 0x30343c, skin: 0xd8a27c });
    P('walker', { height: 1.77, coat: 0x6b7280, trousers: 0x3a3f4a, skin: 0xb07a55 });
    for (const [i, c] of [0x2b3a55, 0x7a7d80].entries()) { const car = carRig(this.scene, c); this.streetCars.push(car); car.g.visible = false; void i; }
    // Umbrella and broom props (placed in world space each frame; hands reach for them).
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.32, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d2a3a, roughness: 0.6, side: THREE.DoubleSide }));
    canopy.position.y = 0.86; canopy.castShadow = true; this.umbrella.add(canopy);
    rod(this.umbrella, [0, 0, 0], [0, 1.0, 0], 0.012, surface(0x222222, 0.4, 0.5));
    this.scene.add(this.umbrella);
    rod(this.broom, [0, 0.05, 0], [0, 1.25, 0], 0.016, surface(0x8a6a42, 0.7));
    const head = solid(this.broom, new THREE.BoxGeometry(0.42, 0.07, 0.07), surface(0x2b2b2b, 0.8), [0, 0.05, 0]); head.castShadow = true;
    this.scene.add(this.broom);
    // Brown murk around the camera during the ash fall hides everything beyond ~200 m.
    this.murk = new THREE.Mesh(new THREE.SphereGeometry(230, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ float h = clamp(vD.y, -0.2, 1.0); gl_FragColor = vec4(mix(vec3(0.115, 0.102, 0.088), vec3(0.06, 0.054, 0.048), smoothstep(0.0, 0.6, h)), 1.0); }' }));
    this.scene.add(this.murk);
  }

  update(t: number, shot: ShotInfo) {
    const era = eraOf(shot.sceneId), key = shot.key;
    const flank = era === 'flank', dark = era === 'ashfall', later = era === 'day3' || era === 'nextSummer';
    const sun = later ? SUN_LATER : SUN_AM;
    const camPos = this.camera.getWorldPosition(new THREE.Vector3());
    // ---- light and air
    const haze = later ? 0xd8dcde : 0xcfdbe6, morning = era === 'morning';
    this.rig.apply(this.scene, this.camera, { sunDirection: sun, sunIntensity: dark ? 0.25 : later ? 4.2 : 7.5, sunColor: later ? 0xfff6ea : 0xfff0dc,
      skyAmount: dark ? 0.14 : later ? 0.82 : 1, groundAmount: dark ? 0.2 : 1, envIntensity: dark ? 0.35 : 1,
      hazeDensity: dark ? 0.0006 : era === 'nextSummer' ? 0.000038 : later ? 0.00006 : morning ? 0.000058 : 0.00004,
      focus: flank ? camPos.clone().setY(camPos.y - 1) : new THREE.Vector3(-6, 1, 4), shadowHalfWidth: flank ? 70 : 40, shadowHalfHeight: flank ? 70 : 40, shadowDepth: 400 });
    if (dark) { const f = this.scene.fog as THREE.FogExp2; f.color.set(0x2a2622); f.density = 0.012; }
    this.murk.visible = dark; this.murk.position.copy(camPos);
    const fogCol = dark ? new THREE.Color(0x37322d) : new THREE.Color(haze), fogD = dark ? 0.018 : era === 'nextSummer' ? 0.000038 : later ? 0.00006 : morning ? 0.000058 : 0.00004;
    const vu = (this.volcano as any).rockMat.uniforms;
    vu.uFog.value.copy(fogCol); vu.uFogD.value = fogD; vu.uSun.value.copy(sun);
    vu.uRock.value.set(era === 'nextSummer' || era === 'day3' ? 0x5c5852 : 0x37332b);
    vu.uSunCol.value.set(later ? 0xd9d6cf : 0xfff0dc).multiplyScalar(2.3); vu.uAmb.value.set(0x7d8899).multiplyScalar(1.5);
    this.groundMat.color.set(later ? 0x5a5a4c : 0x4a4f36);
    // ---- the eruption
    const lava = era === 'morning' || flank ? 1 : 0;
    this.volcano.eruption = lava; this.volcano.lavaGlow = era === 'nextSummer' ? 0 : era === 'day3' ? 0.15 : morning ? 0.12 : 0.6;
    this.volcano.update(t);
    const colState = era === 'morning' ? { amount: 1, height: T.columnGrow[0] + (T.columnGrow[1] - T.columnGrow[0]) * windowAt(t, 0, T.bounds[1]), umbrella: 0, glow: 1 }
      : flank ? { amount: 1, height: 0.86, umbrella: 9000, glow: 1 } : dark ? { amount: 1, height: 1, umbrella: 26000, glow: 1 } : { amount: 0 };
    const look = { sun, ambient: dark ? 0x3a3631 : 0x7d8796, haze: fogCol.getHex(), hazeDensity: fogD, light: dark ? 0.15 : 1 };
    this.column.puffs.setLook({ ...look, hazeDensity: morning ? 0.000028 : fogD }); this.flow.puffs.setLook(look);
    this.column.puffs.mesh.visible = colState.amount > 0;
    if (colState.amount > 0) this.column.update(t + 300, this.camera, colState);
    const fl = era === 'morning' ? flashAt(t) : 0;
    this.boltMat.opacity = fl; this.bolts.visible = fl > 0.01;
    this.flow.puffs.mesh.visible = flank;
    if (flank) this.flow.update(t, this.camera, { front: pdcFront(t), amount: 1, glow: 0.1 });
    this.steamPlume.update(t, later ? 400 + t : 0, later ? 0.45 : 0, this.camera);
    // ---- flank road: lava lobe, its fumes, the escaping car
    this.lobe.mesh.visible = flank; this.lobe.mat.uniforms.uTime.value = t; this.lobe.advance(flank ? lavaAdvance(t) : 0);
    this.lobe.mat.uniforms.uSun.value.copy(sun); this.lobe.mat.uniforms.uFog.value.copy(fogCol); this.lobe.mat.uniforms.uFogD.value = fogD;
    this.lavaSmoke.forEach((w, i) => w.update(t + i * 2, flank ? 30 + t : 0, flank ? 0.35 : 0, this.camera));
    this.flankCar.g.visible = flank && key === 'S03/SH02';
    if (this.flankCar.g.visible) {
      const th = this.carTheta(t), p = flankPoint(this.volcano, th, FLANK.roadR + 1.9, 0.02), dir = new THREE.Vector3(Math.sin(th), 0, -Math.cos(th));
      this.flankCar.g.position.copy(p); this.flankCar.g.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0); setCarLights(this.flankCar, 1, 'run');
    }
    // ---- ash fall and ash on the ground
    this.ash.points.visible = dark; this.ash.amount = dark ? 1 : 0; this.ash.update(t); this.ash.points.position.set(camPos.x, 0, camPos.z - 12);
    this.ashMat.opacity = dark ? 0.35 : era === 'day3' ? 0.85 : era === 'nextSummer' ? 0.12 : 0;
    this.ashLayer.visible = this.ashMat.opacity > 0;
    this.city.update(t, { lights: dark ? 1 : 0, wetness: 0 });
    // ---- people
    for (const p of Object.values(this.people)) p.h.root.visible = false;
    this.umbrella.visible = false; this.broom.visible = false;
    for (const c of this.streetCars) c.g.visible = false;
    if (era === 'morning') this.neighboursS01(t);
    if (flank && key === 'S03/SH01') this.walkerS03(t);
    if (dark) this.youUnderAsh(t);
    if (era === 'day3') this.youSweeping(t);
    if (era === 'nextSummer') this.nextSummer(t);
  }

  /** Car azimuth on the flank road: it crosses the S03/SH02 camera's line of sight at T.carCross, at 20 m/s. */
  private carTheta(t: number) {
    const cam = flankPoint(this.volcano, FLANK.theta, FLANK.r);
    const look = flankPoint(this.volcano, FLANK.flowTheta - 0.06, 4300);
    const dir = look.clone().sub(cam).setY(0).normalize();
    let best = FLANK.theta, bd = 1e9;
    for (let th = FLANK.theta - 0.05; th < FLANK.theta + 0.15; th += 0.0005) {
      const p = flankPoint(this.volcano, th, FLANK.roadR).sub(cam).setY(0), d = Math.abs(p.x * dir.z - p.z * dir.x);
      if (p.dot(dir) > 0 && d < bd) { bd = d; best = th; }
    }
    return best - (20 / FLANK.roadR) * (t - T.carCross);
  }

  private neighboursS01(t: number) {
    const b = T.blast, flinch = windowAt(t, b, b + 0.35) * (1 - windowAt(t, b + 1.2, b + 2));
    const duck: Partial<HumanoidPose> = { shrug: 0.8, headPitch: 0.35, lean: 0.12, armL: [-0.9, 0.2, 2.0], armR: [-0.9, 0.2, 2.0] };
    const walkers: [string, number, number, number][] = [['n1', -10.7, -9, 1.25], ['n2', -7.7, -15, 1.35], ['n3', 8.6, -6, 1.2]];
    for (const [k, x, z0, v] of walkers) this.people[k].walk(t, { start: [x, z0], heading: 0, t0: 0, speed: [[0, v], [b, v], [b + 0.4, 0.6], [b + 1.3, 1.9]] }, { pose: duck, w: flinch });
    // One neighbour stops to look back at the mountain before hurrying on.
    const look = windowAt(t, 0.3, 0.8) * (1 - windowAt(t, b, b + 0.5));
    this.people.n2.h.head.rotation.y += 1.1 * look;
  }

  private walkerS03(t: number) {
    const th = 1.75 - 2 / FLANK.roadR, start = flankPoint(this.volcano, th, FLANK.roadR - 1);
    const along = new THREE.Vector3(Math.sin(th), 0, -Math.cos(th));      // toward decreasing theta (toward the camera)
    const ground = start.y;
    this.people.walker.walk(t, { start: [start.x, start.z], heading: Math.atan2(along.x, along.z), t0: T.bounds[2], speed: [[0, 1.3]], ground });
  }

  private youUnderAsh(t: number) {
    const you = this.people.you, heading = 0.06;
    you.walk(t, { start: [-8.1, -2.2], heading, t0: T.bounds[3], speed: [[0, 1.1]] },
      { pose: { armR: [-0.55, 0.1, 1.45], armL: [-0.9, -0.15, 2.2], headPitch: 0.18, shrug: 0.35 }, w: 1 });
    // Umbrella held overhead; right hand on the shaft, left hand holding a scarf to the mouth.
    you.h.root.updateMatrixWorld(true);
    const root = you.h.root, grip = new THREE.Vector3(0.12, 1.22, 0.2).applyMatrix4(root.matrixWorld);
    this.umbrella.visible = true; this.umbrella.position.copy(grip).add(new THREE.Vector3(0, -0.05, 0)); this.umbrella.rotation.set(0.12, 0, -0.06);
    you.h.reachArm('R', grip, new THREE.Vector3(1, -0.5, 0).applyQuaternion(root.quaternion), 1);
    you.h.reachArm('L', new THREE.Vector3(0.02, 1.55, 0.12).applyMatrix4(root.matrixWorld), new THREE.Vector3(-1, -0.6, 0).applyQuaternion(root.quaternion), 1);
    // Traffic with lights on in the gloom.
    const [a, b2] = this.streetCars;
    a.g.visible = true; a.g.position.set(3.4, 0, -40 + 6 * (t - T.bounds[3])); a.g.rotation.set(0, Math.PI, 0); setCarLights(a, 1, 'run');
    b2.g.visible = true; b2.g.position.set(-3.4, 0, 6 - 5 * (t - T.bounds[3])); b2.g.rotation.set(0, 0, 0); setCarLights(b2, 1, 'brake');
  }

  private youSweeping(t: number) {
    const you = this.people.you, heading = Math.PI / 2 + 0.25, at: [number, number] = [-8.3, 0.3];
    const ph = (t - T.bounds[4]) * 2 * Math.PI / 1.4, sweep = Math.sin(ph);
    you.stand(at, heading, { lean: 0.45, hipsY: 0.84, legL: [0.15, 0.25], legR: [-0.08, 0.2], twist: -0.18 * sweep, headPitch: 0.35, headYaw: 0.1 * sweep });
    const root = you.h.root; root.updateMatrixWorld(true);
    const headPos = new THREE.Vector3(0.18 + 0.32 * sweep, SIDEWALK_Y, 0.62).applyMatrix4(root.matrixWorld).setY(SIDEWALK_Y + 0.0);
    const topPos = new THREE.Vector3(-0.12 + 0.06 * sweep, 1.08, 0.12).applyMatrix4(root.matrixWorld);
    this.broom.visible = true;
    const axis = topPos.clone().sub(headPos), len = axis.length();
    this.broom.position.copy(headPos); this.broom.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    this.broom.scale.set(1, len / 1.25, 1);
    const along = (k: number) => headPos.clone().lerp(topPos, k);
    you.h.reachArm('L', along(0.97), new THREE.Vector3(-1, 0, 0).applyQuaternion(root.quaternion), 1);
    you.h.reachArm('R', along(0.62), new THREE.Vector3(1, -0.3, 0).applyQuaternion(root.quaternion), 1);
  }

  private nextSummer(t: number) {
    const t0 = T.bounds[8];
    this.people.you.walk(t, { start: [-8.0, -4.5], heading: 0.02, t0, speed: [[0, 1.25]] }, { pose: { headPitch: -0.25 * windowAt(t, t0 + 2.2, t0 + 3) * (1 - windowAt(t, t0 + 4.2, t0 + 5)) }, w: 1 });
    this.people.n1.walk(t, { start: [-10.6, -12], heading: 0, t0, speed: [[0, 1.2]] });
    this.people.n3.walk(t, { start: [8.4, -3], heading: Math.PI, t0, speed: [[0, 1.15]] });
  }
}
