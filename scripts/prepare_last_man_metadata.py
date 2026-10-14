"""Publishing copy for the rendered last-man film; finalizer records successful render time."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
slug = 'last-man-alive'
story = json.loads((ROOT/'stories'/f'{slug}.json').read_text(encoding='utf8'))
question = story['distribution']['comment_bait_question']
scope = ('One-time fictional disappearance of every already-born male person except the adult viewer; women, girls, pregnancies, embryos and stored sperm remain. '
         'A newborn boy could arrive moments after the event while the viewer remains the only adult man. '
         'IMO-WISTA 2024 surveyed organisations reported women as 1% of seafarers, not all maritime employees. '
         'WHO reports women as 67% of global health and social care workers, not every hospital specialty. '
         'Vehicle crashes, emergency overload, shipping disruption and local repairs are plausible illustrative consequences without predicted global counts or deadlines. '
         'Stored sperm can be used in fertility treatment if maintenance, resources and appropriate consent remain available. Recovery is conditional.')
sources = '\n'.join(f'- {s["name"]}: {s["url"]}' for s in story['scientific_model']['sources'])
desc = ("You're at a crossing when the men beside you vanish. The women stay. In this 55-second 3D science thought experiment, you're the only adult man left.\n\n"
        'Follow the consequences from driverless cars to stalled cargo shipping and surviving clinicians. Then the twist: pregnancies continue, so boys can be born after the event. Preserved sperm also keeps genetic contributions from other men available if clinics can continue treatment.\n\n'
        f'{question}\n\nScope: {scope}\n\nSources:\n{sources}\n\nVisuals: original deterministic Three.js animation; NASA Blue Marble/Black Marble Earth imagery. Voice: local Kokoro am_michael. Music and Foley: original procedural synthesis.')
keywords = ['what if you were the last man alive', 'last man on earth women remain', 'population science thought experiment', 'human biology simulation', 'cryopreservation', 'infrastructure staffing']
meta = dict(schema_version='1.0.0', slug=slug, topic=story['project']['topic'], duration_s=55,
            video_file=f'output/{slug}.mp4', scientific_scope_note=scope, created_asset_ids=[],
            reused_asset_ids=[a['asset_id'] for a in story['asset_plan']['existing_assets_to_reuse']], published_urls={}, platforms={})
meta['platforms']['youtube_shorts'] = dict(title='What if you were the last man alive?', description=desc,
    tags=keywords + ['last adult man', 'demography explained', 'what if men disappeared', 'science simulation', 'threejs documentary'],
    hashtags=['#Shorts', '#WhatIf', '#Demography', '#HumanBiology', '#Cryopreservation', '#ScienceSimulation', '#3DAnimation'], keywords=keywords)
meta['platforms']['tiktok'] = dict(caption=("You're at a crossing when every other man vanishes. Women remain. Driverless cars move, shipping loses crews, and surviving clinicians keep working. But pregnancies and preserved sperm change what your survival means.\n\n"
    f'{question}\n\nA one-time science thought experiment; recovery depends on people, resources and functioning clinics.'),
    hashtags=['#WhatIf', '#ScienceTok', '#Demography', '#HumanBiology', '#ScienceSimulation', '#Cryopreservation'], keywords=keywords)
meta['platforms']['instagram_reels'] = dict(caption=("You're the only adult man left, standing at a crossing full of surviving women. The immediate problem is missing workers. The surprising part is what remains in maternity wards and cryogenic storage.\n\n"
    f'{question}\n\nOne-time disappearance: pregnancies, embryos and stored sperm remain. The aftermath is conditional; this film makes no extinction forecast.'),
    hashtags=['#WhatIf', '#ScienceReels', '#Demography', '#HumanBiology', '#Cryopreservation', '#ScienceSimulation', '#3DAnimation'], keywords=keywords)
meta['platforms']['facebook_reels'] = dict(title='What if you were the last man alive? Women remain', description=("You're at a crossing when the men beside you vanish. Women and girls remain, and you're the exception. This 3D thought experiment follows driverless traffic, shipping disruption, surviving healthcare workers and the pregnancy and stored-sperm twist.\n\n"
    f'{question}\n\n{scope}\n\nSources:\n{sources}'),
    hashtags=['#WhatIf', '#Science', '#Demography', '#HumanBiology', '#Cryopreservation', '#ScienceSimulation'], keywords=keywords)
meta['platforms']['x_video'] = dict(post=("You're at a crossing when every other man vanishes. Pregnancies and preserved sperm change what comes next. " + question),
    hashtags=['#WhatIf', '#Demography', '#Biology', '#Science', '#ScienceSimulation'], keywords=keywords[:3])
(ROOT/'metadata'/f'{slug}.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False)+'\n', encoding='utf8')
print(f'Prepared metadata/{slug}.json')
