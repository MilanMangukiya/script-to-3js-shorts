"""Download small World extracts from public UN WPP 2024 bulk CSV streams."""
import csv,gzip,io,json,urllib.request,urllib.error
from pathlib import Path
BASE='https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/'
OUT=Path('assets/library/data/wpp2024');OUT.mkdir(parents=True,exist_ok=True)
def world(filename,years):
    url=BASE+filename+'.csv.gz'
    print('Reading',filename,flush=True)
    response=urllib.request.urlopen(url,timeout=90)
    rows=[]; seen=False
    with io.TextIOWrapper(gzip.GzipFile(fileobj=response),encoding='utf-8-sig') as stream:
        for r in csv.DictReader(stream):
            if r.get('Location')=='World' or r.get('LocID')=='900':
                seen=True
                if int(r['Time']) in years: rows.append(r)
            elif seen:break
    if not rows:raise RuntimeError('No World observations: '+filename)
    (OUT/(filename+'.world.json')).write_text(json.dumps({'source':url,'rows':rows},indent=2),encoding='utf-8')
    print(len(rows),'observations',str(rows[0])[:500],flush=True)
if not (OUT/'WPP2024_Demographic_Indicators_Medium.world.json').exists():world('WPP2024_Demographic_Indicators_Medium',range(1950,2027))
for names in [
 ['WPP2024_Population1JanuaryBySingleAgeSex_Medium','WPP2024_Population1JulyBySingleAgeSex_Medium','WPP2024_PopulationByAge1GroupSex_Medium'],
 ['WPP2024_Life_Table_Complete_Medium_Female','WPP2024_Life_Table_Complete_Medium_Female_2024-2100','WPP2024_Life_Table_Complete_Medium_Female_2024-2100_Full']
]:
    for name in names:
        try:
            world(name,[2026]);break
        except urllib.error.HTTPError as e:
            if e.code!=404:raise
            print('Not found:',name,flush=True)
