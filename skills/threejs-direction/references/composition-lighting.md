# Composition and lighting

Use this reference when authoring framing, light, materials, or post settings. Follow Analyze → Plan → Work → Review and complete this area before changing character performance or voice during an improvement pass.

## Analyze

Identify the subject that carries the next piece of information. Inspect its projected size, silhouette, background, reflections, and clearance from captions/HUD at phone size. Distinguish a framing problem from a lighting problem: increasing exposure cannot make a small or occluded subject readable.

Inspect the actual rendering path. This repository applies its own ACES/gamma finish in `FilmPipeline`; do not add another tone-mapping pass or globally brighten all stories to repair one scene. Check environment, hemisphere, direct lights, emissives, and screen materials separately.

## Plan

- Choose a visible light source or plausible direction for the key, enough fill to retain necessary detail, and restrained separation from the background.
- Decide which surfaces should attract attention and which provide context. Quiet bright trim, large reflections, or background lamps that compete with a small prop or reaction.
- Keep the chosen palette and asset style coherent. Lighting should clarify form and meaning without requiring photorealistic geometry.
- For a comparison, lock camera, timing, action, resolution, and narration. Change lighting/material hierarchy first; change composition separately if the framing itself fails.

## Work

- Configure existing lights/materials before adding sources or geometry. Prefer stage-local changes to shared library defaults when solving a story-specific problem.
- Reduce excessive environment/hemisphere fill before compensating with more key light. Preserve readable shadow-side detail and physical cues such as metal, glass, and skin.
- Give primary subjects a distinct silhouette, value, depth, or motivated color relationship. Saturating the entire frame or increasing bloom does not establish a focal hierarchy.
- Keep emissive screens and practical lamps readable without making their brightest areas featureless. For an offscreen microscope/instrument view, inspect its own lights and materials as well as the room; the outer scene's exposure may not control its tone-mapped appearance.
- Protect the focal subject from particles, reflections, captions, and telemetry throughout its action. A rim light that highlights every background edge can compete with the subject.
- If lights/materials change by shot or absolute time, assign their full state on every update, including backward seeks. A lighting comparison must preserve deterministic frames.
- Lens and grade tools live in the shot binding's `post` (FilmPipeline): `ao`/`aoRadius` ground objects with contact shadows, `dof` (focus distance, m) separates a subject from a busy background, `shafts` needs the stage's `sunDirection`, `tonemap: "agx"` keeps fire, suns and disks from clipping to flat white, `shadowTint`/`highlightTint` split-tone, `shutter` sets motion-blur length per shot (0 for a crisp freeze). AO, depth of field and shafts need `delivery.render_quality` `cinematic` or `draft`. Exclude geometry whose vertex shader deforms it from depth effects (`userData.noDepthFx`) if it smears.

## Review

Inspect matching before/after frames and a moving excerpt, first without overlays and then with the normal HUD/captions. Review at phone size as well as full resolution.

Check the setup, peak action, completed state, and cut boundaries. The important object must remain identifiable, its change readable, and its surface/form cues intact. Look for clipped highlights, muddy shadows, competing practicals, reflective glare, disappearing skin/hand contours, and particles hiding the event.

Keep improvements that visibly establish the intended hierarchy. Fix any newly lost information and recheck the affected excerpt. Brightness statistics can identify clipping or lost detail; they do not establish artistic quality or retention. Record limitations and avoid claiming an audio/performance improvement from a lighting-only comparison.
