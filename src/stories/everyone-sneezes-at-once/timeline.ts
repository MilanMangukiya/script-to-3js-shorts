import T from './timeline.json';
export { T };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const windowAt = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** Smooth bump: rises over the first 30% of `dur` after `at`, falls back to 0 by `at + dur`. */
export const pulse = (t: number, at: number, dur: number) => t < at || t > at + dur ? 0 : t < at + dur * 0.3 ? ease((t - at) / (dur * 0.3)) : 1 - ease((t - at - dur * 0.3) / (dur * 0.7));
/** City traffic at 50 km/h. */
export const SPEED_CAR = 50 / 3.6;
/**
 * Seconds since the sneeze as each scene tells it: S01/S02/S04/S08 follow the real moment, S03 replays it from the
 * curb, S05 restarts it for the sound rings (from the end of "at once"), S06 replays it in slow motion.
 */
export function sneezeClock(t: number, sceneId: string) {
  if (sceneId === 'S03') return t - T.s03Sneeze;
  if (sceneId === 'S05') return t - T.s05Rings;
  if (sceneId === 'S06') return (t - T.s06Sneeze) / T.slowmo;
  return t - T.sneeze;
}
