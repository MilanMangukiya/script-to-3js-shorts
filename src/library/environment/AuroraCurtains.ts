import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { rng } from '../util/math';

export interface AuroraCurtainsOptions {
  count?: number; seed?: number;
  /** Centre of the display (world units; the curtains run along X). */
  center?: THREE.Vector3;
  /** Curtain length, vertical height and base altitude (world units). */
  span?: number; height?: number; altitude?: number;
  /** Spread of the curtains in depth (Z). */
  depth?: number;
  /** Lower (green) and upper (red/pink) emission colours. */
  lowColor?: THREE.ColorRepresentation; highColor?: THREE.ColorRepresentation;
}

/**
 * Rippling aurora curtains: folded ribbons with a sharp, bright lower edge, vertical rays and a pink upper fringe,
 * additive. `intensity` fades them; deterministic `update(time_s)`. Real aurora sits ~100–300 km up: place the
 * curtains far away and large for a believable sky.
 */
export class AuroraCurtains {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;

  constructor(o: AuroraCurtainsOptions = {}) {
    const n = o.count ?? 4, r = rng(o.seed ?? 5), span = o.span ?? 9000, H = o.height ?? 2600, alt = o.altitude ?? 900, c = o.center ?? new THREE.Vector3(0, 0, -5000);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uLow: { value: new THREE.Color(o.lowColor ?? 0x4dffa0) }, uHigh: { value: new THREE.Color(o.highColor ?? 0xff5fa8) } },
      vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime; varying vec2 vUv; varying float vSeed;
        void main(){ vUv = uv; vSeed = aSeed; vec3 p = position;
          p.z += sin(p.x * 0.0011 + uTime * 0.35 + aSeed * 6.0) * 260.0 + sin(p.x * 0.0031 - uTime * 0.6 + aSeed * 11.0) * 90.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime, uIntensity; uniform vec3 uLow, uHigh; varying vec2 vUv; varying float vSeed;
        ${GLSL_NOISE}
        void main(){
          float v = vUv.y, x = vUv.x;
          float rays = 0.55 + 0.45 * vnoise(vec2(x * 160.0 + vSeed * 40.0, uTime * 0.6));
          rays *= 0.6 + 0.4 * vnoise(vec2(x * 520.0 - uTime * 1.2, vSeed));
          float folds = 0.35 + 0.65 * smoothstep(0.25, 0.75, vnoise(vec2(x * 7.0 + uTime * 0.08 + vSeed * 3.0, vSeed)));
          float edge = smoothstep(0.0, 0.05, v) * (1.0 - smoothstep(0.08, 1.0, v));
          float ends = smoothstep(0.0, 0.12, x) * smoothstep(1.0, 0.88, x);
          vec3 col = mix(uLow, uHigh, smoothstep(0.45, 0.95, v)) * (1.0 + 0.8 * (1.0 - smoothstep(0.0, 0.12, v)));
          float a = edge * rays * folds * ends * uIntensity * 0.6;
          gl_FragColor = vec4(col * a, a); }`,
    });
    for (let i = 0; i < n; i++) {
      const g = new THREE.PlaneGeometry(span * (0.7 + r() * 0.5), H * (0.7 + r() * 0.5), 220, 1);
      g.translate(0, H * 0.5, 0);
      const seed = new Float32Array(g.attributes.position.count).fill(r());
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      const m = new THREE.Mesh(g, this.mat);
      m.position.set(c.x + (r() - 0.5) * span * 0.4, alt + r() * H * 0.25, c.z - i * (o.depth ?? 1400) / Math.max(1, n - 1) + (r() - 0.5) * 300);
      m.rotation.y = (r() - 0.5) * 0.5; m.frustumCulled = false; m.renderOrder = -10;
      this.group.add(m);
    }
  }

  set intensity(v: number) { this.mat.uniforms.uIntensity.value = v; this.group.visible = v > 0.002; }
  update(time_s: number) { this.mat.uniforms.uTime.value = time_s; }
}
