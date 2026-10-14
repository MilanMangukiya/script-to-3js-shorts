import * as THREE from 'three';
import { loadEarthTextures } from '../../library/planet/Earth';
import { projectToScreen, type FilmDefinition, type Stage } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry, drawCallout } from '../../library/overlay/Labels';
import { StreetStage } from './stages/StreetStage';
import { GlobeStage, HarbourStage } from './stages/WorldStages';
import { CareStage, MaternityStage, StorageStage } from './stages/ClinicStages';
import story from '../../../stories/last-man-alive.json';
import { windowAt } from './timeline';

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const maps = await loadEarthTextures(ctx.base, 8);
  const street = new StreetStage(ctx.renderer), globe = new GlobeStage(maps), port = new HarbourStage(ctx.renderer);
  const clinic = new CareStage(), maternity = new MaternityStage(), storage = new StorageStage();
  const sets: Record<string, Stage> = { S01: street, S02: globe, S03: street, S04: port, S05: clinic, S06: maternity, S07: maternity, S08: storage, S09: street };
  const specs: Record<string, any> = {};
  const shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    const key = `${sc.id}/${sh.id}`, stage = sets[sc.id]; specs[key] = sh;
    shots[key] = { stage, post: { exposure: stage === port ? 1.16 : stage === maternity ? .94 : 1.03,
      bloomStrength: stage === globe ? .26 : .18, bloomThreshold: .95, bloomRadius: .55,
      vignette: .23, grain: .006, saturation: 1.06, contrast: 1.03 } };
  }
  return { shots, overlay(o) {
    const { ctx: c, shot, stage, time_s: t } = o, sh = specs[shot.key];
    let secondary = shot.sceneId === 'S04' ? 'SEA CREWS / 2024 SURVEY' : shot.sceneId === 'S05' ? 'GLOBAL HEALTH + SOCIAL CARE' : '';
    let telemetry = sh.hud_telemetry;
    if (shot.sceneId === 'S07' && shot.shotId === 'SH01') {
      // This scene illustrates a possible next birth, not an interpolated fraction of a person.
      const v = t < 34.4 ? 1 : 2; telemetry = { ...telemetry, start_value: v, end_value: v };
      secondary = 'ONE-TIME DISAPPEARANCE';
    }
    if (shot.sceneId === 'S01' || shot.sceneId === 'S03') telemetry = { ...telemetry, timer_label: `T+00:${String(Math.floor(t)).padStart(2, '0')}` };
    if (shot.key === 'S03/SH01') {
      const u = Math.max(0, Math.min(1, (t - 10.5) / 1.5));
      const speed = t >= 12 ? 0 : Math.hypot(4.3, 11) * 6 * u * (1 - u) / 1.5 * 3.6;
      telemetry = { ...telemetry, start_value: speed, end_value: speed };
    }
    renderShotHudTelemetry(c, { x: 90, y: 240, telemetry, time_s: t, shotStart_s: shot.start_s, shotEnd_s: shot.end_s, alpha: o.alpha, secondaryText: secondary });
    let at: THREE.Vector3 | null = null, label = '', alpha = 1, dy = -75;
    if (shot.key === 'S03/SH02') { at = new THREE.Vector3(6.3, .8, -6); label = 'DRIVER: ABSENT'; }
    if (shot.key === 'S06/SH02') { at = new THREE.Vector3(0, .94, -1.5); label = 'PREGNANCIES CONTINUE'; alpha = windowAt(t, 30.4, 31); }
    if (shot.key === 'S08/SH02') { at = new THREE.Vector3(0, 1.5, -1); label = 'PRESERVED SAMPLES'; dy = 110; }
    if (at) { const p = projectToScreen(stage.camera, at, o.width, o.height);
      if (p && p.y > 430 && p.y < 1170 && p.x > 80 && p.x < 990)
        drawCallout(c, p.x, p.y, label, { size: 25, alpha: alpha * o.alpha, dx: 65, dy, accent: '#38BDF8', safeTop: 440, safeBottom: 1190 });
    }
  } };
}
