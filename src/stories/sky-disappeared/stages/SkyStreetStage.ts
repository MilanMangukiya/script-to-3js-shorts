import * as THREE from 'three';
import { CityStreetClassic, makeClassicCityCar } from '../../../library/environment/CityStreetClassic';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Starfield } from '../../../library/space/Starfield';
import { Humanoid, POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { applyGroundedPose } from '../../../library/characters/CharacterMotion';
import { box, solid, surface } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, DEG, windowAt, skyAmountAt, sunsetAltitude, sunriseAltitude, carState } from '../timeline';

// World: street along Z (-Z = west, toward the sea), south-side buildings at -X (their north faces are in shade at
// noon), sunlit north-side facades at +X. The noon sun is 60 degrees high, slightly west of south.
const SUN_NOON = new THREE.Vector3(-0.49, 0.866, -0.1).normalize();
const SIDEWALK_Y = 0.1;

/** Speed keyframes [t, v] (m/s), linear between keys and held outside; returns distance travelled since t0. */
function distanceAt(t: number, t0: number, keys: [number, number][]): number {
  const speed = (x: number) => {
    if (x <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [a, va] = keys[i], [b, vb] = keys[i + 1];
      if (x <= b) return va + (vb - va) * (x - a) / (b - a);
    }
    return keys[keys.length - 1][1];
  };
  // Exact for piecewise-linear speed: integrate between breakpoints with the trapezoid rule.
  const pts = [t0, ...keys.map(k => k[0]).filter(k => k > Math.min(t0, t) && k < Math.max(t0, t)), t].sort((a, b) => a - b);
  let d = 0;
  for (let i = 0; i < pts.length - 1; i++) d += (speed(pts[i]) + speed(pts[i + 1])) * 0.5 * (pts[i + 1] - pts[i]);
  return t >= t0 ? d : -d;
}
function gaitPose(phase: number, amount: number): HumanoidPose {
  const s = Math.sin(phase) * amount;
  return { ...POSE_STAND, legL: [s, .06 + Math.max(0, -s) * .65], legR: [-s, .06 + Math.max(0, s) * .65],
    armL: [-s * .5, .08, .16], armR: [s * .5, .08, .16], breath: Math.sin(phase * .5) * .12 };
}
const LOOK_UP: Partial<HumanoidPose> = { headPitch: -.62, lean: -.07, armL: [.02, .1, .2], armR: [.02, .1, .2] };

interface WalkPlan { start: [number, number]; heading: number; t0: number; speed: [number, number][]; ground?: number; step?: number }
class Person {
  readonly h: Humanoid;
  constructor(parent: THREE.Object3D, o: { height: number; coat: number; trousers: number; skin: number; hair?: number; hat?: boolean }) {
    this.h = new Humanoid({ height: o.height, coat: 'jacket', coatColor: o.coat, trouserColor: o.trousers, skinColor: o.skin, hairColor: o.hair ?? 0x241a14, hat: o.hat, scarfColor: null });
    parent.add(this.h.root);
    this.h.root.visible = false;
  }
  /** Walk along a straight path with gait driven by distance; `act` blends an acting pose in by weight. */
  walk(t: number, p: WalkPlan, act?: { pose: Partial<HumanoidPose>; w: number }) {
    const d = distanceAt(t, p.t0, p.speed), v = Math.abs(distanceAt(t + .02, p.t0, p.speed) - distanceAt(t - .02, p.t0, p.speed)) / .04;
    const step = (p.step ?? .69) * this.h.root.scale.y;
    const gait = gaitPose(Math.PI * d / step, .4 * Math.min(1, v / .9));
    const pose = act && act.w > 0 ? lerpPose(gait, { ...gait, ...act.pose }, act.w) : gait;
    this.h.root.visible = true;
    this.h.root.position.set(p.start[0] + Math.sin(p.heading) * d, 0, p.start[1] + Math.cos(p.heading) * d);
    this.h.root.rotation.set(0, p.heading, 0);
    applyGroundedPose(this.h, pose, p.ground ?? 0);
  }
  stand(at: [number, number], heading: number, pose: HumanoidPose, ground = SIDEWALK_Y) {
    this.h.root.visible = true;
    this.h.root.position.set(at[0], 0, at[1]);
    this.h.root.rotation.set(0, heading, 0);
    applyGroundedPose(this.h, pose, ground);
  }
}

interface CarRig { g: THREE.Group; head: THREE.MeshBasicMaterial[]; tail: THREE.MeshBasicMaterial[] }
function carRig(parent: THREE.Object3D, color: number): CarRig {
  const g = makeClassicCityCar(color), head: THREE.MeshBasicMaterial[] = [], tail: THREE.MeshBasicMaterial[] = [];
  g.traverse(o => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) {
      const c = o.material.color; (c.r > 2 ? head : c.g < .2 && c.r > 1 ? tail : []).push(o.material);
    }
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  parent.add(g); g.visible = false;
  return { g, head, tail };
}
function setCarLights(c: CarRig, head: number, tail: 'off' | 'run' | 'brake') {
  for (const m of c.head) m.color.setRGB(.1 + 2.3 * head, .1 + 2.4 * head, .1 + 2.3 * head);
  const k = tail === 'brake' ? [3.4, .16, .08] : tail === 'run' ? [.9, .05, .03] : [.12, .02, .02];
  for (const m of c.tail) m.color.setRGB(k[0], k[1], k[2]);
}

export class SkyStreetStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, .05, 15000);
  private city = new CityStreetClassic({ seed: 1102, blocks: 7, storeysMin: 5, storeysMax: 8, wetness: .15, farFieldRadius: 900, vehicles: false });
  private rig: SunSkylightRig;
  private stars = new Starfield({ seed: 31, count: 3200, radius: 400, maxSize: 4.2, minY: .006 });
  private ocean = new OceanSurface({ size: 6000, level: -1.2, deepColor: 0x0b2836, horizonColor: 0x000000, zenithColor: 0x000000, waveHeight: .45, glitter: 1, fogDensity: 0 });
  private windowMats: THREE.MeshStandardMaterial[] = [];
  private promenadeLamps: THREE.MeshStandardMaterial[] = [];
  private lampOrder: number[] = [];
  private people: Record<string, Person> = {};
  private cars: Record<string, CarRig> = {};
  private pov = new THREE.Group();
  private phone: THREE.Mesh;
  private road: THREE.MeshPhysicalMaterial;
  private paving: THREE.MeshStandardMaterial[] = [];
  /** World anchor for the S05 sighting callout (updated with the pedestrian). */
  readonly youChest = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3f78c9, horizonColor: 0xa9c9ea, hazeColor: 0xd3e2f0,
      groundColor: 0x8a8278, hazeAmount: .25, sunGlow: .35, discRadiance: 14, glareStrength: 1.3, shadowMapSize: 4096 });
    this.scene.add(this.city.group, this.stars.points, this.ocean.mesh, this.pov);
    this.ocean.mesh.position.z = -130 - 3000;
    this.clearFarField();
    this.city.group.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.emissiveMap && !this.windowMats.includes(o.material)) this.windowMats.push(o.material);
    });
    for (const m of this.windowMats) m.userData.baseEmission ??= m.emissiveIntensity;
    // Block ends (seen at alleys and at the east end) in pale stone rather than near-black brick, so low sun reads on them.
    this.city.near.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && !o.material.map && o.material.color.getHex() === 0x414954) o.material.color.set(0x9a9286); });
    const r = rng(4410);
    this.lampOrder = this.city.lampHeads.map((_, i) => i).sort(() => r() - .5);
    this.buildWaterfront();
    this.buildEasternHills();
    this.road = (this.city as any).road;
    this.city.near.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.map && o.material.color.getHex() === 0x727982 && !this.paving.includes(o.material)) this.paving.push(o.material);
    });
    (this.ocean.uniforms.uGlitter as THREE.IUniform).value = .3;

    const P = (k: string, o: ConstructorParameters<typeof Person>[1]) => (this.people[k] = new Person(this.scene, o));
    P('you', { height: 1.74, coat: 0x8a3b32, trousers: 0x23272e, skin: 0xb98563 });
    P('neighbour', { height: 1.68, coat: 0xb88a2e, trousers: 0x3a3f4a, skin: 0x8d5a3f, hair: 0x1b1410 });
    P('crosser', { height: 1.78, coat: 0xd9dcd6, trousers: 0x2b3442, skin: 0xd6ad8a });
    P('waiting', { height: 1.66, coat: 0x4c6b7d, trousers: 0x2a2a2e, skin: 0x6f4630 });
    const palette = [[0x334155, 0xc68642], [0x7c2d12, 0xf1c27d], [0x3f6212, 0x8d5524], [0x581c87, 0xe0ac69], [0x1e3a8a, 0xffdbac], [0x5b5f66, 0xc68642]];
    for (let i = 0; i < 6; i++) P(`w${i}`, { height: 1.62 + (i % 4) * .05, coat: palette[i][0], trousers: 0x1f2937, skin: palette[i][1], hat: i === 3 });
    // A lit phone for the stranger waiting in the shade.
    const phoneGroup = new THREE.Group(); this.people.waiting.h.handR.add(phoneGroup);
    box(phoneGroup, [.075, .14, .012], surface(0x1b2228, .3), [0, -.02, .03]);
    this.phone = solid(phoneGroup, new THREE.PlaneGeometry(.062, .12), new THREE.MeshBasicMaterial({ color: new THREE.Color(.55, .75, .95) }), [0, -.02, .037]);

    const C = (k: string, color: number) => (this.cars[k] = carRig(this.scene, color));
    C('a', 0x6c7a80); C('oncoming', 0x2f3b4d); C('eve', 0x5d4a3f);
    for (const [k, color, x, z, rot] of [['p1', 0x45555b, -5.6, -20, Math.PI], ['p2', 0x718487, 5.6, -30, 0], ['p3', 0x694c41, 5.6, 18, 0], ['p4', 0x202c3b, -5.6, 26, Math.PI], ['p5', 0x8a8f93, 5.6, -52, 0]] as const) {
      const c = C(k, color); c.g.position.set(x, 0, z); c.g.rotation.y = rot; c.g.visible = true; setCarLights(c, 0, 'off');
    }
    this.cars.pov = carRig(this.pov, 0x7d868c);
    this.cars.pov.g.visible = true;
    // Driver cues inside the portrait frame: bonnet beyond a low dash, the top of the wheel and the mirror.
    this.cars.pov.g.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshPhysicalMaterial) { o.material.metalness = .2; o.material.roughness = .38; } });
    const dash = surface(0x2a2f35, .7), trim = surface(0x1b1f23, .5);
    box(this.pov, [1.62, .1, .55], dash, [0, .9, -.98]);
    box(this.pov, [.46, .05, .3], trim, [-.4, .96, -.8]);
    const wheel = solid(this.pov, new THREE.TorusGeometry(.19, .024, 10, 28), trim, [-.4, 1.0, -.52]); wheel.rotation.x = -1.05;
    box(this.pov, [.24, .07, .025], surface(0x0f1215, .4), [-.28, 1.37, -.92]);
    box(this.pov, [.02, .1, .02], trim, [-.28, 1.44, -.92]);
  }

  private clearFarField() {
    const inst = this.city.far.children[0] as THREE.InstancedMesh, m = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m); p.setFromMatrixPosition(m);
      // West: open sea beyond the seawall. East: open corridor to the dawn horizon.
      if (p.z < -110 || (p.z > 0 && Math.abs(p.x) < 90)) inst.setMatrixAt(i, zero);
    }
    inst.instanceMatrix.needsUpdate = true;
    const plane = this.city.far.children[1] as THREE.Mesh, mat = plane.material as THREE.MeshStandardMaterial, size = (plane.geometry as THREE.PlaneGeometry).parameters;
    // Keep the street-grid ground east of the seawall only (z from -130 to 950), so the sea is not covered.
    plane.geometry.dispose(); plane.geometry = new THREE.PlaneGeometry(size.width, 1080);
    plane.position.z = -130 + 540;
    if (mat.map) mat.map.repeat.y *= 1080 / size.height;
  }

  private buildWaterfront() {
    const g = new THREE.Group(); this.scene.add(g);
    const stone = surface(0x777b80, .82), dark = surface(0x22282e, .45, .5), paving = surface(0x6f747b, .72);
    box(g, [160, 1.7, 9], stone, [0, -.75, -131.5]);
    for (const x of [-46, 46]) box(g, [68, .2, 58.6], paving, [x, -.01, -97.7]);
    for (let x = -40; x <= 40; x += 1.8) box(g, [.06, 1.0, .06], dark, [x, .6, -135.6]);
    box(g, [80, .06, .08], dark, [0, 1.1, -135.6]); box(g, [80, .04, .05], dark, [0, .62, -135.6]);
    for (const x of [-9, 9]) {
      box(g, [.12, 6, .12], dark, [x, 3, -131.5]);
      const head = new THREE.MeshStandardMaterial({ color: 0xe6d5b2, emissive: 0xffcf87, emissiveIntensity: 0, roughness: .3 });
      this.promenadeLamps.push(head);
      box(g, [.5, .1, .3], head, [x, 6, -131.5]);
    }
    g.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; });
  }

  /** Low hills 1.6 km east whose crest sits 0.9 degrees above street eye level on the street axis: the sunrise line. */
  private buildEasternHills() {
    const cols = 240, pos: number[] = [], idx: number[] = [], r = rng(7781);
    const bumps = Array.from({ length: 9 }, () => [(r() - .5) * 4000, 60 + r() * 220, 6 + r() * 16]);
    for (let i = 0; i <= cols; i++) {
      const x = -2500 + 5000 * i / cols, far = Math.min(1, Math.max(0, (Math.abs(x) - 90) / 300));
      const top = 27 + far * bumps.reduce((h, [c, w, a]) => h + a * Math.exp(-(((x - c) / w) ** 2)), 0);
      pos.push(x, -6, 1600, x, top, 1600);
      if (i < cols) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const hills = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a3328, roughness: 1, side: THREE.DoubleSide }));
    hills.frustumCulled = false; this.scene.add(hills);
  }

  /** Lamps on (1) or off (0) per fixture; `stagger` switches them in seeded order from `at`. */
  private lamps(t: number, on: boolean, at = -1e9, stagger = .14) {
    const k = this.lampOrder;
    this.city.lampHeads.forEach((m, i) => {
      const switched = t >= at + k.indexOf(i) * stagger;
      const lit = on ? switched : !switched;
      m.emissiveIntensity = lit ? 5 : 0;
    });
    const anyLit = this.city.lampHeads.map((m) => m.emissiveIntensity > 0);
    this.city.lamps.forEach((l, i) => { l.intensity = anyLit[i === 0 ? 3 : 10] ? 25 : 0; });
    for (const m of this.promenadeLamps) m.emissiveIntensity = (on ? t >= at : t < at) ? 5 : 0;
  }
  private windows(level: (i: number) => number) { this.windowMats.forEach((m, i) => { m.emissiveIntensity = m.userData.baseEmission * level(i); }); }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId, key = shot.key;
    const period = sc <= 'S06' ? 'noon' : sc <= 'S08' ? 'eve' : 'dawn';
    for (const p of Object.values(this.people)) p.h.root.visible = false;
    for (const k of ['a', 'oncoming', 'eve']) this.cars[k].g.visible = false;
    this.pov.visible = false;

    // ---- S05 driver POV: replace the declared linear keyframe z with the analytic braking profile (shake kept).
    if (sc === 'S05') {
      const k = shot.camera.keyframes, i = t < k[1].t_s ? 0 : 1, u = (t - k[i].t_s) / (k[i + 1].t_s - k[i].t_s);
      const declared = k[i].position[2] + (k[i + 1].position[2] - k[i].position[2]) * Math.min(1, Math.max(0, u));
      const car = carState(t);
      this.camera.position.z += car.z - declared;
      this.camera.updateMatrixWorld(true);
      this.pov.visible = true;
      this.pov.position.set(3.5, 0, car.z + .25);
      setCarLights(this.cars.pov, 1, t >= T.s05Brake ? 'brake' : 'run');
    }

    // ---- light: noon / evening / dawn
    let sunDir = SUN_NOON, sky = 0, horizon = 0, sunIntensity = 9.6, ground = 1, haze = .0035;
    let sunColor = new THREE.Color(0xffffff);
    let focus = new THREE.Vector3(0, 8, -15), half = 55, halfH = 55, depth = 220;
    if (period === 'noon') {
      sky = sc === 'S01' ? skyAmountAt(t) : 0;
      sunIntensity = 9 * (1 + .06 * (1 - sky));
      sunColor = new THREE.Color(0xfff1de).lerp(new THREE.Color(0xffffff), 1 - sky);
      if (key === 'S02/SH02' || key === 'S03/SH02') { focus = new THREE.Vector3(6, 4, -3); half = halfH = 20; depth = 120; }
      else if (sc === 'S03' || sc === 'S04' || sc === 'S06') { focus = new THREE.Vector3(-3, 5, 1); half = halfH = 30; depth = 140; }
      else if (sc === 'S05') { focus = new THREE.Vector3(0, 5, 22); half = halfH = 45; depth = 160; }
    } else {
      const alt = (period === 'eve' ? sunsetAltitude(t) : sunriseAltitude(t)) * DEG;
      sunDir = new THREE.Vector3(0, Math.sin(alt), (period === 'eve' ? -1 : 1) * Math.cos(alt)).normalize();
      horizon = (period === 'eve' ? T.seaHorizonDeg : T.dawnHorizonDeg) * DEG;
      sunIntensity = 9.6; haze = 0;
      ground = .22 * SunSkylightRig.discFraction(alt, horizon, T.sunRadiusDeg * DEG);
      focus = new THREE.Vector3(0, 6, this.camera.position.z + (period === 'eve' ? -70 : 70)); half = 32; halfH = 32; depth = 700;
    }
    this.rig.apply(this.scene, this.camera, { sunDirection: sunDir, sunIntensity, sunColor, horizon, skyAmount: sky, groundAmount: ground,
      envIntensity: 1, hazeDensity: haze, focus, shadowHalfWidth: half, shadowHalfHeight: halfH, shadowDepth: depth });
    const f = this.rig.discFractionNow;

    // ---- city practicals
    this.city.update(t, { wetness: .15, lights: 1 });
    // A low sun turns any sheen into glare; keep the evening and dawn street matte so the sun stays the subject.
    if (period !== 'noon') { this.road.roughness = .97; this.road.clearcoat = 0; this.road.metalness = .02; }
    this.road.specularIntensity = period === 'noon' ? 1 : .5;
    (this.ocean.uniforms.uGlitter as THREE.IUniform).value = period === 'noon' ? .3 : .06;
    for (const m of this.paving) m.roughness = period === 'noon' ? .62 : .97;
    if (period === 'noon') {
      this.lamps(t, false);
      // Rooms facing away from the sun go dark; people switch lights on in a staggered order after the event.
      this.windows(i => sc === 'S01' ? .22 + .5 * windowAt(t, T.drain1 + .3 + i * .17, T.drain1 + .5 + i * .17) : .72);
    } else if (period === 'eve') {
      this.lamps(t, true);
      this.windows(i => .7 + .4 * (t >= T.sunset + .15 + i * .12 ? 1 : 0));
    } else {
      this.lamps(t, false, T.sunrise + .4, .14);
      this.windows(() => .6);
    }

    // ---- sky extras
    const adapt = key === 'S06/SH02' ? windowAt(t, T.s06Cut, shot.end_s) : 0;
    this.stars.brightness = period === 'noon' ? (key === 'S06/SH02' ? .5 + 1.5 * adapt : .35) * (1 - sky) ** 2
      : period === 'eve' ? (t < T.sunset ? .8 : 1.3) : (t < T.sunrise ? 1.3 : .55);
    // As eyes adapt in deep shade, bright points read larger and stronger (perceptual, phone-legible).
    ((this.stars.points.material as THREE.ShaderMaterial).uniforms.uMaxSize as THREE.IUniform).value = 4.2 + 3.4 * adapt;
    this.stars.follow(this.camera);
    const ou = this.ocean.uniforms;
    (ou.uSunDir.value as THREE.Vector3).copy(sunDir);
    (ou.uSunColor.value as THREE.Color).setRGB(f, f, f);
    (ou.uZenith.value as THREE.Color).setHex(0x3f78c9).multiplyScalar(sky);
    (ou.uHorizon.value as THREE.Color).setHex(0xa9c9ea).multiplyScalar(sky);
    (ou.uDeep.value as THREE.Color).setHex(0x0b2836).multiplyScalar(period === 'noon' ? 1 : .04 + .4 * f);
    this.ocean.update(t);

    // ---- actors
    if (sc === 'S01') this.stageOpening(t);
    else if (key === 'S02/SH02' || key === 'S03/SH02') this.stageNeighbour(t, sc);
    else if (key === 'S03/SH01') this.stageCrosser(t);
    else if (sc === 'S04') this.stageWaiting(t);
    else if (sc === 'S05') this.stageNearMiss(t);
    else if (key === 'S06/SH01') this.stageRetreat(t);
    else if (sc === 'S07') this.stageEvening(t);
    else if (key === 'S08/SH02') this.stageDusk(t);
    else if (sc === 'S09') this.stageDawn(t, key);
  }

  private stageOpening(t: number) {
    const look = (a: number) => ({ pose: LOOK_UP, w: windowAt(t, T.drain1 + a, T.drain1 + a + .7) });
    const p = this.people;
    // In frame: one walker in the shade of your own sidewalk, two small sunlit walkers far down the north side.
    p.w1.walk(t, { start: [-8.0, -20], heading: 0, t0: 0, speed: [[0, 1.2], [T.drain1 + .1, 1.2], [T.drain1 + .8, 0]], ground: SIDEWALK_Y },
      { pose: { ...LOOK_UP, headYaw: .3, twist: .1 }, w: windowAt(t, T.drain1 + .25, T.drain1 + .95) });
    p.w0.walk(t, { start: [8.6, -48], heading: 0, t0: 0, speed: [[0, 1.25], [T.drain1, 1.25], [T.drain1 + .7, 0]], ground: SIDEWALK_Y }, look(.25));
    p.w3.walk(t, { start: [9.8, -52], heading: Math.PI, t0: 0, speed: [[0, 1.2], [T.drain1 + .3, 1.2], [T.drain1 + 1.0, .2]], ground: SIDEWALK_Y }, look(.6));
    const a = this.cars.a, d = distanceAt(t, 0, [[0, 9.5], [T.drain1 - .2, 9.5], [T.drain1 + .8, 4]]);
    a.g.visible = true; a.g.position.set(3.5, 0, 6 - d); a.g.rotation.y = 0;
    setCarLights(a, t > T.drain1 + .25 ? 1 : 0, t > T.drain1 - .2 && t < T.drain1 + 1.2 ? 'brake' : 'run');
  }

  private stageNeighbour(t: number, sc: string) {
    let pose: HumanoidPose;
    if (sc === 'S02') {
      const inhale = windowAt(t, T.breath0, (T.breath0 + T.breath1) / 2), exhale = windowAt(t, (T.breath0 + T.breath1) / 2, T.breath1);
      const b = inhale - exhale, down = windowAt(t, T.s02Cut, T.s02Cut + .45), upAgain = windowAt(t, T.breath1 + .2, T.breath1 + .9);
      pose = { ...POSE_STAND, breath: .9 * b + .1 * Math.sin(t * 1.6), shrug: .9 * b, headPitch: -.55 * (1 - down) - .12 * b - .5 * upAgain,
        headYaw: .25 * upAgain, lean: -.03 * b, armL: [.05, .1, .18 + .1 * b], armR: [.05, .1, .18 + .1 * b] };
    } else {
      const turn = windowAt(t, T.s03Cut + .3, T.s03Cut + 1.2) - windowAt(t, T.s03Cut + 1.9, T.s03Cut + 2.5) * .5;
      pose = { ...POSE_STAND, breath: .15 * Math.sin(t * 1.6), headYaw: .65 * turn, headPitch: -.08, twist: .12 * turn };
    }
    this.people.neighbour.stand([9.3, -2.4], -Math.PI / 2, pose);
  }

  private stageCrosser(t: number) {
    // Crosses south from sun into the shade of the 19.2 m block; the edge lies at x = -1.1 here.
    const v = 1.4, x0 = -1.1 + v * (T.crossEdge - T.bounds[2]);
    this.people.crosser.walk(t, { start: [x0, 1.4], heading: -Math.PI / 2, t0: T.bounds[2], speed: [[0, v]] });
    this.people.w5.walk(t, { start: [9.4, 14], heading: Math.PI, t0: T.bounds[2], speed: [[0, 1.2]], ground: SIDEWALK_Y });
  }

  private stageWaiting(t: number) {
    const shift = Math.sin(t * .9) * .5 + .5;
    const pose: HumanoidPose = { ...POSE_STAND, headPitch: .38, headYaw: -.1, sideLean: .03 * shift, breath: .2 * Math.sin(t * 1.5),
      armR: [-.95, .12, 1.45], armL: [.05, .08, .2] };
    this.people.waiting.stand([-8.2, -.6], Math.PI / 2, pose);
  }

  private stageNearMiss(t: number) {
    // You walk north out of the shade (edge x = -1.1 at the reveal), notice the car, freeze and recoil.
    const v = 1.48, x0 = -1.1 - v * (T.s05Reveal - T.bounds[4]);
    const stop = T.s05Brake + 1.1, back = stop + .35;
    const notice = windowAt(t, T.s05Brake - .1, T.s05Brake + .35);
    const startle: Partial<HumanoidPose> = { headYaw: -1.05, twist: -.35, lean: -.08, shrug: .8, armL: [-1.25, .35, .5], armR: [-.4, .2, .9] };
    const you = this.people.you;
    you.walk(t, { start: [x0, .3], heading: Math.PI / 2, t0: T.bounds[4],
      speed: [[0, v], [stop - .3, v], [stop, 0], [back, 0], [back + .25, -.9], [back + .6, 0]] }, { pose: startle, w: notice });
    you.h.chestAnchor.getWorldPosition(this.youChest);
    const o = this.cars.oncoming; o.g.visible = true; o.g.position.set(-3.5, 0, -2.7 + 9 * (t - T.bounds[4])); o.g.rotation.y = Math.PI;
    setCarLights(o, 1, 'run');
  }

  private stageRetreat(t: number) {
    const t0 = T.bounds[5], stopAt = t0 + 1.4;
    const you = this.people.you;
    const up = windowAt(t, stopAt + .1, stopAt + .65), hand = windowAt(t, stopAt + .2, stopAt + .85);
    you.walk(t, { start: [-3.3, .3], heading: -Math.PI / 2, t0, speed: [[t0, 1.95], [stopAt - .4, 1.95], [stopAt, 0]] },
      { pose: { headPitch: -.55, lean: -.05, headYaw: .15 }, w: up });
    if (hand > 0) {
      const head = new THREE.Vector3(), fwd = new THREE.Vector3(-1, 0, 0);
      you.h.headAnchor.getWorldPosition(head);
      you.h.reachArm('R', head.clone().addScaledVector(fwd, .13).add(new THREE.Vector3(0, .07, .02)), new THREE.Vector3(0, -.3, -1), hand);
    }
  }

  private stageEvening(t: number) {
    const p = this.people, t0 = T.bounds[6];
    p.w0.walk(t, { start: [9.2, -21], heading: 0, t0, speed: [[0, 1.3]], ground: SIDEWALK_Y });
    p.w2.walk(t, { start: [-9.0, -6], heading: 0, t0, speed: [[0, 1.15]], ground: SIDEWALK_Y });
    p.w4.walk(t, { start: [8.4, -40], heading: 0, t0, speed: [[0, 1.4]], ground: SIDEWALK_Y });
    const c = this.cars.eve; c.g.visible = true; c.g.position.set(-3.5, 0, -60 + 8 * (t - t0)); c.g.rotation.y = Math.PI;
    setCarLights(c, 1, 'run');
  }

  private stageDusk(t: number) {
    // Watching the sunset edge-on: the west-facing half of the face carries the last direct light.
    const look = windowAt(t, T.sunset + .25, T.sunset + .9);
    this.people.w1.stand([8.7, -10.2], Math.PI, { ...POSE_STAND, headPitch: -.04, headYaw: .75 * look, twist: .25 * look,
      breath: .15 * Math.sin(t * 1.5), armL: [.05, .1, .2], armR: [.05, .1, .2] });
  }


  private stageDawn(t: number, key: string) {
    const t0 = T.bounds[8];
    if (key === 'S09/SH01') {
      this.people.w5.walk(t, { start: [8.9, 16], heading: Math.PI, t0, speed: [[0, 1.25]], ground: SIDEWALK_Y });
      return;
    }
    // Reverse angle: east-facing fronts catch the new sun.
    this.people.w2.walk(t, { start: [9.5, 47], heading: 0, t0: T.s09Cut, speed: [[0, 1.2]], ground: SIDEWALK_Y });
    this.people.w5.walk(t, { start: [8.9, 16], heading: Math.PI, t0, speed: [[0, 1.25]], ground: SIDEWALK_Y });
  }

}

