import * as THREE from 'three';
import type { EarthTextures } from './Earth';
import { GLSL_NOISE } from '../util/glsl';

/**
 * A region of today's map in degrees (longitude −180..180, latitude −90..90). `ragged` (degrees) roughens the cut
 * where the box edge crosses land, so a plate leaves a natural-looking coastline instead of a straight line.
 */
export interface PlateBox { lon: [number, number]; lat: [number, number]; ragged?: number }
/**
 * One moving plate: the land inside `boxes` (on today's map) rotates rigidly on the sphere toward its target.
 * Target either as an Euler pole + angle, or as "move reference point `from` to `to`, then turn `spin` degrees about `to`".
 */
export interface PlateSpec {
  name: string;
  boxes: PlateBox[];
  pole?: [number, number]; angle?: number;
  from?: [number, number]; to?: [number, number]; spin?: number;
}
export interface PlateDriftGlobeOptions {
  radius?: number;
  /** Unit vector toward the sun in world space. */
  sunDirection?: THREE.Vector3;
  /** Moving plates; land outside every plate stays fixed (default: a Pangaea-like set with Africa and Eurasia fixed). */
  plates?: PlateSpec[];
  /** Geographic point turned toward +Z (the camera side), in degrees. */
  viewLon?: number; viewLat?: number;
  oceanColor?: THREE.ColorRepresentation; deepColor?: THREE.ColorRepresentation;
  atmosphereColor?: THREE.ColorRepresentation; atmosphereStrength?: number;
  /** Strength of the sun's reflection on the ocean (default 1.5; lower it for close-ups). */
  glint?: number;
  /** Mid-ocean ridge drawn as a glowing line, as [lon, lat] points on today's map. */
  ridge?: [number, number][];
}

/** Pangaea-like arrangement relative to fixed Africa and Eurasia (schematic, not a reconstruction). */
// Euler poles fitted to matched coastlines, then refined on the land mask for snug seams with little overlap.
export const PANGAEA_PLATES: PlateSpec[] = [
  { name: 'north-america', boxes: [{ lon: [-170, -52], lat: [16.5, 84] }, { lon: [-118, -77.3], lat: [7, 16.5] }, { lon: [-75, -29], lat: [58, 84] }, { lon: [-29, -10], lat: [68, 84] }], pole: [-2.5, 67.3], angle: 65.5 },
  { name: 'south-america', boxes: [{ lon: [-82, -33], lat: [-57, 7] }, { lon: [-77.3, -55], lat: [7, 13] }], pole: [-32.9, 51.7], angle: 51.5 },
  { name: 'india', boxes: [{ lon: [68, 89], lat: [2, 30.5], ragged: 1.6 }, { lon: [89, 92.7], lat: [18, 28], ragged: 1.6 }], pole: [144, -36], angle: 37.8 },
  { name: 'australia', boxes: [{ lon: [112, 155], lat: [-44, -10.8] }, { lon: [130, 152], lat: [-11, -1] }], pole: [-71.5, -25.3], angle: 44.5 },
  { name: 'antarctica', boxes: [{ lon: [-180, 180], lat: [-90, -60] }], pole: [-32.9, -5], angle: 45.1 },
];
/** Mid-Atlantic Ridge on today's map (approximate). */
export const MID_ATLANTIC_RIDGE: [number, number][] = [
  [-17, 66], [-29, 52], [-31, 40], [-38, 30], [-45, 18], [-39, 10], [-24, 2], [-14, -8], [-13, -20], [-14, -32], [-16, -42], [-12, -52],
];

const D2R = Math.PI / 180;
/** Direction of a geographic point in the globe's object space (matches THREE.SphereGeometry UVs of an equirectangular map). */
export const geoDir = (lon: number, lat: number, out = new THREE.Vector3()) =>
  out.set(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lon * D2R));

const MAX_BOX = 16;
const PLATE_GLSL = /* glsl */ `
  uniform sampler2D tDay, tLand;
  uniform vec4 uInc[${MAX_BOX}]; uniform int uIncN; uniform vec4 uExc[${MAX_BOX}]; uniform int uExcN;
  uniform float uIncR[${MAX_BOX}], uExcR[${MAX_BOX}];
  uniform vec3 uSunDir, uDryCenter, uHeatCenter, uAtmoColor;
  uniform float uDry, uDryRadius, uHeat, uHeatRadius, uTime, uAtmo;
  varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  ${GLSL_NOISE}
  // b = (lon0, lon1, lat0, lat1) degrees, soft 0.6° edges; jit = noise offset in degrees of arc, scaled by the box's raggedness.
  float boxMask(vec2 ll, vec2 jit, vec4 b, float ragged){
    vec2 p = ll + jit * ragged * vec2(1.0 / max(cos(radians(ll.y)), 0.35), 1.0);
    float lonK = b.y - b.x >= 359.0 ? 1.0 : smoothstep(b.x - 0.6, b.x + 0.6, p.x) * smoothstep(b.y + 0.6, b.y - 0.6, p.x);
    return lonK * smoothstep(b.z - 0.6, b.z + 0.6, p.y) * smoothstep(b.w + 0.6, b.w - 0.6, p.y);
  }
  void main(){
    vec2 ll = vec2(vUv.x*360.0 - 180.0, vUv.y*180.0 - 90.0);
    // The same seamless noise offsets every box test, so the fixed land and the plates still tile exactly.
    vec3 g = vec3(cos(radians(ll.y))*cos(radians(ll.x)), sin(radians(ll.y)), -cos(radians(ll.y))*sin(radians(ll.x)));
    vec2 jit = 2.0 * vec2(fbm3(g*6.0) - 0.47, fbm3(g*6.0 + 17.0) - 0.47);
    float inc = 0.0, exc = 0.0;
    for (int i = 0; i < ${MAX_BOX}; i++) { if (i >= uIncN) break; inc = max(inc, boxMask(ll, jit, uInc[i], uIncR[i])); }
    for (int i = 0; i < ${MAX_BOX}; i++) { if (i >= uExcN) break; exc = max(exc, boxMask(ll, jit, uExc[i], uExcR[i])); }
    float a = smoothstep(0.32, 0.62, texture2D(tLand, vUv).r) * inc * (1.0 - exc);
    if (a < 0.02) discard;
    vec3 N = normalize(vN), V = normalize(cameraPosition - vP), dir = normalize(vP);
    vec3 albedo = texture2D(tDay, vUv).rgb;
    // Schematic overlays measured on the sphere in world space, so they follow the current arrangement.
    float dryK = uDry * smoothstep(uDryRadius, uDryRadius*0.4, acos(clamp(dot(dir, uDryCenter), -1.0, 1.0)));
    float n = vnoise(vUv*vec2(180.0, 90.0)) * 0.6 + vnoise(vUv*vec2(700.0, 350.0)) * 0.4;
    albedo = mix(albedo, mix(vec3(0.62, 0.38, 0.2), vec3(0.8, 0.6, 0.36), n), clamp(dryK, 0.0, 1.0) * 0.9);
    float heatK = uHeat * smoothstep(uHeatRadius, uHeatRadius*0.25, acos(clamp(dot(dir, uHeatCenter), -1.0, 1.0)));
    albedo = mix(albedo, mix(vec3(0.9, 0.32, 0.08), vec3(1.0, 0.7, 0.2), n), clamp(heatK, 0.0, 1.0) * 0.85);
    float ndl = dot(N, uSunDir), day = smoothstep(-0.12, 0.25, ndl);
    vec3 col = albedo * (0.025 + 1.35*max(ndl, 0.0));
    col += albedo * vec3(1.0, 0.45, 0.2) * smoothstep(-0.02, 0.12, ndl) * smoothstep(0.34, 0.1, ndl) * 0.2;
    col = mix(albedo * vec3(0.012, 0.016, 0.026), col, day);
    col += vec3(1.0, 0.35, 0.08) * heatK * (0.35 + 0.15*sin(uTime*2.0 + n*6.0)) * (0.35 + 0.65*day);   // heat glow
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    col += uAtmoColor * fres * (0.06 + 0.94*smoothstep(-0.15, 0.3, ndl)) * uAtmo * 0.8;
    gl_FragColor = vec4(col, a);
  }`;

/**
 * Earth whose continents drift as rigid plates: each plate is the NASA day map cut by the land mask inside its
 * boxes, drawn on its own sphere layer and rotated about an Euler pole from today's position (progress 0) to its
 * target arrangement (progress 1). Ocean sphere with sun glint, atmosphere rim, optional glowing ridge, and two
 * schematic overlays measured on the sphere (dry interior, heat). Deterministic: `setProgress` and `update(time_s)`.
 */
export class PlateDriftGlobe {
  readonly group = new THREE.Group();
  /** The globe frame (oriented by viewLon/viewLat); plates and ocean are its children. */
  readonly frame = new THREE.Group();
  readonly plates: { spec: PlateSpec; mesh: THREE.Mesh; target: THREE.Quaternion }[] = [];
  private fixed: THREE.Mesh;
  private oceanMat: THREE.ShaderMaterial; private atmoMat: THREE.ShaderMaterial;
  private shared: Record<string, THREE.IUniform>;
  private ridge?: THREE.Mesh;
  private _q = new THREE.Quaternion(); private _id = new THREE.Quaternion();

  constructor(tex: EarthTextures, o: PlateDriftGlobeOptions = {}) {
    const R = o.radius ?? 1, sun = (o.sunDirection ?? new THREE.Vector3(1, 0.3, 0.5)).clone().normalize();
    const atmo = new THREE.Color(o.atmosphereColor ?? 0x5aa2ff);
    this.shared = {
      tDay: { value: tex.day }, tLand: { value: tex.land }, uSunDir: { value: sun }, uTime: { value: 0 },
      uDry: { value: 0 }, uDryRadius: { value: 0.9 }, uDryCenter: { value: new THREE.Vector3(0, 0, 1) },
      uHeat: { value: 0 }, uHeatRadius: { value: 1.2 }, uHeatCenter: { value: new THREE.Vector3(0, 0, 1) },
      uAtmoColor: { value: atmo }, uAtmo: { value: o.atmosphereStrength ?? 1 },
    };
    const vert = /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
    // Ocean: deep water with gentle variation, sun glint and the same terminator and rim as the land.
    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: { ...this.shared, uOcean: { value: new THREE.Color(o.oceanColor ?? 0x0d3557) }, uDeep: { value: new THREE.Color(o.deepColor ?? 0x061a30) }, uGlint: { value: o.glint ?? 1.5 } },
      vertexShader: vert,
      fragmentShader: /* glsl */ `uniform vec3 uSunDir, uOcean, uDeep, uAtmoColor; uniform float uTime, uAtmo, uGlint; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
        ${GLSL_NOISE}
        void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vP); float ndl = dot(N, uSunDir), day = smoothstep(-0.12, 0.25, ndl);
          float n = fbm(vUv*vec2(24.0, 12.0) + uTime*0.002);
          vec3 water = mix(uDeep, uOcean, 0.55 + 0.45*n);
          vec3 H = normalize(V + uSunDir); float spec = pow(max(dot(N, H), 0.0), 110.0);
          vec3 col = water*(0.03 + 1.25*max(ndl, 0.0)) + vec3(1.0, 0.93, 0.82)*spec*uGlint;
          col = mix(water*vec3(0.01, 0.014, 0.024), col, day);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
          col += uAtmoColor*fres*(0.06 + 0.94*smoothstep(-0.15, 0.3, ndl))*uAtmo*0.9;
          gl_FragColor = vec4(col, 1.0); }`,
    });
    const ocean = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 108), this.oceanMat);
    this.frame.add(ocean);
    const plates = o.plates ?? PANGAEA_PLATES;
    const boxVec = (b: PlateBox) => new THREE.Vector4(b.lon[0], b.lon[1], b.lat[0], b.lat[1]);
    const layer = (inc: PlateBox[], exc: PlateBox[], k: number) => {
      const pad = (v: THREE.Vector4[]) => { while (v.length < MAX_BOX) v.push(new THREE.Vector4()); return v; };
      const rag = (b: PlateBox[]) => { const v = b.map((x) => x.ragged ?? 0); while (v.length < MAX_BOX) v.push(0); return v; };
      const mat = new THREE.ShaderMaterial({
        transparent: true, uniforms: { ...this.shared, uInc: { value: pad(inc.map(boxVec)) }, uIncN: { value: inc.length }, uExc: { value: pad(exc.map(boxVec)) }, uExcN: { value: exc.length }, uIncR: { value: rag(inc) }, uExcR: { value: rag(exc) } },
        vertexShader: vert, fragmentShader: PLATE_GLSL,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(R * (1 + 0.0015 * (k + 1)), 192, 128), mat);
      m.renderOrder = 2 + k; this.frame.add(m); return m;
    };
    const all = plates.flatMap((p) => p.boxes);
    this.fixed = layer([{ lon: [-200, 200], lat: [-100, 100] }], all, 0);
    plates.forEach((spec, i) => this.plates.push({ spec, mesh: layer(spec.boxes, [], i + 1), target: PlateDriftGlobe.targetRotation(spec) }));
    // Atmosphere shell (back faces, additive).
    const shellR = R * 1.035, edge = Math.sqrt(1 - (R / shellR) ** 2);
    this.atmoMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSunDir: this.shared.uSunDir, uColor: { value: atmo }, uStrength: this.shared.uAtmo, uEdge: { value: edge } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uSunDir, uColor; uniform float uStrength, uEdge; varying vec3 vN; varying vec3 vP;
        void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vP); float g = pow(clamp(-dot(N, V)/uEdge, 0.0, 1.0), 2.4);
          float lit = smoothstep(-0.35, 0.35, dot(N, uSunDir)); vec3 c = mix(vec3(1.0, 0.55, 0.3), uColor, smoothstep(0.0, 0.5, dot(N, uSunDir)));
          gl_FragColor = vec4(c*g*(0.03 + lit)*uStrength*1.6, g); }`,
    });
    this.group.add(this.frame, new THREE.Mesh(new THREE.SphereGeometry(shellR, 128, 96), this.atmoMat));
    if (o.ridge) {
      const pts = o.ridge.map(([lon, lat]) => geoDir(lon, lat).multiplyScalar(R * 1.0008));
      const curve = new THREE.CatmullRomCurve3(pts);
      this.ridge = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, R * 0.004, 8, false), new THREE.MeshBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.ridge.renderOrder = 20; this.frame.add(this.ridge);
    }
    this.setView(o.viewLon ?? 20, o.viewLat ?? 0);
  }

  /** Full rotation of a plate from today's position to its target arrangement. */
  static targetRotation(p: PlateSpec): THREE.Quaternion {
    if (p.pole) return new THREE.Quaternion().setFromAxisAngle(geoDir(p.pole[0], p.pole[1]), (p.angle ?? 0) * D2R);
    const a = geoDir(...(p.from ?? [0, 0])), b = geoDir(...(p.to ?? p.from ?? [0, 0]));
    const gc = new THREE.Quaternion().setFromUnitVectors(a, b), spin = new THREE.Quaternion().setFromAxisAngle(b, (p.spin ?? 0) * D2R);
    return spin.multiply(gc);
  }

  /** Turn a geographic point toward +Z (the camera side) with north up. */
  setView(lonDeg: number, latDeg: number) {
    const d = geoDir(lonDeg, latDeg), q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(0, 0, 1));
    this.frame.quaternion.copy(q);
    // Remove roll so the geographic north stays up.
    const north = new THREE.Vector3(0, 1, 0).applyQuaternion(q), ang = Math.atan2(north.x, north.y);
    this.frame.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang));
  }

  /** Drift progress: 0 = today's map, 1 = target arrangement; per-plate overrides by name. */
  setProgress(p: number, overrides: Record<string, number> = {}) {
    for (const plate of this.plates) {
      const k = overrides[plate.spec.name] ?? p;
      plate.mesh.quaternion.copy(this._q.copy(this._id).slerp(plate.target, Math.min(1, Math.max(0, k))));
    }
  }

  /** World-space direction of a geographic point on a given plate at its current rotation (or the fixed land). */
  pointOn(lon: number, lat: number, plate?: string, out = new THREE.Vector3()) {
    geoDir(lon, lat, out);
    const pl = plate ? this.plates.find((x) => x.spec.name === plate) : undefined;
    if (pl) out.applyQuaternion(pl.mesh.quaternion);
    return out.applyQuaternion(this.frame.quaternion);
  }

  set sunDirection(v: THREE.Vector3) { (this.shared.uSunDir.value as THREE.Vector3).copy(v).normalize(); }
  /** Dry-interior overlay: amount 0..1, centred on a world direction, angular radius in radians. */
  setDryness(amount: number, center: THREE.Vector3, radius = 0.9) { this.shared.uDry.value = amount; (this.shared.uDryCenter.value as THREE.Vector3).copy(center).normalize(); this.shared.uDryRadius.value = radius; }
  /** Heat overlay with a gentle glow: amount 0..1, centred on a world direction, angular radius in radians. */
  setHeat(amount: number, center: THREE.Vector3, radius = 1.2) { this.shared.uHeat.value = amount; (this.shared.uHeatCenter.value as THREE.Vector3).copy(center).normalize(); this.shared.uHeatRadius.value = radius; }
  set glint(v: number) { this.oceanMat.uniforms.uGlint.value = v; }
  set ridgeGlow(v: number) { if (this.ridge) { (this.ridge.material as THREE.MeshBasicMaterial).opacity = v; this.ridge.visible = v > 0.001; } }
  update(time_s: number) { this.shared.uTime.value = time_s; }
}
