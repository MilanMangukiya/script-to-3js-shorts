import * as THREE from 'three';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { VillageHouses } from '../../../library/environment/VillageHouses';
import { BroadleafTree } from '../../../library/environment/BroadleafTree';
import { surface, box, canvasTexture } from '../../../library/util/Modeling';
import { CoinHeap, CoinInstances, US_CENT, coinMaterial, heapMaterial, heapProfile, heightNormal, heapNoise, pileShape } from '../../../library/props/CoinPile';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, dayAt, ease, shownPennies, pennies } from '../timeline';
import { Briefcase } from './Briefcase';

// Your house from the street, 1 unit = 1 m. A one-storey 8 × 7 m house (floor 0.4 m up over a 0.75 m crawlspace)
// faces the street (+Z). Inside capacity is about 39 m³ of crawlspace plus 140 m³ of rooms, so loose pennies reach the
// window sills on day 28, fill the house on day 29 and burst it on day 30.
const HX = 4, HZ = 3.5, FLOOR = 0.4, WALL = 2.7, EAVE = FLOOR + WALL, RIDGE = EAVE + 2.1;
const CRAWL = 39, AREA = 52;
const SUN = new THREE.Vector3(0.42, 0.62, 0.66).normalize();
const D30 = pileShape(pennies(30)), D29 = pileShape(pennies(29));
const GOLD = new THREE.Color(1.0, 0.72, 0.25);

interface Opening { u0: number; u1: number; v0: number; v1: number; door?: boolean }
interface WallDef { name: string; len: number; pivot: THREE.Vector3; yaw: number; openings: Opening[]; delay: number }
/** Outward unit normal, the wall's centre line, and where a pouring opening meets the ground outside. */
interface Spout { foot: THREE.Vector3; lip: THREE.Vector3; out: THREE.Vector3; door: boolean }

export class HouseStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.05, 6000);
  private rig: SunSkylightRig;
  private walls: { g: THREE.Group; def: WallDef }[] = [];
  private roof = new THREE.Group(); private roofMats: THREE.MeshStandardMaterial[] = []; private floorSlab!: THREE.Mesh; private ceiling!: THREE.Mesh; private lamps: THREE.PointLight[] = [];
  private glass: THREE.Mesh[] = []; private paneWall: WallDef[] = []; private door?: THREE.Group;
  private spouts: Spout[] = [];
  private heap = new CoinHeap(heapMaterial(US_CENT, 6, { metalness: 0.45, roughness: 0.52 }), 96, 192, 0.16);
  private core = new CoinHeap(heapMaterial(US_CENT, 7, { metalness: 0.45, roughness: 0.52 }), 64, 128, 0.16);
  private heapMat: THREE.Material; private xray: THREE.ShaderMaterial;
  private coins = new CoinInstances(5200, US_CENT, 31, coinMaterial(US_CENT, { metalness: 0.55, roughness: 0.42 }));
  private flow = new CoinInstances(1400, US_CENT, 32, coinMaterial(US_CENT, { metalness: 0.55, roughness: 0.42 }));
  private shards: THREE.InstancedMesh; private shardSeed: number[][] = [];
  readonly brief = new Briefcase();
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion();

  constructor(private renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3f7fd6, horizonColor: 0xb9d4ef, hazeColor: 0xd9e6f2, groundColor: 0x7d8a5c,
      hazeAmount: 0.22, sunGlow: 0.3, discRadiance: 14, glareStrength: 0.8, shadowMapSize: 4096, discDistance: 5000 });
    this.buildGround();
    this.buildHouse();
    // Neighbours along the street and across it; trees in the yards.
    const n = new VillageHouses({ sites: [[-17, -0.5, 0], [17, 0.5, 0], [-33, 0, 0], [33, -0.5, 0], [-12, 26, Math.PI], [6, 26.5, Math.PI], [24, 26, Math.PI], [-30, 26.5, Math.PI]],
      seed: 12, width: [7, 9], depth: [6, 7.5], height: [2.7, 3.1], roofPitch: [0.26, 0.32], litFraction: 0.2 });
    this.scene.add(n.group);
    for (const [x, z, hgt, s] of [[-10.5, 6.5, 7, 3], [11.5, 7.5, 6.2, 5], [-24, 6, 7.5, 7], [26, 7, 6.8, 9], [-4, 21.8, 6.5, 11], [15, 22, 7.2, 13]]) {
      const tr = new BroadleafTree({ height: hgt, canopyWidth: hgt * 0.62, leafCount: 1800, seed: s }); tr.position.set(x, 0, z); this.scene.add(tr);
    }
    // The pile and its x-ray look (S08): the day-30 shell turns translucent gold to show the day-29 core inside.
    this.heapMat = this.heap.mesh.material as THREE.Material;
    // A ghost of the day-30 shell: clear where it faces you, glowing gold at its silhouette, so the day-29 core shows inside.
    this.xray = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uK: { value: 0 }, uGold: { value: GOLD } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform float uK; uniform vec3 uGold; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); float a = mix(0.85, 0.1 + 0.75 * rim, uK); gl_FragColor = vec4(uGold * (0.8 + 0.9 * rim), a); }` });
    const coreMat = this.core.mesh.material as THREE.MeshStandardMaterial; coreMat.emissive = new THREE.Color(0x4a2410); coreMat.emissiveIntensity = 0.6;
    this.heap.mesh.renderOrder = 3; this.scene.add(this.heap.mesh, this.core.mesh, this.coins.mesh, this.flow.mesh);
    this.shards = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.07), new THREE.MeshStandardMaterial({ color: 0xcfe6f2, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.6, side: THREE.DoubleSide, envMapIntensity: 1.5 }), 420);
    this.shards.frustumCulled = false; this.scene.add(this.shards);
    const r = rng(41); for (let i = 0; i < 420; i++) this.shardSeed.push([r(), r(), r(), r(), r()]);
    this.brief.root.position.set(2.3, 0.0, 10.55); this.brief.root.rotation.y = -0.42; this.brief.setOpen(1); this.scene.add(this.brief.root);
  }

  private buildGround() {
    const lawnTex = canvasTexture(256, 256, (g) => { const r = rng(5); g.fillStyle = '#5f7f3a'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${40 + r() * 60},${80 + r() * 70},${20 + r() * 30},0.35)`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 2 + r() * 4); } });
    lawnTex.wrapS = lawnTex.wrapT = THREE.RepeatWrapping; lawnTex.repeat.set(60, 60);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 0.95 }));
    lawn.receiveShadow = true; this.scene.add(lawn);
    const asphalt = surface(0x3a3c3f, 0.9), walk = surface(0xb8b4ab, 0.85), curb = surface(0xa9a59c, 0.8);
    box(this.scene, [240, 0.02, 7.2], asphalt, [0, 0.01, 15]);
    for (let x = -118; x < 120; x += 6) box(this.scene, [3, 0.005, 0.15], surface(0xe9e3c8, 0.6), [x, 0.022, 15]);
    for (const z of [10.6, 19.4]) { box(this.scene, [240, 0.06, 1.6], walk, [0, 0.03, z]); box(this.scene, [240, 0.14, 0.15], curb, [0, 0.07, z + (z < 15 ? 0.85 : -0.85)]); }
    box(this.scene, [3.2, 0.03, 6.2], walk, [-6.2, 0.015, 6.8]);
    box(this.scene, [1.3, 0.03, 6.2], walk, [-1.8, 0.016, 6.8]);
  }

  private buildHouse() {
    const siding = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.85 }), trim = surface(0xf7f5ef, 0.6);
    const inside = surface(0xd8cdb8, 0.9), found = surface(0x8f8a82, 0.95);
    // Foundation band, interior floor and ceiling (seen through the windows), and a warm interior light.
    for (const [w, d, x, z] of [[2 * HX + 0.3, 0.25, 0, HZ], [2 * HX + 0.3, 0.25, 0, -HZ], [0.25, 2 * HZ, HX, 0], [0.25, 2 * HZ, -HX, 0]] as const) box(this.scene, [w, FLOOR, d], found, [x, FLOOR / 2, z]);
    this.floorSlab = box(this.scene, [2 * HX - 0.3, 0.04, 2 * HZ - 0.3], surface(0x6d5340, 0.7), [0, FLOOR - 0.02, 0]);
    // The ceiling belongs to the roof, so it rides down with it when the walls go.
    this.ceiling = box(this.roof, [2 * HX - 0.3, 0.04, 2 * HZ - 0.3], inside, [0, EAVE - 0.02 - RIDGE, 0]);
    for (const [x, z] of [[-2.2, 1.6], [1.6, 1.6], [0, -1.6]]) { const lamp = new THREE.PointLight(0xffd2a0, 9, 9, 2); lamp.position.set(x, EAVE - 0.35, z); this.scene.add(lamp); this.lamps.push(lamp); }
    const defs: WallDef[] = [
      { name: 'front', len: 2 * HX, pivot: new THREE.Vector3(0, FLOOR, HZ), yaw: 0, delay: 0, openings: [{ u0: -2.3, u1: -1.3, v0: 0, v1: 2.1, door: true }, { u0: -0.4, u1: 0.8, v0: 0.9, v1: 2.1 }, { u0: 1.6, u1: 2.8, v0: 0.9, v1: 2.1 }] },
      { name: 'right', len: 2 * HZ, pivot: new THREE.Vector3(HX, FLOOR, 0), yaw: Math.PI / 2, delay: 0.12, openings: [{ u0: -0.6, u1: 0.6, v0: 0.9, v1: 2.1 }] },
      { name: 'left', len: 2 * HZ, pivot: new THREE.Vector3(-HX, FLOOR, 0), yaw: -Math.PI / 2, delay: 0.24, openings: [{ u0: -0.6, u1: 0.6, v0: 0.9, v1: 2.1 }] },
      { name: 'back', len: 2 * HX, pivot: new THREE.Vector3(0, FLOOR, -HZ), yaw: Math.PI, delay: 0.36, openings: [{ u0: -2.6, u1: -1.4, v0: 0.9, v1: 2.1 }, { u0: 0.6, u1: 1.8, v0: 0.9, v1: 2.1 }] },
    ];
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x6f8794, metalness: 0.0, roughness: 0.08, transparent: true, opacity: 0.16, envMapIntensity: 0.35 });
    for (const def of defs) {
      // Each wall is built in its own frame: u along the wall, v up from the floor, w = 0 at the outer face (+w out).
      const g = new THREE.Group(); g.position.copy(def.pivot); g.rotation.y = def.yaw; this.scene.add(g);
      const add = (u0: number, u1: number, v0: number, v1: number) => { if (u1 - u0 > 0.01 && v1 - v0 > 0.01) { const m = box(g, [u1 - u0, v1 - v0, 0.2], siding, [(u0 + u1) / 2, (v0 + v1) / 2, -0.1]); m.userData.inner = inside; } };
      const ops = [...def.openings].sort((a, b) => a.u0 - b.u0);
      let u = -def.len / 2;
      for (const o of ops) { add(u, o.u0, 0, WALL); add(o.u0, o.u1, 0, o.v0); add(o.u0, o.u1, o.v1, WALL); u = o.u1;
        // Trim, glass and (for the door) a hinged panel.
        for (const [a, b, c, d] of [[o.u0 - 0.06, o.u1 + 0.06, o.v1, o.v1 + 0.08], [o.u0 - 0.06, o.u0, o.v0, o.v1], [o.u1, o.u1 + 0.06, o.v0, o.v1]]) box(g, [b - a, d - c, 0.05], trim, [(a + b) / 2, (c + d) / 2, 0.02]);
        if (!o.door) { box(g, [o.u1 - o.u0 + 0.12, 0.06, 0.12], trim, [(o.u0 + o.u1) / 2, o.v0 - 0.03, 0.04]);
          const pane = new THREE.Mesh(new THREE.PlaneGeometry(o.u1 - o.u0, o.v1 - o.v0), glassMat.clone()); pane.position.set((o.u0 + o.u1) / 2, (o.v0 + o.v1) / 2, -0.06); g.add(pane); this.glass.push(pane); this.paneWall.push(def);
          box(g, [0.04, o.v1 - o.v0, 0.04], trim, [(o.u0 + o.u1) / 2, (o.v0 + o.v1) / 2, -0.05]);
        } else {
          const door = new THREE.Group(); door.position.set(o.u0, 0, -0.04); g.add(door); this.door = door;
          box(door, [o.u1 - o.u0, o.v1, 0.05], surface(0x2f5a4a, 0.55), [(o.u1 - o.u0) / 2, o.v1 / 2, 0]);
        }
        // Where this opening pours once it bursts: the lip of the opening and a foot on the ground outside.
        const local = (uu: number, vv: number, ww: number) => new THREE.Vector3(uu, vv, ww).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.yaw).add(def.pivot);
        const out = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.yaw);
        this.spouts.push({ lip: local((o.u0 + o.u1) / 2, o.v0 + 0.05, 0.1), foot: local((o.u0 + o.u1) / 2, -FLOOR, o.door ? 1.3 : 1.0), out, door: !!o.door });
      }
      add(u, def.len / 2, 0, WALL);
      this.walls.push({ g, def });
    }
    // Gabled roof along X with a 0.45 m overhang; slabs and gables in one group so it can settle onto the pile.
    const shingle = new THREE.MeshStandardMaterial({ color: 0x5b4a44, roughness: 0.75, side: THREE.DoubleSide }), gableMat = siding.clone();
    this.roofMats.push(shingle, gableMat);
    this.roof.position.set(0, RIDGE, 0); this.scene.add(this.roof);
    const run = HZ + 0.45, rise = RIDGE - EAVE + 0.45 * (RIDGE - EAVE) / HZ, slope = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    for (const s of [-1, 1]) { const slab = box(this.roof, [2 * HX + 0.9, 0.08, slope], shingle, [0, -rise / 2, s * run / 2]); slab.rotation.x = s * ang; }
    const tri = new THREE.Shape(); tri.moveTo(-HZ, -(RIDGE - EAVE)); tri.lineTo(HZ, -(RIDGE - EAVE)); tri.lineTo(0, 0); tri.closePath();
    for (const s of [-1, 1]) { const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), gableMat); gm.rotation.y = Math.PI / 2; gm.position.x = s * (HX - 0.02); gm.castShadow = gm.receiveShadow = true; this.roof.add(gm); }
    box(this.roof, [0.5, 1.1, 0.5], surface(0x8a5a48, 0.8), [2.2, -0.3, -1.0]);
  }

  /** Loose-penny level above the house floor (0 until the crawlspace is full; 2.7 m when the house is full). */
  private fillLevel(t: number) { const v = pileShape(shownPennies(t)).volume; return Math.max(0, Math.min(WALL, (v - CRAWL) / AREA)); }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId;
    this.rig.apply(this.scene, this.camera, { sunDirection: SUN, sunIntensity: 7, sunColor: 0xfff1dc, skyAmount: 1, groundAmount: 1, envIntensity: 1, hazeDensity: 0.0012,
      focus: new THREE.Vector3(0, 1, 4), shadowHalfWidth: 22, shadowHalfHeight: 22, shadowDepth: 120 });
    const burst = t - T.houseBurst, wb = t - T.windowsBurst;
    // ---- walls fall outward one after another; the door blows open; window glass shatters out
    for (const { g, def } of this.walls) {
      const k = ease((burst - def.delay) / 0.55), tip = (Math.PI / 2 + 0.15) * k * k;
      g.position.copy(def.pivot); g.rotation.set(0, def.yaw, 0); g.rotateX(tip);
    }
    if (this.door) this.door.rotation.y = -2.0 * ease(wb / 0.25);
    for (const p of this.glass) p.visible = wb < 0;
    this.updateShards(wb);
    // ---- the pile: inside the house up to the sills (day 28), filling it (day 29), pouring out of the openings, then
    // the walls go and day 30's mound buries the lot
    const L = this.fillLevel(t), grow = ease(burst / 0.9);
    const R = D30.radius * (0.42 + 0.58 * grow), Hm = D30.height * (0.78 + 0.22 * grow);
    const spoutR = (s: Spout) => (s.door ? 2.3 : 1.5) * ease(wb / 1.6) * (1 - grow * 0);
    const h = (x: number, z: number) => {
      let v = 0;
      // Inside the walls the pennies fill the rooms; once the walls go, that block slumps into the growing mound.
      if (Math.abs(x) < HX - 0.15 && Math.abs(z) < HZ - 0.15 && burst < 0.6) v = (FLOOR + L + 0.35 * Math.max(0, 1 - Math.hypot(x + 0.5, z) / 4) * Math.min(1, L) - 0.02) * (1 - ease(burst / 0.45));
      for (const s of this.spouts) { const rr = spoutR(s); if (rr > 0) v = Math.max(v, heapProfile(Math.hypot(x - s.foot.x, z - s.foot.z), rr, rr * D30.tan)); }
      if (burst > 0) v = Math.max(v, heapProfile(Math.hypot(x, z), R, Hm) * (1 + 0.035 * heapNoise(x, z, 2.6, 9)));
      return v;
    };
    this.heap.mesh.position.set(0, 0, 0);
    this.heap.update(burst > 0 ? R * 1.07 + 0.5 : 9, h, 0.004);
    // ---- x-ray (S08): the shell added on day 30 glows translucent gold around the day-29 core
    const xr = sc === 'S08' ? ease((t - T.cutaway) / 0.6) : 0;
    this.heap.mesh.material = xr > 0 ? this.xray : this.heapMat;
    this.xray.uniforms.uK.value = xr;
    this.core.mesh.visible = xr > 0;
    if (xr > 0) this.core.update(D29.radius * 1.07, (x, z) => heapProfile(Math.hypot(x, z), D29.radius, D29.height) * (1 + 0.035 * heapNoise(x, z, 2.6, 9)) - 0.03, 0.004);
    // ---- the roof rides down onto the pile and tilts; translucent in the x-ray view
    const rk = ease((burst - 0.15) / 0.8);
    // It comes to rest riding on the mound: slabs clear of the pile's flanks, eaves just above them.
    this.roof.position.set(0.4 * rk, RIDGE - (RIDGE - 5.0) * rk, -0.2 * rk);
    this.roof.rotation.set(0.03 * rk, 0.12 * rk, -0.07 * rk);
    for (const l of this.lamps) l.intensity = burst < 0.1 ? 9 : 0;
    this.floorSlab.visible = burst < 0.15; this.ceiling.visible = burst < 0.3;
    // In the x-ray view the debris fades away so the two volumes read cleanly.
    for (const { g } of this.walls) g.visible = xr < 0.5;
    for (const mt of this.roofMats) { mt.transparent = xr > 0; mt.opacity = 1 - xr; mt.depthWrite = xr === 0; }
    this.roof.visible = xr < 0.98;
    this.updateCoins(t, h, burst, xr);
    // The briefcase is the S09 comparison only.
    this.brief.root.visible = sc === 'S09';
  }

  /** Window glass blown out when the house fills (day 29), landing on the lawn. */
  private updateShards(wb: number) {
    const panes = this.glass, e = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 420; i++) {
      const [a, b, c, d, f] = this.shardSeed[i], pane = panes[i % panes.length];
      if (wb < 0) { this.shards.setMatrixAt(i, zero); continue; }
      // Launch points use the wall's standing frame, so landed glass stays put when the walls later fall.
      const def = this.paneWall[i % panes.length], Y = new THREE.Vector3(0, 1, 0);
      const w = (pane.geometry as THREE.PlaneGeometry).parameters, local = new THREE.Vector3((a - 0.5) * w.width, (b - 0.5) * w.height, 0).add(pane.position);
      const start = local.applyAxisAngle(Y, def.yaw).add(def.pivot), out = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y, def.yaw);
      const vh = 2 + 4 * c, vy = 1 + 2.5 * d, tf = (vy + Math.sqrt(vy * vy + 2 * 9.8 * start.y)) / 9.8, tt = Math.min(wb, tf);
      P.copy(start).addScaledVector(out, vh * tt).add(new THREE.Vector3((f - 0.5) * 1.5 * tt, vy * tt - 4.9 * tt * tt, 0)); P.y = Math.max(0.01, P.y);
      e.set(tt * (8 + 10 * a), tt * (6 + 9 * b), wb >= tf ? Math.PI / 2 : tt * 7); if (wb >= tf) e.set(-Math.PI / 2, f * 6, 0);
      this.q.setFromEuler(e); this.m.compose(P, this.q, S.setScalar(0.6 + 0.8 * f)); this.shards.setMatrixAt(i, this.m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
  }

  /** Loose coins on the pile's surface, streams pouring out of the burst openings, and a scatter on the ground. */
  private updateCoins(t: number, h: (x: number, z: number) => number, burst: number, xr: number) {
    const P = new THREE.Vector3(), up = new THREE.Vector3();
    let k = 0;
    if (xr === 0) for (let i = 0; i < 5200; i++) {
      const s = this.coins.seeds[i], ang = s.a * 6.283;
      // Spread toward the toe of the pile and onto the ground around it, where the camera can see single coins.
      const rr = burst > 0 ? D30.radius * (0.55 + 0.6 * Math.sqrt(s.b)) : 0;
      if (rr === 0) break;
      const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr, y = h(x, z);
      if (y < 0.003) { if (s.c < 0.55 || burst < 0.8) continue; P.set(x, 0.002, z); up.set((s.d - 0.5) * 0.3, 1, (s.e - 0.5) * 0.3).normalize(); }
      else { heightNormal(h, x, z, 0.05, up); up.x += (s.c - 0.5) * 0.8; up.z += (s.d - 0.5) * 0.8; up.normalize(); P.set(x, y + 0.002, z); }
      this.coins.place(k++, P, up, s.e * 6.283);
    }
    this.coins.finish(k);
    // Streams: coins tumbling from each burst opening toward its growing cone, until the walls go.
    let f = 0;
    const wb = t - T.windowsBurst;
    if (wb > 0 && burst < 0.7) for (const sp of this.spouts) {
      for (let j = 0; j < (sp.door ? 260 : 150) && f < 1400; j++) {
        const s = this.flow.seeds[(j * 11 + (sp.door ? 7 : 0)) % 1400], ph = (wb * (1.4 + 0.6 * s.a) + s.b) % 1;
        if (wb < ph * 0.7) continue;
        const reach = sp.door ? 1.2 : 0.9, side = (s.c - 0.5) * (sp.door ? 0.9 : 1.0);
        const lateral = new THREE.Vector3(-sp.out.z, 0, sp.out.x).multiplyScalar(side);
        P.copy(sp.lip).addScaledVector(sp.out, reach * ph).add(lateral); P.y = sp.lip.y - (sp.lip.y - FLOOR * 0.5) * ph * ph + 0.04 * Math.sin(ph * 9 + s.d * 6);
        up.set(Math.sin(ph * 14 + s.e * 6), 0.6, Math.cos(ph * 12 + s.a * 6)).normalize();
        this.flow.place(f++, P, up, ph * 20);
      }
    }
    this.flow.finish(f);
  }

  /** World anchor of the pile's summit (for camera aims and the overlay). */
  summit() { return new THREE.Vector3(0, D30.height, 0); }
}
