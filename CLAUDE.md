# CLAUDE.md — What-If Shorts Studio: Claude Code Production Contract

## Mission and authority
Build and render `stories/<slug>.json` as a finished, cinematic Three.js documentary MP4. Preserve scientific accuracy, physical/illustrative distinctions and original visual storytelling. Treat `storyboard.schema.json`, the story JSON and these instructions as the contract; don't stop at scaffolding. **45–90 seconds inclusive**, with no padding simply to reach the upper bound.

## Persistent studio memory: mandatory asset reuse
The repo is a **growing production studio**, not one independent project per video. Its accumulated 3D assets must be maintained and reused.

**Before coding each video:**
1. Read `assets/registry.json` (small machine index) and only those registered source files whose IDs/tags match the storyboard. `ASSET_LIBRARY.md` is a human-readable index, not the source of truth. Read `asset_plan` in the storyboard; verify candidate reuse IDs against the registry; never assume candidate assets exist.
2. Prefer an existing asset factory, material, effect, lighting rig or system with **new configuration parameters** over rebuilding it. Reuse as much as visually appropriate; do not let reuse degrade the video or falsify its scientific model.
3. Shared **code** lives in `src/library/` (planet components, PBR material factories, ocean shaders, environment props, camera rigs, caption motions, render helpers); reusable **files** live in `assets/library/` (textures, models, audio, etc.). Story-specific compositions live separately in the existing scene/project structure. Never bake hard-coded storyboard timestamps or camera poses into generic reusable assets.
4. When an original creation will plausibly be useful in future videos, **parameterize and promote it to the library on that same render**. Expose typed configuration (e.g. planet radius/tilt/clouds, coast wave shape, star seed, lighting/color) and deterministic `time_s`; no hidden module-global side effects. Register it in `assets/registry.json` with stable ID, source path, description, tags, configurable parameters, `created_for`, `used_in`, original/license-cleared provenance and usage notes. Only register code/files that actually exist and render successfully; proposed candidates are NOT completed assets.
5. Track reused versus new asset IDs precisely in `metadata/<slug>.json`. The finalization script updates every registered item's `used_in` and rebuilds `ASSET_LIBRARY.md`. Never overwrite a shared asset in a way that breaks prior videos; add backwards-compatible parameters or version the asset when needed.

Recommended registry record shape (append to `assets/registry.json` `assets` array):
```json
{"id":"earth-atmosphere-v1","name":"Earth with atmosphere","type":"three_component","source_path":"src/library/planet/Earth.ts","description":"Configurable Earth component","tags":["earth","space","clouds"],"configurable_parameters":["radius","cloudOpacity","time_s"],"created_for":"first-video-slug","used_in":["first-video-slug"],"license":"original_procedural","notes":"Deterministic; physically meaningful scales"}
```
The example is a **format**, not an already-existing asset. Use accurate IDs and paths for real components.

## Film and technical deliverables
- 1080×1920, 9:16, CFR 30 FPS, 45–90 seconds as specified by JSON, `output/<slug>.mp4`.
- Three.js/WebGL performs all principal animation; use deterministic `renderAt(frameIndex)` where `time_s=frameIndex/30` (never integrate by wall time). Render `duration_s × 30` frames.
- H.264 `yuv420p`, AAC 48kHz stereo, MP4 `+faststart`. Render final resolution, not just a preview.
- Calm, peaceful, warm **male** narration from locally usable, appropriately licensed Kokoro preferred or Piper fallback, no paid APIs. Time-align captions with actual synthesized speech, burn in all spoken words with elegant mobile-safe typography. Mix soft, original/license-cleared atmospheric music/SFX without obscuring voice.
- Ground physical/geographic/astronomical outcomes in the storyboard's scientific claims. Mark nonliteral schematics, accelerated time, and uncertain outcomes when needed.
- Variation matters: scene-directed framing from space to human-scale, material and atmosphere detail, stable lighting, intentional transitions. No generic looped globe, slideshow, placeholder geometry, unlicensed stock, unreadable captions or invisible impact on people.

## Operational sequence — follow for every new video
1. Inspect only relevant project files, the story JSON and relevant entries in `assets/registry.json`; validate the story (`python scripts/validate_storyboard.py stories/<slug>.json`).
2. Resolve `asset_plan`: reuse real assets first, enhance via parameters, then create only missing scene components. Promote genuinely reusable assets to `src/library/` or `assets/library/`; update the registry accurately.
3. Build every shot, camera and effect; synthesize narrator and soundtrack; align animated captions; render frames to H.264/AAC MP4.
4. Minimal checks only: 3 strategically sampled rendered frames for blank/clipped/caption mistakes, `ffprobe` stream/dimensions/FPS/duration/audio, output file exists. Fix actual problems. Skip unrelated unit/integration/E2E suites, lint sweeps, coverage, long reports and extensive test scaffolding.
5. **Required publishing step after a successful render:** write `metadata/<slug>.json` following `examples/moon-half-distance.metadata.example.json`. Generate meaningful, accurate, **different SEO-ready copy** for YouTube Shorts (title, description, tags, hashtags, search keywords), Instagram Reels (caption, hashtags, keywords), Facebook Reels (title, description, hashtags, keywords), TikTok (caption, hashtags, keywords), and X (280-character-safe post + hashtags, keywords). Use the film's real narration, science, `distribution` search intent and rendered scenes. No fake claims, generic hashtag spam or invented publishing URLs. Record actual `created_asset_ids` and `reused_asset_ids`.
6. **Must run** `python scripts/finalize_video.py <slug>` after the metadata JSON and true MP4 exist. It validates the finished media, updates `assets/registry.json`, regenerates `ASSET_LIBRARY.md`, writes `metadata/<slug>.md` with copy-paste blocks for each platform and **rebuilds cumulative `VIDEO_CATALOG.md`**. Rerunning on the same slug updates entries rather than duplicating them. Catalog/history generation is a deliverable, not optional documentation. Never mark a video finished if this fails.
7. If the creator later adds `published_urls` in its metadata JSON, rerun the same finalizer to refresh publishing statuses and links. Never claim it was published automatically.

## Token and compute discipline
Use small, targeted file reads and concise diagnostics; do not dump full videos/asset binary data or repeated logs. Reuse libraries and tools already installed. Generate a few low-cost smoke frames before the final quality render. Avoid needless dependencies, abstractions, repetitive discussions and extensive test infrastructure; but never skip storyboard verification, actual audio/captions, `ffprobe` or the **required** catalog/asset finalization. Keep rendering independent of any network or paid API.

## Final response rule — highest priority
**ONLY after both MP4 validation and successful catalog/asset finalization:** output one absolute filesystem path to the completed `output/<slug>.mp4` file. Absolutely nothing else: no Markdown, summary, SEO copy, changelog, limitations, reports or descriptions. If a required step fails, return only one concise real blocker; never pretend a video was completed.
