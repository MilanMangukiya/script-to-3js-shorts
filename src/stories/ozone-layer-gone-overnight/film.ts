import * as THREE from 'three';
import { loadEarthTextures } from '../../library/planet/Earth';
import { type FilmDefinition, type PostSettings, type Stage } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry } from '../../library/overlay/Labels';
import { CafeStreetStage } from './stages/CafeStreetStage';
import { GlobeStage } from './stages/GlobeStage';
import { MoleculeStage } from './stages/MoleculeStage';
import story from '../../../stories/ozone-layer-gone-overnight.json';
import { T, uvAtCounter, readerDoses, burnTimeS05, windowAt } from './timeline';

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const maps = await loadEarthTextures(ctx.base, 8);
  const cafe = new CafeStreetStage(ctx.renderer), globe = new GlobeStage(maps), mols = new MoleculeStage();
  const specs: Record<string, any> = {}, shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    const key = `${sc.id}/${sh.id}`;
    const stage: Stage = key === 'S02/SH01' || key === 'S09/SH01' ? globe : sc.id === 'S08' ? mols : cafe;
    specs[key] = sh;
    const night = sc.id === 'S10', space = stage !== cafe;
    shots[key] = { stage, post: (_t: number): Partial<PostSettings> => ({ exposure: night ? 1.45 : space ? 1.05 : 1,
      bloomStrength: night ? .32 : space ? .4 : .2, bloomThreshold: night ? 1.2 : space ? .9 : 1.4, bloomRadius: .55, vignette: .2, grain: .006, saturation: 1.05, contrast: 1.03 }) };
  }
  // Live readings: start = current value, a dummy span selects formatHudValue decimals.
  const live = (tel: any, value: number, decimals: 0 | 2) => ({ ...tel, start_value: value, end_value: value + (decimals === 2 ? .5 : 0) });
  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t } = o, sc = shot.sceneId;
    let tel = specs[shot.key].hud_telemetry, start = shot.start_s, end = shot.end_s;
    if (shot.key === 'S02/SH01') tel = live(tel, Math.round(100 * GlobeStage.ozoneFraction(t)), 0);
    if (sc === 'S03') tel = live(tel, Math.round(t < T.meterOn ? 780 : 780 + (T.burnSeconds - 780) * windowAt(t, T.meterOn, T.meterPin + .4)), 0);
    if (sc === 'S04') tel = live(tel, readerDoses(t), 2);
    if (sc === 'S05') tel = live(tel, Math.round(burnTimeS05(t)), 0);
    if (sc === 'S06') tel = live(tel, Math.round(uvAtCounter(t)), 0);
    if (sc === 'S08') tel = live(tel, MoleculeStage.ozoneCount(t), 0);
    if (shot.key === 'S09/SH01') tel = live(tel, Math.round(GlobeStage.regrowDay(t)), 0);
    if (tel !== specs[shot.key].hud_telemetry) { start = t; end = t + 1; }
    if (tel) renderShotHudTelemetry(c, { x: 90, y: 240, telemetry: tel, time_s: t, shotStart_s: start, shotEnd_s: end, alpha: o.alpha });
  } };
}
