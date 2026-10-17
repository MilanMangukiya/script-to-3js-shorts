import * as THREE from 'three';
import { Starfield } from '../space/Starfield';
import { GLSL_GALAXY, galaxyUniforms } from '../space/MilkyWay';

/**
 * Physically based sky dome: Preetham/Rayleigh–Mie scattering (after three.js examples/objects/Sky, MIT) re-expressed
 * as linear HDR for the film pipeline, a true-size sun disc with limb darkening and horizon extinction, an extended
 * twilight glow, a night gradient with stars, and a drifting 2.5D cloud layer lit by the sun (silver linings by day,
 * orange undersides at sunset). Follows the camera; deterministic setters only (`setSun`, `update(time_s)`).
 * `horizonColor()/zenithColor()` give matching colours for fog, water and window reflections.
 */
export interface PhysicalSkyOptions {
  turbidity?: number; rayleigh?: number; mieCoefficient?: number; mieDirectionalG?: number;
  /** Golden hour: saturation boost (0 = none) and exposure factor while the Sun is within ~15° of the horizon. */
  goldenSaturation?: number; goldenExposure?: number;
  /** Overall sky brightness (linear multiplier) and sun disc intensity / angular radius (rad). */
  exposure?: number; sunIntensity?: number; sunSize?: number;
  /** Clouds: 0 = clear … 1 = overcast; scale (m per noise unit at the cloud plane); wind (m/s on the plane). */
  cloudCover?: number; cloudScale?: number; cloudWind?: [number, number]; cloudColor?: THREE.ColorRepresentation;
  /** Milky Way brightness at night (0 = off, the default) and its aim (see milky-way-sky-v1). */
  galaxy?: number; galaxyCenter?: THREE.Vector3; galaxyAlong?: THREE.Vector3;
  /** Stars (count; 0 = none) and seed; night zenith/horizon colours. */
  stars?: number; seed?: number; nightZenith?: THREE.ColorRepresentation; nightHorizon?: THREE.ColorRepresentation;
}

const VS = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix*vec4(position, 0.0); gl_Position = projectionMatrix*vec4(p.xyz, 1.0); gl_Position.z = gl_Position.w; }`;
const FS = /* glsl */ `
  uniform vec3 uSun; uniform float uTurb, uRay, uMie, uMieG, uExposure, uSunI, uSunSize, uCover, uScale, uTime; uniform vec2 uWind;
  uniform vec3 uCloud, uNightZ, uNightH; uniform float uGoldSat, uGoldEx, uGalaxy, uGalPx; varying vec3 vDir;
  ${GLSL_GALAXY}
  const float PI = 3.141592653589793;
  const vec3 lambda = vec3(680E-9, 550E-9, 450E-9), totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
  const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
  float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a*n2(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + 3.1; a *= 0.5; } return s; }
  vec3 scatter(vec3 d, vec3 sun, out vec3 Fex){
    float sunE = 1000.0 * max(0.0, 1.0 - exp(-((1.6110731556870734 - acos(clamp(sun.y, -1.0, 1.0))) / 1.5)));
    float sunfade = 1.0 - clamp(1.0 - exp(sun.y / 0.45), 0.0, 1.0);
    vec3 betaR = totalRayleigh * (uRay - (1.0 - sunfade));
    float c = (0.2 * uTurb) * 10E-18; vec3 betaM = 0.434 * c * MieConst * uMie;
    float zen = acos(max(0.0, d.y)), inv = 1.0 / (cos(zen) + 0.15 * pow(93.885 - (zen * 180.0) / PI, -1.253));
    Fex = exp(-(betaR * 8.4E3 * inv + betaM * 1.25E3 * inv));
    float ct = dot(d, sun), rP = 0.05968310365946075 * (1.0 + pow(ct * 0.5 + 0.5, 2.0));
    float g2 = uMieG * uMieG, mP = 0.07957747154594767 * ((1.0 - g2) / pow(1.0 - 2.0 * uMieG * ct + g2, 1.5));
    vec3 Lin = pow(sunE * ((betaR * rP + betaM * mP) / (betaR + betaM)) * (1.0 - Fex), vec3(1.5));
    Lin *= mix(vec3(1.0), pow(sunE * ((betaR * rP + betaM * mP) / (betaR + betaM)) * Fex, vec3(0.5)), clamp(pow(1.0 - sun.y, 5.0), 0.0, 1.0));
    vec3 col = (Lin + 0.1 * Fex) * 0.04 + vec3(0.0, 0.0003, 0.00075);
    return pow(col, vec3(1.0 / (1.2 + 1.2 * sunfade)));
  }
  void main(){
    vec3 d = normalize(vDir), sun = normalize(uSun);
    float gold = (1.0 - smoothstep(0.03, 0.28, sun.y)) * smoothstep(-0.1, 0.0, sun.y);
    float ex = uExposure * mix(1.0, 0.42, smoothstep(0.05, 0.75, sun.y)) * mix(1.0, uGoldEx, gold);   // camera-like adaptation
    vec3 Fex, sky = scatter(vec3(d.x, max(d.y, 0.0) * 0.9 + 0.1 * abs(d.y), d.z), sun, Fex) * ex;
    sky = max(mix(vec3(dot(sky, vec3(0.2126, 0.7152, 0.0722))), sky, 1.0 + uGoldSat * gold), 0.0);   // richer dawn and dusk colour
    // Extended twilight: a warm band toward the sun and a deepening blue, fading into the night gradient.
    float alt = sun.y, tw = smoothstep(-0.32, -0.02, alt) * (1.0 - smoothstep(0.02, 0.12, alt));
    float toward = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sun.x, 0.0, sun.z))), 0.0), 3.0);
    vec3 night = mix(uNightH, uNightZ, pow(clamp(d.y, 0.0, 1.0), 0.45));
    vec3 twi = mix(vec3(0.9, 0.42, 0.22), vec3(0.32, 0.22, 0.42), clamp(d.y * 2.5, 0.0, 1.0)) * toward * exp(-max(d.y, 0.0) * 6.0) * 0.55;
    float nightK = smoothstep(0.02, -0.25, alt);
    vec3 col = sky * (1.0 - nightK * 0.96) + night * nightK + twi * tw;
    if (uGalaxy > 0.0 && d.y > 0.0) col += galaxy(d, uGalPx) * uGalaxy * smoothstep(-0.08, -0.26, alt) * exp(-0.12 / (d.y + 0.02));   // Milky Way after astronomical twilight, dimmed by extinction near the horizon
    // Sun disc: true size, limb darkening, extinction toward the horizon.
    float ang = acos(clamp(dot(d, sun), -1.0, 1.0));
    float disc = smoothstep(uSunSize * 1.08, uSunSize * 0.92, ang), limb = 0.6 + 0.4 * sqrt(max(0.0, 1.0 - pow(ang / uSunSize, 2.0)));
    col += disc * limb * uSunI * Fex * step(-0.01, d.y) * smoothstep(-0.12, 0.0, alt);
    // Clouds on a plane 2 km up (2.5D), self-shadowed toward the sun.
    if (d.y > 0.0 && uCover > 0.001) {
      vec2 uv = d.xz / (d.y + 0.08) * 2000.0 / uScale + uWind * uTime / uScale;
      float base = fbm(uv * 0.5) * 0.65 + fbm(uv * 1.7 + 4.0) * 0.35;
      float th = mix(0.78, 0.32, uCover), den = smoothstep(th, th + 0.22, base);
      if (den > 0.002) {
        vec2 sd = normalize(sun.xz + 1e-4) * 0.35;
        float occl = smoothstep(th, th + 0.3, fbm((uv + sd) * 0.5) * 0.65 + fbm((uv + sd) * 1.7 + 4.0) * 0.35);
        vec3 sunC = scatter(sun * vec3(1.0, 0.0, 1.0) + vec3(0.0, max(sun.y, 0.02), 0.0), sun, Fex) * ex;   // sunlight colour after the air
        vec3 lit = mix(uCloud * (0.35 + 1.6 * max(sun.y + 0.1, 0.0)) + sunC * 1.4, vec3(0.32, 0.34, 0.4) * (0.08 + 0.9 * max(sun.y, 0.0)), occl * 0.75);
        lit = mix(lit, night * 1.2 + vec3(0.02), nightK * 0.92);
        float horizonFade = smoothstep(0.0, 0.18, d.y);
        col = mix(col, lit, den * horizonFade * 0.95);
      }
    }
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;

export class PhysicalSky {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  readonly stars?: Starfield;
  private sun = new THREE.Vector3(0, 1, 0);

  constructor(o: PhysicalSkyOptions = {}) {
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uTurb: { value: o.turbidity ?? 2.5 }, uRay: { value: o.rayleigh ?? 1.6 }, uMie: { value: o.mieCoefficient ?? 0.005 },
      uMieG: { value: o.mieDirectionalG ?? 0.8 }, uGoldSat: { value: o.goldenSaturation ?? 0.5 }, uGoldEx: { value: o.goldenExposure ?? 0.8 }, uExposure: { value: o.exposure ?? 0.55 }, uSunI: { value: o.sunIntensity ?? 40 }, uSunSize: { value: o.sunSize ?? 0.00465 },
      uCover: { value: o.cloudCover ?? 0.35 }, uScale: { value: o.cloudScale ?? 900 }, uWind: { value: new THREE.Vector2(...(o.cloudWind ?? [6, 2])) }, uTime: { value: 0 },
      ...galaxyUniforms({ center: o.galaxyCenter, along: o.galaxyAlong }), uGalaxy: { value: o.galaxy ?? 0 }, uGalPx: { value: 0.0006 },
      uCloud: { value: new THREE.Color(o.cloudColor ?? 0xe9edf2) }, uNightZ: { value: new THREE.Color(o.nightZenith ?? 0x020511) }, uNightH: { value: new THREE.Color(o.nightHorizon ?? 0x0b1226) },
    };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -100;
    if ((o.stars ?? 2500) > 0) { this.stars = new Starfield({ seed: o.seed ?? 77, count: o.stars ?? 2500, radius: 900, brightness: 0, minY: -0.2 }); }
  }
  /** Unit vector toward the sun (world). */
  setSun(dir: THREE.Vector3) { this.sun.copy(dir).normalize(); (this.uniforms.uSun.value as THREE.Vector3).copy(this.sun); if (this.stars) this.stars.brightness = 0.9 * THREE.MathUtils.smoothstep(-this.sun.y, 0.06, 0.2); }
  set cloudCover(v: number) { this.uniforms.uCover.value = v; }
  /** Add the dome (and stars) to a scene. */
  addTo(scene: THREE.Scene) { scene.add(this.mesh); if (this.stars) scene.add(this.stars.points); return this; }
  follow(camera: THREE.Camera) {
    this.mesh.position.copy(camera.position); this.stars?.follow(camera);
    if (camera instanceof THREE.PerspectiveCamera) this.uniforms.uGalPx.value = THREE.MathUtils.degToRad(camera.fov) / 1920 * 0.9;   // keep Milky Way stars pixel-sharp
  }
  update(time_s: number) { this.uniforms.uTime.value = time_s; }
  /** Approximate linear sky colour near the horizon facing the sun (for fog/water), and at the zenith. */
  horizonColor(out = new THREE.Color()) { const a = this.sun.y, day = THREE.MathUtils.smoothstep(a, -0.08, 0.25), warm = 1 - THREE.MathUtils.smoothstep(a, 0.02, 0.3);
    return out.setRGB(0.62, 0.72, 0.84).lerp(new THREE.Color(0.95, 0.58, 0.36), warm * day).multiplyScalar(0.05 + 0.95 * day).lerp(new THREE.Color(this.uniforms.uNightH.value), 1 - day); }
  zenithColor(out = new THREE.Color()) { const day = THREE.MathUtils.smoothstep(this.sun.y, -0.08, 0.25); return out.setRGB(0.2, 0.38, 0.72).multiplyScalar(0.05 + 0.95 * day).lerp(new THREE.Color(this.uniforms.uNightZ.value), 1 - day); }
  /** Prefiltered environment for PBR reflections at the current sun (re-bake when the sun moves noticeably). */
  bakeEnvironment(renderer: THREE.WebGLRenderer) {
    const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene(), m = new THREE.Mesh(this.mesh.geometry, this.mesh.material);
    sc.add(m); const keep = this.uniforms.uSunI.value; this.uniforms.uSunI.value = keep * 0.02;
    const tex = pm.fromScene(sc, 0, 0.1, 100).texture; this.uniforms.uSunI.value = keep; pm.dispose(); return tex;
  }
}
