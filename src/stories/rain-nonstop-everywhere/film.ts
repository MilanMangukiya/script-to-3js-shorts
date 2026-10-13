import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type OverlayContext } from '../../library/render/FilmPipeline';
import { loadEarthTextures } from '../../library/planet/Earth';
import { drawCallout, drawChip, drawRich, drawTag, roundRect } from '../../library/overlay/Labels';
import { clamp, smoothstep } from '../../library/util/math';
import type { Timing } from './stages/common';
import { DesertStage } from './stages/DesertStage';
import { EarthStage, EARTH_SUN } from './stages/EarthStage';
import { ColumnStage, COLUMN_RADIUS as R_COL } from './stages/ColumnStage';
import { SeaStage } from './stages/SeaStage';
import { GlassStage } from './stages/GlassStage';
import { GaugeStage, GAUGE_X, levelY } from './stages/GaugeStage';
import { FarmStage, SolarStage } from './stages/FieldStages';

const SLUG = 'rain-nonstop-everywhere';
const TEAL = '#6bd4cb', AMBER = '#ffc37a', GREEN = '#9fd27a';

/** Labels per shot: [chip title, chip value, tag, chip dot colour]. Dots: teal = today, amber = the what-if. */
const NOTES: Record<string, [string, string, string?, string?]> = {
  'S01/SH01': ['WHAT IF', 'NONSTOP RAIN', 'SLOW MOTION · FIRST DROP'],
  'S02/SH01': ['TODAY', '≈67% CLOUD COVER', 'NASA IMAGERY', TEAL],
  'S02/SH02': ['WHAT IF', 'RAIN EVERYWHERE', 'ILLUSTRATIVE'],
  'S03/SH01': ['ALL THE WATER', 'IN THE SKY', 'SCHEMATIC · NOT TO SCALE', TEAL],
  'S04/SH01': ['SUNLIGHT', 'POWERS EVAPORATION', 'VAPOUR SHOWN ILLUSTRATIVELY', TEAL],
  'S04/SH02': ['EVEN RAIN', '≈3 MM A DAY', 'TIME-LAPSE'],
  'S05/SH01': ['SAHARA', 'DOZENS × USUAL RAIN', 'ILLUSTRATIVE'],
  'S05/SH02': ['SAHARA', 'COULD TURN GREEN', 'ILLUSTRATIVE TIME-LAPSE'],
  'S06/SH01': ['YEARLY RAIN', 'TODAY → EVEN', 'SCHEMATIC · 1 M OF RAIN = 35 CM'],
  'S07/SH01': ['FARMS', 'NO DRY DAYS', 'ILLUSTRATIVE'],
  'S07/SH02': ['SOLAR', 'CLOUDS CUT OUTPUT', 'ILLUSTRATIVE GAUGE'],
  'S08/SH01': ['TWIST', 'CLOUDS REFLECT SUNLIGHT', 'SCHEMATIC'],
  'S08/SH02': ['LESS SUN', 'LESS EVAPORATION', 'LIKELY · EXACT EFFECT UNCERTAIN'],
};

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const story = await fetch(`${ctx.base}stories/${SLUG}.json`).then((r) => r.json());
  const T: Timing = {};
  for (const sc of story.scenes) { T[sc.id] = { start: sc.start_s, end: sc.end_s }; for (const sh of sc.shots) T[`${sc.id}/${sh.id}`] = { start: sh.start_s, end: sh.end_s }; }
  const tex = await loadEarthTextures(ctx.base, Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy()));
  const R = ctx.renderer;
  const desert = new DesertStage(T, R), earth = new EarthStage(T, tex), column = new ColumnStage(T, R), sea = new SeaStage(T, R);
  const glass = new GlassStage(T, R), gauges = new GaugeStage(T, R), farm = new FarmStage(T, R), solar = new SolarStage(T, R);

  const grey = { saturation: 0.9, vignette: 0.42, bloomStrength: 0.16, tint: [0.98, 1.0, 1.03] as [number, number, number] };
  const desertPost = (t: number) => {
    // Warm grade only while dawn light is in the frame (first and last seconds of the film).
    const w = Math.max(0.7 * (1 - smoothstep(0.8, 3.6, t - T.S01.start)) * (t < T.S02.start ? 1 : 0), 0.7 * smoothstep(0.1, 1.8, t - T.S09.start) * (t >= T.S09.start ? 1 : 0));
    return { ...grey, saturation: 0.9 + 0.12 * w, bloomStrength: 0.16 + 0.12 * w, tint: [0.98 + 0.05 * w, 1.0, 1.03 - 0.07 * w] as [number, number, number] };
  };
  const shots: FilmDefinition['shots'] = {
    'S01/SH01': { stage: desert, post: desertPost },
    'S02/SH01': { stage: earth, post: { bloomStrength: 0.28, vignette: 0.5 } }, 'S02/SH02': { stage: earth, post: { bloomStrength: 0.28, vignette: 0.5 } },
    'S03/SH01': { stage: column, post: { bloomStrength: 0.42, bloomThreshold: 0.6, vignette: 0.5 } },
    'S04/SH01': { stage: sea, post: { ...grey, bloomStrength: 0.24 } }, 'S04/SH02': { stage: glass, post: { ...grey, bloomStrength: 0.2 } },
    'S05/SH01': { stage: desert, post: { ...grey, saturation: 0.95 } }, 'S05/SH02': { stage: desert, post: { ...grey, saturation: 1.0 } },
    'S06/SH01': { stage: gauges, post: { bloomStrength: 0.26, vignette: 0.5 } },
    'S07/SH01': { stage: farm, post: grey }, 'S07/SH02': { stage: solar, post: grey },
    'S08/SH01': { stage: earth, post: { bloomStrength: 0.3, vignette: 0.5 } }, 'S08/SH02': { stage: sea, post: (t: number) => ({ ...grey, exposure: 1 - 0.12 * smoothstep(T['S08/SH02'].start, T['S08/SH02'].end, t) }) },
    'S09/SH01': { stage: desert, post: desertPost },
  };

  const fadeIn = (t: number, at: number, d = 0.35) => smoothstep(at, at + d, t);
  const overlay = (o: OverlayContext) => {
    const { ctx: c, shot, time_s: t, alpha, stage } = o;
    const sh = T[shot.key], u = t - sh.start, note = NOTES[shot.key];
    c.globalAlpha = alpha;
    const at = (p: THREE.Vector3) => projectToScreen(stage.camera, p, o.width, o.height);
    if (note && !(shot.key === 'S01/SH01' && u < 1.98)) {
      const [title, value, tag, dot] = note, k = shot.key === 'S01/SH01' ? fadeIn(u, 1.98) : 1;
      c.globalAlpha = alpha * k;
      drawChip(c, title, value, 85, 225, { dot: dot ?? AMBER, valueColor: AMBER });
      c.globalAlpha = alpha;
    }
    if (note?.[2] && !(shot.key === 'S01/SH01' && (u < 0.15 || u > 1.6))) drawTag(c, note[2], 105, 342, { accent: AMBER, size: 20, alpha: shot.key === 'S01/SH01' ? fadeIn(u, 0.15) * (1 - smoothstep(1.25, 1.6, u)) : 1 });
    switch (shot.key) {
      case 'S02/SH02': drawTag(c, 'POLES: SNOW INSTEAD OF RAIN', 105, 404, { accent: TEAL, size: 20, alpha: fadeIn(t, T['S02/SH02'].start + 1.7) }); break;
      case 'S03/SH01': {
        const p = at(new THREE.Vector3(0.0, 0.0125, R_COL + 0.002)), k = fadeIn(t, T.S03.start + 5.8);
        if (p && k > 0) drawCallout(c, '≈ 2.5 CM', p.x, p.y, 110, -260, { alpha: k * alpha, sub: 'ALL OF IT, AS LIQUID', size: 46 });
        break;
      }
      case 'S04/SH01': {
        const k = fadeIn(t, T['S04/SH01'].start + 5.06);
        if (k > 0) { c.save(); c.globalAlpha = alpha * k * 0.55; c.fillStyle = '#080b14'; roundRect(c, 150, 700, 780, 132, 18); c.fill(); c.restore(); drawRich(c, '≈ 1 M OF WATER A YEAR', 540, 760, { size: 46, weight: 700, color: '#F6F0E4', align: 'center', alpha: k }); drawRich(c, 'GLOBAL AVERAGE', 540, 806, { size: 24, weight: 600, tracking: 2.4, color: 'rgba(244,237,225,0.85)', align: 'center', alpha: k }); }
        break;
      }
      case 'S04/SH02': {
        const day = Math.round(glass.dayAt(t)), k = fadeIn(t, T['S04/SH02'].start + 0.6);
        drawChip(c, 'DAY', String(day), 85, 410, { dot: '#9cc8e6', valueColor: '#F6F0E4', alpha: k });
        drawRich(c, `${day * 3} MM`, 85 + 12, 520, { size: 30, weight: 700, color: '#bfe3f5', alpha: k });
        break;
      }
      case 'S05/SH02': {
        const k = fadeIn(t, T['S05/SH02'].start + 2.26);
        if (k > 0) { drawRich(c, 'GREEN SAHARA', 540, 640, { size: 44, weight: 700, color: GREEN, align: 'center', alpha: k }); drawRich(c, '~11,000–5,000 YEARS AGO', 540, 686, { size: 26, weight: 600, tracking: 2.2, color: 'rgba(244,237,225,0.9)', align: 'center', alpha: k }); }
        drawTag(c, 'COULD · PARTIAL GREENING IN A YEAR', 105, 404, { accent: GREEN, size: 20, alpha: fadeIn(t, T['S05/SH02'].start + 3.59) });
        break;
      }
      case 'S06/SH01': {
        const r = gauges.rainAt(t), fmt = (m: number) => (m < 0.1 ? `≈ ${Math.round(m * 100)} CM` : `≈ ${m.toFixed(1)} M`);
        for (const [x, name, col, v] of [[-GAUGE_X, 'SAHARA', TEAL, r.sahara], [GAUGE_X, 'RAINFOREST', GREEN, r.forest]] as const) {
          const base = at(new THREE.Vector3(x, -0.03, 0.09)), lvl = at(new THREE.Vector3(x, levelY(v), 0.08));
          if (base) drawRich(c, name, base.x, base.y + 52, { size: 34, weight: 700, color: col, align: 'center', tracking: 1.5 });
          if (lvl) drawRich(c, fmt(v), lvl.x, lvl.y - 18, { size: 30, weight: 700, color: '#F6F0E4', align: 'center' });
        }
        const k = fadeIn(t, T.S06.start + 4.77);
        if (k > 0) { const p = at(new THREE.Vector3(0, levelY(1.1), 0.09)); if (p) drawRich(c, 'SAME ≈ 1 M FOR EVERYONE', 540, p.y - 120, { size: 40, weight: 700, color: AMBER, align: 'center', alpha: k }); }
        break;
      }
      case 'S07/SH01': drawTag(c, 'GRAIN CAN MOULD OR SPROUT IN WET FIELDS', 105, 404, { accent: AMBER, size: 20, alpha: fadeIn(t, T['S07/SH01'].start + 3.24) }); break;
      case 'S08/SH01': drawBeams(c, t, T['S08/SH01'].start, at, alpha); drawTag(c, 'LESS SUNLIGHT REACHES THE SURFACE', 105, 404, { accent: AMBER, size: 20, alpha: fadeIn(t, T['S08/SH01'].start + 4.49) }); break;
    }
    c.globalAlpha = 1;
  };
  return { shots, overlay };
}

/** Schematic sunlight: golden beams arrive from the right edge, strike the cloud tops and mostly bounce back out. */
function drawBeams(c: CanvasRenderingContext2D, t: number, start: number, at: (p: THREE.Vector3) => { x: number; y: number } | null, alpha: number) {
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(EARTH_SUN, up).normalize();
  const offsets: [number, number][] = [[-0.55, 0.15], [-0.25, -0.1], [0.05, 0.12], [0.32, -0.05], [0.58, 0.1]];
  offsets.forEach(([v, h], i) => {
    const hit = EARTH_SUN.clone().multiplyScalar(0.75).addScaledVector(up, v).addScaledVector(side, h).normalize().multiplyScalar(1.012);
    const p = at(hit); if (!p) return;
    const tin = clamp((t - (start + 1.29 + i * 0.22)) / 1.4), tout = clamp((t - (start + 2.9 + i * 0.2)) / 1.6);
    if (tin <= 0) return;
    const sx = 1150, sy = p.y - (1150 - p.x) * 0.18;
    const ex = sx + (p.x - sx) * tin, ey = sy + (p.y - sy) * tin;
    c.save(); c.globalAlpha = alpha * 0.95; c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,195,122,0.95)'; c.lineWidth = 5; c.shadowColor = 'rgba(255,170,80,0.8)'; c.shadowBlur = 14;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
    if (tin >= 1) {
      c.fillStyle = 'rgba(255,236,200,1)'; c.beginPath(); c.arc(p.x, p.y, 7, 0, Math.PI * 2); c.fill();
      if (tout > 0) {
        const weak = i === 2;   // one beam gets through, faintly: less sunlight reaches the surface
        const dx = weak ? -60 : 360 + i * 30, dy = weak ? 70 : -330 + i * 70;
        c.strokeStyle = weak ? 'rgba(255,195,122,0.35)' : 'rgba(255,226,176,0.8)'; c.lineWidth = weak ? 3 : 4; c.setLineDash(weak ? [6, 8] : []);
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + dx * tout, p.y + dy * tout); c.stroke();
        if (!weak && tout > 0.95) { const a = Math.atan2(dy, dx), hx = p.x + dx, hy = p.y + dy; c.setLineDash([]); c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - 18 * Math.cos(a - 0.45), hy - 18 * Math.sin(a - 0.45)); c.moveTo(hx, hy); c.lineTo(hx - 18 * Math.cos(a + 0.45), hy - 18 * Math.sin(a + 0.45)); c.stroke(); }
      }
    } else {
      const a = Math.atan2(ey - sy, ex - sx); c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - 20 * Math.cos(a - 0.45), ey - 20 * Math.sin(a - 0.45)); c.moveTo(ex, ey); c.lineTo(ex - 20 * Math.cos(a + 0.45), ey - 20 * Math.sin(a + 0.45)); c.stroke();
    }
    c.restore();
  });
}
