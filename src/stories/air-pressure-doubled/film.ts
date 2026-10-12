import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type OverlayContext, type PostSettings } from '../../library/render/FilmPipeline';
import { loadEarthTextures } from '../../library/planet/Earth';
import { drawChip, drawTag, drawRich, drawCallout, roundRect } from '../../library/overlay/Labels';
import { smoothstep, clamp } from '../../library/util/math';
import { HarborStage, COLUMN } from './stages/HarborStage';
import { DiverStage } from './stages/DiverStage';
import { SummitStage } from './stages/SummitStage';
import { KitchenStage } from './stages/KitchenStage';
import { CliffStage, windAt } from './stages/CliffStage';
import { OrbitStage } from './stages/OrbitStage';
import { T } from './timeline';

const AMBER = '#FFB45C', TEAL = '#66C7C1', IVORY = '#F4EDE1';
const fade = (t: number, a: number, b = Infinity, d = 0.35) => smoothstep(a, a + d, t) * (Number.isFinite(b) ? 1 - smoothstep(b - d, b, t) : 1);
const CHIP1 = 240, CHIP2 = 318, TAG1 = 446, TAG2 = 508;

/** Two schematic bars comparing CO2 amounts (trillion tonnes), drawn in the upper third. */
function drawBars(c: CanvasRenderingContext2D, t: number) {
  const x = 100, maxW = 760, scale = maxW / 3.3;
  const rows = [
    { label: 'CO_2 ADDED BY DOUBLING THE AIR', value: '≈ 3.3 TRILLION t', v: 3.3, color: AMBER, at: T.co2 + 0.1, y: 300 },
    { label: 'ALL HUMAN EMISSIONS SINCE 1850', value: '≈ 2.7 TRILLION t', v: 2.7, color: TEAL, at: T.humanity + 0.05, y: 420 },
  ];
  for (const r of rows) {
    const a = fade(t, r.at - 0.2, Infinity, 0.3), grow = smoothstep(r.at, r.at + 1.1, t);
    if (a <= 0.001) continue;
    c.save(); c.globalAlpha *= a;
    c.fillStyle = 'rgba(8,11,20,0.5)'; roundRect(c, x - 16, r.y - 44, maxW + 32, 108, 12); c.fill();
    c.fillStyle = 'rgba(244,237,225,0.14)'; roundRect(c, x, r.y + 22, maxW, 18, 9); c.fill();
    c.fillStyle = r.color; roundRect(c, x, r.y + 22, Math.max(18, r.v * scale * grow), 18, 9); c.fill();
    c.restore();
    drawRich(c, r.label, x, r.y - 8, { size: 23, weight: 600, tracking: 2.2, color: 'rgba(244,237,225,0.86)', alpha: a });
    drawRich(c, r.value, x + maxW, r.y - 8, { size: 30, weight: 700, color: r.color, alpha: a * smoothstep(0.35, 0.8, grow), align: 'right' });
  }
  drawTag(c, 'SCHEMATIC  •  ROUNDED VALUES', x, 590, { alpha: fade(t, T.humanity + 0.6), accent: TEAL, size: 21 });
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const tex = await loadEarthTextures(ctx.base, Math.min(16, ctx.renderer.capabilities.getMaxAnisotropy()));
  const harbor = new HarborStage(ctx.renderer), diver = new DiverStage(), summit = new SummitStage(ctx.renderer);
  const kitchen = new KitchenStage(ctx.renderer), cliff = new CliffStage(ctx.renderer), orbit = new OrbitStage(tex);

  const morning: Partial<PostSettings> = { exposure: 0.95, bloomStrength: 0.25, bloomRadius: 0.55, bloomThreshold: 1.0, vignette: 0.38 };
  const dusk: Partial<PostSettings> = { exposure: 0.95, bloomStrength: 0.36, bloomRadius: 0.65, bloomThreshold: 0.9, vignette: 0.46, saturation: 0.95 };

  const overlay = (o: OverlayContext) => {
    const { ctx: c, time_s: t, shot, alpha, width: W, height: H } = o, key = shot.key;
    c.globalAlpha = alpha;
    switch (key) {
      case 'S01/SH01': {
        const k = smoothstep(T.crumpleStart, T.crumpleEnd, t), p = Math.round(1013 + 1013 * k);
        drawChip(c, 'AIR PRESSURE', `${p.toLocaleString('en-US')} hPa`, 100, CHIP1, { alpha: fade(t, 0.3), dot: k > 0.02 ? AMBER : TEAL, valueColor: k > 0.98 ? AMBER : IVORY });
        break;
      }
      case 'S02/SH01': {
        const dbl = t >= T.doubleIt + 0.25;
        drawChip(c, dbl ? 'WHAT IF  ·  AIR ABOVE 1 m²' : 'TODAY  ·  AIR ABOVE 1 m²', dbl ? '≈ 20 t' : '≈ 10 t', 100, CHIP1, { dot: dbl ? AMBER : TEAL, valueColor: dbl ? AMBER : IVORY, alpha: fade(t, T.columnIn + 0.3) });
        drawTag(c, 'SCHEMATIC  •  MOLECULES NOT TO SCALE', 100, TAG1 - 40, { alpha: fade(t, T.columnIn + 0.8), accent: TEAL, size: 21 });
        const corner = projectToScreen(o.stage.camera, new THREE.Vector3(COLUMN.x + 0.53, 0.01, COLUMN.z + 0.53), W, H);
        if (corner) drawCallout(c, '1 m²', corner.x, corner.y, 90, -60, { alpha: fade(t, T.columnIn + 0.6, T.tenTonnes + 0.4), size: 38, color: TEAL });
        break;
      }
      case 'S03/SH01':
        drawChip(c, 'DEPTH 10 m  ·  PRESSURE', '≈ 2 atm', 100, CHIP1, { dot: TEAL, alpha: fade(t, T.S03_start + 0.4) });
        drawTag(c, 'SAME PRESSURE AS THE DOUBLED AIR', 100, TAG1 - 40, { alpha: fade(t, T.tenMeters - 0.2), accent: AMBER, size: 21 });
        break;
      case 'S04/SH01':
        drawChip(c, 'EVEREST SUMMIT', '8,849 m', 100, CHIP1, { dot: TEAL, alpha: fade(t, T.S04_start + 0.3) });
        drawChip(c, 'O_2 PER BREATH', '×2', 100, CHIP2, { dot: AMBER, valueColor: AMBER, alpha: fade(t, T.maskOff + 0.1) });
        drawRich(c, 'SUMMIT AIR PRESSURE WOULD MATCH', 100, 432, { size: 22, weight: 600, tracking: 2.2, color: 'rgba(244,237,225,0.92)', alpha: fade(t, T.andes - 0.1) });
        drawRich(c, '≈ 3,500 m TODAY', 100, 486, { size: 46, weight: 700, color: AMBER, alpha: fade(t, T.andes - 0.1) });
        drawTag(c, 'ILLUSTRATIVE TERRAIN', 100, 566, { alpha: fade(t, T.andes + 0.3), accent: TEAL, size: 19 });
        break;
      case 'S05/SH01': {
        drawTag(c, 'TIME-LAPSE', 100, CHIP1 + 36, { alpha: fade(t, T.S05_start + 0.3), accent: TEAL, size: 21 });
        if (t >= T.boil100 - 0.15 && t < T.boil120) drawChip(c, "TODAY'S BOILING POINT", '100 °C', 100, CHIP2, { dot: TEAL, alpha: fade(t, T.boil100 - 0.15) });
        if (t >= T.boil120) drawChip(c, '2× AIR  ·  BOILS AT', '≈ 120 °C (248 °F)', 100, CHIP2, { dot: AMBER, valueColor: AMBER, alpha: fade(t, T.boil120) });
        break;
      }
      case 'S06/SH01': {
        const k = windAt(t, 'S06').k;
        drawChip(c, 'SAME BREEZE', k < 0.5 ? 'TODAY' : '2× AIR  ·  PUSH ×2', 100, CHIP1, { dot: k < 0.5 ? TEAL : AMBER, valueColor: k < 0.5 ? IVORY : AMBER, alpha: fade(t, T.S06_start + 0.3) });
        drawTag(c, 'COMPARISON  •  SAME WIND SPEED', 100, TAG1 - 40, { alpha: fade(t, T.S06_start + 0.6), accent: TEAL, size: 21 });
        break;
      }
      case 'S06/SH02': {
        const p = projectToScreen(o.stage.camera, new THREE.Vector3(-2.0, 7.4 + 1.5 * smoothstep(T.wingbeat, T.wingbeat + 1.8, t), -26), W, H);
        if (p) drawCallout(c, 'LIFT ×2', clamp(p.x, 200, 880), clamp(p.y + 120, 500, 1150), 110, -70, { alpha: fade(t, T.wingbeat + 0.25), sub: 'AT THE SAME SPEED', color: AMBER });
        drawChip(c, 'SAME BREEZE', '2× AIR', 100, CHIP1, { dot: AMBER, valueColor: AMBER, alpha: fade(t, T.cliffCut + 0.15) });
        break;
      }
      case 'S07/SH01':
        drawBars(c, t);
        drawTag(c, 'WARMING LIKELY  •  AMOUNT UNCERTAIN', 100, 660, { alpha: fade(t, T.warm - 0.1), accent: AMBER, size: 21 });
        break;
      case 'S08/SH01': {
        const dbl = t >= T.deeperRed + 0.4;
        drawChip(c, 'SUNSET', dbl ? '2× AIR' : 'TODAY', 100, CHIP1, { dot: dbl ? AMBER : TEAL, valueColor: dbl ? AMBER : IVORY, alpha: fade(t, T.S08_start + 0.3) });
        drawTag(c, 'ILLUSTRATIVE COLOUR  •  AEROSOLS IGNORED', 100, TAG1 - 40, { alpha: fade(t, T.deeperRed + 0.5), accent: TEAL, size: 21 });
        break;
      }
      case 'S09/SH01':
        drawChip(c, 'AIR PRESSURE', '2,026 hPa', 100, CHIP1, { dot: AMBER, valueColor: AMBER, alpha: 0.75 * fade(t, T.S09_start + 0.5, T.everything + 0.2, 0.6) });
        break;
    }
    c.globalAlpha = 1;
  };

  return {
    shots: {
      'S01/SH01': { stage: harbor, post: morning },
      'S02/SH01': { stage: harbor, post: morning },
      'S03/SH01': { stage: diver, post: { exposure: 1.1, bloomStrength: 0.4, bloomRadius: 0.75, bloomThreshold: 0.78, vignette: 0.5 } },
      'S04/SH01': { stage: summit, post: { exposure: 0.95, bloomStrength: 0.3, bloomRadius: 0.6, bloomThreshold: 0.95, vignette: 0.35 } },
      'S05/SH01': { stage: kitchen, post: { exposure: 1.0, bloomStrength: 0.3, bloomRadius: 0.6, bloomThreshold: 0.95, vignette: 0.5 } },
      'S06/SH01': { stage: cliff, post: { exposure: 0.95, bloomStrength: 0.22, bloomRadius: 0.5, bloomThreshold: 1.0, vignette: 0.35 } },
      'S06/SH02': { stage: cliff, post: { exposure: 0.95, bloomStrength: 0.25, bloomRadius: 0.5, bloomThreshold: 1.0, vignette: 0.35 } },
      'S07/SH01': { stage: orbit, post: { exposure: 1.0, bloomStrength: 0.35, bloomRadius: 0.6, bloomThreshold: 0.85, vignette: 0.4 } },
      'S08/SH01': { stage: cliff, post: { exposure: 1.0, bloomStrength: 0.4, bloomRadius: 0.7, bloomThreshold: 0.85, vignette: 0.45 } },
      'S09/SH01': { stage: harbor, post: dusk },
    },
    overlay,
  };
}
