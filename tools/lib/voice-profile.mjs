import fs from 'node:fs';
import path from 'node:path';
import { PACING_SPEED } from './performance.mjs';

/** A local default; explicit CLI/story voice choices remain authoritative. */
export function readVoiceProfile(root) {
  const file = path.join(root, 'config', 'narration.json');
  if (!fs.existsSync(file)) return { voice_id: 'am_michael', pacing_speed: { ...PACING_SPEED } };
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (typeof profile.voice_id !== 'string' || !/^[a-z]{2}_[a-z0-9_]+$/.test(profile.voice_id)) throw new Error('config/narration.json needs a local voice_id');
  if (!profile.pacing_speed || Object.keys(PACING_SPEED).some((key) => !Number.isFinite(profile.pacing_speed[key]) || profile.pacing_speed[key] < .5 || profile.pacing_speed[key] > 1.2)) throw new Error('config/narration.json needs measured starting rates (0.5-1.2) for all pacing energies');
  return profile;
}
