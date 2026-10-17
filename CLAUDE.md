# CLAUDE.md — Binding Repository Instructions for Claude Code

## OVERVIEW
This repository builds deterministic, scientifically grounded, viral-ready 9:16 3D simulation Shorts (1080×1920, 30 fps) from storyboard JSON specifications (`stories/<slug>.json`) using Three.js, local Kokoro/Piper TTS, Whisper word alignment, procedural WebGL shaders, and bundled FFmpeg.

## CORE PIPELINE COMMANDS
1. **Validate Storyboard:** `python scripts/validate_storyboard.py stories/<slug>.json` (must print `VALID`).
2. **Synthesize & Align Voiceover:** `node tools/narrate.mjs stories/<slug>.json` $\rightarrow$ `build/<slug>/audio/narration.json`.
3. **Export Transcript & SRT:** `node tools/transcript.mjs <slug>` $\rightarrow$ `output/<slug>.srt` and `output/<slug>.txt`.
4. **Build Procedural Soundtrack & Mix:** `node tools/soundtrack.mjs <slug>` $\rightarrow$ `build/<slug>/audio/mix.wav` (48 kHz stereo, target `-14.0 LUFS`, peak $\le -1.0\text{ dBTP}$).
5. **Smoke Frame Check:** `node tools/render.mjs <slug> --frames <f1>,<f2>,<f3> --scale 0.5`.
6. **Final Render (MP4 + JPG Cover):** `node tools/render.mjs <slug> --final --crf 19` $\rightarrow$ `output/<slug>.mp4` + `output/<slug>.jpg`.
7. **Finalize, Catalog & Upload:** `node tools/finalize.mjs <slug>`.

## NON-NEGOTIABLE ENGINEERING & CREATIVE RULES
Read `skills/shorts-story-writer/SKILL.md` before drafting or revising story content, and apply its editorial gate before narration and rendering.
Read `skills/threejs-direction/SKILL.md` before staging or revising 3D shots; analyze, plan, implement, and review their moving sequence before proceeding to another area or the final render.
Read `skills/voice-direction/SKILL.md` before directing narration or selecting a voice; review performance with one fixed voice before casting and preserve exact speech/caption timing.

1. **One-Run Execution:** For a requested film build, go straight from Part A (`stories/<slug>.json`) to Part B (`output/<slug>.mp4`) and Part C (`node tools/finalize.mjs <slug>`) without stopping to ask permission. Script reviews, prompt/skill edits, and individual production steps stay within the requested scope.
2. **Anti-Echo & Domestic POV Hook:** Sentence 1 of `S01` must **never** repeat the video title verbatim. Always open `S01` at human eye level (`y = 1.4–1.8 m`) inside a recognizable human/urban/macro stage (`city-street-block-v1`, `room-box-v1`, `glass-of-water-v1`) at $t = 0.0\text{ s}$ with `handheld_sway` enabled. Use wide orbital globe shots (`earth-globe-v1`) only when they advance the story's causal chain; a scale change is not mandatory.
3. **Target Runtime & Cadence:** Default to **46–56 seconds** (max 62s for multi-epoch stories). Synthesize opening hook/mechanism scenes at **148–160 WPM** (`pacing_energy: "fast_hook"`) with speech starting at $t \le 0.08\text{ s}$.
4. **Zero Academic Disclaimer Clutter:** Never draw `SCHEMATIC • NOT TO SCALE`, `LIKELY • EXACT EFFECT UNCERTAIN`, or `ILLUSTRATIVE` badges on the video canvas. Use `overlay-labels-v1` only for diegetic `hud_telemetry` counters (`TIME`, `RADIUS`, `G-FORCE`, `SURVIVORS`, `TEMP`) in the top-left safe zone (`x = 90`, `y = 240`) and concise 3D leader-line callouts via `projectToScreen()`.
5. **No 2D Bar Charts or Frozen Mannequins:** Never build standalone 2D bar charts or floating rulers to fill a scene. Never leave `humanoid-figure-v1` or `pedestrian-crowd-v1` static with their back turned for $>1.5\text{ s}$.
6. **Acoustic Contrast:** Always include a $0.25\text{–}0.35\text{ s}$ `"silence"` drop (`-24 dB`) before the primary impact or reveal in `soundtrack.mjs`. When objects fail on screen, follow it with staggered multi-tap `"impact"` SFX (`80–180 ms` spacing) aligned to their keyframes; otherwise use sound appropriate to the actual reveal.
7. **Deterministic Rendering Only:** Every `renderFrame(i)` call must depend purely on `frameIndex` (`time_s = i / 30`) and seeded helpers from `src/library/util/math.ts`. Zero `NaN`/`Inf` shader outputs.
8. **Security & Secrets:** Never read, print, log, or commit the Hugging Face token or any `.env` credentials.
