import * as THREE from 'three';
import { loadEarthTextures } from '../../library/planet/Earth';
import { projectToScreen, type FilmDefinition, type PostSettings, type Stage } from '../../library/render/FilmPipeline';
import { renderEditorialHud, drawCallout } from '../../library/overlay/Labels';
import { CrosswalkStage } from './stages/CrosswalkStage';
import { GlobeStage } from './stages/GlobeStage';
import story from '../../../stories/everyone-sneezes-at-once.json';
import { T, windowAt, sneezeClock, SPEED_CAR } from './timeline';

const GRADE: Record<string, Partial<PostSettings>> = {
  street: { exposure: 1.0, bloomStrength: 0.22, bloomThreshold: 1.05, bloomRadius: 0.5, saturation: 1.08, contrast: 1.05, vignette: 0.22, grain: 0.006 },
  macro: { exposure: 0.95, bloomStrength: 0.45, bloomThreshold: 0.85, bloomRadius: 0.6, saturation: 1.05, contrast: 1.1, vignette: 0.32, grain: 0.008 },
  aerial: { exposure: 1.0, bloomStrength: 0.35, bloomThreshold: 0.9, bloomRadius: 0.5, saturation: 1.0, contrast: 1.05, vignette: 0.25, grain: 0.005 },
  // A higher threshold keeps the ocean sun glint from blooming into a blob as the planet turns.
  globe: { exposure: 1.0, bloomStrength: 0.22, bloomThreshold: 1.1, bloomRadius: 0.45, saturation: 1.05, contrast: 1.04, vignette: 0.25, grain: 0.005 },
};
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Your eyelids during the sneeze: they snap shut, stay closed for T.eyesShut, then open. */
function drawEyelids(c: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const s = T.sneeze, close = windowAt(t, s - 0.04, s + 0.04) * (1 - windowAt(t, s + T.eyesShut, s + T.eyesShut + 0.16));
  if (close <= 0.001) return;
  const h = H * 0.55 * close, bow = H * 0.1 * (1 - close);
  c.save(); c.fillStyle = '#050505';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, h); c.quadraticCurveTo(W / 2, h + bow, 0, h); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(0, H); c.lineTo(W, H); c.lineTo(W, H - h); c.quadraticCurveTo(W / 2, H - h - bow, 0, H - h); c.closePath(); c.fill();
  c.restore();
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const maps = await loadEarthTextures(ctx.base, 8);
  const street = new CrosswalkStage(ctx.renderer), globe = new GlobeStage(maps, ctx.renderer);
  const stageFor: Record<string, [Stage, string]> = { S01: [street, 'street'], S02: [globe, 'globe'], S03: [street, 'street'], S04: [street, 'street'], S05: [street, 'aerial'], S06: [street, 'macro'], S07: [globe, 'globe'], S08: [street, 'street'] };
  const shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) { const [stage, look] = stageFor[sc.id]; shots[`${sc.id}/${sh.id}`] = { stage, post: GRADE[look] }; }
  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t, width: W, height: H } = o, sc = shot.sceneId, k = sneezeClock(t, sc), a = o.alpha;
    if (sc === 'S01') drawEyelids(c, W, H, t);
    let hud: { label: string; value: string; sub?: string } | null = null;
    if (sc === 'S01') hud = t < T.sneeze ? { label: 'EVERYONE SNEEZES IN', value: `${Math.max(0, T.sneeze - t).toFixed(2)} S`, sub: '8:14 AM · A CITY CROSSWALK' } : { label: 'SNEEZING RIGHT NOW', value: '8,300,000,000', sub: 'THE SAME SECOND, EVERYWHERE' };
    if (sc === 'S02') hud = { label: 'HUMAN EYES SHUT', value: '≈16 BILLION', sub: 'FOR A SPLIT SECOND' };
    if (sc === 'S03') hud = { label: 'DRIVEN WITH EYES SHUT', value: `${(SPEED_CAR * Math.min(T.eyesShut, Math.max(0, k))).toFixed(1)} M`, sub: 'AT 50 KM/H' };
    if (sc === 'S04') hud = { label: 'EYES SHUT FOR', value: `≈${T.eyesShut.toFixed(1)} S`, sub: 'ABOUT ONE LONG BLINK' };
    if (sc === 'S05') hud = { label: 'SNEEZE SOUND HAS TRAVELED', value: `${(0.343 * Math.max(0, k)).toFixed(1)} KM`, sub: 'AT 343 M/S, NEAREST FIRST' };
    // One sneeze first, then all of them once the narration says "Together".
    if (sc === 'S06') hud = t < T.s06Together
      ? { label: 'ONE SNEEZE SPRAYS UP TO', value: fmt(40000 * windowAt(t, T.s06Sneeze, T.s06Sneeze + 1.8)), sub: 'DROPLETS' }
      : { label: 'ALL AT ONCE, UP TO', value: `${fmt(330 * windowAt(t, T.s06Together, T.s06Together + 1.2))} TRILLION`, sub: 'DROPLETS' };
    if (sc === 'S07') hud = { label: 'SNEEZES ON A NORMAL DAY', value: `≈${(GlobeStage.sneezesToday(t) / 1e9).toFixed(1)} BILLION`, sub: 'OVER 24 HOURS, SPREAD OUT' };
    if (sc === 'S08') hud = { label: 'LEFT TO SAY BLESS YOU', value: t < T.exceptDog ? '0' : '1', sub: t < T.exceptDog ? 'ALL 8.3 BILLION SNEEZED' : 'THE DOG' };
    if (hud) renderEditorialHud(c, { x: 90, y: 240, ...hud, alpha: a, valueSize: hud.value.length > 10 ? 88 : 104 });
    if (sc === 'S05') {
      const p = projectToScreen(o.stage.camera, (o.stage as CrosswalkStage).youWorld(), W, H);
      if (p) drawCallout(c, p.x, p.y, 'YOU', { alpha: a * windowAt(t, T.bounds[4] + 0.3, T.bounds[4] + 0.8), size: 34, dx: -140, dy: -150 });
    }
  } };
}
