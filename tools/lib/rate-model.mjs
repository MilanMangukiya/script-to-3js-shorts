// Text-aware starting speeds for Kokoro narration. Speaking time depends on far more than word count (syllables,
// clause and sentence pauses, spelled-out digits), so one rate per pacing energy can miss a script's band by ±20%.
// A linear duration model fitted on the studio's own storyboard corpus predicts each scene's duration at any speed:
//   duration(s) ≈ (Σ coef_i · feature_i) / s^exponent
// and inverts it for the speed that lands the target WPM. narrate.mjs still measures and calibrates every clip; a
// better first guess just means fewer synthesis passes. Coefficients live in config/narration.json (rate_model).

/** Fitted 2026-10-16 on 109 narrations × 3 speeds (am_michael, kokoro-onnx 0.6.1); median abs error 5.4 %. */
export const DEFAULT_RATE_MODEL = {
  voice: 'am_michael', exponent: 1.2,
  /** Silence narrate-cached.py keeps around each clip (50 ms lead + 100 ms tail); the cadence check counts it. */
  padding_s: 0.15,
  features: ['syllables', 'clause_pauses', 'sentence_ends', 'words', 'digits', 'const'],
  coef: [0.1921, 0.2474, 0.3546, 0.0678, 0.2737, -0.6791],
};

const syllables = (word) => {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return /\d/.test(word) ? 1 : 0;
  let n = (w.match(/[aeiouy]+/g) ?? []).length;
  if (w.endsWith('e') && !w.endsWith('le') && !w.endsWith('ee') && n > 1) n--;
  return Math.max(1, n);
};
/** Feature vector in DEFAULT_RATE_MODEL.features order. */
export function textFeatures(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const digits = words.filter((w) => /\d/.test(w)).reduce((n, w) => n + w.replace(/[^0-9]/g, '').length, 0);
  return [words.reduce((n, w) => n + syllables(w), 0), ((text + ' ').match(/[,;:\u2014\u2013-]\s/g) ?? []).length, ((text).match(/[.!?](\s|$)/g) ?? []).length, words.length, digits, 1];
}
export function predictDuration(text, speed, model = DEFAULT_RATE_MODEL) {
  const f = textFeatures(text), base = f.reduce((n, v, i) => n + v * model.coef[i], 0);
  return Math.max(0.3, base) / Math.pow(speed, model.exponent) + (model.padding_s ?? 0);
}
/** Speed (clamped to Kokoro's supported 0.5–1.2) whose predicted delivery hits `targetWpm`. */
export function startingRate(text, targetWpm, model = DEFAULT_RATE_MODEL) {
  const words = text.trim().split(/\s+/).filter(Boolean).length, want = Math.max(0.3, words * 60 / targetWpm - (model.padding_s ?? 0));
  const base = Math.max(0.3, textFeatures(text).reduce((n, v, i) => n + v * model.coef[i], 0));
  const s = Math.pow(base / want, 1 / model.exponent);
  return +Math.max(0.5, Math.min(1.2, s)).toFixed(4);
}
/** Validate a model object read from config (same shape as DEFAULT_RATE_MODEL). */
export function checkRateModel(m) {
  if (!m || !Array.isArray(m.coef) || m.coef.length !== DEFAULT_RATE_MODEL.coef.length || !m.coef.every(Number.isFinite) || !(m.exponent > 0.3 && m.exponent < 3)) throw new Error('config/narration.json rate_model needs exponent and six finite coefficients');
  return m;
}
