import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface IceSheetOptions {
  /** Edge length of the sheet in metres and its thickness. The top surface sits at local y = 0. */
  size?: number; thickness?: number;
  /** 0 = bare black ice, 1 = fully snow-covered. */
  snowAmount?: number;
  seed?: number;
  /** Sky colours and sun used for the top surface's reflections (match the scene sky dome). */
  horizonColor?: THREE.ColorRepresentation; zenithColor?: THREE.ColorRepresentation;
  sunDirection?: THREE.Vector3; sunColor?: THREE.ColorRepresentation;
  /** Aerial haze for the top surface. */
  fogColor?: THREE.ColorRepresentation; fogDensity?: number;
  /** Water fog used when the sheet is seen from below. */
  underFogColor?: THREE.ColorRepresentation; underFogDensity?: number;
  /** Brightness of daylight transmitted through the ice when seen from below. */
  transmission?: number;
}

/**
 * Floating lake or sea ice sheet with two looks: a snow-dusted, cracked top surface for above-water shots and a
 * softly glowing underside for under-ice shots (snow patches block light, cracks and clear ice let it through).
 * `setShadow` projects a soft moving shadow onto the underside, e.g. a skater or an animal crossing above.
 */
export class IceSheet {
  readonly group = new THREE.Group();
  readonly top: THREE.Mesh; readonly under: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;

  constructor(o: IceSheetOptions = {}) {
    const size = o.size ?? 4000, th = o.thickness ?? 0.45;
    this.u = {
      uTime: { value: 0 }, uSnow: { value: o.snowAmount ?? 0.55 }, uSeed: { value: o.seed ?? 3 },
      uHorizon: { value: new THREE.Color(o.horizonColor ?? 0xcfd9e6) }, uZenith: { value: new THREE.Color(o.zenithColor ?? 0x4a78b8) },
      uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(-0.4, 0.3, -0.8)).clone().normalize() }, uSunColor: { value: new THREE.Color(o.sunColor ?? 0xffe2bd) },
      uFogColor: { value: new THREE.Color(o.fogColor ?? 0xd5dde8) }, uFogDensity: { value: o.fogDensity ?? 0.0003 },
      uUnderFog: { value: new THREE.Color(o.underFogColor ?? 0x0e3a44) }, uUnderDensity: { value: o.underFogDensity ?? 0.05 },
      uTransmission: { value: o.transmission ?? 1 }, uShadow: { value: new THREE.Vector4(0, 0, 1, 0) }, // x, z, radius, strength
    };
    const vert = /* glsl */ `varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
    const common = /* glsl */ `
      uniform float uTime, uSnow, uSeed, uFogDensity, uUnderDensity, uTransmission; uniform vec3 uHorizon, uZenith, uSunDir, uSunColor, uFogColor, uUnderFog; uniform vec4 uShadow;
      varying vec3 vP;
      ${GLSL_NOISE}
      float snowMask(vec2 p){ float n = fbm(p*0.035 + uSeed) * 0.65 + fbm(p*0.21 + uSeed*2.0) * 0.35; return smoothstep(0.62 - uSnow*0.42, 0.74 - uSnow*0.42, n); }
      float cracks(vec2 p){ float a = abs(vnoise(p*0.11 + uSeed*3.0) - 0.5), b = abs(vnoise(p*0.37 + 9.0 + uSeed) - 0.5); return smoothstep(0.02, 0.0, a) * 0.9 + smoothstep(0.012, 0.0, b) * 0.5; }`;
    this.top = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: this.u, fog: false, vertexShader: vert,
      fragmentShader: /* glsl */ `${common}
        void main(){
          vec3 toCam = cameraPosition - vP; float dist = length(toCam); vec3 V = toCam/dist;
          float snow = snowMask(vP.xz), cr = cracks(vP.xz) * (1.0 - snow) / (1.0 + dist*0.02);
          vec3 N = normalize(vec3((vnoise(vP.xz*1.7) - 0.5)*0.05, 1.0, (vnoise(vP.xz*1.7 + 5.0) - 0.5)*0.05));
          float ndv = max(dot(N, V), 0.0), F = 0.03 + 0.97*pow(1.0 - ndv, 5.0);
          vec3 R = reflect(-V, N); R.y = abs(R.y);
          vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.55));
          float sd = max(dot(R, uSunDir), 0.0);
          vec3 clear = mix(vec3(0.03, 0.09, 0.13), sky, F) + uSunColor * (pow(sd, 300.0)*14.0 + pow(sd, 30.0)*0.35) + vec3(0.75, 0.9, 1.0) * cr * 0.5;
          float nl = max(dot(vec3(0.0, 1.0, 0.0), uSunDir), 0.0);
          vec3 snowCol = vec3(0.9, 0.94, 1.0) * (0.42 + 1.1*nl) * (0.9 + 0.2*fbm(vP.xz*0.9)) * mix(vec3(0.75, 0.85, 1.0), uSunColor, 0.55);
          vec3 col = mix(clear, snowCol, snow);
          float f = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist);
          gl_FragColor = vec4(mix(col, uFogColor, clamp(f, 0.0, 1.0)), 1.0);
        }`,
    }));
    this.under = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: this.u, fog: false, vertexShader: vert, side: THREE.DoubleSide,
      fragmentShader: /* glsl */ `${common}
        void main(){
          float dist = length(cameraPosition - vP);
          float snow = snowMask(vP.xz), cr = cracks(vP.xz);
          float bubbles = smoothstep(0.78, 0.9, vnoise(vP.xz*9.0 + uSeed)) * 0.35;
          float light = mix(1.0, 0.28, snow) + cr * 0.7 + bubbles;
          light *= 0.85 + 0.15*fbm(vP.xz*0.6 + uTime*0.02);
          float sh = smoothstep(uShadow.z, uShadow.z*0.35, length(vP.xz - uShadow.xy)) * uShadow.w;
          light *= 1.0 - 0.75*sh;
          vec3 col = mix(vec3(0.16, 0.5, 0.56), vec3(0.78, 0.97, 1.0), clamp(light*0.75, 0.0, 1.0)) * light * uTransmission;
          float f = 1.0 - exp(-uUnderDensity*uUnderDensity*dist*dist*0.5);
          gl_FragColor = vec4(mix(col, uUnderFog, clamp(f, 0.0, 1.0)), 1.0);
        }`,
    }));
    this.under.position.y = -th;
    this.top.frustumCulled = false; this.under.frustumCulled = false;
    this.group.add(this.top, this.under);
  }

  /** Soft shadow on the underside at world (x, z); strength 0 disables it. */
  setShadow(x: number, z: number, radius = 0.9, strength = 1) { this.u.uShadow.value.set(x, z, radius, strength); }
  set snowAmount(v: number) { this.u.uSnow.value = v; }
  update(time_s: number) { this.u.uTime.value = time_s; }
}
