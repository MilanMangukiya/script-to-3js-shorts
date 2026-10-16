# MASTER PROMPT — What-If / How-Does Cinematic Short: Storyboard → Finished Video (one run)

## YOUR ROLE
Act simultaneously as (1) rigorous science researcher, (2) viral short-form simulation screenwriter, (3) cinematic 3D director, (4) Three.js/WebGL technical animation designer, (5) narrator/caption designer, (6) production editor and (7) build-and-render engineer. In **one run** you write the storyboard JSON, then build, voice, caption, render and publish-prepare the finished film:

1. **Part A — Storyboard:** one valid JSON document conforming exactly to `storyboard.schema.json`, saved as `stories/<slug>.json`. It must be **executable as a visual production specification, not a vague creative outline**.
2. **Part B — Finished video:** implement that storyboard in this repository as a real Three.js film with narration, music, sound design and burned-in captions, rendered to `output/<slug>.mp4`, plus a caption file (`.srt`), a plain-text transcript (`.txt`), and a bold thumbnail cover (`.jpg`).
3. **Part C — Checks, metadata and catalog:** minimal QA, multi-platform upload metadata and the required finalizer.

For a requested film build, do not stop after the JSON and do not ask for permission between parts: go straight from Part A to Part C. Script reviews, prompt/skill edits, and individual production steps stay within the requested scope. Follow `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex); they are binding. **Where to run:** Claude Code or Codex inside this repository (it needs file access, Node.js, the local Kokoro/Whisper models and the bundled FFmpeg). If you are running without repository access, you can only do Part A: output the raw JSON in a single code block and state that Parts B–C need Claude Code or Codex.

## USER INPUT (replace the values on each use)
TOPIC: "What if a rogue planet passed between Earth and Mars?"
OPTIONAL_CREATIVE_ANGLE: "AUTO"
OPTIONAL_FOCUS: "AUTO"  # choose a high-stakes causal survival story
OPTIONAL_DURATION_SECONDS: "{{DURATION_OR_AUTO}}"  # 45..62 inclusive; target 46..54
OPTIONAL_ASSET_REGISTRY: "{{ASSET_REGISTRY_OR_EMPTY}}"  # actual assets/registry.json entries, not guessed

If optional values are `AUTO`, choose the most visceral, high-stakes defensible physical interpretation. When `OPTIONAL_DURATION_SECONDS` is AUTO, target **46–54 seconds** for single-variable physical shocks (max **58 seconds** for multi-epoch geological/human arcs); choose the shortest time that fully earns its runtime. Never exceed 60 seconds. In the repository, **read `assets/registry.json` yourself** instead of relying on the placeholder; without repository access, reference only validated registry IDs. Write in English for an international, curious nontechnical audience.

## NON-NEGOTIABLE DELIVERY SETTINGS
- Exactly one self-contained cinematic short; **45–58 seconds inclusive**, target **46–54 seconds**.
- Vertical **9:16**, **1080 × 1920**, **30 fps**, 24-bit-color-looking premium simulation aesthetic.
- Publishable on YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, and X.
- Main visuals: Three.js/WebGL **real 3D** with meaningful objects, lighting, materials, camera and environmental motion. Never substitute an entire video with static slides, 2D charts, floating rulers, or scrolling text.
- **Word Budget & Pacing:** Total script across the entire film must be **95–115 words maximum** (averaging ~2.0 words per second across the full video so SFX and visual reveals can breathe). Individual spoken sentences should be delivered crisply (`145–155 WPM` while speaking), separated by deliberate **0.35–0.60s pauses** and one **1.0–1.5s narration-free impact window** during the climax/countdown zero.
- Apply `skills/voice-direction/SKILL.md` when directing narration. Give each delivery note a useful intention, focal phrase and turn; use optional schema `narration.performance` for explicit scene rate and safe pauses.
- Audio loudness: master mix normalized to **-14.0 LUFS** (true peak <= -1.0 dBTP). Foreground sound effects must stay punchy (-6 to -10 dB relative to voice), with an intentional **0.25–0.35s acoustic silence drop** (-24 dB duck) programmed immediately before major physical impacts.
- All words of the spoken narration must appear as **beautiful, correctly timed burned-in captions** (`caption-kinetic-v1`), styled in high-contrast uppercase/title-case phrases (2–4 words), placed in the platform-safe band (baseline y ≈ 1300–1340 px), with vibrant keyword highlights.
- Mandatory bold thumbnail cover (`thumbnail-title-card-v1`): every film must output `output/<slug>.jpg` (1080×1920) with a punchy 2–4 word uppercase curiosity headline, numeric badge sticker, and directional arrow.
- Every film also ships a SubRip caption file (`output/<slug>.srt`), a plain-text transcript (`output/<slug>.txt`), and copy-paste publishing metadata (`metadata/<slug>.md`).

---

# PART A — STORYBOARD

## AUDIENCE-RETENTION STORY ENGINE
Read and apply **`skills/shorts-story-writer/SKILL.md`** before drafting. It is the editorial contract for hooks, tension, reversals, payoffs, and packaging. Complete its narration-only editorial gate before Part B; valid JSON alone does not make a compelling story.

- **THE ESCALATING STAKES RULE (NEVER DEFLATE THE PREMISE):**
  - Never answer a dramatic "What if" question by telling the viewer in the first 15 seconds that "nothing much happens" or "you'd just get a mild sunburn / eat dinner earlier / see a 3 mm drizzle."
  - If a counterintuitive physics rule spares the human body in the first second (e.g., thermal mass of air or incompressibility of water in tissues), frame that survival as a **3-second false relief** ("Hold your breath and your skin barely blisters...") that immediately pivots into a **terrifying secondary escalation** ("...until you inhale once, or watch every leaf, roof, and dry field across the hemisphere flash-ignite at Second 4").
  - **Ban Mundane Domestic Trivia:** Never center a planetary counterfactual around minor conveniences (like needing a lantern at a barbecue). Every scene must escalate physical, environmental, or survival stakes.
- **FIRST-PERSON WITNESS POV (70% GROUND / 30% PLANETARY CLIMAX):**
  - Because `humanoid-figure-v1` is a stylized capsule-and-sphere rig built for mid-distance silhouettes, **never stage emotional close-ups, phone calls, or domestic character acting**.
  - Spend the first **65–75% of the video at human eye level (`y = 1.4–1.8 m`)** as a first-person camera watching tangible foreground props (`plastic-bottle-v1`, `glass-of-water-v1`, `compass-v1`, `dial-gauge-v1`, `cooking-pot-v1`) and mid-distance urban/environmental chaos (`city-street-block-v1`, `pedestrian-crowd-v1` at `z > 8 m`, `vortex-debris-pull-v1`, `ocean-surface-v1`).
  - Save the wide orbital/planetary view (`earth-globe-v1`, `planet-cutaway-v1`, `city-damage-map-v1`) for the final **10–15 seconds** when the shockwave, ring shadow, or continental consequence reaches planetary scale.
- **5th-GRADE VISCERAL LANGUAGE (NO TEXTBOOK LECTURES):**
  - Never use multi-syllable academic jargon in spoken narration (`Roche limit`, `zero-obliquity`, `radiative-transfer`, `in-scatter march`, `isostatic sink`). Translate every mechanism into immediate bodily or visual sensation: instead of *"crossing the Roche limit,"* say *"gravity tears the Moon into a glowing ring of rock."*
- Target **46–54 seconds, 8–10 scenes, and 1–3 planned shots per scene**. A beat every **2.5–4.0 seconds** must change a physical state, telemetry metric, or visual consequence; moving the camera alone does not satisfy this requirement.
- Sentence 1 must drop straight into a **second-person street-level or bodily consequence** at `t <= 0.08 s`. Never start with "What if," repeat the title, or spend the first line explaining where the viewer is standing.
- Give an early physical escalation, a substantive mid-video twist (`mid_video_rehook`) before `t = 24 s`, and a jaw-dropping final scale reveal that fulfills the opening promise.

---

## SCIENTIFIC HONESTY & MANDATORY LIVE HUD TELEMETRY
- Define a **precise counterfactual**: state initial conditions, what is held constant, and explicitly separate timescales in `scientific_model`.
- Cite claims via `claim_ids` linked to `scientific_model.claims[]` with defensible `confidence` levels (`established`, `derived`, `plausible`, `speculative`).
- **MANDATORY CONTINUOUS HUD TELEMETRY ON EVERY SHOT:**
  - Every shot in `scenes[].shots[]` **must** include a populated `hud_telemetry` block (`timer_label`, `metric_label`, `start_value`, `end_value`, `unit`, `alert_level`). Never leave `hud_telemetry` null or omit it on any shot.
  - Design the top-left HUD (`x = 90`, `y = 240`) as a **continuous psychological retention lock** that mutates across 3–4 escalating personal-stakes phases across the video (e.g., Phase 1: `EVENT IN: 0:05.000 -> 0:00.000` -> Phase 2: `AIR TEMP: 72°F -> 1,000°F` -> Phase 3: `LUNG DAMAGE: 0% -> CRITICAL` -> Phase 4: `IGNITION ZONE: 12,000,000 KM²`).
- **NO ACADEMIC DISCLAIMER BADGES ON SCREEN:** Never render meta-disclaimers like `SCHEMATIC • NOT TO SCALE`, `LIKELY • EXACT EFFECT UNCERTAIN`, `ILLUSTRATIVE`, or `HYPOTHETICAL • CGI` on the canvas. All on-screen visual chips must be diegetic simulation telemetry (timers, distances, temperatures, G-forces, altitudes, survival radii).

---

## CINEMATIC & THREE.JS SHOT DIRECTION
Read `skills/threejs-direction/SKILL.md` and apply its Analyze → Plan → Work → Review sequence. Stage a readable setup, change, and consequence for each pivotal event.

Provide implementation-level technical direction for every shot:
- `world`: scale convention (1 unit = 1 metre for urban/interiors; local planetary units for space), sky dome, lighting environment, and fog depth.
- `subjects`: specific asset references (`asset_hint`), geometric proportions, material shaders, and movement behaviors. When using `city-street-block-v1`, always prefer the high-detail `CityStreetClassic` masonry/shopfront presentation over simplified block geometry.
- `camera`: projection (`perspective` or `orthographic`), numeric FOV (30–42° typical), lens intent, and **at least two numeric keyframes** `[x,y,z]` with `look_at` coordinates and easing.
  - **POV Dynamic Camera:** Ground-level shots (`y < 2.5 m`) must specify human eye-level framing (`y = 1.5–1.7 m`) with subtle handheld breathing sway (`handheldSway: 0.25–0.50`).
  - **Impact Cam-Shake:** Program an impulse camera shake on the exact frame of major shockwaves, collapses, or detonations.
- `animation_plan`: concrete, deterministic, time-driven movements evaluating strictly from absolute timestamp `time_s`. No frame-rate-dependent drift.
- `lighting` & `effects`: physical key/fill sources, HDR bloom on specular/emissive highlights, volumetric fog, and ACES tone mapping.
- `transition_out`: physical action cuts, camera whip pans, match cuts, or cross-dissolves (0.3–0.5s).

---

## TYPOGRAPHY, CAPTIONS & TELEMETRY OVERLAYS
- Burn-in **all spoken narration** via `caption-kinetic-v1` driven by actual synthesized Whisper word timestamps.
- Caption formatting: 2–4 word dynamic phrases, uppercase impact or clean Inter Bold, 70–76 px at 1080×1920, optical outline/shadow, resting in the lower safe area (y ≈ 1300–1340 px).
- Active word highlight: bright solar yellow (`#FACC15`) or alert cyan (`#38BDF8`) fill with subtle scale lift.
- `caption_emphasis.phrase` must be an **exact, case-sensitive substring** of its scene's `narration.text`.
- Diegetic Telemetry HUD: render persistent top-left simulation metrics via `overlay-labels-v1` (`x = 90`, `y = 240`) plus 2–4 word 3D leader-line survival callouts via `projectToScreen()`, leaving the central `y in [400, 1200]` viewport completely clear for 3D action.

---

## NARRATION, AUDIO & SOUNDTRACK
- Keep total word count between **95 and 115 words** for a 46–54s film.
- Deliver spoken phrases at **145–155 WPM** during the opening 20 seconds, with **0.35–0.60s breathing gaps** after major visual reveals and a **1.0–1.5s narration-free window** around the primary physical impact so the silence drop and staggered destruction SFX take center stage.
- Program an explicit **`"silence"` audio cue** (-24 dB duck) in `audio_cues` 0.3s before the primary impact or reveal.
- Schedule staggered multi-tap `"impact"` and `"whoosh"` cues separated by 80–150 ms aligned to physical object failures.
- Mix narration clearly over music (-16 to -18 dB bed); normalize master audio to **-14.0 LUFS** (true peak <= -1.0 dBTP).

---

## ASSET LIBRARY — REUSE BEFORE CREATE
- Search actual `assets/registry.json` entries for reusable components, prioritizing high-retention visual rigs: `city-street-block-v1`, `city-damage-map-v1`, `vortex-debris-pull-v1`, `planetary-ring-system-v1`, `giant-peak-v1`, `planet-cutaway-v1`, `earth-globe-v1`, `ocean-surface-v1`, `pedestrian-crowd-v1`, `flame-v1`, `plastic-bottle-v1`, `dial-gauge-v1`, etc.
- Fill `asset_plan.existing_assets_to_reuse` with verified matching IDs and explicit runtime configurations.

---

## PLATFORM DISCOVERY & ANTI-SPAM SEO INPUTS
- Define `distribution.primary_search_intent` and `core_keywords` pairing broad discovery tags with explicit scientific domain qualifiers (`"astrophysics simulation"`, `"earth science what if"`, `"physics thought experiment"`).
- **Multi-Platform Copy Rules (CRITICAL ANTI-SPAM HYGIENE):**
  - **YouTube Shorts Title:** Must use the **Two-Part Curiosity + Micro-Spoiler Formula**: `"What if [Premise]? [3–6 Word Shocking Physical Consequence]"` (e.g., `"What if Earth Hit 1,000°F for 5 Seconds? Don't Breathe In"`, `"What if a Coin-Sized Black Hole Hit Your City? 3,900,000 G Pull"`).
  - **Clean Public Descriptions (NO PIPELINE OR TTS FOOTPRINTS):**
    - Public descriptions across YouTube, TikTok, Instagram, Facebook, and X must **NEVER** include `Scope:` disclaimer paragraphs, academic URL dumps, or machine-generation credits (`"Visuals: original deterministic Three.js animation. Voice: local Kokoro am_michael..."`). Store scientific scope notes and source URLs strictly inside `stories/<slug>.json` (`scientific_model`) and internal fields, never in the public copy-paste social description blocks.
    - Structure every public description as: (1) Two punchy 2nd-person sentences setting up the stakes, (2) One blank line, (3) The story-specific survival/decision question (`distribution.comment_bait_question`, e.g., `"Would you survive these 5 seconds? 👇"`), and (4) 5–7 targeted hashtags (`#whatif #physics #science #earthscience #3danimation`).

---

## JSON CONTRACT — EXACT
- Must conform strictly to `storyboard.schema.json` v1.1.0.
- Scenes must partition the runtime: `S01.start_s = 0`, each `end_s` equals next `start_s`, last `end_s = project.duration_s`.
- Shot intervals must partition each scene without gaps, and every shot must include `hud_telemetry`.
- Mandatory `thumbnail` block: `headline` <= 38 chars in uppercase ending in `?!`, `highlight` array, quantified `badge` sticker, `focus` coordinates, and `arrow: true`.
- Save as `stories/<slug>.json` and validate with `python scripts/validate_storyboard.py stories/<slug>.json`. Ensure it prints `VALID` before proceeding to Part B.

---

# PART B & PART C — BUILD, RENDER, QA & FINALIZE
Follow `04_BUILD_VIDEO_PROMPT.md` sequentially through stage creation, `node tools/narrate.mjs`, `node tools/transcript.mjs`, `node tools/soundtrack.mjs`, `node tools/render.mjs <slug> --final --crf 19`, and `node tools/finalize.mjs <slug>`. Reply with **one line: the absolute path to `output/<slug>.mp4`**.