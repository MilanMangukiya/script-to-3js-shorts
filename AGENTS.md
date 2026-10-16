# AGENTS.md — Binding Repository Instructions for Codex & Autonomous Agents

## REPOSITORY MISSION
Generate, voice, score, caption, render, and publish-prepare deterministic 9:16 Three.js counterfactual simulation Shorts (`1080×1920`, `30 fps`, H.264/AAC) from `stories/<slug>.json` to `output/<slug>.mp4` in a single autonomous run.

## BINDING CONTRACTS
- **Prompt Specs:** `01_MASTER_STORYBOARD_PROMPT.md` and `04_BUILD_VIDEO_PROMPT.md`.
- **Story Writing Skill:** Read `skills/shorts-story-writer/SKILL.md` before drafting or revising hooks, narration, story beats, or publishing copy. Apply its editorial gate before narration and rendering.
- **Three.js Direction Skill:** Read `skills/threejs-direction/SKILL.md` before staging or revising 3D shots. Analyze, plan, implement, and review a moving excerpt of pivotal changes before proceeding to another area or the final render.
- **Voice Direction Skill:** Read `skills/voice-direction/SKILL.md` before directing narration or casting voices. Review performance with one fixed voice before comparing candidates; use supported controls and preserve exact speech/caption timing.
- **Scene Sound Design:** Read `skills/voice-direction/references/sound-design.md` before planning or implementing soundtracks. Include suitable ambience and action Foley; use human vocal reactions selectively, reuse actual audio assets and synchronize sounds to their sources.
- **Schema Contract:** `storyboard.schema.json` (validate via `python scripts/validate_storyboard.py stories/<slug>.json`).
- **Asset Library:** `assets/registry.json` (`reuse_before_create` mode). Inspect registered components in `src/library/` before writing new geometry or shaders.

## EXECUTION CHECKLIST (DO NOT SKIP STEPS)
Apply the full checklist to requested film builds. For script reviews, prompt/skill edits, or individual production steps, complete the requested scope without automatically building or uploading a film.

1. **Storyboard (`stories/<slug>.json`):**
   - Target `46–56s` duration, `8–10` scenes, `148–160 WPM` hook cadence.
   - Sentence 1 must drop straight into a 2nd-person domestic/street-level consequence without repeating the title.
   - Include `hud_telemetry` on shots, `handheld_sway` / `impulse_shake` on ground cameras, `mid_video_rehook` in `creative_direction`, `comment_bait_question` in `distribution`, and a mandatory `bold` `thumbnail` block (`headline` $\le 38$ chars, quantified `badge`, `arrow: true`).
2. **Stage Implementation (`src/stories/<slug>/`):**
   - Register the film in `src/entry.ts`.
   - Reuse registered 3D assets (`city-street-block-v1`, `pedestrian-crowd-v1`, `earth-globe-v1`, `ocean-surface-v1`, `flame-v1`, `vanish-dissolve-v1`, etc.).
   - Ban 2D bar charts, floating rulers, frozen back-of-head mannequins ($>1.5\text{ s}$), and on-screen academic disclaimer chips (`SCHEMATIC • NOT TO SCALE`).
3. **Audio & Captions:**
   - Run `node tools/narrate.mjs stories/<slug>.json` and `node tools/transcript.mjs <slug>`.
   - Implement `src/stories/<slug>/soundtrack.mjs` with a $0.3\text{ s}$ silence drop before the primary impact or reveal, and staggered destruction SFX when destruction is depicted; run `node tools/soundtrack.mjs <slug>` (`-14.0 LUFS`, $\le -1.0\text{ dBTP}$).
4. **Render & Finalize:**
   - Smoke test 3 frames: `node tools/render.mjs <slug> --frames <f1>,<f2>,<f3> --scale 0.5`.
   - Final render: `node tools/render.mjs <slug> --final --crf 19`.
   - Write `metadata/<slug>.json` (every platform's title is `project.title`, a `"What if …?"` question on its own: the YouTube/Facebook `title` and the first line of TikTok/Reels/X copy; then the 2nd-person POV hook + `comment_bait_question`; science-qualified hashtags).
   - Run `node tools/finalize.mjs <slug>` and reply with **only** the absolute path to `output/<slug>.mp4`.
