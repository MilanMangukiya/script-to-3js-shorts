import * as THREE from 'three';
import { type FilmDefinition, type PostSettings } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry } from '../../library/overlay/Labels';
import { ParkStage } from './stages/ParkStage';
import story from '../../../stories/earth-1000f-five-seconds.json';
import { T, tau, hot, windowAt, skinF, leafF, paperF } from './timeline';

/** While the air is 1000 °F the picture carries the heat: warm grade, contrast and shimmer, cut off the instant it ends. */
function heatPost(t: number, nextDay: boolean): Partial<PostSettings> {
  const on = hot(t) ? windowAt(t, T.hit, T.hit + .25) * (1 - windowAt(t, T.end - .08, T.end)) : 0;
  const base: Partial<PostSettings> = { exposure: 1 + .05 * on, bloomStrength: .22 + .14 * on, bloomThreshold: 1.1 - .12 * on, bloomRadius: .55, vignette: .2 + .2 * on, grain: .006,
    saturation: 1.04 + .2 * on, contrast: 1.03 + .12 * on, heatHaze: 1.2 * on,
    tint: [1 + .22 * on, 1 - .01 * on, 1 - .26 * on] };
  if (nextDay) Object.assign(base, { saturation: .92, contrast: 1.02, tint: [1.03, 1.0, .95] as [number, number, number] });
  return base;
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const park = new ParkStage(ctx.renderer);
  const specs: Record<string, any> = {}, shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    const key = `${sc.id}/${sh.id}`, nextDay = sc.id === 'S09' || sc.id === 'S10';
    specs[key] = sh;
    shots[key] = { stage: park, post: (t: number) => heatPost(t, nextDay) };
  }
  // Live readings: "start" is the current value; equal start/end keeps whole numbers.
  const live = (tel: any, value: number, label?: string) => ({ ...tel, ...(label ? { timer_label: label } : {}), start_value: Math.round(value), end_value: Math.round(value) });
  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t } = o, sc = shot.sceneId, k = tau(t);
    let tel = specs[shot.key].hud_telemetry;
    const clock = `ELAPSED ${Math.max(0, Math.min(k, 5)).toFixed(1)} s`;
    if (sc === 'S01' || sc === 'S02' || shot.key === 'S08/SH01') tel = live(tel, hot(t) ? 1000 : 77, clock);
    if (sc === 'S03' || sc === 'S04') tel = live(tel, skinF(k), clock);
    if (sc === 'S05' || sc === 'S06') tel = live(tel, leafF(k), clock);
    if (sc === 'S07') tel = live(tel, paperF(k), clock);
    if (tel) renderShotHudTelemetry(c, { x: 90, y: 240, telemetry: tel, time_s: t, shotStart_s: t, shotEnd_s: t + 1, alpha: o.alpha });
  } };
}
