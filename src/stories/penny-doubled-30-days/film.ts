import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type PostSettings, type Stage } from '../../library/render/FilmPipeline';
import { renderEditorialHud, drawCallout } from '../../library/overlay/Labels';
import { KitchenStage } from './stages/KitchenStage';
import { HouseStage } from './stages/HouseStage';
import story from '../../../stories/penny-doubled-30-days.json';
import { T, dayAt, pennies, dollars, massLabel, windowAt } from './timeline';

const GRADE: Record<string, Partial<PostSettings>> = {
  kitchen: { exposure: 1.05, bloomStrength: 0.28, bloomThreshold: 0.95, bloomRadius: 0.5, saturation: 1.08, contrast: 1.05, vignette: 0.24, grain: 0.006 },
  street: { exposure: 1.0, bloomStrength: 0.22, bloomThreshold: 1.05, bloomRadius: 0.5, saturation: 1.08, contrast: 1.05, vignette: 0.2, grain: 0.005 },
  xray: { exposure: 0.95, bloomStrength: 0.45, bloomThreshold: 0.85, bloomRadius: 0.6, saturation: 1.05, contrast: 1.08, vignette: 0.3, grain: 0.005 },
};

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  ctx.renderer.localClippingEnabled = false;
  const kitchen = new KitchenStage(ctx.renderer), house = new HouseStage(ctx.renderer);
  const stageFor: Record<string, [Stage, string]> = { S01: [kitchen, 'kitchen'], S02: [kitchen, 'kitchen'], S03: [kitchen, 'kitchen'], S04: [kitchen, 'kitchen'], S05: [kitchen, 'kitchen'],
    S06: [house, 'street'], S07: [house, 'street'], S08: [house, 'xray'], S09: [house, 'street'] };
  const shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) { const [stage, look] = stageFor[sc.id]; shots[`${sc.id}/${sh.id}`] = { stage, post: GRADE[look] }; }
  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t, width: W, height: H } = o, sc = shot.sceneId, a = o.alpha, d = dayAt(t), n = pennies(d);
    let hud: { label: string; value: string; sub?: string; color?: string } = { label: `DAY ${d} OF 30`, value: dollars(n), sub: `${n.toLocaleString('en-US')} ${n === 1 ? 'PENNY' : 'PENNIES'} · ${massLabel(n)}` };
    if (sc === 'S01') hud = { label: 'DAY 1 OF 30', value: '$0.01', sub: t < T.caseGone ? 'VS $1,000,000 IN CASH' : '1 PENNY, DOUBLING DAILY' };
    // The day the penny passes the million, the number turns gold.
    if (n >= 100_000_000) hud.color = '#FACC15';
    if (sc === 'S08' && t >= T.cutaway) hud = { label: 'DAY 30 OF 30', value: `+${dollars(pennies(30) / 2)}`, sub: 'ADDED TODAY · HALF THE TOTAL', color: '#FACC15' };
    const pop = n >= 100_000_000 && n < 200_000_000 ? 1 + 0.08 * (1 - windowAt(t, T.days[27], T.days[27] + 0.5)) : 1;
    renderEditorialHud(c, { x: 90, y: 240, ...hud, alpha: a, valueSize: Math.round((hud.value.length > 10 ? 88 : 104) * pop) });
    // Leader-line callouts compare the two prizes in 3D: the million on the table (S01) and beside the mound (S09).
    const call = (world: THREE.Vector3, label: string, value: string | undefined, k: number, dx: number, dy: number) => {
      const p = projectToScreen(o.stage.camera, world, W, H); if (p && k > 0.01) drawCallout(c, p.x, p.y, label, { value, alpha: a * k, size: 34, dx, dy });
    };
    if (sc === 'S01') call((o.stage as KitchenStage).briefAnchor(), '$1,000,000', undefined, windowAt(t, 0.25, 0.6) * (1 - windowAt(t, T.caseClose + 0.1, T.caseClose + 0.35)), 120, -230);
    if (sc === 'S09') {
      const house = o.stage as HouseStage, k = windowAt(t, T.caseReveal, T.caseReveal + 0.5);
      call(house.brief.root.position.clone().add(new THREE.Vector3(0, 0.2, 0)), '$1,000,000', '10 KG', k, -160, -190);
      call(house.summit(), 'THE PENNY', massLabel(pennies(30)), windowAt(t, T.caseReveal + 0.8, T.caseReveal + 1.3), 60, -150);
    }
  } };
}
