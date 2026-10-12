import * as THREE from 'three';
import { rng } from '../util/math';

export interface BokehFieldOptions {
  count?: number; seed?: number;
  /** Centre and half-extents (x, y, z) of the volume the discs fill, in scene units. */
  center?: THREE.Vector3; extent?: THREE.Vector3;
  /** Palette (weights are equal); each disc gets a random brightness within [0.35, 1]. */
  colors?: THREE.ColorRepresentation[];
  /** Disc diameter in pixels at 1080-wide output and HDR gain. */
  size?: number; gain?: number;
}

/**
 * Field of soft out-of-focus light discs (edge-bright bokeh) for macro and interior backgrounds.
 * Static apart from a faint shimmer; `dim` (0..1) switches discs off in seeded order for power-cut or dusk effects.
 */
export class BokehField {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;

  constructor(o: BokehFieldOptions = {}) {
    const n = o.count ?? 120, r = rng(o.seed ?? 17), c = o.center ?? new THREE.Vector3(0, 0, -3), e = o.extent ?? new THREE.Vector3(2, 2, 1);
    const palette = (o.colors ?? [0xfff1d6, 0xd9ecff, 0xffd9a8]).map((x) => new THREE.Color(x));
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), misc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([c.x + (r() * 2 - 1) * e.x, c.y + (r() * 2 - 1) * e.y, c.z + (r() * 2 - 1) * e.z], i * 3);
      const p = palette[Math.floor(r() * palette.length)], b = 0.35 + r() * 0.65;
      col.set([p.r * b, p.g * b, p.b * b], i * 3); misc.set([0.6 + r() * 0.8, r(), r() * 6.283], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aMisc', new THREE.BufferAttribute(misc, 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uPx: { value: o.size ?? 80 }, uGain: { value: o.gain ?? 0.15 }, uDim: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `attribute vec3 aCol, aMisc; uniform float uPx, uDim, uTime; varying vec3 vCol;
        void main(){ vCol = aCol * smoothstep(uDim - 0.01, uDim + 0.01, aMisc.y) * (0.94 + 0.06*sin(uTime*2.1 + aMisc.z)); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize = uPx*aMisc.x; }`,
      fragmentShader: `uniform float uGain; varying vec3 vCol;
        void main(){ float d = length(gl_PointCoord - 0.5)*2.0; float a = smoothstep(1.0, 0.88, d)*(0.7 + 0.45*smoothstep(0.5, 0.95, d)); gl_FragColor = vec4(vCol*a*uGain, a); }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = -50;
  }

  set dim(v: number) { this.mat.uniforms.uDim.value = v; }
  set gain(v: number) { this.mat.uniforms.uGain.value = v; }
  update(time_s: number) { this.mat.uniforms.uTime.value = time_s; }
}
