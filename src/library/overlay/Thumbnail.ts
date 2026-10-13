// Thumbnail / cover composition over a clean still of the film:
//  - drawThumbnailTitle: calm headline title card ('clean' style).
//  - composeBoldThumbnail: click-worthy cover with punch-in, grade, huge outlined capitals, sticker and arrow ('bold').

export interface ThumbnailTitleOptions {
  headline: string;
  /** Words drawn in the accent colour (matched ignoring case and punctuation). */
  highlight?: string[];
  position?: 'top' | 'middle' | 'bottom';
  width: number; height: number;
  fontFamily?: string; weight?: number;
  color?: string; accent?: string;
  /** Largest and smallest font sizes tried (px) and the maximum number of lines. */
  maxSize?: number; minSize?: number; maxLines?: number;
  /** Text width as a fraction of the frame, and the bands kept clear of app UI and grid crops (px from top / bottom). */
  widthFrac?: number; safeTop?: number; safeBottom?: number;
  uppercase?: boolean;
  /** Strength of the soft dark gradient behind the text (0..1). */
  scrim?: number;
}

export interface ThumbnailLayout { size: number; lines: string[][]; top: number; bottom: number }

const FAMILY = 'Inter, "Segoe UI", system-ui, sans-serif';
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

function setFont(ctx: CanvasRenderingContext2D, size: number, weight: number, family: string) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${(-size * 0.012).toFixed(2)}px`;   // tighter caps
}

/** Greedy wrap at `maxWidth`; null if a single word is wider than the line. */
function wrap(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[][] | null {
  const space = ctx.measureText(' ').width, lines: string[][] = [];
  let cur: string[] = [], w = 0;
  for (const word of words) {
    const ww = ctx.measureText(word).width;
    if (ww > maxWidth) return null;
    if (cur.length && w + space + ww > maxWidth) { lines.push(cur); cur = [word]; w = ww; } else { w += (cur.length ? space : 0) + ww; cur.push(word); }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/**
 * Lay out and draw a thumbnail headline: the largest size that fits in `maxLines` balanced lines, centred, with a
 * short accent bar, highlighted words, a dark stroke and shadow, over a soft gradient that keeps it legible on any
 * picture. Pure canvas drawing (no state); returns the layout used.
 */
export function drawThumbnailTitle(ctx: CanvasRenderingContext2D, o: ThumbnailTitleOptions): ThumbnailLayout {
  const family = o.fontFamily ?? FAMILY, weight = o.weight ?? 700, W = o.width, H = o.height;
  const maxWidth = W * (o.widthFrac ?? 0.84), maxLines = o.maxLines ?? 4, safeTop = o.safeTop ?? 300, safeBottom = o.safeBottom ?? 420;
  const words = (o.uppercase === false ? o.headline : o.headline.toUpperCase()).split(/\s+/).filter(Boolean);
  const marks = new Set((o.highlight ?? []).flatMap((h) => h.split(/\s+/)).map(norm));
  ctx.save();
  // Largest size whose greedy wrap fits; then the narrowest width with the same line count (balanced lines).
  let size = o.maxSize ?? 150, lines: string[][] = [words];
  for (; size >= (o.minSize ?? 72); size -= 4) {
    setFont(ctx, size, weight, family);
    const l = wrap(ctx, words, maxWidth);
    if (l && l.length <= maxLines) { lines = l; break; }
  }
  size = Math.max(size, o.minSize ?? 72);
  setFont(ctx, size, weight, family);
  let lo = Math.max(...words.map((w) => ctx.measureText(w).width)), hi = maxWidth;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2, l = wrap(ctx, words, mid); if (l && l.length <= lines.length) { hi = mid; lines = l; } else lo = mid; }
  const lh = size * 1.06, blockH = lines.length * lh;
  const pos = o.position ?? 'top';
  const top = pos === 'top' ? safeTop : pos === 'bottom' ? H - safeBottom - blockH : (H - blockH) / 2;
  // Legibility gradient: from the near edge for top/bottom placements, a soft band for the middle.
  const a = o.scrim ?? 0.6, g = pos === 'bottom' ? ctx.createLinearGradient(0, H, 0, top - 320) : pos === 'top' ? ctx.createLinearGradient(0, 0, 0, top + blockH + 320) : ctx.createLinearGradient(0, top - 300, 0, top + blockH + 300);
  if (pos === 'middle') { g.addColorStop(0, 'rgba(6,8,14,0)'); g.addColorStop(0.35, `rgba(6,8,14,${a})`); g.addColorStop(0.65, `rgba(6,8,14,${a})`); g.addColorStop(1, 'rgba(6,8,14,0)'); }
  else { g.addColorStop(0, `rgba(6,8,14,${a})`); g.addColorStop(0.55, `rgba(6,8,14,${a * 0.75})`); g.addColorStop(1, 'rgba(6,8,14,0)'); }
  ctx.fillStyle = g;
  ctx.fillRect(0, pos === 'bottom' ? top - 320 : pos === 'top' ? 0 : top - 300, W, pos === 'middle' ? blockH + 600 : pos === 'top' ? top + blockH + 320 : H - top + 320);
  // Accent bar above the headline.
  const accent = o.accent ?? '#FFB45C', color = o.color ?? '#FFFFFF';
  ctx.fillStyle = accent; const bw = Math.round(size * 0.9), bh = Math.max(6, Math.round(size * 0.07));
  ctx.beginPath(); (ctx as any).roundRect ? (ctx as any).roundRect(W / 2 - bw / 2, top - size * 0.42, bw, bh, bh / 2) : ctx.rect(W / 2 - bw / 2, top - size * 0.42, bw, bh); ctx.fill();
  // Headline, word by word so highlighted words take the accent colour.
  setFont(ctx, size, weight, family);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  const space = ctx.measureText(' ').width;
  lines.forEach((line, li) => {
    const widths = line.map((w) => ctx.measureText(w).width), total = widths.reduce((s, w) => s + w, 0) + space * (line.length - 1);
    let x = W / 2 - total / 2; const y = top + size * 0.82 + li * lh;
    line.forEach((word, wi) => {
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.22; ctx.shadowOffsetY = size * 0.03;
      ctx.strokeStyle = 'rgba(8,10,16,0.9)'; ctx.lineWidth = size * 0.1; ctx.strokeText(word, x, y);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = marks.has(norm(word)) ? accent : color; ctx.fillText(word, x, y);
      x += widths[wi] + space;
    });
  });
  ctx.restore();
  return { size, lines, top, bottom: top + blockH };
}

// ---------------------------------------------------------------------------------------------------------------
// Bold, click-worthy cover.

export interface BoldThumbnailOptions {
  width: number; height: number;
  headline: string;
  /** Words drawn in the highlight colour (matched ignoring case and punctuation). */
  highlight?: string[];
  position?: 'top' | 'middle' | 'bottom';
  /** Short sticker text (a striking true number or twist from the film), attached to the headline. */
  badge?: string;
  /** Subject point as frame fractions [x, y]: the punch-in centre and the arrow's target. */
  focus?: [number, number];
  /** Punch-in toward the focus (1 = none; default 1.12 when a focus is given). */
  zoom?: number;
  /** Where the focus lands on the cover, as frame fractions (default: where it already is). Limited by the zoom's margin. */
  anchor?: [number, number];
  /** Sticker centre as frame fractions (default: attached below a top/middle headline, above a bottom one). */
  badgeAt?: [number, number];
  /** Arrow from the sticker to the focus (default on when both exist). */
  arrow?: boolean;
  /** CSS filter applied to the still. */
  grade?: string;
  fontFamily?: string;
  textColor?: string; highlightColor?: string; badgeColor?: string; badgeTextColor?: string; arrowColor?: string;
  maxSize?: number; minSize?: number; maxLines?: number; widthFrac?: number;
  safeTop?: number; safeBottom?: number;
  /** Headline tilt in degrees. */
  tilt?: number;
  /** Headline face (a THUMB_FONTS entry or a custom face); default Inter Black. */
  font?: ThumbFont;
}
export interface BoldThumbnailLayout extends ThumbnailLayout { badge?: { x: number; y: number; w: number; h: number } }

/** A headline face: CSS family, weight, tracking and line height (em), outline width (em), italic stickers. */
export interface ThumbFont { family: string; weight: number; tracking: number; lineHeight: number; outline: number; badgeItalic?: boolean }
/** License-cleared faces in assets/library/fonts (see display/FONTS.md); keys are the storyboard's `thumbnail.font`. */
export const THUMB_FONTS: Record<string, ThumbFont> = {
  inter: { family: 'Inter', weight: 900, tracking: -0.02, lineHeight: 1.0, outline: 0.17, badgeItalic: true },
  anton: { family: 'Anton', weight: 400, tracking: 0.005, lineHeight: 1.06, outline: 0.14 },
  'bebas-neue': { family: '"Bebas Neue"', weight: 400, tracking: 0.01, lineHeight: 0.98, outline: 0.12 },
  'archivo-black': { family: '"Archivo Black"', weight: 400, tracking: -0.02, lineHeight: 1.04, outline: 0.15 },
  bangers: { family: 'Bangers', weight: 400, tracking: 0.03, lineHeight: 1.04, outline: 0.12 },
  orbitron: { family: 'Orbitron', weight: 900, tracking: 0, lineHeight: 1.1, outline: 0.12 },
  playfair: { family: '"Playfair Display"', weight: 900, tracking: -0.01, lineHeight: 1.06, outline: 0.12 },
};
/** Colour-grade presets for the still (CSS filters); keys are the storyboard's `thumbnail.grade`. */
export const THUMB_GRADES: Record<string, string> = {
  vivid: 'saturate(1.35) contrast(1.15) brightness(1.04)',
  cool: 'saturate(1.25) contrast(1.16) brightness(1.03) hue-rotate(-6deg)',
  warm: 'saturate(1.3) contrast(1.12) brightness(1.05) sepia(0.12)',
  dramatic: 'saturate(1.2) contrast(1.32) brightness(0.95)',
  natural: 'saturate(1.1) contrast(1.06)',
};

const INK = '#0b0b0f';
function blackFont(ctx: CanvasRenderingContext2D, f: ThumbFont, size: number, family: string, italic = false) {
  const fam = f.family === 'Inter' ? family : `${f.family}, ${family}`;
  ctx.font = `${italic && f.badgeItalic ? 'italic ' : ''}${f.weight} ${size}px ${fam}`;
  if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${(size * f.tracking).toFixed(2)}px`;
}
/** Cap height of the current font in px (centres capitals in their line box for any face). */
const capHeight = (ctx: CanvasRenderingContext2D, size: number) => ctx.measureText('H').actualBoundingBoxAscent || size * 0.72;
function stickerPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
/** Hard offset shadow, heavy dark outline, bright fill: the classic high-contrast thumbnail lettering. */
function punchText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, outline: number) {
  ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.lineWidth = size * outline;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.strokeStyle = 'rgba(0,0,0,0.72)';
  ctx.strokeText(text, x + size * 0.05, y + size * 0.075); ctx.fillText(text, x + size * 0.05, y + size * 0.075);
  ctx.strokeStyle = INK; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

/**
 * Compose a bold cover over the clean still already in `ctx`: punch-in toward the subject with a punchier grade and
 * vignette, a huge tilted Inter Black headline (highlight words in yellow), a red sticker attached to the headline and
 * a yellow arrow from the sticker to the subject. Keeps text inside the band that survives grid crops and app buttons.
 * Needs the Inter 900 (and 900 italic) faces loaded for the intended look.
 */
export function composeBoldThumbnail(ctx: CanvasRenderingContext2D, o: BoldThumbnailOptions): BoldThumbnailLayout {
  const W = o.width, H = o.height, family = o.fontFamily ?? FAMILY;
  const safeTop = o.safeTop ?? 290, safeBottom = o.safeBottom ?? 400, yellow = o.highlightColor ?? '#FFE135', white = o.textColor ?? '#FFFFFF';
  const face = o.font ?? THUMB_FONTS.inter;
  ctx.save();
  // 1) Punch-in and grade (from a copy of the clean still), then a vignette.
  const src = document.createElement('canvas'); src.width = ctx.canvas.width; src.height = ctx.canvas.height;
  src.getContext('2d')!.drawImage(ctx.canvas, 0, 0);
  const z = Math.max(1, o.zoom ?? (o.focus ? 1.12 : 1)), sfx = (o.focus?.[0] ?? 0.5) * W, sfy = (o.focus?.[1] ?? 0.5) * H;
  const ax = (o.anchor?.[0] ?? o.focus?.[0] ?? 0.5) * W, ay = (o.anchor?.[1] ?? o.focus?.[1] ?? 0.5) * H;
  const dx = Math.min(0, Math.max(W - W * z, ax - sfx * z)), dy = Math.min(0, Math.max(H - H * z, ay - sfy * z));
  const fx = dx + sfx * z, fy = dy + sfy * z;   // where the subject actually lands (the arrow's target)
  ctx.filter = o.grade ?? 'saturate(1.35) contrast(1.15) brightness(1.04)';
  ctx.drawImage(src, dx, dy, W * z, H * z);
  ctx.filter = 'none';
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // 2) Headline layout: as large as fits in balanced lines.
  const words = o.headline.toUpperCase().split(/\s+/).filter(Boolean);
  const marks = new Set((o.highlight ?? []).flatMap((h) => h.split(/\s+/)).map(norm));
  const maxWidth = W * (o.widthFrac ?? 0.9), maxLines = o.maxLines ?? 3, minSize = o.minSize ?? 96;
  let size = o.maxSize ?? 230, lines: string[][] = [words];
  for (; size >= minSize; size -= 4) { blackFont(ctx, face, size, family); const l = wrap(ctx, words, maxWidth); if (l && l.length <= maxLines) { lines = l; break; } }
  if (size < minSize) { size = minSize; blackFont(ctx, face, size, family); lines = wrap(ctx, words, maxWidth) ?? [words]; }
  blackFont(ctx, face, size, family);
  let lo = Math.max(...words.map((w) => ctx.measureText(w).width)), hi = maxWidth;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2, l = wrap(ctx, words, mid); if (l && l.length <= lines.length) { hi = mid; lines = l; } else lo = mid; }
  const lh = size * face.lineHeight, blockH = lines.length * lh, pos = o.position ?? 'top', cap = capHeight(ctx, size);
  const top = pos === 'top' ? safeTop : pos === 'bottom' ? H - safeBottom - blockH : (H - blockH) / 2;
  const band = ctx.createLinearGradient(0, top - 260, 0, top + blockH + 260);
  band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(0.3, 'rgba(0,0,0,0.42)'); band.addColorStop(0.7, 'rgba(0,0,0,0.42)'); band.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = band; ctx.fillRect(0, top - 260, W, blockH + 520);

  // 3) Sticker geometry (drawn last, over the arrow's tail): below the headline, or above a bottom headline.
  let badge: BoldThumbnailLayout['badge'];
  let bs = Math.round(Math.min(Math.max(size * 0.4, 56), 84));
  if (o.badge) {
    blackFont(ctx, face, bs, family, true);
    const tw = ctx.measureText(o.badge.toUpperCase()).width;
    if (tw + bs > W * 0.64) { bs = Math.max(40, Math.floor((bs * W * 0.64) / (tw + bs))); blackFont(ctx, face, bs, family, true); }   // long stickers shrink instead of covering the subject
    const bw = ctx.measureText(o.badge.toUpperCase()).width + bs * 1.0, bh = bs * 1.5;
    const bx = Math.min(W - 70 - bw / 2, Math.max(70 + bw / 2, o.badgeAt ? o.badgeAt[0] * W : W * 0.58));
    const by = o.badgeAt ? o.badgeAt[1] * H : pos === 'bottom' ? top - 54 - bh / 2 : top + blockH + 60 + bh / 2;
    badge = { x: bx, y: by, w: bw, h: bh };
  }

  // 4) Headline: tilted block of outlined capitals.
  blackFont(ctx, face, size, family);
  ctx.save(); ctx.translate(W / 2, top + blockH / 2); ctx.rotate(((o.tilt ?? -3) * Math.PI) / 180);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const space = ctx.measureText(' ').width;
  lines.forEach((line, li) => {
    const widths = line.map((w) => ctx.measureText(w).width), total = widths.reduce((s, w) => s + w, 0) + space * (line.length - 1);
    let x = -total / 2; const y = -blockH / 2 + li * lh + (lh + cap) / 2;
    line.forEach((word, wi) => { punchText(ctx, word, x, y, size, marks.has(norm(word)) ? yellow : white, face.outline); x += widths[wi] + space; });
  });
  ctx.restore();

  // 5) Arrow from the sticker to the subject: curved, outlined, with a hard shadow.
  if (o.focus && badge && o.arrow !== false) {
    const dx = fx - badge.x, dy = fy - badge.y, dist = Math.hypot(dx, dy);
    if (dist > badge.h * 1.6) {
      const ux = dx / dist, uy = dy / dist;
      const edge = Math.min(Math.abs(badge.w / 2 / (ux || 1e-6)), Math.abs(badge.h / 2 / (uy || 1e-6)));
      const sx = badge.x + ux * edge * 0.6, sy = badge.y + uy * edge * 0.6;
      const stop = Math.min(W * 0.11, dist * 0.3), ex = fx - ux * stop, ey = fy - uy * stop;
      const mx = (sx + ex) / 2, my = (sy + ey) / 2, px = -uy, py = ux;
      const side = (W / 2 - mx) * px + (H / 2 - my) * py >= 0 ? 1 : -1, bend = Math.hypot(ex - sx, ey - sy) * 0.25 * side;
      const cx = mx + px * bend, cy = my + py * bend;
      const tl = Math.hypot(ex - cx, ey - cy), hx = (ex - cx) / tl, hy = (ey - cy) / tl, head = 70;
      const shaftX = ex - hx * head * 0.55, shaftY = ey - hy * head * 0.55;
      const shaft = (color: string, width: number) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, shaftX, shaftY); ctx.stroke(); };
      const tip = () => { ctx.beginPath(); ctx.moveTo(ex + hx * 10, ey + hy * 10); ctx.lineTo(ex - hx * head - hy * head * 0.62, ey - hy * head + hx * head * 0.62); ctx.lineTo(ex - hx * head + hy * head * 0.62, ey - hy * head - hx * head * 0.62); ctx.closePath(); };
      ctx.save(); ctx.translate(9, 11); shaft('rgba(0,0,0,0.6)', 42); tip(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill(); ctx.restore();
      ctx.lineJoin = 'round'; shaft(INK, 44); tip(); ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.stroke();
      shaft(o.arrowColor ?? yellow, 26); tip(); ctx.fillStyle = o.arrowColor ?? yellow; ctx.fill();
    }
  }

  // 6) Sticker: tilted red label with white italic capitals.
  if (badge && o.badge) {
    ctx.save(); ctx.translate(badge.x, badge.y); ctx.rotate((4 * Math.PI) / 180);
    stickerPath(ctx, -badge.w / 2 + 10, -badge.h / 2 + 12, badge.w, badge.h, badge.h * 0.22); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fill();
    stickerPath(ctx, -badge.w / 2, -badge.h / 2, badge.w, badge.h, badge.h * 0.22);
    ctx.fillStyle = o.badgeColor ?? '#E8302A'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke();
    blackFont(ctx, face, bs, family, true); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = o.badgeTextColor ?? '#FFFFFF'; ctx.fillText(o.badge.toUpperCase(), 0, capHeight(ctx, bs) / 2);
    ctx.restore();
  }
  ctx.restore();
  return { size, lines, top, bottom: top + blockH, badge };
}
