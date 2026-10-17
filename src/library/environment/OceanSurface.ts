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
  /**
   * Optional shore: water depth grows from 0 at `origin` [x, z] along the unit seaward `direction` by `slope` m per m.
   * Adds clear shallows over a sandy floor (Beer–Lambert absorption → turquoise), dancing caustics, a lacy foam line at
   * the water's edge and soft breakers rolling in. Omit for open water (unchanged behaviour).
   */
  shore?: { origin: [number, number]; direction: [number, number]; slope: number; sandColor?: THREE.ColorRepresentation; absorption?: [number, number, number]; foam?: number };
  /** Reflection strength multiplier (1 = full Fresnel; lower reads as a rougher, more transparent sea). */
  reflectivity?: number;
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
      uShoreOn: { value: o.shore ? 1 : 0 }, uShoreO: { value: new THREE.Vector2(...(o.shore?.origin ?? [0, 0])) },
      uShoreD: { value: new THREE.Vector2(...(o.shore?.direction ?? [0, -1])).normalize() }, uShoreSlope: { value: o.shore?.slope ?? 0.05 },
      uSand: { value: new THREE.Color(o.shore?.sandColor ?? 0xe8d9b8) }, uAbsorb: { value: new THREE.Vector3(...(o.shore?.absorption ?? [0.42, 0.075, 0.05])) },
      uShoreFoam: { value: o.shore?.foam ?? 1 }, uRefl: { value: o.reflectivity ?? 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: false,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uWaveH, uWaveS, uFogDensity, uGlitter, uSkyScale, uShoreOn, uShoreSlope, uShoreFoam, uRefl;
        uniform vec3 uDeep, uHorizon, uZenith, uSunDir, uSunColor, uFogColor, uSand, uAbsorb; uniform vec2 uShoreO, uShoreD;
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
          float foam = 0.0;
          if (uShoreOn > 0.5) {
            float sd = dot(vP.xz - uShoreO, uShoreD), depth = max(uShoreSlope * sd, 0.0);
            // Sunlight down to the sandy floor and back: Beer–Lambert absorption over the path (red goes first → turquoise).
            vec3 trans = exp(-uAbsorb * depth * 2.4);
            float caust = pow(fbm(vP.xz * 1.6 + N.xz * 3.0 + vec2(uTime * 0.37, uTime * 0.23)), 3.0) * 2.2 * exp(-depth * 0.7);
            vec3 floorC = uSand * (0.62 + 0.38 * max(uSunDir.y, 0.0) + caust) * uSkyScale;
            body = floorC * trans + body * (1.0 - trans) + vec3(0.0, 0.035, 0.04) * (1.0 - trans.g) * uSkyScale;
            // Foam: a lacy line at the water's edge breathing with the swash, and soft breakers rolling shoreward.
            float n = fbm(vP.xz * 2.6 + vec2(uTime * 0.11, -uTime * 0.07)), swash = 0.75 + 0.5 * sin(uTime * 0.8);
            float edge = smoothstep(0.42, 0.78, n + 0.25 * exp(-max(sd, 0.0) / 0.5)) * exp(-max(sd, 0.0) / swash);
            float roll = smoothstep(0.86, 1.0, sin(sd * 0.75 + uTime * 1.25)) * smoothstep(0.35, 0.75, n) * exp(-sd * 0.06) * step(1.5, sd);
            foam = clamp(edge + roll * 0.55, 0.0, 1.0) * uShoreFoam * (1.0 - smoothstep(60.0, 140.0, dist));
          }
          vec3 col = mix(body, refl, F * uRefl) + glint * (1.0 - foam);
          col = mix(col, vec3(0.93, 0.95, 0.96) * (0.45 + 0.75 * max(uSunDir.y, 0.0)) * uSkyScale, foam);
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
