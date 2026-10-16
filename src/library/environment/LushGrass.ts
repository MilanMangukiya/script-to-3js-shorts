import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { rng } from '../util/math';
import type { GrassWind } from './GrassField';

/**
 * Lush grass v2: dense instanced tufts of curved, tapered blades (each tuft splays 2–8 blades with their own lean,
 * curl, height and width), lit by the scene's real lights through MeshStandardMaterial — sun shadows fall across the
 * turf, lamps and moonlight light it, the sky environment tints it — plus back-lit translucency. Colour varies per
 * blade and in field-scale patches (lush, sun-bleached, dry straw), the base of the turf is darker, and density is
 * highest around a focus point (where the camera works) and thins with distance while blades widen to keep the field
 * covered. Optional wildflowers (daisy-like heads with golden centres on swaying stems) share the same wind.
 * `update(time_s, wind)` is deterministic; doubling `bend` shows a wind pushing twice as hard.
 */
export interface LushGrassOptions {
  /** Footprint [xMin, xMax, zMin, zMax] (m), ground height and an optional rejection test (paths, buildings, cliffs). */
  area: [number, number, number, number]; ground: (x: number, z: number) => number; reject?: (x: number, z: number) => boolean;
  /** Full density within `nearRadius` (m) of `focus` [x, z], then ∝ (nearRadius / r)^falloff. */
  focus?: [number, number]; nearRadius?: number; falloff?: number;
  /** Tufts per m² at full density, hard cap on tufts, blades per tuft. */
  density?: number; maxTufts?: number; blades?: number;
  /** Tuft height range and blade base width (m). */
  minHeight?: number; maxHeight?: number; width?: number;
  rootColor?: THREE.ColorRepresentation; midColor?: THREE.ColorRepresentation; tipColor?: THREE.ColorRepresentation;
  lushColor?: THREE.ColorRepresentation; dryColor?: THREE.ColorRepresentation;
  /** Fraction (0..1) of the field in dry patches, and the patch size (m). */
  dryness?: number; patchScale?: number;
  /** Back-lit translucency strength and turf-base darkening (0 black … 1 none). */
  translucency?: number; rootShade?: number;
  /** Wildflowers scattered with the same density law. */
  flowers?: { count: number; colors?: THREE.ColorRepresentation[]; size?: number; minHeight?: number; maxHeight?: number };
  seed?: number;
}

const SSS_FN = /* glsl */ `
  uniform float uSSS; varying float vGrassV;
  void grassSSS(const in IncidentLight L, const in vec3 N, const in vec3 V, const in PhysicalMaterial m, inout ReflectedLight r) {
    float back = pow(saturate(dot(-V, L.direction)), 3.0);
    float thru = saturate(-dot(N, L.direction));
    r.directDiffuse += m.diffuseColor * L.color * (back * 0.9 + thru * 0.5) * uSSS * (0.3 + 0.7 * vGrassV);
  }`;
const CALL = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const WIND_GLSL = /* glsl */ `
  uniform float uTime, uBend, uGust, uGustSpeed; uniform vec2 uDir;
  float gustAt(vec2 p){ return vnoise((p - uDir * uTime * uGustSpeed) * 0.22) * 0.75 + vnoise((p - uDir * uTime * uGustSpeed * 1.3) * 0.7) * 0.25; }`;

/** Patch a MeshStandardMaterial: custom vertex placement, per-vertex colour and translucency in every direct light. */
function patchMaterial(mat: THREE.MeshStandardMaterial, uniforms: Record<string, THREE.IUniform>, vertexPars: string, vertexCall: string, key: string) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_NOISE}\n${WIND_GLSL}\nvarying vec3 vGrassCol; varying float vGrassV;\n${vertexPars}`)
      .replace('#include <beginnormal_vertex>', `vec3 gP, gN; ${vertexCall}\nvec3 objectNormal = gN;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = gP;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrassCol;')
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${SSS_FN}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGrassCol;')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.split(CALL).join(`${CALL} grassSSS( directLight, geometryNormal, geometryViewDir, material, reflectedLight );`));
  };
  mat.customProgramCacheKey = () => key;
}

export class LushGrass {
  readonly mesh: THREE.Mesh; readonly flowers?: THREE.Mesh; readonly group = new THREE.Group();
  readonly count: number;
  private u: Record<string, THREE.IUniform>;

  constructor(o: LushGrassOptions) {
    const [x0, x1, z0, z1] = o.area, r = rng(o.seed ?? 41), reject = o.reject ?? (() => false);
    const [fx, fz] = o.focus ?? [0, 0], R = o.nearRadius ?? 8, fall = o.falloff ?? 2, dens = o.density ?? 120, cap = o.maxTufts ?? 220000;
    const hMin = o.minHeight ?? 0.16, hMax = o.maxHeight ?? 0.5, W = o.width ?? 0.007;
    const densityAt = (x: number, z: number) => { const d = Math.hypot(x - fx, z - fz); return d <= R ? 1 : Math.pow(R / d, fall); };
    // Rejection-sample tufts against the density law (deterministic).
    const pos: number[] = [], misc: number[] = [], cand = Math.ceil((x1 - x0) * (z1 - z0) * dens);
    for (let i = 0; i < cand && pos.length / 4 < cap; i++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), keep = r(), hr = r(), yaw = r() * Math.PI * 2, seed = r(), wr = r();
      if (keep > densityAt(x, z) || reject(x, z)) continue;
      pos.push(x, o.ground(x, z), z, hMin + Math.pow(hr, 1.3) * (hMax - hMin)); misc.push(yaw, seed, W * (0.75 + 0.5 * wr), 0);
    }
    this.count = pos.length / 4;
    // Tuft template: B blades × S segments (two vertices per row, one tip vertex). position = (side, v, blade index).
    const B = Math.max(1, Math.min(8, o.blades ?? 5)), S = 5, tp: number[] = [], idx: number[] = [];
    for (let b = 0; b < B; b++) {
      const o0 = tp.length / 3;
      for (let i = 0; i < S; i++) { const v = i / S; tp.push(-1, v, b, 1, v, b); }
      tp.push(0, 1, b);
      for (let i = 0; i < S - 1; i++) { const a = o0 + i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      const a = o0 + (S - 1) * 2; idx.push(a, a + 1, a + 2);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(tp.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setIndex(idx);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(pos), 4));
    geo.setAttribute('iMisc', new THREE.InstancedBufferAttribute(new Float32Array(misc), 4));
    geo.instanceCount = this.count;

    const c = (v: THREE.ColorRepresentation | undefined, d: number) => new THREE.Color(v ?? d);
    this.u = {
      uTime: { value: 0 }, uBend: { value: 0.2 }, uGust: { value: 0.4 }, uGustSpeed: { value: 3 }, uDir: { value: new THREE.Vector2(0, 1) }, uGrow: { value: 1 },
      uRoot: { value: c(o.rootColor, 0x2c4519) }, uMid: { value: c(o.midColor, 0x5a8632) }, uTip: { value: c(o.tipColor, 0xb2c55e) },
      uLush: { value: c(o.lushColor, 0x77b043) }, uDry: { value: c(o.dryColor, 0xcdb983) },
      uDryness: { value: o.dryness ?? 0.3 }, uPatch: { value: o.patchScale ?? 7 }, uAO: { value: o.rootShade ?? 0.32 }, uWiden: { value: 0.07 },
      uSSS: { value: o.translucency ?? 0.9 },
    };
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
    patchMaterial(mat, this.u, /* glsl */ `
      attribute vec4 iPos; attribute vec4 iMisc;
      uniform float uGrow, uDryness, uPatch, uAO, uWiden; uniform vec3 uRoot, uMid, uTip, uLush, uDry;
      void grassBlade(out vec3 P, out vec3 N, out vec3 C){
        float side = position.x, v = position.y, b = position.z, seed = iMisc.y;
        float r1 = hash11(seed * 91.7 + b * 13.1), r2 = hash11(seed * 47.3 + b * 7.7), r3 = hash11(seed * 13.9 + b * 29.3), r4 = hash11(seed * 71.1 + b * 3.3);
        float h = iPos.w * mix(0.55, 1.0, r1) * clamp(uGrow * 1.5 - seed * 0.5, 0.0, 1.0);
        float yaw = iMisc.x + b * 2.39996 + (r2 - 0.5) * 0.7;
        vec2 d = vec2(cos(yaw), sin(yaw)), wd = vec2(-d.y, d.x);
        float ra = r3 * 6.2832, rr = sqrt(r4) * 0.03;
        vec2 base = iPos.xz + vec2(cos(ra), sin(ra)) * rr;
        // Static lean + curl in the blade's own plane (angle from vertical grows along the blade) …
        float lean = 0.08 + 0.34 * r2, k = 0.25 + 0.85 * r1 * r1, th = lean + k * v;
        float ux = (cos(lean) - cos(th)) / k, uy = (sin(th) - sin(lean)) / k;
        // … plus a force-proportional wind arc with travelling gusts and flutter.
        float wind = uBend * (1.0 + uGust * (gustAt(base) * 2.0 - 1.0)) * (0.7 + 0.6 * r3) + 0.035 * sin(uTime * (5.0 + r4 * 3.0) + r1 * 40.0);
        float aw = abs(wind) > 1e-3 ? wind : 1e-3, wx = (1.0 - cos(aw * v)) / aw, drop = v - sin(aw * v) / aw;
        vec3 spine = vec3(base.x + (d.x * ux + uDir.x * wx) * h, iPos.y + max(uy - drop, 0.0) * h, base.y + (d.y * ux + uDir.y * wx) * h);
        vec3 T = normalize(vec3(d.x * sin(th) + uDir.x * sin(aw * v), cos(th) * cos(aw * v), d.y * sin(th) + uDir.y * sin(aw * v)));
        vec3 Wd = vec3(wd.x, 0.0, wd.y);
        float w = iMisc.z * mix(0.7, 1.15, r4) * (1.0 - pow(v, 1.5));
        w *= 1.0 + uWiden * max(length(cameraPosition - spine) - 4.0, 0.0);          // far blades widen to keep coverage
        P = spine + Wd * side * w * 0.5;
        vec3 n = normalize(cross(Wd, T));
        N = normalize(mix(normalize(n + Wd * side * 0.45), vec3(0.0, 1.0, 0.0), 0.28)); // rounded blade, softened toward up
        // Colour: root → mid → tip, per-blade jitter, field patches (lush / bleached / dry straw), dead blades, root shade.
        float patchN = vnoise(base / uPatch) * 0.65 + vnoise(base / (uPatch * 0.31) + 7.3) * 0.35;
        float dryK = smoothstep(1.0 - uDryness - 0.12, 1.0 - uDryness + 0.12, patchN);
        vec3 tipC = mix(uTip, uLush, r2 * 0.7);
        vec3 col = mix(uRoot, mix(uMid, tipC, smoothstep(0.35, 1.0, v)), smoothstep(0.0, 0.45, v));
        col = mix(col, uDry * mix(0.82, 1.08, r3), clamp(dryK * (0.3 + 0.55 * v) + step(0.94, r1) * 0.85, 0.0, 1.0));
        col *= mix(0.84, 1.12, r4) * mix(uAO, 1.0, smoothstep(0.0, 0.65, v));
        C = col;
      }`, 'grassBlade(gP, gN, vGrassCol); vGrassV = position.y;', 'lush-grass-v2');
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.userData.noDepthFx = true;
    this.group.add(this.mesh);

    if (o.flowers && o.flowers.count > 0) { this.flowers = this.buildFlowers(o, densityAt, reject); this.group.add(this.flowers); }
  }

  private buildFlowers(o: LushGrassOptions, densityAt: (x: number, z: number) => number, reject: (x: number, z: number) => boolean) {
    const f = o.flowers!, r = rng((o.seed ?? 41) + 9), [x0, x1, z0, z1] = o.area;
    const cols = (f.colors ?? [0xf4f1e6, 0xf4f1e6, 0xf2c230, 0xe58fb4, 0xd65a8a]).map((c) => new THREE.Color(c));
    const fp: number[] = [], fm: number[] = [], fc: number[] = [];
    for (let guard = 0; fp.length / 4 < f.count && guard < f.count * 400; guard++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), keep = r(), h = r(), y = r(), s = r(), ci = r(), t = r();
      if (keep > densityAt(x, z) || reject(x, z)) continue;
      fp.push(x, o.ground(x, z), z, (f.minHeight ?? 0.14) + h * ((f.maxHeight ?? 0.42) - (f.minHeight ?? 0.14)));
      fm.push(y * Math.PI * 2, (f.size ?? 0.018) * (0.7 + 0.6 * s), t, 0.15 + 0.5 * t);
      const col = cols[Math.floor(ci * cols.length) % cols.length]; fc.push(col.r, col.g, col.b);
    }
    // Template: crossed stem ribbons (part 0), 9 cupped petals (part 1), domed centre (part 2), head radius 1.
    const P: number[] = [], part: number[] = [], idx: number[] = [];
    const quad = (a: number[], b: number[], c: number[], d: number[], k: number) => { const o0 = P.length / 3; P.push(...a, ...b, ...c, ...d); part.push(k, k, k, k); idx.push(o0, o0 + 1, o0 + 2, o0, o0 + 2, o0 + 3); };
    for (const [ax, az] of [[1, 0], [0, 1]]) for (let i = 0; i < 4; i++) { const v0 = i / 4, v1 = (i + 1) / 4, w = 0.0022;
      quad([-ax * w, v0, -az * w], [ax * w, v0, az * w], [ax * w, v1, az * w], [-ax * w, v1, -az * w], 0); }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), px = -sa, pz = ca, cup = (rr: number) => 0.22 * rr * rr;
      const p = (rr: number, ww: number) => [ca * rr + px * ww, cup(rr), sa * rr + pz * ww];
      quad(p(0.18, -0.1), p(0.18, 0.1), p(0.62, 0.17), p(0.62, -0.17), 1); quad(p(0.62, -0.17), p(0.62, 0.17), p(1.0, 0.06), p(1.0, -0.06), 1);
    }
    const o0 = P.length / 3; P.push(0, 0.16, 0); part.push(2);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; P.push(Math.cos(a) * 0.24, 0.04, Math.sin(a) * 0.24); part.push(2); }
    for (let i = 0; i < 10; i++) idx.push(o0, o0 + 1 + i, o0 + 1 + ((i + 1) % 10));
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setIndex(idx);
    geo.setAttribute('fPos', new THREE.InstancedBufferAttribute(new Float32Array(fp), 4));
    geo.setAttribute('fMisc', new THREE.InstancedBufferAttribute(new Float32Array(fm), 4));
    geo.setAttribute('fCol', new THREE.InstancedBufferAttribute(new Float32Array(fc), 3));
    geo.instanceCount = fp.length / 4;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
    patchMaterial(mat, this.u, /* glsl */ `
      attribute float aPart; attribute vec4 fPos; attribute vec4 fMisc; attribute vec3 fCol;
      void flowerVertex(out vec3 P, out vec3 N, out vec3 C){
        vec3 p = position; float h = fPos.w, sz = fMisc.y, yaw = fMisc.x;
        float wind = uBend * 0.8 * (1.0 + uGust * (gustAt(fPos.xz) * 2.0 - 1.0)) + 0.05 * sin(uTime * 3.0 + fMisc.z * 30.0);
        if (aPart < 0.5) {
          vec2 off = uDir * wind * p.y * p.y * h * 0.6;
          P = vec3(fPos.x + p.x + off.x, fPos.y + p.y * h, fPos.z + p.z + off.y); N = normalize(vec3(p.x, 0.0, p.z) + vec3(0.0, 1e-4, 0.0));
          C = mix(vec3(0.16, 0.26, 0.09), vec3(0.32, 0.47, 0.17), p.y); vGrassV = 0.5;
        } else {
          vec2 off = uDir * wind * h * 0.6;
          float cy = cos(yaw), sy = sin(yaw), ct = cos(fMisc.w), st = sin(fMisc.w);
          vec3 q = vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy) * sz;
          q = vec3(q.x, q.y * ct - q.z * st, q.y * st + q.z * ct);
          P = vec3(fPos.x + off.x, fPos.y + h, fPos.z + off.y) + q;
          N = normalize(vec3(-q.x * 8.0, 1.0, -q.z * 8.0) + vec3(0.0, 0.0, -st));
          C = aPart < 1.5 ? fCol : vec3(0.93, 0.68, 0.12); vGrassV = 1.0;
        }
      }`, 'flowerVertex(gP, gN, vGrassCol);', 'lush-grass-v2-flowers');
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.userData.noDepthFx = true;
    return mesh;
  }

  /** Growth 0..1 for sprouting time-lapses (1 = full height, default). */
  set growth(v: number) { this.u.uGrow.value = v; this.group.visible = v > 0.001; }

  update(time_s: number, wind: GrassWind) {
    this.u.uTime.value = time_s; this.u.uBend.value = wind.bend; this.u.uDir.value.copy(wind.direction).normalize();
    this.u.uGust.value = wind.gust ?? 0.35; this.u.uGustSpeed.value = wind.gustSpeed ?? 4;
  }
}
