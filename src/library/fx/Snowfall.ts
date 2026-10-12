import * as THREE from 'three';
import { rng } from '../util/math';

export interface SnowfallOptions {
  count?: number; seed?: number;
  /** Size of the wrapped volume (x, y, z) in scene units; particles recycle inside it. */
  box?: [number, number, number];
  /** Fall speed in units per second and lateral drift amplitude in units. */
  fallSpeed?: number; drift?: number;
  /** Sprite size in pixels at one unit distance (1080-wide output) and the min/max clamp. */
  size?: number; minPx?: number; maxPx?: number;
  color?: THREE.ColorRepresentation;
  /** HDR brightness; with additive blending use ≤ 1 for snow in daylight, > 1 for glinting crystals. */
  brightness?: number; additive?: boolean;
  /** 0 = steady flakes, 1 = strongly glinting tumbling platelets. */
  glint?: number;
  /** Fade distance: particles vanish beyond `far` and very near the camera. */
  far?: number;
}

/**
 * Wrapped particle fall for snow in air or sinking ice crystals under water. Positions are a pure function of
 * time (no simulation state); move `points.position` to keep the volume around the camera or a subject.
 * `amount` (0..1) reveals particles progressively so a fall can start or stop on cue.
 */
export class Snowfall {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;

  constructor(o: SnowfallOptions = {}) {
    const n = o.count ?? 1500, r = rng(o.seed ?? 9), box = o.box ?? [30, 14, 30];
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { pos.set([(r() - 0.5) * box[0], r() * box[1], (r() - 0.5) * box[2]], i * 3); seed.set([r() * 6.283, 0.7 + r() * 0.6, r(), 0.6 + r() * 0.8], i * 4); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const additive = o.additive ?? true;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      ...(additive ? { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor } : {}),
      uniforms: {
        uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) }, uFall: { value: o.fallSpeed ?? 1.2 }, uDrift: { value: o.drift ?? 0.4 },
        uSize: { value: o.size ?? 60 }, uMinPx: { value: o.minPx ?? 1.5 }, uMaxPx: { value: o.maxPx ?? 14 }, uColor: { value: new THREE.Color(o.color ?? 0xffffff) },
        uBright: { value: o.brightness ?? 0.8 }, uGlint: { value: o.glint ?? 0 }, uFar: { value: o.far ?? 40 }, uAmount: { value: 1 }, uAdd: { value: additive ? 1 : 0 },
      },
      vertexShader: /* glsl */ `attribute vec4 aSeed; uniform float uTime, uFall, uDrift, uSize, uMinPx, uMaxPx, uGlint, uFar, uAmount; uniform vec3 uBox; varying float vA;
        void main(){ vec3 p = position;
          p.y = mod(position.y - uTime*uFall*aSeed.y, uBox.y);
          p.x += sin(uTime*0.7*aSeed.y + aSeed.x) * uDrift; p.z += cos(uTime*0.55*aSeed.y + aSeed.x*1.7) * uDrift;
          vec4 mv = modelViewMatrix*vec4(p,1.0); float d = -mv.z;
          float edge = smoothstep(0.0, uBox.y*0.08, p.y) * smoothstep(uBox.y, uBox.y*0.92, p.y);
          float glint = mix(1.0, pow(abs(sin(uTime*2.3*aSeed.y + aSeed.x*5.0)), 6.0)*2.2 + 0.25, uGlint);
          vA = edge * glint * smoothstep(uFar, uFar*0.5, d) * smoothstep(0.15, 0.8, d) * step(aSeed.z, uAmount);
          gl_Position = projectionMatrix*mv; gl_PointSize = clamp(uSize*aSeed.w/max(d, 0.1), uMinPx, uMaxPx); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uBright, uAdd; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5)*2.0; float a = smoothstep(1.0, 0.25, d) * vA; if (a < 0.003) discard;
          gl_FragColor = vec4(uColor * uBright * mix(1.0, a, uAdd), a); }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 8;
  }

  /** Fraction of particles shown (0..1). */
  set amount(v: number) { this.mat.uniforms.uAmount.value = v; }
  set brightness(v: number) { this.mat.uniforms.uBright.value = v; }
  update(time_s: number) { this.mat.uniforms.uTime.value = time_s; }
}
