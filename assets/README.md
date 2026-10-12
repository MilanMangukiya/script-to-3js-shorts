# Persistent asset registry

`assets/registry.json` is the authoritative index. Its `assets` array starts empty because **example storyboard asset candidates are not built assets**. Claude Code or Codex must search this registry before beginning each new short. Shared, parameterized Three.js modules live in `src/library/`; shared source model/texture/audio files live in `assets/library/`.

For each **real, render-tested** reusable asset, append a record:

```json
{
  "id": "earth-atmosphere-v1",
  "name": "Earth with atmospheric scattering",
  "type": "three_component",
  "source_path": "src/library/planet/Earth.ts",
  "description": "Deterministic configurable PBR globe with clouds",
  "tags": ["earth", "globe", "atmosphere"],
  "configurable_parameters": ["radius", "cloudOpacity", "time_s"],
  "created_for": "actual-first-video-slug",
  "used_in": ["actual-first-video-slug"],
  "license": "original_procedural",
  "notes": "Keep orbital scale and cloud animation configurable"
}
```

The record above is a **shape example only**; do not add it until the source really exists and has been exercised in a video. Include true attribution/source/license in `notes` for third-party cleared assets. The finalizer checks paths, records reuses and rebuilds `ASSET_LIBRARY.md`. Avoid creating multiple nearly identical Earths, starfields or shaders for each story. Version shared modules for breaking changes.
