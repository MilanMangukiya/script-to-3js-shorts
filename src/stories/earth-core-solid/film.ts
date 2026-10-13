import * as THREE from 'three';
import type { FilmDefinition, OverlayContext } from '../../library/render/FilmPipeline';
import { projectToScreen } from '../../library/render/FilmPipeline';
import { loadEarthTextures } from '../../library/planet/Earth';
import { drawCallout, drawChip, drawTag } from '../../library/overlay/Labels';
import { smoothstep } from '../../library/util/math';
import { frac, type Timing } from './stages/common';
import { CoreStage } from './stages/CoreStage';
import { CompassStage } from './stages/CompassStage';
import { SeaStage, SalmonStage } from './stages/WildlifeStages';
import { AuroraStage } from './stages/AuroraStage';
import { SolarWindStage } from './stages/SolarWindStage';
import { VolcanoStage } from './stages/VolcanoStage';

const SLUG = 'earth-core-solid';
const CYAN = '#7fe3ff', AMBER = '#ffc37a';

/** Labels per shot: [chip title, chip value, tag, chip appears at fraction, tag appears at fraction, chip dot colour]. */
const NOTES: Record<string, [string, string, string, number, number, string?]> = {
  'S01/SH01': ['WHAT IF', 'THE WHOLE CORE FREEZES', 'HYPOTHETICAL · SCHEMATIC CUTAWAY', 0.4, 0.45],
  'S02/SH01': ['TODAY', 'THE CORE', 'CUTAWAY · TRUE LAYER SIZES', 0.55, 0.6, CYAN],
  'S03/SH01': ['DYNAMO', 'MOVING LIQUID IRON', 'SCHEMATIC FIELD LINES', 0.1, 0.12, CYAN],
  'S04/SH01': ['COMPASS', 'NO RELIABLE NORTH', 'ILLUSTRATIVE', 0.05, 0.05],
  'S04/SH02': ['BIRDS', 'LOSE A MAGNETIC GUIDE', 'ILLUSTRATIVE', 0.06, 0.06, CYAN],
  'S04/SH03': ['SALMON', 'LOSE A MAGNETIC GUIDE', 'ILLUSTRATIVE', 0.06, 0.06, CYAN],
  'S05/SH01': ['AURORA', 'NEEDS THE FIELD', 'ILLUSTRATIVE', 0.05, 0.05, CYAN],
  'S05/SH02': ['SOLAR WIND', 'NO MAGNETIC SHIELD', 'SCHEMATIC · OVER MILLIONS OF YEARS', 0.06, 0.08],
  'S05/SH03': ['MARS', 'NO GLOBAL MAGNETIC FIELD', '~100 G OF AIR LOST EVERY SECOND (MAVEN)', 0.06, 0.12],
  'S06/SH01': ['VOLCANOES', 'STILL ACTIVE', 'ILLUSTRATIVE', 0.06, 0.06],
  'S06/SH02': ['MANTLE', 'STILL CONVECTING', 'HEAT: RADIOACTIVE DECAY + LEFTOVER HEAT', 0.06, 0.12],
  'S07/SH01': ['INNER CORE', 'GROWS ~1 MM A YEAR', 'BILLIONS OF YEARS TO FREEZE', 0.05, 0.12, CYAN],
};

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const story = await fetch(`${ctx.base}stories/${SLUG}.json`).then((r) => r.json());
  const T: Timing = {};
  for (const sc of story.scenes) { T[sc.id] = { start: sc.start_s, end: sc.end_s }; for (const sh of sc.shots) T[`${sc.id}/${sh.id}`] = { start: sh.start_s, end: sh.end_s }; }
  const tex = await loadEarthTextures(ctx.base, Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy()));
  const D = story.project.duration_s;
  const core = new CoreStage(T, tex, D), compass = new CompassStage(T, ctx.renderer), sea = new SeaStage(T), salmon = new SalmonStage(T);
  const aurora = new AuroraStage(T), wind = new SolarWindStage(T, tex), volcano = new VolcanoStage(T);

  const space = { bloomStrength: 0.4, bloomThreshold: 0.75, vignette: 0.5 };
  const shots: FilmDefinition['shots'] = {
    'S01/SH01': { stage: core, post: space }, 'S02/SH01': { stage: core, post: { ...space, bloomStrength: 0.45 } }, 'S03/SH01': { stage: core, post: space },
    'S04/SH01': { stage: compass, post: { bloomStrength: 0.3, vignette: 0.6, tint: [1.04, 1.0, 0.94] } },
    'S04/SH02': { stage: sea, post: { bloomStrength: 0.3, saturation: 1.05 } },
    'S04/SH03': { stage: salmon, post: { bloomStrength: 0.25, saturation: 1.05 } },
    'S05/SH01': { stage: aurora, post: { exposure: 1.1, bloomStrength: 0.45, bloomThreshold: 0.6, vignette: 0.55 } },
    'S05/SH02': { stage: wind, post: space }, 'S05/SH03': { stage: wind, post: space },
    'S06/SH01': { stage: volcano, post: { bloomStrength: 0.36, bloomThreshold: 0.75, vignette: 0.55 } },
    'S06/SH02': { stage: core, post: space }, 'S07/SH01': { stage: core, post: space },
  };

  const overlay = (o: OverlayContext) => {
    const { ctx: c, shot, time_s: t, alpha } = o;
    const u = frac(T, shot.key, t), note = NOTES[shot.key];
    const at = (p: THREE.Vector3) => projectToScreen(o.stage.camera, p, o.width, o.height);
    const fadeEnd = shot.key === 'S07/SH01' ? 1 - smoothstep(0.7, 0.8, u) : 1;   // the last second matches frame 0: no labels
    if (note) {
      const [title, value, tag, chipAt, tagAt, dot] = note;
      c.globalAlpha = alpha * fadeEnd * smoothstep(chipAt, chipAt + 0.06, u); drawChip(c, title, value, 85, 225, { dot: dot ?? AMBER, valueColor: AMBER });
      c.globalAlpha = alpha * fadeEnd * smoothstep(tagAt, tagAt + 0.06, u); drawTag(c, tag, 105, 342, { accent: AMBER, size: 20 });
      c.globalAlpha = alpha;
    }
    if (shot.key === 'S02/SH01') {
      const pi = at(core.cut.pointOn(new THREE.Vector3(0, -0.05, 0.1))), po = at(core.cut.pointOn(new THREE.Vector3(0, -0.2, 0.38)));
      const ki = smoothstep(0.08, 0.16, u), ko = smoothstep(0.55, 0.63, u);
      if (pi && ki > 0) drawCallout(c, 'SOLID INNER CORE', pi.x, pi.y, -160, -380, { alpha: ki * alpha, size: 38, sub: '~6,000 °C AT THE CENTRE' });
      if (po && ko > 0) drawCallout(c, 'LIQUID OUTER CORE', po.x, po.y, 110, -190, { alpha: ko * alpha, size: 38, sub: 'MOLTEN IRON', color: '#FF9F4A' });
    }
    if (shot.key === 'S06/SH02') {
      const p = at(core.cut.pointOn(new THREE.Vector3(0, -0.12, 0.26))), k = smoothstep(0.2, 0.3, u);
      if (p && k > 0) drawCallout(c, 'FROZEN CORE', p.x, p.y, -150, -420, { alpha: k * alpha, size: 38, color: '#9fb4c8' });
    }
    c.globalAlpha = 1;
  };
  return { shots, overlay };
}
