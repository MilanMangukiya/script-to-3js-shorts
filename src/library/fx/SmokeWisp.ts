import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface SmokeWispOptions {
  /** Full ribbon height and base/top widths in scene units. */
  height: number; baseWidth: number; topWidth: number;
  /** Lateral curl amplitude at the top, in scene units. */
  curl?: number;
  /** Rise speed in scene units per second (how fast the wisp front climbs). */
  riseSpeed?: number;
  color?: THREE.ColorRepresentation; seed?: number; opacity?: number;
}

/**
 * Thin rising smoke ribbon (camera-facing about Y). `update(time_s, age_s, opacity)`:
 * age_s is the time since the smoke started; the wisp front climbs with age and the whole ribbon drifts and curls.
 */
export class SmokeWisp {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private _w = new THREE.Vector3(); private _c = new THREE.Vector3();

  constructor(o: SmokeWispOptions) {
    const geo = new THREE.PlaneGeometry(1, o.height, 4, 64);
    geo.translate(0, o.height / 2, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: {
        uTime: { value: 0 }, uAge: { value: 0 }, uOpacity: { value: o.opacity ?? 0.5 }, uHeight: { value: o.height },
        uBase: { value: o.baseWidth }, uTop: { value: o.topWidth }, uCurl: { value: o.curl ?? o.topWidth * 1.5 },
        uRise: { value: o.riseSpeed ?? o.height / 2.5 }, uSeed: { value: o.seed ?? 1 }, uColor: { value: new THREE.Color(o.color ?? 0xb9c4d6) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime, uHeight, uBase, uTop, uCurl, uRise, uSeed;
        varying vec2 vUv; varying float vY;
        ${GLSL_NOISE}
        void main(){
          vUv = uv; float y = uv.y; vY = y;
          vec3 p = position;
          float w = mix(uBase, uTop, pow(y, 0.8));
          float flow = y*uHeight*3.0/max(uHeight,1e-4) - uTime*uRise/uHeight*2.2;
          float off = (fbm(vec2(flow*1.3 + uSeed*7.0, uSeed)) - 0.5) * 2.0 * uCurl * pow(y, 1.25);
          off += sin(flow*5.0 + uSeed*3.0) * uCurl * 0.12 * y;
          p.x = position.x * w + off;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uAge, uOpacity, uHeight, uRise, uSeed; uniform vec3 uColor;
        varying vec2 vUv; varying float vY;
        ${GLSL_NOISE}
        void main(){
          float front = clamp(uAge*uRise/uHeight, 0.0, 1.2);
          float edge = 1.0 - abs(vUv.x - 0.5)*2.0;
          float streak = fbm(vec2(vUv.x*3.0 + uSeed, vY*9.0 - uTime*uRise/uHeight*4.0));
          float a = smoothstep(0.0, 0.7, edge) * (0.45 + 0.75*streak);
          a *= smoothstep(front, front - 0.22, vY);          // climbing front
          a *= smoothstep(0.0, 0.04, vY) * (1.0 - smoothstep(0.55, 1.0, vY)); // thin at the source, dissolving at the top
          gl_FragColor = vec4(uColor, a * uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
  }

  update(time_s: number, age_s: number, opacity: number, camera?: THREE.Camera) {
    const u = this.mat.uniforms;
    u.uTime.value = time_s; u.uAge.value = Math.max(0, age_s); u.uOpacity.value = opacity;
    this.mesh.visible = age_s > 0 && opacity > 0.002;
    if (camera) {
      this.mesh.getWorldPosition(this._w); camera.getWorldPosition(this._c);
      this.mesh.rotation.y = Math.atan2(this._c.x - this._w.x, this._c.z - this._w.z);
    }
  }
}
