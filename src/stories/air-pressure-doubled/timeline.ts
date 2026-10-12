// Story-specific cue times (absolute seconds), generated from the real narration word timings into cues.json
// by the storyboard generator so the film, its overlays and the soundtrack share one source.
import cues from './cues.json';

export const T = cues as typeof cues & Record<string, number>;
