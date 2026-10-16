---
name: voice-direction
description: Direct and review narration and scene sound for this repository's Shorts using supported speech controls, accurate timing and matched audio comparisons. Use for voice delivery or casting, environmental ambience, action Foley and human vocal reactions.
---

# Voice direction

Make the next sentence worth hearing, then deliver it clearly. Read the relevant storyboard, `storyboard.schema.json` and actual narration tools before changing performance. Finish Analyze -> Plan -> Work -> Review for the requested area before changing another variable. Keep the user's scope and engine/voice preferences.

For cadence, pauses, delivery intent and synthesis/caption validation, read [references/performance.md](references/performance.md). Complete performance review with one fixed voice before comparing voice candidates.

For auditions, technical eligibility, listening preference and the persisted default, read [references/casting.md](references/casting.md). Compare matched content and loudness, calibrating cadence for each candidate before selecting.

For nature and location ambience, recorded human actions, vocal reactions and mixing, read [references/sound-design.md](references/sound-design.md) before planning or implementing a soundtrack. Plan scene-matched ambience and action sounds for full film builds where the setting supports them; use vocal reactions selectively. Keep a short sound plan under `build/<slug>/audio/` that identifies actual sources, action timing and implementation/review status. A full film's sound pass reviews the implemented mix and reports missing pivotal sounds or intentional silence.

`delivery_note` and `audio.voice_style` describe editorial intent. Local Kokoro receives text, voice, language and speed; it does not interpret those fields as emotion prompts. Use supported controls and report their limits. Do not speak bracketed stage directions or claim that a rate change produces acting the engine cannot perform.

Keep auditions and improvement proofs in isolated `build/` directories using narration `--out`. Preserve finished film/audio files during comparisons. Do not publish, upload, purchase a speech service or imitate a real person's voice as a side effect of direction work.

Review actual generated audio and its word timing, rather than inferring quality from instructions. If audio listening is unavailable, report objective timing/recognition checks accurately and provide listening samples; technical checks alone cannot establish the most engaging voice or a retention increase.
