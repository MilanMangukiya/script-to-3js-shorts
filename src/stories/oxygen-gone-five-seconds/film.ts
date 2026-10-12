import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type OverlayContext, type PostSettings } from '../../library/render/FilmPipeline';
import { loadEarthTextures } from '../../library/planet/Earth';
import { drawChip, drawTag, drawCallout, drawRich } from '../../library/overlay/Labels';
import { smoothstep, clamp } from '../../library/util/math';
import { CandleStage } from './stages/CandleStage';
import { EarthStage, SAMPLE_BOX } from './stages/EarthStage';
import { CoastStage, BAROMETER_POS, SEA_Y, pressureAt, contourAltitudeAt } from './stages/CoastStage';
import { CampfireStage } from './stages/CampfireStage';
import { AirlinerStage } from './stages/AirlinerStage';
import { UnderwaterStage } from './stages/UnderwaterStage';
import { T } from './timeline';

const AMBER = '#FFB45C', TEAL = '#66C7C1', EMBER = '#F0704A';
const fade = (t: number, a: number, b = Infinity, d = 0.35) => smoothstep(a, a + d, t) * (Number.isFinite(b) ? 1 - smoothstep(b - d, b, t) : 1);

/** Is atmospheric oxygen present in the vignette shown at time t? null hides the status chip. */
function oxygenPresent(key: string, t: number): boolean | null {
  switch (key) {
    case 'S01/SH01': return t < T.candleOut;
    case 'S02/SH01': return null;
    case 'S03/SH01': return t < T.pressureDrop;
    case 'S05/SH01': return t < T.fireOut;
    case 'S06/SH01': return t < T.engineOut;
    case 'S08/SH01': return t >= T.oxygenBack;
    case 'S08/SH02': case 'S09/SH01': return true;
    default: return false;
  }
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const tex = await loadEarthTextures(ctx.base, Math.min(16, ctx.renderer.capabilities.getMaxAnisotropy()));
  const candle = new CandleStage(), earth = new EarthStage(tex), coast = new CoastStage(ctx.renderer);
  const campfire = new CampfireStage(), airliner = new AirlinerStage(ctx.renderer), sea = new UnderwaterStage();

  const candlePost: Partial<PostSettings> = { exposure: 1.0, bloomStrength: 0.5, bloomRadius: 0.75, bloomThreshold: 0.9, vignette: 0.62, grain: 0.014 };
  const coastPost: Partial<PostSettings> = { exposure: 0.92, bloomStrength: 0.28, bloomRadius: 0.6, bloomThreshold: 1.0, vignette: 0.36, tint: [1.02, 1.0, 0.97] };
  const firePost: Partial<PostSettings> = { exposure: 1.1, bloomStrength: 0.62, bloomRadius: 0.8, bloomThreshold: 0.8, vignette: 0.6, grain: 0.016 };

  const overlay = (o: OverlayContext) => {
    const { ctx: c, time_s: t, shot, alpha, width: W, height: H } = o, key = shot.key;
    c.globalAlpha = alpha;
    const present = oxygenPresent(key, t);
    if (present !== null) drawChip(c, 'O_2 IN AIR', present ? '21%' : '0%', 100, 240, { dot: present ? TEAL : EMBER, valueColor: present ? '#F4EDE1' : AMBER });

    if (key === 'S02/SH01') {
      drawTag(c, 'SCHEMATIC  •  100 AIR MOLECULES  •  NOT TO SCALE', 100, 276, { accent: TEAL, size: 22 });
      const cam = o.stage.camera, bottom = projectToScreen(cam, SAMPLE_BOX.center.clone().add(new THREE.Vector3(0, -SAMPLE_BOX.size.y / 2, SAMPLE_BOX.size.z / 2)), W, H);
      if (bottom) {
        const gone = t >= T.moleculesOut, y = bottom.y + 96;
        const parts: [string, string][] = [['N_2 78', '#9DB7E6'], ['O_2 ' + (gone ? '0' : '21'), gone ? AMBER : '#FF8A73'], ['Ar 1', '#DCCFFF']];
        let x = W / 2 - 250;
        for (const [txt, col] of parts) { drawRich(c, txt, x, y, { size: 38, weight: 700, color: col }); x += 190; }
      }
    }

    if (key === 'S03/SH01') {
      const cam = o.stage.camera;
      const a1 = fade(t, 12.7, 17.3, 0.5);
      const p = projectToScreen(cam, BAROMETER_POS.clone().add(new THREE.Vector3(0, 0.215, 0)), W, H);
      if (p && a1 > 0.01) {
        // Centred readout above the dial so it never runs off the frame.
        const v = pressureAt(t), settled = t > T.pressureDrop + 1.3, before = t < T.pressureDrop, x = clamp(p.x, 360, 720);
        drawRich(c, before ? '1013 hPa' : (settled ? '≈ 800 hPa' : `${Math.round(v / 5) * 5} hPa`), x, p.y - 62, { size: 58, weight: 700, color: before ? '#F6F0E4' : AMBER, alpha: a1, align: 'center' });
        drawRich(c, before ? 'SEA-LEVEL AIR PRESSURE' : 'ABOUT ONE FIFTH LOWER', x, p.y - 22, { size: 22, weight: 600, tracking: 2.4, color: 'rgba(244,237,225,0.9)', alpha: a1, align: 'center' });
      }
      const a2 = fade(t, T.contourStart + 0.3);
      if (a2 > 0.01) {
        drawTag(c, 'PRESSURE EQUIVALENT  •  SCHEMATIC CONTOUR', 100, 356, { alpha: a2, accent: AMBER, size: 22 });
        const alt = contourAltitudeAt(t), anchor = (o.stage as CoastStage).massifAnchor(alt);
        const q = projectToScreen(cam, anchor, W, H);
        if (q && q.y > 330 && q.y < 1040) {
          // Centred readout just under the glowing contour.
          const done = t >= T.contourEnd - 0.05;
          drawRich(c, done ? '≈ 2,000 m' : `${(Math.round(alt / 50) * 50).toLocaleString('en-US')} m`, W / 2, q.y + 92, { size: 58, weight: 700, color: AMBER, alpha: a2, align: 'center' });
          drawRich(c, done ? 'SAME AIR PRESSURE AS SEA LEVEL NOW' : 'FEELS LIKE THIS ALTITUDE', W / 2, q.y + 132, { size: 22, weight: 600, tracking: 2.4, color: 'rgba(244,237,225,0.92)', alpha: a2, align: 'center' });
        }
      }
    }

    if (key === 'S04/SH01') {
      const a = fade(t, T.bloodIn + 0.3);
      if (a > 0.01) {
        drawTag(c, 'SCHEMATIC  •  OXYGEN ALREADY IN THE BLOOD', 100, 356, { alpha: a, accent: EMBER, size: 22 });
        const q = projectToScreen(o.stage.camera, (o.stage as CoastStage).chestWorld, W, H);
        if (q) drawCallout(c, '≈ 1 L O_2', q.x - 40, q.y - 10, -150, -150, { alpha: fade(t, T.bloodIn + 1.2) * alpha, color: EMBER, size: 46, sub: 'CARRIED IN YOUR BLOOD' });
      }
    }

    if (key === 'S06/SH01') {
      drawTag(c, 'ILLUSTRATIVE  •  RELIGHT NOT GUARANTEED', 100, 356, { alpha: fade(t, T.engineOut + 0.5), accent: AMBER, size: 22 });
      const q = projectToScreen(o.stage.camera, (o.stage as AirlinerStage).planeWorld.clone().add(new THREE.Vector3(8, 6, 0)), W, H);
      const a = fade(t, T.sagStart + 0.3);
      if (q && a > 0.01) drawCallout(c, 'AIR ≈ 23% THINNER', q.x, q.y, 60, -130, { alpha: a * alpha, size: 40, sub: 'LESS LIFT AT THE SAME SPEED' });
    }

    if (key === 'S07/SH02') drawTag(c, 'DISSOLVED OXYGEN IN SEAWATER  •  UNCHANGED', 100, 356, { alpha: fade(t, T.dissolvedLabel), accent: TEAL, size: 22 });
    if (key === 'S08/SH02') drawTag(c, 'ILLUSTRATIVE  •  GRID IMPACT UNCERTAIN', 100, 356, { alpha: fade(t, T.outageStart - 0.3), accent: AMBER, size: 22 });
    c.globalAlpha = 1;
  };

  return {
    shots: {
      'S01/SH01': { stage: candle, post: candlePost },
      'S02/SH01': { stage: earth, post: { exposure: 1.0, bloomStrength: 0.22, bloomRadius: 0.5, bloomThreshold: 0.95, vignette: 0.34 } },
      'S03/SH01': { stage: coast, post: coastPost },
      'S04/SH01': { stage: coast, post: { ...coastPost, bloomStrength: 0.4, bloomThreshold: 0.9 } },
      'S05/SH01': { stage: campfire, post: (t) => ({ ...firePost, exposure: 1.05 + 0.75 * smoothstep(T.fireOut + 0.1, T.fireOut + 1.3, t) }) },
      'S06/SH01': { stage: airliner, post: { exposure: 0.9, bloomStrength: 0.26, bloomRadius: 0.6, bloomThreshold: 1.05, vignette: 0.36, tint: [1.02, 1.0, 0.97] } },
      'S07/SH01': { stage: coast, post: coastPost },
      'S07/SH02': { stage: sea, post: { exposure: 1.08, bloomStrength: 0.42, bloomRadius: 0.75, bloomThreshold: 0.72, vignette: 0.5, saturation: 1.05 } },
      'S08/SH01': { stage: campfire, post: (t) => ({ ...firePost, exposure: 1.8 - 0.98 * smoothstep(T.fireBack, T.fireBack + 0.9, t), bloomStrength: 0.5 }) },
      'S08/SH02': { stage: earth, post: { exposure: 1.2, bloomStrength: 0.7, bloomRadius: 0.55, bloomThreshold: 0.5, vignette: 0.42 } },
      'S09/SH01': { stage: candle, post: candlePost },
    },
    overlay,
  };
}
