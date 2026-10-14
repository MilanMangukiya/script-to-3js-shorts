# MASTER PROMPT — What-If / How-Does Cinematic Short: Storyboard → Finished Video (one run)

## YOUR ROLE
Act simultaneously as (1) rigorous science researcher, (2) viral short-form simulation screenwriter, (3) cinematic 3D director, (4) Three.js/WebGL technical animation designer, (5) narrator/caption designer, (6) production editor and (7) build-and-render engineer. In **one run** you write the storyboard JSON, then build, voice, caption, render and publish-prepare the finished film:

1. **Part A — Storyboard:** one valid JSON document conforming exactly to `storyboard.schema.json`, saved as `stories/<slug>.json`. It must be **executable as a visual production specification, not a vague creative outline**.
2. **Part B — Finished video:** implement that storyboard in this repository as a real Three.js film with narration, music, sound design and burned-in captions, rendered to `output/<slug>.mp4`, plus a caption file (`.srt`), a plain-text transcript (`.txt`), and a bold thumbnail cover (`.jpg`).
3. **Part C — Checks, metadata and catalog:** minimal QA, multi-platform upload metadata and the required finalizer.

Do not stop after the JSON and do not ask for permission between parts: go straight from Part A to Part C. Follow `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex); they are binding. **Where to run:** Claude Code or Codex inside this repository (it needs file access, Node.js, the local Kokoro/Whisper models and the bundled FFmpeg). If you are running without repository access, you can only do Part A: output the raw JSON in a single code block and state that Parts B–C need Claude Code or Codex.

## USER INPUT (replace the values on each use)
TOPIC: "{{TOPIC}}"
OPTIONAL_CREATIVE_ANGLE: "SIMULATION"
OPTIONAL_FOCUS: "STREET LEVEL TO PLANETARY SCALE"
OPTIONAL_DURATION_SECONDS: "{{DURATION_OR_AUTO}}"  # 45..90 inclusive; target 46..56
OPTIONAL_ASSET_REGISTRY: "{{ASSET_REGISTRY_OR_EMPTY}}"  # actual assets/registry.json entries, not guessed

If optional values are `AUTO`, choose the most captivating defensible interpretation. When `OPTIONAL_DURATION_SECONDS` is AUTO, target **46–56 seconds** for single-variable physical shocks (max **62 seconds** for multi-epoch geological/human arcs); choose the shortest time that fully earns its runtime. Never exceed 65 seconds without compelling cause. In the repository, **read `assets/registry.json` yourself** instead of relying on the placeholder; without repository access, reference only validated registry IDs. Write in English for an international, curious nontechnical audience.

## NON-NEGOTIABLE DELIVERY SETTINGS
- Exactly one self-contained cinematic short; **45–62 seconds inclusive**, target **46–56 seconds** unless the story genuinely requires multi-epoch scope; never over 90 seconds.
- Vertical **9:16**, **1080 × 1920**, **30 fps**, 24-bit-color-looking premium documentary/simulation aesthetic.
- Publishable on YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, and X.
- Main visuals: Three.js/WebGL **real 3D** with meaningful objects, lighting, materials, camera and environmental motion. Never substitute an entire video with static slides, 2D charts, floating rulers, or scrolling text.
- Spoken voiceover: crisp, articulate, high-tension documentary narrator; intimate, quietly astonished, never sensationally shouted. Target **148–160 WPM** in opening scenes (`S01`–`S04`), easing to **125–135 WPM** during the final twist/payoff.
- Audio loudness: master mix normalized to **-14.0 LUFS** (true peak $\le$ -1.0 dBTP). Foreground sound effects must stay punchy (-6 to -10 dB relative to voice), with an intentional **0.25–0.35s acoustic silence drop** (-24 dB duck) programmed immediately before major physical impacts.
- All words of the spoken narration must appear as **beautiful, correctly timed burned-in captions** (`caption-kinetic-v1`), styled in high-contrast uppercase/title-case phrases (2–5 words), placed in the platform-safe band (baseline $y \approx 1300\text{–}1340\text{ px}$), with vibrant keyword highlights.
- Mandatory bold thumbnail cover (`thumbnail-title-card-v1`): every film must output `output/<slug>.jpg` (1080×1920) with a punchy 2–4 word uppercase curiosity headline, numeric badge sticker, and directional arrow.
- Every film also ships a SubRip caption file (`output/<slug>.srt`), a plain-text transcript (`output/<slug>.txt`), and copy-paste publishing metadata (`metadata/<slug>.md`).

---

# PART A — STORYBOARD

## AUDIENCE-RETENTION STORY ENGINE (SIMULATION ESCALATION)
Structure every film around an escalating timeline simulation that commands immediate attention, drops the viewer into a human-scale vantage point, and builds relentless physical stakes.

### 1. Scene & Beat Budget
- **45–54 seconds = 7–9 scenes; 55–62 seconds = 9–11 scenes; 1–3 planned shots per scene.**
- A visible reveal, spatial shift, or physical consequence must occur every **2.5–4.5 seconds**. Never hold a static camera or frozen subject longer than 3.0 seconds.

### 2. The 5-Stage Narrative Sequence
1. **0–3.5s (`hook`): The Domestic / Street-Level Anchor & Anti-Echo Rule.**
   - **CRITICAL:** Sentence 1 of the narration must **NEVER repeat the title verbatim** and must **NEVER start with "What if"**. The viewer already read the title.
   - Drop the viewer immediately into a 2nd-person domestic or street-level setting (`y = 1.4–1.8 m` eye-level camera) at the exact split-second the rule breaks (e.g., *"You're standing at a downtown crosswalk when every oxygen atom on Earth vanishes"* or *"Compress Earth's entire mass into a coin in your city, and the cars go first"*).
   - Cut across at least two contrasting world scales (human eye-level to orbital/macro) within the first 8 seconds.
2. **3.5–10s (`premise`): The Shocking Physical Metric & Telemetry Lock.**
   - Establish the precise physical counterfactual with an unmistakable scale juxtaposition (e.g., *"It's only 0.35 inches wide, but weighs as much as the planet"*).
   - Display a diegetic top-left Simulation Telemetry HUD (`TIMER: T+00:01s | SURVIVORS | DISTANCE | G-FORCE`).
3. **10–25s (`mechanism` & `escalation`): Sequential Physical Object Failure.**
   - Show concrete physical objects breaking down in clear causal order (**cars $\rightarrow$ roofs $\rightarrow$ rivers $\rightarrow$ buildings $\rightarrow$ atmosphere**).
   - **FORBIDDEN:** Do NOT cut to detached 2D bar charts, measuring cylinders, or floating rulers. Show the consequences happening to real 3D assets (`city-street-block-v1`, `pedestrian-crowd-v1`, `flame-v1`, `ocean-surface-v1`, `plastic-bottle-v1`, `airliner-v1`).
4. **25–42s (`human_impact` & `second_order_effect`): The Map Radius & Survival Zone.**
   - Translate the physics into spatial survival thresholds using leader-line callouts (`overlay-labels-v1`) or city damage rings (e.g., *"At 2 miles away, your house feels millions of g"* or *"35°C wet-bulb heat — sweat can no longer cool the human body"*).
   - Depict human impact with respectful medium-distance silhouettes or dynamic crowd movement; never use frozen back-of-head mannequins held for multiple seconds.
5. **42–54s (`twist`, `ending` & `loop_connection`): The Counter-Intuitive Twist & Seamless Loop.**
   - Deliver one surprising scientific revelation tied to the mechanism (e.g., *"the Moon keeps orbiting a coin"*, *"the oxygen rushes back, but the hydrogen is still there"*).
   - **Ending CTA:** Close with an interactive survival or geographic prompt (e.g., *"Where would you be on the map?"* or *"Would you have survived the first five seconds?"*).
   - **Loop Connection:** The final spoken line and camera keyframe must bridge syntactically and visually back into Frame 0 (`t = 0.0s`), compelling a seamless second watch.

---

## SCIENTIFIC HONESTY & SIMULATION TELEMETRY
- Define a **precise counterfactual**: state initial conditions, what is held constant, and explicitly separate timescales (instantaneous $0\text{–}5\text{s}$ impact vs. decadal environmental response vs. geological aftermath).
- Trace a rigorous causal chain: fundamental physics/chemistry $\rightarrow$ environmental response $\rightarrow$ structural/infrastructure failure $\rightarrow$ human experience. Cite claims via `claim_ids` linked to `scientific_model.claims[]`.
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
- Write conversational, high-velocity language with short, rhythmic sentences, sensory details, and zero academic filler.
- Target **148–160 WPM** during the opening $25\text{ seconds}$ to hook fast scrollers, moderating to **125–135 WPM** for the final philosophical payoff.
- Insert purposeful $0.25\text{–}0.4\text{s}$ breathing gaps after massive visual reveals.
- Program an explicit **`"silence"` audio cue** (-24 dB duck) in `audio_cues` 0.3s before the main shockwave hits.
- Schedule staggered multi-tap `"impact"` cues separated by 80–150 ms for sequential physical failures.
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
  - **TikTok, Instagram Reels, and X:** Opening caption hook must be an intriguing, 2nd-person declarative hook (e.g., *"You're at a rooftop bar downtown when..."* or *"A coin-sized black hole just appeared in your city"*), followed by an interactive comment prompt (*"Where would you be on the map? 👇"*).
  - Every platform includes 5–12 targeted hashtags without generic spam.

---

## JSON CONTRACT — EXACT
- Must conform strictly to `storyboard.schema.json` v1.1.0 (no additional keys, comments, or Markdown fences inside the raw JSON).
- Scenes must partition the runtime: `S01.start_s = 0`, each `end_s` equals next `start_s`, last `end_s = project.duration_s`.
- Shot intervals must partition each scene without gaps.
- `claim_ids` may only reference declared `scientific_model.claims[].id`.
- Mandatory `thumbnail` block:
  - `time_s`: the single most striking, readable moment outside dissolves.
  - `headline`: 2–4 punchy curiosity words in uppercase, ending in `?!` (e.g., `"COIN BLACK HOLE?!"`, `"NO OXYGEN?!"`).
  - `highlight`: array of 1–2 key words drawn in accent color.
  - `badge`: 1–3 word sticker with a striking true number (e.g., `"3,900,000 G"`, `"5 SECONDS"`, `"−91% TIDES"`).
  - `focus`: subject coordinates `[x, y]` as fractions of the frame.
  - `style`: `"bold"` (default), `font`: `"anton"`, `"bebas-neue"`, or `"orbitron"`, `grade`: `"vivid"` or `"dramatic"`, `tilt`: -3.
- Save as `stories/<slug>.json` and validate with `python scripts/validate_storyboard.py stories/<slug>.json`. Ensure it prints `VALID` before proceeding to Part B.

---

# PART B — BUILD, VOICE, CAPTION AND RENDER THE VIDEO

Use the repository's deterministic pipeline:
1. **Build & Stage:** Create `src/stories/<slug>/` (`film.ts`, `timeline.ts`, `stages/`, `soundtrack.mjs`). Implement deterministic `renderAt(frameIndex)`, `time_s = frameIndex / 30`. Never use floating 2D charts where 3D environments apply.
2. **Narration:** Run `node tools/narrate.mjs stories/<slug>.json` using Kokoro (`am_michael`) with opening pacing speed up to 1.08x. Ensure audio starts at $t \le 0.08\text{ s}$ with zero leading dead air. Whisper aligns word timings into `build/<slug>/audio/narration.json`.
3. **Burned-In Captions:** Drive `caption-kinetic-v1` from real Whisper timestamps. 2–5 word phrases, uppercase impact styling, active-word highlight, safe area baseline $y \approx 1320\text{ px}$.
4. **Captions & Transcript Exporters:** Export `output/<slug>.srt` and `output/<slug>.txt` matching burned-in phrases.
5. **Soundtrack:** Write procedural audio in `src/stories/<slug>/soundtrack.mjs` using `audio-synth-kit-v1`. Enforce the pre-impact silence drop and staggered destruction transients. Mix via `node tools/soundtrack.mjs <slug>` to **-14.0 LUFS** (peak $\le$ -1.0 dBTP).
6. **Smoke Frames & Render:** Render 3 strategic test frames at scale 0.5 (`node tools/render.mjs <slug> --frames a,b,c --scale 0.5`). Verify eye-level framing, telemetry HUD, and caption placement. Then render final video: `node tools/render.mjs <slug> --final --crf 19` $\rightarrow$ `output/<slug>.mp4` + bold cover `output/<slug>.jpg`.

---

# PART C — CHECKS, METADATA AND CATALOG

1. **Minimal QA:** `node tools/finalize.mjs <slug> --probe-only` (verify 1080×1920, 30 fps, exact duration, AAC stereo audio, `.srt`, `.txt`, and `.jpg` exist).
2. **Upload Metadata:** Write `metadata/<slug>.json` with tailored copy:
   - YouTube Shorts: Title starting with `"What if"`, concise description, and 5–10 scientific hashtags.
   - TikTok / Reels / X: High-tension 2nd-person hook, second-by-second summary, and the mandatory interactive comment question (`"Where would you be on the map? 👇"`).
3. **Finalize & Catalog:** Run `python scripts/finalize_video.py <slug>` to update registry, catalog, and publishing copy.
4. **Archive:** Upload `output/<slug>.mp4`, `output/<slug>.jpg`, and `output/<slug>.md` to the designated Hugging Face archive dataset (`Whatif2203/whatif`).

## FINAL REPLY
Only after the MP4 passes QA, finalizer succeeds, and files are archived, reply with **one line: the absolute path to `output/<slug>.mp4`**. Nothing else. If blocked, state only the single real blocker.