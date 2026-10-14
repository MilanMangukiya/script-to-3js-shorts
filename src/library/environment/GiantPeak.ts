import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { ATMOSPHERE_GLSL } from './PlanetAtmosphere';
import { clamp, smoothstep } from '../util/math';

/**
 * giant-peak-v1 — planetary-scale mountain in kilometres on a curved planet, for street-to-orbit scale stories.
 * Polar mesh (concave profile h = H(1 - r/Rb)^p with radial ridge gullies and fractal detail) laid on the sphere of
 * radius R (site-local frame of atmosphere-scatter-sky-v1: x east, y up, z south, planet centre (0, -R, 0)).
 * The material uses the same atmosphere functions as the sky, so haze, sunlight colour, cloud-shell occlusion and
 * horizon hiding match the backdrop at every scale. Altitude zoning: lowland forest, alpine rock, a snow belt that
 * stops at the top of the weather (uSnowTop, ~12 km), then bare stratified rock to the summit.
 * Controls (uniforms, all deterministic):
 *  - uGrow 0..1 vertical growth; uCollapse 0..1 gravitational slump (height falls, base spreads, massif sinks);
 *  - ten emissive altitude bands (uBandAlt/uBandOn/uBandCol), a tinted zone above uZoneAlt (uZoneAmt, uZoneCol);
 *  - uCrack/uCrackFront glowing fracture network on the lower flanks; uClipZ cutaway clip; uHole local-patch hole.
 * Place it with `place(worldPerKm, cameraWorld, cameraKm)` so the true camera position maps to the stage camera, and
 * call `setCamera(cameraWorld)` every frame (writes the shared uCamKm/uCamAlt).
 * `PeakCutaway` is the matching cross-section cap (z = 0 plane) with an overburden-stress heat map.
 */

export interface GiantPeakOptions {
  /** Summit height and base radius (km), profile exponent, seed. */
  height?: number; baseRadius?: number; profile?: number; seed?: number;
  /** Ring/segment resolution. */
  rings?: number; segments?: number;
}

// ---- deterministic CPU noise (3D value noise) matching the role of GLSL vnoise3
const hash3 = (x: number, y: number, z: number, s: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function vnoise3(x: number, y: number, z: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, s);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy), L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}
function fbm3(x: number, y: number, z: number, s: number, oct = 5) {
  let a = 0.5, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) { sum += a * vnoise3(x, y, z, s + i * 31); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; z = z * 2.03 + 5.3; a *= 0.5; }
  return sum / n;
}
function ridged3(x: number, y: number, z: number, s: number, oct = 5) {
  let a = 0.5, sum = 0, n = 0, prev = 1;
  for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(vnoise3(x, y, z, s + i * 53) * 2 - 1); v *= v; sum += a * v * prev; n += a; prev = clamp(v * 1.6); x = x * 2.07 + 3.3; y = y * 2.07 + 7.7; z = z * 2.07 + 1.9; a *= 0.5; }
  return sum / n;
}

const PEAK_VERTEX = /* glsl */ `
attribute vec3 aPolar;
uniform float uGrow, uCollapse, uR, uBaseR;
varying vec3 vLocal; varying vec3 vN;
float peakDeformH(float h, float r, float c, float grow){
  float sink = c*4.0*max(0.0, 1.0 - pow(r/(uBaseR*1.8), 2.0));
  if (h >= 0.0) return h*grow*(1.0 - 0.9*c) - sink;
  return h - sink*smoothstep(-90.0, 0.0, h);
}
float peakDeformR(float r, float h, float c){ return r*(1.0 + 0.8*c*smoothstep(-25.0, 0.0, h)); }
vec3 peakPos(float r, float th, float h){ float phi = r/uR; return vec3(sin(phi)*cos(th), cos(phi), sin(phi)*sin(th))*(uR + h) - vec3(0.0, uR, 0.0); }
`;

export class GiantPeak {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  readonly H: number; readonly Rb: number; readonly R: number;
  private p: number; private seed: number;
  private static cache = new Map<string, THREE.BufferGeometry>();

  constructor(atmosphere: Record<string, THREE.IUniform>, o: GiantPeakOptions = {}) {
    this.H = o.height ?? 100; this.Rb = o.baseRadius ?? 200; this.p = o.profile ?? 1.6; this.seed = o.seed ?? 7;
    this.R = atmosphere.uR.value as number;
    const key = `${this.H}|${this.Rb}|${this.p}|${this.seed}|${o.rings ?? 340}|${o.segments ?? 1080}|${this.R}`;
    let geo = GiantPeak.cache.get(key);
    if (!geo) { geo = this.build(o.rings ?? 340, o.segments ?? 1080); GiantPeak.cache.set(key, geo); }
    const bands = { uBandAlt: { value: new Array(10).fill(-1000) }, uBandOn: { value: new Array(10).fill(0) }, uBandCol: { value: Array.from({ length: 10 }, () => new THREE.Color(1, 0.7, 0.3)) } };
    this.uniforms = {
      ...atmosphere, ...bands,
      uCamKm: atmosphere.uCamKm ?? { value: new THREE.Vector3() }, uCamAlt: atmosphere.uCamAlt ?? { value: 0 },
      uGrow: { value: 1 }, uCollapse: { value: 0 }, uBaseR: { value: this.Rb }, uSnowTop: { value: 12 },
      uZoneAlt: { value: 1e4 }, uZoneAmt: { value: 0 }, uZoneCol: { value: new THREE.Color(1, 0.25, 0.2) },
      uCrack: { value: 0 }, uCrackFront: { value: 0 }, uClipZ: { value: 1e9 }, uHole: { value: new THREE.Vector4(0, 0, 0, 0) },
      uDetail: { value: 1 }, uEmissive: { value: 1 }, uLogDepth: { value: 0 }, uLogFar: { value: 1e6 },
    };
    atmosphere.uCamKm ??= this.uniforms.uCamKm; atmosphere.uCamAlt ??= this.uniforms.uCamAlt;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: false,
      vertexShader: PEAK_VERTEX + /* glsl */ `
        varying float vViewW;
        void main(){
          float c = uCollapse, h = aPolar.z;
          float r = peakDeformR(aPolar.x, h, c);
          vec3 p = peakPos(r, aPolar.y, peakDeformH(h, aPolar.x, c, uGrow));
          float ky = max(uGrow*(1.0 - 0.9*c), 0.03), kr = 1.0 + 0.8*c;
          vN = normalize(vec3(normal.x/kr, normal.y/ky, normal.z/kr));
          vLocal = p;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.0);
          vViewW = gl_Position.w;
        }`,
      fragmentShader: /* glsl */ `
        #define ATMO_STEPS 10
        uniform float uLogDepth, uLogFar; varying float vViewW;
        ${GLSL_NOISE}
        ${ATMOSPHERE_GLSL}
        uniform vec3 uCamKm; uniform float uCamAlt;
        uniform float uBandAlt[10]; uniform float uBandOn[10]; uniform vec3 uBandCol[10];
        uniform float uZoneAlt, uZoneAmt, uCrack, uCrackFront, uClipZ, uBaseR, uDetail, uSnowTop, uEmissive;
        uniform vec3 uZoneCol; uniform vec4 uHole;
        varying vec3 vLocal; varying vec3 vN;
        float detailH(vec3 p, float foot){
          float s = 0.0, a = 0.6, f = 1.0/7.0;
          for (int i = 0; i < 6; i++){ float wl = 1.0/f; s += a*(1.0 - smoothstep(wl*0.12, wl*0.5, foot))*(vnoise3(p*f) - 0.5); f *= 2.07; a *= 0.5; }
          return s;
        }
        vec3 bumpN(vec3 pos, vec3 n, float h){
          vec3 dx = dFdx(pos), dy = dFdy(pos), r1 = cross(dy, n), r2 = cross(n, dx);
          float det = dot(dx, r1); vec2 dh = vec2(dFdx(h), dFdy(h));
          return normalize(abs(det)*n - sign(det)*(dh.x*r1 + dh.y*r2));
        }
        void main(){
          if (vLocal.z > uClipZ) discard;
          if (uHole.w > 0.0 && length(vLocal.xz - uHole.xz) < uHole.w) discard;
          vec3 P = vLocal + vec3(0.0, uR, 0.0), ro = uCamKm + vec3(0.0, uR, 0.0);
          vec3 toP = P - ro; float dist = max(length(toP), 1e-4); vec3 rd = toP/dist;
          float b = dot(ro, rd), cg = uCamAlt*(2.0*uR + uCamAlt), dg = b*b - cg;
          if (dg > 0.0 && b < 0.0){ float tg = -b - sqrt(dg); if (tg > 0.0 && tg < dist - 0.25 - dist*0.002) discard; }
          float alt = length(P) - uR;
          vec3 up = normalize(P);
          float foot = length(fwidth(vLocal));
          vec3 N = bumpN(vLocal, normalize(vN), detailH(vLocal, foot)*uDetail);
          if (!gl_FrontFacing) N = -N;
          float slope = 1.0 - dot(N, up);
          float n1 = vnoise3(vLocal/3.0), n2 = vnoise3(vLocal/0.7 + 5.0), n3 = vnoise3(vLocal/11.0 + 2.0);
          vec3 low = mix(vec3(0.05, 0.07, 0.035), vec3(0.10, 0.095, 0.065), n1);
          vec3 alpine = mix(vec3(0.12, 0.11, 0.095), vec3(0.18, 0.165, 0.14), n2);
          vec3 bare = mix(vec3(0.20, 0.175, 0.15), vec3(0.31, 0.275, 0.235), n3)*(0.93 + 0.1*sin(alt*2.2 + n2*5.0 + n3*6.0));
          vec3 high = mix(vec3(0.16, 0.15, 0.145), vec3(0.25, 0.23, 0.21), n2)*(0.94 + 0.08*sin(alt*1.3 + n1*6.0));
          vec3 alb = mix(low, alpine, smoothstep(1.2, 3.0, alt + (n1 - 0.5)*1.5));
          alb = mix(alb, bare, smoothstep(9.0, 16.0, alt));
          alb = mix(alb, high, smoothstep(45.0, 80.0, alt));
          alb *= mix(1.0, 0.72, smoothstep(0.35, 0.75, slope));
          float snowLine = 3.4 + (n1 - 0.5)*1.4, snowTop = uSnowTop + (n3 - 0.5)*2.4;
          float snow = smoothstep(snowLine, snowLine + 0.8, alt)*(1.0 - smoothstep(snowTop - 1.5, snowTop + 1.0, alt))*(1.0 - smoothstep(0.32, 0.6, slope + (n2 - 0.5)*0.25));
          alb = mix(alb, vec3(0.74, 0.78, 0.84), snow);
          float rr = length(vLocal.xz);
          alb = mix(alb, atmoGroundAlbedo(P), smoothstep(uBaseR*0.72, uBaseR*0.98, rr)*(1.0 - smoothstep(4.0, 9.0, alt)));
          float zone = uZoneAmt*smoothstep(uZoneAlt - 0.25, uZoneAlt + 0.25, alt);
          alb = mix(alb, alb*uZoneCol*1.25, zone*0.18);
          vec3 Ts = atmoSunT(P + up*0.02);
          float ndl = max(dot(N, uSunDir), 0.0);
          vec3 bounce = uSunPower*vec3(0.045, 0.055, 0.07)*(0.5 - 0.5*dot(N, up))*smoothstep(4.0, 30.0, alt);
          vec3 col = alb*(uSunPower*Ts*ndl/PI + atmoAmbient(alt)*(0.65 + 0.35*dot(N, up)) + bounce);
          float bw = max(0.12, fwidth(alt)*1.7);
          vec3 em = vec3(0.0);
          for (int i = 0; i < 10; i++){ float on = uBandOn[i]; if (on > 0.001){ float d = abs(alt - uBandAlt[i]); em += uBandCol[i]*on*(smoothstep(bw, bw*0.3, d)*2.4 + exp(-d/(bw*5.0))*0.22); } }
          // Hazard hatching: thin rings every 3 km through the zone, drawn like a scan overlay.
          float hatch = smoothstep(0.86, 0.97, fract(alt/3.0))*(1.0 - smoothstep(0.97, 1.0, fract(alt/3.0)));
          em += uZoneCol*zone*(0.02 + 0.55*hatch*smoothstep(bw*4.0, bw, 0.4));
          if (uCrack > 0.0){
            float c1 = 1.0 - abs(vnoise3(vLocal/7.5)*2.0 - 1.0), c2 = 1.0 - abs(vnoise3(vLocal/2.6 + 7.0)*2.0 - 1.0);
            float line = smoothstep(0.94, 0.99, max(c1, c2*0.985));
            em += vec3(1.0, 0.45, 0.14)*uCrack*line*smoothstep(uCrackFront, uCrackFront - 5.0, alt)*1.4;
          }
          col += em*uSunPower*0.1*uEmissive;
          vec2 seg = atmoSegment(ro, rd, uCamAlt, dist);
          float tc = atmoShell(ro, rd, uCamAlt, uCloudAlt), a = 0.0; vec3 cc = vec3(0.0);
          if (tc > 0.0 && tc < dist){ vec3 pc = ro + rd*tc; a = atmoCloud(pc); cc = atmoCloudShade(pc, a, uCamAlt < uCloudAlt); }
          vec3 S1, S2, T1, T;
          atmoMarch(ro, rd, seg.x, seg.y, a > 0.002 ? tc : -1.0, S1, S2, T1, T);
          gl_FragColor = vec4(max(S1 + (1.0 - a)*S2 + T1*a*cc + (1.0 - a)*T*col, 0.0), 1.0);
          // Optional logarithmic depth for stages that mix centimetre foregrounds with this 100 km mesh: the mountain
          // resolves its own ridges, then the stage clears depth (depthClearer) before drawing the foreground.
          gl_FragDepth = uLogDepth > 0.5 ? log2(1.0 + max(vViewW, 0.0))/log2(1.0 + uLogFar) : gl_FragCoord.z;
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  /** Surface altitude (km, before growth/collapse) at polar (r, θ). */
  heightPolar(r: number, th: number): number {
    const { H, Rb, p } = this, s = this.seed;
    if (r >= Rb) return -0.5 * smoothstep(Rb, Rb * 1.25, r);
    const base = H * Math.pow(1 - r / Rb, p), cx = Math.cos(th), sz = Math.sin(th), x = r * cx, z = r * sz;
    const tin = r / (r + 20), tnear = r / (r + 3), tout = 1 - smoothstep(Rb * 0.78, Rb, r);
    const ridge = ridged3(cx * 2.3, sz * 2.3, r / 22, s, 4);
    const detail = fbm3(x / 21, z / 21, 0.37, s + 5);
    const fine = fbm3(x / 6.5, z / 6.5, 1.7, s + 9, 3);
    // Crags and buttresses around the upper spire so the summit reads as rock, not a lathe.
    const crag = ridged3(x / 3.4, z / 3.4, 2.9, s + 13, 4);
    let h = base * (1 + 0.24 * (ridge - 0.5) * (r / (r + 45))) + ((detail - 0.5) * 7 + (fine - 0.5) * 2.2) * tnear * tout * Math.min(1, base / 20 + 0.15)
      + (crag - 0.42) * 2.6 * tnear * (1 - smoothstep(25, 60, r));
    h = Math.min(h, H - 0.32 * r);
    if (r < 1e-6) h = H;
    return Math.max(h, 0);
  }
  /** Surface altitude at site-local (x, z) km. */
  heightAt(x: number, z: number) { return this.heightPolar(Math.hypot(x, z), Math.atan2(z, x)); }
  /** Site-local km position of the surface (or `lift` km above it) at (x, z), for growth g and collapse c. */
  surfacePoint(x: number, z: number, lift = 0, g = 1, c = 0, out = new THREE.Vector3()) {
    const r0 = Math.hypot(x, z), th = Math.atan2(z, x), h = this.heightPolar(r0, th);
    const sink = c * 4 * Math.max(0, 1 - Math.pow(r0 / (this.Rb * 1.8), 2));
    const hs = (h >= 0 ? h * g * (1 - 0.9 * c) - sink : h - sink) + lift, r = r0 * (1 + 0.8 * c), phi = r / this.R;
    return out.set(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)).multiplyScalar(this.R + hs).sub(new THREE.Vector3(0, this.R, 0));
  }

  /** Scale the km-built mesh to `worldPerKm` and offset it so that `cameraKm` (true site-local km) lands on `cameraWorld`. */
  place(worldPerKm: number, cameraWorld: THREE.Vector3, cameraKm: THREE.Vector3) {
    this.mesh.scale.setScalar(worldPerKm);
    this.mesh.position.copy(cameraWorld).addScaledVector(cameraKm, -worldPerKm);
    this.mesh.updateMatrixWorld(true);
  }
  /** World → site-local km for this placement. */
  toKm(world: THREE.Vector3, out = new THREE.Vector3()) { return out.copy(world).sub(this.mesh.position).divideScalar(this.mesh.scale.x); }
  toWorld(km: THREE.Vector3, out = new THREE.Vector3()) { return out.copy(km).multiplyScalar(this.mesh.scale.x).add(this.mesh.position); }
  /** Write the true camera position (km) into the shared atmosphere uniforms. Returns it. */
  setCamera(cameraWorld: THREE.Vector3): THREE.Vector3 {
    const km = this.toKm(cameraWorld, this.uniforms.uCamKm.value as THREE.Vector3);
    this.uniforms.uCamAlt.value = Math.hypot(km.x, km.y + this.R, km.z) - this.R;
    return km;
  }
  /** Light band i at altitude alt (km) with strength on and colour col. */
  setBand(i: number, alt: number, on: number, col?: THREE.ColorRepresentation) {
    (this.uniforms.uBandAlt.value as number[])[i] = alt; (this.uniforms.uBandOn.value as number[])[i] = on;
    if (col !== undefined) (this.uniforms.uBandCol.value as THREE.Color[])[i].set(col);
  }
  clearBands() { for (let i = 0; i < 10; i++) (this.uniforms.uBandOn.value as number[])[i] = 0; }
  set grow(v: number) { this.uniforms.uGrow.value = v; }
  set collapse(v: number) { this.uniforms.uCollapse.value = v; }

  private build(rings: number, segs: number): THREE.BufferGeometry {
    const Rmax = this.Rb * 1.25, n = 1 + rings * segs;
    const pos = new Float32Array(n * 3), polar = new Float32Array(n * 3), v = new THREE.Vector3();
    const put = (k: number, r: number, th: number) => {
      const h = this.heightPolar(r, th), phi = r / this.R;
      v.set(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)).multiplyScalar(this.R + h); v.y -= this.R;
      pos.set([v.x, v.y, v.z], k * 3); polar.set([r, th, h], k * 3);
    };
    put(0, 0, 0);
    for (let i = 1; i <= rings; i++) {
      const r = Rmax * Math.pow(i / rings, 1.4);
      for (let j = 0; j < segs; j++) put(1 + (i - 1) * segs + j, r, (j / segs) * Math.PI * 2);
    }
    const idx: number[] = [];
    const at = (i: number, j: number) => 1 + (i - 1) * segs + (j % segs);
    for (let j = 0; j < segs; j++) idx.push(0, at(1, j + 1), at(1, j));
    for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
      const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1);
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPolar', new THREE.BufferAttribute(polar, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
}

/**
 * Cross-section cap for a GiantPeak cut along the z = 0 plane (keep the peak's z <= 0 half with uClipZ = 0):
 * mountain body coloured by overburden stress (ρ g d with ρ = 2,700 kg/m³ → 26.5 MPa per km), a dashed granite
 * limit line at `limitDepth` km, crust and mantle layers below (Moho at 35 km). Deformation matches the peak's
 * growth/collapse, so the cut stays sealed while the massif slumps. Uniforms: uReveal (0..1 stress fill from the
 * surface down), uLimit (limit-line strength), uCrack (fracture glow inside the overstressed zone).
 */
/** A no-op mesh that clears the depth buffer when reached in the render order (draw the far layer first). */
export function depthClearer(renderOrder: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1e-4, 1e-4), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
  m.frustumCulled = false; m.renderOrder = renderOrder;
  m.onBeforeRender = (renderer) => renderer.clearDepth();
  return m;
}

export class PeakCutaway {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor(peak: GiantPeak, o: { halfWidth?: number; depth?: number; columns?: number; rows?: number; limitDepth?: number } = {}) {
    const X = o.halfWidth ?? 900, D = o.depth ?? 320, nc = o.columns ?? 900, nr = o.rows ?? 90;
    const pos: number[] = [], polar: number[] = [], surf: number[] = [], idx: number[] = [];
    for (let i = 0; i <= nc; i++) {
      const x = -X + (2 * X * i) / nc, r = Math.abs(x), th = x >= 0 ? 0 : Math.PI, hs = Math.max(peak.heightPolar(r, th), 0);
      for (let k = 0; k <= nr; k++) {
        // Rows: dense near the surface, sparser in the deep mantle.
        const u = k / nr, h = hs - (hs + D) * Math.pow(1 - u, 1.6) * 1.0;
        const yh = u === 1 ? hs : h;
        const phi = r / peak.R, s = th === 0 ? 1 : -1;
        pos.push(s * Math.sin(phi) * (peak.R + yh), Math.cos(phi) * (peak.R + yh) - peak.R, 0);
        polar.push(r, th, yh); surf.push(hs);
      }
    }
    for (let i = 0; i < nc; i++) for (let k = 0; k < nr; k++) {
      const a = i * (nr + 1) + k, b = (i + 1) * (nr + 1) + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aPolar', new THREE.Float32BufferAttribute(polar, 3));
    geo.setAttribute('aSurf', new THREE.Float32BufferAttribute(surf, 1));
    geo.setIndex(idx);
    this.uniforms = { uR: peak.uniforms.uR, uGrow: peak.uniforms.uGrow, uCollapse: peak.uniforms.uCollapse, uBaseR: peak.uniforms.uBaseR,
      uReveal: { value: 0 }, uLimit: { value: 0 }, uLimitDepth: { value: o.limitDepth ?? 7.5 }, uCrack: { value: 0 }, uTime: { value: 0 }, uBright: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.DoubleSide, fog: false,
      vertexShader: PEAK_VERTEX + /* glsl */ `
        attribute float aSurf; varying float vDepth; varying float vH; varying float vX; varying float vSurf;
        void main(){
          float c = uCollapse, h = aPolar.z;
          float r = peakDeformR(aPolar.x, h, c);
          vec3 p = peakPos(r, aPolar.y, peakDeformH(h, aPolar.x, c, uGrow));
          vDepth = max(aSurf, 0.0) - h; vH = h; vSurf = aSurf; vX = aPolar.x*(aPolar.y > 1.0 ? -1.0 : 1.0); vLocal = p; vN = vec3(0.0, 0.0, 1.0);
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        uniform float uReveal, uLimit, uLimitDepth, uCrack, uTime, uBright, uCollapse;
        varying float vDepth; varying float vH; varying float vX; varying float vSurf; varying vec3 vLocal;
        vec3 heat(float t){ t = clamp(t, 0.0, 1.0);
          vec3 c = mix(vec3(0.05, 0.03, 0.18), vec3(0.55, 0.05, 0.32), smoothstep(0.0, 0.25, t));
          c = mix(c, vec3(0.92, 0.22, 0.08), smoothstep(0.2, 0.5, t)); c = mix(c, vec3(1.0, 0.62, 0.12), smoothstep(0.45, 0.75, t));
          return mix(c, vec3(1.0, 0.97, 0.85), smoothstep(0.75, 1.0, t)); }
        void main(){
          float n = vnoise3(vec3(vX/6.0, vH/2.0, 0.0)), n2 = vnoise3(vec3(vX/22.0, vH/9.0, 3.0));
          vec3 col;
          if (vH >= 0.0 && vSurf > 0.0){
            vec3 rock = mix(vec3(0.16, 0.14, 0.13), vec3(0.27, 0.24, 0.21), n2)*(0.85 + 0.2*sin(vH*2.2 + n*2.6));
            float shown = smoothstep(uReveal*100.0 + 1.5, uReveal*100.0 - 1.5, vDepth)*step(0.001, uReveal);
            float mpa = 26.5*vDepth;
            col = mix(rock, heat(mpa/2650.0)*(1.25 + 0.25*sin(uTime*2.0 - vDepth*0.4)), shown*0.92);
            float lim = abs(vDepth - uLimitDepth), dash = step(0.45, fract(vX/9.0));
            col = mix(col, vec3(0.35, 0.95, 1.0)*3.0, uLimit*smoothstep(0.9, 0.25, lim)*dash);
            if (uCrack > 0.0){
              float c1 = 1.0 - abs(vnoise3(vec3(vX/7.0, vH/5.0, 1.0))*2.0 - 1.0);
              float line = smoothstep(0.965, 0.993, c1)*smoothstep(uLimitDepth, uLimitDepth + 6.0, vDepth);
              float front = smoothstep(uCrack*100.0 + 2.0, uCrack*100.0 - 2.0, vH);
              col += vec3(1.0, 0.72, 0.42)*2.4*line*front*clamp(uCrack*4.0, 0.0, 1.0)*smoothstep(55.0, 20.0, vH);
            }
          } else {
            float d = -vH;
            vec3 crust = mix(vec3(0.20, 0.16, 0.12), vec3(0.30, 0.24, 0.18), n2)*(0.8 + 0.25*sin(d*0.9 + n*3.0));
            vec3 mantle = mix(vec3(0.55, 0.12, 0.03), vec3(0.95, 0.35, 0.06), vnoise3(vec3(vX/40.0, d/25.0 - uTime*0.05, 2.0)))*(0.55 + 0.35*smoothstep(35.0, 250.0, d));
            float moho = 35.0 + uCollapse*4.0*max(0.0, 1.0 - pow(abs(vX)/360.0, 2.0))*0.9;
            col = d < moho ? crust : mantle*1.6;
            col = mix(col, vec3(1.0, 0.7, 0.35)*2.2, smoothstep(1.2, 0.0, abs(d - moho))*0.6);
          }
          gl_FragColor = vec4(col*uBright, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }
}
