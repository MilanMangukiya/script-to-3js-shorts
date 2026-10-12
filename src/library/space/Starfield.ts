import * as THREE from 'three';
import { rng } from '../util/math';

export interface StarfieldOptions {
  seed?: number; count?: number;
  /** Shell radius in scene units (keep inside the camera far plane). */
  radius?: number;
  /** Global brightness multiplier (HDR). */
  brightness?: number;
  /** Largest star sprite diameter in pixels at 1080-wide output. */
  maxSize?: number;
  /** Only place stars with direction.y above this value (use -1 for a full sphere). */
  minY?: number;
}

/**
 * Seeded starfield: power-law brightness distribution (many faint, few bright) with blackbody-like tints.
 * Static by design; set `brightness` per shot for exposure changes. Follows the camera when `follow()` is called.
 */
export class Starfield {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;

  constructor(o: StarfieldOptions = {}) {
    const n = o.count ?? 2500, R = o.radius ?? 400, r = rng(o.seed ?? 7), minY = o.minY ?? -1;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    const tints = [[0.72, 0.8, 1.0], [0.9, 0.93, 1.0], [1.0, 1.0, 1.0], [1.0, 0.95, 0.85], [1.0, 0.84, 0.68]];
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0, z = 0;
      do { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); x = s * Math.cos(a); y = u; z = s * Math.sin(a); } while (y < minY);
      pos.set([x * R, y * R, z * R], i * 3);
      const mag = Math.pow(r(), 5.5);            // most stars faint
      const t = tints[Math.floor(r() * tints.length)];
      const b = 0.12 + mag * 1.6;
      col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
      size[i] = 0.35 + mag * 0.65;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uBright: { value: o.brightness ?? 1 }, uMaxSize: { value: o.maxSize ?? 5 } },
      vertexShader: /* glsl */ `attribute float aSize; attribute vec3 color; uniform float uMaxSize; varying vec3 vCol;
        void main(){ vCol = color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = max(1.5, aSize*uMaxSize); }`,
      fragmentShader: /* glsl */ `uniform float uBright; varying vec3 vCol;
        void main(){ float d = length(gl_PointCoord - 0.5)*2.0; float a = smoothstep(1.0, 0.0, d); a *= a; gl_FragColor = vec4(vCol*uBright*a, a); }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -90;
  }

  set brightness(v: number) { this.mat.uniforms.uBright.value = v; }
  follow(camera: THREE.Camera) { this.points.position.copy(camera.position); }
}
