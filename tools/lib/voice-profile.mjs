import fs from 'node:fs';
import path from 'node:path';
import { PACING_SPEED } from './performance.mjs';

/** A Kokoro voice id, or a weighted blend of ids ('am_michael*0.7+am_onyx*0.3'; see tools/narrate-cached.py voice_style). */
export const VOICE_SPEC = /^[a-z]{2}_[a-z0-9_]+(\*\d*\.?\d+)?(\+[a-z]{2}_[a-z0-9_]+(\*\d*\.?\d+)?){0,3}$/;

/** A local default; explicit CLI/story voice choices remain authoritative. */
export function readVoiceProfile(root) {
  const file = path.join(root, 'config', 'narration.json');
  if (!fs.existsSync(file)) return { voice_id: 'am_michael', pacing_speed: { ...PACING_SPEED } };
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (typeof profile.voice_id !== 'string' || !VOICE_SPEC.test(profile.voice_id)) throw new Error('config/narration.json needs a local voice_id (or a blend such as am_michael*0.7+am_onyx*0.3)');
  if (!profile.pacing_speed || Object.keys(PACING_SPEED).some((key) => !Number.isFinite(profile.pacing_speed[key]) || profile.pacing_speed[key] < .5 || profile.pacing_speed[key] > 1.2)) throw new Error('config/narration.json needs measured starting rates (0.5-1.2) for all pacing energies');
  return profile;
}
