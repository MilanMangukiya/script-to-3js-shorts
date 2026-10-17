import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { rng } from '../util/math';
import { GLSL_NOISE } from '../util/glsl';
import { projectUVs, type PBRLibrary } from '../materials/PBR';
import { Building, type BuildingStyle } from './BuildingKit';
import { StreetLamp } from './CityKit';
import { Vehicle, type VehicleKind } from '../vehicles/RoadVehicles';
import { TrafficLight, Bollard, ManholeCover } from '../props/StreetFurniture';
import { SmokeWisp } from '../fx/SmokeWisp';

/**
 * neon-district-v1 — a Times Square-style entertainment district at night, in metres (avenue along −Z):
 *  - `LedScreen`: animated, unbranded billboard content generated in the shader (six programmes — aurora gradients,
 *    pop graphics with headline words, scrolling tickers, concert equaliser and spotlights, kaleidoscope geometry,
 *    skyline promo) that cycle with quick wipes, rendered as HDR LED panels with visible pixel structure up close.
 *    `glow(t)` returns the dominant colour for driving a RectAreaLight.
 *  - `NeonSign` (flickering glass-tube words), `Marquee` (chase-light bulb frame), red glowing bleacher `Steps`.
 *  - `NeonDistrict`: avenue, sidewalks and plaza, towers wrapped in screens and tickers, a stacked-screen tower at the
 *    far fork, taxi-heavy traffic, lamps, signals, steam vents, coloured area light from the big screens, and wet
 *    asphalt that mirrors it all through a live cube reflection (`update(t, renderer)`).
 * Everything animates from absolute time only.
 */
const WORDS = ['TONIGHT', 'LIVE', 'OPEN LATE', 'NEW', 'SHOW', 'MUSIC', 'CITY LIGHTS', '24/7', 'CINEMA', 'GRAND OPENING', 'WHAT IF?', 'DREAM BIG', 'PREMIERE', 'FESTIVAL', 'BREAKING NEWS', 'ON STAGE'];
let _atlas: THREE.Texture | undefined;
/** 16 rows of generic headline words, white on transparent (row i = WORDS[i]). */
export function wordAtlas() {
  if (_atlas) return _atlas;
  const c = document.createElement('canvas'); c.width = 2048; c.height = 2048; const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  WORDS.forEach((wd, i) => { let fs = 108; g.font = `900 ${fs}px Inter, Arial, sans-serif`; while (g.measureText(wd).width > 1900 && fs > 40) { fs -= 4; g.font = `900 ${fs}px Inter, Arial, sans-serif`; } g.fillText(wd, 1024, i * 128 + 68); });
  _atlas = new THREE.CanvasTexture(c); _atlas.colorSpace = THREE.NoColorSpace; _atlas.anisotropy = 8; _atlas.generateMipmaps = true; _atlas.minFilter = THREE.LinearMipmapLinearFilter;
  return _atlas;
}

const SCREEN_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SCREEN_FS = /* glsl */ `
  uniform float uTime, uSeed, uCycle, uBright, uAspect, uPitch, uPrograms[6], uCount; uniform sampler2D uWords; varying vec2 vUv;
  ${GLSL_NOISE}
  vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
  float word(vec2 p, float row){ if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0; return texture2D(uWords, vec2(p.x, 1.0 - (row + 1.0 - p.y) / 16.0)).r; }
  vec3 program(float id, vec2 uv, float t, float s){
    vec2 a = vec2(uv.x * uAspect, uv.y); float h0 = fract(s * 0.37 + t * 0.03);
    if (id < 0.5) {   // aurora: flowing saturated gradients
      float n = fbm(a * 1.4 + vec2(t * 0.12, -t * 0.08) + fbm(a * 2.0 - t * 0.1) * 1.5);
      return hsv(h0 + n * 0.45 + uv.y * 0.15, 0.85, 0.35 + 0.75 * n);
    }
    if (id < 1.5) {   // pop: coloured field, bouncing disc, rings and a headline word
      vec3 bg = hsv(h0, 0.75, 0.75); vec2 c = vec2(uAspect * (0.5 + 0.3 * sin(t * 1.3 + s)), 0.55 + 0.12 * abs(sin(t * 2.1 + s)));
      float d = length(a - c), disc = smoothstep(0.32, 0.30, d), rings = smoothstep(0.45, 0.5, fract(d * 4.0 - t * 1.2)) * (1.0 - disc);
      vec3 col = mix(bg * 0.55, hsv(h0 + 0.5, 0.8, 1.0), rings * 0.6); col = mix(col, vec3(1.0, 0.98, 0.92), disc);
      float w = word(vec2((uv.x - 0.08) / 0.84, (uv.y - 0.06) / 0.2), floor(mod(s * 7.0 + floor(t / 3.0), 16.0)));
      return mix(col, hsv(h0 + 0.5, 0.9, 0.2), w * disc) + w * (1.0 - disc) * 1.4;
    }
    if (id < 2.5) {   // ticker: scrolling words on a dark band with an accent stripe
      float row = floor(mod(s * 5.0, 16.0)), x = fract(uv.x * uAspect / 6.0 - t * 0.12);
      float w = word(vec2(fract(x * 1.0), (uv.y - 0.15) / 0.7), floor(mod(row + floor(uv.x * uAspect / 6.0 - t * 0.12), 16.0)));
      vec3 col = mix(vec3(0.02, 0.03, 0.06), hsv(h0, 0.8, 0.9) * 0.35, step(0.88, uv.y) + step(uv.y, 0.08));
      return col + w * hsv(h0 + 0.1, 0.25, 1.4);
    }
    if (id < 3.5) {   // concert: spotlight sweeps over an equaliser and a crowd silhouette
      float bars = floor(uv.x * 24.0), lvl = 0.25 + 0.6 * abs(sin(t * (2.0 + hash11(bars) * 3.0) + bars)) * (0.6 + 0.4 * hash11(bars + 9.0));
      vec3 col = hsv(0.72 + 0.1 * uv.y, 0.8, 0.12 + 0.25 * uv.y);
      for (int i = 0; i < 3; i++) { float fi = float(i), ang = sin(t * (0.6 + fi * 0.27) + fi * 2.1) * 0.6; vec2 o = vec2(uAspect * (0.2 + 0.3 * fi), 0.0);
        vec2 dd = a - o; float beam = smoothstep(0.08, 0.0, abs(dd.x * cos(ang) - dd.y * sin(ang)) - dd.y * 0.08); col += hsv(fi * 0.33 + h0, 0.6, 1.0) * beam * 0.5; }
      col = mix(col, hsv(h0 + 0.6, 0.9, 1.2), step(fract(uv.x * 24.0), 0.8) * step(uv.y, lvl * 0.55) * step(0.18, uv.y));
      float crowd = 0.12 + 0.05 * sin(uv.x * 90.0) * sin(uv.x * 37.0 + 1.0) + 0.03 * sin(uv.x * 210.0 + t * 6.0);
      return mix(col, vec3(0.0), step(uv.y, crowd));
    }
    if (id < 4.5) {   // kaleidoscope: rotating geometric facets
      vec2 p = a - vec2(uAspect * 0.5, 0.5); float r = length(p), th = atan(p.y, p.x) + t * 0.4; th = abs(mod(th, 1.0471976) - 0.5235988);
      vec2 q = vec2(cos(th), sin(th)) * r; float tri = step(0.5, fract(q.x * 6.0 - t * 0.8)) * 0.6 + step(0.5, fract(q.y * 9.0 + t * 0.5)) * 0.4;
      return hsv(h0 + r * 0.6 + tri * 0.2, 0.85, 0.3 + 0.8 * tri);
    }
    // skyline promo: sunset gradient, sun, parallax skyline, tagline
    vec3 sky = mix(hsv(0.98 + 0.05 * sin(t * 0.2), 0.7, 1.0), hsv(0.72, 0.7, 0.45), uv.y);
    float sun = smoothstep(0.17, 0.15, length(a - vec2(uAspect * 0.62, 0.42))); sky = mix(sky, vec3(1.0, 0.85, 0.55) * 1.4, sun);
    float b1 = step(uv.y, 0.25 + 0.18 * step(0.5, fract(sin(floor(uv.x * 14.0 + t * 0.2) * 12.9) * 43758.5)) * hash11(floor(uv.x * 14.0 + t * 0.2)));
    float b2 = step(uv.y, 0.14 + 0.12 * hash11(floor(uv.x * 30.0 + t * 0.5) + 3.0));
    vec3 col = mix(sky, vec3(0.08, 0.04, 0.12), max(b1, b2));
    float w = word(vec2((uv.x - 0.1) / 0.8, (uv.y - 0.72) / 0.2), floor(mod(s * 11.0, 16.0)));
    return col + w * 1.3;
  }
  void main(){
    float t = uTime + uSeed * 13.0, slot = floor(t / uCycle), f = fract(t / uCycle);
    float i0 = uPrograms[int(mod(slot + uSeed * 3.0, uCount))], i1 = uPrograms[int(mod(slot + 1.0 + uSeed * 3.0, uCount))];
    vec3 c0 = program(i0, vUv, t, uSeed + slot), c = c0;
    float wipeT = smoothstep(0.92, 1.0, f);
    if (wipeT > 0.0) { vec3 c1 = program(i1, vUv, t, uSeed + slot + 1.0); float edge = vUv.x + vUv.y * 0.3; c = mix(c0, c1, step(edge, wipeT * 1.35)); c += smoothstep(0.03, 0.0, abs(edge - wipeT * 1.35)) * 1.5; }
    // LED structure: RGB pixel dots that fade out once a pixel is smaller than a screen pixel (no moiré at distance).
    vec2 cells = vUv * vec2(uAspect, 1.0) / uPitch, cf = fract(cells) - 0.5, fw = fwidth(cells);
    float dots = smoothstep(0.5, 0.32, length(cf)), grid = mix(dots * 1.35 + 0.08, 1.0, clamp(max(fw.x, fw.y) * 1.6, 0.0, 1.0));
    gl_FragColor = vec4(max(c, 0.0) * grid * uBright, 1.0);
  }`;

export interface LedScreenOptions { width: number; height: number; programs?: number[]; seed?: number; cycle?: number; brightness?: number; pitch?: number; curved?: number }
export class LedScreen {
  readonly mesh: THREE.Mesh; readonly group = new THREE.Group(); readonly u: Record<string, THREE.IUniform>; readonly width: number; readonly height: number;
  private programs: number[]; private seed: number; private cycle: number;
  constructor(o: LedScreenOptions) {
    this.width = o.width; this.height = o.height; this.seed = o.seed ?? 1; this.cycle = o.cycle ?? 6; this.programs = o.programs ?? [0, 1, 3, 4, 5];
    const progs = [...this.programs, ...Array(6 - this.programs.length).fill(0)].slice(0, 6);
    this.u = { uTime: { value: 0 }, uSeed: { value: this.seed }, uCycle: { value: this.cycle }, uBright: { value: o.brightness ?? 1.5 }, uAspect: { value: o.width / o.height },
      uPitch: { value: o.pitch ?? 0.012 }, uPrograms: { value: progs }, uCount: { value: this.programs.length }, uWords: { value: wordAtlas() } };
    const geo = o.curved ? new THREE.CylinderGeometry(o.curved, o.curved, o.height, 48, 1, true, -o.width / o.curved / 2, o.width / o.curved).rotateY(Math.PI) : new THREE.PlaneGeometry(o.width, o.height);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SCREEN_VS, fragmentShader: SCREEN_FS, toneMapped: false }));
    this.mesh.userData.noDepthFx = false;
    const frame = new THREE.Mesh(o.curved ? new THREE.CylinderGeometry(o.curved - 0.12, o.curved - 0.12, o.height + 0.4, 48, 1, false, -o.width / o.curved / 2 - 0.01, o.width / o.curved + 0.02).rotateY(Math.PI) : new THREE.BoxGeometry(o.width + 0.4, o.height + 0.4, 0.35).translate(0, 0, -0.2), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.6 }));
    frame.castShadow = true; this.group.add(frame, this.mesh);
  }
  update(t: number) { this.u.uTime.value = t; }
  /** Dominant colour at time t (the same hue cycle as the shader), for a matching RectAreaLight. */
  glow(t: number, out = new THREE.Color()) { const tt = t + this.seed * 13, slot = Math.floor(tt / this.cycle); return out.setHSL((((this.seed + slot) * 0.37 + tt * 0.03) % 1 + 1) % 1, 0.75, 0.55); }
}

/** Glass-tube neon word: canvas-drawn tube with halo, buzzing flicker, optional dead letters. */
export class NeonSign {
  readonly mesh: THREE.Mesh; private mat: THREE.MeshBasicMaterial; private seed: number; private base: number;
  constructor(o: { text: string; color: THREE.ColorRepresentation; height?: number; seed?: number; brightness?: number; script?: boolean }) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d')!, col = new THREE.Color(o.color);
    const css = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
    g.font = `${o.script ? 'italic 900' : '900'} 150px Inter, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [blur, lw, a] of [[40, 22, 0.35], [18, 12, 0.6], [4, 7, 1]] as const) { g.shadowColor = css; g.shadowBlur = blur; g.strokeStyle = css; g.globalAlpha = a; g.lineWidth = lw; g.strokeText(o.text, 512, 128); }
    g.globalAlpha = 1; g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2.5; g.strokeText(o.text, 512, 128);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const H = o.height ?? 1.6; this.base = o.brightness ?? 3; this.seed = o.seed ?? 3;
    this.mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1, 1, 1).multiplyScalar(this.base) });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(H * 4, H), this.mat);
  }
  update(t: number) { const s = this.seed, buzz = Math.sin(t * 120 + s) * 0.03, drop = Math.sin(t * 0.7 + s * 3) > 0.985 ? 0.25 : 1; this.mat.color.setScalar(this.base * (0.97 + buzz) * drop); }
}

/** Rectangular frame of bulbs with a chase pattern (theatre marquee). */
export class Marquee {
  readonly mesh: THREE.InstancedMesh; private u = { uTime: { value: 0 } };
  constructor(o: { width: number; height: number; spacing?: number; color?: THREE.ColorRepresentation }) {
    const sp = o.spacing ?? 0.3, pts: THREE.Vector3[] = [], W = o.width, H = o.height;
    for (let x = -W / 2; x <= W / 2 + 1e-6; x += sp) { pts.push(new THREE.Vector3(x, H / 2, 0), new THREE.Vector3(x, -H / 2, 0)); }
    for (let y = -H / 2 + sp; y < H / 2 - 1e-6; y += sp) { pts.push(new THREE.Vector3(-W / 2, y, 0), new THREE.Vector3(W / 2, y, 0)); }
    const mat = new THREE.MeshBasicMaterial({ color: o.color ?? 0xffd38a, toneMapped: false });
    mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, this.u);
      sh.vertexShader = 'attribute float aIdx; varying float vIdx;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vIdx = aIdx;');
      sh.fragmentShader = 'uniform float uTime; varying float vIdx;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.25 + 3.5 * step(0.5, fract(vIdx / 3.0 - uTime * 2.5));'); };
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), mat, pts.length);
    const idx = new Float32Array(pts.length), m4 = new THREE.Matrix4();
    pts.forEach((p, i) => { this.mesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); idx[i] = i; });
    this.mesh.geometry.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
  }
  update(t: number) { this.u.uTime.value = t; }
}

/** Glowing red bleacher steps (a plaza seating stair lit from inside each riser). */
export function glowingSteps(o: { width?: number; steps?: number; rise?: number; run?: number; color?: THREE.ColorRepresentation } = {}) {
  const g = new THREE.Group(), W = o.width ?? 12, n = o.steps ?? 14, rise = o.rise ?? 0.42, run = o.run ?? 0.75;
  const glass = new THREE.MeshStandardMaterial({ color: 0x5a0710, emissive: o.color ?? 0xff1e2e, emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.1 });
  const tread = new THREE.MeshPhysicalMaterial({ color: 0x8a1018, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x400308, emissiveIntensity: 1 });
  for (let i = 0; i < n; i++) {
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(W, rise, 0.04), glass); r1.position.set(0, rise * (i + 0.5), -run * i); g.add(r1);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, run), tread); t1.position.set(0, rise * (i + 1), -run * (i + 0.5)); t1.receiveShadow = true; g.add(t1);
  }
  // Solid staircase body just behind the risers (side profile extruded across the width).
  const prof = new THREE.Shape(); prof.moveTo(0.03, 0);
  for (let i = 0; i < n; i++) { prof.lineTo(0.03 + run * i, rise * (i + 1) - 0.03); prof.lineTo(0.03 + run * (i + 1), rise * (i + 1) - 0.03); }
  prof.lineTo(0.03 + run * n, 0); prof.lineTo(0.03, 0);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: W * 0.995, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-W * 0.4975, 0, 0), new THREE.MeshStandardMaterial({ color: 0x1a1214, roughness: 0.8 }));
  body.receiveShadow = true; g.add(body);
  return g;
}

export interface NeonDistrictOptions { pbr: PBRLibrary; seed?: number; length?: number; traffic?: number; reflections?: boolean; areaLights?: number;
  /** Fixed environment used while the reflection probe renders (keeps frames independent of render order). */
  baseEnvironment?: THREE.Texture | null }
interface Car { v: Vehicle; lane: number; z0: number; speed: number }
/**
 * The district. Layout: avenue (X ∈ [−9, 9]) running toward −Z, sidewalks to ±16 m, towers beyond; a 7 m plaza island
 * with the red steps sits at z ≈ −16…−38 between the lanes (x = ±5, ±7.4); a narrow stacked-screen tower closes the view at z ≈ −170.
 */
export class NeonDistrict {
  readonly group = new THREE.Group(); readonly screens: LedScreen[] = []; readonly signs: NeonSign[] = []; readonly marquees: Marquee[] = [];
  readonly buildings: Building[] = []; readonly lamps: StreetLamp[] = []; readonly signals: TrafficLight[] = []; readonly cars: Car[] = []; readonly steam: { s: SmokeWisp; seed: number }[] = [];
  readonly cube?: THREE.CubeCamera; private areas: { light: THREE.RectAreaLight; screen: LedScreen }[] = [];
  readonly length: number; readonly ground: THREE.Mesh; private tmpC = new THREE.Color(); private baseEnv: THREE.Texture | null;
  constructor(o: NeonDistrictOptions) {
    RectAreaLightUniformsLib.init();
    const r = rng(o.seed ?? 21), L = (this.length = o.length ?? 220), pbr = o.pbr, G = this.group; this.baseEnv = o.baseEnvironment ?? null;
    // Ground: wet asphalt (low roughness, puddle patches through the roughness map), sidewalks, paint.
    const asphalt = pbr.material('asphalt_02', { tint: 0x4a4a4e, roughness: 1, normalScale: 0.6 });   // roughness from the puddle map
    asphalt.roughnessMap = puddleMap(); asphalt.metalness = 0.0; asphalt.envMapIntensity = 1.6;
    this.ground = new THREE.Mesh(projectUVs(new THREE.PlaneGeometry(18, L).rotateX(-Math.PI / 2)), asphalt); this.ground.position.z = -L / 2 + 30; this.ground.receiveShadow = true; G.add(this.ground);
    const walkMat = pbr.material('concrete_tiles_02', { tint: 0x8d8a86, roughness: 0.45 }); walkMat.envMapIntensity = 1.2;
    for (const side of [-1, 1]) { const w = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(7, 0.16, L)), walkMat); w.position.set(side * 12.5, 0.08, -L / 2 + 30); w.receiveShadow = true; G.add(w); }
    const paint = new THREE.MeshStandardMaterial({ color: 0xe9e3d0, roughness: 0.5 }), yellow = new THREE.MeshStandardMaterial({ color: 0xe8b51a, roughness: 0.5 });
    for (let z = 20; z > -L + 30; z -= 9) for (const x of [-6.2, 6.2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3.5).rotateX(-Math.PI / 2), paint); m.position.set(x, 0.006, z); G.add(m); }
    for (const x of [-0.12, 0.12]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, L).rotateX(-Math.PI / 2), yellow); m.position.set(x, 0.006, -L / 2 + 30); G.add(m); }
    for (const zc of [6, -64]) for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4).rotateX(-Math.PI / 2), paint); m.position.set(-8 + i * 2, 0.007, zc); G.add(m); }
    // Plaza island with the red steps.
    const plaza = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(7, 0.18, 22)), walkMat); plaza.position.set(0, 0.09, -27); plaza.receiveShadow = true; G.add(plaza);
    const steps = glowingSteps({ width: 6, steps: 12 }); steps.position.set(0, 0.18, -20); G.add(steps);
    // Buildings both sides with screens facing the avenue.
    const styles: BuildingStyle[] = ['tower', 'office', 'tower', 'apartment', 'office'];
    let screenSeed = 1;
    for (const side of [-1, 1]) {
      for (let z = 24; z > -L + 40;) {
        const width = 14 + r() * 10, floors = 10 + Math.floor(r() * 22), b = new Building({ style: styles[Math.floor(r() * styles.length)], width, depth: 22, floors, litFraction: 0.7, seed: Math.floor(r() * 1e4) }, pbr);
        b.group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; b.group.position.set(side * (16 + 11), 0, z - width / 2); G.add(b.group); this.buildings.push(b);
        // Facade screens: one big panel, sometimes a second, wrapped high on the face; a curved corner screen at intersections.
        const face = side * 15.85, zc = z - width / 2, n = 1 + (r() < 0.55 ? 1 : 0);   // just in front of the facade (x = ±16)
        for (let k = 0; k < n; k++) {
          const sw = Math.min(width - 1.5, 8 + r() * 10), sh = 5 + r() * (k === 0 ? 16 : 8), y = 6 + k * 18 + r() * 4 + sh / 2;
          const s = new LedScreen({ width: sw, height: sh, seed: screenSeed++, programs: [[0, 1, 4], [3, 5, 1], [1, 4, 0], [5, 0, 3]][Math.floor(r() * 4)], cycle: 5 + r() * 4 });
          s.group.position.set(face - side * 0.05, y, zc + (r() - 0.5) * (width - sw) * 0.6); s.group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; G.add(s.group); this.screens.push(s);
        }
        if (r() < 0.45) { const t = new LedScreen({ width: width - 0.5, height: 1.4, seed: screenSeed++, programs: [2], cycle: 100, brightness: 1.4, pitch: 0.02 });
          t.group.position.set(face - side * 0.3, 4.4, zc); t.group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; G.add(t.group); this.screens.push(t); }
        if (r() < 0.5) { const sign = new NeonSign({ text: ['OPEN', 'BAR', 'PIZZA', 'JAZZ', 'NIGHT', 'HOTEL', 'DINER', 'LIVE'][Math.floor(r() * 8)], color: [0xff2f9a, 0x2fe5ff, 0xffd02f, 0x7cff4f, 0xff5a2f][Math.floor(r() * 5)], height: 1.1, seed: screenSeed, script: r() < 0.4 });
          sign.mesh.position.set(face - side * 0.4, 3.2, zc + (r() - 0.5) * 6); sign.mesh.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; G.add(sign.mesh); this.signs.push(sign); }
        if (r() < 0.25) { const mq = new Marquee({ width: 7, height: 1.6 }); mq.mesh.position.set(face - side * 0.6, 3.6, zc); mq.mesh.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; G.add(mq.mesh); this.marquees.push(mq); }
        z -= width + (r() < 0.2 ? 14 : 0.6);
      }
    }
    // Stacked-screen tower closing the view.
    { const b = new Building({ style: 'tower', width: 14, depth: 14, floors: 34, seed: 77 }, pbr); b.group.position.set(0, 0, -L + 50); G.add(b.group); this.buildings.push(b);
      [[10, 9], [22, 12], [36, 10], [50, 12], [66, 9]].forEach(([y, h], i) => { const s = new LedScreen({ width: 13.2, height: h, seed: 90 + i, programs: [[1, 0], [5, 4], [3, 1], [0, 4], [1, 5]][i], cycle: 4.5 + i * 0.7 }); s.group.position.set(0, y + h / 2, -L + 50 + 7.25); G.add(s.group); this.screens.push(s); });
      const tick = new LedScreen({ width: 13.6, height: 1.6, seed: 99, programs: [2], cycle: 100, pitch: 0.02 }); tick.group.position.set(0, 7.2, -L + 50 + 7.4); G.add(tick.group); this.screens.push(tick); }
    // Street furniture, lamps, signals, steam vents.
    for (let z = 18; z > -L + 40; z -= 26) for (const side of [-1, 1]) { const l = new StreetLamp(7, -side, 0xffd6a8, { light: Math.abs(z + 8) < 30, intensity: 40 }); l.group.position.set(side * 9.6, 0.16, z); G.add(l.group); this.lamps.push(l); }
    for (const [x, z] of [[-9.4, 4.5], [9.4, 7.5], [-9.4, -62], [9.4, -66]]) { const s = new TrafficLight({ height: 3.6 }); s.offset = x < 0 ? 0 : 9.5; s.group.position.set(x, 0.16, z); s.group.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; G.add(s.group); this.signals.push(s); }
    for (let i = 0; i < 7; i++) { const b = new Bollard({ height: 0.9, color: 0x3a3e44 }); b.group.position.set(-3.0 + i * 1.0, 0.18, -15.5); G.add(b.group); }
    for (const [x, z, sd] of [[-3, -6, 1], [5, -44, 2], [-2, -88, 3]]) { const mh = new ManholeCover(0.34); mh.group.position.set(x, 0.002, z); G.add(mh.group);
      const s = new SmokeWisp({ height: 7, baseWidth: 1.2, topWidth: 4.5, curl: 1.8, riseSpeed: 1.4, color: 0xd9dde4, seed: sd, opacity: 0.32 }); s.mesh.position.set(x, 0, z); G.add(s.mesh); this.steam.push({ s, seed: sd }); }
    // Traffic: mostly taxis, in four lanes (two each way), wrapping far outside the view.
    const kinds: VehicleKind[] = ['taxi', 'taxi', 'taxi', 'sedan', 'suv', 'taxi', 'bus', 'taxi', 'van', 'taxi', 'police', 'hatch'];
    // Keep-right traffic: lanes at +x drive away from the camera (−Z), lanes at −x come toward it.
    for (let i = 0; i < (o.traffic ?? 18); i++) { const lane = [-7.4, -5.0, 5.0, 7.4][i % 4], k = kinds[i % kinds.length], v = new Vehicle({ kind: k, seed: 100 + i }); v.siren = k === 'police';
      v.group.rotation.y = lane < 0 ? Math.PI / 2 : -Math.PI / 2; G.add(v.group); this.cars.push({ v, lane, z0: r() * (L + 80), speed: (lane < 0 ? -1 : 1) * (5 + r() * 4) }); }
    // Coloured light spilling from the biggest screens (area lights) and a live reflection probe for the wet street.
    const big = [...this.screens].filter((s) => s.height > 3).sort((a, b) => b.width * b.height - a.width * a.height).slice(0, o.areaLights ?? 6);
    for (const s of big) { const l = new THREE.RectAreaLight(0xffffff, 3, s.width, s.height); s.group.updateMatrixWorld(true); l.position.copy(s.group.getWorldPosition(new THREE.Vector3())); const n = new THREE.Vector3(0, 0, 1).applyQuaternion(s.group.getWorldQuaternion(new THREE.Quaternion()));
      l.position.addScaledVector(n, 0.4); l.lookAt(l.position.clone().add(n)); G.add(l); this.areas.push({ light: l, screen: s }); }
    if (o.reflections !== false) { const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      this.cube = new THREE.CubeCamera(0.5, 600, rt); this.cube.position.set(0, 7, -55); G.add(this.cube); }   // mid-avenue, above the traffic: sees screens on both sides
  }
  /** Environment texture to assign to `scene.environment` (live neon reflections), when reflections are on. */
  get environment() { return this.cube?.renderTarget.texture; }
  /** Deterministic update; pass the renderer to refresh the wet-street reflections from the current state. */
  update(t: number, renderer?: THREE.WebGLRenderer, scene?: THREE.Scene, night = 1, camera?: THREE.Camera) {
    for (const s of this.screens) s.update(t);
    for (const s of this.signs) s.update(t);
    for (const m of this.marquees) m.update(t);
    for (const b of this.buildings) { b.setLight(night, 0x0b1028, 0x3a2a40); b.update(t); }
    for (const l of this.lamps) l.lit = night;
    for (const s of this.signals) s.update(t);
    for (const { s, seed } of this.steam) s.update(t, 60 + seed * 7, 0.32, camera);
    const span = this.length + 80;
    for (const c of this.cars) { const z = 40 - ((((c.z0 + c.speed * t) % span) + span) % span); c.v.group.position.set(c.lane, 0, z); c.v.lit = night; c.v.update(t, Math.abs(c.speed) * t); }
    for (const a of this.areas) { a.light.color.copy(a.screen.glow(t, this.tmpC)); a.light.intensity = 2.6 * night; }
    if (this.cube && renderer && scene) {
      // Render the probe against a fixed environment, never its own previous result, so a frame never depends on
      // which frame was rendered before it (seeks and re-renders stay identical).
      const env = scene.environment; scene.environment = this.baseEnv;
      this.cube.update(renderer, scene); (this.cube.renderTarget.texture as any).needsPMREMUpdate = true;
      scene.environment = env;
    }
  }
}

let _puddles: THREE.Texture | undefined;
/** Roughness map for freshly wet asphalt: glossy overall with soft, slightly rougher drying patches (green channel). */
function puddleMap() {
  if (_puddles) return _puddles;
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d')!, img = g.createImageData(N, N), r = rng(9);
  const grid = 16, h = Array.from({ length: (grid + 1) * (grid + 1) }, () => r());
  const at = (x: number, y: number) => { const gx = x / N * grid, gy = y / N * grid, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, s = (a: number) => a * a * (3 - 2 * a);
    const v = (i: number, j: number) => h[((j % grid) * (grid + 1)) + (i % grid)]; return v(ix, iy) * (1 - s(fx)) * (1 - s(fy)) + v(ix + 1, iy) * s(fx) * (1 - s(fy)) + v(ix, iy + 1) * (1 - s(fx)) * s(fy) + v(ix + 1, iy + 1) * s(fx) * s(fy); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const n = at(x, y) * 0.6 + at(x * 3.1 % N, y * 3.1 % N) * 0.4, rough = 0.1 + 0.32 * Math.min(1, Math.max(0, (n - 0.35) * 2.2)), v = Math.round(Math.min(1, Math.max(0, rough)) * 255), j = (y * N + x) * 4; img.data[j] = v; img.data[j + 1] = v; img.data[j + 2] = v; img.data[j + 3] = 255; }
  // Wet everywhere, drier patches slightly rougher; geometry UVs are metres (projectUVs), so one tile spans 9 m.
  g.putImageData(img, 0, 0); _puddles = new THREE.CanvasTexture(c); _puddles.wrapS = _puddles.wrapT = THREE.RepeatWrapping; _puddles.repeat.set(1 / 9, 1 / 9); _puddles.colorSpace = THREE.NoColorSpace;
  return _puddles;
}
