import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface EarthTextures { day: THREE.Texture; night: THREE.Texture; clouds: THREE.Texture; land: THREE.Texture; /** Optional floating sea-ice mask (seaice_4k.png). */ seaIce?: THREE.Texture }
export interface EarthOptions {
  radius?: number;
  /** Unit vector toward the sun in world space. */
  sunDirection?: THREE.Vector3;
  cloudOpacity?: number;
  /** Atmospheric rim strength and colour. */
  atmosphereStrength?: number; atmosphereColor?: THREE.ColorRepresentation;
  /** City-light intensity on the night side (HDR). */
  nightLights?: number;
  segments?: number;
}

const TEX_DIR = 'assets/library/textures/earth/';
const blackTexture = () => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; };

/** Load the shared NASA-derived texture set (see scripts/build_earth_textures.py). `base` is the URL prefix of the repo root. */
export async function loadEarthTextures(base = '/', maxAnisotropy = 8, opts: { seaIce?: boolean } = {}): Promise<EarthTextures> {
  const loader = new THREE.TextureLoader();
  const load = async (file: string, srgb: boolean) => {
    const t = await loader.loadAsync(base + TEX_DIR + file);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping; t.anisotropy = maxAnisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  const [day, night, clouds, land] = await Promise.all([load('day_8k.jpg', true), load('night_8k.jpg', true), load('clouds_8k.jpg', false), load('landmask_4k.png', false)]);
  const seaIce = opts.seaIce ? await load('seaice_4k.png', false) : undefined;
  return { day, night, clouds, land, seaIce };
}

/**
 * Earth with NASA Blue Marble day map, Black Marble city lights, cloud layer, ocean sun glint and atmospheric rim.
 * Deterministic: call `update(time_s)`; all look parameters are plain setters.
 *  - `scatter`: scales atmospheric glow (1 = normal air).
 *  - `nightOutage`: 0..1 fraction of city lights switched off in noise-shaped regional patches (illustrative).
 *  - `setView(lon, lat)`: orient the globe so a geographic point faces +Z.
 *  - `flattening`: oblateness f = (a − c) / a along the spin axis, volume preserved (0 = sphere, the default; Earth today ≈ 0.0034).
 */
export class Earth {
  readonly group = new THREE.Group();
  readonly globe: THREE.Mesh;
  readonly atmosphere: THREE.Mesh;
  private tilt = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private atmoMat: THREE.ShaderMaterial;
  private baseLon = 0;
  /** Globe spin in radians per second and cloud drift in UV per second (both default to slow, visible-only-over-time values). */
  spinRate = 0.004; cloudDrift = 0.0006;

  constructor(tex: EarthTextures, o: EarthOptions = {}) {
    const R = o.radius ?? 1, seg = o.segments ?? 192;
    const sun = (o.sunDirection ?? new THREE.Vector3(1, 0.3, 0.5)).clone().normalize();
    const atmoColor = new THREE.Color(o.atmosphereColor ?? 0x5aa2ff);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDay: { value: tex.day }, tNight: { value: tex.night }, tClouds: { value: tex.clouds }, tLand: { value: tex.land },
        tSeaIce: { value: tex.seaIce ?? blackTexture() }, uSeaIce: { value: 0 },
        uSunDir: { value: sun }, uCloudShift: { value: 0 }, uCloudOpacity: { value: o.cloudOpacity ?? 0.9 },
        uNight: { value: o.nightLights ?? 2.2 }, uOutage: { value: 0 }, uOutageSeed: { value: 3.7 }, uOutageScale: { value: 5.5 },
        uAtmoColor: { value: atmoColor }, uAtmo: { value: o.atmosphereStrength ?? 1 }, uScatter: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
        void main(){ vUv = uv; vObj = normalize(position); vN = normalize((vec4(normalMatrix*normal, 0.0)*viewMatrix).xyz);   // world normal, exact under the oblate scale
          vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDay, tNight, tClouds, tLand, tSeaIce; uniform float uSeaIce;
        uniform vec3 uSunDir, uAtmoColor; uniform float uCloudShift, uCloudOpacity, uNight, uOutage, uOutageSeed, uOutageScale, uAtmo, uScatter;
        varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
        ${GLSL_NOISE}
        void main(){
          vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
          float ndl = dot(N, uSunDir);
          float day = smoothstep(-0.1, 0.24, ndl);
          vec3 albedo = texture2D(tDay, vUv).rgb;
          float land = texture2D(tLand, vUv).r;
          float seaIce = texture2D(tSeaIce, vUv).r * uSeaIce;
          albedo = mix(albedo, vec3(0.7, 0.75, 0.8), seaIce);
          land = max(land, seaIce);   // ice does not glint like open water
          vec2 cuv = vUv + vec2(uCloudShift, 0.0);
          float cloud = smoothstep(0.08, 0.95, texture2D(tClouds, cuv).r) * uCloudOpacity;
          float cloudShadow = smoothstep(0.08, 0.95, texture2D(tClouds, cuv + vec2(0.0012, 0.0008)).r) * uCloudOpacity;
          vec3 H = normalize(V + uSunDir);
          float spec = pow(max(dot(N, H), 0.0), 110.0) * (1.0 - land) * (1.0 - cloud);
          float diff = max(ndl, 0.0);
          vec3 dayCol = albedo * (0.03 + 1.35*diff) * (1.0 - 0.35*cloudShadow) + vec3(1.0, 0.92, 0.8) * spec * 1.6;
          dayCol = mix(dayCol, vec3(0.05 + 1.5*diff), cloud);
          // warm terminator band
          dayCol += albedo * vec3(1.0, 0.42, 0.18) * smoothstep(-0.02, 0.12, ndl) * smoothstep(0.34, 0.1, ndl) * 0.22;
          vec3 lights = texture2D(tNight, vUv).rgb;
          float lum = dot(lights, vec3(0.3, 0.6, 0.1));
          float m = fbm3(vObj*uOutageScale + uOutageSeed) * 0.9 + 0.05;
          float keep = smoothstep(uOutage - 0.035, uOutage + 0.035, m);
          vec3 nightCol = vec3(1.0, 0.78, 0.48) * pow(lum, 1.35) * uNight * keep * (1.0 - cloud*0.75);
          nightCol += albedo * vec3(0.012, 0.016, 0.028) + vec3(0.012, 0.016, 0.026) * cloud;
          vec3 col = mix(nightCol, dayCol, day);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
          col += uAtmoColor * fres * (0.06 + 0.94*smoothstep(-0.15, 0.3, ndl)) * uAtmo * uScatter * 0.9;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(R, seg, Math.round(seg * 0.66)), this.mat);

    const shellR = R * 1.035;
    const edge = Math.sqrt(1 - (R / shellR) * (R / shellR));
    this.atmoMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uSunDir: { value: sun }, uColor: { value: atmoColor }, uStrength: { value: o.atmosphereStrength ?? 1 }, uScatter: { value: 1 }, uEdge: { value: edge } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize((vec4(normalMatrix*normal, 0.0)*viewMatrix).xyz); vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uSunDir, uColor; uniform float uStrength, uScatter, uEdge; varying vec3 vN; varying vec3 vP;
        void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
          float g = clamp(-dot(N, V) / uEdge, 0.0, 1.0);
          float glow = pow(g, 2.4);
          float lit = smoothstep(-0.35, 0.35, dot(N, uSunDir));
          vec3 c = mix(vec3(1.0, 0.55, 0.3), uColor, smoothstep(0.0, 0.5, dot(N, uSunDir)));
          gl_FragColor = vec4(c * glow * (0.03 + lit) * uStrength * uScatter * 1.6, glow); }`,
    });
    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(shellR, 128, 96), this.atmoMat);
    this.tilt.add(this.globe);
    this.group.add(this.tilt, this.atmosphere);
  }

  /** Orient so geographic (lonDeg east, latDeg north) faces world +Z before the group's own transform. */
  setView(lonDeg: number, latDeg: number) {
    this.baseLon = -Math.PI / 2 - THREE.MathUtils.degToRad(lonDeg);
    this.tilt.rotation.x = THREE.MathUtils.degToRad(latDeg);
    this.atmosphere.rotation.x = this.tilt.rotation.x;   // keeps a flattened shell aligned with the spin axis
    this.globe.rotation.y = this.baseLon;
  }
  set sunDirection(v: THREE.Vector3) { this.mat.uniforms.uSunDir.value.copy(v).normalize(); this.atmoMat.uniforms.uSunDir.value.copy(v).normalize(); }
  /** Oblate spheroid along the spin axis with the same volume: equatorial radius (1 − f)^(−1/3), polar (1 − f)^(2/3). */
  set flattening(f: number) {
    const a = Math.pow(1 - f, -1 / 3), c = (1 - f) * a;
    this.globe.scale.set(a, c, a); this.atmosphere.scale.set(a, c, a);
    this.atmosphere.rotation.x = this.tilt.rotation.x;
  }
  set scatter(v: number) { this.mat.uniforms.uScatter.value = v; this.atmoMat.uniforms.uScatter.value = v; }
  set cloudOpacity(v: number) { this.mat.uniforms.uCloudOpacity.value = v; }
  set nightLights(v: number) { this.mat.uniforms.uNight.value = v; }
  set nightOutage(v: number) { this.mat.uniforms.uOutage.value = v; }
  /** 0..1 amount of floating sea ice drawn from the optional seaIce texture (0 = none; default keeps the base map untouched). */
  set seaIce(v: number) { this.mat.uniforms.uSeaIce.value = v; }
  set outageSeed(v: number) { this.mat.uniforms.uOutageSeed.value = v; }
  /** Spatial frequency of outage patches on the unit sphere (lower = larger regions). */
  set outageScale(v: number) { this.mat.uniforms.uOutageScale.value = v; }

  /** @param time_s absolute film time; spin and cloud drift are linear in time. */
  update(time_s: number) {
    this.globe.rotation.y = this.baseLon + time_s * this.spinRate;
    this.mat.uniforms.uCloudShift.value = time_s * this.cloudDrift;
  }
}
