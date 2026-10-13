import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface OvercastShellOptions {
  /** Shell radius in scene units (use about 1.006 × the planet radius) and feature frequency on the unit sphere. */
  radius?: number; scale?: number;
  /** 0 = no extra cloud, 0.5 = broken cloud, 1 = one unbroken overcast deck. */
  coverage?: number;
  color?: THREE.ColorRepresentation; shadowColor?: THREE.ColorRepresentation;
  /** Unit vector toward the sun in world space. */
  sunDirection?: THREE.Vector3;
  seed?: number;
}

/**
 * Planet-wide cloud shell for "clouds everywhere" scenarios: a sphere of animated fractal cloud whose `coverage`
 * grows from scattered patches to a seamless overcast, sunlit by day with soft billow shading and dark by night.
 * Place it in the same group as the planet (it does not spin with the globe; clouds drift with `update`).
 */
export class OvercastShell {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;

  constructor(o: OvercastShellOptions = {}) {
    this.u = {
      uTime: { value: 0 }, uCoverage: { value: o.coverage ?? 0 }, uScale: { value: o.scale ?? 3.2 }, uSeed: { value: o.seed ?? 2 },
      uColor: { value: new THREE.Color(o.color ?? 0xe4e7eb) }, uShadow: { value: new THREE.Color(o.shadowColor ?? 0x6f7d90) },
      uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(1, 0.3, 0.5)).clone().normalize() },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: this.u,
      vertexShader: /* glsl */ `varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        void main(){ vObj = normalize(position); vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uCoverage, uScale, uSeed; uniform vec3 uColor, uShadow, uSunDir;
        varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        ${GLSL_NOISE}
        void main(){
          vec3 q = vObj*uScale + vec3(uSeed, uTime*0.004, -uTime*0.003);
          q += (vec3(fbm3(q*0.8 + 2.0), fbm3(q*0.8 + 7.0), fbm3(q*0.8 + 11.0)) - 0.5)*0.9;
          float d = fbm3(q)*0.75 + fbm3(q*3.7 + 5.0)*0.25;
          float th = mix(0.95, -0.25, uCoverage);
          float cover = smoothstep(th, th + 0.18, d);
          if (cover < 0.004) discard;
          vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
          float ndl = dot(N, uSunDir);
          float billow = smoothstep(0.25, 0.85, d);
          float lit = clamp(ndl*0.85 + 0.15, 0.0, 1.0);
          float detail = fbm3(q*9.0 + 3.0);
          vec3 col = mix(uShadow, uColor, 0.25 + 0.6*billow + 0.15*detail)*(0.04 + 1.25*lit);
          col *= mix(1.0, 0.82, pow(1.0 - max(dot(N, V), 0.0), 2.0));
          gl_FragColor = vec4(col, cover);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(o.radius ?? 1.006, 160, 112), mat);
    this.mesh.renderOrder = 2;
  }

  set coverage(v: number) { this.u.uCoverage.value = v; this.mesh.visible = v > 0.001; }
  set sunDirection(v: THREE.Vector3) { this.u.uSunDir.value.copy(v).normalize(); }
  /** @param time_s absolute film time (slow drift of the cloud pattern). */
  update(time_s: number) { this.u.uTime.value = time_s; }
}
