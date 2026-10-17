import * as THREE from 'three';
import { rng } from '../util/math';
import { GLSL_NOISE } from '../util/glsl';

/**
 * spacecraft-v1 — generic, unbranded spacecraft in metres. `Rocket`: a two-stage launcher (lathe-turned tanks, nose
 * fairing, interstage, grid of engine bells, fins) with a `RocketPlume` — an additive shader exhaust with a hot core,
 * Mach shock diamonds, turbulent flicker and an expanding plume as ambient pressure falls (`altitude` 0..1).
 * `Satellite`: a box bus wrapped in crinkled gold foil, two solar wings, a dish and thrusters. `SpaceStation`: a truss
 * spine with pressurised modules, radiators and four big solar array pairs. All deterministic from `update(t)`.
 */
const PLUME_VS = /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
const PLUME_FS = /* glsl */ `uniform float uTime, uThrottle, uAlt, uSeed; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  ${GLSL_NOISE}
  void main(){
    float along = 1.0 - vUv.y;                      // 0 at the nozzle, 1 at the tail
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
    float core = 1.0 - rim;
    // Shock diamonds: periodic bright knots in the first half (sea level), fading as the plume expands with altitude.
    float diamonds = pow(0.5 + 0.5 * cos(along * 38.0), 6.0) * (1.0 - smoothstep(0.1, 0.55, along)) * (1.0 - uAlt);
    float flick = 0.75 + 0.5 * fbm(vec2(along * 9.0 - uTime * 14.0, vUv.x * 6.0 + uSeed));
    float fade = pow(1.0 - along, 1.6) * smoothstep(0.0, 0.03, along + 0.02);
    vec3 hot = vec3(1.0, 0.96, 0.9), mid = vec3(1.0, 0.62, 0.22), cool = vec3(0.55, 0.28, 0.12);
    vec3 col = mix(hot, mix(mid, cool, smoothstep(0.25, 0.9, along)), smoothstep(0.02, 0.35, along + rim * 0.3));
    float I = (core * 1.6 + 0.35) * fade * flick * (1.0 + diamonds * 2.5) * uThrottle;
    gl_FragColor = vec4(col * I * 4.0, 1.0);
  }`;
export class RocketPlume {
  readonly mesh: THREE.Mesh; private u: Record<string, THREE.IUniform>; private len: number; private r0: number;
  constructor(o: { radius?: number; length?: number; seed?: number } = {}) {
    this.r0 = o.radius ?? 1.6; this.len = o.length ?? 30;
    this.u = { uTime: { value: 0 }, uThrottle: { value: 1 }, uAlt: { value: 0 }, uSeed: { value: o.seed ?? 1.3 } };
    const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 40, true).translate(0, -0.5, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: PLUME_VS, fragmentShader: PLUME_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    this.set(1, 0);
  }
  /** Throttle 0..1 and altitude 0 (sea level, tight with diamonds) .. 1 (vacuum, wide and faint). */
  set(throttle: number, altitude: number) {
    this.u.uThrottle.value = throttle; this.u.uAlt.value = altitude;
    // Radius profile is baked into scale: wider and longer with altitude (under-expanded exhaust).
    const g = this.mesh.geometry as THREE.CylinderGeometry, p = g.attributes.position as THREE.BufferAttribute;
    const L = this.len * (0.4 + 0.6 * throttle) * (1 + altitude * 0.8), spread = 1 + altitude * 4;
    if (!g.userData.base) g.userData.base = Float32Array.from(p.array as Float32Array);
    const b = g.userData.base as Float32Array;
    for (let i = 0; i < p.count; i++) { const y = b[i * 3 + 1], u = -y; const r = this.r0 * (0.85 + u * 0.9 * spread) * (1 - Math.pow(u, 3) * 0.6); p.setXYZ(i, b[i * 3] * r, y * L, b[i * 3 + 2] * r); }
    p.needsUpdate = true; g.computeVertexNormals();
  }
  update(t: number) { this.u.uTime.value = t; }
}

export class Rocket {
  readonly group = new THREE.Group(); readonly plume: RocketPlume; readonly height: number;
  readonly upper = new THREE.Group();
  constructor(o: { radius?: number; height?: number; engines?: number; livery?: THREE.ColorRepresentation; seed?: number } = {}) {
    const R = o.radius ?? 1.85, H = this.height = o.height ?? 70, r = rng(o.seed ?? 4);
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.45, metalness: 0.1 });
    const band = new THREE.MeshStandardMaterial({ color: o.livery ?? 0x1b1d22, roughness: 0.5 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x8b8e93, roughness: 0.35, metalness: 0.9 });
    const sooty = new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 0.9, metalness: 0.2 });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, parent: THREE.Object3D = this.group) => { const mesh = new THREE.Mesh(geo, m); mesh.position.y = y; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    const s1 = H * 0.62, inter = H * 0.05, s2 = H * 0.2, fair = H - s1 - inter - s2;
    add(new THREE.CylinderGeometry(R, R, s1, 40), white, s1 / 2);
    for (const y of [0.08, 0.55, 0.97]) add(new THREE.CylinderGeometry(R * 1.004, R * 1.004, s1 * 0.025, 40), band, s1 * y);
    add(new THREE.CylinderGeometry(R, R, inter, 40), band, s1 + inter / 2);
    this.group.add(this.upper);
    add(new THREE.CylinderGeometry(R, R, s2, 40), white, s1 + inter + s2 / 2, this.upper);
    const prof: THREE.Vector2[] = []; for (let i = 0; i <= 24; i++) { const u = i / 24; prof.push(new THREE.Vector2(R * 1.02 * Math.sqrt(Math.max(0, 1 - Math.pow(u, 2.2))) + 0.001, u * fair)); }
    add(new THREE.LatheGeometry(prof, 40), white, s1 + inter + s2, this.upper);
    // Fins and the engine section.
    for (let k = 0; k < 4; k++) { const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(R * 1.1, -0.2); fin.lineTo(R * 1.1, s1 * 0.07); fin.lineTo(0, s1 * 0.14);
      const m = add(new THREE.ExtrudeGeometry(fin, { depth: 0.12, bevelEnabled: false }).translate(R * 0.95, 0, -0.06), band, s1 * 0.01); m.rotation.y = k * Math.PI / 2 + Math.PI / 4; }
    add(new THREE.CylinderGeometry(R * 0.98, R * 1.02, H * 0.012, 40), sooty, -H * 0.006);
    const n = o.engines ?? 9, bell = (rad: number) => { const pts = Array.from({ length: 12 }, (_, i) => { const u = i / 11; return new THREE.Vector2(rad * (0.35 + 0.65 * Math.pow(u, 0.7)), -u * rad * 2.2); }); return new THREE.LatheGeometry(pts, 24); };
    const bm = new THREE.MeshStandardMaterial({ color: 0x3a3634, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n - 1)) * Math.PI * 2, rr = i === 0 ? 0 : R * 0.62;
      const e = add(bell(R * 0.24), bm, -H * 0.012); e.position.x = Math.cos(a) * rr; e.position.z = Math.sin(a) * rr;
    }
    void r; void metal;
    this.plume = new RocketPlume({ radius: R * 0.85, length: H * 0.55 }); this.plume.mesh.position.y = -H * 0.012 - R * 0.5; this.group.add(this.plume.mesh);
  }
  /** Altitude above the pad (m) for a launch time t (simple constant-acceleration ascent after ignition). */
  static ascent(t: number, ignition = 0, liftoff = 2.5, accel = 9) { const s = Math.max(0, t - ignition - liftoff); return 0.5 * accel * s * s; }
  update(t: number, throttle = 1, altitude01 = 0) { this.plume.set(throttle, altitude01); this.plume.update(t); this.plume.mesh.visible = throttle > 0.001; }
}

function foilTexture(seed: number) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!, r = rng(seed);
  g.fillStyle = '#c99a2e'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) { const x = r() * 256, y = r() * 256, w = 10 + r() * 60, h = 6 + r() * 30; g.fillStyle = `rgba(${200 + r() * 55},${150 + r() * 70},${40 + r() * 50},${0.25 + r() * 0.35})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + r() * h); g.lineTo(x + w * r(), y + h); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function cellTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d')!;
  g.fillStyle = '#0b1a3a'; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 32) for (let x = 0; x < 256; x += 32) { const gr = g.createLinearGradient(x, y, x + 30, y + 30); gr.addColorStop(0, '#1b3d86'); gr.addColorStop(1, '#0f2557'); g.fillStyle = gr; g.fillRect(x + 1.5, y + 1.5, 29, 29); }
  g.strokeStyle = 'rgba(200,210,230,0.5)'; g.lineWidth = 1; for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const panelMat = () => new THREE.MeshStandardMaterial({ map: cellTexture(), roughness: 0.25, metalness: 0.6, side: THREE.DoubleSide });

export class Satellite {
  readonly group = new THREE.Group(); private wings: THREE.Group[] = [];
  constructor(o: { size?: number; seed?: number } = {}) {
    const S = o.size ?? 1.6, foil = new THREE.MeshStandardMaterial({ map: foilTexture(o.seed ?? 3), roughness: 0.32, metalness: 1, color: 0xffe2a0 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], parent: THREE.Object3D = this.group) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    add(new THREE.BoxGeometry(S, S * 1.2, S), foil, [0, 0, 0]);
    add(new THREE.BoxGeometry(S * 1.02, S * 0.08, S * 1.02), white, [0, S * 0.6, 0]);
    for (const x of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.set(x * S * 0.5, 0, 0); this.group.add(wing); this.wings.push(wing);
      add(new THREE.CylinderGeometry(0.03 * S, 0.03 * S, S * 0.7, 8).rotateZ(Math.PI / 2), dark, [x * S * 0.35, 0, 0], wing);
      for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(S * 1.1, S * 0.02, S * 1.4), panelMat(), [x * (S * 0.7 + S * 0.56 + k * S * 1.14), 0, 0], wing);
    }
    // Dish antenna (paraboloid) on a boom, thrusters, sensors.
    const dish = new THREE.LatheGeometry(Array.from({ length: 14 }, (_, i) => { const u = i / 13; return new THREE.Vector2(u * S * 0.65 + 0.001, u * u * S * 0.22); }), 32);
    const dm = add(dish, new THREE.MeshStandardMaterial({ color: 0xf0efe9, roughness: 0.35, side: THREE.DoubleSide }), [0, -S * 0.25, S * 0.85]); dm.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.03 * S, 0.03 * S, S * 0.4, 8).rotateX(Math.PI / 2), dark, [0, -S * 0.25, S * 0.62]);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.ConeGeometry(S * 0.05, S * 0.12, 10), dark, [x * S * 0.45, -S * 0.66, z * S * 0.45]).rotation.x = Math.PI;
    add(new THREE.CylinderGeometry(S * 0.09, S * 0.12, S * 0.3, 14), dark, [S * 0.25, S * 0.75, 0.2 * S]);
  }
  /** Solar wings track the Sun about their boom axis (angle in radians). */
  update(_t: number, wingAngle = 0) { for (const w of this.wings) w.rotation.x = wingAngle; }
}

export class SpaceStation {
  readonly group = new THREE.Group(); private arrays: THREE.Group[] = [];
  constructor(o: { scale?: number; seed?: number } = {}) {
    const k = o.scale ?? 1, white = new THREE.MeshStandardMaterial({ color: 0xdcdcd6, roughness: 0.55, metalness: 0.2 });
    const truss = new THREE.MeshStandardMaterial({ color: 0xb8b6b0, roughness: 0.45, metalness: 0.7 }), rad = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.3, side: THREE.DoubleSide });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], parent: THREE.Object3D = this.group) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    // Main truss along X: a box lattice (rails + diagonals).
    const L = 100 * k, w = 4.5 * k;
    for (const [y, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(new THREE.BoxGeometry(L, 0.25 * k, 0.25 * k), truss, [0, y * w / 2, z * w / 2]);
    for (let x = -L / 2; x <= L / 2; x += w) { add(new THREE.BoxGeometry(0.2 * k, w, 0.2 * k), truss, [x, 0, w / 2]); add(new THREE.BoxGeometry(0.2 * k, w, 0.2 * k), truss, [x, 0, -w / 2]); const d = add(new THREE.BoxGeometry(0.15 * k, w * 1.41, 0.15 * k), truss, [x + w / 2, 0, w / 2]); d.rotation.z = Math.PI / 4; }
    // Pressurised modules along Z through the centre, with a node and a docking port.
    const mod = (len: number, r: number, z: number, axis: 'z' | 'x' = 'z', x = 0) => { const m = add(new THREE.CylinderGeometry(r, r, len, 28), white, [x, -w * 1.2, z]); if (axis === 'z') m.rotation.x = Math.PI / 2; else m.rotation.z = Math.PI / 2; for (const s of [-1, 1]) add(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), white, [0, 0, 0], m).position.y = s * len / 2; return m; };
    mod(16 * k, 2.1 * k, 0); mod(12 * k, 2.1 * k, 15 * k); mod(11 * k, 2.1 * k, -14 * k); mod(9 * k, 1.9 * k, 0, 'x', 9 * k); mod(9 * k, 1.9 * k, 0, 'x', -9 * k);
    add(new THREE.CylinderGeometry(0.8 * k, 1.0 * k, 2 * k, 16).rotateX(Math.PI / 2), truss, [0, -w * 1.2, 21.5 * k]);
    add(new THREE.CylinderGeometry(0.3 * k, 0.3 * k, w * 1.2, 10), truss, [0, -w * 0.6, 0]);
    for (const x of [-12, 12]) for (const s of [-1, 1]) { const r2 = add(new THREE.PlaneGeometry(10 * k, 3.2 * k), rad, [x * k, -w * 0.5 - 4 * k, s * 2.2 * k]); r2.rotation.x = Math.PI / 2; }
    // Four solar array pairs on rotating joints at the truss ends.
    for (const x of [-L / 2 + 6 * k, -L / 2 + 16 * k, L / 2 - 16 * k, L / 2 - 6 * k]) {
      const g = new THREE.Group(); g.position.set(x, 0, 0); this.group.add(g); this.arrays.push(g);
      for (const s of [-1, 1]) { const p = add(new THREE.BoxGeometry(4.6 * k, 0.08 * k, 34 * k), panelMat(), [0, 0, s * (19 * k)], g); p.castShadow = true; add(new THREE.BoxGeometry(0.3 * k, 0.3 * k, 36 * k), truss, [0, 0.1 * k, s * 19 * k], g); }
    }
    void o.seed;
  }
  update(t: number, arrayAngle?: number) { const a = arrayAngle ?? t * 0.05; for (const g of this.arrays) g.rotation.x = a; }
}
