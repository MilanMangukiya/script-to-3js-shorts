import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { applyCameraSpec, type CameraSpec } from '../camera/KeyframeRig';
import { clamp, smoothstep } from '../util/math';

/** Display transform applied to the HDR picture before grading. */
export type Tonemap = 'aces' | 'agx' | 'neutral';
const TONEMAP_ID: Record<Tonemap, number> = { aces: 0, agx: 1, neutral: 2 };

/** Per-shot look. Every field is optional in bindings; unspecified values fall back to DEFAULT_POST. */
export interface PostSettings {
  exposure: number; bloomStrength: number; bloomRadius: number; bloomThreshold: number;
  vignette: number; grain: number; saturation: number; contrast: number; lift: number;
  tint: [number, number, number];
  /** Heat-shimmer refraction strength (0 = off). Strongest near the bottom of frame, animated by film time. */
  heatHaze: number;
  /** 'aces' (fitted ACES, the original look), 'agx' (graceful highlight roll-off: fire, lava, suns) or 'neutral' (Khronos PBR Neutral, true product colour). */
  tonemap: Tonemap;
  /** Saturation boost weighted toward muted colours (0 = off). */
  vibrance: number;
  /** Split-tone multipliers for shadows and highlights ([1,1,1] = neutral). */
  shadowTint: [number, number, number]; highlightTint: [number, number, number];
  /** Ambient-occlusion blend 0..1 and world radius in metres (needs quality.ambientOcclusion). */
  ao: number; aoRadius: number;
  /** Depth of field: focus distance in metres (0 = off), aperture and max blur (needs quality.depthOfField). */
  dof: number; dofAperture: number; dofMaxBlur: number;
  /** Screen-space sun shafts from the stage's `sunDirection` (0 = off; needs quality.sunShafts). */
  shafts: number; shaftDecay: number; shaftThreshold: number;
  /** Lens chromatic aberration at the frame edges (0 = off) and per-shot sharpening override (−1 = use quality). */
  chroma: number; sharpen: number;
  /** Motion-blur shutter as a fraction of the frame interval (0.5 = 180°; 0 = off; −1 = use quality). Needs quality.motionBlur > 1. */
  shutter: number;
}
export const DEFAULT_POST: PostSettings = {
  exposure: 1, bloomStrength: 0.35, bloomRadius: 0.6, bloomThreshold: 0.85,
  vignette: 0.45, grain: 0.012, saturation: 1, contrast: 1, lift: 0, tint: [1, 1, 1], heatHaze: 0,
  tonemap: 'aces', vibrance: 0, shadowTint: [1, 1, 1], highlightTint: [1, 1, 1],
  ao: 0, aoRadius: 0.6, dof: 0, dofAperture: 0.012, dofMaxBlur: 0.008,
  shafts: 0, shaftDecay: 0.965, shaftThreshold: 0.9, chroma: 0, sharpen: -1, shutter: -1,
};

/**
 * Render quality. 'standard' reproduces the original pipeline exactly. 'cinematic' renders the 3D picture at twice the
 * output resolution, resolves it with a soft tent filter plus contrast-adaptive sharpening (grain and dither at output
 * resolution), makes ambient occlusion, depth of field and sun shafts available to shots that ask for them, and adds
 * deterministic sub-frame motion blur. 'draft' is for fast look checks of cinematic films (no supersampling or blur).
 */
export interface RenderQuality {
  supersample: number; sharpen: number; msaa: number; ambientOcclusion: boolean; depthOfField: boolean; sunShafts: boolean;
  /** Sub-frame samples averaged per frame (1 = off). Each sample re-evaluates the stage at its own time. */
  motionBlur: number;
  /** Default shutter as a fraction of the frame interval (0.5 = 180° film shutter). */
  shutter: number;
}
export type QualityPreset = 'standard' | 'cinematic' | 'draft';
export const QUALITY: Record<QualityPreset, RenderQuality> = {
  standard: { supersample: 1, sharpen: 0, msaa: 4, ambientOcclusion: false, depthOfField: false, sunShafts: false, motionBlur: 1, shutter: 0.5 },
  cinematic: { supersample: 2, sharpen: 0.4, msaa: 4, ambientOcclusion: true, depthOfField: true, sunShafts: true, motionBlur: 3, shutter: 0.5 },
  draft: { supersample: 1, sharpen: 0.25, msaa: 4, ambientOcclusion: true, depthOfField: true, sunShafts: true, motionBlur: 1, shutter: 0.5 },
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
  /** Optional unit vector toward the sun (world space), read after update for sun shafts. */
  sunDirection?: THREE.Vector3;
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
    uTint: { value: new THREE.Vector3(1, 1, 1) }, uRes: { value: new THREE.Vector2(1080, 1920) }, uHaze: { value: 0 }, uTimeS: { value: 0 },
    uVibrance: { value: 0 }, uShadowTint: { value: new THREE.Vector3(1, 1, 1) }, uHighlightTint: { value: new THREE.Vector3(1, 1, 1) },
    uTonemap: { value: 0 }, toneMappingExposure: { value: 1 }, uSplit: { value: 0 },
    uWhipOffset: { value: new THREE.Vector2(0, 0) }, uWhipBlur: { value: new THREE.Vector2(0, 0) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uExposure, uVignette, uGrain, uFrame, uSaturation, uContrast, uLift, uHaze, uTimeS, uVibrance, uSplit;
    uniform vec3 uTint, uShadowTint, uHighlightTint; uniform vec2 uRes, uWhipOffset, uWhipBlur; uniform int uTonemap;
    varying vec2 vUv;
    ${THREE.ShaderChunk.tonemapping_pars_fragment}
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    vec3 scene(vec2 uv){ return max(texture2D(tDiffuse, uv).rgb, 0.0); }
    void main(){
      vec2 uv = vUv;
      if (uHaze > 0.0) {
        float g = smoothstep(0.9, 0.1, vUv.y);
        uv += uHaze * g * vec2(sin(vUv.y * 170.0 + uTimeS * 9.0 + sin(vUv.x * 37.0 + uTimeS * 2.3) * 1.6),
                               cos(vUv.x * 130.0 - uTimeS * 7.0 + sin(vUv.y * 23.0) * 1.2)) * 0.0022;
      }
      vec3 c;
      if (dot(uWhipBlur, uWhipBlur) > 0.0 || dot(uWhipOffset, uWhipOffset) > 0.0) {
        // Whip pan: the frame slides (wrapping) and smears along the pan direction; 24 jittered taps hide the seam.
        c = vec3(0.0); float j = hash(vUv * uRes + uFrame) - 0.5;
        for (int i = 0; i < 24; i++) { float k = (float(i) + 0.5 + j) / 24.0 - 0.5; c += scene(fract(uv + uWhipOffset + uWhipBlur * k)); }
        c /= 24.0;
      } else c = scene(uv);
      c = c * uExposure * uTint;
      if (uTonemap == 1) c = AgXToneMapping(c);
      else if (uTonemap == 2) c = NeutralToneMapping(c);
      else c = aces(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      if (uVibrance != 0.0) { float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); c = mix(vec3(l), c, 1.0 + uVibrance*(1.0 - sat)); }
      c = (c - 0.5) * uContrast + 0.5 + uLift;
      if (uSplit > 0.5) { float tl = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
        c *= mix(uShadowTint, vec3(1.0), smoothstep(0.0, 0.45, tl)) * mix(vec3(1.0), uHighlightTint, smoothstep(0.5, 1.0, tl)); }
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

/** Screen-space god rays: bright pixels are smeared along the line toward the sun's screen position (HDR, pre-bloom). */
const ShaftShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uStrength: { value: 0 }, uDecay: { value: 0.965 }, uThreshold: { value: 0.9 }, uAspect: { value: 9 / 16 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uStrength, uDecay, uThreshold, uAspect; varying vec2 vUv;
    void main(){
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec2 d = (uSun - vUv) / 56.0; vec2 p = vUv; float w = 1.0; vec3 acc = vec3(0.0);
      for (int i = 0; i < 56; i++) {
        p += d; vec3 s = texture2D(tDiffuse, clamp(p, 0.0, 1.0)).rgb;
        acc += max(s - uThreshold, 0.0) * w; w *= uDecay;
      }
      float fall = 1.0 - smoothstep(0.0, 1.1, length((uSun - vUv) * vec2(uAspect, 1.0)));
      gl_FragColor = vec4(base + acc * (uStrength / 56.0) * (0.35 + 0.65 * fall), 1.0); }`,
};

/** Output-resolution resolve for supersampled renders: tent downsample, contrast-adaptive sharpening (after AMD CAS),
 *  optional edge chromatic aberration, film grain and dither. */
const ResolveShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uOut: { value: new THREE.Vector2(1080, 1920) }, uSharp: { value: 0.4 }, uGrain: { value: 0.006 }, uFrame: { value: 0 }, uChroma: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform vec2 uOut; uniform float uSharp, uGrain, uFrame, uChroma; varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    vec3 tap(vec2 uv){ vec2 o = 0.5 / uOut;   // four bilinear taps = a soft tent over the supersampled pixels
      return 0.25*(texture2D(tDiffuse, uv + vec2(-o.x, -o.y)).rgb + texture2D(tDiffuse, uv + vec2(o.x, -o.y)).rgb + texture2D(tDiffuse, uv + vec2(-o.x, o.y)).rgb + texture2D(tDiffuse, uv + vec2(o.x, o.y)).rgb); }
    void main(){
      vec2 px = 1.0 / uOut;
      vec3 c = tap(vUv);
      if (uChroma > 0.0) { vec2 dir = (vUv - 0.5) * uChroma * 0.004; c.r = tap(vUv + dir).r; c.b = tap(vUv - dir).b; }
      vec3 n = tap(vUv + vec2(0.0, px.y)), s = tap(vUv - vec2(0.0, px.y)), e = tap(vUv + vec2(px.x, 0.0)), w = tap(vUv - vec2(px.x, 0.0));
      vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
      vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
      vec3 wt = -amp / mix(8.0, 5.0, clamp(uSharp, 0.0, 1.0)) * step(0.001, uSharp);
      c = clamp((c + (n + s + e + w) * wt) / (1.0 + 4.0 * wt), 0.0, 1.0);
      float g = hash(vUv*uOut + vec2(uFrame*17.0, uFrame*29.0)) + hash(vUv*uOut*0.5 + vec2(uFrame*7.0, 3.0)) - 1.0;
      c += g * uGrain + (hash(vUv*uOut + 13.7) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
};

/** Weighted copy used to average motion-blur sub-frames into the HDR buffer. */
const AccumulateShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uWeight: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform float uWeight; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; bvec3 bad = bvec3(!(c.x >= 0.0 || c.x <= 0.0), !(c.y >= 0.0 || c.y <= 0.0), !(c.z >= 0.0 || c.z <= 0.0));
      c = clamp(mix(c, vec3(0.0), vec3(bad)), vec3(0.0), vec3(60000.0)); gl_FragColor = vec4(c * uWeight, 1.0); }`,
};

/**
 * Scene render with deterministic motion blur: renders `times.length` sub-frames (each a full stage evaluation at its
 * own absolute time) and averages them in HDR. With one sample it is an ordinary render pass. The last sample is the
 * frame's own time, so stage/camera state after the pass (used by AO, depth of field and overlays) is the frame itself.
 */
class SubframeRenderPass extends Pass {
  scene = new THREE.Scene(); camera: THREE.Camera = new THREE.PerspectiveCamera();
  /** Sets the stage to sub-frame k (0..count−1); the final call (k = count−1) must restore the frame time. */
  prepare: (k: number) => void = () => {};
  count = 1;
  private sample?: THREE.WebGLRenderTarget;
  private quad = new FullScreenQuad(new THREE.ShaderMaterial({ ...AccumulateShader, uniforms: THREE.UniformsUtils.clone(AccumulateShader.uniforms), depthTest: false, depthWrite: false }));
  constructor(private w: number, private h: number, private msaa: number) { super(); this.needsSwap = false; }
  setSize(w: number, h: number) { this.w = w; this.h = h; this.sample?.setSize(w, h); }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const auto = renderer.autoClear; renderer.autoClear = true;
    if (this.count <= 1) {
      this.prepare(0);
      renderer.setRenderTarget(this.renderToScreen ? null : readBuffer); renderer.render(this.scene, this.camera);
      renderer.autoClear = auto; return;
    }
    this.sample ??= new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, samples: this.msaa, depthBuffer: true });
    const mat = this.quad.material as THREE.ShaderMaterial;
    for (let k = 0; k < this.count; k++) {
      this.prepare(k);
      renderer.autoClear = true;
      renderer.setRenderTarget(this.sample); renderer.render(this.scene, this.camera);
      mat.uniforms.tDiffuse.value = this.sample.texture; mat.uniforms.uWeight.value = 1 / this.count;
      mat.blending = k === 0 ? THREE.NoBlending : THREE.CustomBlending;
      mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneFactor;
      // The first sample overwrites the full-screen buffer; later ones add onto it, so the buffer must not be cleared.
      renderer.autoClear = false;
      renderer.setRenderTarget(readBuffer); this.quad.render(renderer);
    }
    renderer.autoClear = auto;
  }
  dispose() { this.sample?.dispose(); this.quad.dispose(); }
}

/**
 * Objects that write no depth (sky domes, glows, glass, additive shells, sprites, particles) and meshes whose vertex
 * shader deforms them (custom ShaderMaterials, `onBeforeCompile` grass) must not enter depth-based effects: those
 * passes draw with an override material that would lose the deformation. Opt back in with `userData.depthFx = true`.
 */
function hideDepthless(scene: THREE.Scene, cache: THREE.Object3D[]) {
  scene.traverse((o) => {
    if (!o.visible || o.userData.depthFx) return;
    const m = o as THREE.Mesh, mat = m.material as THREE.Material | undefined;
    if ((o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints || (o as THREE.Line).isLine) { o.visible = false; cache.push(o); return; }
    if (!m.isMesh || !mat || Array.isArray(mat)) return;
    if (o.userData.noDepthFx || (mat as THREE.ShaderMaterial).isShaderMaterial || mat.depthWrite === false || mat.depthTest === false || (mat.transparent && mat.opacity < 0.999) || o.renderOrder < 0) { o.visible = false; cache.push(o); }
  });
}
class StudioGTAOPass extends GTAOPass {
  private _extra: THREE.Object3D[] = [];
  _overrideVisibility() { (GTAOPass.prototype as any)._overrideVisibility.call(this); hideDepthless(this.scene, this._extra); }
  _restoreVisibility() { (GTAOPass.prototype as any)._restoreVisibility.call(this); for (const o of this._extra) o.visible = true; this._extra.length = 0; }
}
class StudioBokehPass extends BokehPass {
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime?: number, maskActive?: boolean) {
    const hidden: THREE.Object3D[] = []; hideDepthless((this as any).scene, hidden);
    super.render(renderer, writeBuffer, readBuffer, deltaTime as number, maskActive as boolean);
    for (const o of hidden) o.visible = true;
  }
}

export interface PipelineOptions {
  width: number; height: number; fps: number; duration_s: number;
  /** Storyboard `scenes` array (validated JSON). */
  scenes: any[];
  /** Internal render scale (1 = final resolution). Previews may use 0.5. */
  scale?: number;
  /** Render quality preset or overrides (default 'standard' = the original pipeline). */
  quality?: QualityPreset | Partial<RenderQuality>;
}

type TransitionType = 'cross_dissolve' | 'whip_pan' | 'light_wipe';
interface Transition { at: number; dur: number; type: TransitionType }

/**
 * Deterministic frame renderer: storyboard-driven shot selection and cameras, HDR scene buffer with MSAA,
 * optional supersampling/motion blur/AO/depth of field/sun shafts, bloom, filmic grade, grain, cross-dissolves,
 * whip pans and light wipes, 2D label overlay and burned-in captions. `renderFrame(i)` depends only on i (time_s = i / fps).
 */
export class FilmPipeline {
  readonly renderer: THREE.WebGLRenderer;
  readonly out: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly shots: ShotInfo[] = [];
  readonly quality: RenderQuality;
  private transitions: Transition[] = [];
  private composer: EffectComposer;
  private renderPass: SubframeRenderPass | RenderPass;
  private bloom: UnrealBloomPass;
  private final: ShaderPass;
  private gtao?: StudioGTAOPass; private bokeh?: StudioBokehPass; private shafts?: ShaderPass;
  private resolve?: FullScreenQuad;
  private film!: FilmDefinition;
  private captions?: CaptionLayer;
  private glCanvas: HTMLCanvasElement;
  private wipe?: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  private dummy = new THREE.Scene(); private tmp = new THREE.Vector3();
  readonly W: number; readonly H: number; readonly fps: number; readonly duration: number;

  constructor(opts: PipelineOptions) {
    this.W = opts.width; this.H = opts.height; this.fps = opts.fps; this.duration = opts.duration_s;
    const q = opts.quality ?? 'standard';
    this.quality = typeof q === 'string' ? { ...(QUALITY[q] ?? QUALITY.standard) } : { ...QUALITY.standard, ...q };
    const scale = opts.scale ?? 1, ss = Math.max(1, this.quality.supersample);
    const rw = Math.round(this.W * scale), rh = Math.round(this.H * scale), iw = Math.round(rw * ss), ih = Math.round(rh * ss);
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.width = rw; this.glCanvas.height = rh;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(rw, rh, false);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const rt = new THREE.WebGLRenderTarget(iw, ih, { type: THREE.HalfFloatType, samples: this.quality.msaa, depthBuffer: true });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setSize(iw, ih);
    // Without motion blur this is three's own RenderPass, exactly as in the original pipeline.
    this.renderPass = this.quality.motionBlur > 1 ? new SubframeRenderPass(iw, ih, this.quality.msaa) : new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(iw, ih), 0.35, 0.6, 0.85);
    this.final = new ShaderPass(FinalShader);
    this.final.uniforms.uRes.value.set(iw, ih);
    this.composer.addPass(this.renderPass);
    if (this.quality.ambientOcclusion) {
      // three's GTAOPass also takes AO and denoise parameters (its typings list only the first five arguments).
      const gtao: StudioGTAOPass = new (StudioGTAOPass as any)(this.dummy, new THREE.PerspectiveCamera(), iw, ih, undefined, { samples: 16, radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1, distanceFallOff: 1, screenSpaceRadius: false }, { samples: 12, rings: 2, radius: 6, lumaPhi: 10, depthPhi: 2, normalPhi: 3 });
      gtao.enabled = false; this.composer.addPass(gtao); this.gtao = gtao;
    }
    this.composer.addPass(new ShaderPass(SanitizeShader));
    if (this.quality.depthOfField) { this.bokeh = new StudioBokehPass(this.dummy, new THREE.PerspectiveCamera(), { focus: 3, aperture: 0.012, maxblur: 0.008 }); this.bokeh.enabled = false; this.composer.addPass(this.bokeh); }
    if (this.quality.sunShafts) { this.shafts = new ShaderPass(ShaftShader); this.shafts.enabled = false; this.composer.addPass(this.shafts); }
    this.composer.addPass(this.bloom); this.composer.addPass(this.final);
    if (ss > 1 || this.quality.sharpen > 0) {
      this.composer.renderToScreen = false;
      this.resolve = new FullScreenQuad(new THREE.ShaderMaterial(ResolveShader));
      (this.resolve.material as THREE.ShaderMaterial).uniforms.uOut.value.set(rw, rh);
    }

    this.out = document.createElement('canvas');
    this.out.width = this.W; this.out.height = this.H;
    this.ctx = this.out.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingQuality = 'high';

    for (const sc of opts.scenes) {
      for (const sh of sc.shots) this.shots.push({ key: `${sc.id}/${sh.id}`, sceneId: sc.id, shotId: sh.id, start_s: sh.start_s, end_s: sh.end_s, camera: sh.camera });
      const tr = sc.transition_out;
      if (tr && ['cross_dissolve', 'whip_pan', 'light_wipe'].includes(tr.type) && tr.duration_s > 0 && sc.end_s < opts.duration_s - 1e-6) this.transitions.push({ at: sc.end_s, dur: tr.duration_s, type: tr.type });
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

  private drawShot(index: number, t: number, frame: number, whip?: { offset: [number, number]; blur: [number, number] }) {
    const shot = this.shots[index], bind = this.film.shots[shot.key], stage = bind.stage;
    const p: PostSettings = { ...DEFAULT_POST, ...(typeof bind.post === 'function' ? bind.post(t) : bind.post ?? {}) };
    const at = (time: number) => { shot.lookAt = applyCameraSpec(stage.camera, shot.camera, time, this.W / this.H); stage.update(time, shot); };
    const rp = this.renderPass;
    if (rp instanceof SubframeRenderPass) {
      // Sub-frames span the shutter around t (centred) and stay inside this shot, so a reveal is never exposed before its
      // shot starts. During a transition t itself may lie past the shot's end; the window then extends to t.
      const shutter = (p.shutter >= 0 ? p.shutter : this.quality.shutter) / this.fps;
      const n = shutter > 0 ? Math.max(1, Math.round(this.quality.motionBlur)) : 1;
      const lo = Math.min(Math.max(0, shot.start_s), t), hi = Math.max(Math.min(shot.end_s - 1e-4, this.duration), t);
      const times = Array.from({ length: n }, (_, k) => n === 1 ? t : clamp(t + shutter * ((k + 0.5) / n - 0.5), lo, hi));
      // Render the sample nearest t last, then restore the exact frame time so AO, depth of field and overlays see frame t.
      times.sort((a, b) => Math.abs(b - t) - Math.abs(a - t));
      rp.count = n; rp.scene = stage.scene; rp.camera = stage.camera;
      rp.prepare = (k) => { at(times[k]); if (k === n - 1 && times[k] !== t) at(t); };
    } else {
      at(t);
      rp.scene = stage.scene; rp.camera = stage.camera;
    }
    if (this.gtao) {
      this.gtao.enabled = p.ao > 0;
      if (this.gtao.enabled) {
        this.gtao.scene = stage.scene; this.gtao.camera = stage.camera; this.gtao.blendIntensity = clamp(p.ao);
        (this.gtao.gtaoMaterial.uniforms as any).radius.value = p.aoRadius;
      }
    }
    if (this.bokeh) {
      this.bokeh.enabled = p.dof > 0;
      if (this.bokeh.enabled) {
        (this.bokeh as any).scene = stage.scene; (this.bokeh as any).camera = stage.camera;
        const u = (this.bokeh as any).uniforms; u.focus.value = p.dof; u.aperture.value = p.dofAperture; u.maxblur.value = p.dofMaxBlur;
      }
    }
    if (this.shafts) this.shafts.enabled = false;
    const sunShafts = () => {
      const dir = stage.sunDirection;
      if (!this.shafts || !(p.shafts > 0) || !dir) return;
      const s = this.tmp.copy(stage.camera.position).addScaledVector(dir, 1000).project(stage.camera);
      this.shafts.enabled = s.z < 1;   // sun in front of the camera (may be off-frame)
      if (this.shafts.enabled) {
        const u = this.shafts.uniforms; u.uSun.value.set(s.x * 0.5 + 0.5, s.y * 0.5 + 0.5); u.uStrength.value = p.shafts; u.uDecay.value = p.shaftDecay; u.uThreshold.value = p.shaftThreshold;
      }
    };
    // Without sub-frames the stage is already at t; with them the sun position settles during the render pass, so the
    // (rarely moving) sun direction is read from the frame-time state evaluated above.
    if (!(rp instanceof SubframeRenderPass)) sunShafts(); else { at(t); sunShafts(); }
    this.bloom.strength = p.bloomStrength; this.bloom.radius = p.bloomRadius; this.bloom.threshold = p.bloomThreshold;
    const u = this.final.uniforms;
    u.uExposure.value = p.exposure; u.uVignette.value = p.vignette; u.uFrame.value = frame % 997;
    u.uGrain.value = this.resolve ? 0 : p.grain;   // supersampled: grain is added at output resolution instead
    u.uSaturation.value = p.saturation; u.uContrast.value = p.contrast; u.uLift.value = p.lift; u.uTint.value.set(p.tint[0], p.tint[1], p.tint[2]);
    u.uHaze.value = p.heatHaze; u.uTimeS.value = t;
    u.uVibrance.value = p.vibrance; u.uShadowTint.value.set(...p.shadowTint); u.uHighlightTint.value.set(...p.highlightTint);
    u.uSplit.value = [...p.shadowTint, ...p.highlightTint].some((v) => v !== 1) ? 1 : 0;
    u.uTonemap.value = TONEMAP_ID[p.tonemap] ?? 0;
    u.uWhipOffset.value.set(whip?.offset[0] ?? 0, whip?.offset[1] ?? 0); u.uWhipBlur.value.set(whip?.blur[0] ?? 0, whip?.blur[1] ?? 0);
    this.composer.render();
    if (this.resolve) {
      const r = (this.resolve.material as THREE.ShaderMaterial).uniforms;
      r.tDiffuse.value = this.composer.readBuffer.texture; r.uFrame.value = frame % 997;
      r.uSharp.value = p.sharpen >= 0 ? p.sharpen : this.quality.sharpen; r.uGrain.value = p.grain * 0.6; r.uChroma.value = p.chroma;
      this.renderer.setRenderTarget(null); this.resolve.render(this.renderer);
    }
  }

  /** Light wipe: a soft, warm band of light sweeps diagonally across the frame and leaves the incoming shot behind it. */
  private drawLightWipe(outIdx: number, inIdx: number, t: number, frame: number, u: number) {
    const { W, H, ctx } = this;
    this.drawShot(outIdx, t, frame);
    ctx.drawImage(this.glCanvas, 0, 0, W, H);
    this.wipe ??= (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return { canvas: c, ctx: c.getContext('2d')! }; })();
    const w = this.wipe.ctx, e = u * u * (3 - 2 * u), soft = 0.22;
    // Band axis: lower left → upper right; `front` (0..1 along it) is where the incoming picture currently reaches.
    const ax = 0, ay = H, bx = W, by = 0, front = -soft + e * (1 + 2 * soft);
    this.drawShot(inIdx, t, frame);
    w.globalCompositeOperation = 'source-over'; w.globalAlpha = 1;
    w.clearRect(0, 0, W, H); w.drawImage(this.glCanvas, 0, 0, W, H);
    const mask = w.createLinearGradient(ax, ay, bx, by);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(clamp(front - soft * 0.5), 'rgba(0,0,0,1)'); mask.addColorStop(clamp(front + soft * 0.5), 'rgba(0,0,0,0)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    w.globalCompositeOperation = 'destination-in'; w.fillStyle = mask; w.fillRect(0, 0, W, H);
    w.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.wipe.canvas, 0, 0);
    // The light itself: a hot core riding the front with a wide warm halo, brightest mid-transition.
    const glow = ctx.createLinearGradient(ax, ay, bx, by), k = Math.sin(Math.PI * u);
    const stop = (x: number, a: number, rgb: string) => glow.addColorStop(clamp(x), `rgba(${rgb},${clamp(a)})`);
    stop(front - soft * 1.6, 0, '255,196,140'); stop(front - soft * 0.5, 0.55 * k, '255,214,170'); stop(front, 0.95 * k, '255,248,236');
    stop(front + soft * 0.5, 0.55 * k, '255,214,170'); stop(front + soft * 1.6, 0, '255,196,140');
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.18 * k; ctx.fillStyle = 'rgb(255,236,214)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  /** Render one frame into the output 2D canvas. Pass `{ overlay: false, captions: false }` for a clean picture
   *  (e.g. a thumbnail still); both default to true, so normal rendering is unchanged. */
  renderFrame(frame: number, opts: { overlay?: boolean; captions?: boolean } = {}): HTMLCanvasElement {
    const t = frame / this.fps;
    const ctx = this.ctx;
    let primary = this.shotIndexAt(t), mix = 0, secondary = -1, active: Transition | undefined;
    for (const tr of this.transitions) {
      const a = tr.at - tr.dur / 2, b = tr.at + tr.dur / 2;
      if (t >= a && t < b) {
        const outIdx = this.shotIndexAt(tr.at - 1e-4), inIdx = this.shotIndexAt(tr.at + 1e-4);
        primary = outIdx; secondary = inIdx; mix = smoothstep(0, 1, (t - a) / tr.dur); active = tr;
      }
    }
    ctx.globalAlpha = 1;
    if (active?.type === 'whip_pan') {
      // The outgoing shot accelerates away to the left, the incoming one decelerates in from the right; the smear peaks
      // at the cut, which hides it. One shot is visible at a time.
      const half = active.dur / 2, before = t < active.at, u = before ? (t - (active.at - half)) / half : (t - active.at) / half;
      const ease = before ? u * u * u : 1 - Math.pow(1 - u, 3), speed = before ? 3 * u * u : 3 * (1 - u) * (1 - u);
      const offset = before ? 0.55 * ease : -0.55 * (1 - ease), blur = Math.min(0.3, 0.1 * speed);
      this.drawShot(before ? primary : secondary, t, frame, { offset: [offset, 0], blur: [blur, 0] });
      ctx.drawImage(this.glCanvas, 0, 0, this.W, this.H);
    } else if (active?.type === 'light_wipe') {
      this.drawLightWipe(primary, secondary, t, frame, clamp((t - (active.at - active.dur / 2)) / active.dur));
    } else {
      this.drawShot(primary, t, frame);
      ctx.drawImage(this.glCanvas, 0, 0, this.W, this.H);
      if (secondary >= 0 && mix > 0) {
        this.drawShot(secondary, t, frame);
        ctx.globalAlpha = clamp(mix);
        ctx.drawImage(this.glCanvas, 0, 0, this.W, this.H);
        ctx.globalAlpha = 1;
      }
    }
    if (this.film.overlay && opts.overlay !== false) {
      // Labels belong to whichever shot dominates; they fade through the middle of a transition.
      const dom = secondary >= 0 && mix >= 0.5 ? secondary : primary;
      const alpha = secondary >= 0 ? Math.abs(1 - 2 * mix) : 1;
      const shot = this.shots[dom], stage = this.film.shots[shot.key].stage;
      const lastDrawn = active?.type === 'whip_pan' ? (t < active.at ? primary : secondary) : secondary >= 0 ? secondary : primary;
      if (dom !== lastDrawn) { shot.lookAt = applyCameraSpec(stage.camera, shot.camera, t, this.W / this.H); }
      ctx.save();
      this.film.overlay({ ctx, time_s: t, shot, stage, alpha, width: this.W, height: this.H });
      ctx.restore();
    }
    if (this.captions && opts.captions !== false) { ctx.save(); this.captions.draw(ctx, t); ctx.restore(); }
    return this.out;
  }
}

/** Project a world position to output-canvas pixels. Returns null when behind the camera. */
export function projectToScreen(camera: THREE.Camera, world: THREE.Vector3, width: number, height: number): { x: number; y: number } | null {
  const v = world.clone().project(camera);
  if (v.z > 1 || v.z < -1) return null;
  return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
}
