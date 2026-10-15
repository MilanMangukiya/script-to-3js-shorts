# Voice selection

## Analyze

Keep the approved performance and exact words fixed. Read any user preferences for vocal identity, language, accent and tone. Inspect locally available voice identifiers and the actual model/runtime, rather than assuming a voice mentioned in documentation is installed. Preserve an explicit user choice.

Choose diagnostic lines from the real script: an immediate hook, unfamiliar mechanism/number, and a softer or questioning turn. A candidate that only sounds forceful on a slogan may tire the listener during explanation. The current comparison uses three US male Kokoro voices to match the storyboard's existing male narrator direction.

## Plan

Use the same text, scene order, pause plan and output processing for candidates. Calibrate their actual cadence before judging: equal numeric speed values do not guarantee equal WPM. Aim for the story's opening/payoff targets without clipping speech. Keep candidates in separate `build/` directories and normalize audition loudness equally so volume does not choose the winner.

Separate technical eligibility from listening preference. Recognition, scene fit, clean boundaries and stable timing can reject a failed candidate. They cannot rank charisma or warmth. Suggested listening criteria are clear pronunciation, curiosity in the hook, ease through the mechanism, a believable turn, and low fatigue over repeated plays. Do not invent listening scores when audio input is unavailable.

## Work

Use `tools/audition.mjs` on a complete schema-valid storyboard. It selects diagnostic scenes for audio only; it does not create a partial production storyboard, replace film audio or upload anything. Render the same chosen scenes for each explicit voice. Record actual rates, WPM, recognition, timing, calibration history and measured loudness with the WAV.

For the bounded three-male-voice comparison: `node tools/audition.mjs stories/<slug>.json --voice am_puck` (also `am_michael` or `am_fenrir`). It uses S01/S05/S08 and writes each candidate beneath `build/voice-selection-review/`. The persisted profile is `config/narration.json`; CLI `--voice` overrides story `audio.voice_id`, which overrides that default. Explicit scene rates take precedence.

Calibrate with fresh clips from the current engine. Bound retries and report candidates that cannot achieve the target or a safe pause. Change a shared comparison plan for all candidates when necessary; do not quietly give one candidate easier text, fewer controls or more favorable mastering.

## Review and selection

Listen to matched auditions when supported, ideally without seeing the voice names first. Compare the whole short sequence rather than one emphatic word. Give the user playable files when their preference would decide the result. Choose within their stated constraints and record the reason.

If listening is unavailable and no preference arrives, select a provisional technical fit transparently; do not label it the most exciting or natural voice. Explain what objective evidence supports it and what remains a listening judgment. Model-training grades are not perceptual audition scores; see the [official Kokoro voice notes](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md).

Persist the chosen default and its measured starting rates, while retaining explicit story/CLI overrides. Starting rates need measurement on new scripts. Confirm that a changed default cannot reuse old-voice clips, existing finished files remain intact, and the narration/word-timing checks still pass after configuration changes.
