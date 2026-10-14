import * as THREE from 'three';
import { loadEarthTextures } from '../../library/planet/Earth';
import { projectToScreen, type FilmDefinition, type Stage } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry, drawCallout } from '../../library/overlay/Labels';
import { StreetStage } from './stages/StreetStage';
import { GlobeStage } from './stages/GlobeStage';
import { CareStage, NeonatalStage } from './stages/CareStage';
import { LabStage } from './stages/LabStage';
import { MaternityStage } from './stages/MaternityStage';
import story from '../../../stories/last-woman-alive.json';
import { windowAt } from './timeline';

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const maps = await loadEarthTextures(ctx.base, 8);
  const street = new StreetStage(ctx.renderer), globe = new GlobeStage(maps), care = new CareStage(ctx.renderer);
  const lab = new LabStage(ctx.renderer), neonatal = new NeonatalStage(ctx.renderer), maternity = new MaternityStage();
  const sets: Record<string, Stage> = { S01: street, S02: globe, S04: care, S05: lab, S06: lab, S07: neonatal, S08: maternity, S09: street };
  const specs: Record<string, any> = {}, shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    const key = `${sc.id}/${sh.id}`;
    const stage = sc.id === 'S03' ? sh.id === 'SH01' ? street : care : sets[sc.id]; specs[key] = sh;
    shots[key] = { stage, post: { exposure: stage === maternity ? .9 : stage === lab ? 1.06 : 1.02,
      bloomStrength: stage === globe ? .26 : .17, bloomThreshold: .95, bloomRadius: .55,
      vignette: .22, grain: .006, saturation: 1.06, contrast: 1.03 } };
  }
  return { shots, overlay(o) {
    const { ctx: c, shot, stage, time_s: t } = o, sh = specs[shot.key];
    let telemetry = sh.hud_telemetry;
    if (shot.sceneId === 'S01' || shot.key === 'S03/SH01') telemetry = { ...telemetry, timer_label: `T+00:${String(Math.floor(t)).padStart(2, '0')}` };
    if (shot.key === 'S03/SH01') { const hits = t < 12 ? 0 : t < 12.12 ? 1 : 2; telemetry = { ...telemetry, start_value: hits, end_value: hits }; }
    const secondary = shot.key === 'S03/SH02' ? 'GLOBAL HEALTH + CARE / BASELINE' : '';
    renderShotHudTelemetry(c, { x: 90, y: 240, telemetry, time_s: t, shotStart_s: shot.start_s, shotEnd_s: shot.end_s, alpha: o.alpha, secondaryText: secondary });
    let at: THREE.Vector3 | null = null, label = '', alpha = 1, dy = -65;
    if (shot.key === 'S01/SH02') { at = new THREE.Vector3(.44, .02, .63); label = 'CONNECTION LOST'; alpha = windowAt(t, 3, 3.4); }
    if (shot.key === 'S05/SH02') { at = lab.storageAnchor; label = 'PRESERVED EMBRYOS'; alpha = windowAt(t, 25.4, 26); }
    if (at) { const p = projectToScreen(stage.camera, at, o.width, o.height);
      if (p && p.x > 80 && p.x < 990 && p.y > 450 && p.y < 1160)
        drawCallout(c, p.x, p.y, label, { size: 25, alpha: alpha * o.alpha, dx: 60, dy, accent: '#38BDF8', safeTop: 440, safeBottom: 1190 });
    }
  } };
}
