# 04 — BUILD, VOICE, CAPTION, RENDER & FINALIZE VIDEO (PART B & PART C CONTRACT)

## PURPOSE
Transform a validated storyboard (`stories/<slug>.json` conforming to `storyboard.schema.json` v1.1.0) into a finished, deterministic 1080×1920 @ 30 fps Three.js film (`output/<slug>.mp4`), bold thumbnail cover (`output/<slug>.jpg`), SubRip captions (`output/<slug>.srt`), plain-text transcript (`output/<slug>.txt`), and multi-platform publishing metadata (`metadata/<slug>.json`).

---

## 0. PRESERVE HIGH-STAKES POV & ESCALATION DURING PRODUCTION

Read `skills/shorts-story-writer/SKILL.md` and apply its editorial gate to the spoken narration before synthesis or rendering:
- Verify total narration word count is **95–115 words** (for a 46–54s film) with zero textbook jargon and a **1.0–1.5s narration-free impact window** around the primary physical climax.
- Verify the first **65–75% of the runtime stays at human eye level (`y = 1.4–1.8 m`)** in a first-person witness POV before zooming out to orbital/planetary scale (`earth-globe-v1`, `planet-cutaway-v1`, `city-damage-map-v1`) in the final 10–15 seconds.
- Never stage close-up emotional acting on `humanoid-figure-v1` capsule mannequins; keep human figures in mid-distance silhouettes (`z > 8 m`) reacting physically to the environment.

---

## 1. ARCHITECTURE & REUSE-FIRST STAGE BUILDING (`src/stories/<slug>/`)

Read `skills/threejs-direction/SKILL.md` and complete its Analyze → Plan → Work → Review sequence for the 3D direction.

1. **Resolve `asset_plan` Against `assets/registry.json`:**
   - Configure existing components in `src/library/` first (`city-street-block-v1`, `city-damage-map-v1`, `vortex-debris-pull-v1`, `planetary-ring-system-v1`, `giant-peak-v1`, `planet-cutaway-v1`, `earth-globe-v1`, `sky-dome-v1`, `sun-skylight-rig-v1`, `ocean-surface-v1`, `pedestrian-crowd-v1`, `humanoid-figure-v1`, `flame-v1`, `smoke-wisp-v1`, `vanish-dissolve-v1`, `plastic-bottle-v1`, `dial-gauge-v1`, etc.).
   - **High-Detail Street Rule:** Whenever a story uses `city-street-block-v1`, import the detailed masonry/shopfront/wet-asphalt implementation (`CityStreetClassic` from `src/library/environment/CityStreetClassic.ts`) or combine it with hazard rigging—never fall back to flat, untextured gray boxes for opening street hooks.
   - Keep story-specific orchestration inside `src/stories/<slug>/` (`film.ts`, `timeline.ts`, `stages/`, `soundtrack.mjs`) and register `createFilm` in `src/entry.ts`.
   - **Model variety (v1.2 library):** before modelling anything new, check the newer kits: `quadruped-v1` (16 species with walk/trot/gallop), `road-vehicles-v1` (cars, taxi, police, ambulance, van, bus, truck), `street-furniture-v1`, `human-figure-v2`, `city-kit-v1`/`building-kit-v1` with `pbr-materials-v1` (CC0 photo textures and HDRIs), `physical-sky-v1`, `nature-kit-v1`, `energy-kit-v1`, `insect-swarm-v1`, `black-hole-sky-v1`, `asteroids-v1`, `spacecraft-v1`, `lightning-v1`, `tornado-v1`, `explosion-v1`, `crowd-kit-v1` (varied people with behaviours: walk, talk, phone, photo, wave, cheer, dance, look up), `neon-district-v1` (Times Square-style animated billboards, neon, wet reflective street), `nightlife-kit-v1`, `fireworks-v1`, `milky-way-sky-v1` and `solar-system-v1`. Populate streets and plazas with `Crowd` + `CrowdImpostors` rather than a few static figures. Preview any of them with `node tools/lookdev.mjs <animals|street|space|outdoors|timesquare|nightsky|showcase|humans|buildings|nature|interior|sky> --frames ...` or as moving video with `--video build/lookdev/<name>.mp4`.
   - **Cinematic look:** set `delivery.render_quality: "cinematic"` for new films (2x supersampling + sharpening, 3-sample motion blur, and per-shot `post` AO/depth of field/sun shafts). Use `post.tonemap: "agx"` for fire, lava, suns and black holes so highlights roll off instead of clipping. `whip_pan` and `light_wipe` transitions render as real transitions (centred on the scene boundary like dissolves).

2. **Strict Determinism (`renderFrame(frameIndex)`):**
   - Every visual state, particle position, shader uniform, camera transform, and HUD counter value must be a pure deterministic function of `time_s = frameIndex / 30` and seeded RNG (`shader-noise-math-v1`).
   - Never use `Math.random()`, `Date.now()`, or frame-accumulated state.

3. **Visual Retention Guardrails (NON-NEGOTIABLE):**
   - **NO 2D TEXTBOOK CHARTS OR FLOATING RULERS:** Never build standalone 2D bar charts, disembodied measuring cylinders, or floating wooden rulers when a 3D environment stage can show the physical consequence directly.
   - **NO FROZEN BACK-OF-HEAD MANNEQUINS:** Never place `humanoid-figure-v1` or `pedestrian-crowd-v1` standing motionless with their back to the camera for more than 1.5 seconds.
   - **FIRST-PERSON POV ANCHORING:** Opening hook and street-level shots must frame the camera at human eye level (`y = 1.4–1.8 m`) with `handheld_sway` (`0.25–0.50`) enabled on `camera-keyframe-rig-v1`, and trigger `impulse_shake` on exact shockwave/impact timestamps.
   - **STAGGERED PHYSICAL FAILURE:** When a disturbance propagates across a street, forest, or city, stagger object failures (car lift, tree ignition, glass shatter, building collapse) by `0.12–0.35s` in distance order.

---

## 2. MANDATORY CONTINUOUS HUD TELEMETRY & 3D CALLOUTS (`overlay-labels-v1`)

1. **ZERO ACADEMIC DISCLAIMER BADGES ON SCREEN:**
   - Do **NOT** render meta-disclaimers such as `SCHEMATIC • NOT TO SCALE`, `LIKELY • EXACT EFFECT UNCERTAIN`, `ILLUSTRATIVE`, or `HYPOTHETICAL • CGI` anywhere on the video canvas—even if legacy asset notes in `ASSET_LIBRARY.md` mention schematic labels.
2. **Continuous Top-Left Simulation Telemetry Counter (`x = 90`, `y = 240`):**
   - Every shot must render the top-left dark-glass telemetry pill (`hud_telemetry`) with a pulsing status dot and fast-ticking tabular numbers interpolated deterministically from `time_s`.
   - Ensure the HUD stays visible across the entire video, transitioning cleanly across 3–4 escalating personal-threat metrics (e.g., millisecond countdown `0:05.000 -> 0:00.000`, temperature/pressure/G-force spike, altitude/distance counter, and impact/survival radius).
3. **3D Leader-Line Survival Callouts:**
   - Use `projectToScreen()` from `film-pipeline-v1` with `overlay-labels-v1` to anchor 2–5 word visceral callouts directly onto 3D subjects (e.g., `SKIN TEMP: 140°F`, `PAPER AUTO-IGNITES: 450°F`, `2 MILES AWAY: 3,900,000 G`).

---

## 3. NARRATION, BREATHING GAPS & ZERO DEAD AIR (`tools/narrate.mjs`)

Read `skills/voice-direction/SKILL.md` and its performance reference.

1. Run `node tools/narrate.mjs stories/<slug>.json` to synthesize narration and align exact word timings via local Whisper into `build/<slug>/audio/narration.json`. Leave `narration.performance.rate` unset unless the delivery needs it: the tool predicts each scene's starting speed from its text (syllables, pauses, digits), levels every scene to the same loudness and applies the broadcast finishing chain and a subtle room automatically. A distinct narrator can be a Kokoro blend such as `"voice_id": "am_michael*0.7+am_onyx*0.3"`.
2. **Crisp Delivery + Breathing Room:**
   - Keep total script length at **95–115 words** so there are natural `0.35–0.60s` pauses between scene clauses and a **1.0–1.5s narration-free impact window** at the primary physical climax.
3. **Zero Leading Dead Air:**
   - Scene `S01` speech must begin by `t = 0.08s`. Verify actual waveform onset in `build/<slug>/audio/narration.json`.
4. **Overrun & Pronunciation Check:**
   - Verify every scene's synthesized speech finishes inside `[scene.start_s, scene.end_s]` with at least `0.20s` breathing room at scene boundaries.

---

## 4. BURNED-IN KINETIC CAPTIONS & TRANSCRIPTS (`caption-kinetic-v1`)

1. Drive `caption-kinetic-v1` exclusively from `build/<slug>/audio/narration.json` Whisper word timings.
2. **High-Retention Caption Styling:**
   - Group into punchy 2–4 word phrases, maximum 2 lines (`maxCharsPerLine: 18–20`).
   - Font size `70–76 px` at `1080×1920`, positioned at safe baseline `y = 1300–1340 px`.
   - Highlight the active spoken word in bright solar yellow (`#FACC15`) or alert cyan (`#38BDF8`) with a subtle scale lift.
3. **Export `.srt` and `.txt`:**
   - Run `node tools/transcript.mjs <slug>` so `output/<slug>.srt` and `output/<slug>.txt` match the exact burned-in phrase groupings.

---

## 5. SOUNDTRACK, AMBIENCE & ACTION SOUNDS (`src/stories/<slug>/soundtrack.mjs`)

Read `skills/voice-direction/references/sound-design.md`. Full films include suitable environmental ambience and action Foley as part of their sound plan; optional human reactions support specific beats. Silence remains valid when the setting or story calls for it.

1. Author original music and sound design using `audio-synth-kit-v1` (`src/library/audio/synth.mjs`) and actual registered recorded clips where appropriate, exporting `buildSoundtrack(duration)`.
   - Specify nature/location sounds, human actions such as clapping, breathing or sneezing, and prop contacts in existing `audio.sfx_direction` / `audio_cues`. Match playback to the actual contact/action time and keep important narration clear. Non-silence cues need explicit soundtrack implementation; JSON annotations alone do not play audio. Review source clips and the synchronized mix; report missing assets and listening limitations.
   - Keep `build/<slug>/audio/sound-plan.md` with actual sources, onset/trim offsets, gain and implementation/review status. Reconcile it with the rendered mix before final encoding; a missing pivotal clip, stylized substitute or intentional silence must be identified accurately.
2. **Countdown Tick + Acoustic Silence Drop:**
   - Include a crisp, rhythmic millisecond/second countdown tick during the opening hook or approach sequence.
   - Honor `"silence"` cues in `audio_cues`: duck music and ambient beds by `-24 dB` for `0.25–0.35s` immediately before the primary impact or reveal.
3. **Staggered Multi-Tap Destruction Transients:**
   - Align `"impact"` and `"whoosh"` cues (`-6 dB` to `-10 dB` relative to voice) to exact 3D object failure timestamps (`80–180 ms` spacing).
4. **Loudness Normalization:**
   - Run `node tools/soundtrack.mjs <slug>` to mix narration, music, and SFX into `build/<slug>/audio/mix.wav` (48 kHz stereo) normalized to **`-14.0 LUFS`** (`<= -1.0 dBTP`).

---

## 6. SMOKE FRAMES, FINAL RENDER & BOLD THUMBNAIL (`tools/render.mjs`)

1. **Smoke Frame & Moving Excerpt Inspection:**
   - Run `node tools/render.mjs <slug> --frames <f1>,<f2>,<f3> --scale 0.5` across opening hook, mid-video reversal, and planetary climax (add `--quality draft` for fast looks at a cinematic film; `--final` always renders the storyboard's `delivery.render_quality`).
   - Verify: (a) eye-level first-person POV framing in `S01`–`S05`, (b) persistent top-left telemetry HUD on every frame with zero academic disclaimer clutter, (c) high-detail street/environment textures, and (d) captions cleanly placed at `y ≈ 1320 px`.
   - Render moving preview `node tools/render.mjs <slug> --preview build/<slug>/assembled-review.mp4 --range 0-<last-frame> --scale 0.5 --narration build/<slug>/audio/narration.json --audio build/<slug>/audio/mix.wav` to verify pacing and the 1.0–1.5s impact window.
2. **Final MP4 & Thumbnail Render:**
   - Run `node tools/render.mjs <slug> --final --crf 19` to produce `output/<slug>.mp4` and `output/<slug>.jpg` (`thumbnail-title-card-v1` bold 1080×1920 cover).

---

## 7. PART C — QA, CLEAN METADATA & FINALIZER (`tools/finalize.mjs`)

1. **Probe QA:** Run `node tools/finalize.mjs <slug> --probe-only` to verify 1080×1920 resolution, 30 fps, exact `duration_s`, AAC audio stream, `.srt`, `.txt`, and `.jpg`.
2. **Author Clean `metadata/<slug>.json` (NO MACHINE FOOTPRINTS):**
   - **Title (every platform):** `project.title` verbatim, a `"What if …?"` question, alone: the YouTube Shorts and Facebook Reels `title`, and the first line of the TikTok and Instagram captions and the X post. No hook, tagline or summary in that line, so viewers read the topic first. The finalizer rejects a title line that does not start with "What if" or that continues after its question mark.
   - **YouTube Shorts:** The `"What if"` title for search discovery; include 5–10 scientific hashtags (`#whatif #astrophysics #earthscience #physics #3danimation`).
   - **TikTok, Instagram Reels, Facebook Reels & X:** After the title, open with the film's strongest 2nd-person consequence or contradiction, summarize its causal story, and end with its earned `distribution.comment_bait_question`. Use a geographic survival question only when the story actually turns on geography or survival.
   - **Public Descriptions (All Platforms):** After the title line, write ONLY (1) a 2-sentence visceral 2nd-person hook, (2) the survival/decision `comment_bait_question` on its own line, and (3) 5–7 science hashtags (`#whatif #physics #science #earthscience #3danimation`).
   - **STRICT BAN IN PUBLIC DESCRIPTIONS:** Never include `Scope:` paragraphs, URL lists, or `"Visuals: original deterministic Three.js animation. Voice: local Kokoro am_michael..."` in the public description strings inside `metadata/<slug>.json` or `scripts/finalize_video.py`.
3. **Finalize & Archive:** Run `node tools/finalize.mjs <slug>` and reply with **only** the absolute path to `output/<slug>.mp4`.
