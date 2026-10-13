# MASTER PROMPT — What-If / How-Does Cinematic Short: Storyboard → Finished Video (one run)

## YOUR ROLE
Act simultaneously as (1) rigorous science researcher, (2) viral short-form documentary screenwriter, (3) cinematic 3D director, (4) Three.js/WebGL technical animation designer, (5) narrator/caption designer, (6) production editor and (7) build-and-render engineer. In **one run** you write the storyboard JSON, then build, voice, caption, render and publish-prepare the finished film:

1. **Part A — Storyboard:** one valid JSON document conforming exactly to `storyboard.schema.json`, saved as `stories/<slug>.json`. It must be **executable as a visual production specification, not a vague creative outline**.
2. **Part B — Finished video:** implement that storyboard in this repository as a real Three.js film with narration, music, sound design and burned-in captions, rendered to `output/<slug>.mp4`, plus a caption file and a plain-text transcript.
3. **Part C — Checks, metadata and catalog:** minimal QA, upload metadata and the required finalizer.

Do not stop after the JSON and do not ask for permission between parts: go straight from Part A to Part C. Follow `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex); they are binding. **Where to run:** Claude Code or Codex inside this repository (it needs file access, Node.js, the local Kokoro/Whisper models and the bundled FFmpeg). If you are running without repository access, you can only do Part A: output the raw JSON and state in one line that Parts B–C need Claude Code or Codex.

## USER INPUT (replace the values on each use)
TOPIC: "What if it rained nonstop everywhere on Earth for a year?"
OPTIONAL_CREATIVE_ANGLE: "CREATIVE"
OPTIONAL_FOCUS: "HUMAN AND NATURE IMPACT"
OPTIONAL_DURATION_SECONDS: "{{DURATION_OR_AUTO}}"  # 45..90 inclusive
OPTIONAL_ASSET_REGISTRY: "{{ASSET_REGISTRY_OR_EMPTY}}"  # actual assets/registry.json entries, not guessed

If optional values are `AUTO`, choose the most captivating defensible interpretation. When `OPTIONAL_DURATION_SECONDS` is AUTO, target **55–75 seconds** (choose the shortest time that fully earns its runtime); otherwise use the requested integer **45–90 seconds**. Never ask for 90 seconds merely because it is allowed. In the repository, **read `assets/registry.json` yourself** instead of relying on the placeholder; without repository access, if the registry is not supplied, assume it is empty and do not invent already-built assets. Do not ask questions. Write in English for an international, nontechnical audience.

## NON-NEGOTIABLE DELIVERY SETTINGS
- Exactly one self-contained cinematic short; **45–90 seconds inclusive**, target **55–75 seconds** unless the story genuinely benefits from a shorter/longer treatment; never over 90 seconds.
- Vertical **9:16**, **1080 × 1920**, **30 fps**, 24-bit-color-looking premium documentary aesthetic.
- Publishable on YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, and X.
- Main visuals: Three.js/WebGL **real 3D** with meaningful objects, lighting, materials, camera and environmental motion. Never substitute an entire video with static slides, charts, stock clips, or scrolling text.
- Spoken voiceover: calm, gentle, warm, peaceful **adult male**; articulate, quietly fascinated, never sensationally shouted. Target about **125–150 spoken words per minute** after pauses; match each scene's words to its available seconds.
- All words of the spoken narration must appear as **beautiful, correctly timed burned-in captions**, visually elegant (not karaoke chaos), with carefully emphasized keywords. Captions must derive from the *actual generated voice*, not from unsupported guessed timing.
- Every film also ships a **caption file** (`output/<slug>.srt`) and a **plain-text transcript** (`output/<slug>.txt`) of the exact narration (Part B).
- Music and sound design may only use procedurally generated or license-cleared assets; no subscriptions or paid APIs.

---

# PART A — STORYBOARD

## AUDIENCE-RETENTION STORY ENGINE
Invent a structure specific to the topic; do not inflate the runtime to hit 90 seconds. The essential story beats, adapted proportionately to the chosen length, are:
1. **0–3 seconds: immediate visual hook**: make the counterfactual unmistakable and ask the most compelling question. No logos, greeting or CTA.
2. **Opening ~10–18%: premise/reveal**: establish normal reality versus the changed rule; deliver a specific consequence.
3. **Next ~20–25%: mechanism**: an intuitive Three.js animation proves why things change.
4. **Middle ~30–35%: human/ecological stakes**: reveal concrete, scientifically defensible consequences in lived environments.
5. **Next ~15–20%: second-order surprise**: one counterintuitive result, consequence or timescale comparison, tied to the mechanism.
6. **Final ~10–15%: earned payoff and loop**: answer the opening clearly while ending on a striking visual/question that naturally connects to frame 0. No generic engagement bait.

**Scene budget:** 45–60 seconds = 6–9 scenes; 61–75 = 8–11 scenes; 76–90 = 10–14 scenes; 1–4 planned shots per scene. A visible, meaningful reveal should generally happen every **3–7 seconds** without restless cutting. Vary world scale (cosmic, planetary, environmental, human, macro) and compositions. Narration must have room to breathe at a peaceful delivery rate.

## SCIENTIFIC HONESTY: IMPORTANT
- First define a **precise counterfactual**. Distinguish the changed parameter, initial conditions, how it was changed, and timescale. A hypothetical that changes a moon's orbit, oxygen fraction, planetary position, an entire species or a human population must specify what's held constant; choose defensible assumptions explicitly.
- Trace a causal chain: physical/biological mechanism → environmental response → ecosystem/infrastructure changes → human experience. Cite **claims via IDs** within JSON and link to trustworthy source URLs *only if actually known or verified*. Never fabricate sources or pretend to have browsed when you have not. If sources cannot be confirmed, use `sources: []` and conservative claims.
- `confidence`: `established` for directly supported reality, `derived` for transparent calculations, `plausible` for reasonable counterfactual outcomes, `speculative` for story-world possibility. Strongly qualify uncertain outcomes in both voiceover and visuals.
- Check dimensional consistency and orders of magnitude. **Force ≠ acceleration ≠ tidal height**; partial pressures depend on total pressure; orbit change affects period and climate; biological disappearance outcomes depend on definition and timing. Do not flatten subtleties into false certainties.
- Never depict a scaled-up Moon taking up half the sky merely because it moved twice as close: **physical angular scale matters**. You may use telephoto framing for drama, or show clearly labeled schematic/explanatory overlays. Never present diagrams, speed changes, timelines, or exaggerated waves as literal footage.
- When a scenario concerns human sexes/genders, health, populations or mass disappearance, be specific and respectful: no stereotyping, no simplistic extinction timelines, distinguish immediate events from multigenerational outcomes, and never treat people as interchangeable abstractions.
- Prioritize high-quality, emotionally engaging **truthful spectacle**, not fictional catastrophes stated as fact. A good "could" is stronger than a misleading "would".

## CINEMATIC & THREE.JS SHOT DIRECTION
For every shot provide an implementation-level description, not just a noun:
- The 3D `world` and place/time/weather/scale convention; major `subjects` with explicit physical proportions or clearly stated illustrative deviations.
- Material construction and asset strategy for each subject: textures/procedural geometry/instancing/shaders/atmospheric scattering/ocean shader/PBR where appropriate. Include realistic imperfections, cloud motion, layered depth, micro-detail and believable shadows.
- `camera`: projection type, numeric FOV (perspective) or orthographic scale, **at least two absolute-second keyframes** with numeric `[x,y,z]` positions and `look_at`, easing, movement and lens intent. The coordinates are local scene units (describe scale in `world` or `scale_and_accuracy`). Never simply say "cinematic camera movement."
- `animation_plan`: concrete movements/events, their timing, visible direction and subject behavior. Specify what changes, not merely "animate smoothly". Deterministic from absolute timestamp; no frame-rate-dependent steps.
- `lighting`, `effects` and `composition_notes`: practical lighting sources, volumetrics/fog/bloom sparingly, safe zones, focal hierarchy and color treatment. Avoid visual clutter, fake lens flare, plastic planetary surfaces, giant captions, or visually repetitive globe shots.
- `transition_out` from physical action or visual match, not arbitrary flashy cuts. Respect exact time spans; no disjoint time gaps.
- Sound `audio_cues` only where they add emotional or explanatory value; foreground voiceover always stays intelligible.

## TYPOGRAPHY/CAPTIONS
- Burn-in **all narration** as dynamic readable captions synced with generated spoken audio; group into 2–6-word phrases, maximum two lines, approximately 56–78 px at 1080×1920, optical stroke/shadow and subtle active-word highlight.
- Maintain a platform-safe region: at least 90 px from left/right, 220 px from top, 300 px from bottom; place normal captions in the lower-middle safe area, around baseline y≈1380 px, **not under TikTok/Reels interaction buttons**.
- Use hierarchy: sparing single-word or numerical callouts can live *inside the 3D composition*, but spoken captions are a separate legible overlay. Highlight no more than one short phrase at once.
- `caption_emphasis.phrase` must be an **exact, case-sensitive substring** of its scene's `narration.text`.
- Never place important captions on top of the crucial reveal; shift the composition or use restrained behind-text gradient.

## NARRATION & AUDIO
- Write conversational language with short, rhythmic sentences, occasional wonder, one clear mechanism, and a satisfying last line. Avoid an encyclopedic explanation, inflated adjectives, filler or an unanswered clickbait title.
- Aim for approximately **125–150 spoken words/minute** multiplied by the actual narration time (not by the entire film duration); for example a 75-second film with ~65 seconds of spoken audio usually supports roughly **135–160 words**. Leave purposeful gaps; check each scene independently. Leave brief breathing room after major visuals.
- Each scene has `narration.start_s` and `end_s` **within** its scene and enough wall-clock time for its actual words. Let silence/ambience exist intentionally.
- Distinguish `music_direction`, `sfx_direction` and scene `audio_cues`; use soft cinematic texture with restrained bass, no constant whooshing. Mix narration prominently; target -16 LUFS and a true peak no higher than -1.5 dBTP.
- Spell numbers and names the way the narrator should say them, and avoid words a text-to-speech voice can stress wrongly (for example "turns to desert" can be read as "dessert"; "becomes a desert" cannot).

## ASSET LIBRARY — PLAN FOR COMPOUNDING REUSE
- Search the actual `assets/registry.json` IDs/descriptions/tags for reusable Earth, Moon, Sun, stars, terrain, clouds, atmosphere, water, plants, lighting rigs, particles, camera systems, text effects and common SFX. **Do not invent existing asset IDs**.
- Fill `asset_plan.existing_assets_to_reuse` with verified matching IDs, the intended shot usage and required configuration. A storyboard may request a variant, but should not clone the whole asset.
- Fill `new_reusable_asset_candidates` only for *meaningfully generalizable* components that the renderer can extract into `src/library/` or `assets/library/`; include proposed stable IDs, key runtime parameters, and reuse scenarios. These are proposals, **not claims that files already exist**.
- Leave truly unique props and one-off effects in `shot_specific_assets`. A reusable library must compound without sacrificing each video's original art direction.
- Include specific `asset_hint` on each relevant shot subject, using existing registry IDs or proposed asset IDs so the build step can quickly resolve implementations. Fallback to a descriptive hint for bespoke items.

## PLATFORM DISCOVERY / SEO INPUTS
- Set `distribution.primary_search_intent`, `core_keywords` and `distinctive_angle` for natural discovery. Choose terms audiences actually search, not generic hashtag stuffing.
- After the MP4 is rendered (Part C), you write copy-paste upload metadata for `metadata/<slug>.md` and the cumulative `VIDEO_CATALOG.md`. The storyboard carries the accurate search intent, while finished titles/descriptions must reflect the **actual rendered and narrated film**.
- All five platform variants should have independent hooks/keywords appropriate to YouTube Shorts, Instagram Reels, Facebook Reels, TikTok and X. Do not promise outcomes that the film does not show.

## JSON CONTRACT — EXACT
- Match `storyboard.schema.json`'s **field names, nesting, enumerations and required values** strictly. No additional keys, comments, Markdown fences, or explanatory prose inside the JSON. Do not add transcript or caption-file fields: the schema forbids extra keys, and those files are build outputs (Part B).
- Include: project metadata, scientific assumptions and claim register, visual identity, sound/caption design, **asset_plan** referencing only verified registry entries, **distribution** search-intent cues, scene-by-scene timecodes/voiceover/shot design, render output contract.
- Scenes must partition the runtime: `S01.start_s = 0`, each `end_s` equals next `start_s`, last `end_s = project.duration_s`; shot intervals must likewise partition each scene. No overlaps/gaps except transitions handled *within* shot time.
- Story beat IDs `S01`... sequential; shot IDs can restart `SH01` within each scene. Camera keyframes begin/end at the respective shot boundaries. Narration timestamps fall inside their scene.
- `claim_ids` may only reference existing `scientific_model.claims[].id`. Source URLs, if any, must correspond to evidence that actually supports the assigned claims. The `sources` array can be empty.
- Ensure `delivery.video_output` is `output/<project.slug>.mp4`, codecs H.264 yuv420p / AAC 48k, and `success_reply` exactly `absolute_mp4_path_only`.
- Ensure your script remains intriguing even **if listened to without video** and your visual storytelling remains comprehensible when **watched muted with captions**.
- Do an internal final pass: validate science, scene timing, narration pacing, source credibility, composition, JSON syntax, and complete concrete camera/animation specifications.
- **Save** the JSON as `stories/<slug>.json` (`slug` = `project.slug`; if that slug already exists, choose a new distinct slug rather than overwriting another film) and run `python scripts/validate_storyboard.py stories/<slug>.json`. Fix every error until it prints `VALID`, then continue straight to Part B.

---

# PART B — BUILD, VOICE, CAPTION AND RENDER THE VIDEO

Use the repository's existing pipeline and library; `CLAUDE.md` / `AGENTS.md` and `04_BUILD_VIDEO_PROMPT.md` describe the same contract in more detail.

1. **Reuse and build.** Resolve `asset_plan` against `assets/registry.json`: configure existing `src/library/` components first; build missing pieces; promote genuinely reusable new work to `src/library/` or `assets/library/` and register only real, working files (stable ID, source path, tags, configurable parameters, `created_for`, license, notes). Keep story-specific code in `src/stories/<slug>/` (mirror an existing story: `film.ts`, `timeline.ts`, `stages/`, `soundtrack.mjs`). Build **every** shot, camera, effect and transition with deterministic `renderAt(frameIndex)`, `time_s = frameIndex / 30`, seeded randomness; render `duration_s × 30` frames. Never hard-code a story's timestamps or camera poses into shared library assets.
2. **Narration (actual voice).** `node tools/narrate.mjs stories/<slug>.json` synthesizes each scene's exact narration locally (Kokoro `am_michael` by default; Piper only as a fallback) and aligns real word timings with local Whisper into `build/<slug>/audio/narration.json`. Listen-check the result through its timings: if a scene's speech overruns its window, adjust the storyboard's narration or scene times (keep it `VALID`) rather than pushing the voice faster than about 160 words per minute. If a word is mispronounced, rephrase it in the storyboard and re-run.
3. **Burned-in captions.** Drive the caption layer (`caption-kinetic-v1`) from `build/<slug>/audio/narration.json`, never from guessed times: every spoken word on screen, 2–6-word phrases, at most two lines, inside the safe area, active word highlighted, `caption_emphasis` treatments applied.
4. **Transcript and caption files.** From the same word timings and the same phrase grouping as the burned-in captions, write:
   - `output/<slug>.srt` — SubRip captions (`HH:MM:SS,mmm --> HH:MM:SS,mmm`), numbered from 1, one caption phrase per cue (max two lines), text exactly as spoken, times on the final video timeline, every cue inside `0 … duration_s`;
   - `output/<slug>.txt` — plain-text transcript: the title on the first line, then the exact narration scene by scene, one paragraph per scene, each starting with its `[mm:ss]` start time.
   If the repository has no exporter yet, add one small reusable script (for example `tools/transcript.mjs <slug>`) that reuses the caption phrase splitting, so the files always match what viewers see; reuse it in future runs.
5. **Soundtrack.** Write `src/stories/<slug>/soundtrack.mjs` (original procedural music and sound design with `audio-synth-kit-v1`, following `music_direction`, `sfx_direction` and `audio_cues`), then `node tools/soundtrack.mjs <slug>` → `build/<slug>/audio/mix.wav` (48 kHz stereo; narration on top; about -16 LUFS, true peak ≤ -1.5 dBTP).
6. **Smoke frames, then the final render.** `node tools/render.mjs <slug> --frames <3 strategic frames> --scale 0.5`; look at the three frames for blank or clipped shots, wrong scale and caption mistakes, and fix real problems. Then `node tools/render.mjs <slug> --final --crf 19` → `output/<slug>.mp4` (H.264 yuv420p, AAC 48 kHz stereo, `+faststart`, picture + narration + music/SFX + burned-in captions in one file).

---

# PART C — CHECKS, METADATA AND CATALOG

1. **Minimal QA only:** `node tools/finalize.mjs <slug> --probe-only` (ffprobe: 1080×1920, 30 fps, duration = `duration_s`, an AAC audio stream, file exists); the three smoke frames; the `.srt` and `.txt` contain every narration word once, in order, and the last cue ends within the video. Skip unrelated unit/E2E suites, lint sweeps and long reports.
2. **Upload metadata:** write `metadata/<slug>.json` following `examples/moon-half-distance.metadata.example.json`, with different, accurate, search-ready copy for YouTube Shorts, Instagram Reels, Facebook Reels, TikTok and X based on the finished film's real narration and scenes. Record the exact `created_asset_ids` and `reused_asset_ids`; leave `published_urls` empty; never invent links.
3. **Finalize (required):** `python scripts/finalize_video.py <slug>` (on this machine `node tools/finalize.mjs <slug>` runs it with the bundled ffprobe on `PATH`). It validates the media, updates `assets/registry.json`, regenerates `ASSET_LIBRARY.md`, writes `metadata/<slug>.md` and rebuilds `VIDEO_CATALOG.md`. The film is not finished until this succeeds.

## FINAL REPLY
Only after the MP4 passes its checks and the finalizer succeeds, reply with **one line: the absolute path to `output/<slug>.mp4`** (the `.srt` and `.txt` sit next to it). Nothing else. If a required step fails, reply with only the one real blocker; never claim a video that was not rendered.

## TOPIC TO GENERATE NOW
What if it rained nonstop everywhere on Earth for a year?
