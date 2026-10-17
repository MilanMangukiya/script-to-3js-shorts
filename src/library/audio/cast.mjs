// Voice cast helpers shared by the narration tools: which local voice speaks each part of a scene.
// Storyboards may declare audio.voice_cast [{ role, voice_id, speed }] and split a scene's narration into
// narration.segments [{ voice: role, text }]; without them the lead narrator speaks the whole scene.

export const DEFAULT_CAST = {
  narrator: { voice_id: 'am_michael', speed: 0.92, description: 'Calm, warm adult male lead narrator' },
  cohost: { voice_id: 'af_heart', speed: 0.96, description: 'Bright, warm adult female co-narrator' },
  character: { voice_id: 'am_puck', speed: 1.0, description: 'On-screen person' },
};

/** role → { voice_id, speed } for a storyboard (cast entries override the defaults; --voice/--speed override the narrator). */
export function castOf(story, override = {}) {
  const cast = Object.fromEntries(Object.entries(DEFAULT_CAST).map(([k, v]) => [k, { ...v }]));
  for (const c of story.audio?.voice_cast ?? []) cast[c.role] = { ...(cast[c.role] ?? {}), voice_id: c.voice_id, speed: c.speed ?? 1, description: c.description };
  if (override.voice) cast.narrator.voice_id = override.voice;
  if (override.speed) cast.narrator.speed = override.speed;
  return cast;
}

/** The spoken parts of one scene, in order: [{ role, voice_id, speed, text }]. */
export function sceneSegments(scene, cast) {
  const segs = scene.narration.segments?.length ? scene.narration.segments : [{ voice: scene.narration.voice ?? 'narrator', text: scene.narration.text }];
  return segs.map((s) => { const v = cast[s.voice] ?? cast.narrator; return { role: s.voice in cast ? s.voice : 'narrator', voice_id: v.voice_id, speed: v.speed, text: s.text }; });
}

/** Silence inserted between two segments of the same scene (a natural hand-over between speakers), seconds. */
export const SEGMENT_GAP_S = 0.24;
