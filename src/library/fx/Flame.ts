import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface FlameOptions {
  /** Billboard width and height in scene units (flame body fits inside). */
  width: number; height: number;
  seed?: number;
  /** 0 = laminar candle, 1 = lively campfire. */
  turbulence?: number;
  /** Upward noise scroll speed. */
  speed?: number;
  /** HDR brightness multiplier. */
  brightness?: number;
  /** Strength of the blue base zone (0..1). */
  blueBase?: number;
  colorCore?: THREE.ColorRepresentation; colorMid?: THREE.ColorRepresentation; colorTip?: THREE.ColorRepresentation; colorBase?: THREE.ColorRepresentation;
}

/**
 * Procedural additive flame on a Y-axis billboard. `update(time_s, intensity, camera)` is deterministic:
 * intensity 1 = full flame, 0 = extinguished (the flame shortens and fades, so it can die and reignite).
 */
export class Flame {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private _w = new THREE.Vector3();
  private _c = new THREE.Vector3();

  constructor(o: FlameOptions) {
    const geo = new THREE.PlaneGeometry(o.width, o.height, 1, 1);
    geo.translate(0, o.height / 2, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: {
        uTime: { value: 0 }, uIntensity: { value: 1 }, uSeed: { value: o.seed ?? 1 }, uTurb: { value: o.turbulence ?? 0.25 },
        uSpeed: { value: o.speed ?? 1 }, uBright: { value: o.brightness ?? 2.2 }, uBlue: { value: o.blueBase ?? 0.6 },
        uCore: { value: new THREE.Color(o.colorCore ?? 0xfff3c4) }, uMid: { value: new THREE.Color(o.colorMid ?? 0xffa63a) },
        uTip: { value: new THREE.Color(o.colorTip ?? 0xff5a14) }, uBase: { value: new THREE.Color(o.colorBase ?? 0x2f6bff) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uIntensity, uSeed, uTurb, uSpeed, uBright, uBlue;
        uniform vec3 uCore, uMid, uTip, uBase;
        varying vec2 vUv;
        ${GLSL_NOISE}
        void main(){
          float life = clamp(uIntensity, 0.0, 1.0);
          float h = mix(0.18, 1.0, life);
          float y = vUv.y / h;
          if (y > 1.0 || life <= 0.001) discard;
          float t = uTime*uSpeed + uSeed*13.7;
          float sway = (fbm(vec2(vUv.y*2.2 - t*1.3, uSeed*3.1 + t*0.35)) - 0.5) * uTurb * y * 1.1;
          float x = (vUv.x - 0.5)*2.0 - sway;
          float n = fbm(vec2(x*2.5 + uSeed*5.0, vUv.y*3.2 - t*2.4));
          float w = pow(max(y, 0.0), 0.45) * pow(max(1.0 - y, 0.0), 0.85) * 1.55;
          w *= 1.0 + (n - 0.5) * uTurb * 1.4;
          w = max(w, 1e-4);
          float d = abs(x) / w;
          float body = smoothstep(1.0, 0.35, d);
          float core = smoothstep(0.8, 0.0, d) * smoothstep(1.0, 0.1, y);
          vec3 col = mix(uTip, uMid, smoothstep(0.95, 0.3, y));
          col = mix(col, uCore, core);
          float base = smoothstep(0.24, 0.0, y) * uBlue;
          col = mix(col, uBase, base*0.9);
          float a = body * (1.0 - base*0.6) * smoothstep(0.0, 0.05, y) * smoothstep(0.0, 0.2, life);
          // ragged licks near the tip for turbulent fires
          a *= mix(1.0, smoothstep(0.25, 0.6, n + (1.0 - y)*0.6), uTurb);
          gl_FragColor = vec4(col * uBright * a, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  set brightness(v: number) { this.mat.uniforms.uBright.value = v; }

  /** @param intensity 0..1 flame life; @param camera when given, the billboard yaws toward it. */
  update(time_s: number, intensity: number, camera?: THREE.Camera) {
    this.mat.uniforms.uTime.value = time_s;
    this.mat.uniforms.uIntensity.value = intensity;
    this.mesh.visible = intensity > 0.001;
    if (camera) {
      this.mesh.getWorldPosition(this._w);
      camera.getWorldPosition(this._c);
      const parentYaw = this.mesh.parent ? new THREE.Euler().setFromQuaternion(this.mesh.parent.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y : 0;
      this.mesh.rotation.y = Math.atan2(this._c.x - this._w.x, this._c.z - this._w.z) - parentYaw;
    }
  }
}
