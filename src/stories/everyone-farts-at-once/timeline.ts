import T from './timeline.json';
export { T };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** Smooth bump: rises over the first 30% of `dur` after `at`, falls back to 0 by `at + dur`. */
export const pulse = (t: number, at: number, dur: number) => t < at || t > at + dur ? 0 : t < at + dur * 0.3 ? ease((t - at) / (dur * 0.3)) : 1 - ease((t - at - dur * 0.3) / (dur * 0.7));
/** Gas from one passage (L), H2S in flatus (mol fraction, ~1.06 µmol/L) and the odour threshold (ppb). */
export const FART_L = 0.06, H2S_FRAC = 26e-6, H2S_SMELL_PPB = 0.47;
/** H2S (ppb) in the elevator: six passages mixing into ~5 m³ of air after the event. */
export const elevatorPpb = (t: number) => windowAt(t, T.fart + 0.3, T.react + 1.0) * (6 * FART_L * H2S_FRAC / 5000) * 1e9;
