"""Complete the interrupted user storyboard and document its corrected physical model."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SLUG = 'every-human-jumped-at-once'
attachment = Path(r'C:\Users\MILAN\.codex\attachments\3c8aa35d-2660-4351-ba67-4d2814c0749d\Pasted text.txt')
raw = attachment.read_text(encoding='utf-8')
cut = raw.index('    {\n      "id": "S03"')
story = json.loads(raw[:cut].rstrip().rstrip(',') + '\n]}')

story['project']['core_question'] = 'Could a synchronized human jump change Earth\'s orbit, and what would actually matter?'
story['project']['viewer_takeaway'] = 'Humanity is about twelve trillion times less massive than Earth. Internal jumping cannot boost the Earth-human system\'s orbit; a concentrated crowd creates a much greater infrastructure problem.'
model = story['scientific_model']
model['baseline_reality'] = 'Use a fixed illustrative population of 8.2 billion (UN 2024 baseline), mean body mass 62 kg, Earth mass 5.9722e24 kg and g=9.81 m/s2. This is not a live 2026 population count.'
model['counterfactual_change'] = 'Idealized perfectly synchronized 0.30 m center-of-mass jumps, first in one zone and then at normal home locations. All people being able to jump and safe crowd clearance are counterfactual assumptions.'
model['assumptions'] = ['Population 8.2e9 and assumed mean mass 62 kg: total 5.084e11 kg.', 'Jump height 0.30 m, takeoff speed sqrt(2gh)=2.43 m/s, flight time 0.495 s.', 'Use an isolated Earth-human system during the brief jump, subtracting common solar free fall.', 'Five people per square metre gives 1640 km2 of bodies alone. This dangerous density cannot provide safe real jumping space; roads and infrastructure would require additional area.', 'Aerial crowds show representative blocks; schematics and recoil are explicitly not to scale.']
model['causal_chain'] = ['Earth/human mass ratio 1.175e13, approximately twelve trillion.', 'At apex, terrestrial recoil is Mh/(Me+Mh)*0.30 = 2.55e-14 m, about 25 femtometres. This is larger than a proton, but approximately 4000 times smaller than a representative 1e-10 m atom.', 'In the isolated model the system center of mass stays fixed. Landing reverses the relative displacement; there is no orbital propulsion.', 'Landing potential energy Mh*g*h = 1.50e12 J, distributed over the crowd and dissipated into tissue, shoes, surface deformation, heat, sound and seismic vibration.', 'No reliable single earthquake magnitude or sound level follows from total energy alone; coupling, coherence, geometry and ground response are unknown.', 'Concentrating the population overwhelms water, transport and medical capacity; distributed jumps give differently directed impulses and additional partial vector cancellation.']
model['uncertainties'] = ['The 62 kg mean body mass is an illustrative assumption, not a measured current global total.', 'Seismic coupling, synchronization, local geology and acoustic propagation are unspecified; no quantitative quake magnitude or decibel prediction is made.', 'Human populations are unevenly distributed, so opposing radial impulses do not cancel exactly.', 'The film assumes a leap is possible and shows representative spacing; the 1640 km2 estimate includes only tightly packed bodies.']
claims = [
 ('Humanity has approximately 5.1e11 kg mass; Earth is approximately twelve trillion times more massive.', 'established', '8.2e9 * 62 kg; NASA Earth mass 5.9722e24 kg.', '62 kg is assumed. Label diagrams not to scale.'),
 ('A concentrated 30 cm jump produces approximately 2.55e-14 m recoil, far smaller than an atom; the system center of mass receives no orbital boost.', 'derived', 'Center-of-mass balance: deltaEarth = -Mh/(Me+Mh)*h. NIST proton radius is 0.84 fm, so the original less-than-a-proton comparison is false.', 'Use atom, not proton, comparison; show exaggerated motion and no orbital boost in isolated model.'),
 ('Total landing potential energy is approximately 1.5 trillion joules.', 'derived', 'E = 5.084e11 * 9.81 * .30 = 1.496e12 J.', 'Distributed low-speed impacts; sound rings are illustrative, not destructive shock fronts.'),
 ('The impact is cushioned; total energy does not establish a particular earthquake magnitude.', 'plausible', 'Unknown energy coupling and spatial coherence preclude a unique seismic prediction; USGS distinguishes radiated energy, magnitude and intensity.', 'Synthetic instrument trace, no magnitude label, collapse or cracking.'),
 ('At five people per square metre, bodies alone occupy 1640 km2; concentrating humanity creates a severe supply and transport problem.', 'derived', '8.2e9 / 5 / 1e6 = 1640 km2; excludes all infrastructure and safe movement space.', 'Label density as dangerous and body-area only; logistics scenes are illustrative.'),
 ('At home locations, differently directed radial impulses partly cancel; internal jumping still provides no orbital propulsion.', 'established', 'Vector addition of radial impulses, not exact cancellation for uneven populations; conservation of total system momentum.', 'Schematic arrows; actual population is uneven.')]
model['claims'] = [dict(id=f'CL{i:02}',statement=a,confidence=b,reasoning=c,presentation_guardrail=d) for i,(a,b,c,d) in enumerate(claims,1)]
model['sources'] = [
 dict(name='NASA Earth Fact Sheet',url='https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',supports_claim_ids=['CL01','CL02','CL03']),
 dict(name='UN World Population Prospects 2024, Summary of Results (8.2 billion baseline)',url='https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/wpp2024_summary_of_results_final_web.pdf',supports_claim_ids=['CL01','CL05']),
 dict(name='NIST CODATA 2022 proton charge radius; correction to supplied proton comparison',url='https://physics.nist.gov/cgi-bin/cuu/Value?rp',supports_claim_ids=['CL02']),
 dict(name='USGS Earthquake Magnitude, Energy Release, and Shaking Intensity',url='https://www.usgs.gov/programs/earthquake-hazards/earthquake-magnitude-energy-release-and-shaking-intensity',supports_claim_ids=['CL04'])]
story['creative_direction']['logline'] = 'One synchronized jump barely recoils the planet; getting humanity into and out of one crowded city is the real problem.'
story['creative_direction']['emotional_arc'][2] = 'Understand center-of-mass conservation and an atomic-scale recoil.'
story['creative_direction']['opening_hook'] = 'A low street view shows a synchronized 30 cm leap, clean shoe clearance and illustrative landing rings.'
story['creative_direction']['ending_payoff'] = 'Return from serene Earth to the opening street, ending on the same resting crowd pose and camera.'
story['creative_direction']['world_scale_policy'] = 'Urban shots use metres; body-area, mass and atomic-scale recoil diagrams are explicitly schematic and not to scale.'
story['captions']['style'] = 'Two-line balanced captions with dark translucent backdrop pill, Inter Bold, active-word yellow.'

def shot(i,a,b,title,stage,p0,p1,target0,target1=None,fov=38):
    return dict(id=f'SH{i:02}',start_s=a,end_s=b,shot_type=title,world=stage,
      camera=dict(projection='perspective',fov_or_scale=fov,keyframes=[dict(t_s=a,position=p0,look_at=target0,ease='smoothstep'),dict(t_s=b,position=p1,look_at=target1 or target0,ease='smoothstep')],movement='Motivated smooth dolly or crane between the exact storyboard endpoints.',lens_notes='Portrait cinematic framing; preserve the lower caption band.'),
      subjects=[dict(id=title.lower().replace(' ','-'),kind='diagram' if 'schematic' in title.lower() else 'other',appearance=title,geometry_and_material=stage,scale_and_accuracy='Urban shots use metres. Physics and world-scale representations carry explicit schematic labels.',movement='Analytic frame-time evaluation; seeded geometry.')],
      animation_plan=['Evaluate all motion from frameIndex / 30; no accumulated state.'],lighting='Warm directional key with soft environment fill; studio cyan and brass accents for diagrams.',effects=['Restrained bloom and film grade'],composition_notes='Main subject at upper-middle; clear captions around y=1380.')

def scene(i,a,b,beat,text,payoff,shots,ids,accent):
    return dict(id=f'S{i:02}',beat=beat,start_s=a,end_s=b,viewer_question=payoff,visual_payoff=payoff,narration=dict(text=text,start_s=a+.2,end_s=b-.2,delivery_note='Calm peaceful warm male documentary delivery.'),shots=shots,caption_emphasis=[dict(phrase=accent,treatment='accent_color')],audio_cues=[],claim_ids=ids,transition_out=dict(type='cut',duration_s=0,motivation='Cut on the causal change or match the circular shape.'))

# Keep the supplied opening two scenes, but use reviewed camera positions and diagram definitions.
story['scenes'][0]['shots'][0]['camera'] = shot(1,0,4.5,'Opening street','Metre-scale city street',[0,1.05,10.5],[0,1.0,9.3],[0,1.05,-1.2],fov=40)['camera']
story['scenes'][0]['shots'][0]['animation_plan'] = ['Crouch at 1.6..2.1 seconds; true 0.30 m parabolic flight at 2.1..2.595 seconds; absorb the landing through knees; illustrative rings emit on landing.']
story['scenes'][0]['shots'][0]['subjects'][0]['geometry_and_material'] = 'Registered pedestrian-crowd-v1 with 24 foreground figures, umbrellaCount 0; synchronized-jump-motion-v1 drives their existing joints. Instanced crowd-field-v1 supplies distant people.'
story['scenes'][0]['shots'][0]['subjects'][0]['movement'] = 'Exact 0.30 m jump, flight time 0.495 s, analytic knee absorption.'
story['scenes'][1]['shots'] = [shot(1,4.5,8,'Orbital Earth','NASA-textured Earth and seeded stars',[0,.5,4.5],[.18,.5,4.1],[0,0,0],fov=39),shot(2,8,11.5,'Mass-ratio schematic','Studio brass beam, Earth and human pedestal',[-.1,1.55,6],[-.1,1.4,5.5],[0,.65,0],fov=38)]
story['scenes'][1]['shots'][1]['subjects'][0]['scale_and_accuracy'] = 'SCHEMATIC - NOT TO SCALE. Sphere radii and balance beam are illustrative, not logarithmically encoded mass.'
story['scenes'][1]['narration']['text'] = 'Eight billion people weigh five hundred million tons. Earth is twelve trillion times more massive.'
story['scenes'][1]['caption_emphasis'] = [dict(phrase='twelve trillion',treatment='accent_color')]
story['scenes'] += [
 scene(3,11.5,19.5,'mechanism',"Crowded together, we shift Earth by a fraction of an atom's width. Landing reverses that recoil.",'A jumping human platform and Earth recoil around a fixed system center of mass.',[
  shot(1,11.5,15.5,'Recoil schematic','Studio center-of-mass instrument',[.2,1.4,5.6],[0,1.2,5.1],[0,.65,0]),
  shot(2,15.5,19.5,'Returning center-of-mass schematic','Same studio instrument viewed from a second motivated angle',[-.7,1.25,4.8],[.2,1.25,5.2],[0,.65,0])],['CL02'],"atom's width."),
 scene(4,19.5,26,'escalation','The landing releases roughly one point five trillion joules, spread across billions of feet.','Slow-motion feet meet pavement; camera rises over illustrative golden sound rings.',[
  shot(1,19.5,22.8,'Slow-motion landing','Metre-scale city and articulated crowd',[-.65,.35,2.1],[-.42,.28,1.8],[0,.30,0],fov=44),
  shot(2,22.8,26,'Sound-wave crane','City street with schematic ground acoustic rings',[2.5,12,17],[5,20,24],[0,0,-3],fov=44)],['CL03'],'trillion joules,'),
 scene(5,26,33.5,'mechanism','Knees, shoes, and soil cushion the impact. A roar and local vibrations, not a planet-shattering quake.','A cushioned landing followed by a close view of a modest synthetic seismometer trace.',[
  shot(1,26,29.5,'Cushioned landing','Metre-scale figure knees and shoes against tactile asphalt',[.4,.70,2.4],[.1,.60,2.05],[0,.65,0],fov=38),
  shot(2,29.5,33.5,'Seismometer macro','Precision metal instrument on a ground-level concrete plinth',[.15,.65,1.65],[.10,.62,1.4],[.1,.32,0],fov=39)],['CL04'],'cushion the impact.'),
 scene(6,33.5,41.5,'human_impact','But gathering everyone takes sixteen hundred square kilometers, packed dangerously tight. And then everyone needs to leave.','Aerial crowd district followed by a clearly schematic body-area grid.',[
  shot(1,33.5,38,'Crowded city aerial','Representative dense crowd blocks around the registered city avenue',[12,55,60],[30,100,95],[0,0,-15],fov=43),
  shot(2,38,41.5,'Crowd-area schematic','Forty by forty-one kilometre diagram with miniature city extrusions',[27,57,56],[20,50,50],[0,0,0],fov=43)],['CL05'],'dangerously tight.'),
 scene(7,41.5,50,'second_order_effect','Water runs short. Roads jam. Clinics fill. The real crisis is supporting humanity in one place.','Respectful water queue, blocked street and busy clinic corridor.',[
  shot(1,41.5,44.5,'Water queue','City service station, pressure gauge, tanker and calm waiting crowd',[2.6,1.6,6.4],[2.25,1.5,5.8],[0,1.1,0],fov=40),
  shot(2,44.5,47,'Road gridlock','Unbranded vehicles stopped between pedestrian queues',[-3.8,5.4,14],[-3.0,6.5,12.2],[0,1,-12],fov=42),
  shot(3,47,50,'Clinic corridor','Registered furnished clinic with respectfully waiting human figures',[0,1.65,7],[.2,1.65,5.8],[0,1.3,-4],fov=45)],['CL05'],'one place.'),
 scene(8,50,57.5,'twist','Jump where we live, and pushes in different directions partly cancel. Earth barely notices.','Orbital Earth with opposite radial impulse arrows; uneven population is acknowledged.',[
  shot(1,50,57.5,'Distributed-jump schematic','NASA Earth, stars and opposing radial impulse vectors',[0,.45,5.4],[.25,.55,5.0],[0,0,0],fov=43)],['CL06','CL02'],'partly cancel.'),
 scene(9,57.5,63,'ending',"Our orbit stays steady. The bigger question? How does everyone get home?",'Serene orbital Earth returns to the original street-level crowd pose.',[
  shot(1,57.5,60,'Serene Earth','NASA-textured Earth and seeded starfield',[.1,.4,4.5],[0,.35,4.2],[0,0,0],fov=39),
  shot(2,60,63,'Return to street','Exact opening city, lighting, crowd and camera',[0,1.0,9.3],[0,1.05,10.5],[0,1.05,-1.2],fov=40)],['CL02','CL05'],'get home?')]
reused = ['earth-globe-v1','earth-textures-nasa-v1','starfield-v1','sky-dome-v1','city-street-block-v1','pedestrian-crowd-v1','humanoid-figure-v1','sound-rings-v1','seismometer-v1','dial-gauge-v1','clinic-interior-v1','film-pipeline-v1','camera-keyframe-rig-v1','caption-kinetic-v1','overlay-labels-v1','audio-synth-kit-v1','font-inter-v1','thumbnail-title-card-v1','font-display-set-v1','modeling-helpers-v1','shader-noise-math-v1']
new = [
 ('synchronized-jump-motion-v1','Analytic crouch, ballistic leap and landing driver for existing humanoid rigs.','src/library/characters/SynchronizedJump.ts',['height','gravity','start_s','crouch_s','settle_s','time_s']),
 ('center-of-mass-recoil-diagram-v1','Parameterised two-body recoil apparatus with a fixed center-of-mass crosshair.','src/library/diagram/CenterOfMassRecoil.ts',['massRatio','jumpHeight','visualRecoil','progress','landingProgress']),
 ('crowd-field-v1','Seeded instanced clothed human silhouettes for dense mid-distance and aerial crowds.','src/library/characters/CrowdField.ts',['seed','width','depth','spacing','height','density','jumpHeight','time_s']),
 ('water-service-station-v1','Generic storage tank, manifold and metal tap for public water-service scenes.','src/library/props/WaterServiceStation.ts',['tankRadius','tankHeight','pipeRadius','color','flow'])]
story['asset_plan'] = dict(library_mode='reuse_before_create',library_snapshot_note='Existing IDs verified against the actual registry before implementation; the attached storyboard was cut off during S03.',existing_assets_to_reuse=[dict(asset_id=x,usage='Reuse registered component in the completed film or its rendering and audio pipeline.',configuration='Story-specific parameters and deterministic absolute frame time.') for x in reused],new_reusable_asset_candidates=[dict(proposed_id=i,description=d,reusable_in='Future physics, crowd, infrastructure and urban documentaries.',parameters=p,suggested_path=f) for i,d,f,p in new],shot_specific_assets=['Mass-ratio brass beam stage','Schematic 1640 km2 body-area district','Street supply queues and gridlock arrangements'])
story['distribution'] = dict(primary_search_intent='What happens if everyone on Earth jumps at the same time?',core_keywords=['everyone jumps at once','Earth recoil','conservation of momentum','human population mass','simultaneous jump earthquake','crowd logistics'],distinctive_angle='Atomic-scale recoil versus a city-scale supply crisis, with an explicit correction to the proton misconception.',seo_integrity_note='Descriptions reflect the completed shots and cite the illustrative population, density and unknown ground coupling; no SEO guarantees.')
story['delivery'] = dict(video_output=f'output/{SLUG}.mp4',video_codec='h264',pixel_format='yuv420p',audio_codec='aac',audio_sample_rate_hz=48000,render_method='deterministic_frame_by_frame',captions_burned_in=True,use_paid_apis=False,success_reply='absolute_mp4_path_only')
story['thumbnail'] = dict(time_s=2.35,headline='WHAT IF EVERYONE JUMPED?',highlight=['EVERYONE','JUMPED?'],position='top',badge='8.2 BILLION PEOPLE',badge_at=[.55,.79],focus=[.48,.53],anchor=[.48,.60],zoom=1.12,arrow=True,style='bold',font='anton',grade='warm',tilt=-2,palette=dict(text='#FFFFFF',highlight='#FACC15',badge='#D92D32',badge_text='#FFFFFF',arrow='#FACC15'))
# Portrait diagrams need enough horizontal field to include their entire apparatus.
for sc in story['scenes']:
    for sh in sc['shots']:
        if (sc['id'],sh['id']) == ('S02','SH02'):
            sh['camera']['keyframes'][0].update(position=[0,1.6,8.7],look_at=[0,.65,0])
            sh['camera']['keyframes'][1].update(position=[0,1.45,8.1],look_at=[0,.65,0])
        if sc['id']=='S03':
            for j,k in enumerate(sh['camera']['keyframes']):
                k['position']=[(-.3 if sh['id']=='SH02' else .1)+j*.15,1.25,8.2-j*.25]
                k['look_at']=[0,.35,0]
        if (sc['id'],sh['id'])==('S05','SH02'):
            sh['camera']['fov_or_scale']=44
            for j,k in enumerate(sh['camera']['keyframes']):k.update(position=[.1,.85,2.75-j*.15],look_at=[.1,.35,-.05])
        if (sc['id'],sh['id'])==('S07','SH01'):
            sh['camera']['fov_or_scale']=48
            for j,k in enumerate(sh['camera']['keyframes']):k.update(position=[2.3-j*.15,1.6,7.8-j*.3],look_at=[.2,1.05,-.65])
# Remove obsolete incorrect claims from the inherited visual instructions.
story['scenes'][0]['shots'][0]['animation_plan'].append('Badge: 8.2 BILLION - ILLUSTRATIVE POPULATION; sound rings are schematic.')
path = ROOT/'stories'/f'{SLUG}.json'
path.write_text(json.dumps(story,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(f'Wrote {path.name}: {len(story["scenes"])} scenes, {sum(len(s["shots"]) for s in story["scenes"])} shots.')
