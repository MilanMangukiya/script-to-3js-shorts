# Reusable Three.js Asset Library

Registry source of truth: `assets/registry.json`. Only verified, genuinely reusable source files are registered.
Coding agents should search IDs/tags here **before** creating new geometry, shaders, camera rigs or audio.

| Asset ID | Purpose | Location | Created for | Used in | License |
|---|---|---|---|---|---|
| `air-molecules-v1` | Schematic air molecules | `src/library/diagram/AirMolecules.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `airliner-v1` | Unbranded twin-engine airliner with contrails | `src/library/vehicles/Airliner.ts` | `oxygen-gone-five-seconds` | `oxygen-gone-five-seconds` | original_procedural |
| `apartment-facade-v1` | Apartment facade | `src/library/environment/ApartmentFacade.ts` | `what-if-every-man-disappeared` | `earth-ten-percent-closer`, `what-if-every-man-disappeared` | original_procedural |
| `asteroids-v1` | Asteroids, asteroid fields and comet | `src/library/space/Asteroids.ts` | `manthan-quality-pass` |  | original_code |
| `atmosphere-scatter-sky-v1` | Altitude-aware scattering sky and planet backdrop | `src/library/environment/PlanetAtmosphere.ts` | `mountain-grew-100-km-tall` | `mountain-grew-100-km-tall` | original_procedural |
| `audio-synth-kit-v1` | Procedural audio synthesis kit | `src/library/audio/synth.mjs` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_code |
| `aurora-curtains-v1` | Aurora curtains | `src/library/environment/AuroraCurtains.ts` | `earth-core-solid` | `earth-core-solid` | original_procedural |
| `banded-cloud-shell-v1` | Rotation-banded cloud shell | `src/library/planet/BandedCloudShell.ts` | `earth-six-hour-day` |  | original_procedural |
| `bathroom-scale-v1` | Mechanical bathroom scale | `src/library/props/BathroomScale.ts` | `earth-six-hour-day` |  | original_procedural |
| `beach-set-v1` | Beach set dressing: parasol and towels | `src/library/props/BeachSet.ts` | `earth-six-hour-day` |  | original_procedural |
| `bird-flock-v1` | Instanced flapping birds | `src/library/creatures/BirdFlock.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `earth-core-solid`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `what-if-every-man-disappeared` | original_procedural |
| `black-hole-sky-v1` | Gravitationally lensing black hole (sky shader) | `src/library/space/BlackHole.ts` | `manthan-quality-pass` |  | original_code |
| `bokeh-field-v1` | Soft bokeh light discs | `src/library/fx/BokehField.ts` | `ice-sank-instead-of-floating` | `air-pressure-doubled`, `earth-core-solid`, `ice-sank-instead-of-floating`, `moon-made-of-ice`, `rain-nonstop-everywhere`, `what-if-every-man-disappeared` | original_procedural |
| `broadleaf-tree-v1` | Broadleaf street tree | `src/library/environment/BroadleafTree.ts` | `what-if-every-man-disappeared` | `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-volcano-erupts-at-once`, `everyone-farts-at-once`, `penny-doubled-30-days`, `what-if-every-man-disappeared` | original_procedural |
| `bubble-stream-v1` | Exhalation bubble stream | `src/library/fx/BubbleStream.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `building-kit-v1` | Building kit with interior-mapped windows | `src/library/environment/BuildingKit.ts` | `earth-six-hour-day` |  | original_procedural |
| `camera-keyframe-rig-v1` | Storyboard keyframe camera rig | `src/library/camera/KeyframeRig.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_code |
| `caption-kinetic-v1` | Kinetic burned-in captions | `src/library/captions/KineticCaptions.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_code |
| `center-of-mass-recoil-diagram-v1` | Center Of Mass Recoil Diagram | `src/library/diagram/CenterOfMassRecoil.ts` | `every-human-jumped-at-once` | `every-human-jumped-at-once` | original_procedural |
| `character-motion-v1` | Grounded character acting and straight-path locomotion | `src/library/characters/CharacterMotion.ts` | `last-woman-alive` | `earth-1000f-five-seconds`, `earth-without-tilt`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `last-woman-alive`, `ozone-layer-gone-overnight`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth` | original_code |
| `city-damage-map-v1` | 3D tactical metropolitan damage & survival radius map | `src/library/diagram/CityDamageMap.ts` | `coin-black-hole-city` |  | original_procedural |
| `city-kit-v1` | City kit: streets, lamps, cars, crowds | `src/library/environment/CityKit.ts` | `earth-six-hour-day` |  | original_procedural |
| `city-street-block-v1` | Detailed city street and aerial district | `src/library/environment/CityStreet.ts` | `what-if-every-man-disappeared` | `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `last-man-alive`, `last-woman-alive`, `mountain-grew-100-km-tall`, `ozone-layer-gone-overnight`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_procedural |
| `clinic-interior-v1` | Clinic interior | `src/library/environment/ClinicInterior.ts` | `what-if-every-man-disappeared` | `every-human-jumped-at-once`, `last-man-alive`, `last-woman-alive`, `what-if-every-man-disappeared` | original_procedural |
| `cloud-ceiling-v1` | Overcast cloud base seen from below | `src/library/environment/CloudCeiling.ts` | `rain-nonstop-everywhere` | `continents-one-landmass`, `rain-nonstop-everywhere` | original_procedural |
| `cloud-deck-v1` | Cloud-top layer seen from above | `src/library/environment/CloudDeck.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `oxygen-gone-five-seconds`, `what-if-every-man-disappeared` | original_procedural |
| `coin-pile-v1` | Procedural coin pile | `src/library/props/CoinPile.ts` | `penny-doubled-30-days` | `penny-doubled-30-days` | original_code |
| `compass-v1` | Brass pocket compass | `src/library/props/Compass.ts` | `earth-core-solid` | `earth-core-solid` | original_procedural |
| `conifer-stand-v1` | Instanced conifers with snow load | `src/library/environment/ConiferStand.ts` | `ice-sank-instead-of-floating` | `earth-core-solid`, `ice-sank-instead-of-floating` | original_procedural |
| `container-ship-v1` | Container ship | `src/library/vehicles/ContainerShip.ts` | `what-if-every-man-disappeared` | `last-man-alive`, `what-if-every-man-disappeared` | original_procedural |
| `cooking-pot-v1` | Cooking pot with boiling water | `src/library/props/CookingPot.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `coral-mounds-v1` | Procedural coral heads | `src/library/environment/CoralMounds.ts` | `continents-one-landmass` | `continents-one-landmass` | original_procedural |
| `crowd-field-v1` | Crowd Field | `src/library/characters/CrowdField.ts` | `every-human-jumped-at-once` | `every-human-jumped-at-once` | original_procedural |
| `crowd-kit-v1` | Diverse animated crowds (casting, accessories, behaviours) | `src/library/characters/CrowdKit.ts` | `manthan-quality-pass` | `rogue-planet-between-earth-mars` | original_code |
| `dairy-cow-v1` | Procedural dairy cow | `src/library/characters/Cow.ts` | `everyone-farts-at-once` | `everyone-farts-at-once` | original_code |
| `day-cycle-dial-v1` | Day-cycle dial overlay | `src/library/overlay/DayCycleDial.ts` | `earth-six-hour-day` |  | original_procedural |
| `dial-gauge-v1` | Analog dial gauge | `src/library/props/DialGauge.ts` | `air-pressure-doubled` | `air-pressure-doubled`, `continents-one-landmass`, `earth-ten-percent-closer`, `every-human-jumped-at-once`, `moon-made-of-ice`, `ozone-layer-gone-overnight`, `rain-nonstop-everywhere` | original_procedural |
| `dog-v1` | Procedural dog | `src/library/characters/Dog.ts` | `everyone-sneezes-at-once` | `everyone-sneezes-at-once` | original_code |
| `dry-soil-v1` | PBR desiccating soil | `src/library/environment/DrySoil.ts` | `earth-ten-percent-closer` | `earth-ten-percent-closer` | original_procedural |
| `dune-field-v1` | Procedural sand dune sea | `src/library/environment/DuneField.ts` | `rain-nonstop-everywhere` | `continents-one-landmass`, `earth-ten-percent-closer`, `rain-nonstop-everywhere` | original_procedural |
| `dung-beetle-v1` | Walking dung beetle | `src/library/creatures/DungBeetle.ts` | `moon-made-of-ice` | `moon-made-of-ice` | original_procedural |
| `earth-globe-v1` | Earth globe with atmosphere, clouds and city lights | `src/library/planet/Earth.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_code; textures NASA public domain (see earth-textures-nasa-v1) |
| `earth-seaice-mask-nasa-v1` | NASA-derived floating sea-ice mask | `assets/library/textures/earth/seaice_4k.png` | `ice-sank-instead-of-floating` | `earth-ten-percent-closer`, `ice-sank-instead-of-floating` | public_domain_nasa |
| `earth-textures-nasa-v1` | NASA Earth texture set (day, night lights, clouds, land mask) | `assets/library/textures/earth/day_8k.jpg` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sun-locked-earth`, `what-if-every-man-disappeared` | public_domain_nasa |
| `end-card-v1` | End-hook card overlay | `src/library/overlay/EndCard.ts` | `earth-six-hour-day` |  | original_procedural |
| `energy-kit-v1` | Wind turbines, pylons and power lines | `src/library/environment/EnergyKit.ts` | `manthan-quality-pass` |  | original_code |
| `eruption-column-v1` | Eruption column, umbrella cloud and pyroclastic flow | `src/library/fx/AshCloud.ts` | `every-volcano-erupts-at-once` | `every-volcano-erupts-at-once`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `penny-doubled-30-days` | original_code |
| `explosion-v1` | Explosion fireball, shock shell and dust ring | `src/library/fx/Explosion.ts` | `manthan-quality-pass` |  | original_code |
| `film-pipeline-v1` | Deterministic film render pipeline | `src/library/render/FilmPipeline.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_code |
| `fireworks-v1` | GPU fireworks show | `src/library/fx/Fireworks.ts` | `manthan-quality-pass` |  | original_code |
| `fish-school-v1` | Instanced fish school | `src/library/creatures/FishSchool.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-core-solid`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds`, `what-if-every-man-disappeared` | original_procedural |
| `flame-v1` | Procedural flame billboard | `src/library/fx/Flame.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `earth-1000f-five-seconds`, `earth-without-tilt`, `oxygen-gone-five-seconds`, `what-if-every-man-disappeared` | original_procedural |
| `font-display-set-v1` | Display fonts for thumbnails | `assets/library/fonts/display/FONTS.md` | `rain-nonstop-everywhere` | `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth` | SIL Open Font License 1.1 |
| `font-inter-v1` | Inter typeface (Medium, SemiBold, Bold) | `assets/library/fonts/Inter-SemiBold.woff2` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | SIL Open Font License 1.1 |
| `gas-burner-v1` | Gas hob burner | `src/library/props/GasBurner.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `gas-giant-v1` | Banded gas giant (rogue planet or Jupiter-like world) | `src/library/planet/GasGiant.ts` | `rogue-planet-between-earth-mars` | `rogue-planet-between-earth-mars` | original_code |
| `giant-peak-v1` | Planetary-scale mountain (km, curved planet) | `src/library/environment/GiantPeak.ts` | `mountain-grew-100-km-tall` | `mountain-grew-100-km-tall` | original_procedural |
| `glass-of-water-v1` | Glass of water with ice cubes | `src/library/props/GlassOfWater.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating`, `mountain-grew-100-km-tall`, `rain-nonstop-everywhere` | original_procedural |
| `grass-field-v1` | Wind-bent grass field | `src/library/environment/GrassField.ts` | `air-pressure-doubled` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-volcano-erupts-at-once`, `everyone-farts-at-once`, `moon-made-of-ice`, `rain-nonstop-everywhere`, `what-if-every-man-disappeared` | original_procedural |
| `grass-field-v2` | Lush grass field v2 with wildflowers | `src/library/environment/LushGrass.ts` | `earth-six-hour-day` |  | original_procedural |
| `harbour-basin-v1` | Stone harbour basin with tide-aware moored boats | `src/library/environment/HarbourBasin.ts` | `rogue-planet-between-earth-mars` | `rogue-planet-between-earth-mars` | original_code |
| `hdri-environments-v1` | HDRI sky environments (CC0) | `assets/library/polyhaven.manifest.json` | `earth-six-hour-day` |  | CC0 1.0 (Poly Haven HDRIs; provenance lock) |
| `history-ribbon-v1` | Historical data ribbon | `src/library/diagram/HistoryRibbon.ts` | `what-if-every-man-disappeared` | `what-if-every-man-disappeared` | original_procedural |
| `horn-coral-v1` | Rugose horn corals | `src/library/environment/HornCorals.ts` | `earth-six-hour-day` |  | original_procedural |
| `human-figure-v2` | HumanV2 sculpted, skinned people | `src/library/characters/HumanV2.ts` | `earth-six-hour-day` | `rogue-planet-between-earth-mars` | original_procedural |
| `humanoid-figure-v1` | Procedural articulated human figure | `src/library/characters/Humanoid.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_procedural |
| `ice-sheet-v1` | Floating ice sheet (top and underside) | `src/library/environment/IceSheet.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | original_procedural |
| `insect-swarm-v1` | Butterflies, bees and fireflies | `src/library/creatures/InsectSwarm.ts` | `manthan-quality-pass` |  | original_code |
| `interior-kit-v1` | Interior dressing kit | `src/library/environment/InteriorKit.ts` | `earth-six-hour-day` |  | original_procedural |
| `light-beam-v1` | Soft volumetric light beam | `src/library/fx/LightBeam.ts` | `earth-six-hour-day` |  | original_procedural |
| `lighthouse-v1` | Coastal lighthouse with sweeping beams | `src/library/environment/Lighthouse.ts` | `earth-six-hour-day` |  | original_procedural |
| `lightning-v1` | Forked lightning with flash | `src/library/fx/Lightning.ts` | `manthan-quality-pass` |  | original_code |
| `loft-helpers-v1` | Organic loft and limb modeling helpers | `src/library/util/Loft.ts` | `manthan-quality-pass` |  | original_code |
| `magnetic-field-lines-v1` | Dipole magnetic field lines | `src/library/space/MagneticFieldLines.ts` | `earth-core-solid` | `earth-core-solid` | original_procedural |
| `meteor-streaks-v1` | Meteor streaks with ionisation trains | `src/library/fx/MeteorStreaks.ts` | `mountain-grew-100-km-tall` | `mountain-grew-100-km-tall` | original_procedural |
| `milky-way-sky-v1` | Milky Way and deep star field sky | `src/library/space/MilkyWay.ts` | `manthan-quality-pass` | `rogue-planet-between-earth-mars` | original_code |
| `modeling-helpers-v1` | Procedural modeling helpers | `src/library/util/Modeling.ts` | `what-if-every-man-disappeared` | `earth-1000f-five-seconds`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `last-man-alive`, `last-woman-alive`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_procedural |
| `moon-body-v1` | Procedural rocky and icy Moon | `src/library/planet/Moon.ts` | `moon-made-of-ice` | `moon-made-of-ice`, `rogue-planet-between-earth-mars` | original_procedural |
| `nature-kit-v1` | Boulders, rock scatter, shrubs, flowers, cacti | `src/library/environment/NatureKit.ts` | `manthan-quality-pass` |  | original_code |
| `neon-district-v1` | Times Square-style neon district at night | `src/library/environment/NeonDistrict.ts` | `manthan-quality-pass` |  | original_code |
| `newborn-hand-v1` | Articulated newborn hand | `src/library/characters/NewbornHand.ts` | `what-if-every-man-disappeared` | `last-man-alive`, `last-woman-alive`, `what-if-every-man-disappeared` | original_procedural |
| `nightlife-kit-v1` | String lights, stage beams, LED dance floor, stage | `src/library/environment/NightlifeKit.ts` | `manthan-quality-pass` | `rogue-planet-between-earth-mars` | original_code |
| `ocean-cross-section-v1` | Deep ocean cross-section | `src/library/diagram/OceanCrossSection.ts` | `moon-made-of-ice` | `moon-made-of-ice` | original_procedural |
| `ocean-surface-v1` | Open-water ocean surface | `src/library/environment/OceanSurface.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `everyone-drank-the-ocean`, `ice-sank-instead-of-floating`, `last-man-alive`, `moon-made-of-ice`, `oxygen-gone-five-seconds`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `what-if-every-man-disappeared` | original_procedural |
| `orbit-map-v1` | Top-down orbit map with progressive trajectories | `src/library/diagram/OrbitMap.ts` | `rogue-planet-between-earth-mars` | `rogue-planet-between-earth-mars` | original_code |
| `overcast-shell-v1` | Planet-wide cloud shell | `src/library/planet/OvercastShell.ts` | `rain-nonstop-everywhere` | `continents-one-landmass`, `earth-ten-percent-closer`, `rain-nonstop-everywhere` | original_procedural |
| `overlay-labels-v1` | Schematic label and callout helpers | `src/library/overlay/Labels.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_code |
| `palm-tree-v1` | Coconut palm | `src/library/environment/PalmTree.ts` | `earth-six-hour-day` |  | original_procedural |
| `pbr-materials-v1` | Photo-scanned PBR material library (CC0) | `src/library/materials/PBR.ts` | `earth-six-hour-day` |  | CC0 1.0 (Poly Haven textures; provenance lock) + original_code |
| `pedestrian-crowd-v1` | Deterministic articulated pedestrian crossing | `src/library/characters/PedestrianCrowd.ts` | `what-if-every-man-disappeared` | `continents-one-landmass`, `earth-ten-percent-closer`, `every-human-jumped-at-once`, `last-man-alive`, `last-woman-alive`, `what-if-every-man-disappeared` | original_procedural |
| `penguin-colony-v1` | Emperor penguin colony | `src/library/creatures/PenguinColony.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating` | original_procedural |
| `physical-sky-v1` | Physical sky with clouds, sun and stars | `src/library/environment/PhysicalSky.ts` | `earth-six-hour-day` |  | original_procedural |
| `planet-cutaway-v1` | Planet cutaway (layered interior) | `src/library/planet/PlanetCutaway.ts` | `earth-core-solid` | `earth-core-solid` | original_procedural |
| `planetary-ring-system-v1` | Procedural multi-band planetary ring system with shadow cutout | `src/library/planet/PlanetaryRings.ts` | `earth-rings-like-saturn` |  | original_procedural |
| `plastic-bottle-v1` | Crumpling plastic bottle | `src/library/props/PlasticBottle.ts` | `air-pressure-doubled` | `air-pressure-doubled`, `everyone-drank-the-ocean` | original_procedural |
| `plate-drift-globe-v1` | Plate-drift Earth (continents as moving plates) | `src/library/planet/PlateDriftGlobe.ts` | `continents-one-landmass` | `continents-one-landmass` | original_procedural |
| `population-pyramid-v1` | Population pyramid | `src/library/diagram/PopulationPyramid.ts` | `what-if-every-man-disappeared` | `what-if-every-man-disappeared` | original_procedural |
| `port-diorama-kit-v1` | Port diorama kit | `src/library/environment/PortKit.ts` | `what-if-every-man-disappeared` | `last-man-alive`, `what-if-every-man-disappeared` | original_procedural |
| `quadruped-v1` | Parametric four-legged animals (16 species) | `src/library/creatures/Quadruped.ts` | `manthan-quality-pass` |  | original_code |
| `rain-v1` | Rain streaks, splash rings and rain shafts | `src/library/fx/Rain.ts` | `rain-nonstop-everywhere` | `continents-one-landmass`, `rain-nonstop-everywhere` | original_procedural |
| `right-whale-v1` | North Atlantic right whale | `src/library/creatures/RightWhale.ts` | `what-if-every-man-disappeared` | `what-if-every-man-disappeared` | original_procedural |
| `road-vehicles-v1` | Road vehicles: cars, taxi, police, ambulance, van, bus, truck | `src/library/vehicles/RoadVehicles.ts` | `manthan-quality-pass` |  | original_code |
| `rocky-planet-v1` | Procedural rocky planet (Mars-like) | `src/library/planet/RockyPlanet.ts` | `earth-core-solid` | `earth-core-solid`, `rogue-planet-between-earth-mars` | original_procedural |
| `room-box-v1` | Modular room kit | `src/library/environment/RoomBox.ts` | `what-if-every-man-disappeared` | `earth-ten-percent-closer`, `last-man-alive`, `last-woman-alive`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `social-media-gone-five-seconds`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_procedural |
| `sailboat-v1` | Sailboat (sloop) | `src/library/vehicles/Sailboat.ts` | `air-pressure-doubled` | `air-pressure-doubled`, `everyone-drank-the-ocean`, `moon-made-of-ice`, `rogue-planet-between-earth-mars`, `what-if-every-man-disappeared` | original_procedural |
| `scuba-gear-v1` | Scuba gear for the humanoid | `src/library/characters/ScubaGear.ts` | `air-pressure-doubled` | `air-pressure-doubled` | original_procedural |
| `sea-ice-v1` | Sea-ice floes, fast-ice platform and tabular iceberg | `src/library/environment/SeaIce.ts` | `ice-sank-instead-of-floating` | `earth-ten-percent-closer`, `earth-without-tilt`, `ice-sank-instead-of-floating`, `rogue-planet-between-earth-mars` | original_procedural |
| `seismometer-v1` | Seismometer with schematic trace | `src/library/props/Seismometer.ts` | `what-if-every-man-disappeared` | `every-human-jumped-at-once`, `what-if-every-man-disappeared` | original_procedural |
| `shader-noise-math-v1` | Shared shader noise and deterministic math | `src/library/util/glsl.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ice-sank-instead-of-floating`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `what-if-every-man-disappeared` | original_code |
| `ship-bridge-v1` | Ship bridge | `src/library/environment/ShipBridge.ts` | `what-if-every-man-disappeared` | `what-if-every-man-disappeared` | original_procedural |
| `sky-dome-v1` | Gradient sky dome with sun and haze | `src/library/environment/SkyDome.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `everyone-drank-the-ocean`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `rain-nonstop-everywhere`, `sky-disappeared`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_procedural |
| `smoke-wisp-v1` | Rising smoke ribbon | `src/library/fx/SmokeWisp.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `earth-1000f-five-seconds`, `earth-ten-percent-closer`, `earth-without-tilt`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `oxygen-gone-five-seconds`, `what-if-every-man-disappeared` | original_procedural |
| `snowfall-v1` | Wrapped particle fall (snow or sinking crystals) | `src/library/fx/Snowfall.ts` | `ice-sank-instead-of-floating` | `air-pressure-doubled`, `every-volcano-erupts-at-once`, `ice-sank-instead-of-floating`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars` | original_procedural |
| `solar-orbit-diagram-v1` | Solar orbital geometry and Kepler race | `src/library/diagram/SolarOrbitDiagram.ts` | `earth-ten-percent-closer` | `earth-ten-percent-closer` | original_procedural |
| `solar-panel-array-v1` | Ground-mounted solar panel array | `src/library/props/SolarPanelArray.ts` | `rain-nonstop-everywhere` | `earth-ten-percent-closer`, `rain-nonstop-everywhere` | original_procedural |
| `solar-system-v1` | Sun and planets (cinematic compressed scale) | `src/library/space/SolarSystem.ts` | `manthan-quality-pass` |  | original_code |
| `solar-wind-stream-v1` | Solar-wind particle stream | `src/library/space/SolarWind.ts` | `earth-core-solid` | `earth-core-solid` | original_procedural |
| `songbird-v1` | White-crowned sparrow | `src/library/creatures/Songbird.ts` | `what-if-every-man-disappeared` | `what-if-every-man-disappeared` | original_procedural |
| `sound-rings-v1` | Schematic sound rings | `src/library/diagram/SoundRings.ts` | `what-if-every-man-disappeared` | `every-human-jumped-at-once`, `everyone-sneezes-at-once`, `what-if-every-man-disappeared` | original_procedural |
| `spacecraft-v1` | Rocket with exhaust plume, satellite, space station | `src/library/space/Spacecraft.ts` | `manthan-quality-pass` |  | original_code |
| `starfield-v1` | Seeded starfield | `src/library/space/Starfield.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `ice-sank-instead-of-floating`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `oxygen-gone-five-seconds`, `ozone-layer-gone-overnight`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `sun-locked-earth`, `what-if-every-man-disappeared` | original_procedural |
| `street-furniture-v1` | Street furniture set | `src/library/props/StreetFurniture.ts` | `manthan-quality-pass` |  | original_code |
| `sun-skylight-rig-v1` | Sun and skylight lighting rig with horizon-clipped sun disc | `src/library/environment/SunSkylightRig.ts` | `sky-disappeared` | `earth-1000f-five-seconds`, `earth-without-tilt`, `every-volcano-erupts-at-once`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `sky-disappeared`, `sun-locked-earth` | original_code |
| `sundial-v1` | Horizontal garden sundial | `src/library/props/Sundial.ts` | `earth-six-hour-day` |  | original_procedural |
| `swimming-pool-field-v1` | Metre-scale swimming-pool field | `src/library/environment/SwimmingPoolField.ts` | `everyone-drank-the-ocean` | `everyone-drank-the-ocean` | original_procedural |
| `synchronized-jump-motion-v1` | Synchronized Jump Motion | `src/library/characters/SynchronizedJump.ts` | `every-human-jumped-at-once` | `every-human-jumped-at-once` | original_procedural |
| `terrain-massif-v1` | Fractal mountain massif with altitude contour | `src/library/environment/Terrain.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `ice-sank-instead-of-floating`, `moon-made-of-ice`, `oxygen-gone-five-seconds`, `rain-nonstop-everywhere` | original_procedural |
| `thumbnail-title-card-v1` | Thumbnail cover composer (bold or clean) | `src/library/overlay/Thumbnail.ts` | `rain-nonstop-everywhere` | `continents-one-landmass`, `earth-1000f-five-seconds`, `earth-core-solid`, `earth-ten-percent-closer`, `earth-without-tilt`, `every-human-jumped-at-once`, `every-volcano-erupts-at-once`, `everyone-drank-the-ocean`, `everyone-farts-at-once`, `everyone-sneezes-at-once`, `last-man-alive`, `last-woman-alive`, `moon-made-of-ice`, `mountain-grew-100-km-tall`, `ozone-layer-gone-overnight`, `penny-doubled-30-days`, `rain-nonstop-everywhere`, `rogue-planet-between-earth-mars`, `sky-disappeared`, `social-media-gone-five-seconds`, `sun-locked-earth` | original_procedural |
| `tidal-bulge-v1` | Schematic tidal-potential contours | `src/library/diagram/TidalBulge.ts` | `moon-made-of-ice` | `moon-made-of-ice` | original_procedural |
| `tidal-flat-v1` | Procedural intertidal estuary | `src/library/environment/TidalFlat.ts` | `moon-made-of-ice` | `moon-made-of-ice` | original_procedural |
| `tornado-v1` | Tornado funnel with debris | `src/library/fx/Tornado.ts` | `manthan-quality-pass` |  | original_code |
| `underwater-volume-v1` | Shallow underwater environment | `src/library/environment/Underwater.ts` | `oxygen-gone-five-seconds` | `air-pressure-doubled`, `continents-one-landmass`, `earth-core-solid`, `ice-sank-instead-of-floating`, `oxygen-gone-five-seconds`, `what-if-every-man-disappeared` | original_procedural |
| `vanish-dissolve-v1` | Deterministic material erosion and sideways motes | `src/library/fx/VanishDissolve.ts` | `what-if-every-man-disappeared` | `last-man-alive`, `last-woman-alive`, `what-if-every-man-disappeared` | original_procedural |
| `village-houses-v1` | Village of small gabled houses | `src/library/environment/VillageHouses.ts` | `continents-one-landmass` | `continents-one-landmass`, `every-volcano-erupts-at-once`, `penny-doubled-30-days`, `rogue-planet-between-earth-mars` | original_procedural |
| `voice-cast-v1` | Voice cast and segment planner | `src/library/audio/cast.mjs` | `earth-six-hour-day` |  | original_procedural |
| `voice-chain-v1` | Voice finishing chain (loudness match, broadcast EQ/de-ess/compression, convolution room) | `src/library/audio/voice.mjs` | `earth-six-hour-day` |  | original_procedural |
| `volcano-v1` | Erupting volcano | `src/library/environment/Volcano.ts` | `earth-core-solid` | `earth-core-solid`, `every-volcano-erupts-at-once` | original_procedural |
| `vortex-debris-pull-v1` | Deterministic singularity / vortex debris accretion rig | `src/library/fx/VortexPull.ts` | `coin-black-hole-city` |  | original_procedural |
| `water-molecules-v1` | Schematic water molecules: liquid to ice lattice | `src/library/diagram/WaterMolecules.ts` | `ice-sank-instead-of-floating` | `ice-sank-instead-of-floating`, `moon-made-of-ice` | original_procedural |
| `water-photolysis-v1` | Water photolysis and hydrogen escape diagram | `src/library/diagram/WaterPhotolysis.ts` | `earth-ten-percent-closer` | `earth-ten-percent-closer` | original_procedural |
| `water-service-station-v1` | Water Service Station | `src/library/props/WaterServiceStation.ts` | `every-human-jumped-at-once` | `every-human-jumped-at-once` | original_procedural |
| `water-volume-tank-v1` | Capacity-derived grounded water tank | `src/library/props/WaterVolumeTank.ts` | `everyone-drank-the-ocean` | `everyone-drank-the-ocean` | original_procedural |
| `wpp2024-world-graphics-v1` | UN WPP 2024 world population graphics data | `assets/library/data/wpp2024/world-graphics.json` | `what-if-every-man-disappeared` | `what-if-every-man-disappeared` | UN WPP 2024; CC BY 3.0 IGO; attribution required |

---

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

### `apartment-facade-v1` — Apartment facade

Reusable cutaway apartment wall with lit furnished rooms for intimate human scenes.

**Tags:** apartment, city, interior
**Parameters:** seed, floors, columns, floorHeight, windowSize, occupancy, warmth, balconies
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames. balconies=false omits foreground balcony rails; default true preserves existing films.

### `asteroids-v1` — Asteroids, asteroid fields and comet

rockGeometry() (welded, noise-displaced icosphere with bowl craters and regolith colours), a tumbling hero Asteroid, AsteroidField (thousands of instanced rocks in a Keplerian belt or a drifting box) and Comet (dark nucleus, coma sprite, straight blue ion tail away from the Sun and a broader curved dust tail).

**Tags:** space, asteroid, asteroid-belt, comet, rock, debris, impact
**Parameters:** seed, detail, craters, elongation, radius, spin, count, shape belt|box, inner, outer, thickness, drift, Comet({nucleus, tailLength, activity}).update(t, sunDir)
**Notes:** 

### `atmosphere-scatter-sky-v1` — Altitude-aware scattering sky and planet backdrop

Camera-centred dome that marches single scattering (Rayleigh 8 km, Mie 1.2 km, ozone layer at 25 km, plus a multiple-scattering term) per pixel from the true camera altitude, so the same component gives a blue street sky, an indigo 19 km sky, a black noon sky above 30 km and the glowing limb from orbit. Rays that hit the planet shade the real NASA day map by latitude/longitude around a chosen site under a cloud shell from the NASA cloud map. ATMOSPHERE_GLSL exports the same functions (sun transmittance, in-scatter march with a cloud split, cloud and ground shading) so solid objects get matching aerial perspective and cloud occlusion.

**Tags:** sky, atmosphere, scattering, altitude, space, limb, earth, clouds, weather, rain-shadow
**Parameters:** lat, lon, radius, atmosphereTop, sunDirection, sunPower, multiScatter, cloudAltitude, cloudOpacity, sunDisc, uSkyGain, uDensity, uWeather (storm, lee clearing, desert tint, flow speed), uCloudSea (procedural cloud sea, radius, obstacle radius, lightning), uDesertGround, setCamera(km), toEnvironment(renderer), standardPressureAtm(h)
**Notes:** Site frame is x east, y up, z south in km with the planet centre at (0, -R, 0); stage world axes must stay parallel to it (uniform scale/offset is fine). Give the true camera km every frame (GiantPeak.setCamera does this). Single scattering makes skies darker than surfaces: uSkyGain 1.5-2.3 brightens the dome only. Uses earth-textures-nasa-v1 (day + clouds via loadDayAndClouds). Stars need a depth-only planet sphere to stay above the horizon. Validated in local Chrome WebGL (Intel Iris Xe) from 1.6 m to 120 km altitude.

### `audio-synth-kit-v1` — Procedural audio synthesis kit

Pure-JS deterministic audio toolkit: detuned additive pads, white/pink/brown noise, RBJ biquads with sweeps, Freeverb-style reverb, crackle generator, envelopes and stereo mix helpers for original music beds and sound effects.

**Tags:** audio, music, sfx, synthesis, soundtrack, reverb
**Parameters:** sampleRate, seed, freqs, attack, release, bright, detune, decay, mix, rate
**Notes:** Story cues live in src/stories/<slug>/soundtrack.mjs (export buildSoundtrack(duration) returning {music, sfx}); tools/soundtrack.mjs mixes them under the narration and loudness-normalises to the storyboard target.

### `aurora-curtains-v1` — Aurora curtains

Rippling aurora curtains for night skies: folded ribbons with a sharp, bright green lower edge, vertical rays and a pink upper fringe, additive and waving over time; intensity fades them.

**Tags:** aurora, northern-lights, night-sky, polar, space-weather, sky, fx
**Parameters:** count, seed, center, span, height, altitude, depth, lowColor, highColor, intensity, time_s
**Notes:** Place far away and large (kilometres) so parallax reads as sky-high; give the camera a far plane beyond the curtains. Pair with sky-dome-v1 night colours, starfield-v1 and conifer-stand-v1; tint a hemisphere light green with the intensity for light on snow.

### `banded-cloud-shell-v1` — Rotation-banded cloud shell

Transparent planetary cloud layer organised into latitude belts with soft clustered clouds and log-spiral cyclones (counter-clockwise north, clockwise south); belt count and storm size are the knobs for slow versus fast rotation.

**Tags:** clouds, weather, storms, cyclones, planet, earth, exoplanet, rotation, coriolis, illustrative
**Parameters:** radius, flattening, bandCount, stormSize, stormDensity, coverage, color, shadowColor, sunDirection, seed, spin, time_s
**Notes:** Illustrative, not a weather model. Set spin to the planet mesh rotation.y; band shear accumulates with time_s, so pass the time since the layer appeared. Lower the planet's own cloudOpacity underneath. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `bathroom-scale-v1` — Mechanical bathroom scale

Rounded bathroom scale with a rubber mat, feet and a dial-gauge-v1 face tilted toward its reader; the reading is a plain setter.

**Tags:** scale, weight, gravity, bathroom, prop, human, measurement
**Parameters:** width, depth, height, min, max, unit, marks, bodyColor, matColor, readFrom (user|front), value, topY (read-only)
**Notes:** Origin at floor level; the person on it faces +Z toward the dial. readFrom "front" orients the numerals for a camera in front of the scale. A scale shows mass computed from force assuming standard gravity. Studio v2: the dial now sits in a raised housing so the whole bezel clears the platform in close-ups. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `beach-set-v1` — Beach set dressing: parasol and towels

Striped beach parasol with scalloped gores sagging between ribs, a scalloped valance and a tilted wooden pole (gentle flutter), and striped towels draped over the sand.

**Tags:** beach, parasol, umbrella, towel, props, summer, holiday
**Parameters:** BeachParasol.radius, height, gores, colors, tilt, tiltDir, update(time_s, wind), BeachTowel.width, length, colors, stripes, ground(x,z), position, yaw, seed
**Notes:** Origins on the ground. Towels follow the ground function you pass. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `bird-flock-v1` — Instanced flapping birds

Gull-like instanced birds with two-segment wing flapping in the vertex shader, translucent wing lighting, and controllable sink and pitch for lift-loss or soaring shots.

**Tags:** birds, gulls, animal, sky, flock, flight
**Parameters:** count, seed, spread, wingspan, bodyColor, wingColor, tipColor, sunDirection, sunColor, ambient, center, heading, sink, pitch, flapPhase, time_s, glide
**Notes:** Pass an analytic flap phase (integral of flap frequency) so rate changes stay smooth and deterministic. air-pressure-doubled added glide (0..1) to hold wings in a gliding pose; default 0 leaves earlier shots unchanged.

### `black-hole-sky-v1` — Gravitationally lensing black hole (sky shader)

Full-sky ray-marched Schwarzschild black hole: each camera ray integrates the photon-orbit equation, so stars are lensed, rays inside the photon sphere fall into a true shadow with a photon ring, and the thin accretion disk appears in front and bent over the top and under the bottom of the hole. Keplerian disk flow with seamless turbulence, Novikov-Thorne-like temperature profile, relativistic Doppler beaming and gravitational redshift; procedural star field, galactic band and nebula.

**Tags:** space, black-hole, lensing, accretion-disk, relativity, sky, interstellar
**Parameters:** position, rs, diskInner, diskOuter, diskNormal, diskBrightness, diskTemperature, spin, beaming, stars, nebula, seed, steps, update(t)
**Notes:** Use as the stage sky (renderOrder -100, no depth); ships and planets render in front, unlensed. Pair with post.tonemap agx and bloom. About 260 steps per pixel.

### `bokeh-field-v1` — Soft bokeh light discs

Field of edge-bright out-of-focus discs for macro, interior and night-city backgrounds, with a dim control that switches discs off in seeded order.

**Tags:** bokeh, lights, background, macro, interior, fx
**Parameters:** count, seed, center, extent, colors, size, gain, dim, time_s
**Notes:** Additive; keep gain low over bright backdrops. Disc size is in pixels for 1080-wide output.

### `broadleaf-tree-v1` — Broadleaf street tree

Seeded branched tree with instanced leaves and editable seasonal foliage.

**Tags:** tree, vegetation, city
**Parameters:** height, canopyWidth, leafCount, seed, leafColor, trunkColor, leafFraction
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `bubble-stream-v1` — Exhalation bubble stream

Periodic bursts of bubbles from an emitter that wobble, spread, accelerate gently and swell by Boyle's law as the water pressure falls toward the surface; placed statelessly from the burst schedule.

**Tags:** bubbles, underwater, diver, fx, particles, boyle
**Parameters:** period, perBurst, bursts, spread, riseSpeed, size, surfaceY, surfacePressure, seed, emitter, t0, time_s
**Notes:** surfacePressure is in atmospheres (1 = today, 2 = doubled air) and only affects the Boyle growth factor.

### `building-kit-v1` — Building kit with interior-mapped windows

Procedural townhouses, apartments, towers, offices, shops and cottages in photo-scanned PBR walls and roofs, with plinths, floor bands, cornices, gables and chimneys, doors with lamps, balconies, shutters, shopfronts with lit signs and awnings, and windows drawn by an anti-aliased interior-mapping shader (rooms with walls, floors, ceiling lamps, furniture, pictures, curtains or blinds, the odd TV glow) plus sky reflections; rooms light up warm or cool at night.

**Tags:** building, house, city, town, architecture, windows, night, facade
**Parameters:** style, width, depth, floors, floorHeight, wall, wallTint, trimTint, roof, roofSet, roofTint, windowsPerFloor, windowW, windowH, balconies, shutters, shop.sign, shop.color, shop.awning, litFraction, seed, setLight(night, zenith, horizon), update(time_s)
**Notes:** Front faces +Z, origin at the footprint centre on the ground. Per-window values reach the fragment shader as flat varyings (hashing an interpolated seed caused per-pixel speckle; fixed). Needs a PBRLibrary with the wall/roof sets loaded. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `camera-keyframe-rig-v1` — Storyboard keyframe camera rig

Applies storyboard camera keyframes (position, look_at, ease, FOV) to a perspective camera at any absolute time, clamping outside the span so shots can be evaluated early or late for dissolves.

**Tags:** camera, keyframes, animation, storyboard
**Parameters:** keyframes, fov_or_scale, ease, time_s
**Notes:** For smooth pans between a near and a far subject, author look_at points at similar distances along the line of sight.

### `caption-kinetic-v1` — Kinetic burned-in captions

Word-timed caption renderer for a 2D canvas: clause-aware phrase splitting, two balanced lines, active-word accent and accent_color / gentle_scale / subtle_glow emphasis, outline, shadow and a soft backdrop band.

**Tags:** captions, subtitles, typography, overlay, accessibility
**Parameters:** fontFamily, fontWeight, fontSize, lineHeight, maxCharsPerLine, baselineY, centerX, maxWidth, fill, accent, accentSoft, stroke, strokeWidth, backdrop, emphasis, cues(), backdropStyle
**Notes:** Feed it word timings from tools/narrate.mjs (real synthesized audio aligned with local Whisper), never guessed timings. cues() returns the displayed phrases and their times; tools/transcript.mjs uses it so output SRT/TXT files match the burned-in captions. Optional pill backdrop; default band behavior is preserved.

### `center-of-mass-recoil-diagram-v1` — Center Of Mass Recoil Diagram

Parameterised two-body recoil apparatus with a fixed center-of-mass crosshair.

**Tags:** momentum, recoil, center-of-mass, schematic
**Parameters:** massRatio, jumpHeight, visualRecoil, progress, landingProgress
**Notes:** Original parameterised Three.js code validated in Chrome WebGL storyboard frame captures. All motion is evaluated from caller time. Crowd silhouettes are for mid-distance/aerial use. Recoil display displacement is independently exaggerated and requires a schematic label; mass ratio is used only for the physical displacement calculation.

### `character-motion-v1` — Grounded character acting and straight-path locomotion

Opt-in absolute-time planted and seated pose helpers plus distance-driven straight walking for the registered Humanoid rig. Finite action progress supports authored reaches and reactions.

**Tags:** human, animation, acting, walking, contact
**Parameters:** actionProgress(t,start,end), applyGroundedPose(person,pose,groundY), seatedPose(person,seatY,groundY), applyStraightWalk(person,t,options), soleHeight(person,side)
**Notes:** Requires the existing Humanoid shoe dimensions, uniform rig scale and unrotated stage parent. Straight-path stance centers stay fixed; opt-in compensation levels the existing shoe mesh and foot anchor around the ankle. These owned transforms reset on every helper call. No full-body dynamics or curved-path foot locking. Stage owns intent, targets and all pose resets; call hand reachArm after posing.

### `city-damage-map-v1` — 3D tactical metropolitan damage & survival radius map

Dark-mode satellite street grid with winding river channel, concentric color-coded blast/gravity/thermal radius rings (e.g. 0.5 MI, 2 MI, 10 MI, 50 MI), pulsing epicenter pin, radar shockwave sweep, and ringPointWorld() helper for anchoring overlay-labels-v1 callouts.

**Tags:** map, city, radius, blast, survival, diagram, shockwave, black-hole
**Parameters:** size, seed, epicenter, rings, progress, time_s, ringPointWorld(ringIndex, angleDeg)
**Notes:** Pair with overlay-labels-v1 drawCallout() using projectToScreen(map.ringPointWorld(i, deg)) and ask 'Where would you be on the map?' to drive comment velocity.

### `city-kit-v1` — City kit: streets, lamps, cars, crowds

CityStreetV2 lays out a street of BuildingKit blocks with asphalt, kerbs, lane markings and crossings, street trees, StreetLamps (soft volumetric cones, light pools, optional real spotlights), clear-coat cars with working head/tail lights, and HumanV2 pedestrians walking both ways — all deterministic. Traffic uses road-vehicles-v1 (CityKit Car extends Vehicle).

**Tags:** city, street, traffic, cars, pedestrians, crowd, street-lamp, night, urban
**Parameters:** length, roadWidth, sidewalk, seed, styles, floors, litFraction, cars, pedestrians, trees, lampSpacing, pbr, StreetLamp(height, armDir, color, {light, intensity}), Car({kind, color, seed}), setLight(night, zenith, horizon), update(time_s)
**Notes:** StreetLamp {light: true} adds a shadowless SpotLight that stays in the scene at 0 by day (toggling visibility would recompile shaders); use it only for the few lamps near the camera. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `city-street-block-v1` — Detailed city street and aerial district

Metre-scale street with procedural masonry and room-interior facade textures, warm shopfronts, granite paving, zebra crossing, wet asphalt and light streaks, practical street lamps, pedestrian signals, unbranded vehicles and an instanced surrounding city district. Static near geometry is combined by material for efficient frame capture.

**Tags:** city, street, architecture, crosswalk, wet-road, aerial, windows
**Parameters:** seed, roadWidth, sidewalkWidth, blocks, storeysMin, storeysMax, windowOccupancy, wetness, farFieldRadius, vehicles, lights, time_s
**Notes:** All textures are generated by original Canvas code; no external branding or media. Road runs along Z, crossing at origin; facades start at X = plus/minus (roadWidth/2 + sidewalkWidth). Windows and lamps remain on unless lights explicitly changes. Wet-road effects use material response and authored reflection streaks, not a full ray-traced reflection. makeCityCar is exported for unbranded background vehicles. Validated in local Chrome WebGL smoke captures (opening, dissolve, survivors, aerial, memorial and repair crew); no shader errors. The detailed implementation described here is kept verbatim as src/library/environment/CityStreetClassic.ts (CityStreetClassic, makeClassicCityCar) since CityStreet.ts was rewritten to a simpler hazard kit; this.far.children[0] is the instanced skyline (one box per instance) for corridor edits.

### `clinic-interior-v1` — Clinic interior

Generic clinic corridor, rooms, practical lighting and medical furnishings.

**Tags:** clinic, hospital, interior
**Parameters:** corridorLength, rooms, lightingMix, seed
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `cloud-ceiling-v1` — Overcast cloud base seen from below

Large horizontal plane at the cloud-base altitude with warped fractal density: dark where thick, bright where thin, a silver lining toward the sun and haze toward the horizon. coverage opens gaps onto the sky dome; setGap clears a soft, sunlit break at a world position.

**Tags:** clouds, overcast, sky, weather, rain, storm
**Parameters:** size, altitude, scale, coverage, darkColor, lightColor, hazeColor, hazeDensity, sunDirection, sunColor, sunGlow, seed, setGap(x, z, r, strength), time_s, scrollX, scrollZ
**Notes:** Pair with sky-dome-v1: gaps and the far haze reveal the dome. Transparent with renderOrder -50; give the camera a far plane that covers the cloud distance you want to see.

### `cloud-deck-v1` — Cloud-top layer seen from above

Large plane with domain-warped fractal cloud density, directional self-shadowing, gaps to a below colour and horizon haze; scroll offsets convey flight over the deck.

**Tags:** clouds, sky, aerial, weather, aircraft
**Parameters:** size, level, scale, coverage, sunDirection, sunColor, shadowColor, belowColor, hazeColor, hazeDensity, scrollX, scrollZ, time_s
**Notes:** update(time_s, scrollX, scrollZ) in metres.

### `coin-pile-v1` — Procedural coin pile

True-size coins and the heaps they make. CoinSpec sets a coin (US_CENT: 19.05 mm, 1.52 mm, 2.5 g). pileShape(n) derives a loose heap from the count (coin cylinder volume divided by a packing fraction, poured as a cone at the angle of repose) and heapProfile gives its crowned, flared height. CoinHeap is a polar heightfield mesh rebuilt each frame from any height function (tucks under its support where empty) with a coin-scale copper albedo and normal map; CoinInstances places individual coins with face relief and per-coin tint for twin hops, pours, spills and surface coats.

**Tags:** money, coin, penny, pile, heap, scale, prop
**Parameters:** CoinSpec {diameter, thickness, mass, color}, pileShape(n, spec, {packing, reposeDeg}), heapProfile(r, R, H), heapMaterial(spec, seed, {metalness, roughness}), coinMaterial(spec, {metalness, roughness}), CoinHeap(material, rings, segments, tile).update(extent, h), CoinInstances(max, spec, seed).place/hide/finish, heightNormal(h, x, z)
**Notes:** Deterministic: every update sets the full surface from absolute time. Indoors use the default mirror-bright copper with a RoomEnvironment; outdoors pass metalness ~0.45 so the sky does not turn the heap blue. Heaps are visual volumes, not a granular solver.

### `compass-v1` — Brass pocket compass

Brass pocket compass: lathe-turned case and bezel, bow ring, printed rose card (degree ticks, cardinal letters, eight-point star), glass cover and a two-tone diamond needle on a pivot. heading turns the needle.

**Tags:** compass, navigation, magnetism, north, prop, macro, exploration
**Parameters:** radius, caseColor, cardColor, inkColor, northColor, heading
**Notes:** Card lies in the XZ plane facing +Y with north toward −Z; heading is clockwise seen from above. Give the scene an environment map (e.g. PMREM of RoomEnvironment, intensity ~0.3) or the brass renders black.

### `conifer-stand-v1` — Instanced conifers with snow load

Instanced stylised conifers (tiered cones on a trunk) with snow painted on upward-facing outer surfaces, plus a seeded scatter helper.

**Tags:** trees, forest, conifer, winter, snow, vegetation
**Parameters:** positions, seed, minHeight, maxHeight, color, trunkColor, snow, snowColor, scatterTrees(count,seed,area,y,reject)
**Notes:** Mid-ground and background use; tree shapes are simple, so keep them beyond about 30 m from the camera.

### `container-ship-v1` — Container ship

Unbranded container ship with hull, deck cargo, bridge and propeller.

**Tags:** ship, ocean, transport
**Parameters:** length, beam, draft, containerFill, palette, seed, deckLights, navLights, rpm, speed, pitch, time_s
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `cooking-pot-v1` — Cooking pot with boiling water

Brushed stainless pot with riveted handles and water: transmissive surface with ripples and boiling bumps, and a stateless bubble pool (small nucleation streams, then large rolling-boil bubbles) controlled by a boil value.

**Tags:** pot, kitchen, cooking, water, boiling, bubbles, prop
**Parameters:** radius, height, waterLevel, seed, bubbles, metalColor, boil, time_s
**Notes:** boil: 0 still, ~0.2 a few bubbles, 1 rolling boil. Pair with smoke-wisp-v1 for steam and gas-burner-v1 underneath. Needs a reasonably bright environment map for the steel to read as stainless.

### `coral-mounds-v1` — Procedural coral heads

Shallow-reef coral heads in three procedural forms (grooved brain coral, branching fans, table corals on stems), instanced with seeded positions, sizes, rotations and a warm reef palette; matte so they read under caustics and underwater fog.

**Tags:** coral, reef, ocean, underwater, marine, sea-life
**Parameters:** count (per form), area, ground(x, z), reject(x, z), minSize, maxSize, palette, seed
**Notes:** Static; add group to the scene. With underwater-volume-v1 pass ground: (x, z) => sea.floorHeight(x, z) so every coral sits on the sand; use reject to keep sand channels open. MeshStandardMaterial with instance colours, so scene lights and FogExp2 apply.

### `crowd-field-v1` — Crowd Field

Seeded instanced clothed human silhouettes for dense mid-distance and aerial crowds.

**Tags:** crowd, people, instanced, aerial, city
**Parameters:** seed, width, depth, spacing, height, density, jumpHeight, time_s
**Notes:** Original parameterised Three.js code validated in Chrome WebGL storyboard frame captures. All motion is evaluated from caller time. Crowd silhouettes are for mid-distance/aerial use. Recoil display displacement is independently exaggerated and requires a schematic label; mass ratio is used only for the physical displacement calculation.

### `crowd-kit-v1` — Diverse animated crowds (casting, accessories, behaviours)

Built on human-figure-v2: diversePerson() casts children, adults and elders across 15 skin tones and eleven hair styles with vibe palettes (everyday, night-out, tourist, business, winter, summer) and accessories (glowing phone, backpack, tote, coffee cup, umbrella, shopping bags, camera). Behaviour poses talk, phone, photo, wave, cheer, beat-locked dance (four styles) and look-up; Crowd runs path walkers with distance-locked strides in both directions plus standing groups facing a target; CrowdImpostors adds hundreds of instanced walking figures for far density.

**Tags:** people, crowd, pedestrians, tourists, party, dance, diversity, city, night-life
**Parameters:** diversePerson(seed, {vibe, childShare, elderShare}), Crowd({walkers:[{path, count, speed, bothWays, phoneShare}], groups:[{center, count, radius, activity, target}], vibe, pbr}), update(t, night), talkPose/phonePose/photoPose/wavePose/cheerPose/dancePose/lookupPose(t, seed), CrowdImpostors({lanes, vibe}).update(t), attachAccessories(human, accessories, seed)
**Notes:** Open walk paths wrap end to start, so keep both ends out of shot (or close the loop). ~80 HumanV2 people plus 300 impostors render comfortably.

### `dairy-cow-v1` — Procedural dairy cow

Stylised dairy cow in metres facing +Z with feet on y = 0: rounded capsule body, belly and hips, four legs with hooves, udder, neck and head with muzzle, ears, jaw and a tufted tail. Canvas coat: Holstein black-and-white patches (seeded), solid brown or Jersey fawn. setPose() drives grazing, head turn, jaw (chewing or a burp), tail swing and ear flicks; mouthWorld() returns the muzzle tip for breath or burp puffs.

**Tags:** animal, cow, cattle, livestock, farm, character
**Parameters:** seed, coat, scale, setPose({graze,headYaw,jaw,tail,ears}), mouthWorld()
**Notes:** Static geometry; every setPose call sets the full state. Most cattle methane leaves by the mouth, so burps come from mouthWorld(). Scale 1 is about 1.45 m at the withers and 2.4 m long.

### `day-cycle-dial-v1` — Day-cycle dial overlay

2D canvas overlay: a ring of 24 (or any number of) hours split into day/night arcs for a planet of any day length, with a sun at each sunrise, hour ticks, a progress hand and centre labels.

**Tags:** overlay, day-length, rotation, clock, sunrise, time-lapse, diagram, schematic
**Parameters:** x, y, radius, dayLengthHours, daylightFraction, hoursShown, topHour, firstSunriseHour, progress, alpha, dayColor, nightColor, sunColor, label, sublabel
**Notes:** Pure drawing function drawDayCycleDial(ctx, options); no state. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `dial-gauge-v1` — Analog dial gauge

Barometer / thermometer / pressure gauge with a canvas-drawn face (ticks, labels, unit, title, coloured marks), brass, steel or black bezel, glass cover, tapered needle and an optional probe stem. Face points along +Z.

**Tags:** gauge, dial, barometer, thermometer, pressure, instrument, prop
**Parameters:** radius, min, max, arcDegrees, majorStep, minorStep, labelStep, unit, title, marks, bezel, faceColor, inkColor, needleColor, depth, stemLength, stemRadius, value, angleDeg(value)
**Notes:** value is a plain setter, so drive it from a deterministic function of time. Clockwise = increasing, scale centred on 12 o'clock. The face sits R·0.004 proud of the case cap to avoid z-fighting in close-ups (fixed for earth-six-hour-day; appearance otherwise unchanged).

### `dog-v1` — Procedural dog

Stylised dog in metres facing +Z with feet on y = 0: capsule body that pivots at the hips so it can stand or sit, chest, four legs (front legs stay vertical, hind legs fold), head on a level neck with snout, muzzle, nose, eyes, jaw, floppy ears and a tail. setPose() blends standing and sitting and drives head tilt, yaw and pitch, mouth (pant or bark), tail wag and lift, and ears; headWorld() and mouthWorld() give anchor points.

**Tags:** animal, dog, pet, character, street, home
**Parameters:** coat, light, dark, scale, setPose({sit,headTilt,headYaw,headPitch,mouth,tailWag,tailLift,ears}), headWorld(), mouthWorld()
**Notes:** Static geometry; every setPose call sets the full state. Head yaw turns about the true vertical even when sitting (positive turns toward the dog's left); negative pitch looks up. Scale 1 is about 0.55 m at the shoulder.

### `dry-soil-v1` — PBR desiccating soil

Procedural Voronoi soil polygons with desiccation cracks, fine grain and reversible moisture-to-dry color control.

**Tags:** soil, drought, climate, cracks, terrain
**Parameters:** size, cellSize, color, dryColor, dryness
**Notes:** Deterministic original procedural material on a metre-scale ground plane; editable resolution-independent shader detail.

### `dune-field-v1` — Procedural sand dune sea

Seeded heightfield of asymmetric transverse dunes (gentle windward slopes, steep slip faces) with shader wind ripples and close-up sand grains. wetness turns on raindrop spots that merge into dark, glossy soaked sand; greening spreads patchy vegetation tint from the interdune hollows. heightAt(x, z) returns the mesh height for cameras and props.

**Tags:** desert, sand, dunes, sahara, terrain, rain, greening
**Parameters:** size, segments, seed, height, wavelength, windDeg, flatRadius, floor, sandColor, greenColor, rippleWavelength, wetness, greening, heightAt(x, z)
**Notes:** flatRadius keeps a flat y = 0 area around the origin for macro shots; dunes reach full height beyond about 2.6 × flatRadius. Built on MeshStandardMaterial (onBeforeCompile), so scene lights and fog apply. On Intel/ANGLE, grazing macro shots have poor depth precision: keep camera near ≥ 1 cm and draw decals on the sand in the opaque pass without a depth test.

### `dung-beetle-v1` — Walking dung beetle

Procedural scarab with articulated gait, glossy chitin, and a rolling fibrous ball.

**Tags:** insect, beetle, wildlife, night, navigation, macro
**Parameters:** length, speed, time_s
**Notes:** Designed for cinematic macro views; gait is illustrative.

### `earth-globe-v1` — Earth globe with atmosphere, clouds and city lights

Earth sphere using the shared NASA texture set: Blue Marble day map, Black Marble night lights, drifting cloud layer with soft shadows, ocean sun glint from a land mask, warm terminator and an additive atmospheric rim shell. Supports regional night-light outages for illustrative blackout shots.

**Tags:** earth, planet, globe, space, orbit, atmosphere, clouds, night-lights, blackout
**Parameters:** radius, sunDirection, cloudOpacity, atmosphereStrength, atmosphereColor, nightLights, scatter, nightOutage, outageSeed, outageScale, spinRate, cloudDrift, setView(lon,lat), time_s, seaIce, flattening
**Notes:** Radius 1 unit by default. Load textures once with loadEarthTextures(base). setView(lon, lat) turns a geographic point toward +Z; update(time_s) is linear in time. scatter scales the limb glow (1 = normal air). Added for ice-sank-instead-of-floating: optional seaIce texture (earth-seaice-mask-nasa-v1) and a seaIce 0..1 setter; default 0 leaves earlier videos unchanged. flattening (f = (a−c)/a along the spin axis, volume preserved, default 0) gives a true-scale oblate globe with exact normals; added for earth-six-hour-day, sphere output unchanged.

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

### `end-card-v1` — End-hook card overlay

The film's closing question drawn large over the final shot: words rise in one by one (optionally exactly as the voice speaks them), highlight words glow in the accent colour, an accent rule grows beneath and a subline follows; fades before the last frame for clean loops.

**Tags:** end-card, hook, outro, question, overlay, typography, cta
**Parameters:** text, highlight, subline, start, end, wordTimes, x, y, maxWidth, size, accent, color, family
**Notes:** src/entry.ts draws it automatically for a storyboard 1.2.0 outro_hook scene with end_card, matches the card to the spoken question and hands over from the captions. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `energy-kit-v1` — Wind turbines, pylons and power lines

WindTurbine (tapered tower, nacelle, spinner, twisted tapering blades turning at rpm, aviation beacon), lattice PowerPylon with insulator strings and PowerLine catenary cables between pylon arms.

**Tags:** energy, wind-turbine, wind-farm, pylon, power-line, grid, infrastructure
**Parameters:** WindTurbine({height, blade, rpm, phase, yaw}).update(t, night), PowerPylon({height}), PowerLine(a, b, {sag, radius})
**Notes:** 

### `eruption-column-v1` — Eruption column, umbrella cloud and pyroclastic flow

Sunlit volcanic ash drawn as instanced camera-facing puffs whose centres, sizes and opacity are evaluated on the CPU from absolute time, sorted back-to-front and shaded as soft lit spheres (wrap diffuse from the sun direction, sky ambient, incandescent glow, distance haze). EruptionColumn: a Plinian column rising from a vent to its neutral-buoyancy height with entrainment widening and wind drift, spreading into an umbrella cloud of a given radius. PyroclasticFlow: a ground-hugging avalanche whose front advances along a terrain path, billowing and lifting off behind the front.

**Tags:** volcano, eruption, ash, plume, pyroclastic flow, smoke, particles
**Parameters:** vent, top, neutral, ventRadius, spread, puffScale, wind, columnPuffs, umbrellaPuffs, seed, EruptionColumn.update(time_s,camera,{amount,height,umbrella,glow}), PyroclasticFlow({path,puffs,width,liftOff}), PyroclasticFlow.update(time_s,camera,{front,amount,glow}), pointAt(s), ashColor, ambient, sunColor, glowColor, hazeColor, hazeDensity, AshPuffs.setLook({sun,sunColor,ambient,ash,haze,hazeDensity,light})
**Notes:** Pass the stage camera to update() every frame: puffs are depth-sorted for it. Puffs are large soft billboards, so give distant columns a lighter hazeDensity than the scene fog to keep them dark and readable. Column motion is real-speed (about 95 s to climb), so a short shot shows billowing rather than visible rise.

### `explosion-v1` — Explosion fireball, shock shell and dust ring

Deterministic blast keyed to start_s: cooling, rising incandescent fireball turning to smoke, fast condensation shock shell, ground dust ring and a flash level; radii follow a Sedov-like t^0.4 growth.

**Tags:** explosion, impact, blast, fireball, shockwave, disaster
**Parameters:** start_s, radius, duration, shock, update(t), flash
**Notes:** Use post.tonemap agx so the fireball rolls off instead of clipping.

### `film-pipeline-v1` — Deterministic film render pipeline

Storyboard-driven frame renderer: shot lookup, keyframe cameras, HDR MSAA scene buffer, bloom, ACES grade, vignette, deterministic grain, cross-dissolves, 2D label overlay and caption compositing. renderFrame(i) depends only on i. Quality presets (QUALITY): standard (bit-identical to the original pipeline at full resolution), cinematic (2x supersampling with contrast-adaptive sharpening, GTAO, depth of field, screen-space sun shafts and 3-sample deterministic sub-frame motion blur) and draft; chosen by storyboard delivery.render_quality or tools/render.mjs --quality. Per-shot tonemap aces/agx/neutral, vibrance, split toning, chromatic aberration and shutter. Renders cross_dissolve, whip_pan (directional smear) and light_wipe (warm sweeping light band) transitions.

**Tags:** render, pipeline, post-processing, bloom, transition, deterministic
**Parameters:** Stage.sunDirection, bloomRadius, bloomStrength, bloomThreshold, contrast, duration_s, exposure, fps, grain, heatHaze, height, lift, post.ao, post.aoRadius, post.chroma, post.dof, post.dofAperture, post.dofMaxBlur, post.highlightTint, post.shadowTint, post.shafts, post.sharpen, post.shutter, post.tonemap, post.vibrance, quality (standard|cinematic|draft or RenderQuality), renderFrame(frame, { overlay, captions }), saturation, scale, tint, vignette, width
**Notes:** Workflow for a new story: add src/stories/<slug>/film.ts (createFilm) and register it in src/entry.ts; then run node tools/narrate.mjs stories/<slug>.json, node tools/soundtrack.mjs <slug>, node tools/render.mjs <slug> --frames a,b,c for smoke frames and --final for the MP4. ffmpeg and ffprobe come from the ffmpeg-static and ffprobe-static npm packages. air-pressure-doubled added a sanitize pass before bloom that zeroes NaN/Inf scene pixels so a single bad pixel cannot bloom into a black block; valid pixels are unchanged. renderFrame(i, { overlay: false, captions: false }) renders a clean still (used for thumbnails); defaults keep normal rendering unchanged.

### `fireworks-v1` — GPU fireworks show

Deterministic fireworks computed in the vertex shader from absolute time: launch comets, then drag-limited ballistic stars with trails. Shell types peony, chrysanthemum, willow, ring, crossette and palm; Fireworks.show() schedules a seeded show with an optional finale; flash/flashColor for lighting.

**Tags:** fireworks, celebration, new-year, festival, night, sky
**Parameters:** new Fireworks(shells, {seed, trail, starSize}), Fireworks.show({start, end, rate, width, height, seed, finale, types}), update(t, pixelScale), flash, flashColor
**Notes:** Start a show before t = 0 (negative start) so bursts are already in the sky in the first frame.

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

### `font-display-set-v1` — Display fonts for thumbnails

Six license-cleared display faces for thumbnail headlines, chosen per niche: Anton (condensed impact), Bebas Neue (condensed cinematic), Archivo Black (wide heavy), Bangers (comic), Orbitron 900 (sci-fi) and Playfair Display 900 (serif). Latin-subset WOFF2 files with their OFL texts; FONTS.md maps each to its thumbnail.font key and best uses.

**Tags:** font, typography, thumbnail, display, headline
**Parameters:** thumbnail.font: inter | anton | bebas-neue | archivo-black | bangers | orbitron | playfair
**Notes:** Copied unmodified from the @fontsource/* 5.3.0 npm packages (Playfair Display has a Reserved Font Name, so keep it unmodified). Loaded by src/entry.ts; metrics (tracking, line height, outline) live in THUMB_FONTS in src/library/overlay/Thumbnail.ts.

### `font-inter-v1` — Inter typeface (Medium, SemiBold, Bold)

Latin subsets of Inter at weights 500, 600 and 700 for captions and labels.

**Tags:** font, typography, captions, inter
**Parameters:** 
**Notes:** Inter by Rasmus Andersson, copied from the @fontsource/inter npm package; licence text in assets/library/fonts/Inter-OFL.txt. Glyphs outside the Latin subset fall back to the system font. Inter Black (900) and Black Italic (900 italic) were added from the same @fontsource/inter package (OFL-1.1) as assets/library/fonts/Inter-Black.woff2 and Inter-BlackItalic.woff2 for bold thumbnail covers.

### `gas-burner-v1` — Gas hob burner

Domestic gas burner: enamel cap, aluminium head, four-arm cast-iron grate and a ring of small blue flame jets built on flame-v1, each billboarding about its own jet axis toward the camera, plus a soft blue point light.

**Tags:** gas, burner, stove, hob, kitchen, flame, fire, combustion
**Parameters:** radius, jets, flameHeight, grate, brightness, seed, intensity, time_s
**Notes:** Origin at the hob surface; grateTop gives the height a pot sits at. intensity 0 shows a cold burner.

### `gas-giant-v1` — Banded gas giant (rogue planet or Jupiter-like world)

Banded gas-giant sphere: zones and belts of irregular width, sheared domain-warped turbulence, fine streaks along the bands, eddies where zones meet belts, up to four swirling storm ovals carried with their band, hazy poles, limb darkening, a soft terminator and a day-side haze rim, plus an optional additive halo shell. A horizon clip and colour tint let it sit in a terrestrial sky at its true angular size, rising out of a sea and reddened near the horizon.

**Tags:** planet, gas-giant, jupiter, rogue-planet, space, sky, bands, storms
**Parameters:** radius, seed, segments, zoneColors, beltColors, poleColor, bands, turbulence, storms [{lat, lon, size, color, strength, spin}], sunDirection, hazeColor, hazeStrength, halo, exposure, tint, ambient, horizonClip(elevation), body (spin-axis tilt), update(time_s, rotation)
**Notes:** Radius 1 by default; tilt `body` to orient the spin axis and pass the spin angle to update(). Band flow is linear in time. For a body in a terrestrial sky, place the group far from the camera, scale it to distance x tan(diameter / 2), set horizonClip to the sea-horizon elevation and tint for extinction.

### `giant-peak-v1` — Planetary-scale mountain (km, curved planet)

100 km-class mountain built in true kilometres on a 6,371 km sphere: concave polar mesh (340 x 1080) with radial ridge spurs, fractal detail and summit crags; altitude-zoned material (forest, alpine rock, a snow belt that stops at the top of the weather, bare stratified rock to the summit) shaded with the atmosphere-scatter-sky-v1 functions for matching haze, sunlight colour, cloud-shell occlusion and horizon hiding. Uniform controls for growth, gravitational slump/spread/isostatic sink, ten glowing altitude bands, a tinted hazard zone with hatching, base fracture glow, a z-cut clip, a hole for metre-scale foreground patches and optional logarithmic depth. PeakCutaway adds the matching z = 0 cross-section with an overburden-stress heat map (26.5 MPa per km), a dashed rock-strength limit line, crust/Moho/mantle layers and fracture glow; depthClearer() lets a stage draw the 100 km mesh first, clear depth and then draw a centimetre-scale foreground.

**Tags:** mountain, terrain, planet, geology, altitude, isostasy, cutaway, stress, scale, everest
**Parameters:** height, baseRadius, profile, seed, rings, segments, uGrow, uCollapse, setBand(i, alt, on, color), uZoneAlt/uZoneAmt/uZoneCol, uCrack/uCrackFront, uClipZ, uHole, uSnowTop, uLogDepth/uLogFar, place(worldPerKm, cameraWorld, cameraKm), heightAt/heightPolar/surfacePoint, PeakCutaway(halfWidth, depth, limitDepth, uReveal, uLimit, uCrack)
**Notes:** Share the atmosphere uniforms object with the sky dome. For street views use worldPerKm ~10 with log depth + depthClearer so angles and haze stay exact; for metre-scale ledges use 1,000 m/km, a hole radius smaller than the local patch, and pick ledge sites with a gentle local slope (steep flanks hide the summit). Keep cameras a few km above heightAt (fine crags reach ~2 km). Geometry is cached per parameter set.

### `glass-of-water-v1` — Glass of water with ice cubes

Tumbler with a transmissive glass shell and water volume, a visible waterline, frosted ice cubes and small bubbles. A single sink value moves the cubes between floating (about a tenth above the waterline) and resting on the bottom, staggered per cube.

**Tags:** glass, water, ice, kitchen, macro, prop, density
**Parameters:** radius, baseRadius, height, waterLevel, cubes, cubeSize, waterTint, seed, sink, bubbleAge, time_s, setWaterLevel(level)
**Notes:** Units are metres. Needs scene.environment (for example sky-dome-v1 toEnvironment) for convincing reflections; glass and water use three.js physical transmission, so objects behind them must be opaque to appear refracted. setWaterLevel(level), added for rain-nonstop-everywhere, rebuilds the water to the glass taper for filling or draining shots; radius = baseRadius gives a straight measuring cylinder.

### `grass-field-v1` — Wind-bent grass field

Instanced grass blades over any ground function with a rejection test, bent along a circular arc by a force-proportional wind bend, travelling gusts and flutter; wrap and back-light shading, flower-tipped blades, distance fog and a relight setter for other times of day.

**Tags:** grass, meadow, turf, vegetation, wind, field, cliff, nature
**Parameters:** area, count, ground, reject, minHeight, maxHeight, width, baseColor, tipColor, dryColor, flowerFraction, flowerColor, sunDirection, sunColor, skyColor, fogColor, fogDensity, seed, wind.bend, wind.direction, wind.gust, wind.gustSpeed, setLight(), time_s, growth
**Notes:** Doubling wind.bend shows a wind that pushes twice as hard (small-angle approximation). Grass does not receive shadows; the ground under it does. growth 0..1 (default 1), added for rain-nonstop-everywhere, raises blades in a staggered order for sprouting time-lapses; a noise-based reject gives sparse tufts.

### `grass-field-v2` — Lush grass field v2 with wildflowers

Dense instanced tufts of curved, tapered blades (per-blade lean, curl, height, width) lit by the real scene lights through MeshStandardMaterial (receives sun shadows, lamps, moonlight, sky environment) plus back-lit translucency; per-blade and field-scale colour (lush, bleached, dry straw patches), darker turf base, density highest around a focus point and thinning with distance while far blades widen; optional daisy-like wildflowers on swaying stems; travelling wind gusts.

**Tags:** grass, meadow, field, flowers, wind, vegetation, landscape
**Parameters:** area, ground(x,z), reject(x,z), focus, nearRadius, falloff, density, maxTufts, blades, minHeight, maxHeight, width, rootColor, midColor, tipColor, lushColor, dryColor, dryness, patchScale, translucency, rootShade, flowers.count, flowers.colors, flowers.size, seed, growth, update(time_s, wind)
**Notes:** Put the focus where the cameras work (130 tufts/m² × 5 blades within ~9 m reads lush); the mesh is excluded from AO/DOF depth passes automatically (userData.noDepthFx). Successor of grass-field-v1 (still available for older films). Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `harbour-basin-v1` — Stone harbour basin with tide-aware moored boats

Metre-scale stone harbour: ashlar quay walls with tide staining keyed to mean sea level, coping, stone steps, iron ladders, bollards, a railing, granite-paved quays and plaza (with holes for other surfaces such as a street), a mud floor heightfield whose channel shoals before the landward quay, breakwater arms with a red-and-white lighthouse and a soft rotating beam, quay lamps with optional point lights, and moored yachts (sailboat-v1) or fishing boats that float on the current sea level and ground and heel on the mud as it falls.

**Tags:** harbour, harbor, port, tide, quay, boats, lighthouse, flood, coast, town
**Parameters:** seed, halfWidth, headZ, mouthZ, sideQuayWidth, mouthHalfWidth, quayTop, meanSea, floorWall, floorChannel, lighthouse (1, -1, 0), boats [{kind, x, z, heading, length, color, seed, groundHeel}], lamps [[x, z]], lights, pavingHoles, update(time_s, seaLevel, beamAngle), floorAt(x, z), boatState(boat, time_s, seaLevel), setLamps(level(i)), beamStrength, lampHeads, lampLights, bollards, lighthouseLamp, lighthouseTop
**Notes:** The water surface is supplied by the caller (e.g. ocean-surface-v1 at the same level). Defaults: quay top y = 0, mean sea 2.2 m below, floor 4-6 m below mean sea. Boats keep their spec position; override b.g for drifting boats after update(). Static parts are merged by material.

### `hdri-environments-v1` — HDRI sky environments (CC0)

Five 1k equirectangular HDRIs (partly cloudy noon, sunset, dusk, overcast-bright, night street) for image-based lighting and reflections via loadEnvironment(renderer, base, id).

**Tags:** hdri, environment, ibl, reflections, night, sunset, cc0
**Parameters:** loadEnvironment(renderer, base, id | "room")
**Notes:** Files in assets/library/hdri/; provenance in assets/library/polyhaven.lock.json. Prefer PhysicalSky.bakeEnvironment when the scene has a moving sun; use HDRIs for static interiors, streets and look development. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `history-ribbon-v1` — Historical data ribbon

Three-dimensional extruded time-series ribbon driven by supplied annual data.

**Tags:** history, data, diagram
**Parameters:** data, width, height, maxValue, color, fraction
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `horn-coral-v1` — Rugose horn corals

Instanced solitary rugose (horn) corals of Palaeozoic reefs: curved widening cups with yearly constriction bands, normal-mapped fine growth ridges, radial septa in the calyx and a swaying polyp crown.

**Tags:** coral, fossil, devonian, palaeozoic, reef, underwater, paleontology, growth-rings, marine-life
**Parameters:** count, area, ground, reject, minSize, maxSize, bands, ridgesPerBand, bodyColor, polypColor, seed, time_s, items (read-only)
**Notes:** Ridge density is schematic (real daily ridges are about 0.1 mm apart). Seat on Underwater.floorHeight; update(time_s) only sways the crowns. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `human-figure-v2` — HumanV2 sculpted, skinned people

Procedurally sculpted, skinned humans: smooth monotone-cubic body/head profiles, faces with lids, irises and brows, ears, hands with fingers, bare feet with toes, 11 hairstyles, tops/bottoms/dresses in photo-scanned fabrics with set-in sleeves, shoes and strappy sandals, glasses and hats; a 17-bone skeleton driven by HumanoidPose (walkPose/idlePose), eyesClosed for sleepers, HumanV2.random(seed) for varied crowds (skin tones, ages, builds, outfits). Skin uses wrap lighting with a warm terminator scatter band (cheap subsurface look); tops drape from the bust and belly instead of shrink-wrapping creases; fabrics tile at real-world scale.

**Tags:** human, person, character, crowd, walk, clothing, skinned, variety
**Parameters:** height, sex, build, age, skin, eyes, hair.style, hair.color, top, topColor, bottom, bottomColor, shoes, shoeColor, glasses, hat, hatColor, beard, eyesClosed, pbr, seed, setPose(pose), HumanV2.random(seed, extra), walkPose(phase, amp, base), idlePose(t, seed, base)
**Notes:** Faces +Z, origin at the feet; uses the HumanoidPose type and POSE_STAND from humanoid-figure-v1 (same setPose semantics). Stylised but solid at medium and full-body framing; keep faces at medium distance. Walk phase = t·|v|·4.4 gives a natural stride. Lying sleepers: root.rotation.x = −π/2 and tent the duvet over the upturned feet. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

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

### `insect-swarm-v1` — Butterflies, bees and fireflies

Instanced insects wandering around a home volume on smooth deterministic paths: butterflies with shader-flapped painted wings (monarch, morpho, cabbage white, swallowtail), striped bees with blurred wings, and blinking firefly glow points.

**Tags:** insect, butterfly, bee, firefly, meadow, garden, night
**Parameters:** kind, count, seed, center, radius, height, size, patterns, color, update(t)
**Notes:** 

### `interior-kit-v1` — Interior dressing kit

Pleated curtains on a rod (optional sheer, gentle billow), framed pictures with procedurally painted art (landscape, seascape, abstract, botanical), patterned rugs with fringes (kilim, border, stripes), and a bookshelf filled with varied books.

**Tags:** interior, room, curtains, picture, art, rug, bookshelf, books, furniture, home
**Parameters:** Curtains.width, height, color, openFraction, pbr, fabricSet, sheer, update(time_s, breeze), FramedPicture.width, height, art, frameColor, mat, seed, Rug.width, length, colors, pattern, seed, Bookshelf.width, height, depth, shelves, fill, seed, pbr, woodTint
**Notes:** Seeded and deterministic; pair with room-box-v1 shells. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `light-beam-v1` — Soft volumetric light beam

Additive open-cone beam whose brightness falls off toward its silhouette (no hard geometric edges), along its length and near the camera, for lighthouse beams, street-lamp cones, spotlights and searchlights.

**Tags:** light, beam, volumetric, lamp, lighthouse, spotlight, fx, night
**Parameters:** length, radius, color, intensity, edge, falloff, nearFade, radialSegments, level, beamGeometry(), beamMaterial()
**Notes:** Template apex at the origin opening along −Y (rotate the geometry or mesh). Excluded from depth effects automatically. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `lighthouse-v1` — Coastal lighthouse with sweeping beams

Tapered banded stone tower, gallery and railing, glazed lantern, keeper's cottage, and at night a glowing lamp with twin rotating soft beams that flare as they sweep across the camera.

**Tags:** lighthouse, coast, sea, night, beam, landmark
**Parameters:** height, bandColor, rpm, beamLength, pbr, night, update(time_s, camera)
**Notes:** Pass the camera to update() for the beam flare. Beam angle = time × rpm, deterministic. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `lightning-v1` — Forked lightning with flash

Seeded fractal cloud-to-ground bolts with forks drawn as camera-facing additive ribbons, a stroke sequence (stepped leader, return stroke, re-strikes) and a flash level for driving lights or sky exposure.

**Tags:** weather, storm, lightning, thunder, flash
**Parameters:** color, width, strike(at_s, from, to, seed), update(t), flash
**Notes:** Drive a PointLight (decay 0) with flash x ~6.

### `loft-helpers-v1` — Organic loft and limb modeling helpers

loftGeometry() lofts elliptical, smoothly varying cross-sections along a Catmull-Rom spine (optional radial displacement and caps), limbGeometry() makes rounded tapered limbs, paintVertices() writes per-vertex colours from a position/normal function, spotField() gives noise spots.

**Tags:** modeling, loft, organic, helpers
**Parameters:** spine, rx[], ry[], radial, segments, up, caps, displace
**Notes:** 

### `magnetic-field-lines-v1` — Dipole magnetic field lines

Schematic dipole magnetic field around a planet: lines r = L·R·sin²θ from pole to pole as thin additive tubes with pulses flowing along them. strength fades the field with the outer shells going first; loops seen edge-on fade so they never cut a straight streak across the planet.

**Tags:** magnetic-field, magnetosphere, dipole, space, earth, planet, schematic, dynamo
**Parameters:** radius, shells (L values), linesPerShell, thickness, color, axis, seed, strength, time_s
**Notes:** Add next to (not inside) the planet so it does not spin with the surface. 4 shells × 8 lines reads cleanly at 1080×1920; more becomes hairy. Label as schematic: real field lines are invisible and extend much farther.

### `meteor-streaks-v1` — Meteor streaks with ionisation trains

Deterministic meteors as instanced camera-facing ribbons: a hot white-green head, an orange trail that grows behind it and fades, and a faint green ionisation train that lingers after the head burns out. Explicit spawn list or seeded scatter inside a box; additive, depth-tested.

**Tags:** meteor, shooting-star, space, upper-atmosphere, particles, night-sky
**Parameters:** meteors [{at_s, life_s, start, velocity, trail, width, brightness}], count, seed, window, box, velocity, speedJitter, trail, width, life, gain
**Notes:** Units are the stage's world units (km in the 80 km shot: trails 7-12 km, widths 35-70 m, ~37 km/s). Spawn in the camera's own frame and in open air: meteors placed inside terrain are depth-hidden.

### `milky-way-sky-v1` — Milky Way and deep star field sky

HDR night/space sky: five layers of crisp hashed stars (temperature tints, denser in the band), the Milky Way with central bulge, dust lanes and pink/blue nebulae, aimable with center/along. Ground mode adds horizon extinction, airglow, low-altitude twinkle and a light-pollution dome. GLSL_GALAXY is self-contained so other sky shaders can include it (physical-sky-v1 does at night).

**Tags:** sky, stars, milky-way, galaxy, night, space, astronomy, starry-night
**Parameters:** MilkyWaySky({stars, band, rotation | center + along, seed, ground, lightPollution, pollutionColor}), update(t, camera, outputHeight), GLSL_GALAXY, galaxyUniforms(), galaxyBasis(center, along)
**Notes:** Stars are pixel-sized for the output height; pass the camera to update() so they stay sharp when the FOV changes.

### `modeling-helpers-v1` — Procedural modeling helpers

Reusable geometry, rod, material and CanvasTexture helpers for architecture and props.

**Tags:** modeling, geometry, material
**Parameters:** geometry, material, position, textureSize
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `moon-body-v1` — Procedural rocky and icy Moon

Seeded near-side lunar maria, cratered ice, moving frost front, albedo-controlled lighting and earthshine for Moon and icy-satellite stories.

**Tags:** moon, ice, planet, space, craters, maria
**Parameters:** radius, seed, sunDirection, albedoRock, albedoIce, iceAmount, earthshine, time_s
**Notes:** Rock and ice maps are generated from seeded canvas textures; visual geography is illustrative. Use a label when showing a material transformation.

### `nature-kit-v1` — Boulders, rock scatter, shrubs, flowers, cacti

Weathered Boulder (optional PBR rock_face, moss on top), instanced RockScatter, leafy Shrub with optional blossom, FlowerPatch (instanced daisy, poppy, tulip, lavender and sunflower; stems and heads sway together in model space) and saguaro Cactus.

**Tags:** nature, rock, boulder, shrub, bush, flowers, meadow, cactus, desert
**Parameters:** Boulder({size, seed, flatten, color, pbr, mossy}), RockScatter({area, count, ground, reject}), Shrub({size, color, flowers}).update(t, wind), FlowerPatch({area, kinds, count, ground}).update(t, wind), Cactus({height, arms})
**Notes:** Lookdev: node tools/lookdev.mjs outdoors.

### `neon-district-v1` — Times Square-style neon district at night

Entertainment-district avenue: LedScreen billboards (six procedural, unbranded programmes - aurora, pop graphics with headline words, scrolling ticker, concert equaliser and spotlights, kaleidoscope, skyline promo - cycling with wipes, HDR with LED pixel structure up close), NeonSign tubes with buzz and dropouts, Marquee chase lights, glowing red bleacher steps on a plaza island, towers wrapped in screens and tickers, a stacked-screen tower closing the view, keep-right taxi traffic, lamps, signals, steam vents, RectAreaLight spill matched to the big screens and wet asphalt mirroring it through a live cube probe.

**Tags:** city, times-square, neon, billboards, night, nightlife, wet-street, reflections, traffic, urban
**Parameters:** NeonDistrict({pbr, seed, length, traffic, reflections, areaLights, baseEnvironment}), environment, update(t, renderer, scene, night, camera), LedScreen({width, height, programs, seed, cycle, brightness, pitch, curved}).glow(t), NeonSign({text, color, height, script}), Marquee({width, height}), glowingSteps()
**Notes:** Assign scene.environment = district.environment; pass a static baseEnvironment so the probe never samples its own previous frame (order-independent frames). Lookdev: node tools/lookdev.mjs timesquare.

### `newborn-hand-v1` — Articulated newborn hand

Close-view articulated newborn palm and digits with soft skin and nail details.

**Tags:** newborn, hand, human
**Parameters:** skinColor, scale, roughness, time_s, grasp
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `nightlife-kit-v1` — String lights, stage beams, LED dance floor, stage

Party dressing: StringLights catenary strands (warm or multicolour bulbs with glow and flicker), StageBeams truss of moving-head volumetric beams with a bpm-synced colour programme, LedDanceFloor tiles playing beat-synced patterns, and a stageDeck with backdrop and DJ table.

**Tags:** party, nightlife, rooftop, concert, festival, string-lights, dance-floor, stage-lights
**Parameters:** StringLights({anchors, sag, spacing, color, multicolor}).update(t, lit), StageBeams({count, span, length, bpm}).update(t, level), LedDanceFloor({width, depth, tile, bpm}).update(t), stageDeck({width, depth, height})
**Notes:** 

### `ocean-cross-section-v1` — Deep ocean cross-section

Layered ocean slice with a ridge, directional current arrows, and seeded deterministic mixing particles.

**Tags:** ocean, deep-sea, mixing, tides, schematic
**Parameters:** width, depth, seed, mixing, time_s
**Notes:** Visual vertical scale is exaggerated; currents and particles represent mixing conceptually.

### `ocean-surface-v1` — Open-water ocean surface

Flat-plane ocean with analytic multi-octave travelling-wave normals, Fresnel sky reflection, sun glitter and distance haze. Suited to eye-level and aerial views of calm to moderate seas.

**Tags:** ocean, sea, water, coast, waves
**Parameters:** size, level, deepColor, horizonColor, zenithColor, sunDirection, sunColor, waveHeight, waveScale, fogColor, fogDensity, glitter, skyScale, time_s, shore, reflectivity
**Notes:** Keep horizon and zenith colours in step with the scene sky dome. No vertex displacement, so avoid extreme close-ups of the surface. Studio v2: optional shore model (shore.origin/direction/slope/sandColor/absorption/foam) for Beer–Lambert turquoise shallows, caustics and foam lines, and reflectivity (default 1 = unchanged).

### `orbit-map-v1` — Top-down orbit map with progressive trajectories

Solar-system orbit map at true AU geometry in the XZ plane (ecliptic +y maps to world -Z): Kepler ellipses from (a, e, longitude of perihelion) and sampled trajectories drawn as glowing tubes that draw on progressively and pulse for emphasis, a granulated glowing Sun with a camera-facing corona, and caller-supplied body markers placed from ecliptic coordinates. ellipsePoint() returns a position on an orbit by longitude.

**Tags:** orbit, solar-system, diagram, kepler, trajectory, flyby, space, map
**Parameters:** unitsPerAu, sunRadius, addEllipse(id, a, e, periLonDeg, {color, radius, intensity, opacity, segments, startLonDeg}), addPath(id, points, style), setDraw(id, fraction), setGlow(id, k, opacity), addBody(id, object), setBody(id, x, y, visible), toWorld(x, y), update(time_s, camera), ellipsePoint(a, e, periLonDeg, lonDeg)
**Notes:** Rotate `group` to orient the map in a portrait frame. Markers are enlarged for visibility; orbit lines and tracks keep true AU proportions. Pass the camera to update() so the corona faces it.

### `overcast-shell-v1` — Planet-wide cloud shell

Sphere of slowly drifting fractal cloud for planets: coverage grows from scattered patches to one unbroken overcast deck, sunlit with billow shading on the day side and dark at night.

**Tags:** clouds, planet, earth, venus, overcast, atmosphere, space
**Parameters:** radius, scale, coverage, color, shadowColor, sunDirection, seed, time_s
**Notes:** Add to the planet group at about 1.006–1.01 × the planet radius. With earth-globe-v1, raise Earth.scatter as coverage grows so the blue limb still reads as Earth.

### `overlay-labels-v1` — Schematic label and callout helpers

2D canvas helpers for SCHEMATIC / ILLUSTRATIVE tags, status chips, leader-line callouts that flip to stay inside the frame, and rich text with numeric subscripts (O_2 style). renderEditorialHud() draws a boxless editorial telemetry block for top-left counters: a letter-spaced label, a large number and a spaced sub-line, white with a soft shadow.

**Tags:** labels, overlay, callout, schematic, typography
**Parameters:** size, weight, color, alpha, tracking, align, accent, dot, valueColor, sub, renderEditorialHud({x,y,label,value,sub,valueSize,labelSize,tracking})
**Notes:** Use projectToScreen() from film-pipeline-v1 to anchor labels to 3D points.

### `palm-tree-v1` — Coconut palm

Leaning, curved ringed trunk with photo-scanned bark, a crown of arching pinnate fronds and a coconut cluster; fronds sway deterministically.

**Tags:** palm, tree, tropical, beach, vegetation, island
**Parameters:** height, lean, leanDir, fronds, seed, leafColor, pbr, update(time_s, wind)
**Notes:** Shorter palms (≈5 m) leaning over a low camera frame the sky with fronds. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `pbr-materials-v1` — Photo-scanned PBR material library (CC0)

25 photo-scanned Poly Haven material sets (walls, roofs, facades, asphalt, cobbles, sand, turf, rock, gravel, wood, fabrics, leather, bark) as diffuse/normal/ARM maps, served through PBRLibrary.material(id, {tile, tint, roughness, normalScale}) with metre-tiled box-projected UVs (projectUVs).

**Tags:** pbr, materials, textures, photo-scanned, cc0, walls, fabric, sand, wood, stone
**Parameters:** PBRLibrary.load(base, ids), material(id), tile, tint, roughness, normalScale, aoIntensity, metalness, emissive, side, projectUVs(geo, scale, offset)
**Notes:** Files in assets/library/textures/pbr/<id>/ fetched by tools/fetch-assets.mjs from assets/library/polyhaven.manifest.json; SHA-256 provenance in assets/library/polyhaven.lock.json. Load only the sets a film uses (one await per film). Tints above 1 (material.color.setRGB) brighten dark albedos, e.g. tropical sand. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `pedestrian-crowd-v1` — Deterministic articulated pedestrian crossing

Crowd built from the registered Humanoid rig with seeded overlapping heights and skin/clothing palettes, children, umbrellas, backpacks, opposite crossing directions, analytic gait, deceleration and head turns. Optional per-figure flags invoke the reusable dissolve effect and analytic prop drops.

**Tags:** crowd, people, pedestrians, crosswalk, gait, umbrella, bicycle
**Parameters:** seed, count, width, depth, speedRange, heightRange, childFraction, flagFraction, umbrellaCount, dissolve, clock_s, vanishStart_s, dissolveEnabled, survivorStop_s, visibleCount, time_s
**Notes:** Uses humanoid-figure-v1 and vanish-dissolve-v1. Every pose and path is evaluated from absolute caller time; passing identical clock/state reproduces the opening configuration. Figures are intended for respectful medium views and silhouettes, not facial closeups. Validated in local Chrome WebGL smoke captures (opening, dissolve, survivors, aerial, memorial and repair crew); no shader errors. For close views of umbrellas, set umbrellaCount: 0, attach makeUmbrella() to each figure root and hold it with Humanoid.reachArm after update(); pass clock_s from the shot start to keep the seeded spacing.

### `penguin-colony-v1` — Emperor penguin colony

Instanced vertex-coloured emperor penguins (adults with yellow ear patches, grey downy chicks beside them) with a gentle deterministic sway and shuffle.

**Tags:** penguin, animal, antarctic, wildlife, colony, birds
**Parameters:** adults, chicks, seed, spread, height, time_s
**Notes:** Stand the group on a flat surface at its local y = 0. Designed for mid-distance shots (birds about 100–250 px tall).

### `physical-sky-v1` — Physical sky with clouds, sun and stars

Preetham-style scattering sky dome with camera-like adaptive exposure, golden-hour colour, extended twilight band, true-size limb-darkened sun, sun-lit self-shadowed 2.5D drifting clouds, night gradient and seeded stars; bakes a PMREM environment for reflections. Optional Milky Way at night (galaxy, galaxyCenter, galaxyAlong) from milky-way-sky-v1.

**Tags:** sky, atmosphere, sunrise, sunset, twilight, clouds, stars, environment-map, exterior
**Parameters:** turbidity, rayleigh, mieCoefficient, mieDirectionalG, goldenSaturation, goldenExposure, exposure, sunIntensity, sunSize, cloudCover, cloudScale, cloudWind, cloudColor, stars, seed, nightZenith, nightHorizon, setSun(dir), update(time_s), follow(camera), bakeEnvironment(renderer), horizonColor(), zenithColor(), galaxy, galaxyCenter, galaxyAlong
**Notes:** Call setSun every frame from a computed solar vector, follow(camera) after the camera moves, and re-bake the environment when the Sun has moved a few degrees. Feed horizonColor/zenithColor to OceanSurface and fog so the whole scene shares one sky. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `planet-cutaway-v1` — Planet cutaway (layered interior)

Planet with a quarter wedge (object-space x > 0, z > 0) cut to the centre: a lit textured surface shell with an atmosphere halo, plus two flat cut faces that draw the layers at true radii: thin crust, mantle (mottled, with optional animated convection loops), molten outer core (domain-warped flow) and a crystalline inner core. A freezing front can turn the outer core into dark crystalline metal still glowing red along the grain boundaries.

**Tags:** earth, planet, interior, core, mantle, cutaway, geology, magnetism, cross-section
**Parameters:** radius, surface texture or surfaceColor, layers (innerCore, outerCore, crust radii), colors, sunDirection, atmosphereColor, atmosphereStrength, outerCoreSolid, freezeRadius, mantleFlow, innerEdgePulse, glow, spin, pointOn(local), time_s
**Notes:** Defaults are Earth's layer radii (inner core 1,221 km, core–mantle boundary 3,480 km, crust ~35 km). Rotate `group` to aim the wedge; place the camera in the removed quadrant (e.g. direction (1, 0.4, 1)) to see both faces. spin turns the surface map while the cut stays put. Use pointOn() with a point on a face (x = 0 or z = 0 in the cutaway frame) to anchor labels. Pair with magnetic-field-lines-v1 for dynamo stories.

### `planetary-ring-system-v1` — Procedural multi-band planetary ring system with shadow cutout

Multi-band concentric ring disc with Cassini and Encke divisions, ice/rock radial color gradient, and real-time planetary shadow cylinder cutout on the anti-solar side.

**Tags:** rings, saturn, earth, planet, space, orbit, shadow
**Parameters:** innerRadius, outerRadius, planetRadius, tiltDeg, sunDirection, colorInner, colorOuter, opacity, seed, time_s
**Notes:** Attach to earth-globe-v1 group for orbital views, or position in world space above sky-dome-v1 for ground-level ring-arch and shadow-winter views.

### `plastic-bottle-v1` — Crumpling plastic bottle

Clear PET bottle (ribbed lathe shell with physical transmission, ribbed screw cap, optional label band). A crumple value caves the walls in along seeded concave faces, crossing folds and wrinkles until the inside volume is roughly halved, as a sealed bottle would under one extra atmosphere; base, neck and cap stay rigid.

**Tags:** bottle, plastic, pressure, altitude, crumple, prop, macro, kitchen
**Parameters:** height, radius, seed, tint, labelColor, capColor, crumple
**Notes:** Deformation and normals are computed in the vertex shader from the crumple value alone (values slightly above 1 give an overshoot). Negative crumple values are not supported; to show a bottle swelling at altitude, add a separate parameter rather than reusing crumple.

### `plate-drift-globe-v1` — Plate-drift Earth (continents as moving plates)

Earth whose continents are separate plates: each plate is the NASA day map cut by the land mask inside lon/lat boxes, drawn on its own sphere layer and rotated rigidly about an Euler pole from today's map (progress 0) to a target arrangement (progress 1). Ocean sphere with sun glint and atmosphere rim, optional glowing mid-ocean ridge, and two schematic overlays measured on the sphere: a dry interior and a hot glow. Ships PANGAEA_PLATES (a Pangaea-like fit with Africa and Eurasia fixed), MID_ATLANTIC_RIDGE and geoDir().

**Tags:** earth, globe, plate-tectonics, continents, pangaea, supercontinent, continental-drift, geology, space
**Parameters:** radius, sunDirection, plates (name, boxes{lon, lat, ragged}, pole + angle or from/to/spin), viewLon, viewLat, oceanColor, deepColor, atmosphereColor, atmosphereStrength, glint, ridge, setView(lon, lat), setProgress(p, perPlateOverrides), pointOn(lon, lat, plate?), setDryness(amount, center, radius), setHeat(amount, center, radius), ridgeGlow, time_s
**Notes:** Needs earth-textures-nasa-v1 (day map and land mask). PANGAEA_PLATES poles were fitted to matched coastlines and refined on the land mask for snug seams with little overlap; the arrangement is schematic, not a reconstruction. Boxes with ragged > 0 cut land along a noisy edge so a departing plate leaves a natural coastline (fixed land and plates still tile exactly). For close views set sunDirection every frame from the camera (key light behind and above the camera) and lower glint to about 0.25. pointOn() gives world positions for labels and camera targets on a moving plate.

### `population-pyramid-v1` — Population pyramid

Age by sex bar diagram fed by caller-provided counts in millions; no built-in demographic scenario.

**Tags:** population, demography, diagram
**Parameters:** maxAge, step, millionsPerUnit, color, depth, male, female
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `port-diorama-kit-v1` — Port diorama kit

Procedural container stacks, cranes, yard lights and working waterfront scenery.

**Tags:** port, industry, crane
**Parameters:** seed, cranes, containerRows, truckCount, palette, lightsOn, stopAt_s, stopDuration_s, time_s
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `quadruped-v1` — Parametric four-legged animals (16 species)

One lofted, fur-sheen-shaded generator with presets for dog, shepherd, dalmatian, terrier, cat, horse, zebra, deer, elephant, wolf, fox, bear, sheep, pig, lion and giraffe: painted coats (belly shading, saddles, spots, tabby and zebra stripes, giraffe reticulation, dark points), three-segment legs with hooves or paws, manes, antlers, ossicones, trunk, tusks, wool and snouts. pose(t, {gait}) runs idle breathing, walk (lateral sequence), trot (diagonal pairs) and gallop with a matching speed(gait) for moving the root, plus head look/graze, tail wag and ear flicks.

**Tags:** animal, quadruped, dog, cat, horse, zebra, deer, elephant, wolf, fox, bear, sheep, pig, lion, giraffe, wildlife, farm, pet, gait
**Parameters:** species, seed, scale, coat, belly, accent, antlers, pose(t, {gait, headYaw, headPitch, graze, tailWag, earFlick, phase}), speed(gait), headWorld()
**Notes:** Metres, facing +Z, feet on y = 0. Individuals vary slightly by seed. Lookdev: node tools/lookdev.mjs animals. Stylised (lofted, no fur cards); reads best at mid distance.

### `rain-v1` — Rain streaks, splash rings and rain shafts

Deterministic rain kit. Rain: instanced camera-facing streaks stretched along each drop's velocity, fixed in world space and recycled in a box around the camera; intensity reveals anything from a few drops to a steady fall. RainSplashes: expanding splash rings on puddles, a glass of water or a wet table. RainShaft: soft distant rain curtains hanging from a cloud base.

**Tags:** rain, weather, drizzle, storm, splash, particles, fx
**Parameters:** count, seed, box, fallSpeed, wind, streakLength, width, minPx, heightPx, color, brightness, opacity, groundY, near, far, intensity, time_s, RainSplashes: size|radius, cell, period, life, ringScale, lineWidth, color, opacity, seed, intensity, RainShaft: width, height, color, opacity, fallSpeed, seed
**Notes:** Call update(time_s, camera) every frame; positions are a pure function of time. The streak material is double-sided because the quad's screen winding flips with the fall direction. For readable drizzle at 1080×1920 use width ≈ 2 mm, opacity ≈ 0.45, fallSpeed ≈ 4 m/s, streakLength ≈ 0.25 m; heavier rain: more drops, longer streaks.

### `right-whale-v1` — North Atlantic right whale

Procedural right whale rig with caudal and pectoral motion and visible callosity details.

**Tags:** whale, ocean, marine-life
**Parameters:** length, preset, callositySeed, flukePeriod_s, skinColor, quality, time_s
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `road-vehicles-v1` — Road vehicles: cars, taxi, police, ambulance, van, bus, truck

Unbranded procedural vehicles: sedan, hatch, SUV, pickup, taxi, police, ambulance, van, city bus and box truck. Bevelled side-profile bodies with wheel arches, tapered glass greenhouses with painted pillars and roofs, clear-coat paint, lathed tyres with spoked rims, mirrors, door seams, generic plates, head/tail/brake/indicator lamps, taxi sign, police and ambulance livery with flashing light bars.

**Tags:** vehicle, car, traffic, taxi, police, ambulance, bus, truck, van, pickup, street, city
**Parameters:** kind, color, seed, plate, lit, indicator, brake, siren, update(t, distance)
**Notes:** Length along X, front toward -X, wheels on y = 0; rotate the group for lane direction. CityKit Car extends Vehicle. Lookdev: node tools/lookdev.mjs street.

### `rocky-planet-v1` — Procedural rocky planet (Mars-like)

Procedural rocky planet, Mars-like by default: seamless 3D-noise terrain colours, dark plains, crater bowls with bright rims, polar caps and a thin haze rim, lit by one sun; no textures needed.

**Tags:** mars, planet, rocky-planet, exoplanet, space, craters, procedural
**Parameters:** radius, seed, palette, craters, capSize, capColor, atmosphereColor, atmosphereStrength, sunDirection
**Notes:** Spin via group.rotation. Change palette/capSize/atmosphere for other worlds (e.g. grey airless moons, icy exoplanets). Pair with solar-wind-stream-v1 for atmosphere-loss scenes.

### `room-box-v1` — Modular room kit

Reusable furnished room shell and table, chair, cup and plant builders.

**Tags:** interior, room, furniture
**Parameters:** width, height, depth, wallColor, floorColor, ceiling, window{wall,center,sill,width,height,frameColor}, bed(parent,x,z,{width,length,frameColor,sheetColor,duvetColor})
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames. Optional window opening (back/left/right wall, framed, with mullions) and a bed() helper added for earth-six-hour-day; rooms without a window are built exactly as before.

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

### `seismometer-v1` — Seismometer with schematic trace

Generic instrument, cable and synthetic trace for vibration illustrations.

**Tags:** seismic, instrument, trace
**Parameters:** radius, color, traceWidth, time_s, amplitude
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `shader-noise-math-v1` — Shared shader noise and deterministic math

GLSL value-noise and fbm chunks plus a fog helper (glsl.ts), with seeded RNG, value noise, fbm, ridged multifractal, easing and wobble helpers (math.ts) used by every library component.

**Tags:** noise, glsl, math, random, utility, shader
**Parameters:** seed, octaves, gain, lacunarity
**Notes:** Companion file: src/library/util/math.ts.

### `ship-bridge-v1` — Ship bridge

Unbranded working vessel bridge with windows, helm and navigation displays.

**Tags:** ship, bridge, interior
**Parameters:** width, autopilotHeading, practicalWarmth, nightMode
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

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
**Notes:** Move points.position to keep the volume around the camera. Sprite sizes are authored for 1080-wide output. A negative fallSpeed makes particles rise (used as illustrative evaporation over the sea in rain-nonstop-everywhere).

### `solar-orbit-diagram-v1` — Solar orbital geometry and Kepler race

Configurable orbital tracks, comparison markers, reference annulus and procedural solar beacon. Marker periods follow Kepler’s third law. All lengths are diagram units.

**Tags:** orbit, sun, kepler, solar-system, schematic
**Parameters:** baselineAu, targetAu, unitsPerAu, center, sunRadius, markerRadius, habitableInnerAu, habitableOuterAu, segments, time_s, orbitProgress
**Notes:** Annulus is a user-defined reference band, not a computed habitable-zone boundary. Label schematic and not to scale.

### `solar-panel-array-v1` — Ground-mounted solar panel array

Rows of tilted photovoltaic panels with a canvas-drawn cell grid (silver busbars on dark blue cells), clearcoat glass, aluminium frames, rails and steel posts. wetness makes the glass glossier so it mirrors the sky.

**Tags:** solar, energy, panels, electricity, infrastructure, prop
**Parameters:** rows, cols, panelSize, tilt, rowSpacing, gap, clearance, cellColor, frameColor, wetness
**Notes:** The group origin is the centre of the array on the ground and panels face +Z. Give the scene an environment map (for example SkyDome.toEnvironment) for convincing reflections.

### `solar-system-v1` — Sun and planets (cinematic compressed scale)

Sun with warped granulation, soft intergranular lanes, sunspots, limb darkening and a streaming corona; Mercury, Venus, Earth (NASA textures with its Moon, or a stand-in), Mars, Jupiter (Great Red Spot), Saturn (rings), Uranus (tilted) and Neptune (dark spot) on glowing orbit rings with an asteroid belt; every body is lit from the Sun each frame; orbits follow a visually compressed Kepler law.

**Tags:** space, solar-system, sun, planets, saturn, jupiter, orbits, astronomy
**Parameters:** SolarSystem({scale, earthTextures, timeScale, orbits, belt}), update(t, camera), planetWorld(name), radiusOf(name), orbitOpacity, Sun({radius, brightness})
**Notes:** Hide orbit rings for Sun close-ups (they cross the disk). Lookdev: node tools/lookdev.mjs nightsky / showcase.

### `solar-wind-stream-v1` — Solar-wind particle stream

Schematic solar-wind streaks flowing along +X past a planet at the origin. shield = 1 bends the stream around a paraboloid magnetopause; shield = 0 lets it strike the upper atmosphere with a brief flash. escape grows a faint plume of ions leaving the night side.

**Tags:** solar-wind, space-weather, magnetosphere, atmosphere-loss, mars, particles, space, schematic
**Parameters:** count, seed, radius, upstream, downstream, width, speed, atmosphere, standoff, color, plumeColor, plumeCount, shield, escape, amount, time_s
**Notes:** Rotate or position `group` so +X points away from the Sun. Frame wide (planet ~45% of the width) so both the incoming stream and the plume show. Particles and plume are vastly exaggerated: label as schematic.

### `songbird-v1` — White-crowned sparrow

Parameterized songbird with feather layers, beak, legs and poseable head.

**Tags:** bird, songbird, wildlife
**Parameters:** preset, length, seed, quality, songEnvelope, headTurn, tailFlick, time_s
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `sound-rings-v1` — Schematic sound rings

Deterministic circular acoustic-wave illustration for ground, air or underwater scenes.

**Tags:** sound, wave, diagram
**Parameters:** mode, color, maxRadius, thickness, opacity, speedVisual, emissionRate, count, amplitude, time_s
**Notes:** Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.

### `spacecraft-v1` — Rocket with exhaust plume, satellite, space station

Generic two-stage Rocket (lathed tanks, fairing, fins, engine bells) with a RocketPlume shader (hot core, Mach shock diamonds, flicker, expansion with altitude), Satellite (gold-foil bus, solar wings, dish, thrusters) and a modular SpaceStation (truss, pressurised modules, radiators, four rotating solar array pairs).

**Tags:** space, rocket, launch, plume, satellite, space-station, orbit
**Parameters:** Rocket({radius, height, engines, livery}), Rocket.ascent(t), update(t, throttle, altitude01), Satellite.update(t, wingAngle), SpaceStation({scale}).update(t, arrayAngle)
**Notes:** Satellite foil needs scene.environment for reflections. Lookdev: node tools/lookdev.mjs space.

### `starfield-v1` — Seeded starfield

Point-sprite star shell with a power-law brightness distribution and blackbody-like tints; optional horizon cut-off for terrestrial night skies.

**Tags:** stars, space, night-sky, background
**Parameters:** seed, count, radius, brightness, maxSize, minY
**Notes:** Static by design; call follow(camera) each frame. Sprite sizes are authored in pixels for 1080-wide output.

### `street-furniture-v1` — Street furniture set

Generic urban props: traffic signal with a deterministic green/amber/red cycle and pedestrian head, fire hydrant, slatted bench, litter bin, mailbox, bus shelter with a back-lit abstract advert, bollards, traffic cones, parking meter and a manhole cover.

**Tags:** street, city, props, traffic-light, hydrant, bench, bus-stop, bollard, cone
**Parameters:** TrafficLight({height, arm}).update(t, force?), cycle, offset, BusShelter.lit, FireHydrant(color), Bench({length, wood}), Mailbox(color), TrafficCone(height)
**Notes:** Origins at the base, fronts toward +Z.

### `sun-skylight-rig-v1` — Sun and skylight lighting rig with horizon-clipped sun disc

Outdoor light split into physical parts: a shadow-casting sun DirectionalLight scaled by the visible disc fraction, scattered skylight (a visible SkyDome plus its share of a cached PMREM environment bake), sunlit-ground bounce in the bake’s lower hemisphere, and aerial haze (FogExp2 scaled with skylight). A world-space sun disc at true angular size with mild limb darkening and a round in-eye glare sprite is depth-tested, so sea, hills or buildings clip it at the real horizon.

**Tags:** lighting, sky, sun, atmosphere, sunset, sunrise, shadows
**Parameters:** zenithColor, horizonColor, hazeColor, hazeAmount, sunGlow, groundColor, discAngularRadius, discDistance, discRadiance, glareAngularRadius, glareStrength, shadowMapSize, envCacheSize, apply(scene,camera,{sunDirection,sunIntensity,sunColor,horizon,skyAmount,groundAmount,envIntensity,hazeDensity,focus,shadowHalfWidth,shadowHalfHeight,shadowDepth}), SunSkylightRig.discFraction(altitude,horizon,radius)
**Notes:** apply() sets the full lighting state every frame from its arguments; environment bakes are cached by quantised sky/ground/sun-direction keys (oldest disposed), so frames are identical after any seek order. Environment provides both sky fill and ground bounce without occlusion: shaded upward-facing ground goes black when skyAmount is 0, vertical surfaces keep some bounce. The disc billboard sits at discDistance; keep it inside the camera far plane. Low suns produce strong grazing specular glare on rough ground: lower exposure or raise roughness rather than adding light.

### `sundial-v1` — Horizontal garden sundial

Turned stone pedestal with a bronze horizontal dial: latitude-correct hour lines (tan θ = sin φ · tan H), Roman numerals and a gnomon whose style edge points at the celestial pole, so the renderer's real cast shadow tells solar time.

**Tags:** sundial, time, sun, shadow, day-length, latitude, prop, garden, astronomy
**Parameters:** dialRadius, pedestalHeight, latitudeDeg, hoursPerDay, firstHour, lastHour, stoneColor, metalColor, seed, faceY (read-only), styleDirection (read-only), pbr, stoneSet
**Notes:** Local frame: north along −Z, east +X; rotate the group to align north. Static: drive time with the scene's sun direction and enable shadows (gnomon casts, dial receives). Canvas-engraved face with Playfair/Georgia numerals. Studio v2: optional pbr/stoneSet adds photo-scanned stone relief to the pedestal. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository.

### `swimming-pool-field-v1` — Metre-scale swimming-pool field

Dimensioned instanced pool basins with absolute fill fraction.

**Tags:** water, volume, capacity, comparison
**Parameters:** columns, rows, width, length, depth, gap, waterColor, setFill(fraction), center(index)
**Notes:** Absolute fraction controls fill; physical dimensions match capacity. Grounded volume comparison, not a structural-engineering or fluid solver. Moving review required in the creating film.

### `synchronized-jump-motion-v1` — Synchronized Jump Motion

Analytic crouch, ballistic leap and landing driver for existing humanoid rigs.

**Tags:** human, jump, ballistic, motion, physics
**Parameters:** height, gravity, start_s, crouch_s, settle_s, time_s
**Notes:** Original parameterised Three.js code validated in Chrome WebGL storyboard frame captures. All motion is evaluated from caller time. Crowd silhouettes are for mid-distance/aerial use. Recoil display displacement is independently exaggerated and requires a schematic label; mass ratio is used only for the physical displacement calculation.

### `terrain-massif-v1` — Fractal mountain massif with altitude contour

Seeded ridged-multifractal mountain that falls to sea level at its edges, vertex-coloured by altitude and slope (forest, rock, snow). setContour() draws a glowing iso-altitude line measured in real scene metres.

**Tags:** mountain, terrain, island, altitude, contour, landscape
**Parameters:** seed, width, depth, segmentsX, segmentsZ, peakHeight, snowLine, treeLine, contourColor, setContour(altitude,strength,width)
**Notes:** mesh.position.y is the base (sea) level. terrain.peak gives the summit in mesh-local coordinates for framing. Uses scene fog for aerial perspective.

### `thumbnail-title-card-v1` — Thumbnail cover composer (bold or clean)

Video thumbnails and covers drawn over a clean film still. Bold (default): punch-in on the subject with a punchier grade and vignette, huge tilted Inter Black capitals with a heavy outline and hard shadow, yellow highlight words, a red sticker and a yellow arrow to the subject. Clean: calm centred headline title card with an accent bar. Text stays inside the band that survives grid crops and app buttons.

**Tags:** thumbnail, cover, headline, title, typography, overlay, publishing, clickbait, sticker, arrow
**Parameters:** headline, highlight, position, width, height, fontFamily, weight, color, accent, maxSize, minSize, maxLines, widthFrac, safeTop, safeBottom, uppercase, scrim, style, badge, badgeAt, focus, zoom, anchor, arrow, grade, tilt, highlightColor, badgeColor, arrowColor, font (THUMB_FONTS), grade (THUMB_GRADES), palette: text, highlight, badge, badge_text, arrow
**Notes:** composeBoldThumbnail (default) and drawThumbnailTitle (style "clean") in the same module. src/entry.ts renderThumbnail() feeds the storyboard thumbnail block (badge_at -> badgeAt) over FilmPipeline.renderFrame(i, { overlay: false, captions: false }); tools/render.mjs writes output/<slug>.jpg after --final, or alone with --thumbnail. Long sticker text shrinks to about 64% of the width. Bold style needs Inter 900 / 900 italic (font-inter-v1). Style varies per video: font from THUMB_FONTS (font-display-set-v1), colour grade from THUMB_GRADES, palette colours and tilt.

### `tidal-bulge-v1` — Schematic tidal-potential contours

Colored contours around a planet for multiple tide-raising bodies, with amplitude and direction controls.

**Tags:** tides, moon, sun, ocean, schematic
**Parameters:** radius, colors, bodies, direction, amplitude, phase
**Notes:** Diagram contours are exaggerated and distances are not to scale; label accordingly.

### `tidal-flat-v1` — Procedural intertidal estuary

Seeded mudflat heightfield with branching channels, marsh tufts, and a clipped water sheet controlled by tide level.

**Tags:** tides, estuary, mudflat, coast, water, habitat
**Parameters:** size, seed, tideLevel
**Notes:** Illustrative local topography; low tide is a smaller tideLevel value.

### `tornado-v1` — Tornado funnel with debris

Lathed tornado funnel with rotating, upward-spiralling condensation bands, sinuous meander, sun-lit shading, orbiting instanced debris and a ground dust skirt.

**Tags:** weather, tornado, storm, wind, debris, disaster
**Parameters:** height, base, top, sunDirection, color, debris, update(t, density)
**Notes:** 

### `underwater-volume-v1` — Shallow underwater environment

Complete shallow-sea set seen from below the surface: rippling Snell-window surface, camera-aligned sun shafts, caustic-lit sand and rocks, swaying seagrass, drifting particles and an optional bubble burst.

**Tags:** underwater, ocean, reef, sea, caustics, light-shafts, seagrass, bubbles
**Parameters:** depth, extent, waterColor, deepColor, surfaceColor, sunDirection, rayStrength, rayCount, causticScale, causticStrength, fogDensity, grassCount, particleCount, seed, setBubbleBurst(t0,origin), time_s, backdrop.visible, surface.visible, rockCount, floorHeight(x, z)
**Notes:** Surface at local y = 0. Exposes fogColor and fogDensity so other objects (for example fish-school-v1) can match the water. backdrop and surface meshes are now public so a stage can hide them above water or under an ice sheet. air-pressure-doubled guarded NaN-prone pow() calls in the shaft and caustic shaders and the floor normal. floorHeight(x, z) returns the exact sand height for seating props (e.g. corals); rockCount shows only the first N of the 16 seeded rocks without changing the random sequence.

### `vanish-dissolve-v1` — Deterministic material erosion and sideways motes

Material modifier that clones source materials and adds reversible world-space threshold erosion with a soft emissive rim. Seeded short-lived motes drift along a configurable vector without an automatic upward bias.

**Tags:** disappear, dissolve, particles, material, fx
**Parameters:** seed, duration_s, noiseScale, edgeWidth, rimColor, rimIntensity, moteCount, moteLifetime_s, moteDrift, start_s, origin, enabled, time_s
**Notes:** Attach motes separately beside the source object. update(time_s,start_s,origin,enabled) returns progress. Cloned MeshStandardMaterial programs share one shader cache key at the default material configuration. All temporal state is supplied by the caller. Validated in local Chrome WebGL smoke captures (opening, dissolve, survivors, aerial, memorial and repair crew); no shader errors.

### `village-houses-v1` — Village of small gabled houses

Seeded houses at given sites and headings: walls in a pastel palette, overhanging gabled roofs, doors, lit and dark windows, optional stilts, merged into four draw calls. glow scales the window light for dusk, storms or lightning.

**Tags:** houses, village, town, buildings, architecture, coast, settlement, people
**Parameters:** sites [x, z, yaw], ground(x, z), seed, width, depth, height, roofPitch, wallColors, roofColors, windowColor, litFraction, stilts, glow
**Notes:** Yaw 0 faces +Z (−π/2 faces −X). Windows are unlit emissive quads that still take scene fog, so lit windows glow through rain haze; read best from 15–80 m. Pair with pedestrian-crowd-v1 for inhabited scenes.

### `voice-cast-v1` — Voice cast and segment planner

Default Kokoro voice cast (calm male narrator, warm co-host, character voices) and the rules that turn a storyboard 1.2.0 scene into voiced segments with natural hand-over gaps.

**Tags:** voice, tts, kokoro, narration, cast, dialogue
**Parameters:** DEFAULT_CAST, castOf(story, override), sceneSegments(scene, cast), SEGMENT_GAP_S
**Notes:** Used by tools/narrate.mjs; audio.voice_cast in the storyboard overrides voices and speeds. Restored on branch manthan from the 2026-10-15 studio-v2 stash; its film (earth-six-hour-day) is not in this repository. Not wired into the current tools/narrate.mjs (one voice per film; use voice_id blends for a distinct narrator). Kept as the design for a future multi-voice cast.

### `voice-chain-v1` — Voice finishing chain (loudness match, broadcast EQ/de-ess/compression, convolution room)

Deterministic DSP for synthesized narration, used by tools/narrate.mjs on the whole voice timeline: integratedLoudness() (ITU-R BS.1770-4 K-weighted, gated; within ~0.15 LU of FFmpeg ebur128), levelTo() per-scene loudness matching, voiceChain() (24 dB/oct rumble cut at 72 Hz, -2.2 dB at 290 Hz, +2.4 dB presence at 3.3 kHz, +1 dB air, sibilant-only split-band de-esser, ~4 dB soft-knee compression with 4 ms attack) and addRoom() (FFT overlap-add convolution with a seeded small-room impulse: sparse early reflections and a diffuse tail whose highs decay first). No added latency, so caption timing is unchanged.

**Tags:** voice, audio, eq, compressor, de-esser, mix
**Parameters:** VOICE_TARGET_LUFS, compress({threshold, ratio, knee, attack, release, makeup}, stats), deEss({split, threshold, ratio}, stats), voiceChain(x, sr, stats), addRoom(x, sr, {mix, rt60, predelay, seed}), convolve(x, h), integratedLoudness(x, sr), levelTo(x, sr, target, maxDb)
**Notes:** Thresholds are set for speech leveled to -18 LUFS (levelTo first). narration.json records per-scene measured loudness, gains and the mean de-ess/compression reduction under "finishing". A/B samples: build/voice-finish-review/narration-before.wav vs narration-after.wav (local).

### `volcano-v1` — Erupting volcano

Procedural volcanic cone: noise-carved basalt with radial gullies and a summit crater, emissive lava flows with pulses moving downhill, a glowing crater, ballistic lava fountains and a billowing ash plume lit orange from below.

**Tags:** volcano, lava, eruption, geology, mountain, ash, disaster, terrain
**Parameters:** height, radius, crater, seed, segments, rockColor, lavaColor, plumeColor, sunDirection, sunColor, ambient, fogColor, fogDensity, ejecta, puffs, channels [angle, length], groundRelief, eruption, lavaGlow, heightAt(x, z), time_s
**Notes:** Reads best at blue hour or night where the lava is the main light; aim a long channel at the camera (channels uses atan2(z, x) angles). Keep cameras above heightAt(x, z) + ~40 m. Units are metres (cone ~1.2 km by default).

### `vortex-debris-pull-v1` — Deterministic singularity / vortex debris accretion rig

Event-horizon core with relativistic photon ring and instanced urban/terrain debris chunks that lift and spiral inward in staggered distance order.

**Tags:** black-hole, vortex, tornado, debris, destruction, gravity, fx
**Parameters:** seed, count, origin, fieldRadius, coreRadius, showCore, ringColor, progress, time_s
**Notes:** Pair with city-street-block-v1 (carLiftProgress, roofLiftProgress) and pedestrian-crowd-v1 (vortexPull) for sequential urban accretion.

### `water-molecules-v1` — Schematic water molecules: liquid to ice lattice

Instanced H2O molecules that morph between a jostling liquid and an open hexagonal ice lattice with hydrogen-bond lines. The liquid arrangement occupies about 9% less volume, matching real water.

**Tags:** water, ice, molecules, chemistry, schematic, diagram, lattice
**Parameters:** seed, cells, layers, bond, oxygenColor, hydrogenColor, bondColor, liquidScale, freeze, time_s
**Notes:** Always label as schematic and not to scale. halfSize gives the ice-state bounding box for outline boxes; view down +Z to reveal the hexagons.

### `water-photolysis-v1` — Water photolysis and hydrogen escape diagram

Bent water molecules dissociate into hydroxyl and hydrogen; a UV ray and deterministic escape trajectory explain net upper-atmosphere chemistry.

**Tags:** water, photolysis, hydrogen, uv, atmosphere, schematic
**Parameters:** count, spacing, scale, escapeHeight, time_s, progress
**Notes:** Simplified H2O + photon -> OH + H schematic. Trajectories are explanatory, not a molecular dynamics or escape-rate simulation.

### `water-service-station-v1` — Water Service Station

Generic storage tank, manifold and metal tap for public water-service scenes.

**Tags:** water, infrastructure, tank, plumbing
**Parameters:** tankRadius, tankHeight, pipeRadius, color, flow
**Notes:** Original parameterised Three.js code validated in Chrome WebGL storyboard frame captures. All motion is evaluated from caller time. Crowd silhouettes are for mid-distance/aerial use. Recoil display displacement is independently exaggerated and requires a schematic label; mass ratio is used only for the physical displacement calculation.

### `water-volume-tank-v1` — Capacity-derived grounded water tank

Grounded framed cubic tank whose internal capacity follows liters.

**Tags:** water, volume, capacity, comparison
**Parameters:** liters, color, setFill(fraction)
**Notes:** Absolute fraction controls fill; physical dimensions match capacity. Grounded volume comparison, not a structural-engineering or fluid solver. Moving review required in the creating film.

### `wpp2024-world-graphics-v1` — UN WPP 2024 world population graphics data

World historical totals and 2026 age-by-sex bars extracted from UN WPP 2024; five-year groups divided evenly for schematic single-year bars; future retention is an explicitly illustrative scenario.

**Tags:** population, demography, data
**Parameters:** year, age, sex
**Notes:** UN DESA Population Division, World Population Prospects 2024, https://population.un.org/wpp/ . The age bars are schematic and future retention is illustrative.
