import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

/**
 * black-hole-sky-v1 — a Schwarzschild black hole rendered as the scene's sky: every pixel's camera ray is bent by
 * integrating the photon-orbit equation (a = −1.5·h²·r̂/r⁴ in units of the Schwarzschild radius), so the star field
 * behind is gravitationally lensed into an Einstein ring, rays inside the photon sphere fall into a true black shadow
 * (≈2.6 r_s across), and the thin accretion disk appears both in front and — bent over the top and under the bottom
 * — behind the hole, as in Interstellar-style renders. The disk follows a Novikov–Thorne-like temperature profile with
 * Keplerian rotation (inner rings orbit fastest), relativistic Doppler beaming (the approaching side is brighter and
 * bluer) and gravitational redshift. HDR output feeds the pipeline's bloom. Follows the camera like a sky dome; other
 * objects (ships, planets) render in front unlensed. Deterministic in `update(time_s)`.
 */
export interface BlackHoleOptions {
  /** World position and Schwarzschild radius (world units). */
  position?: THREE.Vector3; rs?: number;
  /** Disk inner/outer radius in r_s (ISCO = 3) and unit normal (tilt). */
  diskInner?: number; diskOuter?: number; diskNormal?: THREE.Vector3;
  /** Disk brightness, peak temperature (K, sets colour) and rotation speed multiplier (1 = Keplerian at visual pace). */
  diskBrightness?: number; diskTemperature?: number; spin?: number;
  /** 0..1 Doppler beaming strength (1 = physical D⁴); star density/brightness; nebula strength. */
  beaming?: number; stars?: number; nebula?: number; seed?: number;
  /** Ray-march steps (quality). */
  steps?: number;
}

const VS = /* glsl */ `varying vec3 vDir; void main(){ vDir = (modelMatrix * vec4(position, 0.0)).xyz; vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + vDir, 1.0); gl_Position = p.xyww; }`;
const FS = (steps: number) => /* glsl */ `
  uniform vec3 uHole, uN; uniform float uRs, uIn, uOut, uBright, uTemp, uTime, uSpin, uBeam, uStars, uNebula, uSeed;
  varying vec3 vDir;
  ${GLSL_NOISE}
  // Approximate blackbody colour (normalised) for 1000–40000 K.
  vec3 blackbody(float t){
    t = clamp(t, 1000.0, 40000.0) / 100.0; vec3 c;
    c.r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
    c.g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0) : clamp(1.129891 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
    c.b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
    return c;
  }
  vec3 background(vec3 d){
    // Star field: jittered points on a direction grid at three scales, plus a faint galactic band and nebula.
    vec3 col = vec3(0.0);
    for (int k = 0; k < 3; k++) {
      float sc = 90.0 * pow(2.2, float(k));
      vec3 g = d * sc, i = floor(g), f = fract(g) - 0.5;
      float h = hash31(i + uSeed + float(k) * 17.0);
      if (h > 1.0 - 0.06 * uStars) {
        vec3 o = vec3(hash31(i + 3.1), hash31(i + 7.7), hash31(i + 11.3)) - 0.5;
        float r = length(f - o * 0.7), b = pow(hash31(i + 5.0), 6.0) * 6.0 + 0.3;
        vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.72, 0.84, 1.0), hash31(i + 9.0));
        col += tint * b * exp(-r * r * 900.0) * (1.0 - float(k) * 0.25);
      }
    }
    vec3 gp = normalize(vec3(0.35, 1.0, 0.18));
    float band = exp(-pow(dot(d, gp) / 0.16, 2.0));
    float neb = fbm3(d * 3.0 + uSeed) * 0.7 + fbm3(d * 9.0 - uSeed) * 0.3;
    col += (vec3(0.55, 0.42, 0.62) * band * (0.4 + neb) * 0.06 + vec3(0.12, 0.2, 0.42) * pow(neb, 3.0) * 0.08) * uNebula;
    return col;
  }
  void main(){
    vec3 dir = normalize(vDir);
    vec3 p = (cameraPosition - uHole) / uRs, v = dir;
    const float RMAX = 60.0;
    vec3 col = vec3(0.0); float alpha = 0.0;
    // Fast path: rays that never come near the hole see the plain sky.
    float b = dot(p, v), c = dot(p, p) - RMAX * RMAX, disc = b * b - c;
    if (c > 0.0 && (disc < 0.0 || b > 0.0)) { gl_FragColor = vec4(background(dir), 1.0); return; }
    if (c > 0.0) p += v * (-b - sqrt(disc));   // advance to the influence sphere
    vec3 hv = cross(p, v); float h2 = dot(hv, hv);
    bool absorbed = false;
    for (int i = 0; i < ${steps}; i++) {
      float r = length(p);
      if (r < 1.0) { absorbed = true; break; }
      if (r > RMAX && dot(p, v) > 0.0) break;
      float dt = clamp(0.06 * r, 0.015, 1.5);
      // Velocity Verlet on the photon geodesic (Schwarzschild, impact-parameter form).
      vec3 a = -1.5 * h2 * p / pow(r, 5.0);
      vec3 pn = p + v * dt + 0.5 * a * dt * dt;
      vec3 an = -1.5 * h2 * pn / pow(length(pn), 5.0);
      vec3 vn = normalize(v + 0.5 * (a + an) * dt);
      // Disk crossing between p and pn.
      float s0 = dot(p, uN), s1 = dot(pn, uN);
      if (s0 * s1 < 0.0 && alpha < 0.995) {
        vec3 q = mix(p, pn, s0 / (s0 - s1)); float rq = length(q);
        if (rq > uIn && rq < uOut) {
          // Keplerian flow: angular speed ∝ r^-1.5; turbulence advected in polar coordinates.
          vec3 e1 = normalize(cross(uN, abs(uN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), e2 = cross(uN, e1);
          float ang = atan(dot(q, e2), dot(q, e1)), om = uSpin * 2.2 * pow(rq, -1.5);
          float ph = ang - om * uTime * 6.0;
          // Noise on a circle in angle (cos/sin embedding) so the pattern has no seam where atan wraps.
          vec2 cs = vec2(cos(ph), sin(ph));
          float turb = fbm3(vec3(rq * 1.6, cs * 2.6)) * 0.65 + fbm3(vec3(rq * 5.0 + 3.0, cs * 7.5)) * 0.35;
          float ring = 0.65 + 0.35 * sin(rq * 7.0 + turb * 6.0);
          float x = uIn / rq, prof = pow(max(1.0 - sqrt(x), 0.0), 0.25) * pow(x, 0.75) * 2.6;
          float edge = smoothstep(uIn, uIn * 1.08, rq) * (1.0 - smoothstep(uOut * 0.7, uOut, rq));
          // Doppler: orbital velocity β = sqrt(1 / (2r)); light toward the camera travels along −v.
          vec3 tang = normalize(cross(uN, q)); float beta = sqrt(0.5 / rq), gam = 1.0 / sqrt(1.0 - beta * beta);
          float D = 1.0 / (gam * (1.0 - beta * dot(tang, -v))), grav = sqrt(max(1.0 - 1.0 / rq, 0.0));
          float shift = D * grav, T = uTemp * prof * shift;
          float I = uBright * prof * edge * (0.45 + 0.75 * turb * ring) * mix(1.0, pow(shift, 4.0), uBeam);
          vec3 dcol = blackbody(T) * I;
          float da = clamp(edge * (0.55 + 0.45 * turb) * 1.4, 0.0, 1.0);
          col += (1.0 - alpha) * dcol * da; alpha += (1.0 - alpha) * da;
        }
      }
      p = pn; v = vn;
    }
    if (!absorbed) col += (1.0 - alpha) * background(normalize(v));
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;

export class BlackHole {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor(o: BlackHoleOptions = {}) {
    this.uniforms = {
      uHole: { value: (o.position ?? new THREE.Vector3()).clone() }, uRs: { value: o.rs ?? 1 },
      uIn: { value: o.diskInner ?? 3 }, uOut: { value: o.diskOuter ?? 14 }, uN: { value: (o.diskNormal ?? new THREE.Vector3(0, 1, 0.12)).clone().normalize() },
      uBright: { value: o.diskBrightness ?? 0.55 }, uTemp: { value: o.diskTemperature ?? 4600 }, uTime: { value: 0 }, uSpin: { value: o.spin ?? 1 },
      uBeam: { value: o.beaming ?? 0.7 }, uStars: { value: o.stars ?? 1 }, uNebula: { value: o.nebula ?? 1 }, uSeed: { value: o.seed ?? 3.7 },
    };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS(o.steps ?? 260), uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -100;
  }
  addTo(scene: THREE.Scene) { scene.add(this.mesh); return this; }
  /** Kept for API symmetry with other skies; the shader reads the camera position directly. */
  follow(_camera: THREE.Camera) {}
  update(time_s: number) { this.uniforms.uTime.value = time_s; }
  set position(v: THREE.Vector3) { (this.uniforms.uHole.value as THREE.Vector3).copy(v); }
  set rs(v: number) { this.uniforms.uRs.value = v; }
  set diskBrightness(v: number) { this.uniforms.uBright.value = v; }
  set diskNormal(v: THREE.Vector3) { (this.uniforms.uN.value as THREE.Vector3).copy(v).normalize(); }
}
