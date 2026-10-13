import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { clamp, fbm2, smoothstep } from '../util/math';

export interface DuneFieldOptions {
  /** Square footprint edge in metres and grid resolution. */
  size?: number; segments?: number; seed?: number;
  /** Typical crest height and crest spacing in metres; the wind blows toward `windDeg` (crests run across it). */
  height?: number; wavelength?: number; windDeg?: number;
  /** Radius (m) around the origin kept flat at y = 0 for close-ups, and the interdune floor level elsewhere. */
  flatRadius?: number; floor?: number;
  sandColor?: THREE.ColorRepresentation; greenColor?: THREE.ColorRepresentation;
  /** Wind-ripple wavelength in metres (drawn in the shading, not the mesh). */
  rippleWavelength?: number;
}

/**
 * Procedural sand sea of asymmetric transverse dunes (gentle windward slopes, steep slip faces) with wind ripples,
 * grain speckle and two story controls:
 *  - `wetness` 0..1: raindrop spots appear and merge until the sand is uniformly dark and glossy (0.75+ = soaked).
 *  - `greening` 0..1: vegetation tint spreads from the interdune hollows up the slopes.
 * `heightAt(x, z)` returns the exact mesh height for placing cameras and props.
 */
export class DuneField {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform> = {
    uWet: { value: 0 }, uGreen: { value: 0 }, uRipple: { value: 0.11 }, uWind: { value: new THREE.Vector2(1, 0) },
    uGreenColor: { value: new THREE.Color(0x6f9a4a) }, uSeed: { value: 0 },
  };
  private o: Required<Omit<DuneFieldOptions, 'sandColor' | 'greenColor'>>;

  constructor(opts: DuneFieldOptions = {}) {
    const o = this.o = { size: 400, segments: 400, seed: 11, height: 6, wavelength: 58, windDeg: 0, flatRadius: 10, floor: -0.4, rippleWavelength: 0.11, ...opts };
    const geo = new THREE.PlaneGeometry(o.size, o.size, o.segments, o.segments).rotateX(-Math.PI / 2);
    const p = geo.attributes.position as THREE.BufferAttribute, hollow = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), s = this.sample(x, z);
      p.setY(i, s.h); hollow[i] = s.hollow;
    }
    geo.setAttribute('aHollow', new THREE.BufferAttribute(hollow, 1));
    geo.computeVertexNormals();
    const a = THREE.MathUtils.degToRad(o.windDeg);
    this.u.uWind.value.set(Math.cos(a), Math.sin(a)); this.u.uRipple.value = o.rippleWavelength; this.u.uSeed.value = o.seed % 97;
    if (opts.greenColor !== undefined) this.u.uGreenColor.value.set(opts.greenColor);
    const mat = new THREE.MeshStandardMaterial({ color: opts.sandColor ?? 0xd6b98a, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aHollow; varying float vHollow; varying vec3 vWPos; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHollow = aHollow; vWPos = (modelMatrix*vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix)*objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uWet, uGreen, uRipple, uSeed; uniform vec2 uWind; uniform vec3 uGreenColor;
          varying float vHollow; varying vec3 vWPos; varying vec3 vWN;
          ${GLSL_NOISE}
          float ripple(vec2 p){
            float u = dot(p, uWind), v = dot(p, vec2(-uWind.y, uWind.x));
            float w = u/uRipple + (vnoise(vec2(v*1.3, u*0.4)/uRipple*0.12 + uSeed) - 0.5)*2.2;
            float f = fract(w); return (f < 0.7 ? f/0.7 : (1.0 - f)/0.3);
          }
          float rainSpots(vec2 p, float wet){
            vec2 g = p/0.035, id0 = floor(g); float s = 0.0;
            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
              vec2 id = id0 + vec2(float(i), float(j));
              float th = hash21(id + uSeed*3.0)*0.8, grow = smoothstep(th, th + 0.18, wet);
              vec2 c = id + vec2(hash21(id + 4.7), hash21(id + 9.1));
              s = max(s, smoothstep(0.55*grow + 0.02, 0.38*grow, length(g - c))*step(0.001, grow));
            }
            return s;
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float dist = length(cameraPosition - vWPos);
          float grain = vnoise(vWPos.xz*2500.0), speck = vnoise(vWPos.xz*3.0 + uSeed);
          diffuseColor.rgb *= 0.9 + 0.12*speck + 0.26*(grain - 0.5)*smoothstep(2.0, 0.25, dist);
          float avgWet = smoothstep(0.08, 0.9, uWet);
          float spots = uWet > 0.001 && uWet < 0.999 ? mix(rainSpots(vWPos.xz, uWet), avgWet, smoothstep(1.5, 5.0, dist)) : avgWet;
          float wet = max(spots, smoothstep(0.72, 1.0, uWet));
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.56, 0.5, 0.44), wet);
          float gpatch = vHollow + (fbm(vWPos.xz*0.045 + uSeed) - 0.5)*0.9 + (vnoise(vWPos.xz*1.7) - 0.5)*0.25;
          float tuft = smoothstep(0.42, 0.72, vnoise(vWPos.xz*0.8 + uSeed*1.3));
          float g = smoothstep(1.0 - uGreen*1.35, 1.25 - uGreen*1.35, gpatch)*uGreen*mix(0.3, 1.0, tuft);
          diffuseColor.rgb = mix(diffuseColor.rgb, uGreenColor*(0.75 + 0.5*vnoise(vWPos.xz*2.3 + 5.0)), clamp(g*1.4, 0.0, 0.75));`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, wet*(1.0 - g));')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            float amp = (0.18 + 0.22*smoothstep(1.5, 0.2, dist))*smoothstep(25.0, 3.0, dist)*smoothstep(0.55, 0.85, vWN.y)*(1.0 - 0.6*g);
            if (amp > 0.001) {
              float e = uRipple*0.08, r0 = ripple(vWPos.xz);
              vec2 grad = vec2(ripple(vWPos.xz + vec2(e, 0.0)) - r0, ripple(vWPos.xz + vec2(0.0, e)) - r0)/e*uRipple*amp;
              vec3 nW = normalize(vWN - vec3(grad.x, 0.0, grad.y)*0.35);
              normal = normalize((viewMatrix*vec4(nW, 0.0)).xyz);
            }
            float near = smoothstep(1.2, 0.2, dist);
            if (near > 0.001) {   // individual grains catch the light in close-ups
              vec2 gq = vWPos.xz*2600.0;
              vec3 nW = normalize(normalize((inverse(viewMatrix)*vec4(normal, 0.0)).xyz) + vec3(vnoise(gq) - 0.5, 0.0, vnoise(gq + 31.7) - 0.5)*0.9*near);
              normal = normalize((viewMatrix*vec4(nW, 0.0)).xyz);
            }
          }`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
  }

  private sample(x: number, z: number): { h: number; hollow: number } {
    const o = this.o, a = THREE.MathUtils.degToRad(o.windDeg), dx = Math.cos(a), dz = Math.sin(a);
    const u = x * dx + z * dz;
    const warp = (fbm2(x / 95, z / 95, o.seed) - 0.5) * 2 * o.wavelength * 0.5 + (fbm2(x / 33, z / 33, o.seed + 7) - 0.5) * o.wavelength * 0.22;
    const ph = (((u + warp) / o.wavelength) % 1 + 1) % 1, k = 0.72;
    const s = ph < k ? smoothstep(0, 1, ph / k) : Math.pow(smoothstep(0, 1, (1 - ph) / (1 - k)), 0.85);
    const amp = clamp(0.35 + 0.95 * fbm2(x / 150, z / 150, o.seed + 3), 0.25, 1.15);
    const dune = o.height * amp * s + (fbm2(x / 14, z / 14, o.seed + 5) - 0.5) * 0.5;
    const r = Math.hypot(x, z), m = smoothstep(o.flatRadius, o.flatRadius * 2.6, r);
    return { h: m * (o.floor + dune), hollow: 1 - m * s };
  }

  /** Mesh height at a world (x, z) for an untransformed field (exact at vertices, close between them). */
  heightAt(x: number, z: number): number { return this.sample(x, z).h; }
  set wetness(v: number) { this.u.uWet.value = v; }
  set greening(v: number) { this.u.uGreen.value = v; }
}
