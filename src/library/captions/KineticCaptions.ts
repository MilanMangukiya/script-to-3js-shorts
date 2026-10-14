/**
 * caption-kinetic-v1 — Word-Timed Kinetic Burned-In Captions
 *
 * Driven by real synthesized audio word timings from tools/narrate.mjs (Whisper alignment).
 * Preserves cues() for tools/transcript.mjs so output/<slug>.srt and .txt match screen text[cite: 1].
 *
 * Upgraded defaults for viral retention:
 * - Larger default fontSize (70 px), tighter line wrapping (20 chars/line), and safer baselineY (1320 px)[cite: 1, 2].
 * - Supports active-word accent pill + phrase-level `accent_color`, `gentle_scale`, and `subtle_glow`[cite: 1, 2].
 */

import { KineticCaptions as LegacyKineticCaptions, DEFAULT_CAPTION_STYLE, type CaptionSceneInput, type CaptionStyle } from './KineticCaptionsLegacy';
// Earlier API, still used by src/entry.ts and tools/transcript.mjs.
export { DEFAULT_CAPTION_STYLE };
export type { CaptionSceneInput, CaptionStyle, CaptionWord } from './KineticCaptionsLegacy';

export type EmphasisTreatment = 'accent_color' | 'gentle_scale' | 'subtle_glow' | 'none';

export interface CaptionEmphasisSpec {
  phrase: string;
  treatment: EmphasisTreatment;
}

export interface WordTiming {
  word: string;
  start_s: number;
  end_s: number;
  sceneId?: string;
}

export interface SceneNarrationInput {
  id?: string;
  start_s: number;
  end_s: number;
  text?: string;
  words?: WordTiming[];
  caption_emphasis?: CaptionEmphasisSpec[];
}

export interface CaptionCue {
  index: number;
  start_s: number;
  end_s: number;
  text: string;
  lines: WordTiming[][];
  words: WordTiming[];
  emphasis: CaptionEmphasisSpec[];
}

export interface KineticCaptionsOptions {
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  lineHeight?: number;
  maxCharsPerLine?: number;
  baselineY?: number;
  centerX?: number;
  maxWidth?: number;
  fill?: string;
  accent?: string;
  accentSoft?: string;
  stroke?: string;
  strokeWidth?: number;
  backdrop?: string | boolean;
  activeWordPill?: boolean;
  uppercase?: boolean;
  emphasis?: CaptionEmphasisSpec[];
  words?: WordTiming[];
  scenes?: SceneNarrationInput[];
}

const CLAUSE_BREAK_PUNCT = /[,.;:!?—–-]$/;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Splits a stream of timed words into punchy 2-5 word phrases (max 2 balanced lines)
 * respecting natural clause punctuation and pause gaps[cite: 1].
 */
export function buildCaptionCues(
  words: WordTiming[],
  maxCharsPerLine = 20,
  globalEmphasis: CaptionEmphasisSpec[] = [],
  sceneEmphasisMap?: Map<string, CaptionEmphasisSpec[]>
): CaptionCue[] {
  if (!words || words.length === 0) return [];

  const maxPhraseChars = maxCharsPerLine * 2;
  const phrases: WordTiming[][] = [];
  let current: WordTiming[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length > 0) {
      phrases.push(current);
      current = [];
      currentLen = 0;
    }
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const cleanWord = w.word.trim();
    if (!cleanWord) continue;

    const prev = current.length > 0 ? current[current.length - 1] : null;
    const pauseGap = prev ? w.start_s - prev.end_s : 0;
    const sceneChanged = prev && w.sceneId && prev.sceneId && w.sceneId !== prev.sceneId;
    const nextLen = currentLen === 0 ? cleanWord.length : currentLen + 1 + cleanWord.length;

    if (
      sceneChanged ||
      pauseGap > 0.35 ||
      current.length >= 5 ||
      (current.length >= 2 && nextLen > maxPhraseChars)
    ) {
      flush();
    }

    current.push({ ...w, word: cleanWord });
    currentLen = current.length === 1 ? cleanWord.length : currentLen + 1 + cleanWord.length;

    if (CLAUSE_BREAK_PUNCT.test(cleanWord) && current.length >= 2) {
      flush();
    }
  }
  flush();

  return phrases.map((phraseWords, idx) => {
    const lines = balanceTwoLines(phraseWords, maxCharsPerLine);
    const text = lines.map((line) => line.map((w) => w.word).join(' ')).join('\n');
    const sceneId = phraseWords[0]?.sceneId;
    const emp =
      (sceneId && sceneEmphasisMap?.get(sceneId)) || globalEmphasis || [];

    return {
      index: idx + 1,
      start_s: phraseWords[0].start_s,
      end_s: phraseWords[phraseWords.length - 1].end_s,
      text,
      lines,
      words: phraseWords,
      emphasis: emp,
    };
  });
}

function balanceTwoLines(words: WordTiming[], maxCharsPerLine: number): WordTiming[][] {
  const joined = words.map((w) => w.word).join(' ');
  if (words.length <= 3 && joined.length <= maxCharsPerLine) {
    return [words];
  }

  let bestSplit = Math.ceil(words.length / 2);
  let bestDiff = Infinity;

  for (let split = 1; split < words.length; split++) {
    const line1Len = words
      .slice(0, split)
      .map((w) => w.word)
      .join(' ').length;
    const line2Len = words
      .slice(split)
      .map((w) => w.word)
      .join(' ').length;
    const penalty =
      (line1Len > maxCharsPerLine + 4 ? 50 : 0) +
      (line2Len > maxCharsPerLine + 4 ? 50 : 0);
    const diff = Math.abs(line1Len - line2Len) + penalty;
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = split;
    }
  }

  return [words.slice(0, bestSplit), words.slice(bestSplit)];
}

/**
 * Checks whether a word at index `wordIdx` inside `cue.words` belongs to a matched
 * `caption_emphasis` substring[cite: 1, 2].
 */
function resolveWordEmphasis(
  cue: CaptionCue,
  wordIdxInCue: number
): EmphasisTreatment {
  if (!cue.emphasis || cue.emphasis.length === 0) return 'none';
  const fullPhrase = cue.words.map((w) => w.word).join(' ');

  for (const spec of cue.emphasis) {
    if (!spec.phrase || spec.treatment === 'none') continue;
    const target = spec.phrase.trim();
    const startChar = fullPhrase.indexOf(target);
    if (startChar === -1) continue;
    const endChar = startChar + target.length;

    let cursor = 0;
    for (let i = 0; i < cue.words.length; i++) {
      const wStart = cursor;
      const wEnd = cursor + cue.words[i].word.length;
      if (i === wordIdxInCue && wEnd > startChar && wStart < endChar) {
        return spec.treatment;
      }
      cursor = wEnd + 1;
    }
  }
  return 'none';
}

export class KineticCaptions {
  public fontFamily: string;
  public fontWeight: number | string;
  public fontSize: number;
  public lineHeight: number;
  public maxCharsPerLine: number;
  public baselineY: number;
  public centerX: number;
  public maxWidth: number;
  public fill: string;
  public accent: string;
  public accentSoft: string;
  public stroke: string;
  public strokeWidth: number;
  public backdrop: string | boolean;
  public activeWordPill: boolean;
  public uppercase: boolean;
  public emphasis: CaptionEmphasisSpec[];
  private computedCues: CaptionCue[] = [];
  private legacy?: LegacyKineticCaptions;

  /** New form: new KineticCaptions(options). Earlier form: new KineticCaptions(scenes[], style), rendered by the earlier engine. */
  constructor(options: KineticCaptionsOptions | CaptionSceneInput[] = {}, legacyStyle?: CaptionStyle) {
    const legacyScenes = Array.isArray(options) ? options : null;
    const opts: KineticCaptionsOptions = legacyScenes ? {} : (options as KineticCaptionsOptions);
    this.fontFamily = opts.fontFamily ?? 'Inter, -apple-system, sans-serif';
    this.fontWeight = opts.fontWeight ?? 800;
    this.fontSize = opts.fontSize ?? 70;
    this.lineHeight = opts.lineHeight ?? 1.18;
    this.maxCharsPerLine = opts.maxCharsPerLine ?? 20;
    this.baselineY = opts.baselineY ?? 1320;
    this.centerX = opts.centerX ?? 540;
    this.maxWidth = opts.maxWidth ?? 900;
    this.fill = opts.fill ?? '#FFFFFF';
    this.accent = opts.accent ?? '#FACC15';
    this.accentSoft = opts.accentSoft ?? '#FDE047';
    this.stroke = opts.stroke ?? '#050811';
    this.strokeWidth = opts.strokeWidth ?? 11;
    this.backdrop = opts.backdrop ?? 'rgba(6, 10, 18, 0.62)';
    this.activeWordPill = opts.activeWordPill ?? true;
    this.uppercase = opts.uppercase ?? false;
    this.emphasis = opts.emphasis ?? [];

    if (opts.scenes && opts.scenes.length > 0) {
      this.setScenes(opts.scenes);
    } else if (opts.words && opts.words.length > 0) {
      this.setWords(opts.words, this.emphasis);
    }
    if (legacyScenes) this.legacy = new LegacyKineticCaptions(legacyScenes, legacyStyle ?? DEFAULT_CAPTION_STYLE);
  }

  public setWords(words: WordTiming[], emphasis: CaptionEmphasisSpec[] = []): void {
    this.emphasis = emphasis;
    this.computedCues = buildCaptionCues(words, this.maxCharsPerLine, emphasis);
  }

  public setScenes(scenes: SceneNarrationInput[]): void {
    const allWords: WordTiming[] = [];
    const empMap = new Map<string, CaptionEmphasisSpec[]>();

    scenes.forEach((sc, idx) => {
      const sceneId = sc.id ?? `S${String(idx + 1).padStart(2, '0')}`;
      if (sc.caption_emphasis) {
        empMap.set(sceneId, sc.caption_emphasis);
      }
      if (sc.words) {
        for (const w of sc.words) {
          allWords.push({ ...w, sceneId });
        }
      }
    });

    this.computedCues = buildCaptionCues(
      allWords,
      this.maxCharsPerLine,
      this.emphasis,
      empMap
    );
  }

  /**
   * Returns the exact displayed phrase cues and timestamps so tools/transcript.mjs
   * writes matching .srt and .txt files[cite: 1].
   */
  public cues(): CaptionCue[] {
    if (this.legacy) return this.legacy.cues() as unknown as CaptionCue[];   // earlier shape: { lines: string[], start, end }
    return this.computedCues;
  }

  /** CaptionLayer interface used by FilmPipeline. */
  public draw(ctx: CanvasRenderingContext2D, time_s: number): void { this.render(ctx, time_s); }

  public render(ctx: CanvasRenderingContext2D, time_s: number): void {
    if (this.legacy) { this.legacy.draw(ctx, time_s); return; }
    const activeCue = this.computedCues.find(
      (c) => time_s >= c.start_s - 0.04 && time_s <= c.end_s + 0.12
    );
    if (!activeCue) return;

    const fadeIn = Math.min(1, Math.max(0, (time_s - (activeCue.start_s - 0.04)) / 0.07));
    const fadeOut = Math.min(1, Math.max(0, (activeCue.end_s + 0.12 - time_s) / 0.09));
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const lineStepPx = Math.round(this.fontSize * this.lineHeight);
    const lineCount = activeCue.lines.length;
    const firstLineY =
      lineCount === 1 ? this.baselineY : this.baselineY - Math.round(lineStepPx * 0.5);

    ctx.font = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    const spaceW = ctx.measureText(' ').width;

    // Measure line widths for backdrop pill
    const lineWidths = activeCue.lines.map((line) => {
      const str = line
        .map((w) => (this.uppercase ? w.word.toUpperCase() : w.word))
        .join(' ');
      return ctx.measureText(str).width;
    });
    const maxLineW = Math.max(...lineWidths, 0);

    if (this.backdrop) {
      const padX = 32;
      const padY = 22;
      const boxW = Math.min(this.maxWidth + padX * 2, maxLineW + padX * 2);
      const boxH = lineCount * lineStepPx + padY * 1.4;
      const boxX = this.centerX - boxW * 0.5;
      const boxY = firstLineY - Math.round(this.fontSize * 0.84) - padY * 0.5;

      ctx.fillStyle =
        typeof this.backdrop === 'string' ? this.backdrop : 'rgba(6, 10, 18, 0.62)';
      roundRect(ctx, boxX, boxY, boxW, boxH, 22);
      ctx.fill();
    }

    let wordCursorIdx = 0;

    for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
      const lineWords = activeCue.lines[lineIdx];
      const lineW = lineWidths[lineIdx];
      let x = this.centerX - lineW * 0.5;
      const y = firstLineY + lineIdx * lineStepPx;

      for (let i = 0; i < lineWords.length; i++) {
        const w = lineWords[i];
        const displayWord = this.uppercase ? w.word.toUpperCase() : w.word;
        const wordW = ctx.measureText(displayWord).width;

        const isActive = time_s >= w.start_s - 0.02 && time_s <= w.end_s + 0.04;
        const empTreatment = resolveWordEmphasis(activeCue, wordCursorIdx);
        wordCursorIdx++;

        let scale = isActive ? 1.045 : 1.0;
        if (empTreatment === 'gentle_scale' && time_s >= w.start_s) {
          scale *= 1.05;
        }

        let wordFill = this.fill;
        if (isActive) {
          wordFill = this.accent;
        } else if (empTreatment === 'accent_color') {
          wordFill = this.accentSoft;
        }

        ctx.save();
        const wordCenterX = x + wordW * 0.5;
        const wordCenterY = y - this.fontSize * 0.34;
        ctx.translate(wordCenterX, wordCenterY);
        ctx.scale(scale, scale);
        ctx.translate(-wordCenterX, -wordCenterY);

        // Optional subtle glow emphasis
        if (empTreatment === 'subtle_glow' || isActive) {
          ctx.shadowColor = isActive
            ? 'rgba(250, 204, 21, 0.45)'
            : 'rgba(56, 189, 248, 0.4)';
          ctx.shadowBlur = isActive ? 18 : 14;
        } else {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
        }

        // Optical stroke
        if (this.strokeWidth > 0) {
          ctx.strokeStyle = this.stroke;
          ctx.lineWidth = this.strokeWidth;
          ctx.strokeText(displayWord, x, y);
        }

        // Fill text
        ctx.fillStyle = wordFill;
        ctx.fillText(displayWord, x, y);
        ctx.restore();

        x += wordW + spaceW;
      }
    }

    ctx.restore();
  }
}

export function createKineticCaptions(options: KineticCaptionsOptions = {}): KineticCaptions {
  return new KineticCaptions(options);
}