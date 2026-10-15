---
name: threejs-direction
description: Direct and review this repository's Three.js Shorts through clear staging, camera choices, timed reveals, and visible consequences. Use when turning a storyboard into shots or improving an existing 3D sequence. Follow the asset, schema, and deterministic rendering contracts; voice casting and narration synthesis are separate work.
---

# Three.js direction

Make the important change understandable in the picture. A locked viewpoint watching a place transform is a valid story. Choose movement and cuts for the information they reveal.

Read `01_MASTER_STORYBOARD_PROMPT.md`, `04_BUILD_VIDEO_PROMPT.md`, and the relevant storyboard from the repository root. Inspect `assets/registry.json` and actual reusable components before proposing geometry. Keep the user's requested scope; a direction review does not itself request a new film, voice, or upload.

For composition, lighting, materials, and focal hierarchy, read [references/composition-lighting.md](references/composition-lighting.md). Keep a comparison confined to the area being reviewed before starting the next one.

For character acting, locomotion and prop/contact work, read [references/character-animation.md](references/character-animation.md). Give actors a purpose, a supported pose and an action that completes.

## Analyze

- Identify each shot's starting state, the event that changes it, and its resulting state. Inspect the actual stage/camera code as well as the storyboard.
- Find the primary subject and the cause of its change. If narration promises an event but the stage supplies only a room, orbit, ambient particles, or tiny idle motion, that event still needs staging.
- Keep a useful spatial anchor across related beats: a street, lake, instrument, or prop. Change location when different evidence is needed. A person or ethical dilemma is optional.
- Check whether `Stage.update()` overrides the storyboard camera and whether bindings change post settings. These can explain why declared keyframes do not produce the expected frame.

## Plan

For each pivotal event, specify **setup → change → consequence** in existing schema fields:

- `subjects[].movement`: the physical subject that acts or changes, including its support or interaction target.
- `animation_plan`: absolute times for setup, onset, decisive change, and a readable completed state; name what the viewer learns.
- `camera.keyframes` and `camera.lens_notes`: the focal subject, what the composition reveals or withholds, and why a move/cut is useful.
- Scene `visual_payoff`: the visible result actually delivered, consistent with the premise and narrative timing.

Allow time to register the starting and completed states. Do not cut at the instant an action becomes readable. Several beats may unfold in one shot; different views of an unchanged object do not create new information.

Do not add schema keys. For an isolated comparison, copy the storyboard into `build/` and change only the existing camera/shot timing fields needed by the test.

## Work

### Stage the event

- Reconfigure registered assets and existing props first. Add missing action or support before decorative detail. A falling, opening, vanishing, or approaching object needs a corresponding timed state change.
- Keep positions, contact points, and identities coherent across cuts. Aim at the actual animated subject, using its world position where appropriate. Document runtime camera overrides so declared and rendered direction agree.
- Let actions settle. Do not keep a landed object spinning, a sample bobbing, or a character walking in place to satisfy an activity rule. Preserve the ban on long frozen rear-facing mannequins; use purposeful framing, a readable reaction, or a changing environment instead.
- Keep scale honest. Magnification belongs in an optical view or a directed scale change, rather than a room-sized floating microscopic specimen.

### Direct attention

- Give a camera move a purpose: **reveal, follow, compare, or change scale**. Otherwise hold the composition while the event unfolds.
- The required two numeric keyframes may share position and target. Preserve required ground-camera sway while keeping the focal action readable; use impulse shake for an actual impact.
- Repository detail: the explicit sway/shake path reads the departing keyframe's easing; the legacy path reads the arriving one. Use matching adjacent easing values for predictable moves/holds rather than changing the shared rig for one film.
- Frame the subject clear of HUD/captions and inspect its change at phone size. Use position, depth, contrast, and motivated light to separate it from the background before adding overlays/effects.
- Keep a reveal hidden until intended. The pipeline centers cross-dissolves on scene boundaries, exposing an incoming shot before its declared start. Use cuts/match cuts when withholding matters and inspect transition edge frames.

### Preserve deterministic state

- Evaluate transforms, visibility, materials, and effects from absolute `time_s` and seeded helpers. Set the full relevant state on every update, including backward seeks.
- Keep ended actions in their completed state until a supported later event changes them. Do not accumulate movement or depend on an earlier shot having run.
- Offscreen instrument views must render correctly on direct seeks and sequential playback. Restore renderer targets and viewport after rendering them.

## Review before moving to another area

Keep the three-frame smoke check, then inspect a short **moving excerpt** containing the pivotal event and nearby shot boundaries. Use renderer `--preview`, `--range`, `--clean`, and `--scale` options; save review MP4s under `build/`. Optional `--storyboard` supplies an isolated camera/cut variant of the same film; stage construction and film-specific overlays still come from the registered implementation.

Compare before/after at the same absolute times and resolution. First review without captions/labels, then check normal overlays and unchanged existing audio when available. Do not change voice or script during a direction comparison.

1. Can the viewer identify the subject, see the event, and understand the consequence without explanatory overlays?
2. Is the change readable at phone size, with the camera settling or following when useful?
3. Do cuts preserve action and spatial relationships? Is withheld information exposed early?
4. Does the completed state hold long enough, with coherent contacts and no decorative motion replacing action?
5. Does the same frame produce the same picture after earlier/later frames? Check a reveal and a completed state after out-of-order seeks.

Fix failed checks within this area and review the affected excerpt again. Report the visible improvement, checks performed, and remaining limits. A still-frame pass or successful encode alone does not establish that direction works; do not claim a measured retention gain from a preview.
