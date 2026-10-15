import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type PostSettings } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry, drawCallout } from '../../library/overlay/Labels';
import { SkyStreetStage } from './stages/SkyStreetStage';
import story from '../../../stories/sky-disappeared.json';
import { SunSkylightRig } from '../../library/environment/SunSkylightRig';
import { T, DEG, windowAt, skyAmountAt, sunsetAltitude, sunriseAltitude, clockLabel, carState } from './timeline';

/** Percentage of the solar disc above the local horizon (sea at dusk, eastern hills at dawn). */
const directSun = (alt: number, horizon: number) => 100 * SunSkylightRig.discFraction(alt * DEG, horizon * DEG, T.sunRadiusDeg * DEG);

/** Eye adaptation is a time-varying exposure: sun-adapted by default, shade-adapted after a delay. Around sunset and
 *  sunrise the eye's roughly logarithmic response is modelled from the visible disc fraction: a thin sliver still
 *  looks like daylight, so the light holds until the last moment and returns at the first one. */
function exposureFor(key: string, t: number): number {
  switch (key) {
    case 'S02/SH01': return .95;
    case 'S04/SH01': return 1 + 2.8 * windowAt(t, T.s04Edge + .55, T.bounds[4] - .3);
    case 'S06/SH01': return 3.4;
    case 'S06/SH02': return 1.6 + 1.4 * windowAt(t, T.s06Cut, T.bounds[6]);
    case 'S07/SH01': case 'S07/SH02': case 'S08/SH01': return .55;
    case 'S08/SH02': return t < T.sunset ? Math.min(2.2, Math.max(1, (directSun(sunsetAltitude(t), T.seaHorizonDeg) / 100) ** -.5))
      : 2.2 + .4 * windowAt(t, T.sunset + .3, T.sunset + 1.7);
    case 'S09/SH01': case 'S09/SH02': return t < T.sunrise ? 1.55
      : Math.min(3.2, Math.max(.55, .55 * Math.max(1e-4, directSun(sunriseAltitude(t), T.dawnHorizonDeg) / 100) ** -.75));
    default: return 1;
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const stage = new SkyStreetStage(ctx.renderer);
  const specs: Record<string, any> = {}, shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    // The sun's round glare is drawn by the rig; bloom stays off while the disc is in frame and returns for lamps at night.
    const key = `${sc.id}/${sh.id}`, sunShot = key === 'S02/SH01' || sc.id >= 'S07';
    const night = (t: number) => (key === 'S08/SH02' && t >= T.sunset) || (key === 'S09/SH01' && t < T.sunrise);
    specs[key] = sh;
    shots[key] = { stage, post: (t: number): Partial<PostSettings> => ({ exposure: exposureFor(key, t),
      bloomStrength: sunShot && !night(t) ? 0 : .26, bloomThreshold: night(t) ? 1.5 : .95, bloomRadius: .55, vignette: .2, grain: .006, saturation: 1.04, contrast: 1.04 }) };
  }
  // Live values: "start" is the current reading; a dummy span selects the decimals in formatHudValue.
  const live = (tel: any, value: number, decimals: 0 | 1 | 2) => ({ ...tel, start_value: value, end_value: value + (decimals === 2 ? .5 : decimals === 1 ? 2.5 : 0) });
  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t } = o, sc = shot.sceneId;
    let tel = specs[shot.key].hud_telemetry, start = shot.start_s, end = shot.end_s;
    if (sc === 'S01') tel = live(tel, Math.round(100 * skyAmountAt(t)), 0);
    if (sc === 'S05') tel = live(tel, Math.round(carState(t).v * 3.6), 0);
    if (sc === 'S07' || shot.key === 'S08/SH01') tel = live({ ...tel, timer_label: `LOCAL TIME ${clockLabel(t, T.sunset, 18 * 60)}` }, sunsetAltitude(t), 2);
    if (shot.key === 'S08/SH02') tel = live({ ...tel, timer_label: `LOCAL TIME ${clockLabel(t, T.sunset, 18 * 60)}` }, Math.round(directSun(sunsetAltitude(t), T.seaHorizonDeg)), 0);
    if (sc === 'S09') tel = live({ ...tel, timer_label: `LOCAL TIME ${clockLabel(t, T.sunrise, 6 * 60)}` }, Math.round(directSun(sunriseAltitude(t), T.dawnHorizonDeg)), 0);
    if (tel !== specs[shot.key].hud_telemetry) { start = t; end = t + 1; }
    if (tel) renderShotHudTelemetry(c, { x: 90, y: 240, telemetry: tel, time_s: t, shotStart_s: start, shotEnd_s: end, alpha: o.alpha });
    // One 3D leader callout: where the driver first sees you (distance from the driver's eye at the reveal).
    if (sc === 'S05' && t >= T.s05Reveal + .1 && t < T.s05Reveal + 1.6) {
      const p = projectToScreen(stage.camera, stage.youChest, o.width, o.height);
      const seenAt = Math.round(carState(T.s05Reveal).z - .3);
      if (p && p.x > 80 && p.x < 1000 && p.y > 440 && p.y < 1180)
        drawCallout(c, p.x, p.y, `SEEN AT ${seenAt} M`, { size: 26, alpha: o.alpha * windowAt(t, T.s05Reveal + .1, T.s05Reveal + .35), dx: 120, dy: -130, accent: '#FACC15', safeTop: 440, safeBottom: 1190 });
    }
  } };
}
