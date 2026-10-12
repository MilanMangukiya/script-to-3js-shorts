import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { applyCameraSpec, type CameraSpec } from '../camera/KeyframeRig';
import { clamp, smoothstep } from '../util/math';

/** Per-shot look. Every field is optional in bindings; unspecified values fall back to DEFAULT_POST. */
export interface PostSettings {
  exposure: number; bloomStrength: number; bloomRadius: number; bloomThreshold: number;
  vignette: number; grain: number; saturation: number; contrast: number; lift: number;
  tint: [number, number, number];
}
export const DEFAULT_POST: PostSettings = {
  exposure: 1, bloomStrength: 0.35, bloomRadius: 0.6, bloomThreshold: 0.85,
  vignette: 0.45, grain: 0.012, saturation: 1, contrast: 1, lift: 0, tint: [1, 1, 1],
};

export interface ShotInfo {
  key: string; sceneId: string; shotId: string; start_s: number; end_s: number; camera: CameraSpec;
  /** Interpolated camera look-at target for this frame (filled by the pipeline before update). */
  lookAt?: THREE.Vector3;
}
/** A stage is one 3D environment. It must be a pure function of absolute time (no accumulated state). */
export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(time_s: number, shot: ShotInfo): void;
}
export interface ShotBinding { stage: Stage; post?: Partial<PostSettings> | ((time_s: number) => Partial<PostSettings>) }
export interface OverlayContext { ctx: CanvasRenderingContext2D; time_s: number; shot: ShotInfo; stage: Stage; alpha: number; width: number; height: number }
export interface FilmDefinition {
  /** Map of "S01/SH01" → stage binding. */
  shots: Record<string, ShotBinding>;
  /** Optional 2D labels drawn above the picture and below captions. */
  overlay?(o: OverlayContext): void;
}
export interface CaptionLayer { draw(ctx: CanvasRenderingContext2D, time_s: number): void }

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null }, uExposure: { value: 1 }, uVignette: { value: 0.4 }, uGrain: { value: 0.012 },
    uFrame: { value: 0 }, uSaturation: { value: 1 }, uContrast: { value: 1 }, uLift: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) }, uRes: { value: new THREE.Vector2(1080, 1920) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uExposure, uVignette, uGrain, uFrame, uSaturation, uContrast, uLift; uniform vec3 uTint; uniform vec2 uRes;
    varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    void main(){
      vec3 c = max(texture2D(tDiffuse, vUv).rgb, 0.0) * uExposure * uTint;
      c = aces(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5 + uLift;
      vec2 q = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
      float v = smoothstep(0.78, 0.18, length(q));
      c *= mix(1.0, v, uVignette);
      c = pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2));
      float g = hash(vUv*uRes + vec2(uFrame*17.0, uFrame*29.0)) + hash(vUv*uRes*0.5 + vec2(uFrame*7.0, 3.0)) - 1.0;
      c += g * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/** Replaces NaN/Inf scene pixels (rare shader edge cases) with black before bloom, so one bad pixel cannot be blurred
 *  into a block. Valid pixels pass through unchanged. */
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 r = c.rgb;
      bvec3 bad = bvec3(!(r.x >= 0.0 || r.x <= 0.0), !(r.y >= 0.0 || r.y <= 0.0), !(r.z >= 0.0 || r.z <= 0.0));
      r = mix(r, vec3(0.0), vec3(bad)); r = clamp(r, vec3(0.0), vec3(60000.0));
      gl_FragColor = vec4(r, 1.0); }`,
};

export interface PipelineOptions {
  width: number; height: number; fps: number; duration_s: number;
  /** Storyboard `scenes` array (validated JSON). */
  scenes: any[];
  /** Internal render scale (1 = final resolution). Previews may use 0.5. */
  scale?: number;
}

/**
 * Deterministic frame renderer: storyboard-driven shot selection and cameras, HDR scene buffer with MSAA,
 * bloom, filmic grade, grain, cross-dissolves, 2D label overlay and burned-in captions.
 * `renderFrame(i)` depends only on i (time_s = i / fps).
 */
export class FilmPipeline {
  readonly renderer: THREE.WebGLRenderer;
  readonly out: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly shots: ShotInfo[] = [];
  private transitions: { at: number; dur: number; type: string }[] = [];
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  private final: ShaderPass;
  private film!: FilmDefinition;
  private captions?: CaptionLayer;
  private glCanvas: HTMLCanvasElement;
  readonly W: number; readonly H: number; readonly fps: number; readonly duration: number;

  constructor(opts: PipelineOptions) {
    this.W = opts.width; this.H = opts.height; this.fps = opts.fps; this.duration = opts.duration_s;
    const scale = opts.scale ?? 1;
    const rw = Math.round(this.W * scale), rh = Math.round(this.H * scale);
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.width = rw; this.glCanvas.height = rh;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(rw, rh, false);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const rt = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(rw, rh), 0.35, 0.6, 0.85);
    this.final = new ShaderPass(FinalShader);
    this.final.uniforms.uRes.value.set(rw, rh);
    this.composer.addPass(this.renderPass); this.composer.addPass(new ShaderPass(SanitizeShader)); this.composer.addPass(this.bloom); this.composer.addPass(this.final);

    this.out = document.createElement('canvas');
    this.out.width = this.W; this.out.height = this.H;
    this.ctx = this.out.getContext('2d', { alpha: false })!;

    for (const sc of opts.scenes) {
      for (const sh of sc.shots) this.shots.push({ key: `${sc.id}/${sh.id}`, sceneId: sc.id, shotId: sh.id, start_s: sh.start_s, end_s: sh.end_s, camera: sh.camera });
      const tr = sc.transition_out;
      if (tr && tr.type === 'cross_dissolve' && tr.duration_s > 0 && sc.end_s < opts.duration_s - 1e-6) this.transitions.push({ at: sc.end_s, dur: tr.duration_s, type: tr.type });
    }
  }

  setFilm(film: FilmDefinition, captions?: CaptionLayer) {
    for (const s of this.shots) if (!film.shots[s.key]) throw new Error(`No stage bound for shot ${s.key}`);
    this.film = film; this.captions = captions;
  }

  private shotIndexAt(t: number): number {
    for (let i = this.shots.length - 1; i >= 0; i--) if (t >= this.shots[i].start_s - 1e-9) return i;
    return 0;
  }

  private drawShot(index: number, t: number, frame: number) {
    const shot = this.shots[index], bind = this.film.shots[shot.key], stage = bind.stage;
    shot.lookAt = applyCameraSpec(stage.camera, shot.camera, t, this.W / this.H);
    stage.update(t, shot);
    const p: PostSettings = { ...DEFAULT_POST, ...(typeof bind.post === 'function' ? bind.post(t) : bind.post ?? {}) };
    this.renderPass.scene = stage.scene; this.renderPass.camera = stage.camera;
    this.bloom.strength = p.bloomStrength; this.bloom.radius = p.bloomRadius; this.bloom.threshold = p.bloomThreshold;
    const u = this.final.uniforms;
    u.uExposure.value = p.exposure; u.uVignette.value = p.vignette; u.uGrain.value = p.grain; u.uFrame.value = frame % 997;
    u.uSaturation.value = p.saturation; u.uContrast.value = p.contrast; u.uLift.value = p.lift; u.uTint.value.set(p.tint[0], p.tint[1], p.tint[2]);
    this.composer.render();
  }

  /** Render one frame into the output 2D canvas. */
  renderFrame(frame: number): HTMLCanvasElement {
    const t = frame / this.fps;
    const ctx = this.ctx;
    let primary = this.shotIndexAt(t), mix = 0, secondary = -1;
    for (const tr of this.transitions) {
      const a = tr.at - tr.dur / 2, b = tr.at + tr.dur / 2;
      if (t >= a && t < b) {
        const outIdx = this.shotIndexAt(tr.at - 1e-4), inIdx = this.shotIndexAt(tr.at + 1e-4);
        primary = outIdx; secondary = inIdx; mix = smoothstep(0, 1, (t - a) / tr.dur);
      }
    }
    ctx.globalAlpha = 1;
    this.drawShot(primary, t, frame);
    ctx.drawImage(this.glCanvas, 0, 0, this.W, this.H);
    if (secondary >= 0 && mix > 0) {
      this.drawShot(secondary, t, frame);
      ctx.globalAlpha = clamp(mix);
      ctx.drawImage(this.glCanvas, 0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
    }
    if (this.film.overlay) {
      // Labels belong to whichever shot dominates; they fade through the middle of a dissolve.
      const dom = secondary >= 0 && mix >= 0.5 ? secondary : primary;
      const alpha = secondary >= 0 ? Math.abs(1 - 2 * mix) : 1;
      const shot = this.shots[dom], stage = this.film.shots[shot.key].stage;
      if (dom !== (secondary >= 0 ? secondary : primary)) { shot.lookAt = applyCameraSpec(stage.camera, shot.camera, t, this.W / this.H); }
      ctx.save();
      this.film.overlay({ ctx, time_s: t, shot, stage, alpha, width: this.W, height: this.H });
      ctx.restore();
    }
    if (this.captions) { ctx.save(); this.captions.draw(ctx, t); ctx.restore(); }
    return this.out;
  }
}

/** Project a world position to output-canvas pixels. Returns null when behind the camera. */
export function projectToScreen(camera: THREE.Camera, world: THREE.Vector3, width: number, height: number): { x: number; y: number } | null {
  const v = world.clone().project(camera);
  if (v.z > 1 || v.z < -1) return null;
  return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
}
