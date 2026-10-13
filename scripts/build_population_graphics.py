"""Extract a tiny, attributed UN WPP dataset for this film's browser graphics."""
import json,math
from pathlib import Path
p=Path('assets/library/data/wpp2024')
history=json.loads((p/'WPP2024_Demographic_Indicators_Medium.world.json').read_text())['rows']
ages=json.loads((p/'WPP2024_PopulationByAge5GroupSex_Medium.world.json').read_text())['rows']
female=[0.0]*101
for row in ages:
    a=int(row['AgeGrpStart']);span=int(row['AgeGrpSpan']) if row['AgeGrpSpan'].isdigit() else 1
    for age in range(a,min(101,a+span)):
        female[age]=round(float(row['PopFemale'])/1000/span,4)
# The future trace is a scenario illustration. These age-specific retention factors are
# deliberately coarse, and the film labels its future pyramid SCHEMATIC.
survivors=[round(math.exp(-.0008*a-.000003*a*a-.0000008*a*a*a),6) for a in range(101)]
out={'source':'UN World Population Prospects 2024 medium variant; 2026 age data are five-year groups evenly divided into one-year schematic bars. Future survival is illustrative.',
 'history':[{'year':int(r['Time']),'value':round(float(r['TPopulation1July'])/1_000_000,5)} for r in history],
 'female':female,'survivors':survivors}
(p/'world-graphics.json').write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8')
print('Built',len(out['history']),'population years,',len(female),'age bars')
