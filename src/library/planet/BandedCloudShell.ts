import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface BandedCloudShellOptions {
  /** Shell radius (≈1.008 × planet radius) and oblateness matching the planet. */
  radius?: number; flattening?: number;
  /** Cloud belts from the equator to each pole (Earth-like ≈ 3; faster spin → more, narrower belts). */
  bandCount?: number;
  /** Typical storm (vortex) radius in radians on the unit sphere, and the fraction of lattice cells holding one. */
  stormSize?: number; stormDensity?: number;
  /** 0..1 overall cloud amount. */
  coverage?: number;
  color?: THREE.ColorRepresentation; shadowColor?: THREE.ColorRepresentation;
  sunDirection?: THREE.Vector3;
  seed?: number;
}

/**
 * Transparent planetary cloud layer organised by rotation: zonal cloud belts with sheared streaks plus a lattice of
 * small spiral storms (counter-clockwise in the north, clockwise in the south). Band count and storm size are the
 * knobs for slow- versus fast-rotating worlds; illustrative, not a weather model. `update(time_s)` drifts bands
 * east/west and spins storms deterministically; `spin` (radians) turns the whole layer with its planet.
 */
export class BandedCloudShell {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;

  constructor(o: BandedCloudShellOptions = {}) {
    this.u = {
      uTime: { value: 0 }, uSpin: { value: 0 }, uBands: { value: o.bandCount ?? 3 }, uStorm: { value: o.stormSize ?? 0.12 },
      uDensity: { value: o.stormDensity ?? 0.5 }, uCoverage: { value: o.coverage ?? 0.6 }, uSeed: { value: o.seed ?? 5 },
      uColor: { value: new THREE.Color(o.color ?? 0xf2f4f6) }, uShadow: { value: new THREE.Color(o.shadowColor ?? 0x7f8b99) },
      uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(1, 0.3, 0.5)).clone().normalize() },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: this.u,
      vertexShader: /* glsl */ `varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        void main(){ vObj = normalize(position); vN = normalize((vec4(normalMatrix*normal, 0.0)*viewMatrix).xyz);
          vec4 w = modelMatrix*vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uSpin, uBands, uStorm, uDensity, uCoverage, uSeed; uniform vec3 uColor, uShadow, uSunDir;
        varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        ${GLSL_NOISE}
        vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z); }
        // Nearest seeded vortex on a 3D lattice: returns (spiral cloud amount, falloff). Arms follow a logarithmic
        // spiral (θ − 2.2 ln r), counter-clockwise in the north and clockwise in the south.
        vec2 storms(vec3 p){
          float scale = 1.0/uStorm; vec3 i = floor(p*scale); vec2 best = vec2(0.0);
          for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec3 cell = i + vec3(float(x), float(y), float(z));
            if (hash31(cell + uSeed) > uDensity) continue;
            vec3 c = normalize((cell + vec3(hash31(cell + 1.3), hash31(cell + 4.7), hash31(cell + 8.9)))/scale);
            float d = acos(clamp(dot(c, p), -1.0, 1.0)), rr = uStorm*(0.6 + 0.5*hash31(cell + 2.2));
            if (d > rr) continue;
            vec3 t1 = normalize(cross(vec3(0.0, 1.0, 0.0), c) + 1e-5), t2 = cross(c, t1);
            vec3 dp = p - c; float ang = atan(dot(dp, t2), dot(dp, t1));
            float sense = c.y >= 0.0 ? 1.0 : -1.0, k = d/rr;
            float arm = 0.5 + 0.5*sin(ang*sense*2.0 - log(k + 0.04)*2.2*2.0 + uTime*0.8 + hash31(cell)*6.28);
            float fall = smoothstep(1.0, 0.25, k)*smoothstep(0.02, 0.09, k);   // clear eye at the centre
            best = max(best, vec2(fall*(0.5 + 0.5*arm), fall));
          }
          return best;
        }
        void main(){
          float lat = asin(clamp(vObj.y, -1.0, 1.0));
          float period = 1.5708/uBands;                                   // latitude spacing of cloud belts
          float jet = sin(lat*6.28318/period);
          vec3 p = rotY(vObj, uSpin + uTime*0.012*jet);                  // neighbouring bands shear east/west (grows with time)
          vec3 w = vec3(fbm3(p*2.2 + 1.3), fbm3(p*2.2 + 5.1), fbm3(p*2.2 + 9.7)) - 0.5;
          // Where clouds gather: latitude belts broken into clusters; what they look like: isotropic, domain-warped puffs.
          float belt = smoothstep(0.35, 0.95, 0.5 + 0.5*cos(lat*6.28318/period + w.x*1.2));
          float gather = belt*(0.55 + 0.6*fbm3(p*vec3(2.5, 4.0, 2.5) + w*1.5 + uSeed));
          float puff = fbm3(p*6.0 + w*1.4 + uSeed*1.7)*0.85 + fbm3(p*12.0 + w)*0.15;
          vec2 st = storms(p);
          float d = max(gather*(0.45 + 0.75*puff), st.x*(0.7 + 0.45*puff)*mix(0.3, 1.0, belt));   // storms ride the cloud belts
          d *= smoothstep(1.52, 1.3, abs(lat));
          float th = mix(0.78, 0.3, uCoverage);
          float cover = smoothstep(th, th + 0.3, d);
          if (cover < 0.004) discard;
          vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
          float ndl = dot(N, uSunDir);
          float lit = clamp(ndl*0.9 + 0.1, 0.0, 1.0);
          vec3 col = mix(uShadow, uColor, 0.4 + 0.6*smoothstep(th, th + 0.45, d))*(0.03 + 1.3*lit);
          gl_FragColor = vec4(col, cover*smoothstep(-0.25, 0.05, ndl)*0.97 + cover*0.03);
        }`,
    });
    const f = o.flattening ?? 0, a = Math.pow(1 - f, -1 / 3);
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(o.radius ?? 1.008, 192, 128), mat);
    this.mesh.scale.set(a, (1 - f) * a, a);
    this.mesh.renderOrder = 2;
  }

  set coverage(v: number) { this.u.uCoverage.value = v; this.mesh.visible = v > 0.001; }
  set sunDirection(v: THREE.Vector3) { (this.u.uSunDir.value as THREE.Vector3).copy(v).normalize(); }
  /** Turn the whole layer with its planet (radians about the shell's +Y axis). */
  set spin(a: number) { this.u.uSpin.value = a; }
  /** @param time_s seconds since the layer appeared (band shear accumulates, so pass shot-relative time) — storm rotation too. */
  update(time_s: number) { this.u.uTime.value = time_s; }
}
