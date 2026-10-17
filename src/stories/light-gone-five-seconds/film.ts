import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type PostSettings } from '../../library/render/FilmPipeline';
import { renderEditorialHud, drawCallout } from '../../library/overlay/Labels';
import { StreetStage } from './stages/StreetStage';
import { SpaceStage } from './stages/SpaceStage';
import story from '../../../stories/light-gone-five-seconds.json';
import { T, isDark, dark1, sunLeft, sunFill, yearsAt, windowAt, clamp01 } from './timeline';

type Grade = Required<Pick<PostSettings, 'exposure' | 'bloomStrength' | 'bloomThreshold' | 'bloomRadius' | 'saturation' | 'contrast' | 'vignette' | 'grain'>>;
const DAY: Grade = { exposure: 1.0, bloomStrength: 0.22, bloomThreshold: 1.05, bloomRadius: 0.5, saturation: 1.08, contrast: 1.05, vignette: 0.2, grain: 0.006 };
const DARK: Grade = { exposure: 1.25, bloomStrength: 0.28, bloomThreshold: 1.2, bloomRadius: 0.4, saturation: 1.05, contrast: 1.08, vignette: 0.38, grain: 0.012 };
const NIGHT: Grade = { exposure: 1.15, bloomStrength: 0.28, bloomThreshold: 1.1, bloomRadius: 0.4, saturation: 1.0, contrast: 1.06, vignette: 0.32, grain: 0.01 };
const SPACE: Grade = { exposure: 1.0, bloomStrength: 0.2, bloomThreshold: 1.4, bloomRadius: 0.25, saturation: 1.05, contrast: 1.05, vignette: 0.22, grain: 0.005 };
const mix = (a: Grade, b: Grade, k: number) => Object.fromEntries(Object.keys(a).map((n) => [n, a[n as keyof Grade] + (b[n as keyof Grade] - a[n as keyof Grade]) * k])) as Grade;
/** Street look: day, the lamp-lit dark, and the return of sunlight with a brief dazzle for dark-adapted eyes. */
const streetGrade = (t: number) => {
  const F = sunFill(t), g = mix(DARK, DAY, F);
  if (t >= T.sunBack) g.exposure *= 1 + 0.55 * F * Math.exp(-(t - T.sunBack) / 0.7);
  return g;
};

const clock = (t: number) => { const s = Math.floor(t); return `12:00:${String(s).padStart(2, '0')} PM`; };
const mmss = (s: number) => { const v = Math.ceil(s - 1e-6); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };

/** Eigengrau: with no light at all, the eye shows its own dark grey noise rather than black. */
function eigengrau(c: CanvasRenderingContext2D, W: number, H: number, t: number) {
  c.save(); c.fillStyle = '#16161c'; c.fillRect(0, 0, W, H);
  const f = Math.floor(t * 30), n = 900;
  for (let i = 0; i < n; i++) {
    const h = Math.sin((i + 1) * 12.9898 + f * 78.233) * 43758.5453, u = h - Math.floor(h), h2 = Math.sin((i + 7) * 39.3468 + f * 11.135) * 24634.6345, v = h2 - Math.floor(h2);
    c.fillStyle = `rgba(${150 + 60 * u},${150 + 60 * v},${170 + 50 * u},${0.05 + 0.08 * v})`; c.fillRect(u * W, v * H, 2, 2);
  }
  c.restore();
}

/** A dashed ring marking where a star is, before its light has arrived. */
function ghostRing(c: CanvasRenderingContext2D, x: number, y: number, a: number) {
  c.save(); c.globalAlpha *= a; c.strokeStyle = 'rgba(250, 204, 21, 0.9)'; c.lineWidth = 2.5; c.setLineDash([7, 7]);
  c.beginPath(); c.arc(x, y, 24, 0, Math.PI * 2); c.stroke(); c.restore();
}

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const street = new StreetStage(ctx.renderer), space = new SpaceStage();
  const shots: FilmDefinition['shots'] = {};
  for (const sc of story.scenes) for (const sh of sc.shots) {
    const isSpace = sc.id === 'S03', isNight = ['S06', 'S07', 'S08'].includes(sc.id);
    shots[`${sc.id}/${sh.id}`] = { stage: isSpace ? space : street, post: isSpace ? SPACE : isNight ? NIGHT : streetGrade };
  }
  return { shots, overlay(o) {
    const { ctx: c, shot, time_s: t, width: W, height: H } = o, sc = shot.sceneId, a = o.alpha;
    if (isDark(t)) eigengrau(c, W, H, t);
    let hud: { label: string; value: string; sub?: string } | null = null;
    if (t < T.dark0) hud = { label: 'THE TIME', value: clock(t), sub: 'A CITY STREET · CLEAR SKY' };
    else if (isDark(t)) hud = { label: 'LIGHT RETURNS IN', value: `${Math.max(0, dark1() - t).toFixed(2)} S`, sub: 'NO LIGHT ANYWHERE' };
    else if (t < T.sunBack) hud = { label: 'SUNLIGHT ARRIVES IN', value: mmss(sunLeft(t)), sub: '150,000,000 KM AWAY' };
    else if (sc === 'S05') hud = { label: 'DAYLIGHT BACK AFTER', value: `${Math.floor((T.darkS + T.sunTravelS) / 60)} MIN ${Math.round((T.darkS + T.sunTravelS) % 60)} S`, sub: 'THE SUN WAS DARK FOR 5 S' };
    if (sc === 'S06') hud = { label: 'STARS IN THE SKY', value: '0', sub: 'THE MOON IS BACK' };
    if (sc === 'S07') hud = { label: 'FIRST STAR BACK IN', value: '4.4 YEARS', sub: 'SOUTHERN SKY · 41 TRILLION KM' };
    if (sc === 'S08') { const y = yearsAt(t); hud = { label: 'YEARS SINCE THE DARK', value: y.toFixed(1), sub: y >= 8.6 ? 'SIRIUS · FIRST STAR UP NORTH' : y >= 4.37 ? 'ALPHA CENTAURI IS BACK' : 'NO STARS YET' }; }
    if (hud) renderEditorialHud(c, { x: 90, y: 240, ...hud, alpha: a, valueSize: hud.value.length > 10 ? 88 : 104 });
    const at = (world: THREE.Vector3 | null) => (world ? projectToScreen(o.stage.camera, world, W, H) : null);
    const call = (world: THREE.Vector3 | null, label: string, k: number, dx: number, dy: number, value?: string, safeBottom?: number) => {
      if (k < 0.01) return; const p = at(world); if (p) drawCallout(c, p.x, p.y, label, { value, alpha: a * k, size: 34, dx, dy, ...(safeBottom ? { safeBottom } : {}) });
    };
    if (sc === 'S03') {
      const sp = o.stage as SpaceStage, r = sp.frontRadius(t);
      call(sp.planet(2), 'EARTH', windowAt(t, shot.start_s + 0.4, shot.start_s + 0.9), 120, 10, 'YOU', 1680);
      call(sp.frontAnchor(t, 2), 'SUNLIGHT', windowAt(r, 4, 6) * (1 - windowAt(r, 26, 28)), -40, 30, '300,000 KM/S');
    }
    if (sc === 'S07') {
      // Where the nearest naked-eye star is: marked, but dark.
      const p = at((o.stage as StreetStage).starWorld('ALPHA CENTAURI')), k = windowAt(t, T.ghostAt, T.ghostAt + 0.5);
      if (p && k > 0.01) { ghostRing(c, p.x, p.y, a * k); drawCallout(c, p.x - 17, p.y + 17, 'ALPHA CENTAURI', { value: '4.4 LY', alpha: a * k, size: 34, dx: -120, dy: 130, reticleRadius: 0.5 }); }
    }
    if (sc === 'S08') {
      const y = yearsAt(t), st = o.stage as StreetStage;
      if (shot.shotId === 'SH01') call(st.starWorld('ALPHA CENTAURI'), 'ALPHA CENTAURI', clamp01((y - 4.37) / 0.6), -120, 130, '4.4 LY');
      else call(st.starWorld('SIRIUS'), 'SIRIUS', clamp01((y - 8.6) / 0.5), -110, 130, '8.6 LY');
    }
  } };
}
