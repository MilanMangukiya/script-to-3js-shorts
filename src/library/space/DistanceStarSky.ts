import * as THREE from 'three';
import { rng } from '../util/math';

/** A named star: unit direction on the sky, distance in light-years, visual magnitude and an RGB tint. */
export interface SkyStar { name: string; dir: THREE.Vector3; distanceLy: number; mag: number; tint: [number, number, number] }

export interface DistanceStarSkyOptions {
  seed?: number;
  /** Background stars (besides the named ones). */
  count?: number;
  /** Shell radius in scene units (keep inside the camera far plane). */
  radius?: number;
  /** Named stars drawn at their own directions and distances. */
  named?: SkyStar[];
  /** Background distances run from nearLy to farLy, with the count within d growing like d^slope. */
  nearLy?: number; farLy?: number; slope?: number;
  /** Only place background stars with direction.y above this value. */
  minY?: number;
  /** Largest star sprite diameter in pixels at 1080-wide output. */
  maxSize?: number;
}

/**
 * A night sky whose stars come back one by one as their light arrives: each star stays dark until `setYears(y)`
 * reaches its distance in light-years, then fades in over a short span (so a time-lapse shows the nearest first).
 * Background stars get seeded directions, magnitudes and distances; named stars use the values given. A faint
 * Milky Way band returns over thousands of years. Call follow(camera) each frame.
 */
export class DistanceStarSky {
  readonly group = new THREE.Group();
  readonly named: SkyStar[];
  private mat: THREE.ShaderMaterial; private band: THREE.Mesh; private bandMat: THREE.ShaderMaterial;
  private R: number;

  constructor(o: DistanceStarSkyOptions = {}) {
    const r = rng(o.seed ?? 17), n = o.count ?? 3000, R = (this.R = o.radius ?? 900), minY = o.minY ?? -0.1;
    const near = o.nearLy ?? 10, far = o.farLy ?? 3000, k = o.slope ?? 1.6;
    this.named = o.named ?? [];
    const total = n + this.named.length, pos = new Float32Array(total * 3), col = new Float32Array(total * 3), size = new Float32Array(total), dist = new Float32Array(total);
    const tints: [number, number, number][] = [[0.75, 0.82, 1.0], [0.9, 0.94, 1.0], [1, 1, 1], [1.0, 0.95, 0.84], [1.0, 0.84, 0.66]];
    const put = (i: number, d: THREE.Vector3, ly: number, mag: number, tint: [number, number, number]) => {
      d.clone().normalize().multiplyScalar(R).toArray(pos, i * 3);
      const b = Math.pow(10, -0.4 * (mag - 1.0));          // relative flux, magnitude 1 = 1
      const lum = Math.min(3.2, 0.18 + 0.9 * Math.sqrt(b));
      col.set([tint[0] * lum, tint[1] * lum, tint[2] * lum], i * 3);
      size[i] = Math.min(1, 0.32 + 0.3 * Math.sqrt(b)); dist[i] = ly;
    };
    for (let i = 0; i < n; i++) {
      let d: THREE.Vector3;
      do { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); d = new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a)); } while (d.y < minY);
      const ly = near * Math.pow(1 + r() * (Math.pow(far / near, k) - 1), 1 / k);   // inverse CDF of N(<d) ∝ d^k
      const mag = 6.2 - 5.2 * Math.pow(r(), 3.5);                                   // most stars faint
      put(i, d, ly, mag, tints[Math.floor(r() * tints.length)]);
    }
    this.named.forEach((s, j) => { put(n + j, s.dir, s.distanceLy, s.mag, s.tint); size[n + j] = Math.min(1.6, size[n + j] * 1.6); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uYears: { value: 0 }, uPx: { value: 1 }, uMax: { value: o.maxSize ?? 7 }, uGain: { value: 1 } },
      vertexShader: /* glsl */ `attribute vec3 color; attribute float aSize; attribute float aDist; uniform float uYears, uPx, uMax; varying vec3 vC; varying float vA;
        void main(){ vC = color; float on = smoothstep(aDist, aDist * 1.03 + 0.08, uYears); vA = on * (1.0 + 1.5 * (1.0 - smoothstep(0.0, aDist * 0.08 + 0.3, uYears - aDist)) * on);
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, aSize * uMax * uPx) * (on > 0.001 ? 1.0 : 0.0); }`,
      fragmentShader: /* glsl */ `uniform float uGain; varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a *= a; if (a * vA < 0.004) discard; gl_FragColor = vec4(vC * a * vA * uGain, 1.0); }`,
    });
    const pts = new THREE.Points(geo, this.mat); pts.frustumCulled = false; pts.renderOrder = -1; this.group.add(pts);
    // Milky Way: a soft band across the sky that fills in from 1,000 to 30,000 years.
    this.bandMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      uniforms: { uYears: { value: 0 }, uAxis: { value: new THREE.Vector3(0.3, 0.55, -0.78).normalize() } },
      vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uYears; uniform vec3 uAxis; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){ float lat = abs(dot(vD, uAxis)); float band = exp(-lat * lat / 0.018); float grain = 0.75 + 0.5 * h(floor(vD * 220.0));
          float k = smoothstep(800.0, 30000.0, uYears); gl_FragColor = vec4(vec3(0.55, 0.6, 0.75) * band * grain * 0.16 * k, 1.0); }` });
    this.band = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 48, 24), this.bandMat); this.band.renderOrder = -2; this.group.add(this.band);
  }

  /** Years since every photon vanished: stars nearer than this (in light-years) are back. */
  setYears(y: number) { this.mat.uniforms.uYears.value = y; this.bandMat.uniforms.uYears.value = y; }
  /** Pixel scale (drawing-buffer height / 1920) and overall gain. */
  setLook(px: number, gain = 1) { this.mat.uniforms.uPx.value = px; this.mat.uniforms.uGain.value = gain; }
  follow(camera: THREE.Camera) { camera.getWorldPosition(this.group.position); }
  /** World position of a named star on the shell (for callouts). */
  starWorld(name: string) { const s = this.named.find((x) => x.name === name); return s ? s.dir.clone().normalize().multiplyScalar(this.R).add(this.group.position) : null; }
}
