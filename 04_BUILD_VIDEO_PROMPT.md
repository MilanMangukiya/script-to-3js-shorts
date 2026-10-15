# 04 — BUILD, VOICE, CAPTION, RENDER & FINALIZE VIDEO (PART B & PART C CONTRACT)

## PURPOSE
Transform a validated storyboard (`stories/<slug>.json` conforming to `storyboard.schema.json` v1.1.0) into a finished, deterministic 1080×1920 @ 30 fps Three.js film (`output/<slug>.mp4`), bold thumbnail cover (`output/<slug>.jpg`), SubRip captions (`output/<slug>.srt`), plain-text transcript (`output/<slug>.txt`), and multi-platform publishing metadata (`metadata/<slug>.json`).

---

## 0. PRESERVE THE STORY DURING PRODUCTION

Read `skills/shorts-story-writer/SKILL.md` and apply its editorial gate to the spoken narration before synthesis or rendering. Preserve the hook's promise, the timing of discoveries, the mid-video reversal, and the final payoff when tightening lines for TTS.

- Stage each pivotal event as a visible action with specific subjects and timestamps. A ringing phone, attempted escape, or consequential discovery must affect what happens next; generic room, globe, or laboratory footage is not a substitute.
- Resolve missing props or actions through the asset registry and explicit stage direction before rendering. Do not flatten the story into a lecture to fit convenient existing scenes.
- Keep destruction, countdowns, and dramatic impacts grounded in the chosen premise. Physical failure rules apply when failures actually occur; they do not require inventing a catastrophe for a personal story.
- The thumbnail and platform hooks must match the story actually rendered. Preserve a meaningful visual/sound callback without adding a spoken rewind instruction.

---

## 1. ARCHITECTURE & REUSE-FIRST STAGE BUILDING (`src/stories/<slug>/`)

Read `skills/threejs-direction/SKILL.md` and complete its Analyze → Plan → Work → Review sequence for the 3D direction. Use existing storyboard fields to specify the subject, absolute event times, and visible completed state; choose framing and cuts around those events.
For composition and lighting work, apply its `references/composition-lighting.md`: establish a readable primary subject with stage-local light/material hierarchy, inspect phone-size frames, and compare a moving excerpt before changing character or voice performance.
For character work, apply `references/character-animation.md`: stage attention and finite actions, maintain foot/seat/hand contacts, and drive locomotion from actual travel. Review the moving action before changing narration performance.

1. **Resolve `asset_plan` Against `assets/registry.json`:**
   - Always configure existing components in `src/library/` first (`earth-globe-v1`, `plate-drift-globe-v1`, `sky-dome-v1`, `ocean-surface-v1`, `city-street-block-v1`, `pedestrian-crowd-v1`, `humanoid-figure-v1`, `port-diorama-kit-v1`, `apartment-facade-v1`, `clinic-interior-v1`, `room-box-v1`, `airliner-v1`, `flame-v1`, `smoke-wisp-v1`, `vanish-dissolve-v1`, `sound-rings-v1`, `seismometer-v1`, `dial-gauge-v1`, etc.).
   - Promote genuinely reusable new systems to `src/library/` and register them in `assets/registry.json` with accurate `configurable_parameters`, `created_for`, and `used_in` fields.
   - Keep story-specific orchestration inside `src/stories/<slug>/` (`film.ts`, `timeline.ts`, `stages/`, `soundtrack.mjs`) and register `createFilm` in `src/entry.ts`.

2. **Strict Determinism (`renderFrame(frameIndex)`):**
   - Every visual state, particle position, shader uniform, camera transform, and overlay value must be a pure deterministic function of `time_s = frameIndex / 30` and seeded RNG (`shader-noise-math-v1`).
   - Never use `Math.random()`, `Date.now()`, or frame-accumulated state that breaks random-access frame rendering (required for `--frames` smoke tests, cross-dissolves, and `--thumbnail` still capture).

3. **Visual Retention Guardrails (NON-NEGOTIABLE):**
   - **NO 2D TEXTBOOK CHARTS OR FLOATING RULERS:** Never build standalone 2D bar charts, disembodied measuring cylinders, or floating wooden rulers when a 3D environment stage (`city-street-block-v1`, `dune-field-v1`, `ocean-surface-v1`, `terrain-massif-v1`, `room-box-v1`) can show the physical consequence directly.
   - **NO FROZEN BACK-OF-HEAD MANNEQUINS:** Never place `humanoid-figure-v1` or `pedestrian-crowd-v1` standing motionless with their back to the camera for more than 1.5 seconds. Give figures purposeful action, attention, or a readable reaction. Planted feet and a deliberate hold are valid; walking in place and unrelated motion do not satisfy the direction requirement. A stable viewpoint can watch a changing environment.
   - **DOMESTIC / STREET-LEVEL POV ANCHORING:** Opening hook and human-impact street shots must frame the camera at human eye level (`y = 1.4–1.8 m`) with `handheld_sway` (`0.2–0.5`) enabled on `camera-keyframe-rig-v1`, and trigger `impulse_shake` on exact shockwave/impact timestamps.
   - **SEQUENTIAL OBJECT FAILURE:** When depicting urban or environmental escalation, stagger object failure timestamps by `0.15–0.40s` across depth (e.g., foreground cars swerve/lift first, then roofs/streetlights, then background water/buildings) rather than animating everything on a single uniform ease.

---

## 2. DIEGETIC SIMULATION HUD & 3D LEADER CALLOUTS (`overlay-labels-v1`)

1. **NO ACADEMIC DISCLAIMER BADGES ON SCREEN:**
   - Do **NOT** render meta-disclaimers such as `SCHEMATIC • NOT TO SCALE`, `LIKELY • EXACT EFFECT UNCERTAIN`, `ILLUSTRATIVE`, or `HYPOTHETICAL • CGI` on the production video canvas. Scientific caveats belong in the spoken script and `scientific_model.claims`, never as visual clutter.
2. **Persistent Top-Left Simulation Telemetry HUD:**
   - When a shot specifies `hud_telemetry` (`timer_label`, `metric_label`, `start_value`, `end_value`, `unit`, `alert_level`), render a sleek dark-glass telemetry pill in the top-left safe zone (`x = 90`, `y = 240`) with a pulsing status dot and interpolated tabular numbers driven deterministically by `time_s`.
3. **3D Leader-Line Survival Callouts:**
   - Use `projectToScreen()` from `film-pipeline-v1` with `overlay-labels-v1` to anchor short, high-impact survival or physics metrics directly onto 3D subjects (e.g., `2 MILES AWAY: 3,900,000 G`, `WET-BULB: 36.5°C`, `LIFT LOSS: -50%`). Keep callout text to 2–5 words maximum.

---

## 3. NARRATION, DYNAMIC CADENCE & ZERO DEAD AIR (`tools/narrate.mjs`)

Read `skills/voice-direction/SKILL.md` and its performance reference. Complete Analyze -> Plan -> Work -> Review with one fixed voice before selecting another. Editorial delivery notes do not become Kokoro emotion prompts; optional `narration.performance` supplies explicit rate and safe word-boundary pauses. Measure the generated result and keep comparison outputs under `build/` via `--out`.

1. Run `node tools/narrate.mjs stories/<slug>.json` to synthesize narration with the local voice/rate profile in `config/narration.json` and align exact word timings via unprompted local Whisper into `build/<slug>/audio/narration.json`. CLI `--voice` overrides story `audio.voice_id`, which overrides the configured default. Explicit scene `performance.rate` overrides starting rates.
2. **Dynamic Pacing Energy:**
   - Use the chosen voice's calibrated starting rates from `config/narration.json`. For an unprofiled override, legacy fallbacks are `fast_hook: 1.08`, `crisp_mechanism: 1.05`, `steady_escalation: 1.03`, `weighty_impact: 1.01`, `reflective_payoff: 0.98`, and `loop_bridge: 1.02`; calibrate that voice before delivery. Optional `performance.rate` overrides either source. Measure WPM rather than treating rates as an emotion API. Use verified `performance.pauses` when a phrase boundary needs tightening or a deliberate hold.
3. **Zero Leading Dead Air:**
   - Scene `S01` speech must begin by `t = 0.08s`. Check the real waveform onset as well as `narration.start_s`; synthesis padding counts toward leading silence.
4. **Overrun & Pronunciation Check:**
   - Verify every scene's synthesized speech finishes inside `[scene.start_s, scene.end_s]` with at least `0.15s` breathing room at scene boundaries. If a word overruns or is mispronounced by TTS, tighten the wording in `stories/<slug>.json`, re-validate, and re-run `tools/narrate.mjs`.

---

## 4. BURNED-IN KINETIC CAPTIONS & TRANSCRIPTS (`caption-kinetic-v1`)

1. Drive `caption-kinetic-v1` exclusively from `build/<slug>/audio/narration.json` Whisper word timings—never from guessed linear interpolation.
2. **High-Retention Caption Styling:**
   - Group into punchy 2–5 word phrases, maximum 2 lines (`maxCharsPerLine: 18–22`).
   - Font size `68–74 px` at `1080×1920`, positioned at safe baseline `y = 1300–1340 px` (above TikTok/Shorts bottom UI overlays and below the central `y = 400–1180 px` 3D action stage).
   - Highlight the active spoken word in bright solar yellow (`#FACC15`) or alert cyan (`#38BDF8`) with a subtle scale lift, and apply `caption_emphasis` treatments to exact case-sensitive phrase substrings.
3. **Export `.srt` and `.txt`:**
   - Run `node tools/transcript.mjs <slug>` so `output/<slug>.srt` and `output/<slug>.txt` match the exact burned-in phrase groupings and timeline.

---

## 5. PROCEDURAL SOUNDTRACK & ACOUSTIC STAGGERING (`src/stories/<slug>/soundtrack.mjs`)

1. Author original procedural music and sound design using `audio-synth-kit-v1` (`src/library/audio/synth.mjs`), exporting `buildSoundtrack(duration)`.
2. **Mandatory Acoustic Contrast:**
   - Honor `"silence"` cues in `audio_cues`: duck music and ambient beds by `-24 dB` for `0.25–0.35s` immediately before the primary impact or reveal. Use a sub-bass transient for a physical impact, or sound appropriate to the actual reveal for a story without destruction.
3. **Staggered Multi-Tap Destruction Transients:**
   - When multiple 3D objects fail across a scene (cars, roofs, windows, cranes), schedule staggered multi-tap `"impact"` and `"whoosh"` cues separated by `80–180 ms` aligned to the exact visual keyframes (`-6 dB` to `-10 dB` relative to voice).
4. **Loudness Normalization:**
   - Run `node tools/soundtrack.mjs <slug>` to mix narration, music, and SFX into `build/<slug>/audio/mix.wav` (48 kHz stereo) normalized to **`-14.0 LUFS`** with a true peak ceiling of **`-1.0 dBTP`**.

---

## 6. SMOKE FRAMES, FINAL RENDER & BOLD THUMBNAIL (`tools/render.mjs`)

1. **Smoke Frame Inspection:**
   - Run `node tools/render.mjs <slug> --frames <f1>,<f2>,<f3> --scale 0.5` across three strategic timestamps (opening hook, key reversal, and final payoff).
   - Inspect the rendered PNGs for: (a) eye-level POV framing, (b) readable top-left telemetry HUD without academic disclaimer clutter, (c) zero NaN/bloom artifacts, and (d) captions sitting cleanly at `y ≈ 1320 px` without covering the focal subject.
   - For each new or materially changed pivotal sequence, render a short silent moving excerpt: `node tools/render.mjs <slug> --preview build/<slug>/direction-review/preview.mp4 --range <first>-<last> --clean --scale 0.5`. The inclusive frame range must cover setup, action, consequence, and nearby shot boundaries.
   - Review without labels/captions, then with normal overlays and unchanged existing audio when available. Inspect action continuity, readable completed states, early reveal leaks, and repeated frames after out-of-order seeks. Fix direction failures before final rendering.
   - Use `--storyboard build/<slug>/direction-review/storyboard.json` only with `--preview` for an isolated camera/cut variant of the same film. Existing stage construction and film-specific overlays still come from the registered implementation; the variant does not create assets or rewrite the production storyboard.
2. **Final MP4 & Thumbnail Render:**
   - Run `node tools/render.mjs <slug> --final --crf 19` to produce `output/<slug>.mp4` (H.264 `yuv420p`, AAC 48 kHz stereo, `+faststart`) and `output/<slug>.jpg` (`thumbnail-title-card-v1` bold 1080×1920 cover at `thumbnail.time_s` with 2–5 word uppercase headline, quantified sticker `badge`, and `arrow`).

---

## 7. PART C — QA, PLATFORM METADATA & FINALIZER (`tools/finalize.mjs`)

1. **Probe QA:** Run `node tools/finalize.mjs <slug> --probe-only` to verify 1080×1920 resolution, 30 fps, exact `duration_s`, AAC audio stream, `.srt`, `.txt`, and `.jpg`.
2. **Author `metadata/<slug>.json`:**
   - **YouTube Shorts:** Title must start with `"What if"` for search discovery; include 5–10 scientific hashtags (`#whatif #astrophysics #earthscience #physics #3danimation`).
   - **TikTok, Instagram Reels, Facebook Reels & X:** Open with the film's strongest 2nd-person consequence or contradiction, summarize its causal story, and end with its earned `distribution.comment_bait_question`. Use a geographic survival question only when the story actually turns on geography or survival.
   - **Taxonomy Hygiene:** Never use standalone gaming tags; pair `#simulation` with explicit science qualifiers so recommendation algorithms route the film to science/documentary audiences.
3. **Finalize & Archive:** Run `node tools/finalize.mjs <slug>` to validate media and metadata, update `assets/registry.json`, regenerate `ASSET_LIBRARY.md` and `VIDEO_CATALOG.md`, and upload `<NNN>-<slug>.{mp4,jpg,md}` to Hugging Face.
