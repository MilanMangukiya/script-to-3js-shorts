import * as THREE from 'three';

/**
 * milky-way-sky-v1 — a deep, dense night/space sky in HDR: five layers of crisp hashed stars (tinted by temperature,
 * far more numerous inside the galactic band), the Milky Way itself (a bright central bulge, a long luminous band,
 * dark dust lanes, pink H-alpha and blue reflection nebulae) and faint zodiacal glow. `GLSL_GALAXY` exposes the same
 * `galaxy(dir, pixelAngle)` function to other sky shaders (self-contained noise; PhysicalSky uses it at night). `MilkyWaySky` is a camera-following dome
 * for space shots or, with `ground: true`, for a terrestrial night sky with horizon extinction, airglow and an
 * optional light-pollution dome. Deterministic; `update(t)` only drives a subtle twinkle near the horizon.
 */
export const GLSL_GALAXY = /* glsl */ `
  uniform mat3 uGalRot; uniform float uGalStars, uGalBand, uGalSeed;
  float gHash(vec3 p){ p = fract(p * 0.1031 + uGalSeed * 0.013); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float gV3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  float gFbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * gV3(p); p = p * 2.03 + vec3(17.1, 9.2, 5.3); a *= 0.5; } return s; }
  vec3 gStars(vec3 d, float bandK, float px){
    vec3 col = vec3(0.0);
    for (int k = 0; k < 5; k++) {
      float fk = float(k), sc = 70.0 * pow(1.9, fk);
      vec3 g = d * sc, i = floor(g), f = fract(g) - 0.5;
      float dens = (0.035 + 0.006 * fk) * pow(0.55, fk) * uGalStars * (1.0 + bandK * (1.2 + 1.5 * fk));   // fewer faint stars: a dark sky between crisp points
      float h = gHash(i + fk * 17.0);
      if (h < dens) {
        vec3 o = vec3(gHash(i + 3.1), gHash(i + 7.7), gHash(i + 11.3)) - 0.5;
        float r = length(f - o * 0.75) / sc, b = (pow(gHash(i + 5.0), 7.0) * 9.0 + 0.25) * pow(0.62, fk);   // magnitude-like spread: rare bright, many dim
        float t = gHash(i + 9.0); vec3 tint = t < 0.15 ? vec3(0.7, 0.8, 1.0) : t < 0.6 ? vec3(1.0, 0.97, 0.92) : t < 0.85 ? vec3(1.0, 0.85, 0.65) : vec3(1.0, 0.68, 0.5);
        float w = max(px, 0.00025);
        col += tint * b * exp(-r * r / (w * w)) ;
      }
    }
    return col;
  }
  vec3 galaxy(vec3 dir, float px){
    vec3 d = normalize(uGalRot * dir);
    float lat = asin(clamp(d.y, -1.0, 1.0)), lon = atan(d.z, d.x);   // galactic latitude/longitude (centre at lon 0)
    float c = cos(lon), toward = 0.5 + 0.5 * c;
    float width = 0.13 + 0.12 * pow(toward, 3.0);
    float band = exp(-pow(lat / width, 2.0)) * (0.35 + 0.65 * pow(toward, 1.5));
    float bulge = exp(-(pow(lat / 0.16, 2.0) + pow(lon / 0.35, 2.0))) * 1.6;
    float n1 = gFbm(d * 4.0 + uGalSeed), n2 = gFbm(d * 11.0 - uGalSeed * 2.0), n3 = gFbm(d * 26.0 + 3.0);
    float glow = (band * (0.55 + 0.7 * n1) + bulge) * (0.7 + 0.5 * n2);
    // Dust lanes: dark filaments hugging the plane, strongest toward the centre.
    float dust = smoothstep(0.42, 0.72, gFbm(d * vec3(7.0, 22.0, 7.0) + 1.7) * 0.7 + n3 * 0.3) * exp(-pow(lat / (width * 0.45), 2.0));
    glow *= 1.0 - 0.85 * dust;
    vec3 col = glow * mix(vec3(0.62, 0.66, 0.85), vec3(1.0, 0.86, 0.68), smoothstep(0.2, 1.4, bulge + band * toward)) * 0.11 * uGalBand;
    // Emission (H-alpha pink) and reflection (blue) nebulae scattered along the band.
    float em = smoothstep(0.62, 0.85, gFbm(d * 9.0 + 7.3)) * band, rf = smoothstep(0.66, 0.9, gFbm(d * 13.0 - 4.1)) * band * 0.7;
    col += (vec3(0.95, 0.25, 0.45) * em * 0.09 + vec3(0.25, 0.45, 1.0) * rf * 0.07) * uGalBand * (1.0 - 0.6 * dust);
    col += gStars(dir, band + bulge * 0.5, px);
    return col;
  }`;

export interface MilkyWayOptions {
  /** Star density and Milky Way brightness multipliers; galaxy orientation (Euler, radians); seed. */
  stars?: number; band?: number; rotation?: THREE.Euler; seed?: number;
  /** Aim the galaxy instead of `rotation`: world direction of the galactic centre and a direction along the band. */
  center?: THREE.Vector3; along?: THREE.Vector3;
  /** Terrestrial sky: fade toward the horizon with extinction, airglow and a warm light-pollution dome. */
  ground?: boolean; lightPollution?: number; pollutionColor?: THREE.ColorRepresentation;
}
const VS = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0); gl_Position = p.xyww; }`;
const FS = /* glsl */ `
  uniform float uGround, uPollution, uTime, uPx; uniform vec3 uPollColor; varying vec3 vDir;
  ${GLSL_GALAXY}
  void main(){
    vec3 d = normalize(vDir);
    vec3 col = galaxy(d, uPx);
    if (uGround > 0.5) {
      float alt = d.y;
      if (alt < 0.0) { gl_FragColor = vec4(vec3(0.004, 0.005, 0.008), 1.0); return; }
      float ext = exp(-0.12 / max(alt + 0.02, 0.02));                         // atmospheric extinction near the horizon
      col *= ext * (0.92 + 0.08 * sin(uTime * 3.0 + d.x * 400.0) * (1.0 - smoothstep(0.0, 0.3, alt)));   // low-altitude twinkle
      col += vec3(0.05, 0.09, 0.06) * exp(-alt * 7.0) * 0.05;                   // green airglow band
      col += uPollColor * uPollution * exp(-alt * 5.0) * 0.12;                  // town glow
      col += vec3(0.006, 0.009, 0.02) * (1.0 - alt);
    }
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;
export class MilkyWaySky {
  readonly mesh: THREE.Mesh; readonly uniforms: Record<string, THREE.IUniform>;
  constructor(o: MilkyWayOptions = {}) {
    this.uniforms = { ...galaxyUniforms(o), uGround: { value: o.ground ? 1 : 0 }, uPollution: { value: o.lightPollution ?? 0.3 }, uPollColor: { value: new THREE.Color(o.pollutionColor ?? 0xff9a5a) }, uTime: { value: 0 }, uPx: { value: 0.0009 } };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -100;
  }
  addTo(scene: THREE.Scene) { scene.add(this.mesh); return this; }
  /** `pixelAngle` = camera vertical FOV (rad) / output height in pixels keeps stars one pixel sharp at any FOV. */
  update(t: number, camera?: THREE.PerspectiveCamera, outputHeight = 1920) {
    this.uniforms.uTime.value = t;
    if (camera) this.uniforms.uPx.value = THREE.MathUtils.degToRad(camera.fov) / outputHeight * 0.9;
  }
}
/** World→galactic rotation that puts the galactic centre along `center` and the band plane through `along`. */
export function galaxyBasis(center: THREE.Vector3, along: THREE.Vector3) {
  const x = center.clone().normalize(), z = along.clone().addScaledVector(x, -along.dot(x)).normalize(), y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Matrix3().set(x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z);   // rows = galactic axes in world space
}
/** Uniforms for any shader that includes GLSL_GALAXY. */
export function galaxyUniforms(o: { stars?: number; band?: number; rotation?: THREE.Euler; seed?: number; center?: THREE.Vector3; along?: THREE.Vector3 } = {}) {
  const m = o.center ? galaxyBasis(o.center, o.along ?? new THREE.Vector3(0.6, 0.8, 0)) : new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(o.rotation ?? new THREE.Euler(0.45, 0.3, 1.05)));
  return { uGalRot: { value: m }, uGalStars: { value: o.stars ?? 1 }, uGalBand: { value: o.band ?? 1 }, uGalSeed: { value: o.seed ?? 4.2 } };
}
