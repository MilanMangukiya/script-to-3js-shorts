import * as THREE from 'three';
import { Humanoid, POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { rng, clamp } from '../../../library/util/math';
import { ease, win } from './common';

/** Analytic walking gait (phase in radians; amt 0..1 scales the stride). */
export function walkPose(phase: number, amt = 1, base: HumanoidPose = POSE_STAND): HumanoidPose {
  const s = Math.sin(phase), c = Math.cos(phase);
  return {
    ...base, hipsY: base.hipsY - 0.018 * Math.abs(c) * amt, lean: base.lean + 0.05 * amt,
    legL: [0.4 * s * amt, (Math.max(0, -s) * 0.62 + 0.06) * amt], legR: [-0.4 * s * amt, (Math.max(0, s) * 0.62 + 0.06) * amt],
    armL: [0.34 * s * amt + 0.03, 0.08, 0.22 + 0.15 * amt], armR: [-0.34 * s * amt + 0.03, 0.08, 0.22 + 0.15 * amt],
  };
}

/** Commuters for the crossing: walk, stagger at the jolt, stop, turn north and look up; some point. */
export interface Walker { person: Humanoid; start: THREE.Vector3; dir: number; speed: number; stopAt: number; turnAt: number; pointAt: number; phase: number }
export function makeWalkers(seed: number): Walker[] {
  const r = rng(seed), coats = [0x344557, 0x797564, 0x927653, 0x68545b, 0x384b42, 0x1c2f42, 0xa79881, 0x665a45, 0x485a62, 0x7a3b30];
  const skins = [0xe2bda1, 0xc1906e, 0x91613f, 0x593b2d, 0xb77e58, 0xe7c9af];
  // [x, z, heading (rad, 0 = +z), speed]
  const lanes: [number, number, number, number][] = [
    [0.4, -0.9, -Math.PI / 2, 1.25], [-2.6, -1.25, Math.PI / 2, 1.3], [-5.0, -0.6, -Math.PI / 2, 1.1], [-1.2, 0.3, -Math.PI / 2, 1.2],
    [-9.6, -3.0, Math.PI, 1.2], [-10.4, 4.5, Math.PI, 1.35], [-9.3, -12.0, 0, 1.15], [-10.2, -19.0, 0, 1.3],
    [9.7, -9.0, Math.PI, 1.2], [10.3, -16.0, 0, 1.1], [-8.6, 9.0, Math.PI, 1.25],
    // Down the avenue, in view once the camera turns north.
    [-9.0, -7.5, Math.PI, 1.15], [-10.0, -24.0, 0, 1.25], [9.2, -5.5, 0, 1.2], [8.9, -21.0, Math.PI, 1.3], [-6.0, -12.0, Math.PI / 2, 1.05], [-8.2, -30.0, Math.PI, 1.2],
  ];
  return lanes.map(([x, z, dir, speed], i) => ({
    person: new Humanoid({ height: 1.6 + r() * 0.3, coatColor: coats[i % coats.length], skinColor: skins[Math.floor(r() * skins.length)], trouserColor: [0x1d2028, 0x2b2f38, 0x3c3a36][i % 3], coat: i % 3 === 0 ? 'jacket' : 'long', hat: r() > 0.8, scarfColor: r() > 0.5 ? null : [0xa9523f, 0x3f6aa9, 0xc7a14a][i % 3] }),
    start: new THREE.Vector3(x, 0.01, z), dir, speed, stopAt: 1.25 + r() * 0.6, turnAt: 2.0 + r() * 1.3, pointAt: i === 1 || i === 4 ? 2.9 + r() * 0.4 : 1e9, phase: r() * 6.283,
  }));
}
/** Walker state at film time t. react = false keeps everyone walking (the loop ending); clock may be negative. */
export function poseWalker(w: Walker, clock: number, react: boolean) {
  const tau = 0.45, ts = w.stopAt;
  const dist = !react || clock < ts ? w.speed * clock : w.speed * (ts + tau * (1 - Math.exp(-(clock - ts) / tau)));
  const v = !react || clock < ts ? 1 : Math.exp(-(clock - ts) / tau);
  const dx = Math.sin(w.dir), dz = Math.cos(w.dir);
  w.person.root.position.set(w.start.x + dx * dist, w.start.y, w.start.z + dz * dist);
  const phase = w.phase + (dist / 1.4) * Math.PI * 2;
  let pose = walkPose(phase, v);
  let yaw = w.dir;
  if (react) {
    // Jolt: brief stagger with arms out.
    const st = win(clock, 1.0, 1.15) * (1 - win(clock, 1.35, 1.9));
    pose = { ...pose, sideLean: pose.sideLean + Math.sin(clock * 21 + w.phase) * 0.09 * st, lean: pose.lean - 0.06 * st, armL: [pose.armL[0] - 0.2 * st, 0.08 + 0.55 * st, pose.armL[2]], armR: [pose.armR[0] - 0.2 * st, 0.08 + 0.55 * st, pose.armR[2]] };
    // Turn to face north (-z, yaw π) and look up at the peak.
    const tu = win(clock, w.turnAt, w.turnAt + 0.7);
    let d = Math.PI - w.dir; d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw = w.dir + d * tu;
    pose = lerpPose(pose, { ...POSE_STAND, headPitch: -0.42, lean: -0.04, breath: Math.sin(clock * 3 + w.phase) * 0.3 }, tu * (1 - v * 0.6));
    const pt = win(clock, w.pointAt, w.pointAt + 0.5);
    if (pt > 0) pose = { ...pose, armR: [pose.armR[0] + (-2.35 - pose.armR[0]) * pt, 0.12, 0.12], headPitch: pose.headPitch - 0.05 * pt };
  }
  w.person.root.rotation.y = yaw;
  w.person.setPose(pose);
}

const std = (color: THREE.ColorRepresentation, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** Mountaineer: orange down suit, pack, oxygen mask, goggles, hood and an ice axe. */
export function makeMountaineer(): Humanoid {
  const h = new Humanoid({ height: 1.75, coat: 'jacket', coatColor: 0xd5531c, trouserColor: 0xc24a18, skinColor: 0x9e7258, shoeColor: 0x1b1d22, scarfColor: null, hat: true });
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.2), std(0x7a1f1f, 0.8)); pack.position.set(0, 0.0, -0.06); h.backAnchor.add(pack);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 12), std(0x2e3a48)); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.29, -0.08); h.backAnchor.add(roll);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.7), std(0xd5531c, 0.85)); hood.position.set(0, 0.125, -0.012); h.head.add(hood);
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10).scale(1, 0.8, 0.75), std(0x16181c, 0.5)); mask.position.set(0, 0.06, 0.1); h.head.add(mask);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 10).rotateX(Math.PI / 2), std(0x9aa3ab, 0.3, 0.8)); valve.position.set(0, 0.055, 0.15); h.head.add(valve);
  const goggle = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xf0a030, roughness: 0.08, metalness: 0.9 })); goggle.position.set(0, 0.14, 0.098); h.head.add(goggle);
  const tube = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.009, 6, 20, Math.PI * 0.9), std(0x22262c)); tube.position.set(0.05, -0.02, 0.02); tube.rotation.set(0, Math.PI / 2, 0.4); h.head.add(tube);
  const axe = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), std(0x2b3440, 0.4, 0.6)); shaft.position.y = -0.31; axe.add(shaft);
  const pick = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.02), std(0xb8bec4, 0.3, 0.9)); pick.position.y = -0.6; axe.add(pick);
  h.handR.add(axe);
  return h;
}
/** Uphill trudge (phase radians). */
export function climbPose(phase: number, breath: number): HumanoidPose {
  const s = Math.sin(phase);
  return { ...POSE_STAND, hipsY: 0.88 - 0.02 * Math.abs(Math.cos(phase)), lean: 0.3, headPitch: -0.12, breath,
    legL: [0.55 + 0.32 * s, 0.35 + Math.max(0, -s) * 0.6], legR: [0.55 - 0.32 * s, 0.35 + Math.max(0, s) * 0.6],
    armL: [0.25 * s - 0.15, 0.18, 0.35], armR: [-0.55 - 0.15 * s, 0.1, 0.55], shrug: 0.25 };
}

/** Pressure-suited figure: white suit, helmet with a gold visor, neck ring and life-support pack. */
export function makeSuitedFigure(): Humanoid {
  const h = new Humanoid({ height: 1.75, coat: 'jacket', coatColor: 0xe6e3da, trouserColor: 0xdedbd2, skinColor: 0xc9c6bd, shoeColor: 0x34383d, scarfColor: null, hat: true });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xf2f1ec, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
  helmet.position.set(0, 0.11, 0); h.head.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.172, 32, 20, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.28, Math.PI * 0.36), new THREE.MeshPhysicalMaterial({ color: 0xd7a443, roughness: 0.06, metalness: 1, clearcoat: 1 }));
  visor.position.set(0, 0.11, 0); h.head.add(visor);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 10, 28).rotateX(Math.PI / 2), std(0x2f6fb5, 0.35, 0.6)); ring.position.set(0, -0.03, 0); h.head.add(ring);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.18), std(0xd9d6cc, 0.6)); pack.position.set(0, -0.02, -0.07); h.backAnchor.add(pack);
  const hose = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.016, 8, 20, Math.PI), std(0x3a4552)); hose.position.set(-0.12, 0.25, -0.02); hose.rotation.y = Math.PI / 2; h.backAnchor.add(hose);
  return h;
}
/** One knee down, looking at something low in front; lookUp 0..1 raises the head toward the summit. */
export function kneelPose(lookUp: number, breath: number): HumanoidPose {
  return { ...POSE_STAND, hipsY: 0.53, lean: 0.18 - 0.18 * lookUp, headPitch: 0.55 - 1.05 * lookUp, breath,
    legL: [1.45, 1.55], legR: [0.05, 1.65], armL: [-0.55, 0.12, 0.9], armR: [-0.35, 0.05, 0.4], shrug: 0.15 };
}

/** Soft sprite puffs (breath vapour or boiling steam): emitted every `period` s from an anchor, drifting and fading. */
export class Puffs {
  readonly points: THREE.Points;
  private u: Record<string, THREE.IUniform>;
  constructor(o: { count?: number; period?: number; life?: number; size?: number; drift?: THREE.Vector3; spread?: number; color?: THREE.ColorRepresentation; opacity?: number; seed?: number } = {}) {
    const n = o.count ?? 48, r = rng(o.seed ?? 5), seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) seeds.set([r(), r(), r(), r()], i * 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.u = { uT: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uDrift: { value: (o.drift ?? new THREE.Vector3(0.05, 0.12, 0.25)).clone() }, uPeriod: { value: o.period ?? 1.1 },
      uLife: { value: o.life ?? 1.4 }, uSize: { value: o.size ?? 0.1 }, uSpread: { value: o.spread ?? 0.05 }, uColor: { value: new THREE.Color(o.color ?? 0xeef4ff) }, uOpacity: { value: o.opacity ?? 0.5 }, uOn: { value: 1 }, uScale: { value: 960 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.u,
      vertexShader: /* glsl */ `attribute vec4 aSeed; uniform float uT, uPeriod, uLife, uSize, uSpread, uScale; uniform vec3 uOrigin, uDrift; varying float vA;
        void main(){ float slot = floor(aSeed.x*6.0); float k = floor((uT - slot*uPeriod/6.0*0.0)/uPeriod);
          float birth = (k + aSeed.y*0.25)*uPeriod; float age = uT - birth;
          vec3 jitter = (aSeed.yzw - 0.5)*2.0*uSpread*(0.4 + age);
          vec3 p = uOrigin + uDrift*age*(0.6 + aSeed.z) + jitter;
          vA = smoothstep(0.0, 0.12, age)*(1.0 - smoothstep(uLife*0.35, uLife, age))*step(0.0, age);
          vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(uSize*(0.5 + age*1.6)*uScale/max(-mv.z, 1e-3), 1.0, 300.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uOpacity, uOn; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5)*2.0; float a = (1.0 - smoothstep(0.2, 1.0, d))*vA*uOpacity*uOn; gl_FragColor = vec4(uColor*a, a); }`,
    }));
    this.points.frustumCulled = false;
  }
  update(t: number, origin: THREE.Vector3, on = 1) { this.u.uT.value = t; this.u.uOrigin.value.copy(origin); this.u.uOn.value = on; }
}

/** Wind-blown spindrift: snow grains streaming along +x a few cm to 1 m above a ground function. */
export class Spindrift {
  readonly points: THREE.Points;
  private base: Float32Array; private pos: Float32Array; private n: number;
  constructor(private ground: (x: number, z: number) => number, o: { count?: number; extent?: number; seed?: number } = {}) {
    const n = (this.n = o.count ?? 900), e = o.extent ?? 14, r = rng(o.seed ?? 77);
    this.base = new Float32Array(n * 4); this.pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.base.set([(r() - 0.5) * 2 * e, (r() - 0.5) * 2 * e, Math.pow(r(), 2.5) * 0.9, 2 + r() * 5], i * 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.7, depthWrite: false }));
    this.points.frustumCulled = false; this.extent = e;
  }
  private extent: number;
  update(t: number) {
    const e = this.extent;
    for (let i = 0; i < this.n; i++) {
      const [x0, z0, h, v] = [this.base[i * 4], this.base[i * 4 + 1], this.base[i * 4 + 2], this.base[i * 4 + 3]];
      const x = ((x0 + v * t + e) % (2 * e) + 2 * e) % (2 * e) - e, z = z0 + Math.sin(t * 1.7 + x0) * 0.2;
      this.pos.set([x, this.ground(x, z) + 0.03 + h * (0.6 + 0.4 * Math.sin(t * 3 + z0)), z], i * 3);
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Boiling layer for a glass: seeded nucleation sites on the floor and wall release growing, accelerating bubbles. */
export class BoilingBubbles {
  readonly points: THREE.Points;
  private u: Record<string, THREE.IUniform>;
  constructor(o: { radius: number; floor: number; top: number; count?: number; seed?: number }) {
    const n = o.count ?? 420, r = rng(o.seed ?? 19), a = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = r() * 6.283, rad = Math.sqrt(r()) * o.radius * 0.9; a.set([Math.cos(th) * rad, Math.sin(th) * rad, r(), 0.25 + r() * 0.5], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aB', new THREE.BufferAttribute(a, 4));
    this.u = { uT: { value: 0 }, uBoil: { value: 0 }, uFloor: { value: o.floor }, uTop: { value: o.top }, uScale: { value: 960 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.u,
      vertexShader: /* glsl */ `attribute vec4 aB; uniform float uT, uBoil, uFloor, uTop, uScale; varying float vA;
        void main(){ float period = aB.w; float act = step(aB.z, uBoil);
          float age = mod(uT + aB.z*7.0, period); float H = uTop - uFloor;
          float y = uFloor + H*clamp(age*age/(period*period)*1.15, 0.0, 1.0);
          vec3 p = vec3(aB.x + sin(age*25.0 + aB.z*40.0)*0.0012, y, aB.y);
          float size = 0.0008 + 0.0024*age/period;
          vA = act*smoothstep(uTop + 0.001, uTop - 0.004, y);
          vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(size*uScale/max(-mv.z, 1e-3), 1.0, 80.0); }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5)*2.0; float ring = smoothstep(1.0, 0.75, d)*(0.25 + 0.75*smoothstep(0.35, 0.9, d)); gl_FragColor = vec4(vec3(1.0)*ring*vA*0.9, ring*vA*0.55); }`,
    }));
    this.points.frustumCulled = false; this.points.renderOrder = 6;
  }
  update(t: number, boil: number, pxScale: number) { this.u.uT.value = t; this.u.uBoil.value = clamp(boil); this.u.uScale.value = pxScale; }
}

export { ease, win };
