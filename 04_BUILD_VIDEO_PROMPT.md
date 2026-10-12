# BUILD VIDEO PROMPT — Paste into Claude Code or Codex

Render the storyboard at:

`stories/{{STORY_SLUG}}.json`

Follow `CLAUDE.md` if running Claude Code, or `AGENTS.md` if running Codex. These standing instructions are binding. The goal is a **cinematic, finished 45–90-second (storyboard-selected), vertical 1080×1920 30fps MP4** produced from real animated Three.js scenes, with peaceful adult male voice, accurate burnt-in subtitles and restrained soundtrack. No slideshow/stock footage substitute and no paid APIs.

## Mandatory run sequence
1. Validate storyboard and timeline, verify the science/visual rules and intended duration. Open `assets/registry.json`, reuse matching assets from earlier videos before writing new geometry/shaders/textures/models. Treat storyboard candidate assets as requests, not already-built source code.
2. Build **all** shots, camera movements, effects, world environments and human/ecological impacts. Extract truly reusable new work into `src/library/` or `assets/library/`; register the real files in `assets/registry.json` with stable IDs, public config inputs, reuse tags, source paths, license and `created_for`. Preserve prior-video compatibility. Do not register phantom assets.
3. Generate local licensed calm male narration; synchronize styled caption burn-in to the actual audio; mix subtle legal/original sound design. Frame-render deterministically and encode `output/{{STORY_SLUG}}.mp4` using H.264/yuv420p, AAC 48kHz stereo and `+faststart`.
4. Run minimal critical QA: storyboard validity, three visual smoke frames, actual `ffprobe` format/audio/duration verification and MP4 exists. Skip unrelated unit tests, huge E2E suites, broad lint/refactoring or test reports.
5. **After successful MP4 creation**, compose `metadata/{{STORY_SLUG}}.json` based on `examples/moon-half-distance.metadata.example.json`. Produce *different* accurately searchable upload metadata for YouTube Shorts, Instagram Reels, Facebook Reels, TikTok and X: platform-ready titles/descriptions/captions/posts, hashtags, topic search keywords, and YouTube tags. Use only claims and events present in the finished film. Include exact new/reused asset IDs; do not invent publication URLs.
6. **Run `python scripts/finalize_video.py {{STORY_SLUG}}`**, which verifies media/metadata and generates BOTH `metadata/{{STORY_SLUG}}.md` and cumulative `VIDEO_CATALOG.md` containing each video's copy-paste metadata; also updates the reuse registry and `ASSET_LIBRARY.md`. Must succeed before declaring completion.

## Communication rule
Do the work instead of narrating plans. Use minimal tokens, reuse code, avoid unnecessary broad tests. On successful completion return **ONLY the absolute path to the final MP4**, on a single line; no Markdown, analysis, limitations, feature list, summary or SEO text. If anything prevents a real MP4 and catalog, report only the immediate blocking issue.
