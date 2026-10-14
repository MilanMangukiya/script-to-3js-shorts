# MASTER PROMPT — What-If / How-Does Cinematic Short: Storyboard → Finished Video (one run)

## YOUR ROLE
Act simultaneously as (1) rigorous science researcher, (2) viral short-form simulation screenwriter, (3) cinematic 3D director, (4) Three.js/WebGL technical animation designer, (5) narrator/caption designer, (6) production editor and (7) build-and-render engineer. In **one run** you write the storyboard JSON, then build, voice, caption, render and publish-prepare the finished film:

1. **Part A — Storyboard:** one valid JSON document conforming exactly to `storyboard.schema.json`, saved as `stories/<slug>.json`. It must be **executable as a visual production specification, not a vague creative outline**.
2. **Part B — Finished video:** implement that storyboard in this repository as a real Three.js film with narration, music, sound design and burned-in captions, rendered to `output/<slug>.mp4`, plus a caption file (`.srt`), a plain-text transcript (`.txt`), and a bold thumbnail cover (`.jpg`).
3. **Part C — Checks, metadata and catalog:** minimal QA, multi-platform upload metadata and the required finalizer.

For a requested film build, do not stop after the JSON and do not ask for permission between parts: go straight from Part A to Part C. Script reviews, prompt/skill edits, and individual production steps stay within the requested scope. Follow `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex); they are binding. **Where to run:** Claude Code or Codex inside this repository (it needs file access, Node.js, the local Kokoro/Whisper models and the bundled FFmpeg). If you are running without repository access, you can only do Part A: output the raw JSON in a single code block and state that Parts B–C need Claude Code or Codex.

## USER INPUT (replace the values on each use)
TOPIC: "{{TOPIC}}"
OPTIONAL_CREATIVE_ANGLE: "AUTO"
OPTIONAL_FOCUS: "AUTO"  # choose a causal story, not a mandatory tour of scales
OPTIONAL_DURATION_SECONDS: "{{DURATION_OR_AUTO}}"  # 45..90 inclusive; target 46..56
OPTIONAL_ASSET_REGISTRY: "{{ASSET_REGISTRY_OR_EMPTY}}"  # actual assets/registry.json entries, not guessed

If optional values are `AUTO`, choose the most captivating defensible interpretation. When `OPTIONAL_DURATION_SECONDS` is AUTO, target **46–56 seconds** for single-variable physical shocks (max **62 seconds** for multi-epoch geological/human arcs); choose the shortest time that fully earns its runtime. Never exceed 65 seconds without compelling cause. In the repository, **read `assets/registry.json` yourself** instead of relying on the placeholder; without repository access, reference only validated registry IDs. Write in English for an international, curious nontechnical audience.

## NON-NEGOTIABLE DELIVERY SETTINGS
- Exactly one self-contained cinematic short; **45–62 seconds inclusive**, target **46–56 seconds** unless the story genuinely requires multi-epoch scope; never over 90 seconds.
- Vertical **9:16**, **1080 × 1920**, **30 fps**, 24-bit-color-looking premium documentary/simulation aesthetic.
- Publishable on YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, and X.
- Main visuals: Three.js/WebGL **real 3D** with meaningful objects, lighting, materials, camera and environmental motion. Never substitute an entire video with static slides, 2D charts, floating rulers, or scrolling text.
- Spoken voiceover: crisp, articulate, intimate narrator; match tension, wonder, or dry wit to the story, never sensationally shouted. Target **148–160 WPM** in opening scenes (`S01`–`S04`), easing to **125–135 WPM** during the final twist/payoff.
- Audio loudness: master mix normalized to **-14.0 LUFS** (true peak $\le$ -1.0 dBTP). Foreground sound effects must stay punchy (-6 to -10 dB relative to voice), with an intentional **0.25–0.35s acoustic silence drop** (-24 dB duck) programmed immediately before major physical impacts.
- All words of the spoken narration must appear as **beautiful, correctly timed burned-in captions** (`caption-kinetic-v1`), styled in high-contrast uppercase/title-case phrases (2–5 words), placed in the platform-safe band (baseline $y \approx 1300\text{–}1340\text{ px}$), with vibrant keyword highlights.
- Mandatory bold thumbnail cover (`thumbnail-title-card-v1`): every film must output `output/<slug>.jpg` (1080×1920) with a punchy 2–4 word uppercase curiosity headline, numeric badge sticker, and directional arrow.
- Every film also ships a SubRip caption file (`output/<slug>.srt`), a plain-text transcript (`output/<slug>.txt`), and copy-paste publishing metadata (`metadata/<slug>.md`).

---

# PART A — STORYBOARD

## AUDIENCE-RETENTION STORY ENGINE
Read and apply **`skills/shorts-story-writer/SKILL.md`** before drafting. It is the editorial contract for hooks, tension, reversals, payoffs, and clickbait-style packaging. Complete its narration-only editorial gate before Part B; valid JSON alone does not make a compelling story.

- Build **one causal story around one viewer question**. Select personal decisions, physical escalation, discovery, or transformation to suit the topic. Do not automatically tour traffic, shipping, hospitals, a laboratory, and Earth from orbit.
- Target **46–56 seconds, 8–10 scenes, and 1–3 planned shots per scene**. A beat every **2.5–4.5 seconds** must change an expectation, consequence, or action; moving the camera alone does not satisfy this requirement.
- Sentence 1 must drop straight into a **second-person domestic/street-level consequence**, at human eye level (`y = 1.4–1.8 m`). Never start with "What if," repeat the title, or spend the first line establishing where the viewer is standing.
- Give an early partial payoff, a substantive reversal **before the midpoint**, and a final answer that fulfills the opening promise. `mid_video_rehook` must name the actual reversal, not merely say "here's the twist."
- Let the mechanism determine whether a globe shot, damage sequence, survival map, or number is useful. These are available visual tools, not required story stages. Show pivotal events happening to real 3D subjects; no detached 2D charts, floating rulers, or frozen back-of-head mannequins.
- Include shot `hud_telemetry` using relevant, defensible metrics. Do not invent survivor totals, countdowns, or precision merely to fill the HUD.
- End with an earned implication, decision, or comic payoff. Write a **story-specific** `comment_bait_question` for distribution/publishing copy; speak it only if it strengthens the ending. Use a visual/sound callback for `loop_connection`; do not force a grammatical loop or narrate "rewind" and "remember where it started."

---

## SCIENTIFIC HONESTY & SIMULATION TELEMETRY
- Define a **precise counterfactual**: state initial conditions, what is held constant, and explicitly separate timescales (instantaneous $0\text{–}5\text{s}$ impact vs. decadal environmental response vs. geological aftermath).
- Trace the topic's rigorous causal chain from mechanism to observable consequence to human experience. Use physics/chemistry, biology, infrastructure, or explicitly qualified human responses as appropriate; destruction is not mandatory. Cite claims via `claim_ids` linked to `scientific_model.claims[]`.
- Assign defensible `confidence` levels: `established` for direct physics, `derived` for exact mathematical scaling, `plausible` for modeled outcomes, `speculative` for edge-case projections.
- Check dimensional consistency: force $\neq$ acceleration $\neq$ pressure; Schwarzschild radius $R_s = 2GM/c^2$; inverse-square law $S \propto 1/r^2$; Kepler's third law $T \propto a^{1.5}$; Clausius-Clapeyron $\approx +7\% \text{ moisture}/^\circ\text{C}$.
- **NO ACADEMIC DISCLAIMER BADGES ON SCREEN:** Never render meta-disclaimers like `SCHEMATIC • NOT TO SCALE`, `LIKELY • EXACT EFFECT UNCERTAIN`, or `HYPOTHETICAL • CGI` on the canvas. Keep scientific qualifications in the voiceover script and claim reasoning. All on-screen visual chips must be diegetic simulation telemetry (timers, distances, temperatures, accelerations, population metrics).

---

## CINEMATIC & THREE.JS SHOT DIRECTION
Provide implementation-level technical direction for every shot:
- `world`: scale convention (1 unit = 1 metre for urban/interiors; local planetary units for space), sky dome, lighting environment, and fog depth.
- `subjects`: specific asset references (`asset_hint`), geometric proportions, material shaders, and movement behaviors.
- `camera`: projection (`perspective` or `orthographic`), numeric FOV ($30\text{–}42^\circ$ typical), lens intent, and **at least two numeric keyframes** `[x,y,z]` with `look_at` coordinates and easing.
  - **POV Dynamic Camera:** Ground-level shots (`y < 2.5 m`) must specify human eye-level framing with subtle handheld breathing sway (`handheldSway: 0.2–0.5`).
  - **Impact Cam-Shake:** Program an impulse camera shake on the exact frame of major shockwaves, landings, or detonations.
- `animation_plan`: concrete, deterministic, time-driven movements evaluating strictly from absolute timestamp `time_s`. No frame-rate-dependent drift.
- `lighting` & `effects`: physical key/fill sources, HDR bloom on specular/emissive highlights, volumetric fog, and ACES tone mapping.
- `transition_out`: physical action cuts, camera whip pans, match cuts, or cross-dissolves ($0.3\text{–}0.5\text{s}$).

---

## TYPOGRAPHY, CAPTIONS & TELEMETRY OVERLAYS
- Burn-in **all spoken narration** via `caption-kinetic-v1` driven by actual synthesized Whisper word timestamps.
- Caption formatting: 2–5 word dynamic phrases, uppercase impact or clean Inter SemiBold, 68–76 px at 1080×1920, optical outline/shadow, resting in the lower safe area ($y \approx 1300\text{–}1340\text{ px}$).
- Active word highlight: bright solar yellow (`#FACC15`) or alert cyan (`#38BDF8`) fill with subtle scale lift.
- `caption_emphasis.phrase` must be an **exact, case-sensitive substring** of its scene's `narration.text`.
- Diegetic Telemetry HUD: render persistent top-left simulation metrics via `overlay-labels-v1` (`x = 90`, `y = 240`) leaving the central $y \in [400, 1200]$ viewport completely clear for 3D action.

---

## NARRATION, AUDIO & SOUNDTRACK
- Apply the writing skill's spoken-language and editorial rules: concrete actions, varied sentence lengths, earned surprises, and concise qualifications. Cut explanatory repetition before accelerating speech.
- Target **148–160 WPM** during the opening $25\text{ seconds}$ to hook fast scrollers, moderating to **125–135 WPM** for the final revelation or consequential decision.
- Insert purposeful $0.25\text{–}0.4\text{s}$ breathing gaps after massive visual reveals.
- Program an explicit **`"silence"` audio cue** (-24 dB duck) in `audio_cues` 0.3s before the primary impact or reveal. Choose reveal sounds that fit the event actually staged.
- When sequential physical failures are depicted, schedule staggered multi-tap `"impact"` cues separated by 80–150 ms and aligned to those failures.
- Mix narration clearly over music (-16 to -18 dB bed); normalize master audio to **-14.0 LUFS** (true peak $\le$ -1.0 dBTP).
- Spell out numbers phonetically where necessary to ensure natural TTS pronunciation.

---

## ASSET LIBRARY — REUSE BEFORE CREATE
- Search actual `assets/registry.json` entries for reusable components: `earth-globe-v1`, `starfield-v1`, `sky-dome-v1`, `ocean-surface-v1`, `city-street-block-v1`, `pedestrian-crowd-v1`, `flame-v1`, `smoke-wisp-v1`, `plastic-bottle-v1`, `dial-gauge-v1`, `seismometer-v1`, `sound-rings-v1`, etc.
- Fill `asset_plan.existing_assets_to_reuse` with verified matching IDs and explicit runtime configurations.
- Propose new reusable assets in `new_reusable_asset_candidates` only for generalizable systems (e.g., `city-damage-map-v1`, `planetary-ring-system-v1`, `vortex-debris-pull-v1`).
- Provide concrete `asset_hint` tags on each shot subject.

---

## PLATFORM DISCOVERY & SEO INPUTS
- Define `distribution.primary_search_intent` and `core_keywords` pairing broad discovery tags with **explicit scientific domain qualifiers** (`"astrophysics simulation"`, `"earth science what if"`, `"physics thought experiment"`, `"threejs 3d documentary"`). This prevents YouTube from misrouting science simulations to gaming audiences.
- Multi-Platform Copy Rules:
  - **YouTube Shorts:** Title must start with `"What if"` for search SEO, paired with 5–10 relevant hashtags.
  - **TikTok, Instagram Reels, and X:** Open with the story's strongest 2nd-person consequence or contradiction, then its earned `distribution.comment_bait_question`. Preserve the film's actual promise and payoff; do not default to a generic map/survival question.
  - Every platform includes 5–12 targeted hashtags without generic spam.

---

## JSON CONTRACT — EXACT
- Must conform strictly to `storyboard.schema.json` v1.1.0 (no additional keys, comments, or Markdown fences inside the raw JSON).
- Scenes must partition the runtime: `S01.start_s = 0`, each `end_s` equals next `start_s`, last `end_s = project.duration_s`.
- Shot intervals must partition each scene without gaps.
- `claim_ids` may only reference declared `scientific_model.claims[].id`.
- Mandatory `thumbnail` block:
  - `time_s`: the single most striking, readable moment outside dissolves.
  - `headline`: 2–4 punchy curiosity words in uppercase, no more than 38 characters, ending in `?!` (e.g., `"COIN BLACK HOLE?!"`, `"NO OXYGEN?!"`). It must promise something the film delivers.
  - `highlight`: array of 1–2 key words drawn in accent color.
  - `badge`: 1–3 word sticker with a striking true number (e.g., `"3,900,000 G"`, `"5 SECONDS"`, `"−91% TIDES"`).
  - `focus`: subject coordinates `[x, y]` as fractions of the frame.
  - `arrow`: `true`, directing attention to the central story subject.
  - `style`: `"bold"` (default), `font`: `"anton"`, `"bebas-neue"`, or `"orbitron"`, `grade`: `"vivid"` or `"dramatic"`, `tilt`: -3.
- Save as `stories/<slug>.json` and validate with `python scripts/validate_storyboard.py stories/<slug>.json`. Ensure it prints `VALID` before proceeding to Part B.

---

# PART B — BUILD, VOICE, CAPTION AND RENDER THE VIDEO

Use the repository's deterministic pipeline:
1. **Build & Stage:** Create `src/stories/<slug>/` (`film.ts`, `timeline.ts`, `stages/`, `soundtrack.mjs`). Implement deterministic `renderAt(frameIndex)`, `time_s = frameIndex / 30`. Never use floating 2D charts where 3D environments apply.
2. **Narration:** Run `node tools/narrate.mjs stories/<slug>.json` using Kokoro (`am_michael`) with opening pacing speed up to 1.08x. Ensure audio starts at $t \le 0.08\text{ s}$ with zero leading dead air. Whisper aligns word timings into `build/<slug>/audio/narration.json`.
3. **Burned-In Captions:** Drive `caption-kinetic-v1` from real Whisper timestamps. 2–5 word phrases, uppercase impact styling, active-word highlight, safe area baseline $y \approx 1320\text{ px}$.
4. **Captions & Transcript Exporters:** Export `output/<slug>.srt` and `output/<slug>.txt` matching burned-in phrases.
5. **Soundtrack:** Write procedural audio in `src/stories/<slug>/soundtrack.mjs` using `audio-synth-kit-v1`. Enforce the silence drop before the primary impact or reveal, and stagger destruction transients when failures are depicted. Mix via `node tools/soundtrack.mjs <slug>` to **-14.0 LUFS** (peak $\le$ -1.0 dBTP).
6. **Smoke Frames & Render:** Render 3 strategic test frames at scale 0.5 (`node tools/render.mjs <slug> --frames a,b,c --scale 0.5`). Verify eye-level framing, telemetry HUD, and caption placement. Then render final video: `node tools/render.mjs <slug> --final --crf 19` $\rightarrow$ `output/<slug>.mp4` + bold cover `output/<slug>.jpg`.

---

# PART C — CHECKS, METADATA AND CATALOG

1. **Minimal QA:** `node tools/finalize.mjs <slug> --probe-only` (verify 1080×1920, 30 fps, exact duration, AAC stereo audio, `.srt`, `.txt`, and `.jpg` exist).
2. **Upload Metadata:** Write `metadata/<slug>.json` with tailored copy:
   - YouTube Shorts: Title starting with `"What if"`, concise description, and 5–10 scientific hashtags.
   - TikTok / Reels / X: High-tension 2nd-person hook, concise causal summary, and the story-specific `distribution.comment_bait_question`.
3. **Finalize & Catalog:** Run `python scripts/finalize_video.py <slug>` to update registry, catalog, and publishing copy.
4. **Archive:** Upload `output/<slug>.mp4`, `output/<slug>.jpg`, and `output/<slug>.md` to the designated Hugging Face archive dataset (`Whatif2203/whatif`).

## FINAL REPLY
Only after the MP4 passes QA, finalizer succeeds, and files are archived, reply with **one line: the absolute path to `output/<slug>.mp4`**. Nothing else. If blocked, state only the single real blocker.
