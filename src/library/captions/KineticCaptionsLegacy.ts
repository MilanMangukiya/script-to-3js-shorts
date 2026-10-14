// Earlier caption renderer, kept unchanged so films built before the KineticCaptions.ts rewrite caption as they did.
// KineticCaptions.ts uses it when constructed the earlier way: new KineticCaptions(scenes[], style).
import { clamp, smoothstep } from '../util/math';

export interface CaptionWord { text: string; start_s: number; end_s: number }
export interface CaptionSceneInput {
  /** Absolute time the scene's narration clip starts. */
  offset_s: number;
  /** Word timings relative to the clip (from the real synthesized audio). */
  words: CaptionWord[];
  emphasis?: { phrase: string; treatment: 'accent_color' | 'gentle_scale' | 'subtle_glow' | 'none' }[];
}
export interface CaptionStyle {
  fontFamily: string; fontWeight: number; fontSize: number; lineHeight: number;
  maxCharsPerLine: number; baselineY: number; centerX: number; maxWidth: number;
  fill: string; accent: string; accentSoft: string; stroke: string; strokeWidth: number;
  backdrop: number;
  backdropStyle?: 'band' | 'pill';
}
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif', fontWeight: 600, fontSize: 66, lineHeight: 84,
  maxCharsPerLine: 24, baselineY: 1360, centerX: 500, maxWidth: 800,
  fill: '#F6F0E4', accent: '#FFB45C', accentSoft: '#FFD9A6', stroke: 'rgba(14,16,22,0.92)', strokeWidth: 9, backdrop: 0.3,
};

interface Word { text: string; start: number; end: number; treat: string; }
interface Phrase { words: Word[]; lines: Word[][]; start: number; end: number }

const endsSentence = (w: string) => /[.?!]["')]?$/.test(w);
const endsClause = (w: string) => /[,;:]$/.test(w);

/**
 * Burned-in kinetic captions: phrase-by-phrase, max two lines, word-accurate highlight driven by real audio timings.
 * Pure function of time; layout is computed once.
 */
export class KineticCaptions {
  private phrases: Phrase[] = [];
  constructor(scenes: CaptionSceneInput[], private style: CaptionStyle = DEFAULT_CAPTION_STYLE) {
    for (const sc of scenes) this.addScene(sc);
    this.phrases.sort((a, b) => a.start - b.start);
    for (let i = 0; i < this.phrases.length; i++) {
      const p = this.phrases[i], next = this.phrases[i + 1];
      const lastEnd = p.words[p.words.length - 1].end;
      p.start = p.words[0].start - 0.1;
      p.end = next && next.words[0].start - lastEnd < 0.7 ? next.words[0].start - 0.1 : lastEnd + 0.35;
    }
  }

  private addScene(sc: CaptionSceneInput) {
    const words: Word[] = sc.words.map((w) => ({ text: w.text, start: w.start_s + sc.offset_s, end: w.end_s + sc.offset_s, treat: 'none' }));
    // Mark emphasis words by locating each phrase as a run of words in the narration.
    const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9' -]/g, '');
    for (const e of sc.emphasis ?? []) {
      const target = strip(e.phrase).split(/\s+/);
      for (let i = 0; i + target.length <= words.length; i++) {
        if (target.every((tw, k) => strip(words[i + k].text) === tw)) { for (let k = 0; k < target.length; k++) words[i + k].treat = e.treatment; break; }
      }
    }
    // Phrases follow the sentence's own clauses: split at punctuation, merge tiny fragments, and break
    // over-long clauses at a balanced, natural word boundary so no orphan words are left on screen.
    const maxChars = this.style.maxCharsPerLine * 2 - 4;
    const len = (ws: Word[]) => ws.reduce((s, w) => s + w.text.length + 1, -1);
    const clauses: Word[][] = [];
    let cur: Word[] = [];
    for (const w of words) { cur.push(w); if (endsSentence(w.text) || endsClause(w.text)) { clauses.push(cur); cur = []; } }
    if (cur.length) clauses.push(cur);
    const merged: Word[][] = [];
    for (const c of clauses) {
      const prev = merged[merged.length - 1];
      if (prev && !endsSentence(prev[prev.length - 1].text) && len(prev) + 1 + len(c) <= maxChars && (len(prev) < 14 || len(c) < 14)) prev.push(...c);
      else merged.push([...c]);
    }
    const splitBefore = new Set(['and', 'but', 'or', 'to', 'of', 'in', 'on', 'by', 'for', 'like', 'that', 'until', 'than', 'with', 'from', 'could', 'would', 'how', 'as']);
    const split = (ws: Word[]): Word[][] => {
      if (len(ws) <= maxChars || ws.length < 4) return [ws];
      const total = len(ws); let best = 2, bestScore = Infinity;
      for (let i = 2; i <= ws.length - 2; i++) {
        const a = len(ws.slice(0, i)), b = total - a - 1;
        const score = Math.abs(a - b) - (splitBefore.has(strip(ws[i].text)) ? 9 : 0);
        if (score < bestScore) { bestScore = score; best = i; }
      }
      return [...split(ws.slice(0, best)), ...split(ws.slice(best))];
    };
    for (const c of merged) for (const ph of split(c)) this.phrases.push({ words: ph, lines: this.wrap(ph), start: 0, end: 0 });
  }

  /** Balance words into one or two lines within the per-line character budget. */
  private wrap(ws: Word[]): Word[][] {
    const total = ws.reduce((s, w) => s + w.text.length + 1, -1);
    if (total <= this.style.maxCharsPerLine * 0.8 || ws.length < 3) return [ws];
    let best = 1, bestScore = Infinity;
    for (let i = 1; i < ws.length; i++) {
      const a = ws.slice(0, i).reduce((s, w) => s + w.text.length + 1, -1), b = total - a - 1;
      const over = Math.max(0, a - this.style.maxCharsPerLine) + Math.max(0, b - this.style.maxCharsPerLine);
      const score = Math.abs(a - b) + over * 50 + (a > b ? 0 : 1.5); // slight preference for a longer first line
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return [ws.slice(0, best), ws.slice(best)];
  }

  /** Caption phrases exactly as displayed (line text and on-screen times), for SRT / transcript export. */
  cues(): { lines: string[]; start: number; end: number }[] {
    return this.phrases.map((p) => ({ lines: p.lines.map((l) => l.map((w) => w.text).join(' ')), start: p.start, end: p.end }));
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    const s = this.style;
    const p = this.phrases.find((ph) => t >= ph.start && t < ph.end);
    if (!p) return;
    const fadeIn = smoothstep(0, 0.12, t - p.start), fadeOut = 1 - smoothstep(-0.12, 0, t - p.end);
    const alpha = clamp(fadeIn * fadeOut);
    const rise = (1 - fadeIn) * 10;
    ctx.font = `${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const space = ctx.measureText(' ').width;
    const nLines = p.lines.length;
    // Soft backdrop band for legibility over bright picture areas.
    if (s.backdrop > 0) {
      if (s.backdropStyle === 'pill') {
        const widest = Math.min(s.maxWidth, Math.max(...p.lines.map(line => ctx.measureText(line.map(w => w.text).join(' ')).width)));
        ctx.fillStyle = `rgba(6,8,14,${s.backdrop * alpha})`;
        ctx.beginPath(); ctx.roundRect(s.centerX-widest/2-26,s.baselineY-(nLines-1)*s.lineHeight-s.fontSize-15,widest+52,(nLines-1)*s.lineHeight+s.fontSize+42,22); ctx.fill();
      } else {
      const top = s.baselineY - nLines * s.lineHeight - 30, bottom = s.baselineY + 60;
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, 'rgba(6,8,14,0)'); g.addColorStop(0.3, `rgba(6,8,14,${s.backdrop * alpha})`);
      g.addColorStop(0.75, `rgba(6,8,14,${s.backdrop * alpha})`); g.addColorStop(1, 'rgba(6,8,14,0)');
      ctx.fillStyle = g; ctx.fillRect(0, top, ctx.canvas.width, bottom - top);
      }
    }
    for (let li = 0; li < nLines; li++) {
      const line = p.lines[li];
      const widths = line.map((w) => ctx.measureText(w.text).width);
      let width = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
      const fit = Math.min(1, s.maxWidth / width);
      const y = s.baselineY - (nLines - 1 - li) * s.lineHeight + rise;
      let x = s.centerX - (width * fit) / 2;
      for (let wi = 0; wi < line.length; wi++) {
        const w = line[wi], ww = widths[wi] * fit;
        const nextStart = this.nextWordStart(p, w);
        const active = t >= w.start - 0.03 && t < nextStart - 0.03;
        const spoken = t >= w.start - 0.03;
        const act = active ? smoothstep(0, 0.1, t - (w.start - 0.03)) : 0;
        let color = s.fill;
        if (w.treat === 'accent_color' && spoken) color = s.accentSoft;
        if (active) color = s.accent;
        const scale = fit * (1 + (w.treat === 'gentle_scale' ? 0.04 * act : 0));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x + ww / 2, y);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
        ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth;
        ctx.strokeText(w.text, 0, 0);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        if (w.treat === 'subtle_glow' && spoken) { ctx.shadowColor = 'rgba(255,180,92,0.75)'; ctx.shadowBlur = 22; }
        ctx.fillStyle = color;
        ctx.fillText(w.text, 0, 0);
        ctx.restore();
        x += ww + space * fit;
      }
    }
  }

  private nextWordStart(p: Phrase, w: Word): number {
    const i = p.words.indexOf(w);
    return i + 1 < p.words.length ? p.words[i + 1].start : w.end + 0.2;
  }
}
