// End-hook card: the film's closing question drawn large over the final shot — words rise in one by one, highlight
// words take the accent colour, an accent rule grows beneath and a quiet subline follows. Pure function of time; the
// card fades out shortly before the last frame so a looping film's final frame stays clean.
import { measureRich, drawRich, roundRect } from './Labels';

export interface EndCardOptions {
  text: string; highlight?: string[]; subline?: string;
  /** Film time the card starts revealing, and the film's end (seconds). */
  start: number; end: number;
  /** Optional film time at which each card word appears (e.g. as the voice speaks it); default: 0.12 s apart from `start`. */
  wordTimes?: number[];
  /** Centre and width of the text block in output pixels (defaults suit 1080×1920 above the caption band). */
  x?: number; y?: number; maxWidth?: number; size?: number;
  accent?: string; color?: string; family?: string;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function drawEndCard(ctx: CanvasRenderingContext2D, t: number, o: EndCardOptions) {
  if (t < o.start || t > o.end) return;
  const fadeOut = 1 - smooth(o.end - 0.75, o.end - 0.15, t), size = o.size ?? 78, family = o.family ?? 'Inter, "Segoe UI", system-ui, sans-serif';
  const cx = o.x ?? 540, top = o.y ?? 560, maxW = o.maxWidth ?? 900, accent = o.accent ?? '#FFC857', color = o.color ?? '#F7F2E8';
  const hi = new Set((o.highlight ?? []).flatMap((h) => h.toLowerCase().split(/\s+/)));
  // Lay words out in balanced lines.
  ctx.save(); ctx.font = `900 ${size}px ${family}`;
  const words = o.text.split(/\s+/), space = ctx.measureText(' ').width, lines: string[][] = [[]];
  for (const w of words) { const line = lines[lines.length - 1], test = [...line, w].join(' '); if (line.length && ctx.measureText(test).width > maxW) lines.push([w]); else line.push(w); }
  if (lines.length === 2 && lines[1].length === 1 && lines[0].length > 2) lines[1].unshift(lines[0].pop()!);   // no orphan
  const lh = size * 1.12, blockH = lines.length * lh, sub = o.subline ? 54 : 0;
  // Soft panel behind the card.
  const panelA = 0.5 * smooth(o.start, o.start + 0.5, t) * fadeOut;
  const grad = ctx.createLinearGradient(0, top - 70, 0, top + blockH + sub + 70);
  grad.addColorStop(0, 'rgba(4,8,16,0)'); grad.addColorStop(0.25, `rgba(4,8,16,${panelA})`); grad.addColorStop(0.75, `rgba(4,8,16,${panelA})`); grad.addColorStop(1, 'rgba(4,8,16,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, top - 70, ctx.canvas.width, blockH + sub + 140);
  let k = 0;
  lines.forEach((line, li) => {
    const widths = line.map((w) => ctx.measureText(w).width), lw = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = cx - lw / 2; const y = top + (li + 1) * lh - size * 0.18;
    line.forEach((w, wi) => {
      const at = o.wordTimes?.[k] ?? o.start + 0.12 * k, appear = smooth(at, at + 0.4, t), a = appear * fadeOut;
      const isHi = hi.has(w.toLowerCase().replace(/[^a-z0-9']/g, ''));
      ctx.globalAlpha = a; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(8,10,16,0.85)';
      ctx.shadowColor = isHi ? `${accent}aa` : 'rgba(0,0,0,0.5)'; ctx.shadowBlur = isHi ? 26 : 16; ctx.shadowOffsetY = isHi ? 0 : 4;
      const dy = (1 - appear) * 26;
      ctx.strokeText(w, x, y + dy); ctx.shadowColor = isHi ? `${accent}cc` : 'transparent'; ctx.fillStyle = isHi ? accent : color; ctx.fillText(w, x, y + dy);
      x += widths[wi] + space; k++;
    });
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  // Accent rule and subline.
  const after = o.wordTimes?.length ? o.wordTimes[o.wordTimes.length - 1] + 0.25 : o.start + 0.12 * k;
  const ruleT = smooth(after, after + 0.6, t), ruleW = 220 * ruleT, ry = top + blockH + 18;
  ctx.globalAlpha = fadeOut; ctx.fillStyle = accent; roundRect(ctx, cx - ruleW / 2, ry, ruleW, 5, 2.5); ctx.fill();
  if (o.subline) {
    const sa = smooth(after + 0.1, after + 0.6, t) * fadeOut;
    drawRich(ctx, o.subline.toUpperCase(), cx, ry + 60, { size: 31, weight: 700, tracking: 3.4, color: 'rgba(250,245,236,0.97)', align: 'center', alpha: sa });
    void measureRich;
  }
  ctx.restore();
}
