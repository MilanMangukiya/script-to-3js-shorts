import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoomBox, chair, mug, plant } from '../../../library/environment/RoomBox';
import { surface, box, rod, solid, canvasTexture } from '../../../library/util/Modeling';
import { CoinHeap, CoinInstances, US_CENT, heapMaterial, heapProfile, heightNormal, heapNoise, pileShape, softMin } from '../../../library/props/CoinPile';
import { AshPuffs } from '../../../library/fx/AshCloud';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, dayAt, ease, shownPennies } from '../timeline';
import { Briefcase } from './Briefcase';

// Your kitchen, 1 unit = 1 m. RoomBox shell (open front at z = 0, interior toward −Z) with its own plank floor over a
// crawlspace. The table and the pile sit at C. The window is in the left (−X) wall; morning sun falls across the table.
const W = 4.6, H = 2.6, D = 5.4;
const C = new THREE.Vector3(0, 0, -2.6);
const TOP = 0.76, TW = 1.0, TD = 0.5;        // tabletop surface height and half-extents
const PIT = 0.75, HOLE = 1.7;                // crawlspace depth; radius of floor that gives way
const COINS = 8192, RAIN = 900, TH = US_CENT.thickness;
const SUN = new THREE.Vector3(-0.72, 0.62, 0.3).normalize();

interface Rest { p: THREE.Vector3; up: THREE.Vector3; spin: number }
interface Plank { x: number; z: number; len: number; dist: number; delay: number; roll: number; yaw: number; rim: boolean }

export class KitchenStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 9 / 16, 0.02, 120);
  private halves: { g: THREE.Group; side: number; legs: THREE.Object3D[] }[] = [];
  private planks: THREE.InstancedMesh; private plank: Plank[] = [];
  private joists: THREE.InstancedMesh; private joist: Plank[] = [];
  private coins = new CoinInstances(COINS, US_CENT, 21);
  private rain = new CoinInstances(RAIN, US_CENT, 22);
  private spill = new CoinInstances(1200, US_CENT, 23);
  private heap = new CoinHeap(heapMaterial(US_CENT, 4), 56, 112, 0.1);
  private rest: Rest[] = [];
  private brief = new Briefcase();
  private dust = new AshPuffs(90, { ashColor: 0xd8cfc2, ambient: 0xfff4e6, sunColor: 0xffe2b8, hazeColor: 0xd9d2c8, hazeDensity: 0 });
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private up = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.55;
    this.scene.background = new THREE.Color(0x1a1612);
    // ---- room shell (RoomBox walls and ceiling; its solid floor and seams are replaced by planks over a crawlspace)
    const room = new RoomBox({ width: W, height: H, depth: D, wallColor: 0xe6dccb, floorColor: 0x8a6a4a });
    for (const c of [...room.children]) if (c instanceof THREE.Mesh && c.position.y < 0.02) room.remove(c);
    // The walls receive light but cast no shadow, so the morning sun reaches the table as if through the window.
    room.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; });
    this.scene.add(room);
    const conc = surface(0x3b3936, 0.95);
    box(this.scene, [W, 0.05, D], surface(0x2a2826, 0.95), [0, -PIT - 0.025, -D / 2]);
    box(this.scene, [W, PIT, 0.1], conc, [0, -PIT / 2, -D]); box(this.scene, [W, PIT, 0.1], conc, [0, -PIT / 2, 0]);
    for (const s of [-1, 1]) box(this.scene, [0.1, PIT, D], conc, [s * W / 2, -PIT / 2, -D / 2]);
    // Plank floor: staggered 1.2 m oak boards, 0.11 m wide. Boards near the pile can fall into the crawlspace.
    const r = rng(77), pw = 0.11, cols = Math.round(W / pw);
    for (let i = 0; i < cols; i++) {
      const x = -W / 2 + pw * (i + 0.5); let z = -(i % 2) * 0.6 - r() * 0.25;
      while (z > -D) {
        const len = Math.min(1.2, z + D), zc = z - len / 2, dist = Math.hypot(x - C.x, zc - C.z);
        this.plank.push({ x, z: zc, len, dist, delay: 0.02 + (dist / HOLE) * 0.22 + r() * 0.05, roll: (r() - 0.5) * 2.4, yaw: (r() - 0.5) * 0.6, rim: dist >= HOLE && dist < HOLE + 0.32 });
        z -= len;
      }
    }
    const oak = new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.62 });
    this.planks = new THREE.InstancedMesh(new THREE.BoxGeometry(pw * 0.97, 0.022, 1), oak, this.plank.length);
    const tint = new THREE.Color();
    this.plank.forEach((p, i) => { const k = 0.82 + 0.3 * r(); this.planks.setColorAt(i, tint.setRGB(k, k * 0.97, k * 0.93)); });
    this.planks.castShadow = this.planks.receiveShadow = true; this.scene.add(this.planks);
    // Joists under the boards (seen only once the floor breaks), in 0.6 m pieces so the broken span can drop.
    for (let z = -0.3; z > -D + 0.2; z -= 0.4) for (let x = -W / 2 + 0.3; x < W / 2; x += 0.6) this.joist.push({ x, z, len: 0.6, dist: Math.hypot(x - C.x, z - C.z), delay: 0.04 + r() * 0.08, roll: (r() - 0.5) * 1.6, yaw: (r() - 0.5) * 0.9, rim: false });
    this.joists = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.18, 0.05), surface(0x7b5e40, 0.8), this.joist.length);
    this.joists.castShadow = this.joists.receiveShadow = true; this.scene.add(this.joists);
    // ---- kitchen: counters, upper cabinets, fridge, window, pendant lamp, chairs, a plant and a mug
    const cab = surface(0x7f9a8a, 0.55), stone = surface(0xe8e2d6, 0.35), handle = surface(0xb8b8b8, 0.3, 0.9);
    box(this.scene, [3.3, 0.88, 0.6], cab, [-0.45, 0.44, -D + 0.36]); box(this.scene, [3.36, 0.04, 0.64], stone, [-0.45, 0.9, -D + 0.38]);
    box(this.scene, [3.3, 0.6, 0.02], surface(0xf3efe7, 0.3), [-0.45, 1.22, -D + 0.07]);
    box(this.scene, [3.3, 0.72, 0.34], cab, [-0.45, 1.88, -D + 0.23]);
    for (let i = 0; i < 6; i++) { const x = -1.95 + i * 0.6; box(this.scene, [0.012, 0.86, 0.01], surface(0x5c7468, 0.6), [x + 0.3, 0.44, -D + 0.665]); rod(this.scene, [x + 0.22, 0.75, -D + 0.68], [x + 0.38, 0.75, -D + 0.68], 0.008, handle); }
    box(this.scene, [0.5, 0.02, 0.38], surface(0x4b4f52, 0.25, 0.7), [-0.6, 0.915, -D + 0.38]);
    box(this.scene, [0.74, 1.82, 0.68], surface(0xdfe2e3, 0.3, 0.2), [1.86, 0.91, -D + 0.4]);
    rod(this.scene, [1.53, 0.95, -D + 0.75], [1.53, 1.55, -D + 0.75], 0.012, handle);
    plant(this.scene, [-1.7, 0.92, -D + 0.38], 0.9); mug(this.scene, [0.55, 0.92, -D + 0.4], 0xe9d9b9);
    // Window in the left wall: frame, mullions and a bright garden view beyond.
    const wz = -2.7, wy = 1.5, ww = 1.6, wh = 1.15, frame = surface(0xf4f1ea, 0.5);
    const view = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.7, 1.9) }));
    view.position.set(-W / 2 + 0.065, wy, wz); view.rotation.y = Math.PI / 2; this.scene.add(view);
    for (const dy of [-wh / 2, wh / 2]) box(this.scene, [0.14, 0.06, ww + 0.06], frame, [-W / 2 + 0.07, wy + dy, wz]);
    for (const dz of [-ww / 2, 0, ww / 2]) box(this.scene, [0.14, wh, 0.05], frame, [-W / 2 + 0.07, wy, wz + dz]);
    const lamp = new THREE.Group(); lamp.position.set(0, 2.05, C.z); this.scene.add(lamp);
    rod(lamp, [0, 0, 0], [0, 0.55, 0], 0.006, surface(0x222222, 0.5));
    solid(lamp, new THREE.ConeGeometry(0.22, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f3b36, roughness: 0.5, side: THREE.DoubleSide }), [0, 0, 0]);
    const bulb = new THREE.PointLight(0xffd7a0, 2.2, 6, 2); bulb.position.set(0, -0.08, 0); lamp.add(bulb);
    chair(this.scene, -TW - 0.35, C.z, Math.PI / 2, 0x6f5438); chair(this.scene, TW + 0.35, C.z, -Math.PI / 2, 0x6f5438);
    // ---- lights: sun through the window, sky fill, warm bounce
    const sun = new THREE.DirectionalLight(0xfff0d8, 3.2); sun.position.copy(C).addScaledVector(SUN, 8); sun.target.position.copy(C);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 }); this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0xdfe8f4, 0x6b5440, 0.55));
    // ---- the table: two halves (top + two legs each) that can crack in the middle and fold into the pile
    const grain = canvasTexture(512, 256, (g) => { const r2 = rng(19); g.fillStyle = '#5a3a26'; g.fillRect(0, 0, 512, 256); for (let i = 0; i < 160; i++) { const y = r2() * 256; g.strokeStyle = `rgba(${r2() < 0.5 ? '30,16,8' : '120,80,50'},${0.18 + 0.2 * r2()})`; g.lineWidth = 0.6 + r2() * 1.8; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.012 + i) * (2 + r2() * 4)); g.stroke(); } });
    const walnut = new THREE.MeshStandardMaterial({ map: grain, color: 0xffffff, roughness: 0.42 });
    for (const side of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(C.x + side * TW, TOP, C.z); this.scene.add(g);
      box(g, [TW, 0.05, 2 * TD], walnut, [-side * TW / 2, -0.025, 0]);
      const legs: THREE.Object3D[] = [];
      for (const lz of [-TD + 0.08, TD - 0.08]) {
        const leg = new THREE.Group(); leg.position.set(-side * 0.1, -0.05, lz); g.add(leg);
        box(leg, [0.07, TOP - 0.05, 0.07], walnut, [0, -(TOP - 0.05) / 2, 0]); legs.push(leg);
      }
      this.halves.push({ g, side, legs });
    }
    // ---- the briefcase of cash beside the penny, the pile and its flying coins
    this.brief.root.position.set(0.03, TOP, C.z - 0.42); this.brief.root.rotation.y = -0.08; this.scene.add(this.brief.root);
    this.heap.mesh.position.copy(C); this.scene.add(this.heap.mesh, this.coins.mesh, this.rain.mesh, this.spill.mesh);
    this.dust.mesh.renderOrder = 10; this.scene.add(this.dust.mesh);
    this.dust.setLook({ sun: SUN, light: 0.8 });
    this.buildRests();
  }

  /** Where each of the first 8,192 pennies comes to rest (relative to the pile centre on its support). */
  private buildRests() {
    const n = new THREE.Vector3();
    for (let i = 0; i < COINS; i++) {
      const s = this.coins.seeds[i];
      if (i < 16) {
        // The first pennies lie flat in a loose cluster, stacking where they overlap an earlier one.
        const rr = i === 0 ? 0 : 0.0148 * Math.sqrt(i), a = i * 2.39996;
        const p = new THREE.Vector3(Math.cos(a) * rr, TH / 2, Math.sin(a) * rr);
        for (let j = 0; j < i; j++) if (Math.hypot(p.x - this.rest[j].p.x, p.z - this.rest[j].p.z) < US_CENT.diameter * 0.95) p.y = Math.max(p.y, this.rest[j].p.y + TH);
        const up = new THREE.Vector3((s.c - 0.5) * 0.12, 1, (s.d - 0.5) * 0.12).normalize();
        this.rest.push({ p, up, spin: s.e * Math.PI * 2 });
        continue;
      }
      const day = Math.floor(Math.log2(i)) + 2, { radius: R, height: Hh } = pileShape(2 ** (day - 1));
      const rr = R * 0.93 * Math.sqrt(s.a), a = s.b * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const prof = (xx: number, zz: number) => heapProfile(Math.hypot(xx, zz), R, Hh);
      heightNormal(prof, x, z, R * 0.05, n);
      const up = n.clone().add(new THREE.Vector3((s.c - 0.5) * 0.9, 0, (s.d - 0.5) * 0.9)).normalize();
      this.rest.push({ p: new THREE.Vector3(x, prof(x, z) * (0.86 + 0.14 * s.c) + TH * 0.6, z), up, spin: s.e * Math.PI * 2 });
    }
  }

  update(t: number, _shot: ShotInfo) {
    const d = dayAt(t), n = shownPennies(t), shape = pileShape(n), R = shape.radius, Hh = shape.height;
    // ---- table: creaks, cracks in the middle, then folds to the floor
    const snap = Math.max(0, Math.min(1, (t - T.tableSnap) / 0.45)), sag = t < T.tableSnap ? 0.035 * ease((t - T.tableCreak) / (T.tableSnap - T.tableCreak)) : 0;
    for (const h of this.halves) {
      const crack = 0.44 * ease(snap / 0.25), fall = ease((snap - 0.2) / 0.8);
      h.g.position.set(C.x + h.side * TW * (1 + 0.12 * fall), TOP * (1 - fall) + 0.03 * fall, C.z);
      h.g.rotation.set(0, 0, h.side * (sag + crack * (1 - 0.75 * fall)));
      for (const leg of h.legs) leg.rotation.z = h.side * 1.35 * fall;
    }
    // ---- pile support: the tabletop, the floor after the table goes, the crawlspace after the floor goes
    const fallT = (t - T.tableSnap - 0.1) / 0.32, dropT = (t - T.floorBreak - 0.05) / 0.35;
    const floorSag = this.sag(t);
    const baseY = t < T.tableSnap + 0.1 ? TOP : t < T.floorBreak + 0.05 ? TOP * Math.max(0, 1 - Math.min(1, fallT) ** 2) - floorSag : -floorSag - (PIT - floorSag) * Math.min(1, Math.max(0, dropT) ** 2);
    const onTable = 1 - ease(fallT * 1.4);
    const cell = Math.max(0.04, R * 0.35);
    const h = (x: number, z: number) => {
      let v = heapProfile(Math.hypot(x, z), R, Hh) * (1 + 0.05 * heapNoise(x, z, cell));
      if (onTable > 0) { const e = Math.min(TW - Math.abs(x), TD - Math.abs(z)) * shape.tan * 1.15 + 0.003; v = v + (softMin(v, Math.max(0, e), 0.01) - v) * onTable; }
      return v;
    };
    const big = d >= 15, showHeap = n >= 512;
    this.heap.mesh.position.set(C.x, baseY, C.z);
    if (showHeap) this.heap.update(R * 1.07, big ? h : (x, z) => h(x / 0.93, z / 0.93) * 0.9); else this.heap.mesh.visible = false;
    // ---- pennies: each new one hops out of its twin (first two weeks), then a coat of loose coins on the heap
    const P = new THREE.Vector3();
    if (!big) {
      for (let i = 0; i < COINS; i++) {
        const di = i === 0 ? 1 : Math.floor(Math.log2(i)) + 2;
        if (di > d) { this.coins.hide(i); continue; }
        const s = this.coins.seeds[i], start = T.days[di - 1] + (i === 0 ? -1 : s.a * 0.16), k = (t - start) / 0.28, rest = this.rest[i];
        if (k < 0) { this.coins.hide(i); continue; }
        if (k >= 1 || i === 0) { P.copy(rest.p).add(C).setY(rest.p.y + baseY); this.coins.place(i, P, rest.up, rest.spin); continue; }
        const par = this.rest[i - 2 ** (di - 2)], e = ease(k);
        P.lerpVectors(par.p, rest.p, e).add(C); P.y = baseY + par.p.y + (rest.p.y - par.p.y) * e + (0.03 + 0.03 * s.b) * 4 * k * (1 - k);
        this.up.copy(par.up).lerp(rest.up, e).normalize();
        this.coins.place(i, P, this.up, rest.spin + (1 - e) * 9);
      }
      this.coins.finish(COINS);
    } else {
      let shown = 0;
      for (let i = 0; i < COINS; i++) {
        const s = this.coins.seeds[i], rr = R * 1.02 * Math.sqrt(s.a), a = s.b * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = h(x, z);
        if (y <= 0.004) { this.coins.hide(i); continue; }
        heightNormal(h, x, z, Math.max(0.01, R * 0.03), this.up);
        this.up.x += (s.c - 0.5) * 0.9; this.up.z += (s.d - 0.5) * 0.9; this.up.normalize();
        P.set(C.x + x, baseY + y + TH * 0.4, C.z + z); this.coins.place(i, P, this.up, s.e * 6.283 + d); shown++;
      }
      this.coins.finish(COINS); void shown;
    }
    this.updateRain(t, d, R, Hh, baseY, h);
    this.updateSpill(t, R, onTable, baseY, h);
    this.updateFloor(t);
    // ---- the briefcase: open beside the penny, shut at T.caseClose, then carried away out of frame
    const close = ease((t - T.caseClose) / 0.35), away = ease((t - T.caseClose - 0.4) / (T.caseGone - T.caseClose - 0.4));
    this.brief.setOpen(1 - close);
    this.brief.root.visible = t < T.caseGone + 0.2;
    this.brief.root.position.set(0.03 + 1.1 * away, TOP + 0.12 * Math.sin(Math.PI * away), C.z - 0.42 - 0.15 * away);
    this.brief.root.rotation.set(0, -0.08 - 0.3 * away, 0);
    // ---- dust where the table and the floor give way
    const puffs: { x: number; y: number; z: number; size: number; alpha: number; glow: number; seed: number }[] = [];
    for (const [at, y0, rad] of [[T.tableSnap + 0.35, 0.05, 1.0], [T.floorBreak + 0.25, 0.0, HOLE]] as const) {
      const a = t - at; if (a < 0 || a > 2.2) continue;
      for (let i = 0; i < 40; i++) { const ang = i * 2.399, rr = rad * (0.5 + 0.5 * ((i * 0.618) % 1)) * (0.8 + 0.5 * (1 - Math.exp(-a * 2)));
        puffs.push({ x: C.x + Math.cos(ang) * rr, y: y0 + 0.08 + a * 0.18 + (i % 5) * 0.03, z: C.z + Math.sin(ang) * rr, size: 0.25 + a * 0.35, alpha: 0.12 * Math.min(1, a * 6) * Math.max(0, 1 - a / 2.2), glow: 0, seed: (i * 0.37) % 1 }); }
    }
    this.dust.set(puffs, this.camera);
  }

  /** Coins pouring onto the heap at each doubling (day 15 on) and splashing out when the table and the floor fail. */
  private updateRain(t: number, d: number, R: number, Hh: number, baseY: number, h: (x: number, z: number) => number) {
    let k = 0;
    const P = new THREE.Vector3(), up = new THREE.Vector3();
    // Pours: the new day's coins arrive from above over 0.5 s.
    for (let day = 15; day <= Math.min(d, 25) && k < RAIN; day++) {
      const at = T.days[day - 1], a = t - at; if (a < 0 || a > 0.6) continue;
      for (let j = 0; j < 280 && k < RAIN; j++) {
        const s = this.rain.seeds[(j * 7 + day * 13) % RAIN], dur = 0.3 + 0.2 * s.a, tau = (a - s.b * 0.2) / dur;
        if (tau < 0 || tau > 1) continue;
        const ang = s.c * 6.283, rl = R * 0.85 * Math.sqrt(s.d), xl = Math.cos(ang) * rl, zl = Math.sin(ang) * rl, yl = h(xl, zl);
        const y0 = Hh + 0.45 + 0.6 * s.e;
        P.set(C.x + xl * (0.4 + 0.6 * tau), baseY + y0 + (yl - y0) * tau * tau, C.z + zl * (0.4 + 0.6 * tau));
        up.set(Math.sin(s.e * 9 + tau * 8), 1, Math.cos(s.a * 9 + tau * 7)).normalize();
        this.rain.place(k++, P, up, tau * 12);
      }
    }
    // Splashes: coins thrown off the table edge as it folds, and out of the hole as the floor drops.
    for (const [at, y0, spread, count, table] of [[T.tableSnap + 0.12, TOP, 1.0, 380, true], [T.floorBreak + 0.06, 0.02, 1.4, 320, false]] as const) {
      const a = t - at; if (a < 0) continue;
      for (let j = 0; j < count && k < RAIN; j++) {
        const s = this.rain.seeds[(j * 3 + 400) % RAIN], ang = s.a * 6.283, r0 = spread * (0.3 + 0.7 * Math.sqrt(s.b)) * (table ? 1 : 0.8);
        const x0 = Math.cos(ang) * (table ? Math.min(r0, TW) : r0), z0 = Math.sin(ang) * (table ? Math.min(r0, TD) : r0);
        const vh = 0.6 + 1.6 * s.c, vy = 0.8 + 1.8 * s.d, tf = (vy + Math.sqrt(vy * vy + 2 * 9.8 * y0)) / 9.8, tt = Math.min(a, tf);
        const x = x0 + Math.cos(ang) * vh * tt, z = z0 + Math.sin(ang) * vh * tt, y = Math.max(0, y0 + vy * tt - 4.9 * tt * tt) + TH / 2;
        // Landed coins stay where they fell until the growing heap buries them.
        // Coins thrown up from the hole fall back in; coins off the table rest on the floor.
        const landed = a >= tf, under = h(x, z) + baseY > y + 0.004;
        if (landed && (!table || under || a > 6)) continue;
        up.set(landed ? (s.e - 0.5) * 0.2 : Math.sin(tt * 11 + s.e * 6), 1, landed ? (s.a - 0.5) * 0.2 : Math.cos(tt * 9 + s.b * 6)).normalize();
        P.set(C.x + x, landed ? Math.max(TH / 2, y) : y, C.z + z);
        this.rain.place(k++, P, up, s.e * 6.283 + tt * 10);
      }
    }
    this.rain.finish(k);
  }

  /** Boards and joists over the crawlspace; those under the pile drop in when the floor gives way. */
  private updateFloor(t: number) {
    const e = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
    this.plank.forEach((p, i) => {
      const a = t - T.floorBreak - p.delay;
      let y = -0.011, rx = 0, rz = 0;
      const bowl = this.sag(t) * Math.max(0, 1 - (p.dist / (HOLE + 0.3)) ** 2); y -= bowl;
      if (p.dist < HOLE && a > 0) { const fall = Math.min(1, a / 0.38); y = -0.011 - bowl - (PIT - 0.06) * fall * fall; rz = p.roll * ease(fall); rx = p.yaw * ease(fall); }
      else if (p.rim && a > 0) { const k = ease(a / 0.25), toward = Math.sign(C.x - p.x) || 1; rz = toward * 0.22 * k * (1 - (p.dist - HOLE) / 0.32); y = -0.011 - 0.06 * k; }
      e.set(rx, 0, rz); this.q.setFromEuler(e); P.set(p.x, y, p.z); S.set(1, 1, p.len);
      this.m.compose(P, this.q, S); this.planks.setMatrixAt(i, this.m);
    });
    this.planks.instanceMatrix.needsUpdate = true;
    this.joist.forEach((j, i) => {
      const a = t - T.floorBreak - j.delay; let y = -0.12, rz = 0, rx = 0;
      if (j.dist < HOLE - 0.1 && a > 0) { const fall = Math.min(1, a / 0.4); y = -0.12 - (PIT - 0.2) * fall * fall; rz = j.roll * ease(fall); rx = j.yaw * 0.4 * ease(fall); }
      e.set(rx, 0, rz); this.q.setFromEuler(e); P.set(j.x, y, j.z); S.set(1, 1, 1);
      this.m.compose(P, this.q, S); this.joists.setMatrixAt(i, this.m);
    });
    this.joists.instanceMatrix.needsUpdate = true;
  }

  /** How far the floor under the pile has sagged (m): from day 21 until it gives way. */
  private sag(t: number) { return t >= T.floorBreak ? 0.04 : 0.04 * ease((t - T.days[20]) / (T.floorBreak - T.days[20])); }

  /**
   * Once the heap is wider than the tabletop (days 18-19), the overflow slides off the edges: streams of coins fall
   * from the rim and a skirt of loose coins builds on the floor around the table.
   */
  private updateSpill(t: number, R: number, onTable: number, baseY: number, h: (x: number, z: number) => number) {
    const over = Math.max(0, Math.min(1, (R - TD) / (0.74 - TD))) * (t < T.tableSnap + 0.1 ? 1 : 0), P = new THREE.Vector3(), up = new THREE.Vector3();
    let k = 0;
    const landed = Math.round(1200 * 0.6 * over);
    for (let i = 0; i < 1200 && k < 1200; i++) {
      const s = this.spill.seeds[i];
      // Where on the rim this coin leaves the table, and where it lands on the floor just outside.
      const side = Math.floor(s.a * 4), u = s.b * 2 - 1, ex = side < 2 ? (side ? TW : -TW) : u * TW, ez = side < 2 ? u * TD : (side === 2 ? TD : -TD);
      const nx = side < 2 ? Math.sign(ex) : 0, nz = side < 2 ? 0 : Math.sign(ez), dist = 0.03 + 0.32 * s.c * s.c;
      if (i < landed) {
        const x = ex + nx * dist + (s.d - 0.5) * 0.06, z = ez + nz * dist + (s.e - 0.5) * 0.06;
        if (t >= T.tableSnap && h(x, z) + baseY > 0.006) continue;
        P.set(C.x + x, TH / 2 + Math.floor(s.d * 3) * TH * (1 - s.c), C.z + z); up.set((s.e - 0.5) * 0.5, 1, (s.a - 0.5) * 0.5).normalize();
        this.spill.place(k++, P, up, s.e * 6.283); continue;
      }
      if (i < 900 || over === 0 || onTable < 0.5) continue;
      // Falling stream coins, cycling.
      const ph = (t * (1.3 + s.d) + s.e) % 1;
      P.set(C.x + ex + nx * (0.02 + 0.12 * ph), TOP - TOP * ph * ph, C.z + ez + nz * (0.02 + 0.12 * ph));
      up.set(Math.sin(ph * 13 + s.a * 6), 0.5, Math.cos(ph * 11 + s.b * 6)).normalize();
      this.spill.place(k++, P, up, ph * 18);
    }
    this.spill.finish(k);
  }

  /** Where the S01 callout points: just above the open briefcase. */
  briefAnchor() { return this.brief.root.position.clone().add(new THREE.Vector3(0, 0.22, 0)); }

  /** World position of the pile's top (for camera aims and callouts). */
  pileTop(t: number) { const s = pileShape(shownPennies(t)); return new THREE.Vector3(C.x, (t < T.tableSnap ? TOP : t < T.floorBreak ? 0 : -PIT) + s.height, C.z); }
}
