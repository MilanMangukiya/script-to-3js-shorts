// Browser entry: loads a storyboard + its narration timings, builds the film and exposes a deterministic
// frame API on window.__film for tools/render.mjs. Usage: index.html?slug=<slug>&scale=1
import { FilmPipeline, type FilmDefinition } from './library/render/FilmPipeline';
import { KineticCaptions, DEFAULT_CAPTION_STYLE } from './library/captions/KineticCaptions';
import { drawThumbnailTitle, composeBoldThumbnail, THUMB_FONTS, THUMB_GRADES } from './library/overlay/Thumbnail';
import type * as THREE from 'three';
import { createFilm as oxygenGoneFiveSeconds } from './stories/oxygen-gone-five-seconds/film';
import { createFilm as iceSankInsteadOfFloating } from './stories/ice-sank-instead-of-floating/film';
import { createFilm as airPressureDoubled } from './stories/air-pressure-doubled/film';
import { createFilm as moonMadeOfIce } from './stories/moon-made-of-ice/film';
import { createFilm as everyManDisappeared } from './stories/what-if-every-man-disappeared/film';
import { createFilm as rainNonstopEverywhere } from './stories/rain-nonstop-everywhere/film';
import { createFilm as continentsOneLandmass } from './stories/continents-one-landmass/film';
import { createFilm as earthCoreSolid } from './stories/earth-core-solid/film';
import { createFilm as earthTenPercentCloser } from './stories/earth-ten-percent-closer/film';
import { createFilm as everyHumanJumpedAtOnce } from './stories/every-human-jumped-at-once/film';
import { createFilm as mountainGrew100KmTall } from './stories/mountain-grew-100-km-tall/film';
import { createFilm as lastManAlive } from './stories/last-man-alive/film';
import { createFilm as lastWomanAlive } from './stories/last-woman-alive/film';
import { createFilm as skyDisappeared } from './stories/sky-disappeared/film';
import { createFilm as earthWithoutTilt } from './stories/earth-without-tilt/film';
import { createFilm as ozoneLayerGoneOvernight } from './stories/ozone-layer-gone-overnight/film';
import { createFilm as earth1000fFiveSeconds } from './stories/earth-1000f-five-seconds/film';
import { createFilm as roguePlanetBetweenEarthMars } from './stories/rogue-planet-between-earth-mars/film';
import { createFilm as everyVolcanoErupts } from './stories/every-volcano-erupts-at-once/film';
import { createFilm as everyoneFartsAtOnce } from './stories/everyone-farts-at-once/film';
import { createFilm as sunLockedEarth } from './stories/sun-locked-earth/film';
import { createFilm as socialMediaGoneFiveSeconds } from './stories/social-media-gone-five-seconds/film';

/** Register each story's film factory here (story compositions stay outside src/library). */
const FILMS: Record<string, (ctx: { renderer: THREE.WebGLRenderer; base: string }) => Promise<FilmDefinition>> = {
  'oxygen-gone-five-seconds': oxygenGoneFiveSeconds,
  'ice-sank-instead-of-floating': iceSankInsteadOfFloating,
  'air-pressure-doubled': airPressureDoubled,
  'moon-made-of-ice': moonMadeOfIce,
  'what-if-every-man-disappeared': everyManDisappeared,
  'rain-nonstop-everywhere': rainNonstopEverywhere,
  'continents-one-landmass': continentsOneLandmass,
  'earth-core-solid': earthCoreSolid,
  'earth-ten-percent-closer': earthTenPercentCloser,
  'every-human-jumped-at-once': everyHumanJumpedAtOnce,
  'mountain-grew-100-km-tall': mountainGrew100KmTall,
  'last-man-alive': lastManAlive,
  'last-woman-alive': lastWomanAlive,
  'sky-disappeared': skyDisappeared,
  'earth-without-tilt': earthWithoutTilt,
  'ozone-layer-gone-overnight': ozoneLayerGoneOvernight,
  'earth-1000f-five-seconds': earth1000fFiveSeconds,
  'rogue-planet-between-earth-mars': roguePlanetBetweenEarthMars,
  'every-volcano-erupts-at-once': everyVolcanoErupts,
  'everyone-farts-at-once': everyoneFartsAtOnce,
  'sun-locked-earth': sunLockedEarth,
  'social-media-gone-five-seconds': socialMediaGoneFiveSeconds,
};

async function boot() {
  const q = new URLSearchParams(location.search), slug = q.get('slug')!, scale = Number(q.get('scale') ?? '1'), base = '/';
  const [story, narration] = await Promise.all([
    fetch(`${base}stories/${slug}.json`).then((r) => r.json()),
    // Missing timings (e.g. a thumbnail for a film whose build/ was cleaned) give caption-less frames instead of failing.
    fetch(`${base}build/${slug}/audio/narration.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  if (!narration) console.warn(`no build/${slug}/audio/narration.json: rendering without captions`);
  for (const [weight, file, style] of [[500, 'Inter-Medium', 'normal'], [600, 'Inter-SemiBold', 'normal'], [700, 'Inter-Bold', 'normal'], [900, 'Inter-Black', 'normal'], [900, 'Inter-BlackItalic', 'italic']] as const) {
    const face = new FontFace('Inter', `url(${base}assets/library/fonts/${file}.woff2)`, { weight: String(weight), style });
    document.fonts.add(await face.load());
  }
  // Display faces for thumbnails (assets/library/fonts/display/FONTS.md).
  for (const [family, file, weight] of [['Anton', 'Anton-Regular', 400], ['Bebas Neue', 'BebasNeue-Regular', 400], ['Archivo Black', 'ArchivoBlack-Regular', 400], ['Bangers', 'Bangers-Regular', 400], ['Orbitron', 'Orbitron-Black', 900], ['Playfair Display', 'PlayfairDisplay-Black', 900]] as const) {
    document.fonts.add(await new FontFace(family, `url(${base}assets/library/fonts/display/${file}.woff2)`, { weight: String(weight), style: 'normal' }).load());
  }
  const p = story.project;
  const pipeline = new FilmPipeline({ width: p.width, height: p.height, fps: p.fps, duration_s: p.duration_s, scenes: story.scenes, scale });
  const film = await FILMS[slug]({ renderer: pipeline.renderer, base });
  const cap = story.captions, safe = cap.safe_area;
  const captionAccent = cap.active_word_treatment?.match(/#[0-9a-fA-F]{6}/)?.[0];
  const captions = new KineticCaptions(
    story.scenes.map((sc: any) => ({ offset_s: sc.narration.start_s, words: narration?.scenes.find((n: any) => n.id === sc.id)?.words ?? [], emphasis: sc.caption_emphasis })),
    { ...DEFAULT_CAPTION_STYLE, ...(captionAccent ? { accent: captionAccent } : {}), ...(cap.style?.includes('backdrop pill') ? { backdropStyle: 'pill' as const, backdrop: 0.72, fontWeight: 700 } : {}), fontSize: cap.font_size_px, lineHeight: Math.round(cap.font_size_px * 1.27), maxCharsPerLine: cap.max_chars_per_line,
      baselineY: safe.caption_baseline_y_px, centerX: (safe.left_px + (p.width - safe.right_px)) / 2, maxWidth: p.width - safe.left_px - safe.right_px },
  );
  pipeline.setFilm(film, captions);
  const gl = pipeline.renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  document.body.appendChild(pipeline.out);
  return {
    frames: p.duration_s * p.fps, fps: p.fps,
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
    /** Render frame i and return it as a data URL. */
    renderFrame(i: number, mime = 'image/jpeg', quality = 0.95, opts: { overlay?: boolean; captions?: boolean } = {}): string { return pipeline.renderFrame(i, opts).toDataURL(mime, quality); },
    /** Render the storyboard's thumbnail: a clean still (no captions or labels) composed as a bold cover (default) or a clean title card. */
    renderThumbnail(mime = 'image/jpeg', quality = 0.92): string {
      const th = story.thumbnail ?? { time_s: Math.min(story.scenes[0].end_s * 0.7, p.duration_s - 1 / p.fps), headline: p.title };
      const frame = Math.min(p.duration_s * p.fps - 1, Math.max(0, Math.round(th.time_s * p.fps)));
      const out = pipeline.renderFrame(frame, { overlay: false, captions: false });
      if (th.style === 'clean') drawThumbnailTitle(pipeline.ctx, { headline: th.headline, highlight: th.highlight, position: th.position, width: p.width, height: p.height });
      else composeBoldThumbnail(pipeline.ctx, { headline: th.headline, highlight: th.highlight, position: th.position, badge: th.badge, focus: th.focus, zoom: th.zoom, anchor: th.anchor, badgeAt: th.badge_at, arrow: th.arrow, width: p.width, height: p.height,
        font: THUMB_FONTS[th.font ?? 'inter'], grade: THUMB_GRADES[th.grade ?? 'vivid'], tilt: th.tilt,
        textColor: th.palette?.text, highlightColor: th.palette?.highlight, badgeColor: th.palette?.badge, badgeTextColor: th.palette?.badge_text, arrowColor: th.palette?.arrow });
      return out.toDataURL(mime, quality);
    },
  };
}

(window as any).__filmReady = boot().then((api) => { (window as any).__film = api; return { frames: api.frames, fps: api.fps, gpu: api.gpu }; })
  .catch((e) => { (window as any).__filmError = String(e?.stack ?? e); throw e; });
