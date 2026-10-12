// Minimal PCM WAV read/write helpers shared by the narration and soundtrack tools.
import fs from 'node:fs';

/** Write channels (array of equal-length Float32Array) as 16-bit PCM WAV. */
export function writeWav(file, channels, sampleRate) {
  const n = channels[0].length, c = channels.length;
  const buf = Buffer.alloc(44 + n * c * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * c * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(c, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * c * 2, 28); buf.writeUInt16LE(c * 2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * c * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) {
    const v = Math.max(-1, Math.min(1, channels[k][i]));
    buf.writeInt16LE(Math.round(v * 32767), o); o += 2;
  }
  fs.writeFileSync(file, buf);
}

/** Read a 16-bit PCM WAV into { sampleRate, channels: Float32Array[] }. */
export function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12, fmt = null, data = null;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(o + 10), sampleRate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') { data = b.subarray(o + 8, o + 8 + size); break; }
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error(`Unsupported WAV: ${file}`);
  const n = data.length / 2 / fmt.channels;
  const channels = Array.from({ length: fmt.channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let k = 0; k < fmt.channels; k++) channels[k][i] = data.readInt16LE((i * fmt.channels + k) * 2) / 32768;
  return { sampleRate: fmt.sampleRate, channels };
}

/** Linear resampler that pre-averages when downsampling (adequate for speech alignment and bed mixing). */
export function resample(x, from, to) {
  if (from === to) return x;
  const ratio = from / to, n = Math.floor(x.length / ratio), y = new Float32Array(n);
  const w = Math.max(1, Math.round(ratio));
  for (let i = 0; i < n; i++) {
    const p = i * ratio, i0 = Math.floor(p), f = p - i0;
    let a = 0, b2 = 0;
    for (let k = 0; k < w; k++) { a += x[Math.min(x.length - 1, i0 + k)] || 0; b2 += x[Math.min(x.length - 1, i0 + 1 + k)] || 0; }
    y[i] = (a * (1 - f) + b2 * f) / w;
  }
  return y;
}
