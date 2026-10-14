import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

/**
 * atmosphere-scatter-sky-v1 — physically motivated sky and planet backdrop for any altitude, from a street corner to
 * orbit. Single scattering (Rayleigh 8 km, Mie 1.2 km, ozone layer at 25 km; Hillaire 2020 coefficients) plus a cheap
 * multiple-scattering term, marched per pixel; the planet below is the shared NASA day map (lat/lon around a chosen
 * site) under a cloud shell from the NASA cloud map, with optional procedural cloud sea, windward storms, lee-side
 * clearing and desert tint near the site (for orographic weather shots).
 *
 * Frame: a local tangent frame at the site, kilometres, x = east, y = up, z = south, planet centre at (0, -R, 0).
 * Stage world axes must be parallel to this frame (any uniform scale/offset is fine): give the true camera position in
 * site-local km with `setCamera()` every frame.
 *
 * `ATMOSPHERE_GLSL` holds the shared functions so solid objects (see giant-peak-v1) get identical aerial perspective,
 * cloud occlusion and sunlight; `PlanetAtmosphere.uniforms` can be shared into such materials.
 */

export interface PlanetSiteOptions {
  /** Site latitude / longitude in degrees (east positive). */
  lat?: number; lon?: number;
  /** Planet radius and atmosphere thickness, km. */
  radius?: number; atmosphereTop?: number;
  /** Unit vector toward the sun in the site-local frame. */
  sunDirection?: THREE.Vector3;
  /** Sun irradiance scale (scene units; 8–24 typical) and multiple-scattering factor. */
  sunPower?: number; multiScatter?: number;
  /** Cloud shell altitude (km) and opacity. */
  cloudAltitude?: number; cloudOpacity?: number;
  /** Sun disc radiance multiplier (HDR, drives bloom). */
  sunDisc?: number;
}

export interface EarthMapSet { day: THREE.Texture; clouds: THREE.Texture }

/** Load only the NASA day and cloud maps (earth-textures-nasa-v1). `base` is the URL prefix of the repo root. */
export async function loadDayAndClouds(base = '/', anisotropy = 8): Promise<EarthMapSet> {
  const loader = new THREE.TextureLoader();
  const load = async (file: string, srgb: boolean) => {
    const t = await loader.loadAsync(base + 'assets/library/textures/earth/' + file);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = anisotropy;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  };
  const [day, clouds] = await Promise.all([load('day_8k.jpg', true), load('clouds_8k.jpg', false)]);
  return { day, clouds };
}

/** Columns east, up, south of the site frame in Earth-centred coordinates (x → 0°E on the equator, z → north pole). */
export function siteBasis(latDeg: number, lonDeg: number): THREE.Matrix3 {
  const f = THREE.MathUtils.degToRad(latDeg), l = THREE.MathUtils.degToRad(lonDeg);
  const up = new THREE.Vector3(Math.cos(f) * Math.cos(l), Math.cos(f) * Math.sin(l), Math.sin(f));
  const east = new THREE.Vector3(-Math.sin(l), Math.cos(l), 0);
  const south = new THREE.Vector3(Math.sin(f) * Math.cos(l), Math.sin(f) * Math.sin(l), -Math.cos(f));
  return new THREE.Matrix3().set(east.x, up.x, south.x, east.y, up.y, south.y, east.z, up.z, south.z);
}

export const ATMOSPHERE_GLSL = /* glsl */ `
uniform float uR, uAtmoTop, uSunPower, uDensity, uMS, uCloudAlt, uCloudOpacity, uCloudShift, uTime;
uniform vec3 uSunDir;
uniform mat3 uLocalToEcef;
uniform sampler2D tDay, tClouds;
uniform vec4 uWeather;      // x windward storm pile-up, y lee clearing, z lee desert tint, w cloud flow speed (km/s)
uniform vec4 uCloudSea;     // x procedural cloud-sea amount, y radius (km), z obstacle radius (km), w lightning 0..1
uniform float uDesertGround; // extra desert tint over the whole lee half-plane (0..1)
#ifndef PI
#define PI 3.14159265
#endif
const vec3 A_BR = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const vec3 A_BMS = vec3(3.996e-3);
const vec3 A_BME = vec3(4.44e-3);
const vec3 A_BO = vec3(0.65e-3, 1.881e-3, 0.085e-3)*0.6;

vec3 atmoDensity(float h){ h = max(h, 0.0); return vec3(exp(-h/8.0), exp(-h/1.2), max(0.0, 1.0 - abs(h - 25.0)/15.0)); }
vec3 atmoExt(vec3 od){ return (A_BR*od.x + A_BME*od.y + A_BO*od.z)*uDensity; }

/** First crossing (t > 0) of the altitude shell hc along a ray from planet-centred ro at altitude h0; -1 if none. */
float atmoShell(vec3 ro, vec3 rd, float h0, float hc){
  float b = dot(ro, rd), c = (h0 - hc)*(2.0*uR + h0 + hc), d = b*b - c;
  if (d < 0.0) return -1.0;
  d = sqrt(d);
  if (c > 0.0) { float t = -b - d; return t > 0.0 ? t : -1.0; }
  return -b + d;
}
/** Sunlight transmittance reaching planet-centred point p (0 inside the planet's shadow). */
vec3 atmoSunT(vec3 p){
  float h = length(p) - uR, b = dot(p, uSunDir);
  float cg = h*(2.0*uR + h), dg = b*b - cg;
  if (b < 0.0 && dg > 0.0) return vec3(0.0);
  float ct = (h - uAtmoTop)*(2.0*uR + h + uAtmoTop), dt = b*b - ct;
  float L = dt > 0.0 ? max(0.0, -b + sqrt(dt)) : 0.0;
  float ds = L/6.0; vec3 od = vec3(0.0);
  for (int j = 0; j < 6; j++){ vec3 q = p + uSunDir*(ds*(float(j) + 0.5)); od += atmoDensity(length(q) - uR)*ds; }
  return exp(-atmoExt(od));
}
/** [tA, tB] part of the ray inside the atmosphere, clipped to tMax (tB <= tA when the ray misses it). */
vec2 atmoSegment(vec3 ro, vec3 rd, float h0, float tMax){
  float b = dot(ro, rd), c = (h0 - uAtmoTop)*(2.0*uR + h0 + uAtmoTop), d = b*b - c;
  if (d < 0.0) return vec2(1.0, 0.0);
  d = sqrt(d);
  return vec2(max(-b - d, 0.0), min(-b + d, tMax));
}
#ifndef ATMO_STEPS
#define ATMO_STEPS 24
#endif
/** March in-scattered sunlight along [tA, tB], split at tS (S1 before, S2 after; T1 transmittance at the split). */
void atmoMarch(vec3 ro, vec3 rd, float tA, float tB, float tS, out vec3 S1, out vec3 S2, out vec3 T1, out vec3 T){
  S1 = vec3(0.0); S2 = vec3(0.0); T1 = vec3(1.0); T = vec3(1.0);
  if (tB <= tA) return;
  float mu = dot(rd, uSunDir);
  float pr = 3.0/(16.0*PI)*(1.0 + mu*mu);
  const float g = 0.8;
  float pm = 3.0/(8.0*PI)*((1.0 - g*g)*(1.0 + mu*mu))/((2.0 + g*g)*pow(max(1.0 + g*g - 2.0*g*mu, 1e-4), 1.5));
  float ds = (tB - tA)/float(ATMO_STEPS);
  vec3 od = vec3(0.0); bool split = tS > tA && tS < tB; bool passed = false;
  for (int i = 0; i < ATMO_STEPS; i++){
    float t = tA + ds*(float(i) + 0.5);
    if (split && !passed && t > tS){ passed = true; T1 = exp(-atmoExt(od)); }
    vec3 p = ro + rd*t;
    vec3 d = atmoDensity(length(p) - uR)*ds;
    vec3 w = exp(-atmoExt(od + d*0.5))*atmoSunT(p);
    vec3 s = w*(d.x*A_BR*pr + d.y*A_BMS*pm) + w*(d.x*A_BR + d.y*A_BMS)*(uMS/(4.0*PI));
    if (passed) S2 += s; else S1 += s;
    od += d;
  }
  T = exp(-atmoExt(od));
  if (!split || !passed) T1 = T;
  S1 *= uSunPower*uDensity; S2 *= uSunPower*uDensity;
}
vec2 atmoEarthUV(vec3 p){
  vec3 e = uLocalToEcef*normalize(p);
  return vec2(atan(e.y, e.x)/(2.0*PI) + 0.5, asin(clamp(e.z, -1.0, 1.0))/PI + 0.5);
}
/** Lee-side weight (downwind of an obstacle of radius a centred on the site, wind toward +x). */
float atmoLee(vec3 local, float a){
  return smoothstep(0.0, a*0.7, local.x)*(1.0 - smoothstep(a*1.0, a*2.2, abs(local.z)))*(1.0 - smoothstep(a*5.0, a*11.0, local.x));
}
float atmoCloud(vec3 p){
  vec3 local = p - vec3(0.0, uR, 0.0);
  vec2 uv = atmoEarthUV(p); uv.x += uCloudShift;
  float c = smoothstep(0.16, 0.86, texture2D(tClouds, uv).r);
  float r = length(local.xz), a = max(uCloudSea.z, 1.0);
  // Flow past the peak: clouds follow potential-flow streamlines around a cylinder of radius a.
  float psi = local.z*(1.0 - a*a/max(r*r, a*a*0.25));
  vec2 q = vec2(local.x - uWeather.w*uTime, psi)/38.0;
  float sea = smoothstep(0.42, 0.7, fbm(q + 3.1))*smoothstep(uCloudSea.y, uCloudSea.y*0.55, r);
  c = max(c, uCloudSea.x*sea);
  float storm = smoothstep(a*2.8, a*1.02, r)*smoothstep(a*0.25, -a*0.9, local.x)*smoothstep(0.30, 0.62, fbm(q*1.7 + 7.3));
  c = max(c, uWeather.x*storm);
  c *= 1.0 - uWeather.y*atmoLee(local, a);
  return clamp(c, 0.0, 1.0)*uCloudOpacity;
}
vec3 atmoAmbient(float h){ return uSunPower*(vec3(0.012, 0.02, 0.036)*exp(-h/10.0) + vec3(0.004, 0.005, 0.007)); }
vec3 atmoCloudShade(vec3 pc, float dens, bool below){
  vec3 n = normalize(pc); float ndl = dot(n, uSunDir);
  vec3 lit = vec3(0.94)*uSunPower*atmoSunT(pc + n*1.5)*(0.22 + 0.78*max(ndl, 0.0))/PI;
  vec3 c = lit*(below ? mix(0.85, 0.42, dens) : mix(1.0, 0.82, dens)) + atmoAmbient(uCloudAlt)*0.8;
  // Storm tops: darker, with occasional deterministic lightning flashes inside the windward cells.
  vec3 local = pc - vec3(0.0, uR, 0.0);
  if (uCloudSea.w > 0.0){
    float cell = floor(uTime*3.3), fl = step(0.82, fract(sin(cell*12.9898)*43758.5453));
    vec2 at = vec2(-1.5 + 0.9*fract(sin(cell*78.233)*9631.4), 0.9*(fract(sin(cell*39.425)*1234.5) - 0.5))*uCloudSea.z;
    float near = exp(-pow(length(local.xz - at)/(uCloudSea.z*0.35), 2.0));
    c += vec3(0.75, 0.8, 1.0)*uSunPower*0.25*fl*near*uCloudSea.w*(0.5 + 0.5*sin(uTime*60.0));
  }
  return c;
}
vec3 atmoGroundAlbedo(vec3 p){
  vec3 local = p - vec3(0.0, uR, 0.0);
  vec3 alb = texture2D(tDay, atmoEarthUV(p)).rgb;
  alb *= 0.86 + 0.28*fbm(local.xz/9.0 + 11.0);
  float a = max(uCloudSea.z, 1.0);
  float lee = max(uWeather.z*atmoLee(local, a), uDesertGround*smoothstep(0.0, a*0.8, local.x)*(1.0 - smoothstep(a*7.0, a*14.0, local.x)));
  vec3 desert = vec3(0.42, 0.30, 0.17)*(0.85 + 0.3*fbm(local.xz/14.0 + 2.0));
  return mix(alb, desert, clamp(lee, 0.0, 1.0)*step(0.035, dot(alb, vec3(0.33))));
}
vec3 atmoGround(vec3 p){
  vec3 n = normalize(p);
  return atmoGroundAlbedo(p)*(uSunPower*atmoSunT(p + n*0.05)*max(dot(n, uSunDir), 0.0)/PI + atmoAmbient(0.0));
}
`;

/** Shared uniform block for the sky and every material that includes ATMOSPHERE_GLSL. */
export function createAtmosphereUniforms(maps: EarthMapSet, o: PlanetSiteOptions = {}): Record<string, THREE.IUniform> {
  return {
    uR: { value: o.radius ?? 6371 }, uAtmoTop: { value: o.atmosphereTop ?? 100 }, uSunPower: { value: o.sunPower ?? 14 },
    uDensity: { value: 1 }, uMS: { value: o.multiScatter ?? 0.6 }, uCloudAlt: { value: o.cloudAltitude ?? 5 },
    uCloudOpacity: { value: o.cloudOpacity ?? 0.9 }, uCloudShift: { value: 0 }, uTime: { value: 0 },
    uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(0.1, 0.8, 0.6)).clone().normalize() },
    uLocalToEcef: { value: siteBasis(o.lat ?? 45.8, o.lon ?? 6.9) },
    tDay: { value: maps.day }, tClouds: { value: maps.clouds },
    uWeather: { value: new THREE.Vector4(0, 0, 0, 0) }, uCloudSea: { value: new THREE.Vector4(0, 600, 170, 0) },
    uDesertGround: { value: 0 },
  };
}

/**
 * Camera-centred sky + planet dome (uSkyGain scales its in-scattered skylight only, standing in for the multiple
 * scattering a single-scattering march misses). Call `setCamera(km)` (true camera position in site-local km) and `follow(camera)`
 * every frame; tune `uniforms` (sunPower, cloud opacity, weather) per shot.
 */
export class PlanetAtmosphere {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor(maps: EarthMapSet, o: PlanetSiteOptions = {}, shared?: Record<string, THREE.IUniform>) {
    this.uniforms = shared ?? createAtmosphereUniforms(maps, o);
    const u = { ...this.uniforms, uCamKm: this.uniforms.uCamKm ?? { value: new THREE.Vector3(0, 0.0017, 0) }, uCamAlt: this.uniforms.uCamAlt ?? { value: 0.0017 }, uSunDisc: { value: o.sunDisc ?? 900 }, uSkyGain: { value: 1 } };
    this.uniforms.uCamKm = u.uCamKm; this.uniforms.uCamAlt = u.uCamAlt; this.uniforms.uSunDisc = u.uSunDisc; this.uniforms.uSkyGain = u.uSkyGain;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: u,
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position, 0.0); gl_Position = projectionMatrix*vec4(p.xyz, 1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        ${ATMOSPHERE_GLSL}
        uniform vec3 uCamKm; uniform float uCamAlt, uSunDisc, uSkyGain;
        varying vec3 vDir;
        void main(){
          vec3 rd = normalize(vDir), ro = uCamKm + vec3(0.0, uR, 0.0);
          float h0 = uCamAlt, b = dot(ro, rd), cg = h0*(2.0*uR + h0), dg = b*b - cg;
          float tg = (dg > 0.0 && b < 0.0) ? -b - sqrt(dg) : -1.0;
          vec2 seg = atmoSegment(ro, rd, h0, tg > 0.0 ? tg : 1e9);
          vec3 surf = vec3(0.0);
          if (tg > 0.0) surf = atmoGround(ro + rd*tg);
          else {
            float sd = dot(rd, uSunDir);
            surf = vec3(1.0, 0.97, 0.92)*uSunDisc*smoothstep(0.999984, 0.999991, sd);
          }
          float tc = atmoShell(ro, rd, h0, uCloudAlt), a = 0.0; vec3 cc = vec3(0.0);
          if (tc > 0.0 && (tg < 0.0 || tc < tg)){ vec3 pc = ro + rd*tc; a = atmoCloud(pc); cc = atmoCloudShade(pc, a, h0 < uCloudAlt); }
          vec3 S1, S2, T1, T;
          atmoMarch(ro, rd, seg.x, seg.y, a > 0.002 ? tc : -1.0, S1, S2, T1, T);
          vec3 col = (S1 + (1.0 - a)*S2)*uSkyGain + T1*a*cc + (1.0 - a)*T*surf;
          gl_FragColor = vec4(max(col, 0.0), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -100;
  }
  /** True camera position in site-local km (altitude is taken above the curved surface). */
  setCamera(km: THREE.Vector3, R = this.uniforms.uR.value as number) {
    this.uniforms.uCamKm.value.copy(km);
    const dx = km.x, dz = km.z, dy = km.y + R;
    this.uniforms.uCamAlt.value = Math.sqrt(dx * dx + dy * dy + dz * dz) - R;
  }
  follow(camera: THREE.Camera) { this.mesh.position.copy(camera.position); }
  set time(t: number) { this.uniforms.uTime.value = t; }
  /** Bake the current sky into a PMREM environment map (sun disc dimmed) for PBR materials near the camera. */
  toEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
    const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene(), keep = this.uniforms.uSunDisc.value;
    sc.add(new THREE.Mesh(this.mesh.geometry, this.mesh.material)); this.uniforms.uSunDisc.value = keep * 0.02;
    const tex = pm.fromScene(sc, 0, 0.1, 100).texture; this.uniforms.uSunDisc.value = keep; pm.dispose(); return tex;
  }
}

/** Mean pressure (atm) of the 1976 US Standard Atmosphere at altitude h km (piecewise exponential fit, 0–100 km). */
export function standardPressureAtm(h: number): number {
  const layers: [number, number, number][] = [[0, 1, 7.335], [11, 0.2234, 6.341], [20, 0.05403, 6.516], [32, 0.008567, 7.289], [47, 0.001094, 7.929], [51, 0.0006606, 7.071], [71, 0.00003904, 6.355], [86, 0.000003685, 5.73]];
  let k = 0; while (k < layers.length - 1 && h >= layers[k + 1][0]) k++;
  const [h0, p0, H] = layers[k];
  return p0 * Math.exp(-(h - h0) / H);
}
