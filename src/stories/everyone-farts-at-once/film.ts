import * as THREE from 'three';
import { loadEarthTextures } from '../../library/planet/Earth';
import { projectToScreen, type FilmDefinition, type PostSettings, type Stage } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry, drawCallout } from '../../library/overlay/Labels';
import { ElevatorStage } from './stages/ElevatorStage';
import { CityStage } from './stages/CityStage';
import { GlobeStage } from './stages/GlobeStage';
import { PastureStage } from './stages/PastureStage';
import story from '../../../stories/everyone-farts-at-once.json';
import { T, windowAt, elevatorPpb } from './timeline';

const GRADE: Record<string, Partial<PostSettings>> = {
  elevator: { exposure: 0.9, bloomStrength: 0.22, bloomThreshold: 1.05, bloomRadius: 0.5, saturation: 1.05, contrast: 1.04, vignette: 0.3, grain: 0.008, tint: [1.03, 1.0, 0.95] },
  city: { exposure: 1.0, bloomStrength: 0.22, bloomThreshold: 1.1, bloomRadius: 0.5, saturation: 1.08, contrast: 1.05, vignette: 0.2, grain: 0.006 },
  globe: { exposure: 1.0, bloomStrength: 0.35, bloomThreshold: 0.9, bloomRadius: 0.5, saturation: 1.05, contrast: 1.04, vignette: 0.25, grain: 0.005 },
  pasture: { exposure: 1.0, bloomStrength: 0.2, bloomThreshold: 1.1, bloomRadius: 0.5, saturation: 1.1, contrast: 1.05, vignette: 0.2, grain: 0.006 },
};
/** Cattle worldwide burp roughly 85 Mt of methane a year: about 2.7 tonnes every second. */
const CATTLE_T_PER_S = 2.7;

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const maps = await loadEarthTextures(ctx.base, 8);
  const lift = new ElevatorStage(ctx.renderer), city = new CityStage(ctx.renderer), globe = new GlobeStage(maps, ctx.renderer), field = new PastureStage(ctx.renderer);
  const stageFor: Record<string, [Stage, string]> = { S01: [lift, 'elevator'], S02: [globe, 'globe'], S03: [lift, 'elevator'], S04: [city, 'city'], S05: [city, 'city'], S06: [globe, 'globe'], S07: [field, 'pasture'], S08: [lift, 'elevator'] };
  const specs: Record<string, any> = {}, shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    const key = `${sc.id}/${sh.id}`, [stage, look] = stageFor[sc.id]; specs[key] = sh;
    shots[key] = { stage, post: GRADE[look] };
  }
  // Live readings: equal start/end shows a held value; a fractional end keeps one decimal.
  const live = (tel: any, v: number, decimals = false) => ({ ...tel, start_value: v, end_value: decimals ? v + 2.5 : v });
  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t, width: W, height: H } = o, sc = shot.sceneId;
    let tel = specs[shot.key].hud_telemetry;
    if (sc === 'S03' || sc === 'S08') tel = live(tel, elevatorPpb(t), true);
    if (sc === 'S04') { const v = 26000 * Math.pow(10, -5 * windowAt(t, T.dilute[0], T.dilute[1])); tel = live(tel, v < 10 ? Math.round(v * 10) / 10 : Math.round(v), v < 10); }
    if (sc === 'S05') tel = live(tel, Math.round(500000 * windowAt(t, T.inflate0, T.inflate1) / 1000) * 1000);
    if (sc === 'S07') tel = live(tel, Math.max(0, Math.round(CATTLE_T_PER_S * (t - T.bounds[6]))));
    if (sc === 'S06') tel = { ...tel, start_value: 0.12, end_value: 1.12 };
    if (tel) renderShotHudTelemetry(c, { x: 90, y: 240, telemetry: tel, time_s: t, shotStart_s: t, shotEnd_s: t + 1, alpha: o.alpha });
    if (sc === 'S06') {
      const p = projectToScreen(o.stage.camera, (o.stage as GlobeStage).speckWorld(), W, H);
      const a = windowAt(t, T.bounds[5] + 0.2, T.bounds[5] + 0.6) * (1 - windowAt(t, T.spread0, T.spread0 + 0.5)) * o.alpha;
      if (p && a > 0.01) drawCallout(c, p.x, p.y, 'ALL 8.3 BILLION FARTS', { alpha: a, size: 34, dx: 120, dy: -170, value: '98 m WIDE' });
    }
  } };
}
