import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface RockyPlanetOptions {
  radius?: number; seed?: number;
  /** Dark plains, mid terrain and bright highlands (Mars-like rust by default). */
  palette?: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation];
  /** 0..1 crater density. */
  craters?: number;
  /** Polar cap extent (0 = none, 0.15 = small caps) and colour. */
  capSize?: number; capColor?: THREE.ColorRepresentation;
  /** Thin atmosphere rim colour and strength (0 = airless). */
  atmosphereColor?: THREE.ColorRepresentation; atmosphereStrength?: number;
  sunDirection?: THREE.Vector3;
}

/**
 * Procedural rocky planet (Mars-like by default): seamless 3D-noise terrain colours, dark plains, crater rims,
 * polar caps and a thin haze rim, lit by one sun. Spin with `group.rotation`; deterministic, no textures.
 */
export class RockyPlanet {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;

  constructor(o: RockyPlanetOptions = {}) {
    const [a, b, c] = o.palette ?? [0x5a2a18, 0xa4532c, 0xd08a55];
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uC: { value: new THREE.Color(c) }, uCap: { value: new THREE.Color(o.capColor ?? 0xf2ede6) },
        uCapSize: { value: o.capSize ?? 0.12 }, uCraters: { value: o.craters ?? 0.6 }, uSeed: { value: o.seed ?? 4 },
        uAtmo: { value: new THREE.Color(o.atmosphereColor ?? 0xe0a070) }, uAtmoK: { value: o.atmosphereStrength ?? 0.5 },
        uSun: { value: (o.sunDirection ?? new THREE.Vector3(-1, 0.2, 0.4)).clone().normalize() },
      },
      vertexShader: /* glsl */ `varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        void main(){ vObj = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uA, uB, uC, uCap, uAtmo, uSun; uniform float uCapSize, uCraters, uSeed, uAtmoK; varying vec3 vObj; varying vec3 vN; varying vec3 vP;
        ${GLSL_NOISE}
        // Crater field: distance to the nearest seeded crater centre on a 3D lattice gives bowls and bright rims.
        float craterField(vec3 p, float scale){
          vec3 i = floor(p * scale), f = fract(p * scale); float best = 0.0;
          for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec3 g = vec3(float(x), float(y), float(z)), cell = i + g;
            float h = hash31(cell + uSeed); if (h > uCraters) continue;
            vec3 o = vec3(hash31(cell + 1.7), hash31(cell + 5.3), hash31(cell + 9.1));
            float rad = 0.18 + 0.3 * hash31(cell + 3.9), d = length(g + o - f) / rad;
            best += smoothstep(1.15, 1.0, d) * smoothstep(0.8, 1.0, d) * 0.9 - smoothstep(1.0, 0.0, d) * 0.35;
          }
          return best;
        }
        void main(){
          vec3 p = vObj + uSeed * 0.13;
          float big = fbm3(p * 1.6), mid = fbm3(p * 5.0 + 3.1);
          vec3 alb = mix(uA, uB, smoothstep(0.38, 0.6, big));
          alb = mix(alb, uC, smoothstep(0.55, 0.75, mid) * 0.55);
          float cr = craterField(vObj, 7.0) + 0.6 * craterField(vObj, 17.0);
          alb *= 1.0 + cr * 0.25;
          float cap = smoothstep(1.0 - uCapSize, 1.0 - uCapSize + 0.03, abs(vObj.y) + (fbm3(p * 8.0) - 0.5) * 0.05);
          alb = mix(alb, uCap, cap);
          vec3 N = normalize(vN), V = normalize(cameraPosition - vP); float ndl = dot(N, uSun);
          vec3 col = alb * (0.025 + 1.25 * max(ndl, 0.0));
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.5);
          col += uAtmo * fres * smoothstep(-0.1, 0.4, ndl) * uAtmoK;
          gl_FragColor = vec4(col, 1.0); }`,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(o.radius ?? 1, 160, 112), this.mat));
  }

  set sunDirection(v: THREE.Vector3) { (this.mat.uniforms.uSun.value as THREE.Vector3).copy(v).normalize(); }
}
