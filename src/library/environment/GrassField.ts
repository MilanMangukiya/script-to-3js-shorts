import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { rng } from '../util/math';

export interface GrassFieldOptions {
  /** Footprint [xMin, xMax, zMin, zMax] in metres and blade count. */
  area?: [number, number, number, number]; count?: number;
  /** Ground height under a blade (world y) and an optional rejection test for gaps such as paths or a cliff edge. */
  ground?: (x: number, z: number) => number; reject?: (x: number, z: number) => boolean;
  /** Blade height range and base width in metres. */
  minHeight?: number; maxHeight?: number; width?: number;
  baseColor?: THREE.ColorRepresentation; tipColor?: THREE.ColorRepresentation; dryColor?: THREE.ColorRepresentation;
  /** Fraction of blades topped with a flower colour (e.g. sea thrift). */
  flowerFraction?: number; flowerColor?: THREE.ColorRepresentation;
  sunDirection?: THREE.Vector3; sunColor?: THREE.ColorRepresentation; skyColor?: THREE.ColorRepresentation;
  fogColor?: THREE.ColorRepresentation; fogDensity?: number;
  seed?: number;
}
export interface GrassWind {
  /** Bend from the wind at its mean, in radians at the blade tip (bend grows in proportion to the wind's push). */
  bend: number;
  /** Unit direction the wind blows toward, in the XZ plane. */
  direction: THREE.Vector2;
  /** Gust strength (0..1 of the mean bend) and gust travel speed (m/s). */
  gust?: number; gustSpeed?: number;
}

/**
 * Instanced grass blades with force-proportional wind bending, travelling gusts and flutter, lit with a wrap and
 * back-light term. `update(time_s, wind)` is deterministic; doubling `bend` shows a wind pushing twice as hard.
 */
export class GrassField {
  readonly mesh: THREE.InstancedMesh;
  private u: Record<string, THREE.IUniform>;

  constructor(o: GrassFieldOptions = {}) {
    const [x0, x1, z0, z1] = o.area ?? [-20, 20, -15, 15], n = o.count ?? 40000, r = rng(o.seed ?? 31);
    const ground = o.ground ?? (() => 0), reject = o.reject ?? (() => false);
    const blade = new THREE.PlaneGeometry(1, 1, 1, 6).translate(0, 0.5, 0);
    const offs = new Float32Array(n * 4), misc = new Float32Array(n * 4);
    let k = 0, guard = 0;
    const hMin = o.minHeight ?? 0.2, hMax = o.maxHeight ?? 0.55, ff = o.flowerFraction ?? 0.04;
    while (k < n && guard++ < n * 20) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      if (reject(x, z)) continue;
      const h = hMin + Math.pow(r(), 1.4) * (hMax - hMin);
      offs.set([x, ground(x, z), z, h], k * 4);
      misc.set([r() * Math.PI * 2, r(), r() < ff ? 1 : 0, (o.width ?? 0.012) * (0.7 + r() * 0.6)], k * 4);   // yaw, colour/phase seed, flower, width
      k++;
    }
    blade.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 4));
    blade.setAttribute('aMisc', new THREE.InstancedBufferAttribute(misc, 4));
    this.u = {
      uTime: { value: 0 }, uBend: { value: 0.25 }, uDir: { value: new THREE.Vector2(0, 1) }, uGust: { value: 0.35 }, uGustSpeed: { value: 4 },
      uBase: { value: new THREE.Color(o.baseColor ?? 0x2d3f1c) }, uTip: { value: new THREE.Color(o.tipColor ?? 0x8fa556) }, uDry: { value: new THREE.Color(o.dryColor ?? 0xb3a06a) },
      uFlower: { value: new THREE.Color(o.flowerColor ?? 0xe58fb4) },
      uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(0.4, 0.6, -0.5)).clone().normalize() }, uSunColor: { value: new THREE.Color(o.sunColor ?? 0xfff0d8) },
      uSky: { value: new THREE.Color(o.skyColor ?? 0x9cb8dc) }, uFogColor: { value: new THREE.Color(o.fogColor ?? 0xc9d3de) }, uFogDensity: { value: o.fogDensity ?? 0.004 },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, fog: false, uniforms: this.u,
      vertexShader: /* glsl */ `
        attribute vec4 aOff; attribute vec4 aMisc;
        uniform float uTime, uBend, uGust, uGustSpeed; uniform vec2 uDir;
        varying float vV; varying float vSeed; varying float vFlower; varying vec3 vP; varying vec3 vN;
        ${GLSL_NOISE}
        void main(){
          float v = position.y, h = aOff.w, yaw = aMisc.x;
          vV = v; vSeed = aMisc.y; vFlower = aMisc.z;
          float w = aMisc.w * (1.0 - pow(v, 1.6)) * (1.0 + aMisc.z*0.6*smoothstep(0.8, 1.0, v));
          vec2 base = aOff.xz;
          // Gusts travel downwind; flutter is fast and small.
          float g = vnoise((base - uDir*uTime*uGustSpeed) * 0.22) * 0.75 + vnoise((base - uDir*uTime*uGustSpeed*1.3) * 0.7) * 0.25;
          float bend = uBend * (1.0 + uGust * (g*2.0 - 1.0)) * (0.75 + 0.5*aMisc.y) + 0.04 * sin(uTime*(5.0 + aMisc.y*3.0) + aMisc.y*40.0);
          // Bend along a circular arc toward the wind direction.
          float th = bend * v;
          float along = bend > 1e-3 ? h * (1.0 - cos(th)) / bend : 0.0;
          float up = bend > 1e-3 ? h * sin(th) / bend : h * v;
          vec2 side = vec2(cos(yaw), sin(yaw)) * position.x * w;
          vec3 p = vec3(base.x + side.x + uDir.x*along, aOff.y + up, base.y + side.y + uDir.y*along);
          // Blade normal: perpendicular to the blade's tangent and its width direction.
          vec3 tng = normalize(vec3(uDir.x*sin(th), cos(th), uDir.y*sin(th)));
          vec3 wd = normalize(vec3(cos(yaw), 0.0, sin(yaw)));
          vN = normalize(cross(wd, tng));
          vec4 world = modelMatrix * vec4(p, 1.0); vP = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBase, uTip, uDry, uFlower, uSunDir, uSunColor, uSky, uFogColor; uniform float uFogDensity;
        varying float vV; varying float vSeed; varying float vFlower; varying vec3 vP; varying vec3 vN;
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vP);
          if (dot(N, V) < 0.0) N = -N;
          vec3 col = mix(uBase, uTip, smoothstep(0.0, 1.0, vV));
          col = mix(col, uDry, smoothstep(0.55, 1.0, vSeed) * 0.55 * vV);
          col = mix(col, uFlower, vFlower * smoothstep(0.78, 0.9, vV));
          float diff = max(dot(N, uSunDir), 0.0) * 0.6 + 0.4 * (dot(N, uSunDir) * 0.5 + 0.5);
          float back = pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.7 * vV;
          vec3 lit = col * (uSky * 0.45 * (0.55 + 0.45*vV) + uSunColor * (diff * 1.05 + back));
          float dist = length(cameraPosition - vP);
          float f = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist);
          gl_FragColor = vec4(mix(lit, uFogColor, clamp(f, 0.0, 1.0)), 1.0);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(blade, mat, k);
    this.mesh.frustumCulled = false;
  }

  /** Re-colour lighting for a different time of day (e.g. sunset) without rebuilding the blades. */
  setLight(sunDirection: THREE.Vector3, sunColor: THREE.ColorRepresentation, skyColor: THREE.ColorRepresentation, fogColor?: THREE.ColorRepresentation) {
    this.u.uSunDir.value.copy(sunDirection).normalize(); this.u.uSunColor.value.set(sunColor); this.u.uSky.value.set(skyColor);
    if (fogColor !== undefined) this.u.uFogColor.value.set(fogColor);
  }

  update(time_s: number, wind: GrassWind) {
    this.u.uTime.value = time_s; this.u.uBend.value = wind.bend; this.u.uDir.value.copy(wind.direction).normalize();
    this.u.uGust.value = wind.gust ?? 0.35; this.u.uGustSpeed.value = wind.gustSpeed ?? 4;
  }
}
