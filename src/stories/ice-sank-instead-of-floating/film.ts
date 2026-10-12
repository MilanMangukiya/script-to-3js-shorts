import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type OverlayContext, type PostSettings } from '../../library/render/FilmPipeline';
import { loadEarthTextures } from '../../library/planet/Earth';
import { drawChip, drawTag, drawRich } from '../../library/overlay/Labels';
import { smoothstep } from '../../library/util/math';
import { GlassStage } from './stages/GlassStage';
import { MoleculeStage, LATTICE_Y } from './stages/MoleculeStage';
import { LakeStage } from './stages/LakeStage';
import { PolarStage } from './stages/PolarStage';
import { PipeStage, PIPE_TODAY_Y, PIPE_WHATIF_Y } from './stages/PipeStage';
import { T } from './timeline';

const AMBER = '#FFB45C', TEAL = '#66C7C1', ICE = '#BFE9F2';
const fade = (t: number, a: number, b = Infinity, d = 0.35) => smoothstep(a, a + d, t) * (Number.isFinite(b) ? 1 - smoothstep(b - d, b, t) : 1);

/** Which rule is in force in the vignette at time t: true = ice floats (today), false = ice sinks, null = no chip. */
function iceFloats(key: string, t: number): boolean | null {
  switch (key) {
    case 'S01/SH01': return t < T.sink;
    case 'S03/SH01': case 'S03/SH02': case 'S07/SH02': return true;
    case 'S04/SH01': case 'S05/SH01': case 'S06/SH01': case 'S07/SH03': return false;
    case 'S07/SH01': return t < T.seaIceOut + 0.6;
    case 'S09/SH01': return t >= T.rise + 0.5;
    default: return null;
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const tex = await loadEarthTextures(ctx.base, Math.min(16, ctx.renderer.capabilities.getMaxAnisotropy()), { seaIce: true });
  const glass = new GlassStage(ctx.renderer), molecules = new MoleculeStage(), lake = new LakeStage(ctx.renderer);
  const polar = new PolarStage(ctx.renderer, tex), pipes = new PipeStage(ctx.renderer);

  const glassPost: Partial<PostSettings> = { exposure: 0.95, bloomStrength: 0.22, bloomRadius: 0.6, bloomThreshold: 1.0, vignette: 0.5, grain: 0.012 };
  const lakeAbove: Partial<PostSettings> = { exposure: 0.88, bloomStrength: 0.25, bloomRadius: 0.6, bloomThreshold: 1.05, vignette: 0.36, tint: [1.0, 1.0, 1.02] };
  const lakeBelow: Partial<PostSettings> = { exposure: 1.1, bloomStrength: 0.4, bloomRadius: 0.75, bloomThreshold: 0.78, vignette: 0.5 };

  const overlay = (o: OverlayContext) => {
    const { ctx: c, time_s: t, shot, alpha, width: W, height: H } = o, key = shot.key;
    c.globalAlpha = alpha;
    const floats = iceFloats(key, t);
    if (floats !== null) drawChip(c, floats ? 'TODAY  ·  ICE' : 'WHAT IF  ·  ICE', floats ? 'FLOATS' : 'SINKS', 100, 240, { dot: floats ? TEAL : AMBER, valueColor: floats ? '#F4EDE1' : AMBER });

    if (key === 'S02/SH01') {
      drawTag(c, 'SCHEMATIC  •  WATER MOLECULES  •  NOT TO SCALE', 100, 276, { accent: TEAL, size: 22 });
      const st = o.stage as MoleculeStage, f = st.freezeAt(t), h = st.molecules.halfSize;
      const bottom = projectToScreen(st.camera, new THREE.Vector3(0, LATTICE_Y - h.y, 0), W, H);
      if (bottom) {
        const y = Math.min(bottom.y + 74, 1168);
        drawRich(c, 'LIQUID WATER', W / 2, y, { size: 34, weight: 700, tracking: 3, color: ICE, alpha: 1 - smoothstep(0.25, 0.5, f), align: 'center' });
        drawRich(c, 'ICE  ·  OPEN HEXAGONS', W / 2, y, { size: 34, weight: 700, tracking: 3, color: '#F6F0E4', alpha: smoothstep(0.6, 0.9, f), align: 'center' });
      }
      const top = projectToScreen(st.camera, new THREE.Vector3(h.x * 0.55, LATTICE_Y + h.y, 0), W, H);
      if (top) drawRich(c, '+9% VOLUME', Math.min(top.x, 800), Math.max(top.y - 26, 352), { size: 40, weight: 700, color: AMBER, alpha: fade(t, T.ninePct), align: 'center' });
    }
    if (key === 'S03/SH02') drawTag(c, 'LIQUID ALL WINTER  •  ABOUT 4 °C AT DEPTH', 100, 356, { alpha: fade(t, T.underIce + 0.6), accent: TEAL, size: 22 });
    if (key === 'S04/SH01') drawTag(c, 'ILLUSTRATIVE  •  TIME-LAPSE', 100, 356, { alpha: fade(t, T.crystalsStart + 0.4), accent: AMBER, size: 22 });
    if (key === 'S05/SH01') drawTag(c, 'ILLUSTRATIVE  •  MANY WINTERS', 100, 356, { accent: AMBER, size: 22 });
    if (key === 'S07/SH01') drawTag(c, 'ILLUSTRATIVE  •  FLOATING ICE ONLY', 100, 356, { alpha: fade(t, T.seaIceOut - 0.2), accent: AMBER, size: 22 });
    if (key === 'S08/SH01') {
      const cam = o.stage.camera, a = fade(t, 59.5);
      const p1 = projectToScreen(cam, new THREE.Vector3(-0.1, PIPE_TODAY_Y + 0.027, 0.05), W, H), p2 = projectToScreen(cam, new THREE.Vector3(-0.1, PIPE_WHATIF_Y + 0.027, 0.05), W, H);
      if (p1) drawTag(c, 'TODAY  •  FREEZING WATER EXPANDS ≈ 9%', 100, p1.y, { alpha: a, accent: TEAL, size: 22 });
      if (p2) drawTag(c, 'WHAT IF  •  IT SHRINKS, THE PIPE HOLDS', 100, p2.y, { alpha: fade(t, 61.4), accent: AMBER, size: 22 });
      drawTag(c, 'ILLUSTRATIVE', 100, 276, { alpha: a, accent: AMBER, size: 22 });
    }
    c.globalAlpha = 1;
  };

  return {
    shots: {
      'S01/SH01': { stage: glass, post: glassPost },
      'S02/SH01': { stage: molecules, post: { exposure: 1.0, bloomStrength: 0.35, bloomRadius: 0.7, bloomThreshold: 0.85, vignette: 0.5 } },
      'S03/SH01': { stage: lake, post: lakeAbove },
      'S03/SH02': { stage: lake, post: (t) => (t < T.descend + 0.62 ? lakeAbove : lakeBelow) },
      'S04/SH01': { stage: lake, post: lakeBelow },
      'S05/SH01': { stage: lake, post: lakeBelow },
      'S06/SH01': { stage: lake, post: lakeAbove },
      'S07/SH01': { stage: polar, post: { exposure: 1.0, bloomStrength: 0.22, bloomRadius: 0.5, bloomThreshold: 0.95, vignette: 0.36 } },
      'S07/SH02': { stage: polar, post: { exposure: 0.85, bloomStrength: 0.22, bloomRadius: 0.6, bloomThreshold: 1.05, vignette: 0.36 } },
      'S07/SH03': { stage: polar, post: { exposure: 0.85, bloomStrength: 0.22, bloomRadius: 0.6, bloomThreshold: 1.05, vignette: 0.36 } },
      'S08/SH01': { stage: pipes, post: { exposure: 1.05, bloomStrength: 0.3, bloomRadius: 0.6, bloomThreshold: 0.95, vignette: 0.55 } },
      'S09/SH01': { stage: glass, post: glassPost },
    },
    overlay,
  };
}
