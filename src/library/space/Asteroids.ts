import * as THREE from 'three';
import { rng, fbm2 } from '../util/math';
import { GLSL_NOISE } from '../util/glsl';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * asteroids-v1 — rocky small bodies. `rockGeometry()` builds an irregular asteroid (noise-displaced icosphere with
 * bowl-shaped craters and painted regolith), `Asteroid` is a single hero rock that tumbles, `AsteroidField` scatters
 * thousands of instanced rocks in a belt or a box with deterministic tumbling and drift, and `Comet` adds a dark
 * nucleus, glowing coma, a straight blue ion tail pointing away from the Sun and a broader, curved yellow-white dust
 * tail. Units are arbitrary (scale to the scene); everything is a pure function of time.
 */
export function rockGeometry(o: { seed?: number; detail?: number; roughness?: number; craters?: number; elongation?: number } = {}) {
  // Icospheres are non-indexed (faceted normals); weld shared vertices first so the displaced rock shades smoothly.
  const r = rng(o.seed ?? 1), g = mergeVertices(new THREE.IcosahedronGeometry(1, o.detail ?? 4).deleteAttribute('normal').deleteAttribute('uv')), p = g.attributes.position as THREE.BufferAttribute;
  const el = o.elongation ?? 0.25, sx = 1 + el * (r() * 0.8 + 0.2), sy = 1 - el * 0.5 * r(), sz = 1 - el * 0.3 * r();
  const craters = Array.from({ length: o.craters ?? 14 }, () => { const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize(); return { v, rad: 0.12 + r() * r() * 0.4, depth: 0.05 + r() * 0.08 }; });
  const v = new THREE.Vector3(), seed = (o.seed ?? 1) * 7, rough = o.roughness ?? 1;
  const colors = new Float32Array(p.count * 3), base = new THREE.Color(0x6f655a), dark = new THREE.Color(0x3d3731), light = new THREE.Color(0x9a8f80), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let h = 1 + rough * (0.22 * (fbm2(v.x * 1.6 + v.z * 0.7, v.y * 1.6 - v.z * 0.4, seed, 4) - 0.5) + 0.07 * (fbm2(v.x * 6 + v.y, v.z * 6 - v.y, seed + 3, 4) - 0.5));
    let rim = 0;
    for (const k of craters) { const d = v.angleTo(k.v) / k.rad; if (d < 1.25) { h -= k.depth * Math.max(0, 1 - d * d) ; rim += k.depth * 0.6 * Math.exp(-Math.pow((d - 1.05) / 0.18, 2)); } }
    h += rim;
    p.setXYZ(i, v.x * h * sx, v.y * h * sy, v.z * h * sz);
    const t = fbm2(v.x * 4 + 1, v.y * 4 - v.z * 2, seed + 9, 3);
    c.copy(base).lerp(t > 0.55 ? light : dark, Math.abs(t - 0.5) * 1.4).multiplyScalar(0.85 + rim * 2.5);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

export const rockMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, flatShading: false });

/** A single tumbling hero asteroid. */
export class Asteroid {
  readonly mesh: THREE.Mesh; private axis: THREE.Vector3; private rate: number;
  constructor(o: { seed?: number; radius?: number; spin?: number; detail?: number } = {}) {
    const r = rng((o.seed ?? 2) + 101);
    this.mesh = new THREE.Mesh(rockGeometry({ seed: o.seed ?? 2, detail: o.detail ?? 6, craters: 26 }), rockMaterial());
    this.mesh.scale.setScalar(o.radius ?? 1); this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.axis = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(); this.rate = (o.spin ?? 0.15) * (0.6 + r() * 0.8);
  }
  update(t: number) { this.mesh.quaternion.setFromAxisAngle(this.axis, t * this.rate); }
}

export interface AsteroidFieldOptions {
  count?: number; seed?: number;
  /** 'belt' = an annulus (inner/outer radius, thickness) around the origin in the XZ plane; 'box' = a cube of side `size`. */
  shape?: 'belt' | 'box'; inner?: number; outer?: number; thickness?: number; size?: number;
  /** Rock radius range and orbital angular speed (rad/s at the inner edge; Keplerian falloff). */
  minRadius?: number; maxRadius?: number; orbitSpeed?: number;
  /** Uniform drift velocity for 'box' fields (e.g. a debris stream past the camera). */
  drift?: THREE.Vector3;
}
/** Instanced field of irregular rocks (four base shapes), each with its own tumble and orbit. */
export class AsteroidField {
  readonly group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private items: { mesh: number; idx: number; r: number; a0: number; y: number; scale: number; axis: THREE.Vector3; spin: number; rot0: number; p0: THREE.Vector3 }[] = [];
  private o: Required<Omit<AsteroidFieldOptions, 'drift'>> & { drift: THREE.Vector3 };
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  constructor(o: AsteroidFieldOptions = {}) {
    this.o = { count: 1500, seed: 5, shape: 'belt', inner: 40, outer: 70, thickness: 6, size: 100, minRadius: 0.05, maxRadius: 1.6, orbitSpeed: 0.02, ...o, drift: o.drift ?? new THREE.Vector3() };
    const r = rng(this.o.seed), shapes = 4, per = Math.ceil(this.o.count / shapes), mat = rockMaterial();
    for (let k = 0; k < shapes; k++) { const im = new THREE.InstancedMesh(rockGeometry({ seed: this.o.seed * 10 + k, detail: 3, craters: 8 }), mat, per); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); this.meshes.push(im); }
    for (let i = 0; i < this.o.count; i++) {
      const u = r(), scale = this.o.minRadius + (this.o.maxRadius - this.o.minRadius) * Math.pow(u, 3.2);   // many small, few large
      const rad = this.o.inner + (this.o.outer - this.o.inner) * Math.sqrt(r()), y = (r() + r() + r() - 1.5) * this.o.thickness / 1.5;
      const p0 = new THREE.Vector3((r() - 0.5) * this.o.size, (r() - 0.5) * this.o.size, (r() - 0.5) * this.o.size);
      this.items.push({ mesh: i % shapes, idx: Math.floor(i / shapes), r: rad, a0: r() * Math.PI * 2, y, scale, axis: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), spin: (0.1 + r() * 0.6) / Math.sqrt(scale + 0.2), rot0: r() * 6.28, p0 });
    }
    this.update(0);
  }
  update(t: number) {
    const o = this.o;
    for (const it of this.items) {
      if (o.shape === 'belt') { const w = o.orbitSpeed * Math.pow(o.inner / it.r, 1.5), a = it.a0 + w * t; this.v.set(Math.cos(a) * it.r, it.y, Math.sin(a) * it.r); }
      else { this.v.copy(it.p0).addScaledVector(o.drift, t); const h = o.size / 2; this.v.set(((this.v.x + h) % o.size + o.size) % o.size - h, ((this.v.y + h) % o.size + o.size) % o.size - h, ((this.v.z + h) % o.size + o.size) % o.size - h); }
      this.q.setFromAxisAngle(it.axis, it.rot0 + it.spin * t); this.s.setScalar(it.scale);
      this.meshes[it.mesh].setMatrixAt(it.idx, this.m4.compose(this.v, this.q, this.s));
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}

const TAIL_VS = /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const TAIL_FS = /* glsl */ `uniform vec3 uColor; uniform float uTime, uStrength, uStreak; varying vec2 vUv; varying vec3 vW;
  ${GLSL_NOISE}
  void main(){
    // u across the tail (0..1), v along it (0 = head). Streaky ion structure moves outward with time.
    float x = abs(vUv.x - 0.5) * 2.0, along = vUv.y;
    float core = exp(-x * x * mix(5.0, 2.0, along));
    float streak = mix(1.0, 0.55 + 0.9 * fbm(vec2(vUv.x * 22.0, along * 3.0 - uTime * 0.35)), uStreak);
    float fade = (1.0 - smoothstep(0.55, 1.0, along)) * smoothstep(0.0, 0.04, along);
    gl_FragColor = vec4(uColor * core * streak * fade * uStrength, 1.0);
  }`;
/** Comet: nucleus + coma + ion tail (anti-sunward, straight) + dust tail (curved, lagging the orbit). */
export class Comet {
  readonly group = new THREE.Group(); private ion: THREE.Mesh; private dust: THREE.Mesh; private coma: THREE.Sprite; private nucleus: Asteroid;
  private uIon: Record<string, THREE.IUniform>; private uDust: Record<string, THREE.IUniform>;
  constructor(o: { nucleus?: number; tailLength?: number; activity?: number; seed?: number } = {}) {
    const n = o.nucleus ?? 0.5, L = o.tailLength ?? 40, act = o.activity ?? 1;
    this.nucleus = new Asteroid({ seed: o.seed ?? 9, radius: n, spin: 0.3, detail: 4 }); (this.nucleus.mesh.material as THREE.MeshStandardMaterial).color.setScalar(0.45); this.group.add(this.nucleus.mesh);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(210,235,255,0.6)'); gr.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this.coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: 0xdfefff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.coma.scale.setScalar(n * 14 * act); this.group.add(this.coma);
    const mk = (color: number, strength: number, streak: number) => ({ uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uStrength: { value: strength * act }, uStreak: { value: streak } });
    this.uIon = mk(0x5fa8ff, 0.8, 1); this.uDust = mk(0xffe8c4, 0.45, 0.3);
    const mat = (u: Record<string, THREE.IUniform>) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: TAIL_VS, fragmentShader: TAIL_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    // Tails are ribbons along +Y in local space; the group is oriented each frame so +Y points away from the Sun.
    const ionGeo = new THREE.PlaneGeometry(n * 6, L, 1, 40).translate(0, L / 2, 0);
    { const p = ionGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / L; p.setX(i, p.getX(i) * (0.4 + y * 1.6)); } }
    const dustGeo = new THREE.PlaneGeometry(n * 10, L * 0.7, 1, 40).translate(0, L * 0.35, 0);
    { const p = dustGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / (L * 0.7); p.setX(i, p.getX(i) * (0.5 + y * 2.2) + y * y * L * 0.22); } }
    this.ion = new THREE.Mesh(ionGeo, mat(this.uIon)); this.dust = new THREE.Mesh(dustGeo, mat(this.uDust));
    for (const m of [this.ion, this.dust]) { m.frustumCulled = false; this.group.add(m); }
    const ion2 = new THREE.Mesh(ionGeo, this.ion.material); ion2.rotation.y = Math.PI / 2; ion2.frustumCulled = false; this.group.add(ion2);   // crossed ribbons never vanish edge-on
    this.dust.rotation.y = Math.PI / 2;   // a second ribbon at right angles reads as volume
    const dust2 = new THREE.Mesh(dustGeo, this.dust.material); dust2.frustumCulled = false; this.group.add(dust2);
  }
  /** Orient the tails away from `sunDir` (unit vector from the comet toward the Sun) and animate. */
  update(t: number, sunDir: THREE.Vector3) {
    this.nucleus.update(t); this.uIon.uTime.value = t; this.uDust.uTime.value = t;
    const away = sunDir.clone().negate().normalize(); this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), away);
    this.nucleus.mesh.quaternion.premultiply(this.group.quaternion.clone().invert());
  }
}
