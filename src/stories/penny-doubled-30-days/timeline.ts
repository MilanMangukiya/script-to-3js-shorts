import T from './timeline.json';
export { T };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** Smooth bump: rises over the first 30% of `dur` after `at`, falls back to 0 by `at + dur`. */
export const pulse = (t: number, at: number, dur: number) => t < at || t > at + dur ? 0 : t < at + dur * 0.3 ? ease((t - at) / (dur * 0.3)) : 1 - ease((t - at - dur * 0.3) / (dur * 0.7));

/** The day in progress at film time t (1..30): day d begins at T.days[d - 1]. */
export function dayAt(t: number) { let d = 1; while (d < 30 && t >= T.days[d]) d++; return d; }
/** Pennies on hand at the start of day d. */
export const pennies = (d: number) => 2 ** (d - 1);
/**
 * Pennies the picture shows at time t: the new day's coins arrive over T.growS after the tick, so a heap grows
 * smoothly from 2^(d-2) to 2^(d-1) instead of jumping.
 */
export function shownPennies(t: number) {
  const d = dayAt(t); if (d === 1) return 1;
  const k = ease((t - T.days[d - 1]) / T.growS);
  return pennies(d - 1) * (1 + k);
}
export const dollars = (n: number) => `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Mass of n pennies at 2.5 g each, in the unit a viewer reads most easily. */
export function massLabel(n: number) {
  const kg = n * 0.0025;
  if (kg < 1) return `${Math.round(kg * 1000)} G`;
  if (kg < 1000) return `${kg < 10 ? kg.toFixed(1) : Math.round(kg).toLocaleString('en-US')} KG`;
  const t = kg / 1000;
  return `${t < 10 ? t.toFixed(1) : Math.round(t).toLocaleString('en-US')} TONNES`;
}
