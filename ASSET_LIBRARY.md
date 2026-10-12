# Reusable Three.js Asset Library

Registry source of truth: `assets/registry.json`. Only verified, genuinely reusable source files are registered.
Coding agents should search IDs/tags here **before** creating new geometry, shaders, camera rigs or audio.

| Asset ID | Purpose | Location | Created for | Used in | License |
|---|---|---|---|---|---|
| `air-molecules-v1` | Schematic air molecules | `src/library/diagram/AirMolecules.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `airliner-v1` | Unbranded twin-engine airliner with contrails | `src/library/vehicles/Airliner.ts` | `oxygen-gone-five-seconds` | `oxygen-gone-five-seconds` | original_procedural |
| `audio-synth-kit-v1` | Procedural audio synthesis kit | `src/library/audio/synth.mjs` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_code |
| `bird-flock-v1` | Instanced flapping birds | `src/library/creatures/BirdFlock.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `oxygen-gone-five-seconds` | original_procedural |
| `bokeh-field-v1` | Soft bokeh light discs | `src/library/fx/BokehField.ts` | `ice-sank-instead-of-floating` | `air-pressure-doubled`, `ice-sank-instead-of-floating` | original_procedural |
| `bubble-stream-v1` | Exhalation bubble stream | `src/library/fx/BubbleStream.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `camera-keyframe-rig-v1` | Storyboard keyframe camera rig | `src/library/camera/KeyframeRig.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_code |
| `caption-kinetic-v1` | Kinetic burned-in captions | `src/library/captions/KineticCaptions.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_code |
| `cloud-deck-v1` | Cloud-top layer seen from above | `src/library/environment/CloudDeck.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `oxygen-gone-five-seconds` | original_procedural |
| `conifer-stand-v1` | Instanced conifers with snow load | `src/library/environment/ConiferStand.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | original_procedural |
| `cooking-pot-v1` | Cooking pot with boiling water | `src/library/props/CookingPot.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `dial-gauge-v1` | Analog dial gauge | `src/library/props/DialGauge.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `earth-globe-v1` | Earth globe with atmosphere, clouds and city lights | `src/library/planet/Earth.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_code; textures NASA public domain (see earth-textures-nasa-v1) |
| `earth-seaice-mask-nasa-v1` | NASA-derived floating sea-ice mask | `assets/library/textures/earth/seaice_4k.png` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | public_domain_nasa |
| `earth-textures-nasa-v1` | NASA Earth texture set (day, night lights, clouds, land mask) | `assets/library/textures/earth/day_8k.jpg` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | public_domain_nasa |
| `film-pipeline-v1` | Deterministic film render pipeline | `src/library/render/FilmPipeline.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_code |
| `fish-school-v1` | Instanced fish school | `src/library/creatures/FishSchool.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_procedural |
| `flame-v1` | Procedural flame billboard | `src/library/fx/Flame.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `oxygen-gone-five-seconds` | original_procedural |
| `font-inter-v1` | Inter typeface (Medium, SemiBold, Bold) | `assets/library/fonts/Inter-SemiBold.woff2` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | SIL Open Font License 1.1 |
| `gas-burner-v1` | Gas hob burner | `src/library/props/GasBurner.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `glass-of-water-v1` | Glass of water with ice cubes | `src/library/props/GlassOfWater.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | original_procedural |
| `grass-field-v1` | Wind-bent grass field | `src/library/environment/GrassField.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `humanoid-figure-v1` | Procedural articulated human figure | `src/library/characters/Humanoid.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_procedural |
| `ice-sheet-v1` | Floating ice sheet (top and underside) | `src/library/environment/IceSheet.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | original_procedural |
| `ocean-surface-v1` | Open-water ocean surface | `src/library/environment/OceanSurface.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_procedural |
| `overlay-labels-v1` | Schematic label and callout helpers | `src/library/overlay/Labels.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_code |
| `penguin-colony-v1` | Emperor penguin colony | `src/library/creatures/PenguinColony.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | original_procedural |
| `plastic-bottle-v1` | Crumpling plastic bottle | `src/library/props/PlasticBottle.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `sailboat-v1` | Sailboat (sloop) | `src/library/vehicles/Sailboat.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `scuba-gear-v1` | Scuba gear for the humanoid | `src/library/characters/ScubaGear.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `sea-ice-v1` | Sea-ice floes, fast-ice platform and tabular iceberg | `src/library/environment/SeaIce.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | original_procedural |
| `shader-noise-math-v1` | Shared shader noise and deterministic math | `src/library/util/glsl.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_code |
| `sky-dome-v1` | Gradient sky dome with sun and haze | `src/library/environment/SkyDome.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_procedural |
| `smoke-wisp-v1` | Rising smoke ribbon | `src/library/fx/SmokeWisp.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_procedural |
| `snowfall-v1` | Wrapped particle fall (snow or sinking crystals) | `src/library/fx/Snowfall.ts` | `ice-sank-instead-of-floating` | `air-pressure-doubled`, `ice-sank-instead-of-floating` | original_procedural |
| `starfield-v1` | Seeded starfield | `src/library/space/Starfield.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_procedural |
| `terrain-massif-v1` | Fractal mountain massif with altitude contour | `src/library/environment/Terrain.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_procedural |
| `underwater-volume-v1` | Shallow underwater environment | `src/library/environment/Underwater.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds` | original_procedural |
| `water-molecules-v1` | Schematic water molecules: liquid to ice lattice | `src/library/diagram/WaterMolecules.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | original_procedural |

## Reuse instructions

### `air-molecules-v1` — Schematic air molecules

Instanced schematic gas sample: N2 and O2 dumbbells, argon atoms and O=C=O molecules filling a box from seeded stratified slots, with thermal jitter and spin. A density control shows density x count molecules, popping extra molecules in at empty slots so a doubling reads as the same space holding twice as many.

**Tags:** molecules, air, atmosphere, nitrogen, oxygen, co2, argon, schematic, diagram, density, pressure
**Parameters:** size, count, maxDensity, composition, scale, jitter, speed, seed, colors, topFade, setGlow(species,amount), density, fade, time_s
**Notes:** Always label as schematic: molecules are enlarged and far sparser than real air. Composition defaults to real dry-air number fractions.

### `airliner-v1` — Unbranded twin-engine airliner with contrails

Procedural narrow-body airliner (lathe fuselage with window band, swept wings, winglets, tail, nacelles, exhaust glow, navigation lights). Contrail ribbons are gated by emission time so an engine cut leaves a physically consistent gap.

**Tags:** aircraft, airliner, plane, aviation, contrails, vehicle
**Parameters:** length, paintColor, accentColor, contrailLength, contrails, sunColor, engineGlow, airspeed, cutStart, cutEnd, time_s
**Notes:** Flies toward local -Z. Add both group and contrailGroup to the scene; contrails stay level while the aircraft pitches or sinks. No real airline livery.

### `audio-synth-kit-v1` — Procedural audio synthesis kit

Pure-JS deterministic audio toolkit: detuned additive pads, white/pink/brown noise, RBJ biquads with sweeps, Freeverb-style reverb, crackle generator, envelopes and stereo mix helpers for original music beds and sound effects.

**Tags:** audio, music, sfx, synthesis, soundtrack, reverb
**Parameters:** sampleRate, seed, freqs, attack, release, bright, detune, decay, mix, rate
**Notes:** Story cues live in src/stories/<slug>/soundtrack.mjs (export buildSoundtrack(duration) returning {music, sfx}); tools/soundtrack.mjs mixes them under the narration and loudness-normalises to the storyboard target.

### `bird-flock-v1` — Instanced flapping birds

Gull-like instanced birds with two-segment wing flapping in the vertex shader, translucent wing lighting, and controllable sink and pitch for lift-loss or soaring shots.

**Tags:** birds, gulls, animal, sky, flock, flight
**Parameters:** count, seed, spread, wingspan, bodyColor, wingColor, tipColor, sunDirection, sunColor, ambient, center, heading, sink, pitch, flapPhase, time_s, glide
**Notes:** Pass an analytic flap phase (integral of flap frequency) so rate changes stay smooth and deterministic. air-pressure-doubled added glide (0..1) to hold wings in a gliding pose; default 0 leaves earlier shots unchanged.

### `bokeh-field-v1` — Soft bokeh light discs

Field of edge-bright out-of-focus discs for macro, interior and night-city backgrounds, with a dim control that switches discs off in seeded order.

**Tags:** bokeh, lights, background, macro, interior, fx
**Parameters:** count, seed, center, extent, colors, size, gain, dim, time_s
**Notes:** Additive; keep gain low over bright backdrops. Disc size is in pixels for 1080-wide output.

### `bubble-stream-v1` — Exhalation bubble stream

Periodic bursts of bubbles from an emitter that wobble, spread, accelerate gently and swell by Boyle's law as the water pressure falls toward the surface; placed statelessly from the burst schedule.

**Tags:** bubbles, underwater, diver, fx, particles, boyle
**Parameters:** period, perBurst, bursts, spread, riseSpeed, size, surfaceY, surfacePressure, seed, emitter, t0, time_s
**Notes:** surfacePressure is in atmospheres (1 = today, 2 = doubled air) and only affects the Boyle growth factor.

### `camera-keyframe-rig-v1` — Storyboard keyframe camera rig

Applies storyboard camera keyframes (position, look_at, ease, FOV) to a perspective camera at any absolute time, clamping outside the span so shots can be evaluated early or late for dissolves.

**Tags:** camera, keyframes, animation, storyboard
**Parameters:** keyframes, fov_or_scale, ease, time_s
**Notes:** For smooth pans between a near and a far subject, author look_at points at similar distances along the line of sight.

### `caption-kinetic-v1` — Kinetic burned-in captions

Word-timed caption renderer for a 2D canvas: clause-aware phrase splitting, two balanced lines, active-word accent and accent_color / gentle_scale / subtle_glow emphasis, outline, shadow and a soft backdrop band.

**Tags:** captions, subtitles, typography, overlay, accessibility
**Parameters:** fontFamily, fontWeight, fontSize, lineHeight, maxCharsPerLine, baselineY, centerX, maxWidth, fill, accent, accentSoft, stroke, strokeWidth, backdrop, emphasis
**Notes:** Feed it word timings from tools/narrate.mjs (real synthesized audio aligned with local Whisper), never guessed timings.

### `cloud-deck-v1` — Cloud-top layer seen from above

Large plane with domain-warped fractal cloud density, directional self-shadowing, gaps to a below colour and horizon haze; scroll offsets convey flight over the deck.

**Tags:** clouds, sky, aerial, weather, aircraft
**Parameters:** size, level, scale, coverage, sunDirection, sunColor, shadowColor, belowColor, hazeColor, hazeDensity, scrollX, scrollZ, time_s
**Notes:** update(time_s, scrollX, scrollZ) in metres.

### `conifer-stand-v1` — Instanced conifers with snow load

Instanced stylised conifers (tiered cones on a trunk) with snow painted on upward-facing outer surfaces, plus a seeded scatter helper.

**Tags:** trees, forest, conifer, winter, snow, vegetation
**Parameters:** positions, seed, minHeight, maxHeight, color, trunkColor, snow, snowColor, scatterTrees(count,seed,area,y,reject)
**Notes:** Mid-ground and background use; tree shapes are simple, so keep them beyond about 30 m from the camera.

### `cooking-pot-v1` — Cooking pot with boiling water

Brushed stainless pot with riveted handles and water: transmissive surface with ripples and boiling bumps, and a stateless bubble pool (small nucleation streams, then large rolling-boil bubbles) controlled by a boil value.

**Tags:** pot, kitchen, cooking, water, boiling, bubbles, prop
**Parameters:** radius, height, waterLevel, seed, bubbles, metalColor, boil, time_s
**Notes:** boil: 0 still, ~0.2 a few bubbles, 1 rolling boil. Pair with smoke-wisp-v1 for steam and gas-burner-v1 underneath. Needs a reasonably bright environment map for the steel to read as stainless.

### `dial-gauge-v1` — Analog dial gauge

Barometer / thermometer / pressure gauge with a canvas-drawn face (ticks, labels, unit, title, coloured marks), brass, steel or black bezel, glass cover, tapered needle and an optional probe stem. Face points along +Z.

**Tags:** gauge, dial, barometer, thermometer, pressure, instrument, prop
**Parameters:** radius, min, max, arcDegrees, majorStep, minorStep, labelStep, unit, title, marks, bezel, faceColor, inkColor, needleColor, depth, stemLength, stemRadius, value, angleDeg(value)
**Notes:** value is a plain setter, so drive it from a deterministic function of time. Clockwise = increasing, scale centred on 12 o'clock.

### `earth-globe-v1` — Earth globe with atmosphere, clouds and city lights

Earth sphere using the shared NASA texture set: Blue Marble day map, Black Marble night lights, drifting cloud layer with soft shadows, ocean sun glint from a land mask, warm terminator and an additive atmospheric rim shell. Supports regional night-light outages for illustrative blackout shots.

**Tags:** earth, planet, globe, space, orbit, atmosphere, clouds, night-lights, blackout
**Parameters:** radius, sunDirection, cloudOpacity, atmosphereStrength, atmosphereColor, nightLights, scatter, nightOutage, outageSeed, outageScale, spinRate, cloudDrift, setView(lon,lat), time_s, seaIce
**Notes:** Radius 1 unit by default. Load textures once with loadEarthTextures(base). setView(lon, lat) turns a geographic point toward +Z; update(time_s) is linear in time. scatter scales the limb glow (1 = normal air). Added for ice-sank-instead-of-floating: optional seaIce texture (earth-seaice-mask-nasa-v1) and a seaIce 0..1 setter; default 0 leaves earlier videos unchanged.

### `earth-seaice-mask-nasa-v1` — NASA-derived floating sea-ice mask

Equirectangular 4096x2048 mask (white = sea ice floating on ocean, land masked out) derived from NASA Blue Marble 2002 land/ocean/ice imagery, for the seaIce parameter of earth-globe-v1.

**Tags:** earth, texture, nasa, sea-ice, arctic, antarctic, polar
**Parameters:** 
**Notes:** Built by py -3.14 scripts/build_earth_textures.py --only seaice. Credit: NASA Goddard Space Flight Center, Blue Marble 2002 (R. Stockli). Load with loadEarthTextures(base, anisotropy, { seaIce: true }).

### `earth-textures-nasa-v1` — NASA Earth texture set (day, night lights, clouds, land mask)

Equirectangular maps (longitude -180..180 left to right): day_8k.jpg (Blue Marble Next Generation, June 2004, topography + bathymetry), night_8k.jpg (Black Marble 2016), clouds_8k.jpg (Blue Marble clouds, grayscale), landmask_4k.png (land = white).

**Tags:** earth, texture, nasa, blue-marble, black-marble, clouds, land-mask
**Parameters:** 
**Notes:** Built by scripts/build_earth_textures.py (py -3.14, numpy + Pillow) from asset-sources/raw. Credit requested by NASA: NASA Earth Observatory / NASA GSFC Blue Marble (R. Stockli), Black Marble 2016 (J. Stevens, M. Roman), land mask derived from GEBCO_08 via NASA EO. Provenance and hashes: asset-sources/sources.lock.json. A companion sea-ice mask now lives beside these files (see earth-seaice-mask-nasa-v1).

### `film-pipeline-v1` — Deterministic film render pipeline

Storyboard-driven frame renderer: shot lookup, keyframe cameras, HDR MSAA scene buffer, bloom, ACES grade, vignette, deterministic grain, cross-dissolves, 2D label overlay and caption compositing. renderFrame(i) depends only on i.

**Tags:** render, pipeline, post-processing, bloom, transition, deterministic
**Parameters:** width, height, fps, duration_s, scale, exposure, bloomStrength, bloomRadius, bloomThreshold, vignette, grain, saturation, contrast, lift, tint
**Notes:** Workflow for a new story: add src/stories/<slug>/film.ts (createFilm) and register it in src/entry.ts; then run node tools/narrate.mjs stories/<slug>.json, node tools/soundtrack.mjs <slug>, node tools/render.mjs <slug> --frames a,b,c for smoke frames and --final for the MP4. ffmpeg and ffprobe come from the ffmpeg-static and ffprobe-static npm packages. air-pressure-doubled added a sanitize pass before bloom that zeroes NaN/Inf scene pixels so a single bad pixel cannot bloom into a black block; valid pixels are unchanged.

### `fish-school-v1` — Instanced fish school

Instanced silver fish with shader tail beat and countershading; each fish keeps a seeded offset around a moving school centre with slow wander.

**Tags:** fish, animal, ocean, underwater, school, marine-life
**Parameters:** count, seed, length, spread, color, backColor, fogColor, fogDensity, lightDirection, center, heading, time_s, setSpread(spread)
**Notes:** update(time_s, center, heading): the caller supplies the school path, keeping this asset free of story timing. setSpread changes the school extents at runtime (for example to crowd the fish).

### `flame-v1` — Procedural flame billboard

Additive teardrop flame shader on a Y-axis billboard with blue base, hot core and noise-driven sway. An intensity parameter shortens and fades it, so flames can be extinguished and reignited deterministically.

**Tags:** fire, flame, candle, campfire, match, combustion, fx
**Parameters:** width, height, turbulence, speed, brightness, blueBase, colorCore, colorMid, colorTip, colorBase, seed, intensity, time_s
**Notes:** turbulence 0.1 = candle, 0.9 = campfire. Layer several with different seeds for a large fire. Outputs HDR values intended for bloom. Also used inside gas-burner-v1 for blue gas jets.

### `font-inter-v1` — Inter typeface (Medium, SemiBold, Bold)

Latin subsets of Inter at weights 500, 600 and 700 for captions and labels.

**Tags:** font, typography, captions, inter
**Parameters:** 
**Notes:** Inter by Rasmus Andersson, copied from the @fontsource/inter npm package; licence text in assets/library/fonts/Inter-OFL.txt. Glyphs outside the Latin subset fall back to the system font.

### `gas-burner-v1` — Gas hob burner

Domestic gas burner: enamel cap, aluminium head, four-arm cast-iron grate and a ring of small blue flame jets built on flame-v1, each billboarding about its own jet axis toward the camera, plus a soft blue point light.

**Tags:** gas, burner, stove, hob, kitchen, flame, fire, combustion
**Parameters:** radius, jets, flameHeight, grate, brightness, seed, intensity, time_s
**Notes:** Origin at the hob surface; grateTop gives the height a pot sits at. intensity 0 shows a cold burner.

### `glass-of-water-v1` — Glass of water with ice cubes

Tumbler with a transmissive glass shell and water volume, a visible waterline, frosted ice cubes and small bubbles. A single sink value moves the cubes between floating (about a tenth above the waterline) and resting on the bottom, staggered per cube.

**Tags:** glass, water, ice, kitchen, macro, prop, density
**Parameters:** radius, baseRadius, height, waterLevel, cubes, cubeSize, waterTint, seed, sink, bubbleAge, time_s
**Notes:** Units are metres. Needs scene.environment (for example sky-dome-v1 toEnvironment) for convincing reflections; glass and water use three.js physical transmission, so objects behind them must be opaque to appear refracted.

### `grass-field-v1` — Wind-bent grass field

Instanced grass blades over any ground function with a rejection test, bent along a circular arc by a force-proportional wind bend, travelling gusts and flutter; wrap and back-light shading, flower-tipped blades, distance fog and a relight setter for other times of day.

**Tags:** grass, meadow, turf, vegetation, wind, field, cliff, nature
**Parameters:** area, count, ground, reject, minHeight, maxHeight, width, baseColor, tipColor, dryColor, flowerFraction, flowerColor, sunDirection, sunColor, skyColor, fogColor, fogDensity, seed, wind.bend, wind.direction, wind.gust, wind.gustSpeed, setLight(), time_s
**Notes:** Doubling wind.bend shows a wind that pushes twice as hard (small-angle approximation). Grass does not receive shadows; the ground under it does.

### `humanoid-figure-v1` — Procedural articulated human figure

Adult figure built from capsules and spheres with a joint hierarchy, standing and seated base poses, pose interpolation and two-bone arm IK (reachArm). Intended for respectful mid-distance, back-view and silhouette shots.

**Tags:** human, person, character, figure, silhouette, people
**Parameters:** height, coatColor, trouserColor, skinColor, hairColor, shoeColor, scarfColor, coat, hat, pose, reachArm(side,target,pole,weight), backAnchor, waistAnchor, footL, footR
**Notes:** Faces +Z, origin at the feet. Stylised: avoid facial close-ups. Exposes head, chestAnchor and hand anchors for effects. air-pressure-doubled added empty gear anchors (back, waist, feet) and a guard in reachArm for a pole parallel to the reach direction (previously NaN).

### `ice-sheet-v1` — Floating ice sheet (top and underside)

Lake or sea ice lid with a snow-dusted, cracked, reflective top surface and a softly glowing underside whose brightness follows snow cover, cracks and trapped bubbles. A moving soft shadow can be projected onto the underside.

**Tags:** ice, lake, winter, frozen, under-ice, polar, snow
**Parameters:** size, thickness, snowAmount, seed, horizonColor, zenithColor, sunDirection, sunColor, fogColor, fogDensity, underFogColor, underFogDensity, transmission, setShadow(x,z,radius,strength), time_s
**Notes:** Top surface at local y = 0. The custom shader does not receive shadow maps; add a blob shadow mesh for figures standing on it. Pair the underside with underwater-volume-v1 (hide that asset's own surface).

### `ocean-surface-v1` — Open-water ocean surface

Flat-plane ocean with analytic multi-octave travelling-wave normals, Fresnel sky reflection, sun glitter and distance haze. Suited to eye-level and aerial views of calm to moderate seas.

**Tags:** ocean, sea, water, coast, waves
**Parameters:** size, level, deepColor, horizonColor, zenithColor, sunDirection, sunColor, waveHeight, waveScale, fogColor, fogDensity, glitter, skyScale, time_s
**Notes:** Keep horizon and zenith colours in step with the scene sky dome. No vertex displacement, so avoid extreme close-ups of the surface.

### `overlay-labels-v1` — Schematic label and callout helpers

2D canvas helpers for SCHEMATIC / ILLUSTRATIVE tags, status chips, leader-line callouts that flip to stay inside the frame, and rich text with numeric subscripts (O_2 style).

**Tags:** labels, overlay, callout, schematic, typography
**Parameters:** size, weight, color, alpha, tracking, align, accent, dot, valueColor, sub
**Notes:** Use projectToScreen() from film-pipeline-v1 to anchor labels to 3D points.

### `penguin-colony-v1` — Emperor penguin colony

Instanced vertex-coloured emperor penguins (adults with yellow ear patches, grey downy chicks beside them) with a gentle deterministic sway and shuffle.

**Tags:** penguin, animal, antarctic, wildlife, colony, birds
**Parameters:** adults, chicks, seed, spread, height, time_s
**Notes:** Stand the group on a flat surface at its local y = 0. Designed for mid-distance shots (birds about 100–250 px tall).

### `plastic-bottle-v1` — Crumpling plastic bottle

Clear PET bottle (ribbed lathe shell with physical transmission, ribbed screw cap, optional label band). A crumple value caves the walls in along seeded concave faces, crossing folds and wrinkles until the inside volume is roughly halved, as a sealed bottle would under one extra atmosphere; base, neck and cap stay rigid.

**Tags:** bottle, plastic, pressure, altitude, crumple, prop, macro, kitchen
**Parameters:** height, radius, seed, tint, labelColor, capColor, crumple
**Notes:** Deformation and normals are computed in the vertex shader from the crumple value alone (values slightly above 1 give an overshoot). Negative crumple values are not supported; to show a bottle swelling at altitude, add a separate parameter rather than reusing crumple.

### `sailboat-v1` — Sailboat (sloop)

Small sloop: vertex-coloured hull with boot stripe and antifouling, deck and cabin, mast, boom, cambered mainsail and jib (or furled with a sail cover for moored boats), stays, heel and a seeded bob.

**Tags:** sailboat, boat, yacht, sailing, harbor, ocean, wind, vehicle
**Parameters:** length, hullColor, sailColor, deckColor, sails, seed, heel, bob, time_s
**Notes:** Local frame: bow +X, mast +Y, waterline y = 0, sails eased toward -Z (wind from +Z); positive heel leans toward -Z. Built for mid and far distances.

### `scuba-gear-v1` — Scuba gear for the humanoid

Diving kit that attaches to humanoid-figure-v1 anchors: aluminium tank with valve, buoyancy jacket and straps, weight belt, mask with glass, regulator with hose, and fins with foot pockets that continue the shin line (the figure's shoes are hidden).

**Tags:** scuba, diver, diving, underwater, gear, human, ocean
**Parameters:** tankColor, jacketColor, finColor, hoseColor, maskColor, regulatorWorld()
**Notes:** Rotate the figure root horizontal (e.g. Euler YXZ (pi/2, yaw, 0)) for swimming; regulatorWorld() feeds bubble-stream-v1. The hose is approximate for small head turns.

### `sea-ice-v1` — Sea-ice floes, fast-ice platform and tabular iceberg

Irregular snow-topped floes with blue-green flanks, an optional flat fast-ice platform and an optional tabular iceberg, all authored around a waterline at y = 0 with about a tenth of the ice above it.

**Tags:** sea-ice, iceberg, polar, arctic, antarctic, ocean, floes
**Parameters:** seed, floeCount, area, minRadius, maxRadius, thickness, platformRadius, iceberg, avoid, sink, sinkSpan, time_s
**Notes:** Use over ocean-surface-v1. update(time_s, sink) lowers pieces with staggered delays for melting or counterfactual shots.

### `shader-noise-math-v1` — Shared shader noise and deterministic math

GLSL value-noise and fbm chunks plus a fog helper (glsl.ts), with seeded RNG, value noise, fbm, ridged multifractal, easing and wobble helpers (math.ts) used by every library component.

**Tags:** noise, glsl, math, random, utility, shader
**Parameters:** seed, octaves, gain, lacunarity
**Notes:** Companion file: src/library/util/math.ts.

### `sky-dome-v1` — Gradient sky dome with sun and haze

Camera-centred gradient sky with sun disc, aureole and horizon haze. A scatter setter scales scattered skylight only, and toEnvironment() bakes a PMREM map so metals and clearcoat reflect the same sky.

**Tags:** sky, atmosphere, sun, dusk, night, environment, lighting
**Parameters:** zenithColor, horizonColor, groundColor, sunDirection, sunColor, sunSize, sunGlow, sunIntensity, hazeColor, hazeAmount, curve, scatter
**Notes:** Set sunIntensity and sunGlow to 0 for night or blue-hour skies. Pair the sun direction with a DirectionalLight.

### `smoke-wisp-v1` — Rising smoke ribbon

Thin camera-facing smoke ribbon whose front climbs with age while noise curls it sideways; for snuffed candles, dying fires, chimneys and vents.

**Tags:** smoke, fx, candle, fire, wisp
**Parameters:** height, baseWidth, topWidth, curl, riseSpeed, color, seed, age_s, opacity, time_s
**Notes:** update(time_s, age_s, opacity, camera): age_s <= 0 hides it.

### `snowfall-v1` — Wrapped particle fall (snow or sinking crystals)

Stateless wrapped particle fall for snow in air or ice crystals sinking through water, with optional tumbling glints and an amount control to start or stop the fall on cue.

**Tags:** snow, particles, weather, winter, crystals, fx
**Parameters:** count, seed, box, fallSpeed, drift, size, minPx, maxPx, color, brightness, additive, glint, far, amount, time_s
**Notes:** Move points.position to keep the volume around the camera. Sprite sizes are authored for 1080-wide output.

### `starfield-v1` — Seeded starfield

Point-sprite star shell with a power-law brightness distribution and blackbody-like tints; optional horizon cut-off for terrestrial night skies.

**Tags:** stars, space, night-sky, background
**Parameters:** seed, count, radius, brightness, maxSize, minY
**Notes:** Static by design; call follow(camera) each frame. Sprite sizes are authored in pixels for 1080-wide output.

### `terrain-massif-v1` — Fractal mountain massif with altitude contour

Seeded ridged-multifractal mountain that falls to sea level at its edges, vertex-coloured by altitude and slope (forest, rock, snow). setContour() draws a glowing iso-altitude line measured in real scene metres.

**Tags:** mountain, terrain, island, altitude, contour, landscape
**Parameters:** seed, width, depth, segmentsX, segmentsZ, peakHeight, snowLine, treeLine, contourColor, setContour(altitude,strength,width)
**Notes:** mesh.position.y is the base (sea) level. terrain.peak gives the summit in mesh-local coordinates for framing. Uses scene fog for aerial perspective.

### `underwater-volume-v1` — Shallow underwater environment

Complete shallow-sea set seen from below the surface: rippling Snell-window surface, camera-aligned sun shafts, caustic-lit sand and rocks, swaying seagrass, drifting particles and an optional bubble burst.

**Tags:** underwater, ocean, reef, sea, caustics, light-shafts, seagrass, bubbles
**Parameters:** depth, extent, waterColor, deepColor, surfaceColor, sunDirection, rayStrength, rayCount, causticScale, causticStrength, fogDensity, grassCount, particleCount, seed, setBubbleBurst(t0,origin), time_s, backdrop.visible, surface.visible
**Notes:** Surface at local y = 0. Exposes fogColor and fogDensity so other objects (for example fish-school-v1) can match the water. backdrop and surface meshes are now public so a stage can hide them above water or under an ice sheet. air-pressure-doubled guarded NaN-prone pow() calls in the shaft and caustic shaders and the floor normal.

### `water-molecules-v1` — Schematic water molecules: liquid to ice lattice

Instanced H2O molecules that morph between a jostling liquid and an open hexagonal ice lattice with hydrogen-bond lines. The liquid arrangement occupies about 9% less volume, matching real water.

**Tags:** water, ice, molecules, chemistry, schematic, diagram, lattice
**Parameters:** seed, cells, layers, bond, oxygenColor, hydrogenColor, bondColor, liquidScale, freeze, time_s
**Notes:** Always label as schematic and not to scale. halfSize gives the ice-state bounding box for outline boxes; view down +Z to reveal the hexagons.
