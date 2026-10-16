# Scene sound design

Make the setting and action audible while keeping the narration easy to understand. Apply Analyze -> Plan -> Work -> Review to the requested audio area. Keep narration, action sounds, ambience and music as separately controllable layers. A sound review does not itself request a film rebuild, archive upload or new voice.

## Analyze

Read the storyboard, actual action/contact times, `assets/registry.json`, `src/stories/<slug>/soundtrack.mjs`, `src/library/audio/synth.mjs` and `tools/soundtrack.mjs`. Inspect available audio files before claiming that a recording or sound library exists.

- Environment: waves, wind, rain, birds, room tone or street ambience appropriate to the actual location. Respect acoustic changes between indoor/outdoor views and settings where silence is meaningful.
- Human and object actions: clapping, breathing, sneezing, footsteps, drinking, splashing, handling a prop or closing a door. Identify the visible or established offscreen source.
- Vocal reactions: an inhale, sigh, gasp or chuckle that belongs to a specific actor or the narrator. Distinguish these recordings from emotional intonation within speech.

Distinguish sound produced inside the scene from music or editorial accents. Let the setting determine what can be heard: an exterior space view does not acquire wind or birds merely because the picture needs energy. Sounds should follow the counterfactual's stated conditions and acoustic medium.

Local Kokoro receives text, voice, language and speed; it has no reliable exposed laugh/gasp/emotion control. Use an actual suitable recording or a verified capable generator for vocal reactions. Do not put `[gasp]` into narration, substitute a spoken "ha ha" for a natural chuckle, or label procedural noise as an authentic human recording. Preserve the user's selected narrator; a different speech engine or voice needs a separate audition within the requested scope.

## Plan

For full films, plan suitable environmental ambience and audible action cues as part of sound design. Avoid adding a sound to every gesture or filling every pause. Narrator reactions are optional; a small number of meaningful reactions can support a reveal or comic payoff, while none may suit a serious sequence.

Use existing `audio.sfx_direction` and `scenes[].audio_cues` fields. Each cue needs a source, absolute `at_s`, `duration_s`, purpose and intended `relative_db`. Put the source/action explanation in `description`; do not invent an `asset_id`, `file` or `emotion` property on a cue. Use `kind: "ambience"` for environmental beds, `"texture"` for breaths, reactions and handling, and `"impact"` for discrete contacts such as a clap. Keep the existing schema; there are no `"gasp"`, `"clap"` or `"foley"` cue kinds.

For a full film or a requested sound revision, keep a concise `build/<slug>/audio/sound-plan.md`. Map each important cue to its story purpose/source, onset/duration, actual registered clip/path or procedural method, gain treatment, and implementation/review status. Record trim/transient offsets when they affect sync. This production note holds implementation details outside the storyboard schema; it is not on-screen copy. Update planned cues after mixing so a named effect cannot be mistaken for a sound that was actually delivered.

Choose from these examples only when the scene earns them:

| Sound | Event to synchronize | Direction |
| --- | --- | --- |
| Waves, wind, rain or birds | Location and weather established by the shot | Quiet continuous environment; change its character across locations, with smooth loop boundaries. |
| Clapping | Actual palm contact | Match a single clap or the staged rhythm; keep a crowd's gain bounded. |
| Breathing | A particular character's inhale/exhale or a narrator's speech gap | Subtle and appropriate to distance; avoid a loud breath before every sentence. |
| Sneezing | Expulsion/recoil, with any recorded anticipation and recovery retained | Align the audible sneeze transient rather than the beginning of its file. |
| Footsteps, drinking or handling | Foot plant, visible intake or prop contact | Match surface/material and action duration; stop when the action ends. |
| Gasps, sighs or chuckles | An earned surprise, release or comic beat | Optional short reactions that leave key words and numbers clear. |

- Time a clap to palm contact, footsteps to planted steps, and a sneeze to its expulsion/recoil. In close views, target alignment within one video frame; account for distance when an audible delay is physically meaningful.
- Match a sound's distance, room character and vocal identity to its source. A narrator breath and a distant crowd sneeze serve different purposes.
- Put optional narrator reactions in genuine speech gaps. Keep unfamiliar numbers and decisive words unobscured, and preserve the required pre-reveal music/ambience dip.
- Reuse registered clips first. If a required clip is missing, source or create it within the task's authorization, use an appropriate stylized substitute with an honest description, or record the omission. Distinguish a missing pivotal action sound from an optional embellishment: make a bounded effort to resolve the former and identify any remaining gap in the production report. Do not silently mark an unavailable clip as implemented or register a nonexistent file. A new instruction does not install an audio library.
- Preserve the stated timing rule for collective actions. A stipulated simultaneous global sneeze does not become a traveling wave merely to spread out sound effects. Crowd layering illustrates the scene; it does not establish an unsourced global sound-pressure calculation.

## Work

Register reusable audio clips with their actual path, source/reuse terms, duration, sample rate and channel information in supported asset metadata or accompanying source notes. Trim unwanted leading silence, retain the natural attack/tail, and add short fades only where they do not erase the action. Check recordings for speech, baked-in music and room noise before mixing.

Use the measured audible attack/contact offset within each clip when scheduling it. If the clap transient is 40ms after the file starts, its placement must account for that offset. Keep a sneeze's intake or a door's approach when it helps the pictured action; do not cut every recording at its loudest sample. Keep sustained ambience continuous across cuts within one location, and transition it deliberately when location changes.

Implement the planned events in `buildSoundtrack` and schedule them offline from absolute film time. Do not call browser playback from `Stage.update()` during frame rendering. The generic mixer automatically handles `silence` cues; other `audio_cues` are production instructions and do not play clips by themselves. Their timing and gain must be implemented in the story soundtrack.

Use real audio samples with the existing buffer/mix helpers, resampling and mapping channels as needed. `tools/lib/wav.mjs` reads 16-bit PCM WAV; convert unsupported recordings explicitly with bundled FFmpeg. Verify finite, nonempty samples and headroom before PCM conversion, and avoid truncated attacks, clipped peaks or obvious loop seams. Use seeded choices if varying repeated effects.

The mixer ducks the `music` buffer for silence cues, then adds `sfx`. Keep ambient beds on the ducked bed path or explicitly apply the same silence cues to ambience carried in `sfx`. Foreground contacts remain separately timed; do not fill a reveal dip with unrelated decorative effects.

Keep ambience quiet beneath speech. Adjust relative gain, gentle EQ/compression and voice-triggered ducking when needed; constant pitch shifts or oscillating volume do not create natural expression. Do not give a soft breath the same treatment as a major impact. Judge voice presence at matched overall loudness.

When the voice feels weak, inspect the narration and bed levels before raising the entire master. Lower a competing sound or make a modest speech-processing adjustment when justified; repeated normalization can cancel a simple whole-track gain increase. Keep music, breaths and sharp transients from masking consonants or number sequences. Where repeated clips are necessary, use suitable variants and seeded choices without changing the event timing or creating excessive stacked peaks.

Keep non-speech clips separate from exact spoken narration and its recognition/caption source. Adding Foley does not add spoken caption words. If narration timing changes, regenerate its verified timings/captions and retime dependent music, effects and visual reveals together.

Run `node tools/soundtrack.mjs <slug>` for a requested production mix. Preserve the repository's -14.0 LUFS / <= -1.0 dBTP delivery targets and check the final AAC encode as well as the WAV.

## Review

Keep comparisons under `build/` and change one audio area at a time. For a mix comparison, use identical narration bytes and comparable loudness before evaluating processing or new effects.

Review the assembled moving excerpt with the actual mix. Check contact sync, appropriate source/distance, natural clip boundaries, ambience continuity, clear words/numbers, reveal timing and the final syllable. Listen for excessive reactions, repeated samples, noise, harshness and competing music; check that speech remains clear in mono and on a phone when playback is available.

Verify duration, cue bounds, sample validity, peaks and integrated loudness. Technical checks and ASR cannot establish natural-sounding Foley or improved retention. If listening is unavailable, provide playable samples and record that limitation rather than claiming a perceptual pass. Record missing clips or stylized substitutes so the final production report distinguishes implemented sound from planned sound.

Before closing the sound pass, reconcile `sound-plan.md` with the actual soundtrack and rendered excerpt: important audible actions have a matching implemented cue or an explicit reason for silence; every claimed recording exists; and contact offsets, speech clearance and the reveal dip were checked. Report technical checks separately from listening judgments. Do not use a completed cue list alone as evidence of a convincing final mix.
