import * as THREE from 'three';
import { rng } from '../util/math';
import { GLSL_NOISE } from '../util/glsl';

export interface RainOptions {
  count?: number; seed?: number;
  /** Size of the wrapped volume (x, y, z) in metres. Drops are fixed in world space and recycle inside a box kept
   *  centred on the camera (or any point passed to `update`), so camera moves keep correct parallax. */
  box?: [number, number, number];
  /** Fall speed in m/s and horizontal wind velocity [x, z] in m/s (slants the streaks). */
  fallSpeed?: number; wind?: [number, number];
  /** Streak length in metres (≈ fall speed × shutter time) and true drop width in metres. */
  streakLength?: number; width?: number;
  /** Minimum on-screen width in pixels; thinner drops are widened to this and faded by the same factor. */
  minPx?: number;
  /** Output height in pixels used for the pixel-width clamp (1920 for the final 9:16 render). */
  heightPx?: number;
  color?: THREE.ColorRepresentation; brightness?: number;
  /** Opacity of one streak at full intensity. */
  opacity?: number;
  /** Drops whose head is below this world height are hidden (flat ground). */
  groundY?: number;
  /** Drops fade in beyond `near` and out towards `far` (metres from the camera). */
  near?: number; far?: number;
}

/**
 * Deterministic rain: instanced camera-facing streaks stretched along each drop's velocity. Positions are a pure
 * function of time (no simulation state). `intensity` (0..1) reveals a fraction of drops, from a few drops to a
 * steady fall, so rain can start, thin or stop on cue.
 */
export class Rain {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;
  private _c = new THREE.Vector3();

  constructor(o: RainOptions = {}) {
    const n = o.count ?? 9000, r = rng(o.seed ?? 5), box = o.box ?? [30, 16, 30];
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos.set([r() * box[0], r() * box[1], r() * box[2]], i * 3);
      rnd.set([0.82 + r() * 0.36, r(), 0.6 + r() * 0.8, 0.7 + r() * 0.6], i * 4);   // speed, reveal threshold, width, length
    }
    quad.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
    quad.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));
    quad.instanceCount = n;
    this.u = {
      uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) }, uCenter: { value: new THREE.Vector3() },
      uFall: { value: o.fallSpeed ?? 6 }, uWind: { value: new THREE.Vector2(...(o.wind ?? [0.4, 0])) },
      uLen: { value: o.streakLength ?? 0.35 }, uWidth: { value: o.width ?? 0.0015 }, uMinPx: { value: o.minPx ?? 1.4 },
      uPx: { value: 0.0004 }, uHeightPx: { value: o.heightPx ?? 1920 },
      uColor: { value: new THREE.Color(o.color ?? 0xdfe6ee) }, uBright: { value: o.brightness ?? 1 }, uOpacity: { value: o.opacity ?? 0.42 },
      uIntensity: { value: 1 }, uGround: { value: o.groundY ?? -1e6 }, uNear: { value: o.near ?? 0.25 }, uFar: { value: o.far ?? 26 },
    };
    // Double-sided: the streak quad's screen-space winding flips with the fall direction.
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, uniforms: this.u,
      vertexShader: /* glsl */ `
        attribute vec3 aPos; attribute vec4 aRnd;
        uniform float uTime, uFall, uLen, uWidth, uMinPx, uPx, uOpacity, uIntensity, uGround, uNear, uFar;
        uniform vec2 uWind; uniform vec3 uBox, uCenter;
        varying float vA; varying vec2 vQ;
        void main(){
          vec3 vel = vec3(uWind.x, -uFall*aRnd.x, uWind.y);
          vec3 org = uCenter - uBox*0.5;
          vec3 rel = mod(aPos + vel*uTime - org, uBox);
          vec3 head = org + rel, tail = head - normalize(vel)*uLen*aRnd.w;
          vec4 h = viewMatrix*vec4(head, 1.0), t = viewMatrix*vec4(tail, 1.0);
          vec3 mv = mix(h.xyz, t.xyz, position.y);
          float depth = max(-mv.z, 1e-3);
          float wReal = uWidth*aRnd.z, w = max(wReal, uMinPx*depth*uPx);
          vec2 d = t.xy/max(-t.z,1e-3) - h.xy/max(-h.z,1e-3);
          vec2 side = dot(d, d) > 1e-10 ? normalize(vec2(-d.y, d.x)) : vec2(1.0, 0.0);
          mv.xy += side*position.x*w*0.5;
          gl_Position = projectionMatrix*vec4(mv, 1.0);
          vec3 q = rel/uBox;
          float edge = smoothstep(0.0, 0.06, q.y)*smoothstep(1.0, 0.94, q.y)*smoothstep(0.0, 0.05, q.x)*smoothstep(1.0, 0.95, q.x)*smoothstep(0.0, 0.05, q.z)*smoothstep(1.0, 0.95, q.z);
          vA = uOpacity*step(aRnd.y, uIntensity)*edge*step(uGround, head.y)*smoothstep(uNear, uNear*2.0, depth)*smoothstep(uFar, uFar*0.55, depth)*(wReal/w);
          vQ = position.xy;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uBright; varying float vA; varying vec2 vQ;
        void main(){
          float a = vA*smoothstep(1.0, 0.15, abs(vQ.x))*smoothstep(1.0, 0.2, vQ.y)*smoothstep(0.0, 0.06, vQ.y);
          if (a < 0.002) discard;
          gl_FragColor = vec4(uColor*uBright, a);
        }`,
    });
    this.mesh = new THREE.Mesh(quad, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8;
  }

  /** Fraction of drops shown (0..1). */
  set intensity(v: number) { this.u.uIntensity.value = v; }
  set brightness(v: number) { this.u.uBright.value = v; }
  set opacity(v: number) { this.u.uOpacity.value = v; }
  set groundY(v: number) { this.u.uGround.value = v; }

  /** @param camera the rendering camera: centres the drop volume on it and sets the pixel-width clamp. */
  update(time_s: number, camera: THREE.PerspectiveCamera, center?: THREE.Vector3) {
    this.u.uTime.value = time_s;
    this.u.uCenter.value.copy(center ?? camera.getWorldPosition(this._c));
    this.u.uPx.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / this.u.uHeightPx.value;
  }
}

export interface RainSplashOptions {
  /** Rectangular footprint (x, z) in metres, or a disc of `radius` metres (e.g. the water surface in a glass). */
  size?: [number, number]; radius?: number;
  /** Cell size in metres (about one splash per cell per `period` seconds) and ring lifetime in seconds. */
  cell?: number; period?: number; life?: number;
  /** Final ring radius as a fraction of the cell, ring line width as a fraction of the cell. */
  ringScale?: number; lineWidth?: number;
  color?: THREE.ColorRepresentation; opacity?: number; seed?: number;
}

/**
 * Expanding splash rings on a flat wet surface (puddles, a glass of water, a wet table). Lies in the local XZ plane;
 * place it just above the surface. Two offset cell grids give an irregular pattern; `intensity` (0..1) reveals a
 * fraction of the splashes.
 */
export class RainSplashes {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;

  constructor(o: RainSplashOptions = {}) {
    const geo = o.radius !== undefined ? new THREE.CircleGeometry(o.radius, 64) : new THREE.PlaneGeometry(...(o.size ?? [4, 4]));
    geo.rotateX(-Math.PI / 2);
    this.u = {
      uTime: { value: 0 }, uCell: { value: o.cell ?? 0.12 }, uPeriod: { value: o.period ?? 1.1 }, uLife: { value: o.life ?? 0.45 },
      uRing: { value: o.ringScale ?? 0.42 }, uLine: { value: o.lineWidth ?? 0.035 }, uColor: { value: new THREE.Color(o.color ?? 0xe8f1f7) },
      uOpacity: { value: o.opacity ?? 0.55 }, uSeed: { value: o.seed ?? 3 }, uIntensity: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: this.u,
      vertexShader: /* glsl */ `varying vec2 vXZ; void main(){ vXZ = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uCell, uPeriod, uLife, uRing, uLine, uOpacity, uSeed, uIntensity; uniform vec3 uColor;
        varying vec2 vXZ;
        ${GLSL_NOISE}
        float layer(vec2 p, float off){
          vec2 g = p/uCell + off, id0 = floor(g); float a = 0.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 id = id0 + vec2(float(i), float(j));
            float ph = hash21(id + uSeed + off*7.0);
            float cyc = floor(uTime/uPeriod + ph), age = (uTime/uPeriod + ph - cyc)*uPeriod;
            if (age > uLife || hash21(id*1.37 + cyc*0.71 + uSeed) > uIntensity) continue;
            vec2 c = id + vec2(hash21(id + cyc*3.1 + 0.4), hash21(id + cyc*5.7 + 9.2));
            float k = age/uLife, d = length(g - c), r = uRing*sqrt(k);
            a += smoothstep(uLine, 0.0, abs(d - r))*(1.0 - k)*(1.0 - k);
            a += smoothstep(0.06, 0.0, d)*smoothstep(0.25, 0.0, k)*0.8;
          }
          return a;
        }
        void main(){ float a = clamp(layer(vXZ, 0.0) + layer(vXZ, 0.5), 0.0, 1.0)*uOpacity; if (a < 0.003) discard; gl_FragColor = vec4(uColor, a); }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 6;
  }

  set intensity(v: number) { this.u.uIntensity.value = v; }
  set opacity(v: number) { this.u.uOpacity.value = v; }
  update(time_s: number) { this.u.uTime.value = time_s; }
}

export interface RainShaftOptions {
  /** Curtain width and height in metres (the base sits at the object's origin). */
  width: number; height: number;
  color?: THREE.ColorRepresentation; opacity?: number;
  /** Apparent fall speed of the streak texture (m/s) and seed. */
  fallSpeed?: number; seed?: number;
}

/**
 * Distant rain curtain (a "rain shaft" hanging from a cloud base): a soft-edged vertical billboard with falling
 * streak texture, turned toward the camera about Y. For rain seen kilometres away; near rain uses `Rain`.
 */
export class RainShaft {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;
  private _w = new THREE.Vector3(); private _c = new THREE.Vector3();

  constructor(o: RainShaftOptions) {
    const geo = new THREE.PlaneGeometry(o.width, o.height, 1, 1).translate(0, o.height / 2, 0);
    this.u = {
      uTime: { value: 0 }, uColor: { value: new THREE.Color(o.color ?? 0x8b939c) }, uOpacity: { value: o.opacity ?? 0.45 },
      uFall: { value: (o.fallSpeed ?? 7) / o.height }, uSeed: { value: o.seed ?? 1 }, uAspect: { value: o.width / o.height },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, uniforms: this.u,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity, uFall, uSeed, uAspect; uniform vec3 uColor; varying vec2 vUv;
        ${GLSL_NOISE}
        void main(){
          float x = vUv.x - 0.5;
          float wob = (fbm(vec2(vUv.y*2.0 + uSeed, uTime*0.05 + uSeed)) - 0.5)*0.35;
          float core = exp(-pow((x - wob*0.3)/(0.26 + 0.08*fbm(vec2(vUv.y*3.0, uSeed))), 2.0));
          float streak = fbm(vec2(vUv.x*55.0*uAspect + uSeed*3.0, vUv.y*2.5 + uTime*uFall*2.5));
          float a = core*(0.55 + 0.6*streak)*smoothstep(0.0, 0.08, vUv.y)*smoothstep(1.0, 0.82, vUv.y);
          gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0)*uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -40;
  }

  set opacity(v: number) { this.u.uOpacity.value = v; }
  update(time_s: number, camera?: THREE.Camera) {
    this.u.uTime.value = time_s;
    if (camera) { this.mesh.getWorldPosition(this._w); camera.getWorldPosition(this._c); this.mesh.rotation.y = Math.atan2(this._c.x - this._w.x, this._c.z - this._w.z); }
  }
}
