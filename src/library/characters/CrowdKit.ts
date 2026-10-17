import * as THREE from 'three';
import { rng } from '../util/math';
import { HumanV2, walkPose, idlePose, type HumanV2Options, type HairStyle, type Top } from './HumanV2';
import { POSE_STAND, type HumanoidPose } from './Humanoid';
import type { PBRLibrary } from '../materials/PBR';

/**
 * crowd-kit-v1 — lively, varied crowds built on human-figure-v2 (metres, Y up, people face +Z at rest):
 *  - `diversePerson(seed, { vibe })`: a much wider casting range than HumanV2.random — children and elders, every skin
 *    tone, eleven hair styles, and outfit palettes per vibe (everyday, night-out sparkle, tourist, business, winter,
 *    summer), plus accessories (glowing phone, backpack, tote, coffee cup, umbrella, shopping bags, camera).
 *  - Behaviour poses (pure functions of time + seed): walk, idle, talk (gesturing), phone (head down, screen lit),
 *    photo (phone held up), wave, cheer (arms up, bouncing), dance (beat-locked, several styles), look-up (tourists).
 *  - `Crowd`: path-following walkers (distance-locked stride, both directions, lateral lanes) plus standing groups
 *    (talk circles, photographers aimed at a target, dancers around a point). Deterministic `update(t)`.
 *  - `CrowdImpostors`: hundreds of instanced low-cost walking figures for far background density.
 */
export type Activity = 'walk' | 'idle' | 'talk' | 'phone' | 'photo' | 'wave' | 'cheer' | 'dance' | 'lookup';
export type Vibe = 'everyday' | 'nightout' | 'tourist' | 'business' | 'winter' | 'summer';
export type Accessory = 'phone' | 'backpack' | 'tote' | 'coffee' | 'umbrella' | 'bags' | 'camera';

const SKIN = [0x3b2519, 0x4e3324, 0x5e3b27, 0x6a432d, 0x7b4e33, 0x87573a, 0x9a6444, 0xa46e4c, 0xb98260, 0xc99572, 0xd8a886, 0xe2b48f, 0xe7bfa0, 0xf0cfb6, 0xf5dcc6];
const HAIR_YOUNG = [0x120d0b, 0x1b1411, 0x2a1d15, 0x3d2a1c, 0x5a3c25, 0x8a5f3a, 0xb58a52, 0xd6b47a, 0xe8cf9a, 0x161616, 0x7a2b1c];
const HAIR_FUN = [0xd6457a, 0x4a8fe0, 0x8a4fd8, 0x2fb59a, 0xf0b33c];
const HAIR_OLD = [0xc9c4bc, 0xa7a29a, 0xe2ded7, 0x8d8780];
const PALETTE: Record<Vibe, number[]> = {
  everyday: [0x2f4f6f, 0xb04a3c, 0xe2c26a, 0x3f6e4f, 0xd7d2c8, 0x23283a, 0x7b4b8f, 0xd9895b, 0x5c88b6, 0xf2efe9, 0x8c3a46, 0x37605f, 0xc4a484, 0x6d7f45],
  nightout: [0xe8308a, 0x2f6bff, 0xd4af37, 0xc0c4cc, 0x101014, 0xb3122e, 0x0fa07f, 0x7a2fd0, 0xff7a1a, 0xf4f1ea, 0x1d1d6b, 0xff4f5e],
  tourist: [0xf2efe9, 0x5c88b6, 0xe2c26a, 0x3f9e6f, 0xd9545b, 0xf28c28, 0x7fb3d5, 0x9bc46a, 0xffd23f],
  business: [0x23283a, 0x3a4250, 0x5a6270, 0x1c2a3f, 0x6b6250, 0xd7d2c8, 0x2b2b2b, 0x4f5d75],
  winter: [0x7a1f2b, 0x23283a, 0x3d5a3c, 0x8a6a48, 0x2f4f6f, 0xd9d4ca, 0x4a3b5c, 0xb3542d],
  summer: [0xff9f43, 0x48dbfb, 0xff6b9d, 0x1dd1a1, 0xfeca57, 0xf2efe9, 0x54a0ff, 0xee5253],
};

/** A seeded, broadly varied person; `extra` overrides any field. */
export function diversePerson(seed: number, o: { vibe?: Vibe; childShare?: number; elderShare?: number } = {}, extra: Partial<HumanV2Options> = {}): HumanV2Options & { accessories: Accessory[] } {
  const r = rng(seed * 104729 + 7), pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length) % a.length], vibe = o.vibe ?? 'everyday';
  const ageRoll = r(), age: 'child' | 'adult' | 'elder' = ageRoll < (o.childShare ?? 0.1) ? 'child' : ageRoll > 1 - (o.elderShare ?? 0.12) ? 'elder' : 'adult';
  const sex = r() < 0.5 ? 'female' : 'male', P = PALETTE[vibe];
  const styles: HairStyle[] = sex === 'female' ? ['long', 'bob', 'ponytail', 'bun', 'curly', 'afro', 'headscarf', 'short', 'long', 'curly'] : ['short', 'side-part', 'buzz', 'curly', 'bald', 'afro', 'short', 'side-part'];
  const hairColor = age === 'elder' ? pick(HAIR_OLD) : vibe === 'nightout' && r() < 0.18 ? pick(HAIR_FUN) : pick(HAIR_YOUNG);
  const tops: Record<Vibe, [Top[], Top[]]> = {
    everyday: [['tshirt', 'blouse', 'longsleeve', 'jacket', 'dress', 'hoodie', 'coat'], ['tshirt', 'shirt', 'longsleeve', 'jacket', 'hoodie', 'coat']],
    nightout: [['dress', 'dress', 'blouse', 'tank', 'jacket'], ['shirt', 'jacket', 'tshirt', 'shirt']],
    tourist: [['tshirt', 'tank', 'blouse', 'hoodie'], ['tshirt', 'tshirt', 'shirt', 'hoodie']],
    business: [['blouse', 'jacket', 'coat', 'dress'], ['shirt', 'jacket', 'coat']],
    winter: [['coat', 'jacket', 'hoodie'], ['coat', 'jacket', 'hoodie']],
    summer: [['tank', 'tshirt', 'dress', 'blouse'], ['tshirt', 'tank', 'shirt']],
  };
  const top = pick(tops[vibe][sex === 'female' ? 0 : 1]);
  const bottom = top === 'dress' ? 'none' : vibe === 'summer' || (vibe === 'tourist' && r() < 0.5) ? pick(['shorts', 'shorts', sex === 'female' ? 'skirt' : 'jeans'] as const)
    : vibe === 'business' ? pick(['trousers', 'trousers', sex === 'female' ? 'skirt' : 'trousers'] as const) : pick(sex === 'female' ? ['jeans', 'trousers', 'skirt', 'jeans'] as const : ['jeans', 'trousers', 'jeans'] as const);
  const hat = vibe === 'winter' ? (r() < 0.55 ? 'beanie' : null) : vibe === 'tourist' || vibe === 'summer' ? (r() < 0.35 ? pick(['cap', 'sunhat'] as const) : null) : r() < 0.08 ? pick(['cap', 'beanie'] as const) : null;
  const acc: Accessory[] = [];
  const add = (a: Accessory, p: number) => { if (r() < p && !acc.includes(a)) acc.push(a); };
  add('phone', vibe === 'nightout' ? 0.45 : 0.3); add('backpack', vibe === 'tourist' ? 0.55 : age === 'child' ? 0.4 : 0.14); add('tote', sex === 'female' ? 0.3 : 0.08);
  add('coffee', vibe === 'business' || vibe === 'everyday' ? 0.18 : 0.04); add('bags', vibe === 'everyday' || vibe === 'tourist' ? 0.1 : 0); add('camera', vibe === 'tourist' ? 0.3 : 0.02);
  if (vibe === 'winter') add('umbrella', 0.25);
  const height = age === 'child' ? 1.05 + r() * 0.35 : (sex === 'female' ? 1.6 : 1.73) + (r() - 0.5) * 0.16 - (age === 'elder' ? 0.03 : 0);
  return {
    sex, age, build: age === 'child' ? 'slim' : pick(['slim', 'average', 'average', 'athletic', 'heavy', 'average'] as const), skin: pick(SKIN), eyes: pick([0x3b2a1f, 0x2b1d14, 0x4a5d3a, 0x3a5a7a, 0x5a3e2a, 0x6a7d8a]),
    hair: { style: age === 'child' && pick([0, 1]) ? (sex === 'female' ? 'ponytail' : 'short') : pick(styles), color: hairColor },
    top, topColor: pick(P), bottom, bottomColor: vibe === 'nightout' ? pick([0x101014, 0x1d2129, 0x2c3a52, 0x3a2a4a]) : pick([0x2c3a52, 0x1d2129, 0x4a4136, 0x6b6250, 0x30475e, 0x8a7a63, 0xc4b59a]),
    shoes: vibe === 'summer' ? pick(['sandals', 'sneakers'] as const) : vibe === 'business' || vibe === 'nightout' ? pick(['dress', 'dress', 'boots'] as const) : pick(['sneakers', 'sneakers', 'boots'] as const),
    shoeColor: pick([0xeeeae2, 0x2a2420, 0x5a3a26, 0x3a4250, 0xb3122e]), glasses: r() < (age === 'elder' ? 0.55 : 0.2), beard: sex === 'male' && age !== 'child' && r() < 0.32,
    hat, hatColor: pick(P), height, seed, accessories: acc, ...extra,
  };
}

// ---- accessories (attached to HumanV2 anchors; metres)
const accMats = () => ({
  dark: new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.4, metalness: 0.3 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x0c1830, emissive: 0x7fb4ff, emissiveIntensity: 1.6, roughness: 0.2 }),
});
function attachAccessories(h: HumanV2, list: Accessory[], seed: number) {
  const r = rng(seed + 31), m = accMats(), cloth = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...p); mesh.rotation.set(...rot); mesh.castShadow = true; parent.add(mesh); return mesh; };
  const out: { phone?: THREE.Object3D; screen?: THREE.MeshStandardMaterial } = {};
  for (const a of list) {
    if (a === 'phone') { const g = new THREE.Group(); g.position.set(0, 0.0, 0.025); h.handR.add(g); add(g, new THREE.BoxGeometry(0.072, 0.15, 0.009), m.dark, [0, 0, 0]); const s = add(g, new THREE.PlaneGeometry(0.064, 0.138), m.screen, [0, 0, 0.0047]); s.castShadow = false; out.phone = g; out.screen = m.screen; }
    if (a === 'backpack') { const c = cloth([0x23283a, 0x7a1f2b, 0x3f6e4f, 0xe2c26a, 0x2f6bff][Math.floor(r() * 5)]); add(h.backAnchor, new THREE.BoxGeometry(0.3, 0.4, 0.14).translate(0, -0.06, -0.06), c, [0, 0, 0]); add(h.backAnchor, new THREE.BoxGeometry(0.24, 0.16, 0.05), c, [0, -0.16, -0.15]); }
    if (a === 'tote') { const c = cloth([0xc4a484, 0x23283a, 0xb04a3c, 0xf2efe9][Math.floor(r() * 4)]); const g = new THREE.Group(); h.handL.add(g); add(g, new THREE.BoxGeometry(0.06, 0.32, 0.34).translate(0, -0.2, 0), c, [0.03, 0, 0]); add(g, new THREE.TorusGeometry(0.06, 0.008, 6, 16, Math.PI), c, [0.03, -0.04, 0], [0, Math.PI / 2, 0]); }
    if (a === 'coffee') { const g = new THREE.Group(); h.handR.add(g); add(g, new THREE.CylinderGeometry(0.04, 0.032, 0.13, 16), cloth(0xf2efe9), [0, -0.02, 0.03]); add(g, new THREE.CylinderGeometry(0.042, 0.042, 0.015, 16), cloth(0x3a2a1c), [0, 0.05, 0.03]); }
    if (a === 'umbrella') { const g = new THREE.Group(); h.handL.add(g); add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.95, 8).translate(0, 0.4, 0), m.dark, [0, 0, 0.02]); add(g, new THREE.ConeGeometry(0.55, 0.22, 16, 1, true), new THREE.MeshStandardMaterial({ color: [0x111111, 0x7a1f2b, 0x2f4f6f, 0xf2c200][Math.floor(r() * 4)], roughness: 0.6, side: THREE.DoubleSide }), [0, 0.95, 0.02]); }
    if (a === 'bags') { for (const [hand, c] of [[h.handL, 0xd9c7a8], [h.handR, 0xf2efe9]] as const) add(hand, new THREE.BoxGeometry(0.1, 0.32, 0.28).translate(0, -0.22, 0), cloth(c), [0, 0, 0]); }
    if (a === 'camera') { add(h.chestAnchor, new THREE.BoxGeometry(0.12, 0.08, 0.06), m.dark, [0.02, -0.1, 0.1]); add(h.chestAnchor, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 14).rotateX(Math.PI / 2), m.dark, [0.02, -0.1, 0.15]); }
  }
  return out;
}

// ---- behaviour poses (pure functions of time and seed)
const w = (t: number, f: number, ph: number) => Math.sin(t * f + ph);
export function talkPose(t: number, seed = 0, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const p = idlePose(t, seed, base), s = seed * 2.3, g1 = Math.max(0, w(t, 1.9, s)) , g2 = Math.max(0, w(t, 1.4, s + 2));
  return { ...p, armR: [-0.25 - 0.25 * g1, 0.12, 0.9 + 0.5 * g1 + 0.15 * w(t, 6.0, s)], armL: [-0.1 - 0.2 * g2, 0.1, 0.4 + 0.6 * g2], headPitch: p.headPitch + 0.06 * w(t, 2.7, s), headYaw: p.headYaw * 0.4 + 0.1 * w(t, 0.8, s) };
}
export function phonePose(t: number, seed = 0, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const p = idlePose(t, seed, base);
  return { ...p, armR: [-0.42, 0.18, 1.75 + 0.04 * w(t, 3, seed)], armL: [-0.15, 0.12, 0.55], headPitch: 0.42 + 0.03 * w(t, 0.9, seed), headYaw: 0.05 };
}
export function photoPose(t: number, seed = 0, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const p = idlePose(t, seed, base);
  return { ...p, armR: [-1.15, 0.08, 0.75], armL: [-1.05, 0.22, 0.95], headPitch: -0.12 + 0.03 * w(t, 0.7, seed), lean: base.lean - 0.04 };
}
export function wavePose(t: number, seed = 0, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const p = idlePose(t, seed, base);
  return { ...p, armR: [-2.55, 0.35 + 0.35 * w(t, 7, seed), 0.45], headYaw: p.headYaw * 0.3 };
}
export function cheerPose(t: number, seed = 0, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const b = Math.max(0, w(t, 7.5, seed)), p = idlePose(t, seed, base);
  return { ...p, hipsY: base.hipsY - 0.03 + 0.05 * b, armR: [-2.75 + 0.2 * b, 0.3, 0.35 + 0.3 * b], armL: [-2.7 + 0.2 * w(t, 7.5, seed + 1), 0.3, 0.35], headPitch: -0.25, legL: [0.05, 0.12 - 0.1 * b], legR: [0.05, 0.12 - 0.1 * b] };
}
/** Beat-locked dance: `bpm` sets the bounce; the seed picks one of four styles (bounce, sway, arms-up, two-step). */
export function dancePose(t: number, seed = 0, bpm = 122, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const beat = t * bpm / 60 * Math.PI * 2, style = Math.abs(Math.floor(seed * 7.3)) % 4, ph = seed * 1.7;
  const bounce = 0.5 + 0.5 * Math.cos(beat), half = Math.sin(beat / 2 + ph);
  const p: HumanoidPose = { ...base, hipsY: base.hipsY - 0.035 * bounce, breath: 0.4 * Math.sin(beat), sideLean: 0.07 * half, twist: 0.18 * Math.sin(beat / 2 + ph + 1), headPitch: 0.08 * bounce - 0.04, headYaw: 0.2 * Math.sin(beat / 4 + ph),
    legL: [0.05 + 0.1 * Math.max(0, half), 0.18 * bounce + 0.15 * Math.max(0, half)], legR: [0.05 + 0.1 * Math.max(0, -half), 0.18 * bounce + 0.15 * Math.max(0, -half)],
    armL: [-0.55 + 0.35 * half, 0.25, 1.25 + 0.3 * bounce], armR: [-0.55 - 0.35 * half, 0.25, 1.25 + 0.3 * bounce] };
  if (style === 1) { p.armL = [-0.2 + 0.2 * half, 0.35 + 0.2 * half, 0.6]; p.armR = [-0.2 - 0.2 * half, 0.35 - 0.2 * half, 0.6]; p.sideLean = 0.12 * half; }
  if (style === 2) { p.armL = [-2.6 + 0.25 * bounce, 0.3 + 0.2 * half, 0.4]; p.armR = [-2.6 + 0.25 * bounce, 0.3 - 0.2 * half, 0.4]; p.headPitch = -0.2; }
  if (style === 3) { const step = Math.sin(beat / 2 + ph); p.legL = [0.3 * Math.max(0, step), 0.4 * Math.max(0, step)]; p.legR = [0.3 * Math.max(0, -step), 0.4 * Math.max(0, -step)]; p.armL = [-0.9, 0.2, 1.5 + 0.2 * step]; p.armR = [-0.9, 0.2, 1.5 - 0.2 * step]; }
  return p;
}
export function lookupPose(t: number, seed = 0, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const p = idlePose(t, seed, base), point = Math.max(0, w(t, 0.45, seed) - 0.55) * 2.2;
  return { ...p, headPitch: -0.55 + 0.05 * w(t, 0.5, seed), headYaw: p.headYaw * 0.6, lean: base.lean - 0.05, armR: [-1.9 * point + p.armR[0] * (1 - point), 0.15, 0.25] };
}
export function activityPose(a: Activity, t: number, seed: number, walkPhase = 0): HumanoidPose {
  switch (a) {
    case 'walk': return walkPose(walkPhase, 1);
    case 'talk': return talkPose(t, seed); case 'phone': return phonePose(t, seed); case 'photo': return photoPose(t, seed);
    case 'wave': return wavePose(t, seed); case 'cheer': return cheerPose(t, seed); case 'dance': return dancePose(t, seed);
    case 'lookup': return lookupPose(t, seed); default: return idlePose(t, seed);
  }
}

// ---- crowd
/** Walk route. Open paths wrap from end to start, so put both ends outside the camera's view (or close the loop). */
export interface CrowdPath { points: THREE.Vector3[]; closed?: boolean; /** Lateral spread (m) either side of the path. */ width?: number }
export interface CrowdOptions {
  seed?: number; vibe?: Vibe; pbr?: PBRLibrary;
  walkers?: { path: CrowdPath; count: number; speed?: [number, number]; bothWays?: boolean; phoneShare?: number }[];
  groups?: { center: THREE.Vector3; count: number; radius?: number; activity: Activity | Activity[]; /** People face this point (default: the centre, or outward for dancers). */ target?: THREE.Vector3 }[];
  childShare?: number; elderShare?: number;
}
interface Member { h: HumanV2; seed: number; activity: Activity; phoneWalk?: boolean; path?: { curve: THREE.CurvePath<THREE.Vector3> | THREE.CatmullRomCurve3; len: number; closed: boolean }; s0?: number; speed?: number; dir?: number; lateral?: number; screen?: THREE.MeshStandardMaterial }

export class Crowd {
  readonly group = new THREE.Group(); readonly members: Member[] = [];
  private tmp = new THREE.Vector3(); private tan = new THREE.Vector3(); private side = new THREE.Vector3();
  constructor(o: CrowdOptions) {
    const r = rng(o.seed ?? 3); let k = 0;
    const make = (activity: Activity) => {
      const seed = (o.seed ?? 3) * 1000 + k++, opts = diversePerson(seed, { vibe: o.vibe, childShare: o.childShare, elderShare: o.elderShare });
      const acc = activity === 'phone' || activity === 'photo' ? Array.from(new Set<Accessory>([...opts.accessories.filter((a) => a !== 'coffee' && a !== 'bags'), 'phone'])) : activity === 'walk' ? opts.accessories : opts.accessories.filter((a) => a !== 'phone');
      const h = new HumanV2({ ...opts, pbr: o.pbr }); const at = attachAccessories(h, acc, seed); this.group.add(h.root);
      return { h, seed, activity, screen: at.screen } as Member;
    };
    for (const wk of o.walkers ?? []) {
      const curve = new THREE.CatmullRomCurve3(wk.path.points, wk.path.closed ?? false, 'centripetal'), len = curve.getLength();
      for (let i = 0; i < wk.count; i++) {
        const m = make(r() < (wk.phoneShare ?? 0.15) ? 'phone' : 'walk');
        Object.assign(m, { path: { curve, len, closed: wk.path.closed ?? false }, s0: r() * len, speed: (wk.speed?.[0] ?? 1.1) + r() * ((wk.speed?.[1] ?? 1.5) - (wk.speed?.[0] ?? 1.1)) * (m.activity === 'phone' ? 0.7 : 1),
          dir: wk.bothWays === false ? 1 : r() < 0.5 ? 1 : -1, lateral: (r() * 2 - 1) * (wk.path.width ?? 1.2) });
        if (m.activity === 'phone') { m.activity = 'walk'; m.phoneWalk = true; }
        this.members.push(m);
      }
    }
    for (const g of o.groups ?? []) {
      const acts = Array.isArray(g.activity) ? g.activity : [g.activity], R = g.radius ?? 1.0;
      for (let i = 0; i < g.count; i++) {
        const act = acts[i % acts.length], m = make(act), a = (i / g.count) * Math.PI * 2 + r() * 0.5, rr = act === 'dance' || act === 'cheer' || act === 'lookup' || act === 'photo' ? Math.sqrt(r()) * R : R * (0.8 + r() * 0.3);
        m.h.root.position.set(g.center.x + Math.cos(a) * rr, g.center.y, g.center.z + Math.sin(a) * rr);
        const tgt = g.target ?? (act === 'dance' ? m.h.root.position.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))).add(new THREE.Vector3(r() - 0.5, 0, r() - 0.5)) : g.center);
        m.h.root.rotation.y = Math.atan2(tgt.x - m.h.root.position.x, tgt.z - m.h.root.position.z) + (r() - 0.5) * 0.3;
        this.members.push(m);
      }
    }
  }
  /** Deterministic: positions along paths, headings, stride-locked walk cycles and behaviour poses at time t. */
  update(t: number, night = 0) {
    for (const m of this.members) {
      if (m.screen) m.screen.emissiveIntensity = 0.8 + 1.6 * night;
      if (m.path) {
        const { curve, len, closed } = m.path, s = m.s0! + m.dir! * m.speed! * t, u = closed ? ((s % len) + len) % len / len : (((s % len) + len) % len) / len;
        curve.getPointAt(u, this.tmp); curve.getTangentAt(u, this.tan); if (m.dir! < 0) this.tan.negate();
        this.side.set(this.tan.z, 0, -this.tan.x).normalize();
        m.h.root.position.copy(this.tmp).addScaledVector(this.side, m.lateral! * (m.dir! > 0 ? 1 : -1));
        m.h.root.rotation.y = Math.atan2(this.tan.x, this.tan.z);
        const phase = (s * m.dir!) / 1.35 * Math.PI * 2;   // ~1.35 m per stride pair, so feet do not skate
        const p = walkPose(phase, m.h.options.age === 'child' ? 1.1 : 1);
        m.h.setPose(m.phoneWalk ? { ...p, armR: [-0.42, 0.18, 1.7], headPitch: 0.35 } : p);
      } else m.h.setPose(activityPose(m.activity, t, m.seed));
    }
  }
}

/**
 * Far background crowd: instanced simple figures (torso, legs, head) with per-instance clothing/skin colours,
 * walking along straight lanes with swinging legs in the vertex shader. Hundreds cost a few draw calls.
 */
export class CrowdImpostors {
  readonly group = new THREE.Group(); private u = { uTime: { value: 0 } };
  private items: { from: THREE.Vector3; dir: THREE.Vector3; L: number; s0: number; v: number; h: number }[] = [];
  constructor(o: { lanes: { from: THREE.Vector3; to: THREE.Vector3; width?: number; count: number }[]; seed?: number; vibe?: Vibe }) {
    const r = rng(o.seed ?? 5), P = PALETTE[o.vibe ?? 'everyday'], n = o.lanes.reduce((a, l) => a + l.count, 0);
    const part = (geo: THREE.BufferGeometry, swing: number) => {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
      mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, this.u);
        sh.vertexShader = 'uniform float uTime; attribute vec4 aWalk;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          { float s = aWalk.x + aWalk.y * uTime;
            float ph = s / 1.35 * 6.2831853; float sw = ${swing.toFixed(2)} * sin(ph + (transformed.x > 0.0 ? 0.0 : 3.14159));
            if (${swing.toFixed(2)} != 0.0 && transformed.y < 0.9) { float k = 0.9 - transformed.y; transformed.z += sin(sw) * k; transformed.y += (1.0 - cos(sw)) * k; }
            transformed.y += abs(sin(ph)) * 0.025; }`); };
      const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); return m;
    };
    const legs = part(new THREE.BoxGeometry(0.11, 0.85, 0.12).translate(0.07, 0.43, 0).toNonIndexed(), 0.45);
    { const g2 = new THREE.BoxGeometry(0.11, 0.85, 0.12).translate(-0.07, 0.43, 0); const merged = mergePair(legs.geometry, g2.toNonIndexed()); legs.geometry = merged; }
    const torso = part(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10).scale(1, 1, 0.7).translate(0, 1.15, 0), 0);
    const head = part(new THREE.SphereGeometry(0.11, 12, 10).translate(0, 1.6, 0), 0);
    const walk = new Float32Array(n * 4), c = new THREE.Color(), m4 = new THREE.Matrix4(); let i = 0;
    for (const lane of o.lanes) {
      const d = lane.to.clone().sub(lane.from), L = d.length(), dir = d.clone().normalize(), side = new THREE.Vector3(dir.z, 0, -dir.x);
      for (let k = 0; k < lane.count; k++, i++) {
        const fw = r() < 0.5 ? 1 : -1, lat = (r() * 2 - 1) * (lane.width ?? 2), sp = 1.1 + r() * 0.5, s0 = r() * L, hgt = 0.88 + r() * 0.22;
        // Instances are placed at the lane start; the shader cannot wrap, so positions are rebuilt per frame in update().
        walk.set([s0, sp * fw, 0, 0], i * 4);
        this.items.push({ from: lane.from.clone().addScaledVector(side, lat), dir, L, s0, v: sp * fw, h: hgt });
        torso.setColorAt(i, c.set(P[Math.floor(r() * P.length)])); legs.setColorAt(i, c.set([0x2c3a52, 0x1d2129, 0x4a4136, 0x6b6250, 0x30475e][Math.floor(r() * 5)])); head.setColorAt(i, c.set(SKIN[Math.floor(r() * SKIN.length)]));
        for (const m of [legs, torso, head]) m.setMatrixAt(i, m4.identity());
      }
    }
    for (const m of [legs, torso, head]) { m.geometry.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 4)); if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.meshes = [legs, torso, head]; this.update(0);
  }
  private meshes: THREE.InstancedMesh[] = [];
  update(t: number) {
    this.u.uTime.value = t;
    const items = this.items, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      const along = (((it.s0 + it.v * t) % it.L) + it.L) % it.L; p.copy(it.from).addScaledVector(it.dir, along);
      q.setFromAxisAngle(up, Math.atan2(it.dir.x * Math.sign(it.v), it.dir.z * Math.sign(it.v))); s.setScalar(it.h);
      m4.compose(p, q, s); for (const m of this.meshes) m.setMatrixAt(i, m4);
    });
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}
function mergePair(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(a.attributes)) { const x = a.attributes[name].array as Float32Array, y = b.attributes[name].array as Float32Array, arr = new Float32Array(x.length + y.length); arr.set(x); arr.set(y, x.length); out.setAttribute(name, new THREE.BufferAttribute(arr, a.attributes[name].itemSize)); }
  return out;
}
