// 2D overlay: a clock ring of `hoursShown` hours (24 by default) split into the day/night arcs of a planet whose solar
// day lasts `dayLengthHours`, with a small sun at every sunrise and a progress hand. Pure drawing; no state.
import { drawRich } from './Labels';

export interface DayCycleDialOptions {
  /** Centre and outer radius in output pixels. */
  x: number; y: number; radius: number;
  /** Length of one solar day in hours and the daylit fraction of it (0.5 at the equinox). */
  dayLengthHours: number; daylightFraction?: number;
  /** Hours around the full ring (24 = one of our days) and the clock hour at the top of the ring. */
  hoursShown?: number; topHour?: number;
  /** Clock hour of the first sunrise. */
  firstSunriseHour?: number;
  /** 0..1 of the ring swept so far (draws the hand and brightens passed sunrises); omit for no hand. */
  progress?: number;
  alpha?: number;
  dayColor?: string; nightColor?: string; sunColor?: string;
  /** Centre label, e.g. "24 h". */
  label?: string; sublabel?: string;
}

export function drawDayCycleDial(ctx: CanvasRenderingContext2D, o: DayCycleDialOptions) {
  const H = o.hoursShown ?? 24, top = o.topHour ?? 0, day = o.dayLengthHours, lit = o.daylightFraction ?? 0.5;
  const rise0 = o.firstSunriseHour ?? 6, R = o.radius, w = R * 0.2, a = o.alpha ?? 1;
  const ang = (h: number) => ((h - top) / H) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(8,11,20,0.5)'; ctx.beginPath(); ctx.arc(o.x, o.y, R + w * 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = o.nightColor ?? '#22345C'; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, Math.PI * 2); ctx.stroke();
  const rises: number[] = [];
  for (let k = -2; k * day < H + day; k++) {
    const s = rise0 + k * day, e = s + day * lit;
    if (e < top || s > top + H) continue;
    ctx.strokeStyle = o.dayColor ?? '#FFC857'; ctx.beginPath(); ctx.arc(o.x, o.y, R, ang(Math.max(s, top)), ang(Math.min(e, top + H))); ctx.stroke();
    if (s >= top && s < top + H) rises.push(s);
  }
  // Hour ticks.
  ctx.strokeStyle = 'rgba(244,237,225,0.55)'; ctx.lineWidth = 2;
  for (let h = 0; h < H; h++) { const t = ang(top + h), r0 = R + w * 0.5 + 3, r1 = r0 + (h % 6 === 0 ? 11 : 5); ctx.beginPath(); ctx.moveTo(o.x + Math.cos(t) * r0, o.y + Math.sin(t) * r0); ctx.lineTo(o.x + Math.cos(t) * r1, o.y + Math.sin(t) * r1); ctx.stroke(); }
  const p = o.progress;
  rises.forEach((h) => {
    const t = ang(h), sx = o.x + Math.cos(t) * R, sy = o.y + Math.sin(t) * R, passed = p === undefined || (h - top) / H <= p + 1e-6;
    ctx.globalAlpha = a * (passed ? 1 : 0.45);
    ctx.fillStyle = o.sunColor ?? '#FFE3A1'; ctx.beginPath(); ctx.arc(sx, sy, w * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = o.sunColor ?? '#FFE3A1'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) { const q = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(sx + Math.cos(q) * w * 0.85, sy + Math.sin(q) * w * 0.85); ctx.lineTo(sx + Math.cos(q) * w * 1.2, sy + Math.sin(q) * w * 1.2); ctx.stroke(); }
  });
  ctx.globalAlpha = a;
  if (p !== undefined) {
    const t = ang(top + p * H);
    ctx.strokeStyle = '#F6F0E4'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(t) * (R - w * 0.7), o.y + Math.sin(t) * (R - w * 0.7)); ctx.stroke();
    ctx.fillStyle = '#F6F0E4'; ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (o.label) drawRich(ctx, o.label, o.x, o.y + (o.sublabel ? R * 0.38 : R * 0.16), { size: Math.round(R * 0.36), weight: 700, align: 'center', alpha: a });
  if (o.sublabel) drawRich(ctx, o.sublabel, o.x, o.y - R * 0.22, { size: Math.round(R * 0.16), weight: 600, tracking: 2, align: 'center', alpha: a, color: 'rgba(244,237,225,0.85)' });
}
