import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface CloudDeckOptions {
  /** Plane size in metres and altitude (world y) of the cloud tops. */
  size?: number; level?: number;
  /** Feature size in metres and coverage 0..1. */
  scale?: number; coverage?: number;
  sunDirection?: THREE.Vector3; sunColor?: THREE.ColorRepresentation; shadowColor?: THREE.ColorRepresentation;
  /** Colour seen through gaps (sea/haze far below) and horizon haze colour. */
  belowColor?: THREE.ColorRepresentation; hazeColor?: THREE.ColorRepresentation; hazeDensity?: number;
}

/**
 * Cloud-top layer seen from above: domain-warped fractal density with directional self-shadowing.
 * `update(time_s, scrollX, scrollZ)` offsets the pattern (metres) so the viewer appears to fly over it.
 */
export class CloudDeck {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(o: CloudDeckOptions = {}) {
    this.uniforms = {
      uTime: { value: 0 }, uScroll: { value: new THREE.Vector2() }, uScale: { value: o.scale ?? 2600 }, uCoverage: { value: o.coverage ?? 0.55 },
      uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(0.5, 0.25, -0.8)).clone().normalize() },
      uSunColor: { value: new THREE.Color(o.sunColor ?? 0xffe2b8) }, uShadow: { value: new THREE.Color(o.shadowColor ?? 0x5a6f95) },
      uBelow: { value: new THREE.Color(o.belowColor ?? 0x1d3a5c) }, uHaze: { value: new THREE.Color(o.hazeColor ?? 0xe8c9a4) }, uHazeDensity: { value: o.hazeDensity ?? 0.000035 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: false,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uScale, uCoverage, uHazeDensity; uniform vec2 uScroll; uniform vec3 uSunDir, uSunColor, uShadow, uBelow, uHaze;
        varying vec3 vP;
        ${GLSL_NOISE}
        float density(vec2 p){
          vec2 q = p / uScale;
          q += (vec2(fbm(q*0.7 + 3.1), fbm(q*0.7 + 9.4)) - 0.5) * 1.3;
          float d = fbm(q) * 0.72 + fbm(q*3.1 + 4.0) * 0.28;
          return d;
        }
        void main(){
          vec2 p = vP.xz + uScroll;
          float dist = length(cameraPosition - vP);
          float d = density(p);
          vec2 sd = normalize(uSunDir.xz + 1e-4);
          float d2 = density(p + sd * uScale * 0.09);
          float th = 1.0 - uCoverage;
          float a = smoothstep(th - 0.06, th + 0.16, d);
          float lit = clamp(0.62 + (d - d2) * 5.5, 0.0, 1.0);
          float billow = smoothstep(th, th + 0.35, d);
          vec3 cloud = mix(uShadow, uSunColor * 1.25, lit * (0.55 + 0.45*billow));
          vec3 col = mix(uBelow, cloud, a);
          float f = 1.0 - exp(-uHazeDensity*uHazeDensity*dist*dist);
          col = mix(col, uHaze, clamp(f, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const geo = new THREE.PlaneGeometry(o.size ?? 160000, o.size ?? 160000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = o.level ?? -1500;
    this.mesh.frustumCulled = false;
  }

  update(time_s: number, scrollX = 0, scrollZ = 0) { this.uniforms.uTime.value = time_s; this.uniforms.uScroll.value.set(scrollX, scrollZ); }
}
