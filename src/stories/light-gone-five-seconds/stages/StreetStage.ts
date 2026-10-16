import * as THREE from 'three';
import { CityStreetClassic } from '../../../library/environment/CityStreetClassic';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { DistanceStarSky, type SkyStar } from '../../../library/space/DistanceStarSky';
import { Moon } from '../../../library/planet/Moon';
import type { HumanoidPose } from '../../../library/characters/Humanoid';
import { surface, box, canvasTexture } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt, dark1, sunFill, yearsAt, clamp01 } from '../timeline';
import { Person, carRig, setCarLights, distanceAt, type CarRig } from './common';

// A city shopping street, 1 unit = 1 m (city-street-block-v1: road along Z, x -7..7, sidewalks to |x| = 12). You stand
// on the +X sidewalk holding your phone. While no light exists the overlay shows eigengrau; when light comes back every
// lamp, sign, screen and headlight returns at once, but the sky stays black (only a faint glow of city light) until the
// sunlight arrives. At night the Moon is back and stars return only as their light does (S08 time-lapse).
//
// The sky is real: a city at 38 degrees south on a mid-February night (local sidereal time 7.6 h), with the street's -Z
// axis pointing SSE (azimuth 148.7). Scene +X is azimuth 238.7 and +Z is 328.7 (NNW). Noon sun due north at 64.5 degrees;
// Alpha Centauri low over the far end of the street, Sirius high behind you, 88 degrees apart as in the real sky.
const SUN = new THREE.Vector3(-0.2237, 0.9026, 0.3679).normalize();
const MOON_DIR = new THREE.Vector3(-0.0043, 0.5736, 0.8191).normalize();      // waxing gibbous, NNW at 35 degrees
const MOON_SUN = new THREE.Vector3(0.7761, -0.533, -0.3369).normalize();      // the Sun 32 degrees below the horizon at about 10 pm
const STARS: SkyStar[] = [
  { name: 'ALPHA CENTAURI', dir: new THREE.Vector3(-0.0004, 0.4324, -0.9017), distanceLy: 4.37, mag: -0.27, tint: [1.0, 0.94, 0.8] },
  { name: 'SIRIUS', dir: new THREE.Vector3(-0.001, 0.9133, 0.4072), distanceLy: 8.6, mag: -1.46, tint: [0.85, 0.92, 1.0] },
  { name: 'EPSILON ERIDANI', dir: new THREE.Vector3(0.6487, 0.4808, 0.5899), distanceLy: 10.47, mag: 3.73, tint: [1.0, 0.9, 0.75] },
  { name: 'PROCYON', dir: new THREE.Vector3(-0.3681, 0.7286, 0.5776), distanceLy: 11.46, mag: 0.34, tint: [1.0, 0.98, 0.92] },
  { name: 'EPSILON INDI', dir: new THREE.Vector3(0.7633, 0.1697, -0.6233), distanceLy: 11.87, mag: 4.69, tint: [1.0, 0.88, 0.7] },
  { name: 'TAU CETI', dir: new THREE.Vector3(0.9227, 0.1958, 0.3321), distanceLy: 11.91, mag: 3.5, tint: [1.0, 0.95, 0.85] },
];
/** Bright named stars also get a soft glint so they read as stars at phone size: [name, scale]. */
const GLINTS: [string, number][] = [['ALPHA CENTAURI', 0.85], ['SIRIUS', 1.0], ['PROCYON', 0.7]];

interface Walker { p: Person; at: [number, number]; heading: number; speed: number; ph: number; torch: boolean; stopAt: number; face: number; night: [number, number, number] | null }
interface Car { rig: CarRig; lane: number; dir: number; z0: number; zn: number; v: number }

/** A generic messaging screen for the phone (unbranded). */
function phoneScreen() {
  return canvasTexture(256, 512, (g) => {
    g.fillStyle = '#f3f5f8'; g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#d9dee6'; g.fillRect(0, 0, 256, 44);
    for (const [y, w, me] of [[70, 150, false], [126, 120, true], [182, 170, false], [252, 96, true], [306, 140, false], [370, 160, true]] as const) {
      g.fillStyle = me ? '#3b82f6' : '#e3e7ee'; const x = me ? 256 - 16 - w : 16;
      g.beginPath(); g.roundRect(x, y, w, 40, 14); g.fill();
    }
    g.fillStyle = '#e3e7ee'; g.beginPath(); g.roundRect(14, 456, 228, 36, 18); g.fill();
  });
}

/** A bright star's glint: a soft core with faint cross spikes. */
function glintTexture() {
  return canvasTexture(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.08, 'rgba(255,255,255,0.8)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    for (const [w, h] of [[128, 3], [3, 128]]) { const s = g.createLinearGradient(64 - w / 2, 64 - h / 2, 64 + w / 2, 64 + h / 2); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.55)'); s.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = s; g.fillRect(64 - w / 2, 64 - h / 2, w, h); }
  });
}

export class StreetStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.02, 4000);
  private city = new CityStreetClassic({ seed: 2468, blocks: 7, storeysMin: 4, storeysMax: 8, wetness: 0, farFieldRadius: 1800, vehicles: false });
  private rig: SunSkylightRig;
  private people: Walker[] = []; private cars: Car[] = [];
  private torches: THREE.SpotLight[] = [];
  private lampLights: THREE.PointLight[] = [];
  private fill = new THREE.HemisphereLight(0x7a86a8, 0x3a2c20, 0);
  private shopLights: THREE.PointLight[] = [];
  private arm = new THREE.Group();
  private phone = new THREE.Group(); private screenMat: THREE.MeshBasicMaterial;
  private glow: THREE.Mesh; private glowMat: THREE.ShaderMaterial;
  readonly sky = new DistanceStarSky({ seed: 23, count: 3200, radius: 1500, named: STARS, minY: -0.05, maxSize: 14 });
  private glints: { s: THREE.Sprite; star: SkyStar; k: number }[] = [];
  readonly moon = new Moon({ radius: 11, seed: 31, sunDirection: MOON_SUN, albedoRock: 0.42 });
  private moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(128, 128, (g) => { const grd = g.createRadialGradient(64, 64, 18, 64, 64, 64); grd.addColorStop(0, 'rgba(220,228,255,0.5)'); grd.addColorStop(1, 'rgba(220,228,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  private moonPos = MOON_DIR.clone().multiplyScalar(860);

  constructor(private renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3d7ad0, horizonColor: 0xaecbea, hazeColor: 0xd5e3f1, groundColor: 0x8d867c,
      hazeAmount: 0.26, sunGlow: 0.35, discRadiance: 14, glareStrength: 1.0, shadowMapSize: 4096, discDistance: 3000 });
    this.scene.add(this.city.group, this.fill);
    // Lamps: each light sits about a metre under its head so the housing does not flare; the heads only emit.
    for (const l of this.city.lamps) l.position.y = 6.75;
    for (const m of this.city.lampHeads) { m.color.setHex(0x0a0a0a); m.roughness = 1; }
    for (const side of [-1, 1]) for (const j of [-1, 1]) {
      const l = new THREE.PointLight(0xffc990, 0, 19, 1.8); l.position.set(side * 6.95, 6.75, j * 25 - 6); this.scene.add(l); this.lampLights.push(l);
    }
    for (const [x, z] of [[11.6, 3], [11.6, -10], [-11.6, -4], [-11.6, -18]]) { const l = new THREE.PointLight(0xffb878, 0, 9, 2); l.position.set(x, 2.3, z); this.scene.add(l); this.shopLights.push(l); }
    // The glow of city light on the air: black at the zenith, a dull warm haze near the horizon.
    this.glowMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, transparent: true, blending: THREE.AdditiveBlending,
      uniforms: { uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() } },
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 0.0); gl_Position = projectionMatrix * vec4(p.xyz, 1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uHorizon, uZenith; varying vec3 vDir; void main(){ float h = normalize(vDir).y; vec3 c = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45)); c = mix(c, uHorizon * 0.5, smoothstep(0.0, -0.2, h)); gl_FragColor = vec4(c, 1.0); }` });
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.glowMat); this.glow.frustumCulled = false; this.glow.renderOrder = -99; this.scene.add(this.glow);
    // People on both sidewalks: walking at noon, they stop in the dark, turn to the street and look up; a few raise
    // phone torches. At night a few walk the far sidewalk.
    const looks: [number, number, number, number, number][] = [
      [-9.2, -6, 0x2e4053, 0xe0ac69, 1.76], [-10.4, -14, 0xb03a2e, 0x8d5524, 1.68], [-9.6, -24, 0x1e8449, 0xf1c27d, 1.72], [-8.4, 0, 0x7d3c98, 0xc68642, 1.64],
      [9.3, -4, 0xd4ac0d, 0xffdbac, 1.8], [10.2, -12, 0x2874a6, 0x8d5524, 1.74], [8.8, -20, 0xca6f1e, 0xe0ac69, 1.66], [10.6, 2, 0x5d6d7e, 0xc68642, 1.78],
    ];
    const nights: ([number, number, number] | null)[] = [[-9.4, 6, 0], [-10.2, 30, Math.PI], [-9.6, -10, Math.PI], [-10.0, -30, 0], null, null, null, null];
    const r = rng(9), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    looks.forEach(([x, z, coat, skin, h], i) => {
      const p = new Person(this.scene, { height: h, coat, trousers: [0x2c3e50, 0x1f2937, 0x3d3d3d, 0x34495e][i % 4], skin, hair: [0x2b1d14, 0x111111, 0x6b4a2e, 0x3b2a1e][i % 4] });
      const heading = i % 2 ? Math.PI : 0, target = x > 0 ? -Math.PI / 2 + 0.45 : Math.PI / 2 - 0.45;
      this.people.push({ p, at: [x, z], heading, speed: 1.1 + 0.3 * r(), ph: r() * 6.28, torch: i % 3 === 0, stopAt: T.dark0 + 0.3 + r() * 0.8, face: wrap(target + (r() - 0.5) * 0.5 - heading), night: nights[i] });
    });
    for (let k = 0; k < 3; k++) { const l = new THREE.SpotLight(0xf2f6ff, 0, 14, 0.55, 0.6, 2); this.scene.add(l, l.target); this.torches.push(l); }
    // Traffic at about 35 km/h; drivers brake to a stop in the dark and stay put until daylight returns.
    for (const [lane, dir, z0, zn, color] of [[-3.4, -1, 18, 40, 0x9a2b24], [3.4, 1, -40, -70, 0x2b5d9a], [-3.4, -1, 42, 95, 0xd0d3d6], [3.4, 1, -12, -20, 0x3f3f3f], [-3.4, -1, -8, 10, 0x6b7a3a]] as const)
      this.cars.push({ rig: carRig(this.scene, color), lane, dir, z0, zn, v: 9.5 });
    // Your phone, held low in front of you (placed relative to your body each frame).
    this.screenMat = new THREE.MeshBasicMaterial({ map: phoneScreen(), color: 0xffffff, toneMapped: true });
    const body = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.35, metalness: 0.6 }), skin = surface(0xd9a47c, 0.6);
    box(this.phone, [0.072, 0.15, 0.008], body, [0, 0, 0]);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.142), this.screenMat); scr.position.z = 0.0042; this.phone.add(scr);
    // Hand: fingers along the left edge, thumb on the right, palm behind.
    box(this.phone, [0.066, 0.08, 0.02], skin, [0.004, -0.03, -0.016]);
    for (let f = 0; f < 4; f++) { const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.03, 4, 8), skin); fg.position.set(-0.042, 0.03 - f * 0.024, -0.002); fg.rotation.z = 0.15; this.phone.add(fg); }
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.04, 4, 8), skin); th.position.set(0.04, -0.03, 0.004); th.rotation.z = -0.5; this.phone.add(th);
    // Forearm in the body frame: from the wrist (just under the phone) down and back toward the elbow.
    const wrist = new THREE.Vector3(0.045, -0.235, -0.61), elbow = new THREE.Vector3(0.17, -0.5, -0.33), along = elbow.clone().sub(wrist).normalize();
    const limb = (r: number, a: number, b: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, (b - a) * wrist.distanceTo(elbow), 4, 12), mat); m.position.copy(wrist).addScaledVector(along, ((a + b) / 2) * wrist.distanceTo(elbow)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along); this.arm.add(m); };
    limb(0.024, 0.0, 0.2, skin); limb(0.036, 0.18, 1.0, surface(0x2b2f36, 0.85));
    this.phone.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; });
    this.arm.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; });
    this.scene.add(this.phone, this.arm);
    this.scene.add(this.sky.group);
    const gt = glintTexture();
    for (const [name, k] of GLINTS) {
      const star = STARS.find((s) => s.name === name)!;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: new THREE.Color(...star.tint), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.copy(star.dir.clone().normalize().multiplyScalar(1490)); s.renderOrder = 1; this.sky.group.add(s); this.glints.push({ s, star, k });
    }
    this.moon.mesh.position.copy(this.moonPos); this.scene.add(this.moon.group);
    this.moonGlow.position.copy(this.moonPos); this.moonGlow.scale.setScalar(60); this.moon.group.add(this.moonGlow);
  }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId, night = ['S06', 'S07', 'S08'].includes(sc), lapse = sc === 'S08';
    // Daylight: full before the dark; after the sunlight arrives the Sun's disc refills centre-out over 2.3 s.
    const F = night ? 0 : sunFill(t), day = F > 0.999, lit = !night && F > 0;
    const cam = this.camera.getWorldPosition(new THREE.Vector3());
    this.rig.apply(this.scene, this.camera, { sunDirection: SUN, sunIntensity: 7.5 * F, sunColor: 0xfff1dc, skyAmount: night ? 0.012 : F, groundAmount: F,
      envIntensity: 0.04 + 0.96 * F, hazeDensity: 0.0006 * F, focus: new THREE.Vector3(4, 1, -6), shadowHalfWidth: 30, shadowHalfHeight: 30, shadowDepth: 200 });
    this.rig.disc.visible = lit; this.rig.glare.visible = lit;
    if (lit && !day) { const u = clamp01((t - T.sunBack) / 2.32); this.rig.disc.scale.setScalar(Math.max(0.05, Math.sqrt(2 * u - u * u))); } else this.rig.disc.scale.setScalar(1);
    // City glow on the air while the sky is dark; a little bluer under the Moon at night.
    this.glow.visible = !day; this.glow.position.copy(cam);
    const flick = lapse ? 1 + 0.12 * (rng(Math.floor(t * 30) + 77)() - 0.5) : 1;
    const g = (1 - F) * flick;
    (this.glowMat.uniforms.uHorizon.value as THREE.Color).setRGB(night ? 0.013 : 0.016, night ? 0.012 : 0.011, night ? 0.013 : 0.007).multiplyScalar(g);
    (this.glowMat.uniforms.uZenith.value as THREE.Color).setRGB(night ? 0.0018 : 0.0011, night ? 0.0024 : 0.0011, night ? 0.0042 : 0.0015).multiplyScalar(g);
    this.fill.intensity = (night ? 1.6 : 2.0) * (1 - F);
    // Windows, shops and signs are on all day; the street lamps' photocells switch them on a few seconds after the dark.
    this.city.update(t, { lights: flick, wetness: 0 });
    const lamp = night ? 1 : F > 0 && t < T.dark0 ? 0 : windowAt(t, dark1() + 1.5, dark1() + 3.5) * (1 - F);
    for (const m of this.city.lampHeads) m.emissiveIntensity = 0.35 + 0.6 * lamp;
    for (const l of [...this.city.lamps, ...this.lampLights]) l.intensity = 40 * lamp * flick;
    for (const l of this.shopLights) l.intensity = 7 * (1 - F) * (t >= T.dark0 && t < dark1() ? 0 : 1) * flick;
    // ---- people: walk; stop when the light goes and turn to the street; look up once light is back but the sky is
    // black; torches in S04; at night a few walk the far sidewalk; nobody in the years-long time-lapse
    const torchOn = !night && F < 0.5 && t >= dark1() + 2;
    let ti = 0;
    for (const w of this.people) {
      if (lapse || (night && !w.night)) { w.p.h.root.visible = false; continue; }
      if (night) {
        const [x, z, hd] = w.night!;
        w.p.walk(t, { start: [x, z], heading: hd, t0: 26, speed: [[0, w.speed]] }, { pose: { headYaw: 0.25 * Math.sin(0.6 * t + w.ph) }, w: 1 });
        continue;
      }
      const keys: [number, number][] = [[0, w.speed], [w.stopAt, w.speed], [w.stopAt + 0.7, 0], [T.sunBack + 1.2, 0], [T.sunBack + 2.0, w.speed]];
      const turn = windowAt(t, w.stopAt + 0.5, w.stopAt + 1.7) * (1 - windowAt(t, T.sunBack + 0.3, T.sunBack + 1.1));
      const look = windowAt(t, dark1() + 0.4 + w.ph * 0.1, dark1() + 1.4 + w.ph * 0.1) * (1 - windowAt(t, T.sunBack + 0.2, T.sunBack + 0.9));
      const torch = w.torch && torchOn ? windowAt(t, dark1() + 1.5, dark1() + 2.2) : 0;
      const idle = turn * Math.sin(0.8 * t + w.ph);
      const act: Partial<HumanoidPose> = { headPitch: -0.55 * look * (1 - 0.35 * torch), headYaw: 0.35 * idle * (1 - 0.6 * look), ...(torch > 0 ? { armR: [-1.15 * torch, -0.15, 0.4] as [number, number, number] } : {}) };
      w.p.walk(t, { start: w.at, heading: w.heading, t0: 0, speed: keys }, { pose: act, w: Math.max(turn, look, torch) }, w.face * turn);
      if (w.torch && torchOn && ti < this.torches.length) {
        const tl = this.torches[ti++]; w.p.h.root.updateMatrixWorld(true);
        const hd = w.heading + w.face * turn, hand = w.p.h.handR?.getWorldPosition?.(new THREE.Vector3()) ?? w.p.h.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        tl.position.copy(hand).add(new THREE.Vector3(Math.sin(hd), 0, Math.cos(hd)).multiplyScalar(0.12));
        tl.target.position.copy(hand).add(new THREE.Vector3(Math.sin(hd) * 4, 2.2, Math.cos(hd) * 4)); tl.target.updateMatrixWorld();
        tl.intensity = 18 * windowAt(t, dark1() + 1.6, dark1() + 2.0);
      }
    }
    for (; ti < this.torches.length; ti++) this.torches[ti].intensity = 0;
    // ---- cars: brake to a stop in the dark (about 3 m/s²), headlights on once light returns, drive off in daylight;
    // ordinary traffic at night; none in the time-lapse
    for (const c of this.cars) {
      const stopT = T.dark0 + 0.4, keys: [number, number][] = [[0, c.v], [stopT, c.v], [stopT + c.v / 3.0, 0], [T.sunBack + 1.5, 0], [T.sunBack + 1.5 + c.v / 2.5, c.v]];
      const z = night ? c.zn + c.dir * c.v * (t - 26.5) : c.z0 + c.dir * distanceAt(t, 0, keys);
      c.rig.g.visible = !lapse && Math.abs(z) < 90; c.rig.g.position.set(c.lane, 0, z); c.rig.g.rotation.set(0, c.dir > 0 ? 0 : Math.PI, 0);
      setCarLights(c.rig, F > 0 && t < T.dark0 ? 0.25 : 1, !night && t >= T.dark0 + 0.4 && t < T.sunBack + 1.5 ? 'brake' : 'run');
    }
    // ---- your phone: held low in front of your chest (it drops out of frame when you look up); dark only while light is gone
    const q = this.camera.getWorldQuaternion(new THREE.Quaternion()), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const bodyQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3 * Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1)), Math.atan2(-fwd.x, -fwd.z), 0, 'YXZ'));
    this.phone.visible = this.arm.visible = ['S01', 'S02'].includes(sc);
    this.arm.position.copy(cam); this.arm.quaternion.copy(bodyQ);
    this.phone.position.copy(cam).add(new THREE.Vector3(0.0435, -0.1766, -0.65).applyQuaternion(bodyQ));
    this.phone.quaternion.copy(bodyQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, -0.08, 0.05)));
    this.screenMat.color.setScalar(t >= T.dark0 && t < dark1() ? 0 : F > 0.5 ? 1.0 : 0.8);
    // ---- the night sky: the Moon is back; stars only as their light arrives
    const px = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / 1920, years = lapse ? yearsAt(t) : 0;
    this.sky.group.visible = night; this.sky.follow(this.camera); this.sky.setYears(years); this.sky.setLook(px, 1.2);
    for (const { s, star, k } of this.glints) {
      const d = star.distanceLy, on = clamp01((years - d) / (d * 0.03 + 0.08)), flash = 1 + 1.4 * (1 - clamp01((years - d) / (d * 0.08 + 0.3))) * on;
      s.visible = on > 0.001; s.scale.setScalar(44 * k * (0.75 + 0.25 * flash)); (s.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.55 * on * flash);
    }
    // In the years-long time-lapse the Moon would race through its phases; leave it out of S08.
    this.moon.group.visible = night && !lapse; this.moon.group.position.copy(cam); this.moon.update(t);
  }

  /** World anchor of a named star (for callouts). */
  starWorld(name: string) { return this.sky.starWorld(name); }
}
