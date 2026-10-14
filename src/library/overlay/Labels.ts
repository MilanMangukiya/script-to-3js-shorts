/**
 * overlay-labels-v1 — Diegetic Simulation HUD, 3D Leader-Line Callouts & Rich Text
 *
 * Upgraded for high-retention simulation Shorts:
 * - Suppresses academic meta-disclaimers ("SCHEMATIC • NOT TO SCALE", "ILLUSTRATIVE", etc.)
 *   by default so they never clutter production renders, while keeping all legacy exports intact.
 * - Adds drawSimulationHud() and renderShotHudTelemetry() for live top-left simulation counters.
 * - Enhances 3D leader-line callouts with target reticles and automatic safe-zone flipping.
 */

import { drawCallout as legacyDrawCallout } from './LabelsLegacy';

export interface LabelTextOptions {
  size?: number;
  weight?: number | string;
  color?: string;
  alpha?: number;
  tracking?: number;
  align?: CanvasTextAlign;
  fontFamily?: string;
  sub?: boolean;
}

export interface StatusChipOptions extends LabelTextOptions {
  accent?: string;
  dot?: boolean;
  value?: string;
  valueColor?: string;
  bgColor?: string;
  borderColor?: string;
  pulseTime_s?: number;
  forceShowDisclaimer?: boolean;
}

export interface CalloutOptions extends StatusChipOptions {
  dx?: number;
  dy?: number;
  value?: string;
  safeLeft?: number;
  safeRight?: number;
  safeTop?: number;
  safeBottom?: number;
  reticleRadius?: number;
}

export interface HudTelemetrySpec {
  timer_label: string;
  metric_label: string;
  start_value: number;
  end_value: number;
  unit: string;
  alert_level?: 'normal' | 'warning' | 'critical';
}

export interface SimulationHudRenderOptions {
  x?: number;
  y?: number;
  time_s: number;
  shotStart_s: number;
  shotEnd_s: number;
  telemetry: HudTelemetrySpec;
  secondaryText?: string;
  alpha?: number;
}

const DISCLAIMER_PATTERNS = [
  /schematic/i,
  /not to scale/i,
  /illustrative/i,
  /exact effect uncertain/i,
  /derived geometry/i,
  /hypothetical\s*[•·-]\s*cgi/i,
  /conceptual/i,
];

/**
 * Returns true if a label string is an academic meta-disclaimer that should be hidden
 * on production short-form renders.
 */
export function isAcademicDisclaimer(text: string): boolean {
  if (!text) return false;
  return DISCLAIMER_PATTERNS.some((pattern) => pattern.test(text));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep01(t: number): number {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

function roundRectPath(
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

interface Token {
  text: string;
  kind: 'normal' | 'sub' | 'sup';
}

/**
 * Parses chemical/math tokens such as "O_2", "H_2O", "CO_2", or "10^14" into
 * baseline, subscript, and superscript runs.
 */
function tokenizeRichText(input: string, enableSub = true): Token[] {
  if (!enableSub || (!input.includes('_') && !input.includes('^'))) {
    return [{ text: input, kind: 'normal' }];
  }
  const tokens: Token[] = [];
  let i = 0;
  let current = '';

  const flushNormal = () => {
    if (current.length > 0) {
      tokens.push({ text: current, kind: 'normal' });
      current = '';
    }
  };

  while (i < input.length) {
    const ch = input[i];
    if ((ch === '_' || ch === '^') && i + 1 < input.length) {
      const kind: 'sub' | 'sup' = ch === '_' ? 'sub' : 'sup';
      flushNormal();
      i++;
      if (input[i] === '{') {
        const closeIdx = input.indexOf('}', i + 1);
        if (closeIdx !== -1) {
          tokens.push({ text: input.slice(i + 1, closeIdx), kind });
          i = closeIdx + 1;
          continue;
        }
      }
      let match = '';
      while (i < input.length && /[0-9+\-a-zA-Z]/.test(input[i])) {
        match += input[i];
        i++;
      }
      if (match.length > 0) {
        tokens.push({ text: match, kind });
        continue;
      }
    }
    current += ch;
    i++;
  }
  flushNormal();
  return tokens;
}

export function measureRichTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: LabelTextOptions = {}
): number {
  const size = options.size ?? 26;
  const weight = options.weight ?? 700;
  const fontFamily = options.fontFamily ?? 'Inter, -apple-system, sans-serif';
  const tracking = options.tracking ?? 0;
  const tokens = tokenizeRichText(text, options.sub ?? true);

  ctx.save();
  let total = 0;
  for (const token of tokens) {
    const fontSize = token.kind === 'normal' ? size : Math.round(size * 0.72);
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    total += ctx.measureText(token.text).width;
    if (tracking !== 0 && token.text.length > 1) {
      total += tracking * (token.text.length - 1);
    }
  }
  ctx.restore();
  return total;
}

/**
 * Draws rich text supporting chemical subscripts (H_2O, O_2) and exponents (10^14).
 */
export function drawRichText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: LabelTextOptions = {}
): number {
  const size = options.size ?? 26;
  const weight = options.weight ?? 700;
  const color = options.color ?? '#F8FAFC';
  const alpha = options.alpha ?? 1;
  const align = options.align ?? 'left';
  const fontFamily = options.fontFamily ?? 'Inter, -apple-system, sans-serif';
  const tokens = tokenizeRichText(text, options.sub ?? true);

  const totalW = measureRichTextWidth(ctx, text, options);
  let cursorX = x;
  if (align === 'center') cursorX -= totalW * 0.5;
  else if (align === 'right') cursorX -= totalW;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  for (const token of tokens) {
    const fontSize = token.kind === 'normal' ? size : Math.round(size * 0.72);
    const offsetY =
      token.kind === 'sub'
        ? Math.round(size * 0.22)
        : token.kind === 'sup'
        ? -Math.round(size * 0.32)
        : 0;
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    ctx.fillText(token.text, cursorX, y + offsetY);
    cursorX += ctx.measureText(token.text).width;
  }

  ctx.restore();
  return totalW;
}

/**
 * Legacy helper kept for backward compatibility with existing story stages.
 * Academic disclaimers ("SCHEMATIC • NOT TO SCALE", "ILLUSTRATIVE", etc.) are suppressed
 * by default unless options.forceShowDisclaimer is explicitly true.
 */
export function drawSchematicTag(
  ctx: CanvasRenderingContext2D,
  text = 'SCHEMATIC • NOT TO SCALE',
  x = 90,
  y = 220,
  options: StatusChipOptions = {}
): void {
  if (!options.forceShowDisclaimer && isAcademicDisclaimer(text)) {
    return;
  }
  drawStatusChip(ctx, text, x, y, {
    size: 22,
    weight: 700,
    accent: '#38BDF8',
    dot: true,
    ...options,
  });
}

/**
 * Draws a compact diegetic status chip / telemetry badge.
 * Automatically filters out academic meta-disclaimer strings unless forced.
 */
export function drawStatusChip(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  options: StatusChipOptions = {}
): { width: number; height: number } {
  if (!options.forceShowDisclaimer && isAcademicDisclaimer(label)) {
    return { width: 0, height: 0 };
  }

  const size = options.size ?? 26;
  const weight = options.weight ?? 700;
  const color = options.color ?? '#F8FAFC';
  const valueText = options.value ?? '';
  const valueColor = options.valueColor ?? '#FACC15';
  const accent = options.accent ?? '#38BDF8';
  const alpha = options.alpha ?? 1;
  const showDot = options.dot ?? true;

  if (alpha <= 0.001) return { width: 0, height: 0 };

  const padX = Math.round(size * 0.7);
  const padY = Math.round(size * 0.48);
  const dotSpace = showDot ? Math.round(size * 0.78) : 0;
  const gap = valueText ? Math.round(size * 0.45) : 0;

  const labelW = measureRichTextWidth(ctx, label, { size, weight, sub: options.sub });
  const valueW = valueText
    ? measureRichTextWidth(ctx, valueText, { size, weight: 800, sub: options.sub })
    : 0;

  const boxW = Math.round(padX * 2 + dotSpace + labelW + gap + valueW);
  const boxH = Math.round(size + padY * 2);

  let boxX = x;
  if (options.align === 'center') boxX -= boxW * 0.5;
  else if (options.align === 'right') boxX -= boxW;

  ctx.save();
  ctx.globalAlpha *= alpha;

  // Dark glass backdrop with subtle shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;

  roundRectPath(ctx, boxX, y, boxW, boxH, Math.round(boxH * 0.32));
  ctx.fillStyle = options.bgColor ?? 'rgba(9, 13, 22, 0.82)';
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = options.borderColor ?? 'rgba(255, 255, 255, 0.16)';
  ctx.stroke();

  let cursorX = boxX + padX;
  const baselineY = y + Math.round(boxH * 0.5 + size * 0.34);

  if (showDot) {
    const dotR = Math.max(4, Math.round(size * 0.2));
    const dotX = cursorX + dotR;
    const dotY = y + boxH * 0.5;
    const pulse =
      options.pulseTime_s !== undefined
        ? 0.65 + 0.35 * Math.sin(options.pulseTime_s * 6.0)
        : 1.0;

    ctx.save();
    ctx.fillStyle = accent;
    ctx.globalAlpha *= pulse;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    cursorX += dotSpace;
  }

  drawRichText(ctx, label, cursorX, baselineY, {
    size,
    weight,
    color,
    sub: options.sub,
  });

  if (valueText) {
    cursorX += labelW + gap;
    drawRichText(ctx, valueText, cursorX, baselineY, {
      size,
      weight: 800,
      color: valueColor,
      sub: options.sub,
    });
  }

  ctx.restore();
  return { width: boxW, height: boxH };
}

/**
 * Formats an interpolated numeric value cleanly for the live Simulation HUD.
 */
export function formatHudValue(val: number, startVal: number, endVal: number): string {
  const span = Math.abs(endVal - startVal);
  if (Math.abs(val) >= 10000) {
    return Math.round(val).toLocaleString('en-US');
  }
  if (span > 0 && span < 2) {
    return val.toFixed(2);
  }
  if (span > 0 && span < 20 && !Number.isInteger(endVal)) {
    return val.toFixed(1);
  }
  return Math.round(val).toLocaleString('en-US');
}

/**
 * Renders the persistent top-left Simulation Telemetry HUD defined by
 * storyboard.schema.json's `shots[].hud_telemetry` contract.
 */
export function renderShotHudTelemetry(
  ctx: CanvasRenderingContext2D,
  options: SimulationHudRenderOptions
): void {
  const {
    x = 90,
    y = 220,
    time_s,
    shotStart_s,
    shotEnd_s,
    telemetry,
    secondaryText,
    alpha = 1,
  } = options;

  if (alpha <= 0.001) return;

  const duration = Math.max(0.001, shotEnd_s - shotStart_s);
  const progress = smoothstep01((time_s - shotStart_s) / duration);
  const currentVal =
    telemetry.start_value + (telemetry.end_value - telemetry.start_value) * progress;
  const formattedVal = formatHudValue(
    currentVal,
    telemetry.start_value,
    telemetry.end_value
  );
  const unitStr = telemetry.unit ? ` ${telemetry.unit}` : '';
  const metricReadout = `${formattedVal}${unitStr}`;

  const alertLevel = telemetry.alert_level ?? 'normal';
  const accentColor =
    alertLevel === 'critical'
      ? '#EF4444'
      : alertLevel === 'warning'
      ? '#F97316'
      : '#38BDF8';
  const valueColor =
    alertLevel === 'critical'
      ? '#FCA5A5'
      : alertLevel === 'warning'
      ? '#FACC15'
      : '#38BDF8';

  const timerChip = drawStatusChip(ctx, telemetry.timer_label.toUpperCase(), x, y, {
    size: 24,
    weight: 800,
    accent: accentColor,
    dot: true,
    pulseTime_s: time_s,
    alpha,
    bgColor: 'rgba(7, 11, 20, 0.86)',
    borderColor:
      alertLevel === 'critical'
        ? 'rgba(239, 68, 68, 0.45)'
        : 'rgba(56, 189, 248, 0.28)',
  });

  const row2Y = y + timerChip.height + 10;
  const metricChip = drawStatusChip(
    ctx,
    `${telemetry.metric_label.toUpperCase()}:`,
    x,
    row2Y,
    {
      size: 28,
      weight: 700,
      value: metricReadout,
      valueColor,
      dot: false,
      alpha,
      bgColor: 'rgba(7, 11, 20, 0.88)',
      borderColor: 'rgba(255, 255, 255, 0.18)',
    }
  );

  if (secondaryText && !isAcademicDisclaimer(secondaryText)) {
    drawStatusChip(ctx, secondaryText, x, row2Y + metricChip.height + 10, {
      size: 22,
      weight: 600,
      dot: false,
      alpha: alpha * 0.9,
    });
  }
}

/**
 * Draws a 3D leader-line callout anchored to screen coordinates (tx, ty) from projectToScreen().
 * Automatically flips horizontal/vertical offset to remain inside the 9:16 safe area.
 */
function drawCalloutModern(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  label: string,
  options: CalloutOptions = {}
): void {
  if (!options.forceShowDisclaimer && isAcademicDisclaimer(label)) {
    return;
  }

  const alpha = options.alpha ?? 1;
  if (alpha <= 0.001) return;

  const size = options.size ?? 26;
  const weight = options.weight ?? 700;
  const accent = options.accent ?? '#FACC15';
  const safeLeft = options.safeLeft ?? 90;
  const safeRight = options.safeRight ?? 990;
  const safeTop = options.safeTop ?? 220;
  const safeBottom = options.safeBottom ?? 1240;

  const valueText = options.value ?? '';
  const padX = Math.round(size * 0.7);
  const padY = Math.round(size * 0.48);
  const labelW = measureRichTextWidth(ctx, label, { size, weight, sub: options.sub });
  const valueW = valueText
    ? measureRichTextWidth(ctx, valueText, { size, weight: 800, sub: options.sub }) +
      Math.round(size * 0.45)
    : 0;
  const boxW = Math.round(padX * 2 + labelW + valueW);
  const boxH = Math.round(size + padY * 2);

  let dx = options.dx ?? 72;
  let dy = options.dy ?? -64;

  // Flip horizontal direction if chip would overflow left/right safe bounds
  if (tx + dx + boxW > safeRight && tx - Math.abs(dx) - boxW >= safeLeft) {
    dx = -Math.abs(dx);
  } else if (tx + dx < safeLeft && tx + Math.abs(dx) + boxW <= safeRight) {
    dx = Math.abs(dx);
  }

  // Flip vertical direction if chip would overflow top/bottom safe bounds
  if (ty + dy < safeTop) {
    dy = Math.abs(dy);
  } else if (ty + dy + boxH > safeBottom) {
    dy = -Math.abs(dy);
  }

  const elbowX = tx + dx;
  const elbowY = ty + dy;
  const chipX = dx >= 0 ? elbowX : elbowX - boxW;
  const chipY = Math.max(
    safeTop,
    Math.min(safeBottom - boxH, Math.round(elbowY - boxH * 0.5))
  );
  const attachY = chipY + boxH * 0.5;

  ctx.save();
  ctx.globalAlpha *= alpha;

  // Leader line
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(elbowX, attachY);
  ctx.stroke();

  // Target point reticle
  const reticleR = options.reticleRadius ?? 6;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(tx, ty, reticleR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(tx, ty, reticleR + 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  drawStatusChip(ctx, label, chipX, chipY, {
    ...options,
    dot: false,
    align: 'left',
    borderColor: accent,
  });
}

// Aliases for compatibility across all existing story files
export const drawLeaderCallout = drawCallout;
export const drawTag = drawStatusChip;
export const drawSimulationHud = renderShotHudTelemetry;

// ---- Backward compatibility with films written before this rewrite (implementations in LabelsLegacy.ts).
export { drawChip, drawRich, measureRich, roundRect } from './LabelsLegacy';
type LegacyCalloutOptions = { alpha?: number; color?: string; size?: number; sub?: string };
/** Leader-line callout. New form: (ctx, tx, ty, label, options). Earlier form: (ctx, text, ax, ay, dx, dy, opts). */
export function drawCallout(ctx: CanvasRenderingContext2D, tx: number, ty: number, label: string, options?: CalloutOptions): void;
export function drawCallout(ctx: CanvasRenderingContext2D, text: string, ax: number, ay: number, dx: number, dy: number, opts?: LegacyCalloutOptions): void;
export function drawCallout(ctx: CanvasRenderingContext2D, a: number | string, b: number, c: string | number, d?: CalloutOptions | number, e?: number, f?: LegacyCalloutOptions): void {
  if (typeof a === 'string') { legacyDrawCallout(ctx, a, b, c as number, d as number, e as number, f); return; }
  drawCalloutModern(ctx, a, b, c as string, (d as CalloutOptions | undefined) ?? {});
}
