import * as THREE from 'three';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { GrassField } from '../../../library/environment/GrassField';
import { BroadleafTree } from '../../../library/environment/BroadleafTree';
import { Flame } from '../../../library/fx/Flame';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { applyGroundedPose } from '../../../library/characters/CharacterMotion';
import { box, solid, surface, rod, canvasTexture } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt, worldTime, tau, joggerZ } from '../timeline';
import { Person } from './common';

// City park, 1 unit = 1 m. Gravel path along Z (x = 0); the jogger runs toward -Z. Flower bed beside the jogger's
// start (z = 7), bench by the stopping point (z = -2), litter under the trees. Farm field far east at x = 1500.
const BED_Z = 7;
const SUN = new THREE.Vector3(.55, .64, -.53).normalize();
const FARM_X = 1500;
const GREEN_LEAF = new THREE.Color(0x6f8c3e), COOKED_LEAF = new THREE.Color(0x5b5129), DEAD_LEAF = new THREE.Color(0x8f6a3a);
const lerpC = (a: THREE.Color, b: THREE.Color, u: number) => a.clone().lerp(b, Math.max(0, Math.min(1, u)));

interface Fly { g: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; base: THREE.Vector3; ph: number; die: number; land: number; bee: boolean }
interface Fire { flames: Flame[]; smoke: SmokeWisp; at: number; scorch: THREE.Mesh }

export class ParkStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, .03, 9000);
  private rig: SunSkylightRig;
  private lawn: GrassField; private flowers: GrassField; private wheat: GrassField;
  private litter: GrassField[] = [];
  private trees: BroadleafTree[] = [];
  private flies: Fly[] = [];
  private paper: THREE.Mesh; private paperMat: THREE.MeshStandardMaterial;
  private paperFire: Fire;
  private fires: Fire[] = [];
  private steam: { w: SmokeWisp; at: number }[] = [];
  private paperSmoke: SmokeWisp;
  private groundMat: THREE.MeshStandardMaterial;
  private citySmoke: SmokeWisp[] = [];
  private jogger: Person; private walkers: Person[] = [];
  private skin: THREE.MeshStandardMaterial[] = [];
  private skinBase: THREE.Color[] = [];

  constructor(renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3b7bd4, horizonColor: 0xb2cfea, hazeColor: 0xd9e5f0, groundColor: 0x6e7a4a,
      hazeAmount: .3, sunGlow: .35, discRadiance: 14, glareStrength: 1.0, shadowMapSize: 4096 });
    const r = rng(1000);
    // Ground, gravel path and a park edge.
    this.groundMat = surface(0x3c5226, .95) as THREE.MeshStandardMaterial;
    const ground = solid(this.scene, new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), this.groundMat, [0, 0, 0]); ground.receiveShadow = true;
    const path = solid(this.scene, new THREE.PlaneGeometry(2.6, 140).rotateX(-Math.PI / 2), surface(0xb8ab8f, .92), [0, .01, -20]); path.receiveShadow = true;
    const onPath = (x: number, z: number) => Math.abs(x) < 1.5 || (Math.abs(x + 2.4) < 1.2 && Math.abs(z + 2) < 1.2);
    this.lawn = new GrassField({ area: [-24, 24, -48, 22], count: 70000, minHeight: .08, maxHeight: .2, width: .011, reject: (x, z) => onPath(x, z) || (x > 1.6 && x < 4.0 && Math.abs(z - BED_Z) < 2),
      baseColor: 0x2d4a1c, tipColor: 0x86a84e, dryColor: 0xa6a060, sunDirection: SUN, fogDensity: .002, flowerFraction: .01, seed: 41 });
    this.scene.add(this.lawn.mesh);
    // Flower bed (beside the jogger's start, seen in the POV, the front tracking shot and the insect close-up).
    box(this.scene, [2.3, .12, 4.0], surface(0x5b4632, .95), [2.8, .06, BED_Z]);
    this.flowers = new GrassField({ area: [1.75, 3.85, BED_Z - 1.9, BED_Z + 1.9], count: 2200, minHeight: .3, maxHeight: .55, width: .014, ground: () => .12,
      baseColor: 0x2f5a22, tipColor: 0x6f9a44, flowerFraction: .8, flowerColor: 0xe9b23c, sunDirection: SUN, seed: 7 });
    this.scene.add(this.flowers.mesh);
    // Dead grass and leaf litter under three trees: the fuels that ignite.
    for (const [x, z, s] of [[-6.6, -2.4, 7], [6.0, -11, 9], [-6.6, -18.5, 13]] as const) {
      const f = new GrassField({ area: [x - 1.6, x + 1.6, z - 1.3, z + 1.3], count: 2400, minHeight: .12, maxHeight: .3, width: .012, reject: (xx, zz) => (xx - x) ** 2 / 2.5 + (zz - z) ** 2 / 1.7 > 1,
        baseColor: 0x6e5a36, tipColor: 0xb59a62, dryColor: 0xc4ad78, sunDirection: SUN, seed: s });
      this.litter.push(f); this.scene.add(f.mesh);
    }
    // Trees.
    for (const [i, [x, z, h]] of ([[-6.8, -2.6, 6.8], [6.8, -12, 7.6], [-7.2, -20, 7.2], [6.2, -28, 8.0], [-5.8, 5, 6.4], [7.5, 3, 7.0], [-9, -34, 8.4], [9, -40, 7.8], [-4.5, 17, 6.6], [6.5, 19, 7.2]] as const).entries()) {
      const tree = new BroadleafTree({ height: h, canopyWidth: h * .64, leafCount: i === 0 || i === 4 ? 6500 : 2600, seed: 300 + i * 17, leafColor: GREEN_LEAF.getHex() });
      tree.position.set(x, 0, z); tree.rotation.y = i * 1.3; this.scene.add(tree); this.trees.push(tree);
    }
    this.buildBench();
    this.paperMat = new THREE.MeshStandardMaterial({ map: canvasTexture(256, 192, c => {
      c.fillStyle = '#ede8dc'; c.fillRect(0, 0, 256, 192); c.fillStyle = '#2a2a2a'; c.font = 'bold 26px serif'; c.fillText('THE DAILY', 14, 32);
      c.fillStyle = '#777'; for (let y = 48; y < 184; y += 9) for (const x of [14, 134]) c.fillRect(x, y, 108 - (y % 27), 4);
    }), roughness: .95 });
    this.paper = solid(this.scene, new THREE.PlaneGeometry(.56, .4).rotateX(-Math.PI / 2), this.paperMat, [-2.32, .485, -2.25]);
    this.paper.rotation.y = .35;
    this.paperFire = this.makeFire(new THREE.Vector3(-2.32, .49, -2.25), T.paperIgnite, 3, .3, .55);
    // Charring paper gives off a thin wisp before it ignites.
    this.paperSmoke = new SmokeWisp({ height: 1.2, baseWidth: .2, topWidth: .7, curl: .3, riseSpeed: .5, color: 0x8a8076, seed: 31, opacity: .3 });
    this.paperSmoke.mesh.position.set(-2.32, .5, -2.25); this.scene.add(this.paperSmoke.mesh);
    T.grassIgnite.forEach((at, i) => {
      const [x, z] = [[-6.6, -2.4], [6.0, -11], [-6.6, -18.5]][i];
      this.fires.push(this.makeFire(new THREE.Vector3(x, .02, z), at, 7, 1.4, .9));
    });
    // Water boiled off the cooked leaves stays invisible in 538 °C air; it condenses into steam once the air cools.
    for (let i = 0; i < 34; i++) {
      const tr = this.trees[i % 10], at = 5 + (i % 4) * .12;
      const w = new SmokeWisp({ height: 3.0, baseWidth: .8, topWidth: 2.0, curl: .9, riseSpeed: 1.8, color: 0xf2f5f7, seed: 50 + i, opacity: .34 });
      w.mesh.position.set(tr.position.x + (r() - .5) * 2.6, tr.position.y + 3.0 + r() * 2.4, tr.position.z + (r() - .5) * 2.6); this.scene.add(w.mesh); this.steam.push({ w, at });
    }
    for (let i = 0; i < 4; i++) {
      const w = new SmokeWisp({ height: 1.4, baseWidth: .7, topWidth: 1.5, curl: .4, riseSpeed: .6, color: 0xeef2f4, seed: 90 + i, opacity: .22 });
      w.mesh.position.set(2.2 + (i % 2) * 1.2, .5, BED_Z - 1 + Math.floor(i / 2) * 2); this.scene.add(w.mesh); this.steam.push({ w, at: 5.05 + i * .1 });
    }
    // Butterflies over the flowers, bees among them; the last four flutter over the path where you run past.
    for (let i = 0; i < 18; i++) {
      const bee = i >= 7 && i < 14, onPath = i >= 14, g = new THREE.Group(); this.scene.add(g);
      const wingMat = bee ? new THREE.MeshStandardMaterial({ color: 0xdfe9ef, transparent: true, opacity: .55, side: THREE.DoubleSide, roughness: .3 })
        : new THREE.MeshStandardMaterial({ map: canvasTexture(64, 64, c => { c.fillStyle = '#e8781c'; c.beginPath(); c.ellipse(32, 32, 30, 24, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#141414'; c.lineWidth = 5; c.strokeStyle = '#141414'; c.stroke(); for (const [x, y] of [[20, 20], [44, 26], [30, 44]]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); } }), side: THREE.DoubleSide, roughness: .7, transparent: true, alphaTest: .3 });
      const span = bee ? .012 : .045;
      solid(g, new THREE.CapsuleGeometry(bee ? .005 : .004, bee ? .012 : .03, 4, 8).rotateX(Math.PI / 2), surface(bee ? 0xd9a520 : 0x222018, .5));
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(span, span * .8).translate(-span / 2, 0, 0).rotateX(-Math.PI / 2), wingMat), wr = new THREE.Mesh(new THREE.PlaneGeometry(span, span * .8).translate(span / 2, 0, 0).rotateX(-Math.PI / 2), wingMat);
      g.add(wl, wr);
      g.scale.setScalar(bee ? 2.0 : 2.2);
      if (onPath) { const q = i - 14; this.flies.push({ g, wl, wr, bee, base: new THREE.Vector3(.95 + (q % 2) * .45, 1.05 + q * .17, 2.3 + q * .32), ph: q * 1.7, die: .45 + q * .13, land: .015 }); continue; }
      this.flies.push({ g, wl, wr, bee, base: new THREE.Vector3(1.9 + r() * 1.9, bee ? .62 + r() * .2 : .8 + r() * .7, BED_Z - 1.7 + r() * 3.4), ph: r() * 6.28, die: T.insects[0] + r() * (T.insects[1] - T.insects[0]), land: bee ? .58 : .12 + r() * .4 });
    }
    this.buildSkyline();
    this.buildFarm();
    // People: you, and two walkers ahead on the path.
    this.jogger = new Person(this.scene, { height: 1.76, coat: 0x1f7a8c, trousers: 0x23272e, skin: 0xd6a88a, hair: 0x2b1d14 });
    for (const [i, c] of [0x7c2d12, 0x5b5f66].entries()) this.walkers.push(new Person(this.scene, { height: 1.66 + i * .08, coat: c, trousers: 0x1f2937, skin: [0x8d5524, 0xe0ac69][i] }));
    this.jogger.h.root.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.color.getHex() === 0xd6a88a && !this.skin.includes(o.material)) { this.skin.push(o.material); this.skinBase.push(o.material.color.clone()); } });
  }

  private makeFire(at: THREE.Vector3, ignite: number, n: number, spread: number, height: number): Fire {
    const r = rng(Math.round(at.x * 100 + at.z * 7));
    const flames = Array.from({ length: n }, (_, i) => {
      const f = new Flame({ width: height * .7, height, seed: i + 3, turbulence: .8, speed: 1.6, brightness: 2.6 });
      f.mesh.position.set(at.x + (r() - .5) * spread, at.y, at.z + (r() - .5) * spread * .7); this.scene.add(f.mesh); f.mesh.userData.delay = r() * .03; return f;
    });
    const smoke = new SmokeWisp({ height: height * 9, baseWidth: spread * .8, topWidth: spread * 3, curl: spread, riseSpeed: 1.6, color: 0x3a3632, seed: n, opacity: .55 });
    smoke.mesh.position.copy(at).add(new THREE.Vector3(0, height * .5, 0)); this.scene.add(smoke.mesh);
    const scorch = solid(this.scene, new THREE.CircleGeometry(spread * .75, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 1, transparent: true, opacity: 0 }), [at.x, at.y + .004, at.z]);
    return { flames, smoke, at: ignite, scorch };
  }

  private buildBench() {
    const g = new THREE.Group(); g.position.set(-2.4, 0, -2.0); this.scene.add(g);
    const wood = surface(0x8a6440, .8), iron = surface(0x23262a, .5, .5);
    for (let i = 0; i < 4; i++) box(g, [.12, .035, 1.7], wood, [-.18 + i * .13, .46, 0]);
    for (let i = 0; i < 3; i++) { const s = box(g, [.035, .11, 1.7], wood, [-.33, .62 + i * .13, 0]); s.rotation.z = .12; }
    for (const z of [-.75, .75]) { box(g, [.5, .05, .06], iron, [-.06, .43, z]); rod(g, [.15, 0, z], [.15, .43, z], .025, iron); rod(g, [-.28, 0, z], [-.3, .95, z], .025, iron); }
    g.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    const cup = new THREE.Group(); cup.position.set(-2.1, .48, -1.4); this.scene.add(cup);
    solid(cup, new THREE.CylinderGeometry(.04, .032, .11, 16), surface(0xe6e0d2, .6), [0, .055, 0]);
  }

  private buildSkyline() {
    const r = rng(77), n = 140, mat = new THREE.MeshStandardMaterial({ map: canvasTexture(64, 128, c => {
      c.fillStyle = '#8b8f94'; c.fillRect(0, 0, 64, 128); for (let y = 6; y < 128; y += 10) for (let x = 5; x < 64; x += 11) { c.fillStyle = r() < .4 ? '#c8d4de' : '#3b4650'; c.fillRect(x, y, 6, 6); }
    }), roughness: .8 });
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), mat, n), d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rad = 230 + r() * 480, h = 16 + Math.pow(r(), 2) * 80;
      d.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad - 20); d.scale.set(22 + r() * 25, h, 22 + r() * 25); d.rotation.y = r(); d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      inst.setColorAt(i, new THREE.Color().setHSL(.58, .07, .3 + r() * .22));
    }
    inst.castShadow = true; inst.receiveShadow = true; this.scene.add(inst);
    // Smoke columns rising from fires across the city (aerial shot after the heat ends).
    // Most columns sit in the -Z sector seen from the park looking over the skyline.
    for (let i = 0; i < 26; i++) {
      const a = i < 20 ? (r() - .5) * 1.1 : r() * Math.PI * 2, rad = 120 + r() * 600;
      const w = new SmokeWisp({ height: 120 + r() * 140, baseWidth: 10 + r() * 12, topWidth: 50 + r() * 60, curl: 30, riseSpeed: 6, color: 0x35302c, seed: 200 + i, opacity: .75 });
      w.mesh.position.set(Math.sin(a) * rad, 0, -Math.cos(a) * rad - 30); this.scene.add(w.mesh); this.citySmoke.push(w);
    }
  }

  private buildFarm() {
    solid(this.scene, new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), surface(0x5d4a2c, .95), [FARM_X, .02, 0]).receiveShadow = true;
    this.wheat = new GrassField({ area: [FARM_X - 40, FARM_X + 40, -60, 40], count: 90000, minHeight: .7, maxHeight: 1.0, width: .008, ground: () => .02,
      baseColor: 0x4a6a2a, tipColor: 0xb7b25a, dryColor: 0xc9b46a, sunDirection: SUN, fogDensity: .002, seed: 13 });
    this.scene.add(this.wheat.mesh);
    for (let i = 0; i < 9; i++) { const t = new BroadleafTree({ height: 9, canopyWidth: 6, leafCount: 1600, seed: 700 + i, leafColor: DEAD_LEAF.getHex() }); t.position.set(FARM_X - 70 + i * 17, 0, -95 - (i % 3) * 6); this.scene.add(t); }
    for (let i = 0; i < 4; i++) { const w = new SmokeWisp({ height: 160, baseWidth: 14, topWidth: 70, curl: 40, riseSpeed: 6, color: 0x6a625a, seed: 400 + i, opacity: .45 }); w.mesh.position.set(FARM_X - 260 + i * 160, 0, -700 - i * 90); this.scene.add(w.mesh); this.citySmoke.push(w); }
  }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId, key = shot.key, nextDay = sc === 'S09' || sc === 'S10';
    const w = worldTime(t), k = nextDay ? 1e5 : tau(t), farm = key === 'S09/SH02';
    // ---- light: an ordinary sunny morning (the heat itself is invisible; the film grade carries it)
    const focus = farm ? new THREE.Vector3(FARM_X, 2, -10) : key === 'S08/SH02' ? new THREE.Vector3(0, 3, 4) : new THREE.Vector3(0, 2, -2);
    const half = key === 'S08/SH02' ? 50 : farm ? 60 : 36;
    this.rig.apply(this.scene, this.camera, { sunDirection: SUN, sunIntensity: 8.5, sunColor: 0xfff3e2, skyAmount: 1, groundAmount: 1, envIntensity: 1,
      hazeDensity: key === 'S08/SH02' ? .0011 : nextDay ? .003 : .0018, focus, shadowHalfWidth: half, shadowHalfHeight: half, shadowDepth: 300 });

    // ---- plants cook: leaves and grass darken while steaming; next day they are brown
    const cook = windowAt(k, T.leafCook[0], T.leafCook[1]);
    const leaf = nextDay ? DEAD_LEAF : lerpC(GREEN_LEAF, COOKED_LEAF, cook);
    for (const tr of this.trees) { (tr.leaves.material as THREE.MeshStandardMaterial).color.copy(leaf); tr.leafFraction = nextDay ? .82 : 1; }
    this.groundMat.color.copy(nextDay ? new THREE.Color(0x6b5a34) : lerpC(new THREE.Color(0x3c5226), new THREE.Color(0x434322), cook));
    const lu = (this.lawn as any).u, fu = (this.flowers as any).u;
    lu.uBase.value.copy(nextDay ? new THREE.Color(0x5a4a2a) : lerpC(new THREE.Color(0x2d4a1c), new THREE.Color(0x3b3a1c), cook));
    lu.uTip.value.copy(nextDay ? new THREE.Color(0xa88f5a) : lerpC(new THREE.Color(0x86a84e), new THREE.Color(0x77703a), cook));
    fu.uFlower.value.copy(nextDay ? new THREE.Color(0x6a4a2a) : lerpC(new THREE.Color(0xe9b23c), new THREE.Color(0x9a6a2a), cook));
    fu.uTip.value.copy(nextDay ? new THREE.Color(0x8a7a4a) : lerpC(new THREE.Color(0x6f9a44), new THREE.Color(0x6b6a34), cook));
    const wind = { bend: .18, direction: new THREE.Vector2(.6, -.8), gust: .3, gustSpeed: 3 };
    this.lawn.update(w, wind); this.flowers.update(w, wind); for (const f of this.litter) f.update(w, wind);
    this.wheat.update(w, { bend: nextDay ? 1.25 : .2, direction: new THREE.Vector2(1, .2), gust: nextDay ? .05 : .3, gustSpeed: 2 });
    const wu = (this.wheat as any).u;
    wu.uBase.value.set(0x4a3a20); wu.uTip.value.set(0x8a6a3a);

    // ---- steam only once the air is back to normal: it condenses off the hot leaves, then thins out
    for (const s of this.steam) { const age = k - s.at; s.w.update(w, nextDay || age < 0 ? 0 : age, nextDay || age < 0 ? 0 : Math.min(1, age / .4) * Math.max(0, 1 - age / 16), this.camera); }

    // ---- paper: browns and smokes, then flames; litter patches ignite a moment later; next day only scorch marks
    const brown = windowAt(k, T.paperBrown[0], T.paperBrown[1]), char = windowAt(k, T.paperIgnite, T.paperIgnite + 3.5);
    this.paperMat.color.copy(new THREE.Color(1, 1, 1).lerp(new THREE.Color(.4, .24, .11), brown).lerp(new THREE.Color(.05, .04, .03), char));
    this.paper.visible = !nextDay;
    const smokeAge = k - T.paperSmoke;
    this.paperSmoke.update(w, Math.max(0, smokeAge), nextDay || smokeAge < 0 || k >= T.paperIgnite ? 0 : .3 * windowAt(k, T.paperSmoke, T.paperIgnite), this.camera);
    for (const fire of [this.paperFire, ...this.fires]) {
      const age = k - fire.at, burning = !nextDay && age > 0;
      // Event-second ramp: ~0.08 s of event time is ~0.6 s on screen while the world runs slow.
      fire.flames.forEach((f, i) => { const a = age - f.mesh.userData.delay; f.update(w + i, burning && a > 0 ? Math.min(1, a / .08) : 0, this.camera); });
      fire.smoke.update(w, burning ? age : 0, burning ? .55 : 0, this.camera);
      (fire.scorch.material as THREE.MeshStandardMaterial).opacity = nextDay ? .85 : burning ? Math.min(.8, age * .3) : 0;
    }

    // ---- insects: flutter until their bodies pass ~50 °C, then fold and fall; lie where they land
    for (const f of this.flies) {
      const alive = k < f.die, tw = alive ? w : T.hit + f.die;
      const p = f.base.clone().add(new THREE.Vector3(Math.sin(tw * 1.3 + f.ph) * .35, Math.sin(tw * 2.1 + f.ph) * .08, Math.cos(tw * 1.1 + f.ph) * .3));
      let flap = Math.sin(tw * (f.bee ? 60 : 9) + f.ph) * (f.bee ? .5 : .95);
      if (!alive) {
        const fall = Math.max(0, w - (T.hit + f.die));
        p.y = Math.max(f.land, p.y - 4.9 * fall * fall);
        flap = .1;
        f.g.rotation.set(Math.min(1.2, fall * 3), f.ph, Math.min(1.5, fall * 4));
      } else f.g.rotation.set(0, Math.atan2(Math.cos(tw * 1.3 + f.ph), -Math.sin(tw * 1.1 + f.ph)), 0);
      f.g.position.copy(p);
      f.wl.rotation.z = flap; f.wr.rotation.z = -flap;
      f.g.visible = !nextDay && !farm;
    }

    // ---- smoke over the city (only meaningful long after the five seconds)
    const later = key === 'S08/SH02' || nextDay;
    this.citySmoke.forEach((s, i) => s.update(w + i * 3, later ? 900 + i * 40 : 0, later ? (nextDay ? .35 : .6) : 0, this.camera));

    // ---- people
    this.jogger.h.root.visible = false; for (const p of this.walkers) p.h.root.visible = false;
    if (!farm && !(sc === 'S01') && !(key === 'S08/SH02') && sc !== 'S09') this.poseJogger(t, w, k, nextDay);
    if (sc <= 'S04') this.poseWalkers(w, k);
    const red = nextDay ? .8 : windowAt(k, .5, 5) * .55;
    this.skin.forEach((m, i) => m.color.copy(this.skinBase[i]).lerp(new THREE.Color(0xcf5f48), red));
  }

  private poseJogger(t: number, w: number, k: number, nextDay: boolean) {
    const j = this.jogger, z = nextDay ? -.7 : joggerZ(w);
    const runU = 1 - windowAt(k, T.decel[0], T.decel[1]), cover = nextDay ? 0 : windowAt(k, T.cover[0], T.cover[1]) * (1 - windowAt(k, 5.6, 7));
    const ph = (T.joggerStartZ - z) / 1.1 * Math.PI;
    const s = Math.sin(ph) * .72 * runU;
    const run: HumanoidPose = { ...POSE_STAND, hipsY: .9 - .04 * runU, lean: .16 * runU, legL: [s, .25 * runU + Math.max(0, -s) * 1.1], legR: [-s, .25 * runU + Math.max(0, s) * 1.1],
      armL: [-s * .7, .12, 1.35 * runU + .2], armR: [s * .7, .12, 1.35 * runU + .2], breath: .2 * Math.sin(w * 3) };
    const shield: Partial<HumanoidPose> = { headPitch: .32, lean: .12, shrug: .7, armR: [-1.45, -.18, 2.35], armL: [-1.35, -.12, 2.3], headYaw: -.1 };
    const look: Partial<HumanoidPose> = { headPitch: -.25, headYaw: .45 * Math.sin(t * .4), armR: [-.3, .15, .6], armL: [.05, .1, .3] };
    let pose = lerpPose(run, { ...run, ...shield }, cover);
    if (nextDay) pose = { ...POSE_STAND, ...look };
    j.h.root.visible = true;
    j.h.root.position.set(.6, 0, z);
    j.h.root.rotation.set(0, nextDay ? 2.3 : Math.PI, 0);
    applyGroundedPose(j.h, pose, .01);
  }

  private poseWalkers(w: number, k: number) {
    this.walkers.forEach((p, i) => {
      const cover = windowAt(k, .4 + i * .3, 1.2 + i * .3);
      p.walk(w, { start: [i ? -.5 : .5, -14 - i * 4], heading: 0, t0: 0, speed: [[0, 1.3], [T.hit + .4 + i * .3, 1.3], [T.hit + 1.4 + i * .3, 0]], ground: .01 },
        { pose: { headPitch: .3, armR: [-1.5, .2, 2.2], armL: [-.8, .3, 1.8], shrug: .6 }, w: cover });
    });
  }
}
