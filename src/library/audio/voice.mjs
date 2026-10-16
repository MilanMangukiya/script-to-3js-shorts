// Voice finishing chain for synthesized narration (all local DSP): rumble high-pass, low-mid clean-up, presence lift,
// air shelf, a split-band de-esser and gentle soft-knee compression, so every cast voice sounds broadcast-clear
// and consistent before mixing.
import { filter, eq } from './synth.mjs';

function envelope(x, sr, attack, release) {
  const a = Math.exp(-1 / (attack * sr)), r = Math.exp(-1 / (release * sr)), e = new Float32Array(x.length); let v = 0;
  for (let i = 0; i < x.length; i++) { const s = Math.abs(x[i]); v = s > v ? a * v + (1 - a) * s : r * v + (1 - r) * s; e[i] = v; }
  return e;
}
/** Soft-knee compressor: threshold (dBFS of the envelope), ratio, knee (dB); returns a new signal. */
export function compress(x, sr, { threshold = -22, ratio = 2.5, knee = 6, attack = 0.006, release = 0.09, makeup = 0 } = {}) {
  const env = envelope(x, sr, attack, release), y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const lvl = 20 * Math.log10(env[i] + 1e-9), over = lvl - threshold;
    const gr = over <= -knee / 2 ? 0 : over >= knee / 2 ? over * (1 - 1 / ratio) : (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee);
    y[i] = x[i] * Math.pow(10, (makeup - gr) / 20);
  }
  return y;
}
/** De-esser: compress only the band above `split` Hz when its envelope exceeds the threshold. */
export function deEss(x, sr, { split = 5200, threshold = -32, ratio = 4 } = {}) {
  const hi = filter(filter(x, 'highpass', split, 0.707, sr), 'highpass', split, 0.707, sr), y = new Float32Array(x.length);
  const hc = compress(hi, sr, { threshold, ratio, knee: 4, attack: 0.002, release: 0.05 });
  for (let i = 0; i < x.length; i++) y[i] = x[i] - hi[i] + hc[i];
  return y;
}
export function voiceChain(x, sr) {
  let y = filter(filter(x, 'highpass', 72, 0.707, sr), 'highpass', 72, 0.707, sr);   // 24 dB/oct rumble cut
  y = eq(y, 'peaking', 290, -2.2, 1.0, sr);     // low-mid "boxiness"
  y = eq(y, 'peaking', 3300, 2.4, 0.85, sr);    // presence / intelligibility
  y = eq(y, 'highshelf', 9800, 1.6, 0.7, sr);   // air
  y = deEss(y, sr);
  return compress(y, sr, { threshold: -24, ratio: 2.4, knee: 8, attack: 0.008, release: 0.12 });
}
