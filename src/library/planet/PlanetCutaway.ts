import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

/** Layer outer radii as fractions of the planet radius (the mantle fills outerCore..crust; the crust runs crust..1). */
export interface PlanetLayers { innerCore: number; outerCore: number; crust: number }
export interface PlanetCutawayColors {
  innerCore: THREE.ColorRepresentation; outerHot: THREE.ColorRepresentation; outerCool: THREE.ColorRepresentation;
  frozen: THREE.ColorRepresentation; mantleDeep: THREE.ColorRepresentation; mantleTop: THREE.ColorRepresentation; crust: THREE.ColorRepresentation;
}
export interface PlanetCutawayOptions {
  radius?: number;
  /** Equirectangular surface map (e.g. the NASA day map); a flat colour is used without it. */
  surface?: THREE.Texture; surfaceColor?: THREE.ColorRepresentation;
  /** Defaults are Earth's: inner core 1,221 km, core–mantle boundary 3,480 km, crust ~35 km (of 6,371 km). */
  layers?: Partial<PlanetLayers>;
  colors?: Partial<PlanetCutawayColors>;
  /** Unit vector toward the sun in world space. */
  sunDirection?: THREE.Vector3;
  atmosphereColor?: THREE.ColorRepresentation; atmosphereStrength?: number;
}

const EARTH_LAYERS: PlanetLayers = { innerCore: 1221 / 6371, outerCore: 3480 / 6371, crust: 1 - 35 / 6371 };
const DEFAULT_COLORS: PlanetCutawayColors = {
  innerCore: 0xffe2a0, outerHot: 0xffb347, outerCool: 0xb3260a, frozen: 0x474b53, mantleDeep: 0xa83a14, mantleTop: 0x36140b, crust: 0x6b5a4a,
};

const FACE_GLSL = /* glsl */ `
  uniform vec3 uInner, uOuterHot, uOuterCool, uFrozen, uMantleDeep, uMantleTop, uCrust;
  uniform float uR, uRi, uRo, uRc, uSolid, uFreeze, uFlow, uTime, uGlow, uPulse;
  varying vec3 vObj;
  ${GLSL_NOISE}
  // Cellular noise: distance to the nearest and second-nearest feature point, and the nearest cell's id.
  vec3 cells(vec2 p){
    vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y)), o = vec2(hash21(i + g), hash21(i + g + 19.7));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; id = hash21(i + g + 3.3); } else if (d < d2) d2 = d;
    }
    return vec3(d1, d2, id);
  }
  float ring(float r, float at, float w){ return 1.0 - smoothstep(0.0, w, abs(r - at)); }
  void main(){
    // Both cut faces share in-plane coordinates: distance from the polar axis and height.
    vec2 q = vec2(length(vObj.xz), vObj.y) / uR;
    float r = length(q);
    if (r > 1.0) discard;
    vec3 col;
    float front = uFreeze + uSolid * (uRo - uFreeze);   // radius reached by the freezing front
    if (r < uFreeze) {
      // Solid inner core: hot pale-gold crystals.
      vec3 c = cells(q * 34.0);
      col = uInner * (0.78 + 0.32 * c.z) * (1.0 - 0.35 * smoothstep(0.06, 0.0, c.y - c.x));
      col *= 0.92 + 0.12 * smoothstep(uFreeze, 0.0, r);
    } else if (r < uRo) {
      // Liquid outer core: domain-warped flow drifting around the axis.
      float t = uTime;
      float ang = atan(q.y, q.x) + t * 0.04 * (1.0 - r);
      vec2 p = vec2(cos(ang), sin(ang)) * r * 5.0;
      vec2 w = vec2(fbm(p * 0.9 + vec2(t * 0.11, -t * 0.07)), fbm(p * 0.9 + vec2(-t * 0.09, t * 0.12) + 7.3));
      float f = fbm(p + w * 2.2 + vec2(t * 0.05, 0.0));
      vec3 liquid = mix(uOuterCool, uOuterHot, smoothstep(0.32, 0.78, f));
      liquid += uOuterHot * pow(smoothstep(0.62, 0.9, f), 2.0) * 0.6;
      // Frozen iron: dark crystals with a dull red glow along the grain boundaries (still thousands of degrees).
      vec3 c = cells(q * 26.0);
      float crack = smoothstep(0.08, 0.0, c.y - c.x);
      vec3 frozen = uFrozen * (0.65 + 0.5 * c.z) + uOuterCool * crack * 0.55;
      float solid = smoothstep(front + 0.004, front - 0.004, r) * step(0.001, uSolid);
      col = mix(liquid, frozen, solid);
      col += vec3(1.0, 0.85, 0.6) * ring(r, front, 0.012) * step(0.001, uSolid) * (1.0 - step(0.999, uSolid)) * 1.4;   // crystallising edge
    } else if (r < uRc) {
      // Mantle: hot at the bottom, dark near the crust, mottled; optional convection loops.
      float k = (r - uRo) / (uRc - uRo);
      float m = fbm(q * 9.0 + 3.1);
      col = mix(uMantleDeep, uMantleTop, smoothstep(0.0, 0.85, k)) * (0.68 + 0.36 * m);
      if (uFlow > 0.001) {
        float phi = atan(q.y, q.x);                    // -pi/2 .. pi/2 across the half disc
        float n = 4.0, cell = floor((phi + 1.5708) / 3.14159 * n), eta = fract((phi + 1.5708) / 3.14159 * n);
        float psi = sin(3.14159 * k) * sin(3.14159 * eta);
        float lines = smoothstep(0.12, 0.0, abs(fract(psi * 3.0 + 0.5) - 0.5)) * smoothstep(0.08, 0.2, psi) * step(psi, 0.97);
        float dir = mod(cell, 2.0) < 0.5 ? 1.0 : -1.0;
        float th = atan(eta - 0.5, k - 0.5);
        float dash = smoothstep(0.35, 0.75, fract(th / 6.28318 * 5.0 - dir * uTime * 0.22));
        col += vec3(1.0, 0.62, 0.25) * lines * dash * uFlow * 0.9;
      }
    } else {
      col = uCrust * (0.85 + 0.3 * vnoise(q * 80.0));
    }
    // Thin boundary lines between layers.
    float lw = 0.0035;
    col = mix(col, vec3(1.0, 0.86, 0.62), ring(r, uRi, lw) * 0.55 * (0.6 + 0.4 * uPulse));
    col = mix(col, vec3(1.0, 0.86, 0.62), ring(r, uRo, lw) * 0.5);
    col = mix(col, vec3(0.08, 0.05, 0.04), ring(r, uRc, lw) * 0.6);
    col += vec3(1.0, 0.8, 0.45) * ring(r, uRi, 0.02) * uPulse * 0.8;   // growing inner-core edge highlight
    gl_FragColor = vec4(col * uGlow, 1.0);
  }`;

/**
 * A planet with a quarter wedge (object-space x > 0, z > 0) cut away to the centre: a lit surface shell plus two flat
 * cut faces showing the layers at true radii (crust, mantle with optional convection loops, molten outer core with a
 * freezing front, crystalline inner core). Turn the group to aim the wedge. Deterministic: setters + update(time_s).
 */
export class PlanetCutaway {
  readonly group = new THREE.Group();
  readonly layers: PlanetLayers;
  readonly radius: number;
  private surfaceMat: THREE.ShaderMaterial; private faceMat: THREE.ShaderMaterial; private haloMat: THREE.ShaderMaterial;

  constructor(o: PlanetCutawayOptions = {}) {
    const R = (this.radius = o.radius ?? 1), L = (this.layers = { ...EARTH_LAYERS, ...o.layers }), C = { ...DEFAULT_COLORS, ...o.colors };
    const sun = (o.sunDirection ?? new THREE.Vector3(1, 0.4, 0.6)).clone().normalize(), atmo = new THREE.Color(o.atmosphereColor ?? 0x5aa2ff);
    const shared = { uSun: { value: sun }, uAtmo: { value: atmo }, uAtmoK: { value: o.atmosphereStrength ?? 1 } };
    this.surfaceMat = new THREE.ShaderMaterial({
      uniforms: { ...shared, tSurface: { value: o.surface ?? null }, uHasTex: { value: o.surface ? 1 : 0 }, uColor: { value: new THREE.Color(o.surfaceColor ?? 0x3a6a8a) }, uSpin: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        void main(){ vUv = uv; vObj = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform sampler2D tSurface; uniform float uHasTex, uSpin, uAtmoK; uniform vec3 uColor, uSun, uAtmo;
        varying vec2 vUv; varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        void main(){
          if (vObj.x > 0.0 && vObj.z > 0.0) discard;
          vec3 alb = uHasTex > 0.5 ? texture2D(tSurface, vec2(fract(vUv.x - uSpin / 6.28318), vUv.y)).rgb : uColor;
          vec3 N = normalize(vN), V = normalize(cameraPosition - vP); float ndl = dot(N, uSun);
          vec3 col = alb * (0.035 + 1.3 * max(ndl, 0.0));
          col += alb * vec3(1.0, 0.45, 0.2) * smoothstep(-0.02, 0.12, ndl) * smoothstep(0.34, 0.1, ndl) * 0.18;
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col += uAtmo * fres * (0.05 + 0.95 * smoothstep(-0.15, 0.3, ndl)) * uAtmoK * 0.8;
          gl_FragColor = vec4(col, 1.0); }`,
    });
    const surface = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 112), this.surfaceMat);
    this.faceMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uInner: { value: new THREE.Color(C.innerCore) }, uOuterHot: { value: new THREE.Color(C.outerHot) }, uOuterCool: { value: new THREE.Color(C.outerCool) },
        uFrozen: { value: new THREE.Color(C.frozen) }, uMantleDeep: { value: new THREE.Color(C.mantleDeep) }, uMantleTop: { value: new THREE.Color(C.mantleTop) }, uCrust: { value: new THREE.Color(C.crust) },
        uR: { value: R }, uRi: { value: L.innerCore }, uRo: { value: L.outerCore }, uRc: { value: L.crust },
        uSolid: { value: 0 }, uFreeze: { value: L.innerCore }, uFlow: { value: 0 }, uTime: { value: 0 }, uGlow: { value: 1 }, uPulse: { value: 0 },
      },
      vertexShader: /* glsl */ `varying vec3 vObj; void main(){ vObj = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,   // geometry space = the cutaway frame
      fragmentShader: FACE_GLSL,
    });
    // Two half discs closing the wedge: plane x = 0 (z >= 0, facing +X) and plane z = 0 (x >= 0, facing +Z).
    const faceX = new THREE.Mesh(new THREE.CircleGeometry(R, 160, Math.PI / 2, Math.PI).rotateY(Math.PI / 2), this.faceMat);
    const faceZ = new THREE.Mesh(new THREE.CircleGeometry(R, 160, -Math.PI / 2, Math.PI), this.faceMat);
    const inner = new THREE.Group(); inner.add(surface, faceX, faceZ);
    // Face positions are measured in the cutaway's own frame: keep a dedicated child so world transforms stay external.
    this.frame.add(inner);
    // Atmosphere halo (back faces, additive).
    const shellR = R * 1.035, edge = Math.sqrt(1 - (R / shellR) ** 2);
    this.haloMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...shared, uEdge: { value: edge } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uSun, uAtmo; uniform float uAtmoK, uEdge; varying vec3 vN; varying vec3 vP;
        void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vP); float g = pow(clamp(-dot(N, V) / uEdge, 0.0, 1.0), 2.4);
          float lit = smoothstep(-0.35, 0.35, dot(N, uSun)); gl_FragColor = vec4(uAtmo * g * (0.03 + lit) * uAtmoK * 1.5, g); }`,
    });
    this.frame.add(new THREE.Mesh(new THREE.SphereGeometry(shellR, 128, 96), this.haloMat));
    this.group.add(this.frame);
  }

  /** The cutaway's own frame (rotate `group` in a scene; positions on the faces are in this frame). */
  readonly frame = new THREE.Group();

  /** 0 = molten outer core, 1 = frozen solid (a front sweeps outward from the inner core). */
  set outerCoreSolid(v: number) { this.faceMat.uniforms.uSolid.value = Math.min(1, Math.max(0, v)); }
  /** Radius (fraction of the planet) of the solid inner core; defaults to the layer value. */
  set freezeRadius(v: number) { this.faceMat.uniforms.uFreeze.value = v; }
  /** 0..1 visibility of animated mantle convection loops. */
  set mantleFlow(v: number) { this.faceMat.uniforms.uFlow.value = v; }
  /** 0..1 highlight on the inner-core boundary (e.g. to show it growing). */
  set innerEdgePulse(v: number) { this.faceMat.uniforms.uPulse.value = v; }
  /** Brightness multiplier of the cut faces. */
  set glow(v: number) { this.faceMat.uniforms.uGlow.value = v; }
  /** Surface map rotation in radians (the wedge stays in place). */
  set spin(v: number) { this.surfaceMat.uniforms.uSpin.value = v; }
  set sunDirection(v: THREE.Vector3) { (this.surfaceMat.uniforms.uSun.value as THREE.Vector3).copy(v).normalize(); }
  /** World position of a point given in the cutaway's frame (e.g. on a cut face) for labels. */
  pointOn(local: THREE.Vector3, out = new THREE.Vector3()) { return out.copy(local).applyMatrix4(this.frame.matrixWorld); }
  update(time_s: number) { this.faceMat.uniforms.uTime.value = time_s; this.group.updateMatrixWorld(true); }
}
