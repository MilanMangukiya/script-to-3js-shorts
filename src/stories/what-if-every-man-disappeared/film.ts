import * as THREE from 'three';
import type {FilmDefinition,OverlayContext} from '../../library/render/FilmPipeline';
import {loadEarthTextures} from '../../library/planet/Earth';
import {drawChip,drawRich,drawTag} from '../../library/overlay/Labels';
import {CityStage} from './stages/CityStage';
import {PortStage} from './stages/PortStage';
import {ApartmentStage,ClinicStage,BridgeStage} from './stages/InteriorStage';
import {PropellerStage,WhaleStage,SparrowStage,BirdReachStage} from './stages/WildlifeStage';
import {PopulationEarthStage,SeismicStage,NewbornStage,BirthCityStage,PyramidStage,type PopulationData} from './stages/EvidenceStage';
import {smoothstep} from '../../library/util/math';
const AMBER='#efd49b',TEAL='#b3d4cd';
export async function createFilm({renderer,base}:{renderer:THREE.WebGLRenderer;base:string}):Promise<FilmDefinition>{
 const [tex,data]=await Promise.all([loadEarthTextures(base,Math.min(8,renderer.capabilities.getMaxAnisotropy())),fetch(base+'assets/library/data/wpp2024/world-graphics.json').then(r=>r.json())]);
 const city=new CityStage(renderer),earth=new PopulationEarthStage(tex,data as PopulationData),port=new PortStage(renderer),seismic=new SeismicStage(),apartment=new ApartmentStage(renderer),clinic=new ClinicStage(renderer),bridge=new BridgeStage(renderer),propeller=new PropellerStage(renderer),whale=new WhaleStage(renderer),sparrow=new SparrowStage(renderer),reach=new BirdReachStage(renderer),newborn=new NewbornStage(),births=new BirthCityStage(renderer),pyramid=new PyramidStage(data as PopulationData);
 const shots:FilmDefinition['shots']={};
 for(const [keys,stage] of [
  [['S01/SH01','S02/SH01','S10/SH01','S10/SH02'],city],[['S02/SH02'],earth],[['S03/SH01','S03/SH02'],port],[['S04/SH01','S04/SH02'],seismic],[['S05/SH01'],apartment],[['S05/SH02'],clinic],[['S05/SH03'],bridge],[['S06/SH01'],propeller],[['S06/SH02'],whale],[['S07/SH01'],sparrow],[['S07/SH02'],reach],[['S08/SH01'],newborn],[['S08/SH02'],births],[['S09/SH01','S09/SH02'],pyramid]
 ] as const)for(const key of keys)shots[key]={stage,post:{exposure:1,bloomStrength:.18,vignette:.27,grain:.008}};
 const overlay=({ctx:c,shot,time_s:t,alpha,stage}:OverlayContext)=>{c.save();c.globalAlpha=alpha;
  const tag=(v:string,y=225,size=19)=>drawTag(c,v,90,y,{size,accent:TEAL});
  const chip=(label:string,value:string,y=280)=>drawChip(c,label,value,80,y,{dot:TEAL,valueColor:AMBER});
  const sub=(v:string,y=380)=>drawRich(c,v,100,y,{size:26,color:'#eee7da'});
  switch(shot.key){
   case 'S01/SH01':if(t>.35)tag('ONE-TIME DISAPPEARANCE',225,20);break;
   case 'S02/SH01':tag('T0 · 2026');if(t>4.3){chip('MEN & BOYS','4.17 BILLION');sub('UN WPP 2024 projection',377);}break;
   case 'S02/SH02':tag('SCHEMATIC · UN WPP 2024');chip('REMAINING','≈4.13 BILLION');sub('About the world population in 1975');drawRich(c,'HISTORICAL WORLD POPULATION',540,610,{size:24,align:'center',color:TEAL});drawRich(c,'1950',185,915,{size:26,color:TEAL});drawRich(c,'2026',825,915,{size:26,color:TEAL});if(t>9.4)drawRich(c,'1975  ≈4.07 B',540,1145,{size:43,align:'center',color:AMBER,weight:700});break;
   case 'S03/SH01':tag('WITHIN A DAY · ILLUSTRATIVE');chip('PAID JOBS','6 OF 10');sub('Held by men · ILO 2024, derived');for(let i=0;i<10;i++){c.fillStyle=i<6?'#ecd19a':'#677978';c.globalAlpha=alpha*(i<6?1-smoothstep(12.9,14.5,t)*.72:1);c.fillRect(103+i*68,430,44,15);}c.globalAlpha=alpha;sub('Unpaid care work excluded',493);break;
   case 'S03/SH02':tag('WITHIN A DAY · ILLUSTRATIVE');chip('MACHINES','STOPPING');sub('Lights stay on');break;
   case 'S04/SH01':tag('2020 LOCKDOWNS · MEASURED');chip('SEISMIC NOISE','UP TO −50%');sub('At some stations · Lecocq et al.');tag('TRACE SCHEMATIC',465,17);break;
   case 'S04/SH02':tag('2020 · GROUND CROSS-SECTION');chip('HUMAN VIBRATIONS','QUIETER');tag('SCHEMATIC · NOT TO SCALE',395,17);break;
   case 'S05/SH01':tag('FIRST DAYS · ILLUSTRATIVE');break;
   case 'S05/SH02':tag('HEALTH & CARE WORKFORCE');chip('WOMEN','67%');sub('ILO–WHO 2022 · global share');break;
   case 'S05/SH03':tag('SEAFARER WORKFORCE');chip('WOMEN','≈1%');sub('BIMCO / ICS · 2021');break;
   case 'S06/SH01':tag('WEEKS LATER · ILLUSTRATIVE');chip('SHIP NOISE','FADING');tag('SOUND RINGS SCHEMATIC',400,17);break;
   case 'S06/SH02':tag('BAY OF FUNDY · 2001');chip('SHIP NOISE','−6 dB');sub('Right-whale stress hormones fell');sub('Rolland et al. · regional evidence',426);break;
   case 'S07/SH01':tag('SAN FRANCISCO BAY · 2020');chip('SPARROWS','SOFTER SONG');sub('Measured response · Derryberry et al.');break;
   case 'S07/SH02':tag('SAN FRANCISCO BAY · 2020');chip('HEARD','≈2× AS FAR');tag('RING RADII ILLUSTRATIVE',395,17);for(const a of [reach.singerAnchor,reach.listenerAnchor]){const p=a.clone().project(stage.camera);const x=(p.x+1)*540,y=(1-p.y)*960;c.strokeStyle=AMBER;c.lineWidth=2;c.beginPath();c.arc(x,y,17,0,Math.PI*2);c.stroke();}break;
   case 'S08/SH01':break;
   case 'S08/SH02':tag('PREGNANCIES ALREADY UNDERWAY');chip('MONTHS',String(Math.round(9*smoothstep(53.1,56.2,t))));if(t>54.6){sub('≈50 million boys within 9 months',382);sub('Estimate · assumes births continue',426);}tag('BIRTH GLINTS ILLUSTRATIVE',510,17);break;
   case 'S09/SH01':tag('POPULATION BY AGE · SCHEMATIC');chip('AFTER T0',pyramid.year<1?'+9 MONTHS':`+${Math.round(pyramid.year)} YEARS`);sub('Later births: mostly via sperm banks');tag('THIN BARS ILLUSTRATIVE',465,17);drawTag(c,'MALE',270,550,{size:19,accent:TEAL,align:'center'});drawTag(c,'FEMALE',800,550,{size:19,accent:TEAL,align:'center'});break;
   case 'S09/SH02':tag('COHORT AGING · SCHEMATIC');chip('AFTER T0',`+${Math.round(pyramid.year)} YEARS`);if(t>64.1)sub('OLDEST MAN: 20',414);drawTag(c,'MALE',270,550,{size:19,accent:TEAL,align:'center'});drawTag(c,'FEMALE',800,550,{size:19,accent:TEAL,align:'center'});break;
   case 'S10/SH01':tag('MONTHS LATER · ILLUSTRATIVE');break;
   case 'S10/SH02':if(t<74.6){tag('ONE POSSIBLE FUTURE');chip('AFTER T0','+40 YEARS');}break;
  }c.restore();
 };return {shots,overlay};
}
