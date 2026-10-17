import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface OceanOptions {
  /** Plane edge length in metres and its water level (world y). */
  size?: number; level?: number;
  deepColor?: THREE.ColorRepresentation;
  /** Sky colours reflected by the surface; should match the scene's sky dome. */
  horizonColor?: THREE.ColorRepresentation; zenithColor?: THREE.ColorRepresentation;
  sunDirection?: THREE.Vector3; sunColor?: THREE.ColorRepresentation;
  /** Wave steepness multiplier (0.3 calm … 1.5 choppy) and horizontal scale multiplier. */
  waveHeight?: number; waveScale?: number;
  /** Aerial-perspective fog toward the horizon. */
  fogColor?: THREE.ColorRepresentation; fogDensity?: number;
  /** Sun glitter strength. */
  glitter?: number;
}

/**
 * Deterministic open-water surface: analytic multi-octave wave normals, Fresnel sky reflection, sun glitter and
 * distance haze on a flat plane (suited to eye-level and aerial shots of calm to moderate seas).
 */
export class OceanSurface {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(o: OceanOptions = {}) {
    this.uniforms = {
      uTime: { value: 0 }, uDeep: { value: new THREE.Color(o.deepColor ?? 0x0b2f4a) },
      uHorizon: { value: new THREE.Color(o.horizonColor ?? 0xa9c4e0) }, uZenith: { value: new THREE.Color(o.zenithColor ?? 0x24427a) },
      uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(0.3, 0.4, -0.8)).clone().normalize() }, uSunColor: { value: new THREE.Color(o.sunColor ?? 0xfff0d0) },
      uWaveH: { value: o.waveHeight ?? 0.6 }, uWaveS: { value: o.waveScale ?? 1 }, uFogColor: { value: new THREE.Color(o.fogColor ?? 0xc9d3de) },
      uFogDensity: { value: o.fogDensity ?? 0.00009 }, uGlitter: { value: o.glitter ?? 1 }, uSkyScale: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: false,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uWaveH, uWaveS, uFogDensity, uGlitter, uSkyScale;
        uniform vec3 uDeep, uHorizon, uZenith, uSunDir, uSunColor, uFogColor;
        varying vec3 vP;
        ${GLSL_NOISE}
        // Sum of travelling sine waves: returns the surface slope (d/dx, d/dz).
        vec2 slope(vec2 p, float dist){
          vec2 s = vec2(0.0);
          float amp = 0.5, len = 47.0 * uWaveS;
          vec2 dir = normalize(vec2(0.8, 0.6));
          for (int i = 0; i < 7; i++) {
            float k = 6.28318 / len, w = sqrt(9.81 * k);
            float ph = dot(dir, p) * k + uTime * w + float(i) * 1.7;
            float fade = 1.0 / (1.0 + dist * 0.004 / len * 12.0);   // drop wavelets that would alias far away
            s += dir * cos(ph) * amp * uWaveH * 0.22 * fade;
            dir = normalize(vec2(dir.x*0.73 - dir.y*0.69, dir.x*0.69 + dir.y*0.73));
            len *= 0.47; amp *= 0.82;
          }
          return s;
        }
        vec3 sky(vec3 d){ return mix(uHorizon, uZenith, pow(clamp(d.y, 0.0, 1.0), 0.55)) * uSkyScale; }
        void main(){
          vec3 toCam = cameraPosition - vP; float dist = length(toCam); vec3 V = toCam / dist;
          vec2 s = slope(vP.xz, dist);
          float micro = (fbm(vP.xz*2.3 + uTime*0.35) - 0.5) * 0.16 * uWaveH / (1.0 + dist*0.02);
          vec3 N = normalize(vec3(-s.x - micro, 1.0, -s.y + micro));
          float ndv = max(dot(N, V), 0.0);
          float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
          vec3 R = reflect(-V, N); R.y = abs(R.y);
          vec3 refl = sky(R);
          float sd = max(dot(R, uSunDir), 0.0);
          vec3 glint = uSunColor * (pow(sd, 420.0) * 26.0 + pow(sd, 48.0) * 0.4) * uGlitter;
          vec3 body = uDeep * (0.55 + 0.45 * max(dot(N, uSunDir), 0.0)) * uSkyScale;
          vec3 col = mix(body, refl, F) + glint;
          float f = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist);
          col = mix(col, uFogColor * uSkyScale, clamp(f, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const geo = new THREE.PlaneGeometry(o.size ?? 60000, o.size ?? 60000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = o.level ?? 0;
    this.mesh.frustumCulled = false;
  }

  /** Scales reflected and scattered skylight (keep in step with the sky dome's `scatter`). */
  set skyScale(v: number) { this.uniforms.uSkyScale.value = v; }
  update(time_s: number) { this.uniforms.uTime.value = time_s; }
}
