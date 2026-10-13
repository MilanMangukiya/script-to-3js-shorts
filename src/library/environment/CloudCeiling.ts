import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface CloudCeilingOptions {
  /** Plane edge in metres, cloud-base altitude (world y) and feature size in metres. */
  size?: number; altitude?: number; scale?: number;
  /** 1 = unbroken overcast; lower values open gaps that show the sky dome behind. */
  coverage?: number;
  /** Underside colours: thick rain-laden cloud and thinner, brighter cloud. */
  darkColor?: THREE.ColorRepresentation; lightColor?: THREE.ColorRepresentation;
  /** Distance haze that blends the ceiling into the horizon (match the sky dome's horizon colour). */
  hazeColor?: THREE.ColorRepresentation; hazeDensity?: number;
  /** Direction toward the sun and the silver-lining glow it puts into thin cloud. */
  sunDirection?: THREE.Vector3; sunColor?: THREE.ColorRepresentation; sunGlow?: number;
  seed?: number;
}

/**
 * Overcast cloud base seen from below (rain clouds over a landscape or sea): warped fractal density shaded dark where
 * thick and bright where thin, with a silver lining toward the sun and haze toward the horizon. `coverage` opens
 * gaps, and `setGap` clears a soft round hole (a sunlit break) at a world position. `update(time_s, scrollX, scrollZ)`.
 */
export class CloudCeiling {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(o: CloudCeilingOptions = {}) {
    this.uniforms = {
      uTime: { value: 0 }, uScroll: { value: new THREE.Vector2() }, uScale: { value: o.scale ?? 900 }, uCoverage: { value: o.coverage ?? 1 },
      uDark: { value: new THREE.Color(o.darkColor ?? 0x5d646d) }, uLight: { value: new THREE.Color(o.lightColor ?? 0xa9b0b8) },
      uHaze: { value: new THREE.Color(o.hazeColor ?? 0x9aa1a8) }, uHazeDensity: { value: o.hazeDensity ?? 0.00016 },
      uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(0.3, 0.4, -0.8)).clone().normalize() }, uSunColor: { value: new THREE.Color(o.sunColor ?? 0xfff0d8) },
      uSunGlow: { value: o.sunGlow ?? 0.25 }, uSeed: { value: o.seed ?? 4 }, uGap: { value: new THREE.Vector4(0, 0, 0, 0) },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, uniforms: this.uniforms,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uScale, uCoverage, uHazeDensity, uSunGlow, uSeed; uniform vec2 uScroll; uniform vec4 uGap;
        uniform vec3 uDark, uLight, uHaze, uSunDir, uSunColor;
        varying vec3 vP;
        ${GLSL_NOISE}
        void main(){
          vec2 q = (vP.xz + uScroll)/uScale + uSeed;
          q += (vec2(fbm(q*0.6 + 3.0 + uTime*0.004), fbm(q*0.6 + 8.0 - uTime*0.003)) - 0.5)*1.1;
          float d = fbm(q)*0.7 + fbm(q*2.7 + 4.0)*0.3;
          float gap = uGap.w > 0.0 ? smoothstep(uGap.z, uGap.z*0.35, length(vP.xz - uGap.xy))*uGap.w : 0.0;
          float th = mix(0.75, -0.2, uCoverage) + gap*0.9;
          float cover = smoothstep(th, th + 0.22, d);
          float thick = smoothstep(0.3, 0.75, d);
          vec3 V = normalize(vP - cameraPosition);
          vec3 col = mix(uLight, uDark, thick);
          col += uSunColor*uSunGlow*pow(max(dot(V, uSunDir), 0.0), 14.0)*(1.2 - thick)*(0.4 + 0.6*cover);
          float dist = length(vP - cameraPosition);
          float h = 1.0 - exp(-uHazeDensity*uHazeDensity*dist*dist);
          col = mix(col, uHaze, clamp(h, 0.0, 1.0));
          float a = mix(cover, 1.0, clamp(h, 0.0, 1.0)*step(0.5, uCoverage));
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.size ?? 24000, o.size ?? 24000, 1, 1).rotateX(Math.PI / 2), mat);
    this.mesh.position.y = o.altitude ?? 800;
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -50;
  }

  set coverage(v: number) { this.uniforms.uCoverage.value = v; }
  set sunGlow(v: number) { this.uniforms.uSunGlow.value = v; }
  /** Soft round break in the cloud centred at world (x, z) with radius r metres; strength 0 closes it. */
  setGap(x: number, z: number, r: number, strength = 1) { this.uniforms.uGap.value.set(x, z, r, strength); }
  update(time_s: number, scrollX = 0, scrollZ = 0) { this.uniforms.uTime.value = time_s; this.uniforms.uScroll.value.set(scrollX, scrollZ); }
}
