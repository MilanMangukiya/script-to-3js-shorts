import * as THREE from 'three';

export interface BubbleStreamOptions {
  /** Seconds between bursts, bubbles per burst and how many past bursts stay alive. */
  period?: number; perBurst?: number; bursts?: number;
  /** Seconds over which one burst leaves the emitter. */
  spread?: number;
  /** Mean rise speed (m/s) and bubble radius at the emitter (m). */
  riseSpeed?: number; size?: number;
  /** Water surface height (world y); bubbles fade out there. */
  surfaceY?: number;
  /** Surface pressure in atmospheres for Boyle's-law growth while rising (1 = today's air, 2 = doubled air). */
  surfacePressure?: number;
  seed?: number;
}

/**
 * Periodic exhalation bubbles (divers, vents): each burst leaves an emitter, wobbles, spreads, accelerates gently and
 * swells by Boyle's law as the water pressure falls toward the surface. Stateless: `update(time_s, emitter)` places
 * every sprite from the burst schedule alone.
 */
export class BubbleStream {
  readonly points: THREE.Points;
  private u: Record<string, THREE.IUniform>;

  constructor(o: BubbleStreamOptions = {}) {
    const per = o.perBurst ?? 26, bursts = o.bursts ?? 5, n = per * bursts;
    const slot = new Float32Array(n * 2);
    for (let j = 0; j < n; j++) slot.set([Math.floor(j / per), j % per], j * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSlot', new THREE.BufferAttribute(slot, 2));
    this.u = {
      uTime: { value: 0 }, uT0: { value: 0 }, uPeriod: { value: o.period ?? 3.6 }, uPer: { value: per }, uSpread: { value: o.spread ?? 0.45 },
      uRise: { value: o.riseSpeed ?? 0.45 }, uSize: { value: o.size ?? 0.006 }, uSurface: { value: o.surfaceY ?? 0 }, uP0: { value: o.surfacePressure ?? 1 },
      uEmit: { value: new THREE.Vector3() }, uSeed: { value: o.seed ?? 3 },
    };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: this.u,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
        attribute vec2 aSlot; uniform float uTime, uT0, uPeriod, uPer, uSpread, uRise, uSize, uSurface, uP0, uSeed; uniform vec3 uEmit;
        varying float vA;
        float h(float x){ return fract(sin(x*12.9898 + uSeed*78.233)*43758.5453); }
        void main(){
          float K = floor((uTime - uT0) / uPeriod);
          float burst = K - aSlot.x;                         // which burst this sprite belongs to (newest = K)
          float id = burst*97.0 + aSlot.y;
          float te = uT0 + burst*uPeriod + h(id)*uSpread;
          float age = uTime - te;
          float r1 = h(id + 1.3), r2 = h(id + 2.7), r3 = h(id + 4.1);
          float speed = uRise * (0.6 + 0.8*r1);
          vec3 p = uEmit;
          float rise = speed*age + 0.12*age*age;
          p.y += rise;
          float wob = age * (2.5 + r2*3.0);
          p.x += sin(wob + r3*6.28) * 0.03 * (0.4 + r1) + (r2 - 0.5) * 0.25 * age;
          p.z += cos(wob*0.9 + r1*6.28) * 0.03 * (0.4 + r2) + (r3 - 0.5) * 0.25 * age;
          float depthStart = max(uSurface - uEmit.y, 0.0), depthNow = max(uSurface - p.y, 0.0);
          float grow = pow((uP0 + depthStart/10.0) / (uP0 + depthNow/10.0), 1.0/3.0);    // Boyle: V ~ 1/P
          float rad = uSize * (0.35 + 1.3*r2*r2) * grow;
          vA = step(0.0, age) * step(0.0, burst) * (1.0 - smoothstep(uSurface - 0.3, uSurface, p.y)) * smoothstep(0.0, 0.06, age);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(rad * 2.0 * projectionMatrix[1][1] * 960.0 / -mv.z, 0.0, 90.0) * step(0.001, vA);
        }`,
      fragmentShader: /* glsl */ `varying float vA;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q)*2.0; if (d > 1.0) discard;
          float rim = smoothstep(0.55, 0.92, d) * (1.0 - smoothstep(0.92, 1.0, d));
          float glint = smoothstep(0.3, 0.0, length(q - vec2(-0.17, -0.2))*2.0);
          float a = (rim*0.75 + glint*0.85 + 0.05) * vA;
          gl_FragColor = vec4(vec3(0.85, 0.98, 1.0) * a, a * 0.9); }`,
    }));
    this.points.frustumCulled = false; this.points.renderOrder = 8;
  }

  /** @param emitter world position of the outlet now; @param t0 time of the first burst. */
  update(time_s: number, emitter: THREE.Vector3, t0 = 0) {
    this.u.uTime.value = time_s; this.u.uT0.value = t0; this.u.uEmit.value.copy(emitter);
  }
}
