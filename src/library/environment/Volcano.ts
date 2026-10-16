import * as THREE from 'three';
import { GLSL_NOISE, GLSL_FOG } from '../util/glsl';
import { fbm2, rng } from '../util/math';

export interface VolcanoOptions {
  /** Cone height, base radius and crater radius in metres. */
  height?: number; radius?: number; crater?: number;
  seed?: number; segments?: number;
  rockColor?: THREE.ColorRepresentation; lavaColor?: THREE.ColorRepresentation; plumeColor?: THREE.ColorRepresentation;
  /** Light for the rock (direction toward the sun), its colour, the ambient/sky colour, and fog. */
  sunDirection?: THREE.Vector3; sunColor?: THREE.ColorRepresentation; ambient?: THREE.ColorRepresentation;
  fogColor?: THREE.ColorRepresentation; fogDensity?: number;
  /** Lava fountain particles and plume puffs. */
  ejecta?: number; puffs?: number;
  /** Lava flows as [angle in radians around the cone (atan2(z, x)), length in metres from the centre]; up to 12. */
  channels?: [number, number][];
  /** Peak-to-peak relief of the rolling ground around the cone in metres (default 140); 0 gives a flat plain at y = 0 beyond the cone. */
  groundRelief?: number;
}

/**
 * Procedural volcanic cone: noise-carved basalt with radial gullies, a glowing crater, emissive lava flows with
 * pulses moving downhill, ballistic lava fountains and a billowing ash plume lit from below. `eruption` scales the
 * fountains and plume; `lavaGlow` the flows. Deterministic `update(time_s)`; `heightAt(x, z)` for placing things.
 */
export class Volcano {
  readonly group = new THREE.Group();
  readonly height: number; readonly radius: number; readonly crater: number;
  private seed: number; private relief: number;
  private rockMat: THREE.ShaderMaterial; private ejectaMat: THREE.ShaderMaterial; private plumeMat: THREE.ShaderMaterial;

  constructor(o: VolcanoOptions = {}) {
    const H = (this.height = o.height ?? 1200), R = (this.radius = o.radius ?? 3400), C = (this.crater = o.crater ?? 240), seg = o.segments ?? 320;
    this.seed = o.seed ?? 7; this.relief = o.groundRelief ?? 140;
    const g = new THREE.PlaneGeometry(R * 3, R * 3, seg, seg).rotateX(-Math.PI / 2), p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, this.heightAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const sun = (o.sunDirection ?? new THREE.Vector3(-0.6, 0.25, -0.5)).clone().normalize();
    const chan = (o.channels ?? Array.from({ length: 8 }, (_, i) => [i * 0.785 + 0.3 + 0.22 * Math.sin(i * 3.1), C + R * 0.5 * (0.5 + 0.5 * ((Math.sin(i * 12.9) * 43.7) % 1 + 1) % 1)] as [number, number])).slice(0, 12);
    const chanVec = Array.from({ length: 12 }, (_, i) => new THREE.Vector2(...(chan[i] ?? [0, 0])));
    this.rockMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uGlow: { value: 1 }, uH: { value: H }, uR: { value: R }, uC: { value: C }, uChan: { value: chanVec }, uChanN: { value: chan.length },
        uRock: { value: new THREE.Color(o.rockColor ?? 0x2a2421) }, uLava: { value: new THREE.Color(o.lavaColor ?? 0xff5a14) },
        uSun: { value: sun }, uSunCol: { value: new THREE.Color(o.sunColor ?? 0xffb27a) }, uAmb: { value: new THREE.Color(o.ambient ?? 0x3a4660) },
        uFog: { value: new THREE.Color(o.fogColor ?? 0x6b5a6e) }, uFogD: { value: o.fogDensity ?? 0.00012 },
      },
      vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vL;
        void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform float uTime, uGlow, uH, uR, uC, uFogD; uniform vec3 uRock, uLava, uSun, uSunCol, uAmb, uFog; uniform vec2 uChan[12]; uniform int uChanN;
        varying vec3 vP; varying vec3 vN; varying vec3 vL;
        ${GLSL_NOISE}${GLSL_FOG}
        void main(){
          vec3 N = normalize(vN); float r = length(vL.xz), ang = atan(vL.z, vL.x);
          float n = fbm(vL.xz * 0.004) * 0.6 + fbm(vL.xz * 0.03) * 0.4;
          vec3 alb = uRock * (0.7 + 0.6 * n);
          vec3 col = alb * (uAmb * 0.55 + uSunCol * max(dot(N, uSun), 0.0) * 1.1);
          // Lava: a few channels following gullies down the flanks, pulses moving downhill, plus the crater.
          float ch = 0.0;
          for (int i = 0; i < 12; i++) {
            if (i >= uChanN) break;
            float a0 = uChan[i].x, len = uChan[i].y;
            float wig = 0.06 * sin(r * 0.004 + float(i) * 2.0) + 0.03 * (fbm(vec2(r * 0.003, float(i))) - 0.5);
            float d = abs(mod(ang - a0 - wig + 3.14159, 6.28318) - 3.14159) * r;
            float w = 24.0 + r * 0.008;   // flows widen as they spread downhill
            ch = max(ch, smoothstep(w, w * 0.2, d) * smoothstep(len, len * 0.85, r) * step(uC * 0.9, r));
          }
          float pulse = 0.8 + 0.2 * sin(r * 0.02 - uTime * 1.6);
          float crater = smoothstep(uC * 1.05, uC * 0.75, r);
          float lava = (ch * pulse + crater * (0.8 + 0.2 * sin(uTime * 3.0 + n * 9.0))) * uGlow;
          col = mix(col, uLava * (1.8 + 1.2 * n), clamp(lava, 0.0, 1.0));
          col += uLava * 0.45 * smoothstep(uC * 3.0, uC, r) * uGlow;   // glow spilling onto the summit
          float dist = length(vP - cameraPosition);
          col = fogMix(col, uFog, uFogD, dist) + uLava * clamp(lava, 0.0, 1.0) * 0.35 * exp(-dist * uFogD * 0.5);
          gl_FragColor = vec4(col, 1.0); }`,
    });
    const ground = new THREE.Mesh(g, this.rockMat);
    // Lava fountains: ballistic particles launched from the crater, recycled every few seconds.
    const r = rng(this.seed), ne = o.ejecta ?? 1400, ej = new Float32Array(ne * 4);
    for (let i = 0; i < ne; i++) { const a = r() * Math.PI * 2, tilt = r() * 0.32; ej.set([Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt), r()], i * 4); }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ne * 3), 3));
    eg.setAttribute('aDir', new THREE.BufferAttribute(ej, 4));
    this.ejectaMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uTop: { value: new THREE.Vector3(0, this.heightAt(0, 0) + 10, 0) }, uAmount: { value: 1 }, uLava: { value: new THREE.Color(o.lavaColor ?? 0xff5a14) } },
      vertexShader: /* glsl */ `attribute vec4 aDir; uniform float uTime, uAmount; uniform vec3 uTop; varying float vA; varying float vHot;
        void main(){
          float life = 3.2, tau = fract(uTime / life + aDir.w) * life;
          float v0 = 55.0 + 40.0 * fract(aDir.w * 7.31);
          vec3 p = uTop + aDir.xyz * v0 * tau + vec3(0.0, -4.9 * tau * tau, 0.0);
          vA = uAmount * smoothstep(0.0, 0.15, tau) * (1.0 - smoothstep(life * 0.7, life, tau));
          vHot = 1.0 - tau / life;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(30000.0 / -mv.z, 2.0, 14.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uLava; varying float vA; varying float vHot;
        void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.1, d) * vA; if (a < 0.01) discard;
          vec3 c = mix(uLava, vec3(1.0, 0.9, 0.55), vHot * 0.9); gl_FragColor = vec4(c * a * 2.6, a); }`,
    });
    const ejecta = new THREE.Points(eg, this.ejectaMat); ejecta.frustumCulled = false; ejecta.renderOrder = 10;   // glow over the ash
    // Ash plume: soft billboards rising, spreading and drifting with the wind; lit orange from below.
    const np = o.puffs ?? 70, pd = new Float32Array(np * 4);
    for (let i = 0; i < np; i++) pd.set([r(), r() - 0.5, r() - 0.5, 0.6 + r() * 0.8], i * 4);
    const quad = new THREE.PlaneGeometry(1, 1);
    const ig = new THREE.InstancedBufferGeometry(); ig.index = quad.index; ig.attributes.position = quad.attributes.position; ig.attributes.uv = quad.attributes.uv;
    ig.setAttribute('aPuff', new THREE.InstancedBufferAttribute(pd, 4)); ig.instanceCount = np;
    this.plumeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uTop: { value: new THREE.Vector3(0, this.heightAt(0, 0), 0) }, uAmount: { value: 1 }, uH: { value: H },
        uSmoke: { value: new THREE.Color(o.plumeColor ?? 0x3b3533) }, uLava: { value: new THREE.Color(o.lavaColor ?? 0xff5a14) } },
      vertexShader: /* glsl */ `attribute vec4 aPuff; uniform float uTime, uAmount, uH; uniform vec3 uTop; varying vec2 vUv; varying float vAge; varying float vA;
        void main(){ vUv = uv;
          float age = fract(uTime * 0.045 * aPuff.w + aPuff.x); vAge = age;
          vec3 c = uTop + vec3(aPuff.y * 250.0 * (0.4 + age) + age * age * 900.0, age * uH * 1.6, aPuff.z * 250.0 * (0.4 + age));
          float size = (220.0 + age * 1100.0) * (0.7 + 0.3 * aPuff.w);
          vA = uAmount * smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.6, 1.0, age));
          vec4 mv = modelViewMatrix * vec4(c, 1.0); mv.xy += position.xy * size;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform vec3 uSmoke, uLava; varying vec2 vUv; varying float vAge; varying float vA;
        ${GLSL_NOISE}
        void main(){ vec2 q = vUv - 0.5; float d = length(q) * 2.0;
          float n = fbm(vUv * 3.0 + vAge * 2.0);
          float a = smoothstep(1.0, 0.3, d + (n - 0.5) * 0.6) * vA * 0.75; if (a < 0.01) discard;
          vec3 c = uSmoke * (0.7 + 0.5 * n) + uLava * (1.0 - smoothstep(0.0, 0.35, vAge)) * (0.75 - q.y) * 1.3;
          gl_FragColor = vec4(c, a); }`,
    });
    const plume = new THREE.Mesh(ig, this.plumeMat); plume.frustumCulled = false; plume.renderOrder = 5;
    this.group.add(ground, ejecta, plume);
  }

  /** Terrain height in metres at (x, z): concave cone, summit crater, radial gullies, rolling ground beyond. */
  heightAt(x: number, z: number) {
    const r = Math.hypot(x, z), a = Math.atan2(z, x), H = this.height, R = this.radius, C = this.crater;
    const k = Math.min(1, r / R), cone = H * Math.pow(1 - k, 1.7);
    const gully = (fbm2(Math.cos(a) * 3 + this.seed, Math.sin(a) * 3, 2, 3) - 0.5) * 0.08 * H * Math.sin(Math.PI * Math.min(1, k * 1.2));
    const crater = r < C * 1.3 ? -0.22 * H * Math.pow(Math.max(0, 1 - r / (C * 1.3)), 1.6) : 0;
    const ground = (fbm2(x * 0.0006, z * 0.0006, this.seed + 1, 4) - 0.5) * this.relief;
    return cone + gully + crater + ground * (0.3 + 0.7 * k);
  }

  /** 0..1 lava fountains and plume. */
  set eruption(v: number) { this.ejectaMat.uniforms.uAmount.value = v; this.plumeMat.uniforms.uAmount.value = v; }
  /** Brightness of the lava flows and crater. */
  set lavaGlow(v: number) { this.rockMat.uniforms.uGlow.value = v; }
  update(time_s: number) { this.rockMat.uniforms.uTime.value = time_s; this.ejectaMat.uniforms.uTime.value = time_s; this.plumeMat.uniforms.uTime.value = time_s; }
}
