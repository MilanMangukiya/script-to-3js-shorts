# What-If Shorts — Long-Term 3D Video Production Studio (v1.1)

**One topic → one structured JSON → a 45–90-second cinematic Three.js MP4 → reusable shared assets → automatically maintained copy-paste SEO upload metadata.** Designed to work in the same repository over many video releases with either Claude Code or Codex. No paid API required.

## What changed
- **Runtime:** storyboard now accepts **45–90 seconds**. AUTO chooses **55–75 seconds** if the material justifies it; 90 is the hard cap. The JSON Schema and validator enforce the limit.
- **Compound asset library:** `assets/registry.json`, `src/library/`, `assets/library/` and auto-generated `ASSET_LIBRARY.md` let the agents reuse meaningful 3D components from previous videos.
- **Publication tracking:** after every real finished MP4, agents write metadata JSON and run `scripts/finalize_video.py <slug>`. This generates `metadata/<slug>.md` and rebuilds **`VIDEO_CATALOG.md`** with all videos and copy-paste SEO content for YouTube Shorts, Instagram Reels, Facebook Reels, TikTok and X.
- The catalog tracks *rendered* versus *published* honestly. It does not upload to platforms. `published_urls` starts empty and may be updated by you later.

## v1.2 studio upgrade (branch `manthan`)
- **Picture:** `delivery.render_quality: "cinematic"` (2x supersampling + CAS sharpening, deterministic 3-sample motion blur, per-shot GTAO, depth of field, sun shafts, AgX/Neutral tone mapping, split toning). `standard` stays bit-identical to the previous pipeline. `whip_pan` and `light_wipe` now render.
- **Voice:** per-scene loudness matching, broadcast finishing chain and convolution room; Kokoro voice blends; a text-aware starting-rate model (fewer calibration passes); starting rates re-measured on a 327-clip corpus.
- **Models:** 16-species quadrupeds, road vehicles, street furniture, PBR city/building/interior kits with CC0 textures and HDRIs, physical sky, nature and energy kits, insects, a lensing black hole, asteroids/comets, spacecraft, lightning, tornadoes and explosions, plus subsurface-style skin and draped clothing for `human-figure-v2`.
- **Crowds and nights:** varied, animated crowds (`crowd-kit-v1`), a Times Square-style neon district with animated billboards and wet reflections, rooftop night life with fireworks, a Milky Way sky and a solar system; `node tools/lookdev.mjs showcase --video build/lookdev/showcase.mp4 --scale 1` renders a 36 s reel of them.
- **Tools:** `node tools/lookdev.mjs <scene>` renders library look-dev scenes (stills, or `--video` for motion); `npm run typecheck` type-checks the library; `node tools/fetch-assets.mjs` re-fetches the CC0 Poly Haven set recorded in `assets/library/polyhaven.lock.json`.

## Key files

| Path | Why it exists |
|---|---|
| `01_MASTER_STORYBOARD_PROMPT.md` | Topic-agnostic prompt to generate science-reviewed, hook-driven detailed scene JSON, including reuse guidance and SEO search intent. |
| `storyboard.schema.json` | Strict storyboard v1.1 schema, allowing 45–90 seconds and up to 14 scenes. |
| `03_EXAMPLE_MOON_HALF_DISTANCE.json` | Fully developed 50-second sample including **unbuilt** reusable asset candidates. |
| `stories/moon-half-distance.json` | Ready sample storyboard for an agent to implement. |
| `CLAUDE.md` / `AGENTS.md` | Standing agent rules for reuse-first 3D, narration, render, catalog finalization and concise MP4-only reply. |
| `04_BUILD_VIDEO_PROMPT.md` | Reusable one-shot Claude Code/Codex implementation prompt. |
| `assets/registry.json` | Authoritative source of built reusable asset IDs, paths, parameters, license, creator and usage history; starts empty. |
| `ASSET_LIBRARY.md` | Human-readable library reference regenerated from the registry **after successful videos**. |
| `VIDEO_CATALOG.md` | Cumulative video index and copy-paste SEO descriptions/tags/captions for each finished video. Starts empty. |
| `examples/moon-half-distance.metadata.example.json` | Shape and tone of metadata to be written **after** a real video render, not a claim the example exists as MP4. |
| `scripts/validate_storyboard.py` | Narrow schema/time/asset-reference verification (Python + `jsonschema`). |
| `scripts/finalize_video.py` | Stdlib script to verify finished MP4 via FFprobe, validate upload metadata, record asset reuse, upsert catalog and create per-video copy blocks. |

## Repeatable workflow
1. **Generate JSON:** Give ChatGPT `01_MASTER_STORYBOARD_PROMPT.md` plus full `storyboard.schema.json`. Set `{{TOPIC}}`, optional angle/focus, and `{{DURATION_OR_AUTO}}` (AUTO or integer 45–90). When available, provide the existing `assets/registry.json` content as `{{ASSET_REGISTRY_OR_EMPTY}}`. Request JSON only.
2. **Save storyboard:** `stories/<slug>.json`, matching `project.slug`. The storyboard should contain verified existing asset IDs, future library candidates and SEO keyword intent; it should **not** pretend suggested assets were built.
3. **Hand off to agent:** Use `04_BUILD_VIDEO_PROMPT.md` (replace `{{STORY_SLUG}}`). Claude Code loads `CLAUDE.md`, Codex loads `AGENTS.md`. Either builds Three.js shots, uses the shared asset library, renders MP4, registers real reusable components, and generates upload metadata.
4. **Automated finish:** Agent must run `python scripts/finalize_video.py <slug>` **after** `output/<slug>.mp4` is genuinely rendered and metadata JSON is written. It creates or updates `VIDEO_CATALOG.md`, `metadata/<slug>.md`, `ASSET_LIBRARY.md`, and registry `used_in`. It will not run successfully with a fake or absent MP4.
5. **Upload yourself:** Copy text from `VIDEO_CATALOG.md` or the individual `metadata/<slug>.md` page to the corresponding app. YouTube gets title, description, tags and hashtags; Instagram/TikTok get captions and hashtags; Facebook gets title/description; X gets a ready-to-paste post. Platform-specific search keywords are included for reference, not as nonexistent metadata fields in the social apps. Enter actual upload URLs in `metadata/<slug>.json` under `published_urls`, then rerun finalizer to update the tracking index.

### Commands

```bash
python -m pip install jsonschema  # validator dependency only
python scripts/validate_storyboard.py stories/moon-half-distance.json
# Ask Claude Code or Codex to build the story; the following are run AFTER the agent renders a real MP4:
# metadata/moon-half-distance.json is written by the agent from the actual finished film.
python scripts/finalize_video.py moon-half-distance
```

**Important:** The kit ships with a **storyboard, not a pre-rendered video**. `output/` and the asset registry are intentionally empty. A completed MP4, its SEO catalog entry and asset usage history appear only when the agent genuinely builds and verifies the film.

## Engineering requirements
- Current Node.js, TypeScript/Three.js, Playwright or Puppeteer + browser WebGL rendering, local authorized Kokoro or Piper TTS, FFmpeg **and ffprobe**, and an environment capable of rendering 1080×1920 frames.
- Deterministic timestamped 30fps frames, realistic cinematic lighting/materials, exact voice-caption alignment, platform-safe overlays, legal music/asset use. Source scientific claims to trustworthy verified sources; distinguish established physics from counterfactual speculation.
- **Minimal targeted QA only:** JSON validation, 3 frame smoke samples, finished media inspection, metadata/registry finalization. Avoid large unnecessary unit/E2E suites and reporting.
- On success Claude Code or Codex ends with **only the absolute MP4 path**. The catalog and library updates happen on disk beforehand, without being pasted in its final answer.

## Science grounding for Moon example
Moon distance and orbit: [NASA](https://science.nasa.gov/moon/facts/), [NASA lunar fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html). Tidal forcing versus local tide height: [NOAA tidal explanation](https://oceanservice.noaa.gov/education/tutorial_tides/tides02_cause.html) and [NOAA tides](https://www.noaa.gov/education/resource-collections/ocean-coasts/tides). The example's ~8× figure is a **tidal-generating force** ratio under stated assumptions, not universal eightfold water heights.
