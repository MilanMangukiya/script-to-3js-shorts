// Look-development entry: renders a library asset test scene (src/lookdev/*.ts) through the real FilmPipeline, without
// a storyboard or narration. Usage: index.html?name=<lookdev>&scale=1 (driven by tools/lookdev.mjs).
import { FilmPipeline, type FilmDefinition } from '../library/render/FilmPipeline';
import type * as THREE from 'three';
import * as humans from './humans';
import * as buildings from './buildings';
import * as sky from './sky';
import * as nature from './nature';
import * as interior from './interior';

export interface LookdevModule {
  /** Pseudo-storyboard: duration and scenes with shots and cameras (same shape as storyboard scenes). */
  spec: { duration_s: number; quality?: 'standard' | 'cinematic'; scenes: any[] };
  createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition>;
}
const MODULES: Record<string, LookdevModule> = { humans, buildings, sky, nature, interior };

async function boot() {
  const q = new URLSearchParams(location.search), name = q.get('name')!, scale = Number(q.get('scale') ?? '1'), base = '/';
  for (const [weight, file] of [[600, 'Inter-SemiBold'], [700, 'Inter-Bold'], [900, 'Inter-Black']] as const)
    document.fonts.add(await new FontFace('Inter', `url(${base}assets/library/fonts/${file}.woff2)`, { weight: String(weight) }).load());
  const mod = MODULES[name];
  if (!mod) throw new Error(`Unknown lookdev module ${name}`);
  const pipeline = new FilmPipeline({ width: 1080, height: 1920, fps: 30, duration_s: mod.spec.duration_s, scenes: mod.spec.scenes, scale, quality: mod.spec.quality ?? 'cinematic' });
  pipeline.setFilm(await mod.createFilm({ renderer: pipeline.renderer, base }));
  document.body.appendChild(pipeline.out);
  return { frames: mod.spec.duration_s * 30, fps: 30, renderFrame: (i: number, mime = 'image/jpeg', quality = 0.95) => pipeline.renderFrame(i).toDataURL(mime, quality) };
}
(window as any).__filmReady = boot().then((api) => { (window as any).__film = api; return { frames: api.frames, fps: api.fps, gpu: 'lookdev' }; })
  .catch((e) => { (window as any).__filmError = String(e?.stack ?? e); throw e; });
