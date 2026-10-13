import * as THREE from 'three';
import { rng } from '../util/math';

export interface SolarWindOptions {
  count?: number; seed?: number;
  /** Planet radius in scene units (the stream is centred on the planet, flowing along +X). */
  radius?: number;
  /** Upstream length and downstream run-out, in planet radii. */
  upstream?: number; downstream?: number;
  /** Half-width of the stream cross-section in planet radii. */
  width?: number;
  /** Travel speed in planet radii per second (schematic). */
  speed?: number;
  /** Radius (planet radii) where particles meet the atmosphere when unshielded. */
  atmosphere?: number;
  /** Magnetopause stand-off distance in planet radii when shielded. */
  standoff?: number;
  color?: THREE.ColorRepresentation; plumeColor?: THREE.ColorRepresentation;
  /** Escaping-ion plume particle count. */
  plumeCount?: number;
}

const TRAIL = 4;

/**
 * Schematic solar-wind stream flowing along +X past a planet at the origin. shield = 1 bends it around a
 * magnetopause; shield = 0 lets it strike the upper atmosphere. `escape` grows a faint plume of ions leaving the
 * night side. Streaks are deterministic in time_s; rotate `group` so +X points away from the Sun.
 */
export class SolarWind {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial; private plumeMat: THREE.ShaderMaterial;

  constructor(o: SolarWindOptions = {}) {
    const R = o.radius ?? 1, n = o.count ?? 1600, r = rng(o.seed ?? 21), W = o.width ?? 2.4;
    const lane = new Float32Array(n * TRAIL * 4);
    for (let i = 0; i < n; i++) {
      const rho = W * Math.sqrt(r()), ang = r() * Math.PI * 2, ph = r(), sp = 0.8 + r() * 0.4;
      for (let k = 0; k < TRAIL; k++) lane.set([rho * Math.cos(ang), rho * Math.sin(ang), ph, sp + k * 10], (i * TRAIL + k) * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * TRAIL * 3), 3));
    g.setAttribute('aLane', new THREE.BufferAttribute(lane, 4));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uR: { value: R }, uUp: { value: o.upstream ?? 9 }, uDown: { value: o.downstream ?? 7 }, uSpeed: { value: o.speed ?? 2.2 },
        uAtm: { value: o.atmosphere ?? 1.06 }, uStand: { value: o.standoff ?? 2.6 }, uShield: { value: 0 }, uAmount: { value: 1 }, uColor: { value: new THREE.Color(o.color ?? 0xffd38a) },
      },
      vertexShader: /* glsl */ `attribute vec4 aLane; uniform float uTime, uR, uUp, uDown, uSpeed, uAtm, uStand, uShield, uAmount; varying float vA;
        void main(){
          float k = floor(aLane.w / 10.0), sp = aLane.w - k * 10.0, total = uUp + uDown;
          float s = fract(aLane.z + uTime * uSpeed * sp / total) * total - uUp - k * 0.07;   // x in planet radii, head first
          vec2 yz = aLane.xy; float rho = length(yz);
          // Unshielded: lanes that cross the atmosphere stop at it (with a brief bright hit).
          float xHit = rho < uAtm ? -sqrt(uAtm * uAtm - rho * rho) : 1e5;
          float hit = step(xHit, s);
          float flash = (1.0 - smoothstep(0.0, 0.35, s - xHit)) * hit;
          float aOpen = (1.0 - hit) + flash * 1.6;
          // Shielded: pushed outward onto a paraboloid magnetopause with its nose at -uStand.
          float D = sqrt(max(0.0, 2.0 * uStand * 1.4 * (s + uStand)));
          float rhoS = max(rho, D);
          vec2 dir = rho > 1e-4 ? yz / rho : vec2(1.0, 0.0);
          vec2 yzS = dir * rhoS;
          vec3 pOpen = vec3(min(s, xHit), yz);
          vec3 pShield = vec3(s, yzS);
          vec3 p = mix(pOpen, pShield, uShield) * uR;
          vA = uAmount * mix(aOpen, 1.0, uShield) * (1.0 - k / 4.0) * smoothstep(-uUp, -uUp + 1.5, s) * (1.0 - smoothstep(uDown - 2.0, uDown, s));
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(110.0 / -mv.z, 2.0, 9.0) * (1.0 - k * 0.15); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d) * vA * 0.8; if (a < 0.01) discard; gl_FragColor = vec4(uColor * a, a); }`,
    });
    const pts = new THREE.Points(g, this.mat); pts.frustumCulled = false; pts.renderOrder = 26;
    // Escaping ions: start on the night-side atmosphere and drift downstream, spreading.
    const m = o.plumeCount ?? 900, start = new Float32Array(m * 4);
    for (let i = 0; i < m; i++) { const a = r() * Math.PI * 2, c = 0.2 + r() * 0.8; start.set([Math.cos(a) * c, Math.sin(a) * c, r(), 0.5 + r() * 0.8], i * 4); }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m * 3), 3));
    pg.setAttribute('aStart', new THREE.BufferAttribute(start, 4));
    this.plumeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uR: { value: R }, uAtm: { value: o.atmosphere ?? 1.06 }, uEscape: { value: 0 }, uColor: { value: new THREE.Color(o.plumeColor ?? 0x7fb8ff) } },
      vertexShader: /* glsl */ `attribute vec4 aStart; uniform float uTime, uR, uAtm, uEscape; varying float vA;
        void main(){
          float age = fract(aStart.z + uTime * 0.12 * aStart.w);
          vec2 yz = aStart.xy * uAtm * (1.0 + age * 1.6);
          float x = sqrt(max(0.0, uAtm * uAtm - dot(aStart.xy, aStart.xy) * uAtm * uAtm)) * 0.6 + age * 7.0;
          vA = uEscape * smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.4, 1.0, age));
          vec4 mv = modelViewMatrix * vec4(vec3(x, yz) * uR, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(95.0 / -mv.z, 2.0, 8.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d) * vA * 0.7; if (a < 0.01) discard; gl_FragColor = vec4(uColor * a, a); }`,
    });
    const plume = new THREE.Points(pg, this.plumeMat); plume.frustumCulled = false; plume.renderOrder = 27;
    this.group.add(pts, plume);
  }

  /** 1 = deflected by a magnetosphere, 0 = striking the atmosphere. */
  set shield(v: number) { this.mat.uniforms.uShield.value = v; }
  /** 0..1 strength of the escaping-ion plume. */
  set escape(v: number) { this.plumeMat.uniforms.uEscape.value = v; }
  /** 0..1 overall visibility of the stream. */
  set amount(v: number) { this.mat.uniforms.uAmount.value = v; }
  update(time_s: number) { this.mat.uniforms.uTime.value = time_s; this.plumeMat.uniforms.uTime.value = time_s; }
}
