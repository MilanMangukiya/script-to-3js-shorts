import { type FilmDefinition, type Stage, projectToScreen } from '../../library/render/FilmPipeline';
import { loadEarthTextures } from '../../library/planet/Earth';
import { renderShotHudTelemetry, drawCallout } from '../../library/overlay/Labels';
import { PatioStage, SunAngleStage, PolarStage } from './stages/GroundStages';
import { EarthStage } from './stages/EarthStage';
import { angleLatitude, ramp } from './timeline';
import { T } from './timeline';
import story from '../../../stories/earth-without-tilt.json';

export async function createFilm(ctx: { renderer: import('three').WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const textures = await loadEarthTextures(ctx.base, 4);
  const patio = new PatioStage(ctx.renderer), angle = new SunAngleStage(ctx.renderer), polar = new PolarStage(ctx.renderer), earth = new EarthStage(textures);
  const stages: Record<string, Stage> = {
    'S01/SH01': patio, 'S02/SH01': earth, 'S03/SH01': patio, 'S04/SH01': earth,
    'S05/SH01': angle, 'S06/SH01': patio, 'S06/SH02': polar, 'S07/SH01': earth,
    'S08/SH01': patio, 'S08/SH02': patio,
  };
  const specs = Object.fromEntries(story.scenes.flatMap(sc => sc.shots.map(sh => [`${sc.id}/${sh.id}`, sh])));
  return {
    shots: Object.fromEntries(Object.entries(stages).map(([key, stage]) => [key, { stage,
      post: { exposure: stage === earth ? 1.05 : 1, bloomStrength: stage === earth ? .16 : .12,
        bloomThreshold: 1.2, vignette: .19, grain: .004, saturation: 1.03, contrast: 1.01 } }])),
    overlay(o) {
      const sh = specs[o.shot.key], t = o.time_s;
      let telemetry = sh.hud_telemetry;
      if (o.shot.sceneId === 'S05') telemetry = { ...telemetry, metric_label: 'LATITUDE', start_value: angleLatitude(t), end_value: angleLatitude(t), unit: '°N' };
      if (o.shot.sceneId === 'S07') telemetry = { ...telemetry, metric_label: 'SOLAR FLUX', start_value: earth.solarFlux, end_value: earth.solarFlux, unit: '% OF JULY' };
      if (o.shot.sceneId === 'S08' && o.shot.shotId === 'SH02') telemetry = { ...telemetry,
        timer_label: `JUNE · SOLAR ${t < T.clockFlipSwitch ? '20:00' : '17:00'}` };
      renderShotHudTelemetry(o.ctx, { x: 90, y: 240, telemetry, time_s: t, shotStart_s: o.shot.start_s, shotEnd_s: o.shot.end_s, alpha: o.alpha });
      if (o.shot.sceneId === 'S05' && t >= 24.0) {
        const p = projectToScreen(angle.camera, angle.post.position.clone().setY(.88), o.width, o.height);
        if (p && p.y > 430 && p.y < 1130) drawCallout(o.ctx, p.x, p.y, `${Math.round(90 - angleLatitude(t))}° SUN`, {
          size: 25, dx: 140, dy: -150, accent: '#FACC15', alpha: o.alpha * ramp(t, 24, 24.4), safeTop: 420, safeBottom: 1180,
        });
      }
    },
  };
}
