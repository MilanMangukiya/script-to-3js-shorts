"""Register validated reusable parts and write the upload record for this film."""
import json
from pathlib import Path
S='what-if-every-man-disappeared'
root=Path(__file__).resolve().parents[1]
registry_path=root/'assets/registry.json'
registry=json.loads(registry_path.read_text(encoding='utf-8'))
existing={a['id'] for a in registry['assets']}
city=json.loads((root/f'build/{S}/city-assets.json').read_text(encoding='utf-8'))['created_assets']
defs=[
 ('port-diorama-kit-v1','Port diorama kit','src/library/environment/PortKit.ts','Procedural container stacks, cranes, yard lights and working waterfront scenery.',['port','industry','crane'],['seed','cranes','containerRows','truckCount','palette','lightsOn','stopAt_s','stopDuration_s','time_s']),
 ('container-ship-v1','Container ship','src/library/vehicles/ContainerShip.ts','Unbranded container ship with hull, deck cargo, bridge and propeller.',['ship','ocean','transport'],['length','beam','draft','containerFill','palette','seed','deckLights','navLights','rpm','speed','pitch','time_s']),
 ('apartment-facade-v1','Apartment facade','src/library/environment/ApartmentFacade.ts','Reusable cutaway apartment wall with lit furnished rooms for intimate human scenes.',['apartment','city','interior'],['seed','floors','columns','floorHeight','windowSize','occupancy','warmth']),
 ('clinic-interior-v1','Clinic interior','src/library/environment/ClinicInterior.ts','Generic clinic corridor, rooms, practical lighting and medical furnishings.',['clinic','hospital','interior'],['corridorLength','rooms','lightingMix','seed']),
 ('ship-bridge-v1','Ship bridge','src/library/environment/ShipBridge.ts','Unbranded working vessel bridge with windows, helm and navigation displays.',['ship','bridge','interior'],['width','autopilotHeading','practicalWarmth','nightMode']),
 ('room-box-v1','Modular room kit','src/library/environment/RoomBox.ts','Reusable furnished room shell and table, chair, cup and plant builders.',['interior','room','furniture'],['width','height','depth','wallColor','floorColor','ceiling']),
 ('right-whale-v1','North Atlantic right whale','src/library/creatures/RightWhale.ts','Procedural right whale rig with caudal and pectoral motion and visible callosity details.',['whale','ocean','marine-life'],['length','preset','callositySeed','flukePeriod_s','skinColor','quality','time_s']),
 ('songbird-v1','White-crowned sparrow','src/library/creatures/Songbird.ts','Parameterized songbird with feather layers, beak, legs and poseable head.',['bird','songbird','wildlife'],['preset','length','seed','quality','songEnvelope','headTurn','tailFlick','time_s']),
 ('sound-rings-v1','Schematic sound rings','src/library/diagram/SoundRings.ts','Deterministic circular acoustic-wave illustration for ground, air or underwater scenes.',['sound','wave','diagram'],['mode','color','maxRadius','thickness','opacity','speedVisual','emissionRate','count','amplitude','time_s']),
 ('broadleaf-tree-v1','Broadleaf street tree','src/library/environment/BroadleafTree.ts','Seeded branched tree with instanced leaves and editable seasonal foliage.',['tree','vegetation','city'],['height','canopyWidth','leafCount','seed','leafColor','trunkColor','leafFraction']),
 ('population-pyramid-v1','Population pyramid','src/library/diagram/PopulationPyramid.ts','Age by sex bar diagram fed by caller-provided counts in millions; no built-in demographic scenario.',['population','demography','diagram'],['maxAge','step','millionsPerUnit','color','depth','male','female']),
 ('history-ribbon-v1','Historical data ribbon','src/library/diagram/HistoryRibbon.ts','Three-dimensional extruded time-series ribbon driven by supplied annual data.',['history','data','diagram'],['data','width','height','maxValue','color','fraction']),
 ('seismometer-v1','Seismometer with schematic trace','src/library/props/Seismometer.ts','Generic instrument, cable and synthetic trace for vibration illustrations.',['seismic','instrument','trace'],['radius','color','traceWidth','time_s','amplitude']),
 ('newborn-hand-v1','Articulated newborn hand','src/library/characters/NewbornHand.ts','Close-view articulated newborn palm and digits with soft skin and nail details.',['newborn','hand','human'],['skinColor','scale','roughness','time_s','grasp']),
 ('modeling-helpers-v1','Procedural modeling helpers','src/library/util/Modeling.ts','Reusable geometry, rod, material and CanvasTexture helpers for architecture and props.',['modeling','geometry','material'],['geometry','material','position','textureSize']),
 ('wpp2024-world-graphics-v1','UN WPP 2024 world population graphics data','assets/library/data/wpp2024/world-graphics.json','World historical totals and 2026 age-by-sex bars extracted from UN WPP 2024; five-year groups divided evenly for schematic single-year bars; future retention is an explicitly illustrative scenario.',['population','demography','data'],['year','age','sex']),
]
new=city[:]
for aid,name,path,description,tags,params in defs:
    new.append(dict(id=aid,name=name,type='data_asset' if path.endswith('.json') else 'three_component',source_path=path,description=description,tags=tags,configurable_parameters=params,created_for=S,used_in=[],license='UN WPP 2024; CC BY 3.0 IGO; attribution required' if path.endswith('.json') else 'original_procedural',notes='UN DESA Population Division, World Population Prospects 2024, https://population.un.org/wpp/ . The age bars are schematic and future retention is illustrative.' if path.endswith('.json') else 'Original procedural code. Rendered in the 75-second Three.js film and inspected in representative WebGL frames.'))
for a in new:
    if a['id'] in existing:
        if a['id'] in {x['id'] for x in city}:continue
        old=next(x for x in registry['assets'] if x['id']==a['id'])
        if old.get('created_for')==S:
            use=old.get('used_in',[])
            old.update(a)
            old['used_in']=use
        continue
    assert (root/a['source_path']).is_file(),a['source_path']
    registry['assets'].append(a)
registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
created=[a['id'] for a in new]
reused=['earth-globe-v1','earth-textures-nasa-v1','starfield-v1','flame-v1','smoke-wisp-v1','sky-dome-v1','ocean-surface-v1','cloud-deck-v1','underwater-volume-v1','fish-school-v1','bird-flock-v1','humanoid-figure-v1','caption-kinetic-v1','film-pipeline-v1','camera-keyframe-rig-v1','overlay-labels-v1','audio-synth-kit-v1','shader-noise-math-v1','font-inter-v1','bokeh-field-v1','grass-field-v1','sailboat-v1']
assert set(reused).issubset({a['id'] for a in registry['assets']})
meta={
 'schema_version':'1.0.0','slug':S,'topic':'What if every man and boy on Earth disappeared?','duration_s':75,
 'video_file':f'output/{S}.mp4',
 'scientific_scope_note':'A one-time disappearance of all human males is a thought experiment. UN WPP 2024 population figures are 2026 projections. Jobs refers to paid employment, excluding unpaid care. The 2020 ground and bird findings and 2001 right-whale study are regional measured analogs, not predictions of exact worldwide effects. Future births and recovery depend on disruption, stored sperm and human choices; the age chart and +40-year street are schematic illustrations.',
 'created_asset_ids':created,'reused_asset_ids':reused,'published_urls':{},
 'platforms':{
  'youtube_shorts':{
   'title':'What If Every Man on Earth Disappeared? The First 40 Years',
   'description':'Over four billion men and boys vanish in an instant. A 75-second cinematic thought experiment follows the empty jobs, the quieter ground and oceans, the grief, and the births that bring boys back within nine months. Twenty years later, the oldest man would be about twenty.\n\nFigures use UN World Population Prospects 2024. The measured nature examples come from Lecocq et al. (Science, 2020), Rolland et al. (Proc. R. Soc. B, 2012), and Derryberry et al. (Science, 2020). Future scenes are illustrative; disruption could alter births and recovery.\n\nSources: https://population.un.org/wpp/ ; https://doi.org/10.1126/science.abd2438 ; https://doi.org/10.1098/rspb.2011.2429 ; https://doi.org/10.1126/science.abd5777',
   'tags':['what if every man disappeared','what if men disappeared','men vanish scenario','population science','demographic thought experiment','quiet oceans','right whales ship noise','sparrows lockdown','science shorts'],
   'hashtags':['#Shorts','#WhatIf','#ScienceShorts','#Demography','#Wildlife'],
   'keywords':['what if all men vanished','what if every man disappeared','world population by sex 2026','right whales shipping noise','sparrow songs lockdown']},
  'instagram_reels':{
   'caption':'What happens after every man and boy vanishes at once? The first hours bring grief and stopped work. The oceans briefly quiet; pregnancies already underway still bring sons within nine months. This 75-second film follows the scenario through forty years, with measured wildlife analogs and an illustrative future.',
   'hashtags':['#WhatIf','#ScienceReels','#PopulationScience','#WildlifeScience','#ThreeJS'],
   'keywords':['men disappear thought experiment','2026 world population by sex','quieter oceans right whales','sparrow song urban noise','future births scenario']},
  'facebook_reels':{
   'title':'What If Every Man and Boy Disappeared?',
   'description':'A cinematic 75-second science scenario: more than four billion people vanish, jobs and shipping are disrupted, and families grieve. Real studies of quieter ground, whales and sparrows show possible short-term effects of reduced activity. Pregnancies continue; future recovery remains uncertain.',
   'hashtags':['#WhatIf','#Science','#Population','#Nature','#ShortFilm'],
   'keywords':['what if men disappeared','population thought experiment','shipping and whale noise','2020 seismic quiet','births after disappearance']},
  'tiktok':{
   'caption':'If every man and boy vanished, the world would change in hours. But the oceans would quiet only temporarily, and pregnancies already underway would bring sons back within nine months. Watch the 40-year thought experiment.',
   'hashtags':['#WhatIf','#ScienceTok','#Population','#OceanScience','#Wildlife'],
   'keywords':['men disappeared scenario','future population pyramid','right whale ship noise','sparrow song 2020','science what if']},
  'x_video':{
   'post':'If every man and boy vanished once, about 4.13 billion people would remain. This 75-second film follows disrupted work, temporary quiet, grief and later births. The future scenes are illustrative.',
   'hashtags':['#WhatIf','#Science','#Demography'],
   'keywords':['men disappeared scenario','UN population projection','temporary ocean quiet','future birth cohorts']}
 }}
path=root/f'metadata/{S}.json'
if path.exists():
    prior=json.loads(path.read_text(encoding='utf-8'))
    if prior.get('schema_version')=='1.0.0' and prior.get('slug')==S:
        for key in ('published_urls','rendered_at_utc','publishing_status','huggingface'):
            if key in prior:meta[key]=prior[key]
path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('registered',len(created),'new assets and wrote metadata JSON')
