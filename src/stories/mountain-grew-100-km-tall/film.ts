import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type PostSettings, type Stage } from '../../library/render/FilmPipeline';
import { loadDayAndClouds } from '../../library/environment/PlanetAtmosphere';
import { renderShotHudTelemetry, drawCallout, type HudTelemetrySpec } from '../../library/overlay/Labels';
import story from '../../../stories/mountain-grew-100-km-tall.json';
import { StreetStage } from './stages/StreetStage';
import { PeakStage } from './stages/PeakStage';
import { LedgeStage } from './stages/LedgeStage';
import { CutawayStage } from './stages/CutawayStage';
import { PlanetStage, win, ease } from './stages/common';
import { growAt, T } from './timeline';

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Live HUD value per shot, with the number of decimals to show. */
function hudValue(key: string, t: number, st: PlanetStage): [number, number] {
  const alt = st.camAlt;
  switch (key) {
    case 'S01/SH01': case 'S02/SH01': return [100 * growAt(t), 0];
    case 'S02/SH02': return [Math.max(0, Math.min(11, Math.floor((t - T.ringsStart) / 0.12) + 1)), 0];
    case 'S03/SH01': return [alt, 2];
    case 'S03/SH02': return [lerp(100, 31, ease((t - 14.6) / 1.6)), 0];
    case 'S04/SH01': return [alt, 2];
    case 'S04/SH02': return [lerp(100, 37, ease((t - 20.0) / 1.5)), 0];
    case 'S05/SH01': return [lerp(19, alt, ease((t - 22.7) / 0.9)), 1];
    case 'S05/SH02': return [lerp(30, alt, ease((t - 25.3) / 0.8)), 1];
    case 'S06/SH01': return [lerp(99.6, 100, ease((t - 28.2) / 0.8)), 1];
    case 'S06/SH02': return [lerp(0, 92, ease((t - T.deathZone) / 0.9)), 0];
    case 'S07/SH01': return [lerp(1, 9, ease((t - 34.0) / 1.2)), 0];
    case 'S07/SH02': return [lerp(100, 12, ease((t - 38.4) / 1.6)), 0];
    case 'S08/SH01': return [26000 * win(t, 42.2, 44.6), 0];
    case 'S08/SH02': return [lerp(1, 13, ease((t - T.crushes) / 0.75)), 0];
    case 'S09/SH01': return [100000 * ease((t - 47.7) / 3.5), 0];
    default: return [0, 0];
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const maps = await loadDayAndClouds(ctx.base, 8);
  const street = new StreetStage(maps, ctx.renderer), peak = new PeakStage(maps), cut = new CutawayStage(maps);
  const snow = new LedgeStage(maps, ctx.renderer, 'snow', 8.8488, 8.849, 2.2), rock = new LedgeStage(maps, ctx.renderer, 'rock', 19.0);
  const bind: Record<string, PlanetStage> = {
    'S01/SH01': street, 'S02/SH01': peak, 'S02/SH02': peak, 'S03/SH01': snow, 'S03/SH02': snow, 'S04/SH01': rock, 'S04/SH02': rock,
    'S05/SH01': peak, 'S05/SH02': peak, 'S06/SH01': peak, 'S06/SH02': peak, 'S07/SH01': peak, 'S07/SH02': peak,
    'S08/SH01': cut, 'S08/SH02': cut, 'S09/SH01': peak, 'S09/SH02': street,
  };
  const post = (st: Stage): Partial<PostSettings> => st === street ? { exposure: 1.08, bloomStrength: 0.22, bloomThreshold: 0.92, vignette: 0.28, grain: 0.01, saturation: 1.06, contrast: 1.03 }
    : st === cut ? { exposure: 1.0, bloomStrength: 0.45, bloomRadius: 0.55, bloomThreshold: 0.8, vignette: 0.32, grain: 0.008, saturation: 1.05, contrast: 1.04 }
    : st instanceof LedgeStage ? { exposure: 0.92, bloomStrength: 0.3, bloomThreshold: 0.88, vignette: 0.3, grain: 0.009, saturation: 1.04, contrast: 1.05 }
    : { exposure: 1.1, bloomStrength: 0.38, bloomRadius: 0.6, bloomThreshold: 0.82, vignette: 0.3, grain: 0.008, saturation: 1.06, contrast: 1.04 };
  const hudSpec: Record<string, HudTelemetrySpec> = {};
  for (const sc of (story as any).scenes) for (const sh of sc.shots) if (sh.hud_telemetry) hudSpec[`${sc.id}/${sh.id}`] = sh.hud_telemetry;

  return {
    shots: Object.fromEntries(Object.entries(bind).map(([k, st]) => [k, { stage: st, post: post(st) }])),
    overlay(o) {
      const { ctx: c, shot, time_s: t, width: W, height: H } = o, st = o.stage as PlanetStage, spec = hudSpec[shot.key];
      if (spec) {
        const [v, dec] = hudValue(shot.key, t, st);
        // Feed the library HUD a finished interpolation (start → end over a past second) so it prints our live value
        // with the intended precision (formatHudValue picks decimals from the start/end span).
        const span = dec === 2 ? 0.5 : dec === 1 ? 5 : 100;
        renderShotHudTelemetry(c, { x: 90, y: 240, time_s: t, shotStart_s: t - 1, shotEnd_s: t, alpha: o.alpha,
          telemetry: { ...spec, start_value: v - span, end_value: dec === 1 ? Math.round(v * 10) / 10 : v }, secondaryText: st.hudLine(t, shot) });
      }
      for (const a of st.anchors(t, shot)) {
        if ((a.alpha ?? 1) <= 0.01) continue;
        const sp = projectToScreen(st.camera, a.world, W, H);
        if (!sp || sp.x < 40 || sp.x > W - 40 || sp.y < 200 || sp.y > 1290) continue;
        drawCallout(c, sp.x, sp.y, a.label, { value: a.value, accent: a.accent, alpha: (a.alpha ?? 1) * o.alpha, dx: a.dx, dy: a.dy, size: 26, safeTop: 420 });
      }
    },
  };
}
