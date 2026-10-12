# AGENTS.md — Codex Production Contract: Persistent What-If Shorts Studio

## Non-negotiable outcome
Turn `stories/<slug>.json` into one finished **Three.js cinematic MP4** and durable library/catalog updates. Valid runtime: **45–90 seconds** inclusive, not automatically 90. 1080×1920 portrait, 30 FPS, H.264/yuv420p and AAC 48kHz stereo (`+faststart`) at `output/<slug>.mp4`. Film all storyboard shots rather than delivering a test preview.

## Reuse-first asset lifecycle — essential
Treat the entire repository as one ongoing studio across dozens/hundreds of videos.
1. Open `assets/registry.json` and storyboard `asset_plan` before building. Search actual existing asset IDs/tags; do not assume unregistered or `new_reusable_asset_candidates` entries exist.
2. **Reuse existing code/assets wherever scientifically and visually suitable**. Configure instead of duplicate. Code modules: `src/library/`; reusable binary/textures/audio: `assets/library/`. Build story-specific sets/shots outside the shared library.
3. New Earth, Moon, Sun, planet, oceans, starfields, terrain, vegetation, clouds, particles, shaders, camera rigs, etc. that can support future topics should be parameterized and stored in the shared library **on the first video that creates them**. Deterministic frame time, typed options, editable visual quality, separate story-specific setups.
4. Register **only actually present and validated** assets in `assets/registry.json`, stable unique kebab-case `id`, `name`, `type`, `source_path`, `description`, `tags` (array), `configurable_parameters` (array), `created_for` slug, `used_in` (array), `license` and `notes`. Preserve compatibility or version changed assets; track proper rights/attribution; never overwrite a shared asset destructively.
5. Record exact reused and created asset IDs in `metadata/<slug>.json`. `scripts/finalize_video.py` records `used_in` and rebuilds `ASSET_LIBRARY.md`. This compounds asset reuse from video 1 to video 2 and beyond.

## Rendering workflow
1. Inspect existing dependencies/tools, story JSON and relevant library entries; run `python scripts/validate_storyboard.py stories/<slug>.json`.
2. Implement all shots with photoreal/cinematic Three.js visuals, motivated camera keyframes, rich materials, relevant planetary/human/ecological worldbuilding, clean transition effects and physically defensible scale (or labeled schematics). No static-slide substitute, generic globe loop or ugly placeholders.
3. Implement frame-perfect deterministic `renderAt(frameIndex)`: `time_s=frameIndex/30`; seeded randomness, stateless camera/object/shader evaluation. Capture browser WebGL frames and encode with FFmpeg.
4. Generate calm, peaceful licensed **male** narration via local Kokoro or Piper where available; synchronize every spoken word to legible, designed, burned-in captions. Mix understated rights-cleared music/ambience at intelligible voice levels. No paid media APIs.
5. Essential QA: storyboard schema/timeline, 3 rendered frame samples, final `ffprobe` stream+runtime check and nonempty file. Skip irrelevant unit/regression/E2E tests, full coverage, lint sweeps and long reports. Fix real failures; do not fake success.

## Per-video SEO record and cumulative catalog — required after every render
- Create `metadata/<slug>.json` based on `examples/moon-half-distance.metadata.example.json` and the **actual film** (not hypothetical scenes that were not made). Natural searchable language, accurate science and platform-specific copy. Supply separate metadata for **YouTube Shorts, Instagram Reels, Facebook Reels, TikTok and X**: titles where applicable, platform-ready descriptions/captions/posts, relevant hashtags, search keywords, plus YouTube tag list.
- Record the rendered filename, topic, runtime, scoped science caveat, `created_asset_ids`, `reused_asset_ids`; leave `published_urls` empty until genuine URLs exist. Don't claim SEO guarantees or automatic posting.
- Then **run** `python scripts/finalize_video.py <slug>`; it verifies the MP4, validates metadata, creates user-copyable `metadata/<slug>.md`, regenerates history + all SEO blocks in **`VIDEO_CATALOG.md`**, and refreshes `assets/registry.json`/`ASSET_LIBRARY.md`. Do not consider the video complete until this succeeds. The index generator is idempotent and prevents duplicate video rows.
- Update published URLs in metadata JSON manually after posting and rerun finalizer for tracking.

## Token efficiency
Read the registry once and only import assets relevant to the current shot; avoid whole-project dumps. Reuse components, keep code modular but small, avoid repeated explanations/plans, verbose logs or massive suites. Smoke-test before high-resolution frame capture. These efficiencies **never waive** validation of the real MP4, creating SEO metadata or updating both cumulative indexes.

## Final response — strict
**On successful render AND metadata/index finalization, output exactly one line containing the absolute path to the finished MP4 and nothing else.** No Markdown, limitations, summaries, feature inventories, test reports or catalog text. If a required step fails, output one factual concise blocker, not an invented success path.
