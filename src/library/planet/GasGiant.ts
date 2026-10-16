import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface GasGiantStorm {
  /** Centre latitude and longitude in degrees (body frame) and the oval's half-height in degrees. */
  lat: number; lon: number; size: number;
  color: THREE.ColorRepresentation;
  /** 0..1 blend strength; negative spin swirls clockwise. */
  strength?: number; spin?: number;
}
export interface GasGiantOptions {
  radius?: number; seed?: number; segments?: number;
  /** Bright zones and dark belts, two variants each, plus the hazy polar colour. */
  zoneColors?: [THREE.ColorRepresentation, THREE.ColorRepresentation];
  beltColors?: [THREE.ColorRepresentation, THREE.ColorRepresentation];
  poleColor?: THREE.ColorRepresentation;
  /** Number of zone/belt pairs from pole to pole (about 5-9 looks Jupiter-like). */
  bands?: number;
  /** 0..1: band-edge eddies and wavy band boundaries. */
  turbulence?: number;
  storms?: GasGiantStorm[];
  /** Unit vector toward the sun in world space. */
  sunDirection?: THREE.Vector3;
  /** Thin forward-scattering haze at the day-side limb. */
  hazeColor?: THREE.ColorRepresentation; hazeStrength?: number;
  /** Halo shell radius factor (0 = none): a soft additive glow just outside the limb. */
  halo?: number;
}

/**
 * gas-giant-v1 — banded gas giant (Jupiter-like or a starless rogue lit by a nearby sun).
 * Latitude bands with wavy edges, sheared domain-warped turbulence and fine streaks, eddies at band boundaries,
 * storm ovals with swirls, hazy poles, limb darkening, a soft terminator and a day-side haze rim.
 * Deterministic: band flow and spin come from `update(time_s, rotation_rad)`; all looks are uniforms.
 * Place `group` anywhere; for a planet in a terrestrial sky, put it far away at its true angular size and set
 * `tint` for atmospheric extinction (reddening near the horizon).
 */
export class GasGiant {
  readonly group = new THREE.Group();
  /** Tilt this to orient the spin axis; the body spins about its local Y. */
  readonly body = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly halo?: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private haloMat?: THREE.ShaderMaterial;

  constructor(o: GasGiantOptions = {}) {
    const R = o.radius ?? 1, seg = o.segments ?? 160;
    const zones = (o.zoneColors ?? [0xe9e1cf, 0xcfd9e0]).map((c) => new THREE.Color(c));
    const belts = (o.beltColors ?? [0x6f7f95, 0x9a6f58]).map((c) => new THREE.Color(c));
    const storms = (o.storms ?? []).slice(0, 4);
    const stormU = Array.from({ length: 4 }, (_, i) => {
      const s = storms[i];
      return s ? new THREE.Vector4(THREE.MathUtils.degToRad(s.lat), THREE.MathUtils.degToRad(s.lon), THREE.MathUtils.degToRad(s.size), s.strength ?? 1) : new THREE.Vector4(0, 0, 0.1, 0);
    });
    const stormC = Array.from({ length: 4 }, (_, i) => new THREE.Color(storms[i]?.color ?? 0xffffff));
    const stormSpin = Array.from({ length: 4 }, (_, i) => storms[i]?.spin ?? 1);
    const sun = (o.sunDirection ?? new THREE.Vector3(1, 0.2, 0.4)).clone().normalize();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uSun: { value: sun }, uZoneA: { value: zones[0] }, uZoneB: { value: zones[1] }, uBeltA: { value: belts[0] }, uBeltB: { value: belts[1] },
        uPole: { value: new THREE.Color(o.poleColor ?? 0x7d8fa6) }, uHaze: { value: new THREE.Color(o.hazeColor ?? 0x9fc3ff) }, uHazeK: { value: o.hazeStrength ?? 0.35 },
        uBands: { value: o.bands ?? 7 }, uTurb: { value: o.turbulence ?? 0.6 }, uSeed: { value: o.seed ?? 3 }, uTime: { value: 0 },
        uStorm: { value: stormU }, uStormCol: { value: stormC }, uStormSpin: { value: stormSpin },
        uExposure: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uAmbient: { value: 0.004 }, uClipY: { value: -2 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        void main(){ vObj = normalize(position); vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uZoneA, uZoneB, uBeltA, uBeltB, uPole, uHaze, uTint;
        uniform float uBands, uTurb, uSeed, uTime, uHazeK, uExposure, uAmbient, uClipY;
        uniform vec4 uStorm[4]; uniform vec3 uStormCol[4]; uniform float uStormSpin[4];
        varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        ${GLSL_NOISE}
        const float PI = 3.14159265;
        // Alternating zonal jets: band flow speed (radians of longitude per unit time) by latitude.
        float jet(float lat){ return 0.6 * sin(lat * uBands * 2.0 + 0.4) + 0.25 * sin(lat * 3.0); }
        vec3 onSphere(float lon, float lat){ return vec3(cos(lon) * cos(lat), sin(lat), sin(lon) * cos(lat)); }
        void main(){
          if (normalize(vP - cameraPosition).y < uClipY) discard;
          vec3 p = normalize(vObj);
          float lat = asin(clamp(p.y, -1.0, 1.0)), lon = atan(p.z, p.x);
          float flowLon = lon + uTime * 0.02 * jet(lat);
          vec3 q = onSphere(flowLon, lat);
          float w1 = fbm3(q * 3.1 + uSeed);
          float w2 = fbm3(vec3(q.x * 5.0, q.y * 24.0, q.z * 5.0) + uSeed * 1.7);
          float latW = lat + uTurb * (0.055 * (w1 - 0.5) + 0.02 * (w2 - 0.5));
          float s = 0.62 * sin(latW * uBands * 2.0 + 0.8 * sin(latW * 3.1 + uSeed) + 0.35 * sin(latW * 7.3 + 1.1))
                  + 0.26 * sin(latW * uBands * 4.3 + 1.7 + uSeed) + 0.12 * sin(latW * uBands * 9.1 + 0.4);
          float zone = smoothstep(-0.45, 0.5, s + 0.18 * (w2 - 0.5));
          vec3 zoneC = mix(uZoneA, uZoneB, 0.5 + 0.5 * sin(latW * 2.3 + uSeed * 3.0));
          vec3 beltC = mix(uBeltA, uBeltB, smoothstep(0.25, 0.75, 0.5 + 0.5 * sin(latW * 4.1 + 1.3 + uSeed)));
          vec3 col = mix(beltC, zoneC, zone);
          // Fine streaks stretched along the bands, and festoons/eddies where zones meet belts.
          float streak = fbm3(vec3(q.x * 4.0, q.y * 95.0, q.z * 4.0) + uSeed * 2.3);
          col *= 0.86 + 0.28 * streak;
          col *= 0.9 + 0.2 * fbm3(vec3(q.x * 2.2, q.y * 11.0, q.z * 2.2) + uSeed * 4.1);   // belts darken and brighten along their length
          float edge = pow(1.0 - abs(s), 3.0);
          float eddy = fbm3(q * 15.0 + vec3(w1 * 3.0, w2 * 2.0, uSeed));
          col = mix(col, mix(beltC * 0.92, zoneC * 1.04, smoothstep(0.35, 0.65, eddy)), edge * uTurb * 0.7);
          // Storm ovals carried with their band, with a swirl of their own.
          for (int i = 0; i < 4; i++) {
            vec4 st = uStorm[i];
            if (st.w <= 0.0) continue;
            float slon = st.y + uTime * 0.02 * jet(st.x);
            float dl = mod(lon - slon + PI, 2.0 * PI) - PI;
            vec2 d = vec2(dl * cos(lat) / (st.z * 1.7), (lat - st.x) / st.z);
            float r = length(d);
            if (r > 1.4) continue;
            float ang = (1.0 - clamp(r, 0.0, 1.0)) * 4.0 * uStormSpin[i] + uTime * 0.05 * uStormSpin[i];
            vec2 sw = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;
            float swirl = fbm3(vec3(sw * 3.0, uSeed + float(i) * 7.0));
            float m = smoothstep(1.0, 0.45, r) * st.w;
            col = mix(col, uStormCol[i] * (0.78 + 0.44 * swirl), m);
            col = mix(col, beltC * 0.75, smoothstep(0.85, 1.0, r) * smoothstep(1.3, 1.0, r) * 0.55 * st.w);
          }
          // Hazy, less banded poles.
          col = mix(col, uPole * (0.9 + 0.2 * w1), smoothstep(1.0, 1.35, abs(lat)) * 0.85);
          vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
          float ndl = dot(N, uSun), mu0 = max(ndl, 0.0), mu = max(dot(N, V), 0.0);
          vec3 c = col * pow(mu0, 0.85) * (0.58 + 0.42 * pow(mu, 0.35));
          c += col * 0.05 * smoothstep(-0.08, 0.12, ndl) * (1.0 - mu0);   // light scattered just past the terminator
          c += uHaze * pow(1.0 - mu, 4.0) * smoothstep(-0.1, 0.5, ndl) * uHazeK;
          c += col * uAmbient;
          gl_FragColor = vec4(c * uExposure * uTint, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(R, seg, Math.round(seg * 0.6)), this.mat);
    this.body.add(this.mesh);
    this.group.add(this.body);
    if ((o.halo ?? 0) > 1) {
      const shell = R * (o.halo as number), edge = Math.sqrt(1 - (R / shell) ** 2);
      this.haloMat = new THREE.ShaderMaterial({
        side: THREE.BackSide, transparent: true, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        uniforms: { uSun: this.mat.uniforms.uSun, uColor: this.mat.uniforms.uHaze, uEdge: { value: edge }, uK: { value: 0.5 }, uExposure: this.mat.uniforms.uExposure, uTint: this.mat.uniforms.uTint },
        vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `uniform vec3 uSun, uColor, uTint; uniform float uEdge, uK, uExposure; varying vec3 vN; varying vec3 vP;
          void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
            float g = pow(clamp(-dot(N, V) / uEdge, 0.0, 1.0), 3.0);
            float lit = smoothstep(-0.3, 0.4, dot(N, uSun));
            gl_FragColor = vec4(uColor * g * lit * uK * uExposure * uTint, 1.0); }`,
      });
      this.halo = new THREE.Mesh(new THREE.SphereGeometry(shell, 64, 40), this.haloMat);
      this.group.add(this.halo);
    }
  }

  set sunDirection(v: THREE.Vector3) { (this.mat.uniforms.uSun.value as THREE.Vector3).copy(v).normalize(); }
  /** Overall brightness multiplier (scene exposure matching). */
  set exposure(v: number) { this.mat.uniforms.uExposure.value = v; }
  /** Colour multiplier, e.g. atmospheric extinction near a horizon. */
  set tint(c: THREE.Color) { (this.mat.uniforms.uTint.value as THREE.Color).copy(c); }
  set ambient(v: number) { this.mat.uniforms.uAmbient.value = v; }
  set hazeStrength(v: number) { this.mat.uniforms.uHazeK.value = v; }
  /** Sky use: hide fragments whose view direction lies below this elevation (radians), e.g. a sea horizon; null disables. */
  set horizonClip(elevation: number | null) { this.mat.uniforms.uClipY.value = elevation === null ? -2 : Math.sin(elevation); }
  /** Band flow from absolute time; `rotation` (radians) spins the body about its local Y axis. */
  update(time_s: number, rotation = 0) {
    this.mat.uniforms.uTime.value = time_s;
    this.mesh.rotation.y = rotation;
  }
}
