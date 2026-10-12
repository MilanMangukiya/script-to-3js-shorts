// Small 2D label helpers for schematic / illustrative markers drawn over the 3D picture.
// Text supports "_2"-style subscripts (e.g. "O_2") so chemical formulas render without special glyphs.

export interface LabelStyle { size?: number; weight?: number; color?: string; alpha?: number; tracking?: number; align?: 'left' | 'center' | 'right'; shadow?: boolean; family?: string }

const FAMILY = 'Inter, "Segoe UI", system-ui, sans-serif';

interface Run { text: string; sub: boolean }
function runs(text: string): Run[] {
  const out: Run[] = [];
  const re = /_(\d+)/g; let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) { if (m.index > last) out.push({ text: text.slice(last, m.index), sub: false }); out.push({ text: m[1], sub: true }); last = m.index + m[0].length; }
  if (last < text.length) out.push({ text: text.slice(last), sub: false });
  return out;
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight: number, family: string) { ctx.font = `${weight} ${size}px ${family}`; }

/** Measure rich text width including letter tracking. */
export function measureRich(ctx: CanvasRenderingContext2D, text: string, st: LabelStyle = {}): number {
  const size = st.size ?? 26, weight = st.weight ?? 600, tracking = st.tracking ?? 0, family = st.family ?? FAMILY;
  let w = 0;
  for (const r of runs(text)) {
    setFont(ctx, r.sub ? size * 0.68 : size, weight, family);
    w += ctx.measureText(r.text).width + tracking * r.text.length;
  }
  return w - tracking;
}

/** Draw rich text at (x, baseline y). */
export function drawRich(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, st: LabelStyle = {}) {
  const size = st.size ?? 26, weight = st.weight ?? 600, tracking = st.tracking ?? 0, family = st.family ?? FAMILY;
  const total = measureRich(ctx, text, st);
  let cx = st.align === 'center' ? x - total / 2 : st.align === 'right' ? x - total : x;
  ctx.save();
  ctx.globalAlpha *= st.alpha ?? 1;
  ctx.fillStyle = st.color ?? '#F4EDE1';
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if (st.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; }
  for (const r of runs(text)) {
    const s = r.sub ? size * 0.68 : size;
    setFont(ctx, s, weight, family);
    const dy = r.sub ? size * 0.2 : 0;
    if (tracking) { for (const ch of r.text) { ctx.fillText(ch, cx, y + dy); cx += ctx.measureText(ch).width + tracking; } }
    else { ctx.fillText(r.text, cx, y + dy); cx += ctx.measureText(r.text).width; }
  }
  ctx.restore();
}

/** Small uppercase tracked tag with a thin accent rule, used for SCHEMATIC / ILLUSTRATIVE markers. */
export function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: { alpha?: number; color?: string; accent?: string; size?: number; align?: 'left' | 'center' | 'right' } = {}) {
  const size = opts.size ?? 23, st: LabelStyle = { size, weight: 600, tracking: 2.6, color: opts.color ?? 'rgba(244,237,225,0.92)', alpha: opts.alpha ?? 1, align: opts.align ?? 'left' };
  const w = measureRich(ctx, text, st);
  const left = st.align === 'center' ? x - w / 2 : st.align === 'right' ? x - w : x;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.fillStyle = 'rgba(8,11,20,0.42)';
  roundRect(ctx, left - 16, y - size - 9, w + 32, size + 22, 8); ctx.fill();
  ctx.fillStyle = opts.accent ?? '#66C7C1';
  ctx.fillRect(left - 16, y - size - 9, 4, size + 22);
  ctx.restore();
  drawRich(ctx, text, left, y, { ...st, align: 'left' });
}

/** Pill chip with a status dot, title and value (e.g. "O_2 IN AIR" / "21%"). */
export function drawChip(ctx: CanvasRenderingContext2D, title: string, value: string, x: number, y: number, opts: { alpha?: number; dot?: string; valueColor?: string } = {}) {
  const a = opts.alpha ?? 1;
  const tSt: LabelStyle = { size: 22, weight: 600, tracking: 2.4, color: 'rgba(244,237,225,0.82)', shadow: false };
  const vSt: LabelStyle = { size: 34, weight: 700, color: opts.valueColor ?? '#F4EDE1', shadow: false };
  const tw = measureRich(ctx, title, tSt), vw = measureRich(ctx, value, vSt);
  const w = 26 + 18 + 14 + tw + 18 + vw + 26, h = 62;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(8,11,20,0.55)'; ctx.strokeStyle = 'rgba(244,237,225,0.16)'; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = opts.dot ?? '#66C7C1';
  ctx.beginPath(); ctx.arc(x + 26 + 9, y + h / 2, 9, 0, Math.PI * 2); ctx.fill();
  drawRich(ctx, title, x + 26 + 18 + 14, y + h / 2 + 8, tSt);
  drawRich(ctx, value, x + 26 + 18 + 14 + tw + 18, y + h / 2 + 12, vSt);
  ctx.restore();
}

/** Numeric callout with a leader line from an anchor point. */
export function drawCallout(ctx: CanvasRenderingContext2D, text: string, ax: number, ay: number, dx: number, dy: number, opts: { alpha?: number; color?: string; size?: number; sub?: string } = {}) {
  const a = opts.alpha ?? 1, size = opts.size ?? 40, color = opts.color ?? '#FFB45C';
  // Flip the label to the other side when it would run past the frame's safe margins.
  const wMain = measureRich(ctx, text, { size, weight: 700 }), wSub = opts.sub ? measureRich(ctx, opts.sub, { size: 22, weight: 600, tracking: 2.2 }) : 0;
  const need = Math.max(wMain, wSub) + 12, cw = ctx.canvas.width, margin = 70;
  if (dx >= 0 && ax + dx + need > cw - margin && ax - dx - need >= margin) dx = -dx;
  else if (dx < 0 && ax + dx - need < margin && ax - dx + need <= cw - margin) dx = -dx;
  const tx = ax + dx, ty = ay + dy;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const align = dx >= 0 ? 'left' : 'right';
  drawRich(ctx, text, tx + (dx >= 0 ? 12 : -12), ty + size * 0.35, { size, weight: 700, color: '#F6F0E4', alpha: a, align });
  if (opts.sub) drawRich(ctx, opts.sub, tx + (dx >= 0 ? 12 : -12), ty + size * 0.35 + 32, { size: 22, weight: 600, tracking: 2.2, color: 'rgba(244,237,225,0.85)', alpha: a, align });
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
