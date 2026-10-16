import * as THREE from 'three';
import { type FilmDefinition, type PostSettings, type OverlayContext, projectToScreen } from '../../library/render/FilmPipeline';
import { drawStatusChip, drawCallout } from '../../library/overlay/Labels';
import { loadEarthTextures } from '../../library/planet/Earth';
import { HarbourStage } from './stages/HarbourStage';
import { SpaceStage } from './stages/SpaceStage';
import { OrbitStage } from './stages/OrbitStage';
import { T, B, clockAt, seaRel, hhmm, nightAt, moonDistanceNights, windowAt, ease } from './timeline';
import story from '../../../stories/rogue-planet-between-earth-mars.json';

type Alert = 'normal' | 'warning' | 'critical';
const ACCENT: Record<Alert, string> = { normal: '#38BDF8', warning: '#F97316', critical: '#EF4444' };
const VALUE: Record<Alert, string> = { normal: '#38BDF8', warning: '#FACC15', critical: '#FCA5A5' };
const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
const signed = (v: number, d = 1) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(d)}`;

/** Top-left telemetry in the overlay-labels-v1 style, with values formatted per metric. */
function hud(ctx: CanvasRenderingContext2D, t: number, timer: string, metric: string, value: string, alert: Alert, alpha: number) {
  const chip = drawStatusChip(ctx, timer.toUpperCase(), 90, 240, { size: 24, weight: 800, accent: ACCENT[alert], dot: true, pulseTime_s: t, alpha,
    bgColor: 'rgba(7, 11, 20, 0.86)', borderColor: alert === 'critical' ? 'rgba(239, 68, 68, 0.45)' : 'rgba(56, 189, 248, 0.28)' });
  drawStatusChip(ctx, `${metric.toUpperCase()}:`, 90, 240 + chip.height + 10, { size: 28, weight: 700, value, valueColor: VALUE[alert], dot: false, alpha,
    bgColor: 'rgba(7, 11, 20, 0.88)', borderColor: 'rgba(255, 255, 255, 0.18)' });
}
function callout(o: OverlayContext, world: THREE.Vector3, label: string, a: number, opts: { dx?: number; dy?: number; accent?: string; edge?: number } = {}) {
  if (a <= 0.01) return;
  const p = projectToScreen(o.stage.camera, world, o.width, o.height);
  if (!p) return;
  drawCallout(o.ctx, p.x, p.y, label, { size: 26, dx: opts.dx ?? 80, dy: opts.dy ?? -70, accent: opts.accent ?? '#FACC15', alpha: a * o.alpha, safeTop: 380, safeBottom: 1180 });
}
/** A point on a sky body's limb toward a screen direction (so the reticle does not sit on the face). */
function limb(cam: THREE.Camera, centre: THREE.Vector3, radius: number, sx: number, sy: number) {
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  return centre.clone().addScaledVector(right, sx * radius).addScaledVector(up, sy * radius);
}

const night = (extra: Partial<PostSettings> = {}): Partial<PostSettings> => ({ exposure: 1.25, bloomStrength: 0.42, bloomRadius: 0.55, bloomThreshold: 0.82, vignette: 0.38, grain: 0.012,
  saturation: 1.06, contrast: 1.05, lift: 0.004, tint: [0.97, 1.0, 1.05], ...extra });

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const tex = await loadEarthTextures(ctx.base, ctx.renderer.capabilities.getMaxAnisotropy());
  const harbour = new HarbourStage(ctx.renderer), space = new SpaceStage(tex), orbit = new OrbitStage(tex);
  const shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    const key = `${sc.id}/${sh.id}`;
    if (sc.id <= 'S05') shots[key] = { stage: harbour, post: () => night(sc.id === 'S04' ? { exposure: 1.3 } : sc.id === 'S05' ? { exposure: 1.0, bloomStrength: 0.45 } : key === 'S03/SH01' ? { exposure: 2.1 } : {}) };
    else if (sc.id === 'S06') shots[key] = { stage: harbour, post: (t) => {
      const n = T.nights.length, seg = (B[6] - B[5]) / n, u = ((t - B[5]) % seg + seg) % seg;
      const dip = t > B[5] + seg * 0.5 ? Math.min(1, Math.min(u, seg - u) / 0.09) : 1;
      return night({ exposure: 1.3 * (0.15 + 0.85 * dip), tint: [1.0, 0.98, 1.04] });
    } };
    else if (sc.id === 'S07') shots[key] = { stage: harbour, post: { exposure: 0.92, bloomStrength: 0.22, bloomThreshold: 0.95, vignette: 0.32, saturation: 0.86, contrast: 1.04, tint: [0.95, 0.99, 1.06], grain: 0.01 } };
    else if (key === 'S08/SH01') shots[key] = { stage: space, post: { exposure: 1.05, bloomStrength: 0.45, bloomThreshold: 0.8, vignette: 0.4, saturation: 1.05, contrast: 1.06 } };
    else shots[key] = { stage: orbit, post: { exposure: 1.0, bloomStrength: 0.42, bloomRadius: 0.4, bloomThreshold: 0.85, vignette: 0.35, saturation: 1.08, contrast: 1.05 } };
  }

  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t, alpha } = o, k = shot.key;
    const H = (timer: string, metric: string, value: string, alert: Alert) => hud(c, t, timer, metric, value, alert, alpha);
    if (shot.sceneId <= 'S05') {
      const clock = clockAt(t), hs = harbour.anchors, cam = harbour.camera;
      if (k === 'S01/SH01') {
        H(`${hhmm(clock)} · CLOSEST PASS IN 19H`, 'SEA LEVEL', `${signed(seaRel(t))} M`, 'warning');
        callout(o, limb(cam, hs.rogue, hs.rogueRadius, -0.72, 0.7), '1 JUPITER MASS', windowAt(t, 1.8, 2.4), { dx: -90, dy: -90 });
      } else if (k === 'S02/SH01') {
        H('CLOSEST PASS IN 19 H', 'ROGUE DISTANCE', `${fmtInt(3712000 - (t - B[1]) * 19.3)} KM`, 'warning');
        callout(o, limb(cam, hs.rogue, hs.rogueRadius, 0.72, 0.7), '3.7 MILLION KM AWAY', windowAt(t, 6.0, 6.6), { dx: 70, dy: -120 });
      } else if (k === 'S03/SH01') {
        H(`${hhmm(clock)} · LOW WATER`, 'SEA LEVEL', `${signed(seaRel(t))} M`, 'warning');
        callout(o, hs.boat.clone().add(new THREE.Vector3(0, 2.2, 0)), 'AGROUND', windowAt(t, 11.0, 11.5), { dx: 90, dy: -110 });
      } else if (k === 'S03/SH02') {
        const n = 1 + 29 * ease((t - 13.7) / 1.6);
        H('TIDAL PULL vs MOON', 'TIDAL PULL', `${Math.round(n)}× MOON`, 'critical');
        callout(o, limb(cam, hs.moon, hs.moonRadius, -0.7, 0.7), 'MOON: 1×', windowAt(t, 14.2, 14.7), { dx: -80, dy: -80, accent: '#38BDF8' });
        callout(o, limb(cam, hs.rogue, hs.rogueRadius, 0.72, -0.7), 'ROGUE: 30×', windowAt(t, 15.0, 15.5), { dx: 80, dy: 90 });
      } else if (k === 'S04/SH01') {
        H(hhmm(clock), 'SEA LEVEL', `${signed(seaRel(t))} M`, 'critical');
      } else if (k === 'S05/SH01') {
        H(`${hhmm(clock)}`, 'MOON DISTANCE', `${fmtInt(418000 + 8000 * (t - B[4]) / (B[5] - B[4]))} KM`, 'critical');
        callout(o, limb(cam, hs.moon, hs.moonRadius, 0.0, 1.0), 'MOON: LEAVING EARTH', windowAt(t, 22.1, 22.6), { dx: 40, dy: -260 });
      }
    } else if (shot.sceneId === 'S06') {
      const n = nightAt(t);
      H(`NIGHT ${n.night}`, 'MOON DISTANCE', `${fmtInt(moonDistanceNights(t))} KM`, 'critical');
    } else if (k === 'S07/SH01') {
      H('NEXT JANUARY', 'SUNLIGHT', `${Math.round(100 - 24 * ease((t - 31.8) / 1.2))}%`, 'warning');
      callout(o, harbour.anchors.sun, 'SUN: −24%', windowAt(t, 32.6, 33.1), { dx: -90, dy: 90 });
    } else if (k === 'S07/SH02') {
      H('NORTHERN WINTER', 'WINTER LENGTH', `${Math.round(179 + 35 * ease((t - 35.1) / 1.6))} DAYS`, 'warning');
      callout(o, harbour.anchors.frozenBoat.clone().add(new THREE.Vector3(0, 3, 0)), 'WINTER: +5 WEEKS', windowAt(t, 35.8, 36.3), { dx: 70, dy: -120 });
    } else if (k === 'S08/SH01') {
      H('AFTER THE PASS', 'EARTH SPEED CHANGE', `${(3.9 * ease((t - 38.9) / 1.2)).toFixed(1)} KM/S`, 'critical');
      callout(o, space.anchors.rogue, 'ROGUE: LEAVING', windowAt(t, 39.2, 39.7), { dx: -80, dy: -70 });
    } else if (k === 'S08/SH02') {
      H('EARTH’S ORBIT', 'ORBIT STRETCH', (0.017 + 0.074 * ease((t - 41.6) / 2.0)).toFixed(3), 'warning');
      callout(o, orbit.anchors.aphelion, 'EARTH: 0.091', windowAt(t, 42.6, 43.1), { dx: -70, dy: 90, accent: '#38E1FF' });
      callout(o, orbit.anchors.marsOrbit, 'MARS: 0.093', windowAt(t, 43.0, 43.5), { dx: -70, dy: -70, accent: '#F08A5D' });
    } else if (k === 'S09/SH01') {
      H('EVERY YEAR NOW', 'YEAR LENGTH', `${Math.round(365 + 19 * ease((t - 45.0) / 1.4))} DAYS`, 'warning');
      callout(o, orbit.anchors.moon, 'THE MOON, ALONE', windowAt(t, 45.4, 45.9) * (1 - windowAt(t, 47.8, 48.2)), { dx: 80, dy: -90, accent: '#C8CCD4' });
      callout(o, orbit.anchors.earth, 'EARTH: 384-DAY YEAR', windowAt(t, 48.3, 48.8), { dx: -80, dy: -90, accent: '#38E1FF' });
    }
  } };
}
