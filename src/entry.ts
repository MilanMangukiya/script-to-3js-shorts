// Browser entry: loads a storyboard + its narration timings, builds the film and exposes a deterministic
// frame API on window.__film for tools/render.mjs. Usage: index.html?slug=<slug>&scale=1
import { FilmPipeline, type FilmDefinition } from './library/render/FilmPipeline';
import { KineticCaptions, DEFAULT_CAPTION_STYLE } from './library/captions/KineticCaptions';
import type * as THREE from 'three';
import { createFilm as oxygenGoneFiveSeconds } from './stories/oxygen-gone-five-seconds/film';
import { createFilm as iceSankInsteadOfFloating } from './stories/ice-sank-instead-of-floating/film';
import { createFilm as airPressureDoubled } from './stories/air-pressure-doubled/film';

/** Register each story's film factory here (story compositions stay outside src/library). */
const FILMS: Record<string, (ctx: { renderer: THREE.WebGLRenderer; base: string }) => Promise<FilmDefinition>> = {
  'oxygen-gone-five-seconds': oxygenGoneFiveSeconds,
  'ice-sank-instead-of-floating': iceSankInsteadOfFloating,
  'air-pressure-doubled': airPressureDoubled,
};

async function boot() {
  const q = new URLSearchParams(location.search), slug = q.get('slug')!, scale = Number(q.get('scale') ?? '1'), base = '/';
  const [story, narration] = await Promise.all([
    fetch(`${base}stories/${slug}.json`).then((r) => r.json()),
    fetch(`${base}build/${slug}/audio/narration.json`).then((r) => r.json()),
  ]);
  for (const [weight, file] of [[500, 'Inter-Medium'], [600, 'Inter-SemiBold'], [700, 'Inter-Bold']] as const) {
    const face = new FontFace('Inter', `url(${base}assets/library/fonts/${file}.woff2)`, { weight: String(weight), style: 'normal' });
    document.fonts.add(await face.load());
  }
  const p = story.project;
  const pipeline = new FilmPipeline({ width: p.width, height: p.height, fps: p.fps, duration_s: p.duration_s, scenes: story.scenes, scale });
  const film = await FILMS[slug]({ renderer: pipeline.renderer, base });
  const cap = story.captions, safe = cap.safe_area;
  const captions = new KineticCaptions(
    story.scenes.map((sc: any) => ({ offset_s: sc.narration.start_s, words: narration.scenes.find((n: any) => n.id === sc.id).words, emphasis: sc.caption_emphasis })),
    { ...DEFAULT_CAPTION_STYLE, fontSize: cap.font_size_px, lineHeight: Math.round(cap.font_size_px * 1.27), maxCharsPerLine: cap.max_chars_per_line,
      baselineY: safe.caption_baseline_y_px, centerX: (safe.left_px + (p.width - safe.right_px)) / 2, maxWidth: p.width - safe.left_px - safe.right_px },
  );
  pipeline.setFilm(film, captions);
  const gl = pipeline.renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  document.body.appendChild(pipeline.out);
  return {
    frames: p.duration_s * p.fps, fps: p.fps,
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
    /** Render frame i and return it as a data URL. */
    renderFrame(i: number, mime = 'image/jpeg', quality = 0.95): string { return pipeline.renderFrame(i).toDataURL(mime, quality); },
  };
}

(window as any).__filmReady = boot().then((api) => { (window as any).__film = api; return { frames: api.frames, fps: api.fps, gpu: api.gpu }; })
  .catch((e) => { (window as any).__filmError = String(e?.stack ?? e); throw e; });
