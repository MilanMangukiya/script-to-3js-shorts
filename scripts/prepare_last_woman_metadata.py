"""Publishing copy for the last-woman film; finalizer records successful render time."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
slug = 'last-woman-alive'
story = json.loads((ROOT / 'stories' / f'{slug}.json').read_text(encoding='utf8'))
question = story['distribution']['comment_bait_question']
assert question == 'Would you tell the world you survived?'

scope = (
    'A fictional, one-time disappearance removes every other already-born woman and girl; '
    'men and boys remain, and the adult viewer is the exception. Stored eggs and embryos survive. '
    'Pregnancies carried by vanished people disappear with them; they do not continue independently. '
    'This episode additionally assumes no other survivor can carry a pregnancy. This is an extra '
    'fictional condition, not a consequence of being the last woman: reproductive anatomy is not '
    'determined by gender identity, and some men and gender-diverse people can carry pregnancies. '
    'The viewer may or may not be able to carry a pregnancy. The possible daughter appears months '
    'later, conditional on her free choice, capacity, viable embryos, appropriate donor consent, '
    'successful treatment, working clinics and sufficient support. The one-time event does not '
    'remove daughters born afterward. Frozen embryos can retain genetic contributions from many '
    'other women; the recipient does not replace those genes with her own. Preserved genes alone '
    'do not restore the population. WHO reports women at 67.2% of global health and care employment; '
    'this is a global workforce baseline, not the exact loss in a local ward or specialty. The '
    'friend, Dad\'s call, local crashes and care disruption are illustrative authored events. '
    'Current artificial-womb research has supported premature lambs and targets extreme prematurity; '
    'it does not establish conception-to-birth human gestation. The incubator shown is ordinary '
    'neonatal equipment, not an artificial womb. No guaranteed recovery, extinction deadline, '
    'universal social response or reproductive duty is claimed.'
)
sources = '\n'.join(
    f'- {source["name"]}: {source["url"]}'
    for source in story['scientific_model']['sources']
)
description = (
    "Your best friend vanishes mid-sentence. Her coffee splashes the pavement. You're still here. "
    'In this 55-second 3D science thought experiment, every other woman and girl has disappeared '
    'once, while men and boys remain.\n\n'
    "A street crisis turns personal when Dad calls: do you answer? Then comes the twist. Frozen "
    "embryos still hold other women's genetic contributions. But preserved genes need a pregnancy, "
    'and current artificial-womb research cannot replace a whole human pregnancy. A possible '
    'daughter is conditional on your choice, capacity, successful treatment and support.\n\n'
    f'{question}\n\nScope: {scope}\n\nSources:\n{sources}\n\n'
    'Visuals: original deterministic Three.js animation; NASA Blue Marble/Black Marble Earth '
    'imagery. Voice: local Kokoro am_michael. Music and Foley: original procedural synthesis.'
)
keywords = [
    'what if you were the last woman alive',
    'last woman on earth men remain',
    'population science thought experiment',
    'human biology simulation',
    'frozen embryos',
    'cryopreservation',
    'artificial womb research',
]
meta = dict(
    schema_version='1.0.0',
    slug=slug,
    topic=story['project']['topic'],
    duration_s=story['project']['duration_s'],
    video_file=f'output/{slug}.mp4',
    scientific_scope_note=scope,
    created_asset_ids=[],
    reused_asset_ids=[asset['asset_id'] for asset in story['asset_plan']['existing_assets_to_reuse']],
    published_urls={},
    platforms={},
)

meta['platforms']['youtube_shorts'] = dict(
    title='What if you were the last woman alive?',
    description=description,
    tags=keywords + ['demography explained', 'reproductive science', 'science simulation'],
    hashtags=[
        '#Shorts', '#WhatIf', '#Demography', '#HumanBiology', '#Cryopreservation',
        '#ReproductiveScience', '#ScienceSimulation', '#3DAnimation',
    ],
    keywords=keywords,
)
meta['platforms']['tiktok'] = dict(
    caption=(
        "Your best friend vanishes mid-sentence. Her coffee splashes the pavement. Then Dad calls. "
        "You're the last woman alive in a world where men remain. Do you answer?\n\n"
        "The twist is in frozen storage: other women's genes remain in embryos. Pregnancy, "
        'working clinics and your choice still matter. A daughter could be born; recovery is '
        'not guaranteed.\n\n'
        f'{question}\n\n'
        'Fictional one-time event with an extra assumption that no other survivor can carry '
        'a pregnancy. Gender alone does not establish reproductive capacity.'
    ),
    hashtags=[
        '#WhatIf', '#ScienceTok', '#Demography', '#HumanBiology', '#Cryopreservation',
        '#ReproductiveScience', '#ScienceSimulation',
    ],
    keywords=keywords,
)
meta['platforms']['instagram_reels'] = dict(
    caption=(
        "Your friend's coffee splashes the pavement. She's gone. You're still here. Every other "
        'woman and girl has vanished once, and men remain. Then your phone lights up: Dad.\n\n'
        'From the street to a strained clinic and a frozen embryo bank, this 3D thought '
        "experiment follows personal loss, hidden genetic continuity and your own choice. "
        'Preserved embryos need a pregnancy; current artificial-womb research cannot replace '
        'complete human gestation. A later daughter is only a possibility.\n\n'
        f'{question}\n\n'
        'The scenario separately assumes no other surviving potential gestator. Reproductive '
        'anatomy is not determined by gender. No reproductive duty or guaranteed recovery is assumed.'
    ),
    hashtags=[
        '#WhatIf', '#ScienceReels', '#Demography', '#HumanBiology', '#Cryopreservation',
        '#ReproductiveScience', '#ScienceSimulation', '#3DAnimation',
    ],
    keywords=keywords,
)
meta['platforms']['facebook_reels'] = dict(
    title='What if you were the last woman alive? Men remain',
    description=(
        "Your best friend vanishes, her coffee spills across the pavement, and Dad is calling. You're "
        'the only woman left after a one-time fictional event. Men and boys remain.\n\n'
        'Follow a local traffic crisis, surviving clinicians and the frozen-embryo twist: '
        "other women's genetic contributions can remain, but embryos still need gestation. "
        'A possible daughter depends on your choice, your capacity and successful care.\n\n'
        f'{question}\n\n{scope}\n\nSources:\n{sources}'
    ),
    hashtags=[
        '#WhatIf', '#Demography', '#HumanBiology', '#Cryopreservation',
        '#ReproductiveScience', '#ScienceSimulation',
    ],
    keywords=keywords,
)
meta['platforms']['x_video'] = dict(
    post=(
        "Your friend's coffee spills. Every other woman has vanished. Frozen embryos "
        f'hold a twist. {question}'
    ),
    hashtags=['#WhatIf', '#Biology', '#Demography', '#Cryopreservation', '#ScienceSimulation'],
    keywords=keywords[:3],
)
x_copy = meta['platforms']['x_video']
assert len(x_copy['post'] + ' ' + ' '.join(x_copy['hashtags'])) <= 280
assert all(5 <= len(platform['hashtags']) <= 12 for platform in meta['platforms'].values())
assert all(
    question in platform.get('description', platform.get('caption', platform.get('post', '')))
    for platform in meta['platforms'].values()
)

(ROOT / 'metadata' / f'{slug}.json').write_text(
    json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8'
)
print(f'Prepared metadata/{slug}.json')
