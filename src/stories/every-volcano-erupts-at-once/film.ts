import * as THREE from 'three';
import { loadEarthTextures } from '../../library/planet/Earth';
import { type FilmDefinition, type PostSettings, type Stage } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry } from '../../library/overlay/Labels';
import { VolcanoCityStage } from './stages/VolcanoCityStage';
import { GlobeStage } from './stages/GlobeStage';
import { FarmStage } from './stages/FarmStage';
import story from '../../../stories/every-volcano-erupts-at-once.json';

/** Per-scene grade: clear morning, ash-dark street, milky haze after, cold farm light. */
const GRADE: Record<string, Partial<PostSettings>> = {
  S01: { exposure: 1.0, bloomStrength: 0.28, bloomThreshold: 1.0, bloomRadius: 0.5, saturation: 1.06, contrast: 1.06, vignette: 0.22, grain: 0.006 },
  S02: { exposure: 1.0, bloomStrength: 0.35, bloomThreshold: 0.9, bloomRadius: 0.5, saturation: 1.05, contrast: 1.04, vignette: 0.25, grain: 0.005 },
  S03: { exposure: 1.0, bloomStrength: 0.3, bloomThreshold: 1.0, bloomRadius: 0.5, saturation: 1.05, contrast: 1.06, vignette: 0.22, grain: 0.006 },
  S04: { exposure: 1.25, bloomStrength: 0.45, bloomThreshold: 0.85, bloomRadius: 0.6, saturation: 0.78, contrast: 1.05, vignette: 0.38, grain: 0.012, tint: [1.06, 0.99, 0.9] },
  S05: { exposure: 1.02, bloomStrength: 0.3, bloomThreshold: 1.0, bloomRadius: 0.6, saturation: 0.72, contrast: 0.96, lift: 0.02, vignette: 0.2, grain: 0.007, tint: [1.0, 1.0, 1.02] },
  S06: { exposure: 1.0, bloomStrength: 0.3, bloomThreshold: 0.95, bloomRadius: 0.5, saturation: 1.0, contrast: 1.04, vignette: 0.25, grain: 0.005 },
  S07: { exposure: 1.08, bloomStrength: 0.2, bloomThreshold: 1.1, bloomRadius: 0.5, saturation: 0.82, contrast: 1.0, vignette: 0.25, grain: 0.008, tint: [0.97, 1.0, 1.05] },
  S08: { exposure: 1.05, bloomStrength: 0.4, bloomThreshold: 0.95, bloomRadius: 0.6, saturation: 0.95, contrast: 1.06, vignette: 0.3, grain: 0.008, tint: [1.13, 1.0, 0.86] },
  S09: { exposure: 0.98, bloomStrength: 0.3, bloomThreshold: 1.0, bloomRadius: 0.6, saturation: 0.82, contrast: 1.0, lift: 0.006, vignette: 0.22, grain: 0.007, tint: [1.0, 1.0, 1.02] },
};

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const maps = await loadEarthTextures(ctx.base, 8);
  const city = new VolcanoCityStage(ctx.renderer), globe = new GlobeStage(maps, ctx.renderer), farm = new FarmStage(ctx.renderer);
  const stageFor: Record<string, Stage> = { S01: city, S02: globe, S03: city, S04: city, S05: city, S06: globe, S07: farm, S08: farm, S09: city };
  const specs: Record<string, any> = {}, shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    const key = `${sc.id}/${sh.id}`; specs[key] = sh;
    shots[key] = { stage: stageFor[sc.id], post: GRADE[sc.id] };
  }
  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t } = o;
    let tel = specs[shot.key].hud_telemetry;
    if (shot.sceneId === 'S06') tel = { ...tel, timer_label: `WEEK ${Math.round(GlobeStage.week(t))}` };
    if (tel) renderShotHudTelemetry(c, { x: 90, y: 240, telemetry: tel, time_s: t, shotStart_s: t, shotEnd_s: t + 1, alpha: o.alpha });
  } };
}
