import * as THREE from 'three';
import { type Stage,type ShotInfo,type FilmDefinition,projectToScreen } from '../../library/render/FilmPipeline';
import { Earth,loadEarthTextures,type EarthTextures } from '../../library/planet/Earth';
import { OvercastShell } from '../../library/planet/OvercastShell';
import { Starfield } from '../../library/space/Starfield';
import { SkyDome } from '../../library/environment/SkyDome';
import { OceanSurface } from '../../library/environment/OceanSurface';
import { SeaIce } from '../../library/environment/SeaIce';
import { SmokeWisp } from '../../library/fx/SmokeWisp';
import { DuneField } from '../../library/environment/DuneField';
import { DrySoil } from '../../library/environment/DrySoil';
import { GrassField } from '../../library/environment/GrassField';
import { BroadleafTree } from '../../library/environment/BroadleafTree';
import { CityStreet } from '../../library/environment/CityStreet';
import { ApartmentFacade } from '../../library/environment/ApartmentFacade';
import { PedestrianCrowd } from '../../library/characters/PedestrianCrowd';
import { Humanoid,POSE_STAND } from '../../library/characters/Humanoid';
import { DialGauge } from '../../library/props/DialGauge';
import { SolarPanelArray } from '../../library/props/SolarPanelArray';
import { SolarOrbitDiagram } from '../../library/diagram/SolarOrbitDiagram';
import { WaterPhotolysis } from '../../library/diagram/WaterPhotolysis';
import { drawRich,drawTag,drawChip } from '../../library/overlay/Labels';
import { smoothstep,lerp } from '../../library/util/math';

const SUN=new THREE.Vector3(-.7,.4,.55).normalize(), WARM=new THREE.Vector3(0,.11,-1).normalize();
const p=(t:number,s:ShotInfo)=>smoothstep(s.start_s,s.end_s,t);
const mat=(c:THREE.ColorRepresentation,r=.8,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
function box(w:number,h:number,d:number,c:THREE.Material,x:number,y:number,z:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),c);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m;}
class Base implements Stage {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1080/1920,.025,5000);
  lights(renderer:THREE.WebGLRenderer,sky:SkyDome){const key=new THREE.DirectionalLight(0xffeccf,2.6);key.position.set(-18,24,15);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:.1,far:120});key.shadow.bias=-.00025;key.shadow.normalBias=.025;this.scene.add(sky.mesh,key,new THREE.HemisphereLight(0xe5e8e5,0x8e7257,1.3));this.scene.environment=sky.toEnvironment(renderer);this.scene.environmentIntensity=.7;return key;}
  update(t:number,s:ShotInfo){}
}
class SpaceStage extends Base {
  earth:Earth;cloud=new OvercastShell({radius:1.008,color:0xf7e1bf,shadowColor:0x687a91,sunDirection:SUN});
  stars=new Starfield({seed:1090,count:2400,radius:90,brightness:.55});
  orbit=new SolarOrbitDiagram({center:new THREE.Vector3(-6.5,0,0),unitsPerAu:6.7,sunRadius:.36});
  molecules=new WaterPhotolysis({count:3,spacing:.54,scale:.9,escapeHeight:1.75});
  vapor:SmokeWisp[]=[];
  constructor(tex:EarthTextures){super();this.earth=new Earth(tex,{sunDirection:SUN,nightLights:.65,atmosphereStrength:.8});this.scene.add(this.earth.group,this.cloud.mesh,this.stars.points,this.orbit.group,this.molecules.group,new THREE.HemisphereLight(0xffffff,0x152030,.9));this.orbit.baselineMarker.visible=this.orbit.targetMarker.visible=false;for(let i=0;i<6;i++){const w=new SmokeWisp({height:.38,baseWidth:.006,topWidth:.08,curl:.04,color:0xb7e4ff,seed:i+7});w.mesh.position.set(-.63+i*.22,.84,.2);this.scene.add(w.mesh);this.vapor.push(w);}}
  update(t:number,s:ShotInfo){
    const u=p(t,s),ending=s.sceneId==='S09',hook=s.sceneId==='S01',polar=s.sceneId==='S04',molecular=s.sceneId==='S08';
    this.orbit.group.visible=hook||ending;this.molecules.group.visible=molecular;
    const step=hook?smoothstep(.8,3.6,t):ending?1-smoothstep(57.5,62.5,t):1;
    this.earth.group.position.set(hook||ending?lerp(.2,-.47,step):0,molecular?-2.08:0,molecular?-1.8:0);
    this.earth.group.scale.setScalar(molecular?2:1);
    this.earth.setView(ending?lerp(28,12,u):polar?0:12,polar?65:12);
    const clock=ending?lerp(57.5,0,u):t;this.earth.update(clock);this.earth.seaIce=polar?1-.9*u:0;
    this.earth.scatter=s.sceneId==='S07'?1+u:1;
    this.cloud.mesh.position.copy(this.earth.group.position);this.cloud.mesh.scale.copy(this.earth.group.scale);
    this.cloud.coverage=hook?0:ending?.9*(1-u):s.sceneId==='S07'?lerp(.25,.82,u):molecular?.72:0;
    this.cloud.update(clock);this.molecules.update(t,u);this.molecules.group.position.set(0,.35,0);
    this.vapor.forEach(w=>{w.update(t,.2+u*2,s.sceneId==='S07'?.25*u:0,this.camera);});
    this.orbit.update(clock);this.stars.follow(this.camera);
  }
}
class OrbitStage extends Base {
  diagram=new SolarOrbitDiagram({unitsPerAu:1.3,sunRadius:.16,markerRadius:.07});
  stars=new Starfield({seed:1090,count:1400,radius:90,brightness:.4});
  constructor(){super();this.scene.add(this.diagram.group,this.stars.points);}
  update(t:number,s:ShotInfo){this.diagram.update(t,(t-s.start_s)/3.3);this.stars.follow(this.camera);this.camera.fov=38;this.camera.up.set(0,0,-1);this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();}
}
class FluxStage extends Base {
  sun:SolarOrbitDiagram;near=new THREE.Group();far=new THREE.Group();rays:THREE.Line[]=[];
  constructor(){super();this.sun=new SolarOrbitDiagram({center:new THREE.Vector3(-1.35,.15,0),sunRadius:.16});this.sun.rings.visible=this.sun.baselineMarker.visible=this.sun.targetMarker.visible=false;this.scene.add(this.sun.group,this.near,this.far);
    for(const [g,x,r,c] of [[this.near,.65,.6,0xffbe54],[this.far,.88,.67,0x5fbbfb]] as [THREE.Group,number,number,number][]){g.position.set(x,.15,0);const disc=new THREE.Mesh(new THREE.CircleGeometry(r,80),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,transparent:true,opacity:.09,depthWrite:false}));disc.rotation.y=Math.PI/2;g.add(disc);const edge=new THREE.Mesh(new THREE.TorusGeometry(r,.008,8,80),new THREE.MeshBasicMaterial({color:c}));edge.rotation.y=Math.PI/2;g.add(edge);}
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2,pts=[new THREE.Vector3(-1.35,.15,0),new THREE.Vector3(.88,.15+Math.sin(a)*.67,Math.cos(a)*.67)];const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xffd084,transparent:true,opacity:.35}));this.scene.add(ray);this.rays.push(ray);}
  }
  update(t:number,s:ShotInfo){this.sun.update(t);this.rays.forEach((r,i)=>(r.material as THREE.LineBasicMaterial).opacity=.25+.18*Math.sin((t-s.start_s)*3-i*.3)**2);}
}
class SeaStage extends Base {
  sky=new SkyDome({sunDirection:WARM,zenithColor:0x477ea7,horizonColor:0xe9d3b1,hazeColor:0xf2cfa0,sunSize:.004625,sunGlow:.18,sunIntensity:8,hazeAmount:.3});
  ocean=new OceanSurface({size:5000,sunDirection:WARM,waveHeight:.32,deepColor:0x143b4c,horizonColor:0xe9d3b1,zenithColor:0x477ea7,fogColor:0xd6d5c8,glitter:.8});
  ice=new SeaIce({seed:141,floeCount:28,area:[-27,27,-65,3],minRadius:1.2,maxRadius:4.5,thickness:.8,avoid:[[0,11,5]]});wisps:SmokeWisp[]=[];
  constructor(r:THREE.WebGLRenderer){super();this.lights(r,this.sky);this.scene.add(this.ocean.mesh,this.ice.group);this.scene.fog=new THREE.FogExp2(0xd6d5c8,.001);for(let i=0;i<12;i++){const w=new SmokeWisp({height:2.3,baseWidth:.13,topWidth:1.6,curl:.5,color:0xe9e3d5,seed:i+4});w.mesh.position.set((i%4-1.5)*7,.08,-Math.floor(i/4)*11-4);this.scene.add(w.mesh);this.wisps.push(w);}}
  update(t:number,s:ShotInfo){const polar=s.sceneId==='S04',u=p(t,s),sun=polar?new THREE.Vector3(.5,.3,-1).normalize():WARM;this.ocean.update(t);this.ocean.uniforms.uSunDir.value.copy(sun);this.ocean.uniforms.uGlitter.value=polar?.06:.11;this.ocean.skyScale=.75;this.sky.uniforms.uSunDir.value.copy(sun);this.ice.group.visible=polar;this.ice.update(t,.2*u,.1);this.ice.group.children.forEach((m,i)=>m.scale.setScalar(1-u*(.4+.2*Math.sin(i)**2)));this.wisps.forEach((w,i)=>{w.update(t,5+u,polar?.10*u:0,this.camera);});this.sky.uniforms.uSunSize.value=.004625*(1+smoothstep(5.2,7.6,t)/9);this.sky.follow(this.camera);}
}
class MeterStage extends Base {
  sky=new SkyDome({sunDirection:SUN,zenithColor:0x638eac,horizonColor:0xf0d8b1,sunGlow:.3});
  dial=new DialGauge({radius:.155,min:1000,max:2000,majorStep:200,minorStep:50,labelStep:200,title:'SOLAR FLUX',unit:'W/m²',bezel:'steel',marks:[{value:1361,color:'#52c7ff'},{value:1680,color:'#ed752e'}]});
  panels=new SolarPanelArray({rows:3,cols:6,tilt:28});
  constructor(r:THREE.WebGLRenderer){super();this.lights(r,this.sky);this.dial.group.position.set(0,1.3,0);this.panels.group.position.set(.7,0,-7);this.scene.add(this.dial.group,this.panels.group,box(.035,1.15,.035,mat(0x59656b,.3,.8),0,.575,-.02),box(160,.1,160,mat(0xa59c81),0,-.08,0));}
  update(t:number,s:ShotInfo){this.dial.value=lerp(1361,1680,smoothstep(s.start_s+.3,s.end_s-.5,t));this.sky.follow(this.camera);}
}
class FieldStage extends Base {
  sky=new SkyDome({sunDirection:SUN,zenithColor:0x7397ad,horizonColor:0xe9c8a3,hazeColor:0xeac89a,hazeAmount:.5,sunGlow:.3});
  soil=new DrySoil({size:300,cellSize:.55});dunes=new DuneField({size:400,segments:160,height:4,wavelength:55,flatRadius:40,floor:-.06,sandColor:0xb68d5e});
  grass=new GrassField({area:[-34,34,-60,14],count:20000,minHeight:.22,maxHeight:.85,width:.015,seed:90,baseColor:0x7b8050,tipColor:0x9b9a59,dryColor:0xbd9b60,sunDirection:SUN,fogColor:0xd8b68f,fogDensity:.006});
  trees:BroadleafTree[]=[];
  constructor(r:THREE.WebGLRenderer){super();this.lights(r,this.sky);this.soil.mesh.position.y=.006;this.scene.add(this.soil.mesh,this.dunes.mesh,this.grass.mesh);this.scene.fog=new THREE.FogExp2(0xd8b68f,.006);for(let i=0;i<7;i++){const tree=new BroadleafTree({height:5+i%3,canopyWidth:3.4,leafCount:1700,seed:33+i,leafColor:0x7c8150});tree.position.set((i-3)*7,0,-16-Math.sin(i)*9);this.scene.add(tree);this.trees.push(tree);}}
  update(t:number,s:ShotInfo){const u=p(t,s);this.soil.dryness=u;this.dunes.greening=.6*(1-u);this.grass.growth=1-.85*u;this.grass.update(t,{bend:.18+.55*u,direction:new THREE.Vector2(1,.2),gust:.6});this.trees.forEach(tree=>{tree.leafFraction=1-.9*u;(tree.leaves.material as THREE.MeshStandardMaterial).color.copy(new THREE.Color(0x7c8150)).lerp(new THREE.Color(0xb97b39),u);});this.sky.uniforms.uHazeAmount.value=.35+.35*u;this.sky.follow(this.camera);}
}
class CityStage extends Base {
  sky=new SkyDome({sunDirection:SUN,zenithColor:0x7b9cae,horizonColor:0xe3c6a7,hazeColor:0xe7bd94,hazeAmount:.7,sunGlow:.35});city=new CityStreet({seed:510,blocks:7,wetness:.3,vehicles:false,farFieldRadius:650});
  crowd=new PedestrianCrowd({seed:740,count:14,umbrellaCount:7,dissolve:false,width:4,depth:10});
  constructor(r:THREE.WebGLRenderer){super();this.lights(r,this.sky);this.scene.add(this.city.group,this.crowd.group);this.crowd.group.position.set(9,0,-7);this.scene.fog=new THREE.FogExp2(0xe0b695,.006);}
  update(t:number,s:ShotInfo){const u=p(t,s);this.city.update(t,{wetness:.3,lights:0});this.crowd.update(t,{clock_s:(t-s.start_s)*.25,dissolveEnabled:false,visibleCount:14});this.crowd.figures.forEach((f,i)=>{f.root.position.x=lerp(f.root.position.x,3.2+(i%3)*.15,smoothstep(.08,.94,u));f.root.position.z-=u*(1+i%4);});this.sky.follow(this.camera);}
}
class WindowStage extends Base {
  sky=new SkyDome({sunDirection:SUN,hazeAmount:.65,horizonColor:0xf0d3ae,zenithColor:0x7e9caa});
  facade=new ApartmentFacade({floors:1,columns:1,occupancy:0,warmth:0x89c2dc,balconies:false});
  person=new Humanoid({height:1.7,coat:'jacket',coatColor:0x56696e,skinColor:0x9b6e4c,scarfColor:null});
  dial=new DialGauge({radius:.14,min:20,max:45,majorStep:5,minorStep:1,labelStep:5,title:'WET BULB',unit:'°C',bezel:'brass',marks:[{value:31,color:'#ed8b35'},{value:35,color:'#d33727'}]});
  constructor(r:THREE.WebGLRenderer){super();this.lights(r,this.sky);this.facade.position.set(.26,-3.5,-.65);this.person.root.position.set(.25,.7,-1.75);this.dial.group.position.set(-.06,1.52,.12);this.scene.add(this.facade,this.person.root,this.dial.group);this.scene.add(box(.035,.7,.035,mat(0x73766e,.4,.7),-.06,1.03,.05));const probe=box(.018,.21,.018,mat(0xe0ddd1),-.065,1.23,.12);this.scene.add(probe);}
  update(t:number,s:ShotInfo){this.dial.value=lerp(28,36,p(t,s));this.person.root.rotation.y=2.7;this.person.setPose({...POSE_STAND,headPitch:.12,armL:[-.4,.1,.7],armR:[-.35,.1,.7],breath:.1*Math.sin(t)});this.sky.follow(this.camera);}
}

const NOTES:Record<string,[string,string,string]>={
  'S01/SH01':['ORBIT SHRINKS','1.00 → 0.90 AU','SCHEMATIC · NOT TO SCALE'],
  'S02/SH01':['SUN DIAMETER','0.53° → 0.59°','ONLY 11.1% WIDER'],
  'S02/SH02':['NEW YEAR','312 DAYS','SCHEMATIC · KEPLER’S THIRD LAW'],
  'S03/SH01':['SUNLIGHT','1 ÷ 0.90² = 1.235','SCHEMATIC · SAME ENERGY, SMALLER AREA'],
  'S03/SH02':['AT THE TOP OF THE ATMOSPHERE','1361 → 1680 W/m²','DIAL ILLUSTRATES SOLAR IRRADIANCE'],
  'S04/SH01':['LESS REFLECTIVE ICE','MORE ENERGY ABSORBED','YEARS TO DECADES · ILLUSTRATIVE'],
  'S04/SH02':['WARMER OCEANS','MORE EVAPORATION','YEARS TO DECADES · TIME COMPRESSED'],
  'S05/SH01':['WATER VAPOR','AMPLIFIES WARMING','POSSIBLE REGIONAL RESPONSE · YEARS TO DECADES'],
  'S06/SH01':['HUMID HEAT','SHADE IS NOT ENOUGH','ILLUSTRATIVE · ACTIVE COOLING MAY BE NEEDED'],
  'S06/SH02':['HEAT STRESS','HUMIDITY LIMITS COOLING','31–35°C WET BULB · LIMIT VARIES'],
  'S07/SH01':['MOIST GREENHOUSE','A POSSIBLE CLIMATE STATE','MODEL DEPENDENT · NO FIXED TRANSITION DATE'],
  'S08/SH01':['UV BREAKS H_2O','HYDROGEN CAN ESCAPE','SCHEMATIC · GEOLOGICAL OCEAN LOSS'],
  'S09/SH01':['OUR PRESENT ORBIT','A DELICATE ENERGY BALANCE','SCHEMATIC · RETURN TO TODAY FOR THE LOOP'],
};
export async function createFilm(ctx:{renderer:THREE.WebGLRenderer;base:string}):Promise<FilmDefinition>{
  const tex=await loadEarthTextures(ctx.base,8,{seaIce:true});
  const space=new SpaceStage(tex),orbit=new OrbitStage(),flux=new FluxStage(),sea=new SeaStage(ctx.renderer),meter=new MeterStage(ctx.renderer),field=new FieldStage(ctx.renderer),city=new CityStage(ctx.renderer),window=new WindowStage(ctx.renderer);
  const stages:Record<string,Stage>={'S01/SH01':space,'S02/SH01':sea,'S02/SH02':orbit,'S03/SH01':flux,'S03/SH02':meter,'S04/SH01':space,'S04/SH02':sea,'S05/SH01':field,'S06/SH01':city,'S06/SH02':window,'S07/SH01':space,'S08/SH01':space,'S09/SH01':space};
  return {shots:Object.fromEntries(Object.entries(stages).map(([k,stage])=>[k,{stage,post:{bloomStrength:stage===space?.23:.13,vignette:.28,grain:.006,saturation:1.05,exposure:1}}])),overlay(o){
    const {ctx:c,shot:s,time_s:t}=o,[title,value,tag]=NOTES[s.key];const alpha=o.alpha*Math.min(1,(t-s.start_s)*3);c.save();c.globalAlpha=alpha;
    const ending=s.sceneId==='S09';if(ending)c.globalAlpha*=1-smoothstep(62.5,63.8,t);
    const wash=c.createLinearGradient(0,210,0,450);wash.addColorStop(0,'rgba(4,9,17,.45)');wash.addColorStop(.72,'rgba(4,9,17,.32)');wash.addColorStop(1,'rgba(4,9,17,0)');c.fillStyle=wash;c.fillRect(65,210,950,240);
    drawTag(c,tag,90,246,{size:tag.length>45?17:20,accent:'#ffb84d'});
    drawRich(c,title,90,331,{size:25,tracking:3,color:'#fed598'});drawRich(c,value,90,394,{size:value.length>28?34:46,weight:700});
    if(s.key==='S01/SH01'||ending){drawRich(c,'1.00 AU',790,1040,{size:28,color:'#68c8ff',align:'right'});drawRich(c,'0.90 AU',790,1090,{size:28,color:'#ffbb55',align:'right'});}
    if(s.key==='S02/SH01'){
      const a=projectToScreen(sea.camera,sea.camera.position.clone().addScaledVector(WARM,1000),1080,1920)!;
      const radius=1920/(2*Math.tan(THREE.MathUtils.degToRad(sea.camera.fov/2)))*.004625;
      for(const [r,col] of [[radius,'#ffffff'],[radius/0.9,'#ffb84d']] as [number,string][]){c.strokeStyle=col;c.lineWidth=2;c.setLineDash([3,3]);c.beginPath();c.arc(a.x,a.y,r,0,Math.PI*2);c.stroke();}c.setLineDash([]);
      drawRich(c,'Same camera · true angular ratio',540,1090,{size:24,align:'center'});
    }
    if(s.key==='S02/SH02'){drawChip(c,'PRESENT ORBIT','365 DAYS',90,1050,{dot:'#66c7ff'});drawChip(c,'0.90 AU','312 DAYS',90,1130,{dot:'#ffb84d'});}
    if(s.key==='S03/SH01'){drawRich(c,'0.90 AU',540,1000,{align:'center',size:32,color:'#ffc75b'});drawRich(c,'Area falls to 81% · flux rises 23.5%',540,1080,{align:'center',size:30});}
    if(s.key==='S08/SH01'){drawRich(c,'H_2O + UV → OH + H',540,1010,{align:'center',size:37,color:'#d5baff'});drawRich(c,'Simplified chemistry · escape sped up',540,1070,{align:'center',size:24});}
    c.restore();
  }};
}
