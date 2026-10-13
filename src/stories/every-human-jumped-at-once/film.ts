import * as THREE from 'three';
import { type Stage,type ShotInfo,type FilmDefinition } from '../../library/render/FilmPipeline';
import { Earth,loadEarthTextures,type EarthTextures } from '../../library/planet/Earth';
import { Starfield } from '../../library/space/Starfield';
import { SkyDome } from '../../library/environment/SkyDome';
import { CityStreet,makeCityCar } from '../../library/environment/CityStreet';
import { ClinicInterior } from '../../library/environment/ClinicInterior';
import { PedestrianCrowd } from '../../library/characters/PedestrianCrowd';
import { Humanoid,POSE_STAND,POSE_SIT } from '../../library/characters/Humanoid';
import { applyJump,evaluateJump } from '../../library/characters/SynchronizedJump';
import { CrowdField } from '../../library/characters/CrowdField';
import { CenterOfMassRecoil } from '../../library/diagram/CenterOfMassRecoil';
import { SoundRings } from '../../library/diagram/SoundRings';
import { Seismometer } from '../../library/props/Seismometer';
import { DialGauge } from '../../library/props/DialGauge';
import { WaterServiceStation } from '../../library/props/WaterServiceStation';
import { surface,glow,solid,box,rod } from '../../library/util/Modeling';
import { smoothstep,lerp,rng } from '../../library/util/math';
import { drawRich,drawTag } from '../../library/overlay/Labels';

const SUN=new THREE.Vector3(-.55,.78,.32).normalize();
class Base implements Stage {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1080/1920,.025,5000);
  update(t:number,s:ShotInfo){}
  studio(){this.scene.background=new THREE.Color(0x070e19);const key=new THREE.DirectionalLight(0xffe0aa,3.2);key.position.set(-3,6,5);this.scene.add(key,new THREE.HemisphereLight(0xb3e3ff,0x13222f,1.4));const rim=new THREE.PointLight(0x4ebfee,12,14);rim.position.set(2,3,-3);this.scene.add(rim);}
  daylight(r:THREE.WebGLRenderer,sky:SkyDome){const light=new THREE.DirectionalLight(0xffe8c8,3.4);light.position.copy(SUN).multiplyScalar(65);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-28,right:28,top:35,bottom:-35,near:.2,far:150});light.shadow.bias=-.0002;light.shadow.normalBias=.025;this.scene.add(sky.mesh,light,new THREE.HemisphereLight(0xc8deeb,0x7d6b54,1.2));this.scene.environment=sky.toEnvironment(r);this.scene.environmentIntensity=.65;return light;}
}

class StreetStage extends Base {
  sky=new SkyDome({sunDirection:SUN,zenithColor:0x548fb7,horizonColor:0xe6d5b9,hazeColor:0xdcc7a6,hazeAmount:.2,sunGlow:.15});
  city=new CityStreet({seed:875,blocks:7,wetness:.08,vehicles:false,farFieldRadius:700,storeysMin:4,storeysMax:7,windowOccupancy:.25});
  crowd=new PedestrianCrowd({seed:4409,count:24,umbrellaCount:0,dissolve:false,childFraction:.08});
  field=new CrowdField({seed:773,width:12,depth:62,spacing:.74});
  sidewalkA=new CrowdField({seed:36,width:3.5,depth:70,spacing:.64});sidewalkB=new CrowdField({seed:37,width:3.5,depth:70,spacing:.64});
  rings=new SoundRings({mode:'ground',color:0xffce66,count:4,maxRadius:42,opacity:.48,speedVisual:14,emissionRate:4,thickness:.008});
  traffic=new THREE.Group(); dust:THREE.Points;dustMat:THREE.PointsMaterial;
  constructor(r:THREE.WebGLRenderer){super();this.daylight(r,this.sky);this.scene.add(this.city.group,this.crowd.group,this.field.group,this.sidewalkA.group,this.sidewalkB.group,this.rings,this.traffic);this.field.group.position.z=-38;this.sidewalkA.group.position.set(-9.2,.12,-27);this.sidewalkB.group.position.set(9.2,.12,-27);this.rings.position.y=.025;this.scene.fog=new THREE.FogExp2(0xd8cbb6,.003);
    for(let i=0;i<18;i++){const car=makeCityCar([0x4b6c7c,0x9b8e78,0x6a5048,0xd1cbc0][i%4]);car.position.set(i%2?2.8:-2.8,0,-4-Math.floor(i/2)*5.15);if(i%2)car.rotation.y=Math.PI;this.traffic.add(car);}
    const random=rng(92),pos=new Float32Array(140*3);for(let i=0;i<140;i++){pos[i*3]=(random()-.5)*7;pos[i*3+1]=random()*.3;pos[i*3+2]=(random()-.5)*5;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));this.dustMat=new THREE.PointsMaterial({color:0xd3b993,size:.06,transparent:true,opacity:0,depthWrite:false});this.dust=new THREE.Points(geo,this.dustMat);this.scene.add(this.dust);
  }
  update(t:number,s:ShotInfo){
    const hook=s.sceneId==='S01',macro=s.key==='S04/SH01',cushion=s.key==='S05/SH01',sound=s.key==='S04/SH02',ending=s.sceneId==='S09',jam=s.sceneId==='S07';
    const clock=hook?t:macro?2.2+(t-19.5)*.17:cushion?2.48+(t-26)*.16:sound?2.59+(t-22.8)*.45:ending?3.8+(t-60)*.25:0;
    const jump=evaluateJump(clock,{start_s:2.1});
    this.traffic.visible=jam;this.field.group.visible=!jam;this.field.update(t,jump.elevation);this.sidewalkA.update(t,jump.elevation+.12);this.sidewalkB.update(t,jump.elevation+.12);
    this.crowd.fallenProps.visible=false;
    this.crowd.figures.forEach((person,i)=>{
      person.root.visible=!jam;const col=i%6,row=Math.floor(i/6);person.root.position.x=(col-2.5)*1.05;person.root.position.z=-row*1.55;
      // Keep the central shoe in macro views, with its neighbors supplying context.
      if(macro||cushion){person.root.position.x-=.525;}
      person.root.rotation.y=(i%3-1)*.1;applyJump(person,clock,{start_s:2.1},.008);
    });
    this.rings.visible=hook||sound||macro;this.rings.update(clock,2.1+jump.flight_s,2.1+jump.flight_s+.76,1);
    const age=clock-2.1-jump.flight_s;this.dust.visible=age>=0&&age<.8;this.dust.position.y=Math.max(0,age)*.22;this.dust.scale.setScalar(1+Math.max(0,age)*.7);this.dustMat.opacity=age>=0?.17*Math.exp(-age*5):0;
    this.city.update(t,{wetness:.08,lights:0});this.sky.follow(this.camera);
  }
}

class SpaceStage extends Base {
  earth:Earth;stars=new Starfield({seed:277,count:1800,radius:90,brightness:.5});arrows=new THREE.Group();marker:THREE.Mesh;
  constructor(tex:EarthTextures){super();this.earth=new Earth(tex,{sunDirection:new THREE.Vector3(-.7,.45,.8).normalize(),nightLights:.5,atmosphereStrength:.8});this.earth.spinRate=.0015;this.scene.add(this.earth.group,this.stars.points,this.arrows);
    for(let i=0;i<12;i++){const angle=i/12*Math.PI*2;const v=new THREE.Vector3(Math.cos(angle),Math.sin(angle),.08).normalize();this.arrows.add(new THREE.ArrowHelper(v,v.clone().multiplyScalar(1.08),.26,i%2?0x64d4f6:0xffd25c,.09,.04));}
    this.marker=new THREE.Mesh(new THREE.TorusGeometry(.055,.005,8,40),new THREE.MeshBasicMaterial({color:0xffd467}));this.marker.position.set(.25,.35,.91);this.marker.lookAt(this.marker.position.clone().multiplyScalar(3));this.scene.add(this.marker);
  }
  update(t:number,s:ShotInfo){const distributed=s.sceneId==='S08';this.earth.setView(22,12);this.earth.update(t);this.arrows.visible=distributed;this.arrows.scale.setScalar(1+.06*Math.sin((t-50)*3));this.marker.visible=s.sceneId==='S02';this.marker.scale.setScalar(1+.1*Math.sin(t*4));this.stars.follow(this.camera);}
}
class MassStage extends Base {
  earth:Earth;person=new Humanoid({height:.5,coat:'jacket',coatColor:0xc49b52,trouserColor:0x697786,shoeColor:0x434e55,scarfColor:null});cube:THREE.Mesh;
  constructor(tex:EarthTextures){super();this.studio();this.earth=new Earth(tex,{radius:.64,sunDirection:SUN,nightLights:.2});this.earth.group.position.set(.68,1.22,0);this.person.root.position.set(-.9,1.11,0);const brass=surface(0xad8b4d,.28,.85),dark=surface(0x182638,.4,.4);box(this.scene,[2.8,.14,1.4],dark,[0,-.25,0]);rod(this.scene,[0,-.2,0],[0,.72,0],.055,brass);rod(this.scene,[-1.05,.98,0],[1.05,.58,0],.04,brass);for(const [x,y] of [[-.9,1.08],[.72,.54]]){solid(this.scene,new THREE.CylinderGeometry(.39,.39,.06,48),brass,[x,y,0]);}
    this.cube=box(this.scene,[.17,.17,.17],glow(0xffce66,.4),[-1.14,1.22,0]);this.scene.add(this.person.root,this.earth.group);
    for(let i=0;i<7;i++)rod(this.scene,[-1.2+i*.4,-.17,-.52],[-1.2+i*.4,-.17,.52],.003,surface(0x3d6575));
  }
  update(t:number,s:ShotInfo){this.earth.update(t);this.cube.scale.setScalar(1+.03*Math.sin(t*4));this.person.setPose({...POSE_STAND,armL:[-.6, .1,.3],armR:[-.6,.1,.3]});}
}
class RecoilStage extends Base {
  diagram=new CenterOfMassRecoil();atom=new THREE.Group();
  constructor(){super();this.studio();this.diagram.group.scale.setScalar(.84);this.diagram.group.position.y=.28;this.scene.add(this.diagram.group,this.atom);this.atom.position.set(.83,1.25,0);
    const core=solid(this.atom,new THREE.SphereGeometry(.025,20,12),glow(0xff8d57,.8));
    for(let i=0;i<3;i++){const ring=solid(this.atom,new THREE.TorusGeometry(.20,.003,6,64),new THREE.MeshBasicMaterial({color:0x6fc6ed,transparent:true,opacity:.5}));ring.rotation.set(i*.7,i*.9,0);}
  }
  update(t:number,s:ShotInfo){const u=s.sceneId==='S03'?(t-11.5)/8:0;this.diagram.update(smoothstep(.08,.85,u));this.atom.rotation.y=t*.2;}
}
class InstrumentStage extends Base {
  meter=new Seismometer({traceWidth:1.0});sky=new SkyDome({sunDirection:SUN,zenithColor:0x5d94b2,horizonColor:0xe0d0b7});
  constructor(r:THREE.WebGLRenderer){super();this.daylight(r,this.sky);this.scene.add(this.meter.group);box(this.scene,[2.6,.15,2.0],surface(0x78817e,.95),[.1,-.12,0]);box(this.scene,[80,.1,80],surface(0x4f575c,.93),[0,-.25,0]);for(let i=0;i<12;i++)box(this.scene,[.016,.002,1.8],surface(0x626e6b),[-1.1+i*.2,-.042,0]);}
  update(t:number,s:ShotInfo){const age=t-s.start_s;this.meter.update(t,.07+.65*Math.exp(-age*.8)*(1+Math.sin(age*10)*.2));this.sky.follow(this.camera);}
}
class AreaStage extends Base {
  markers=new THREE.Group();district=new THREE.Group();
  constructor(){super();this.studio();const ground=surface(0x122b3a,.8,.15);box(this.scene,[40,.65,41],ground,[0,-.4,0]);this.scene.add(this.markers,this.district);const line=new THREE.LineBasicMaterial({color:0x6a9fb0,transparent:true,opacity:.4});
    for(let i=-20;i<=20;i++){this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i,.005,-20.5),new THREE.Vector3(i,.005,20.5)]),line));this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-20,.005,i),new THREE.Vector3(20,.005,i)]),line));}
    const r=rng(190),blocks=surface(0x2f5364,.65,.3);for(let i=0;i<220;i++){const x=(r()-.5)*36,z=(r()-.5)*37,h=.25+r()*2.5;box(this.district,[.5+r()*.8,h,.5+r()],blocks,[x,h/2,z]);}
    const edge=glow(0xf2b74b,.5);for(const x of [-20,20])rod(this.scene,[x,.03,-20.5],[x,.03,20.5],.06,edge);for(const z of [-20.5,20.5])rod(this.scene,[-20,.03,z],[20,.03,z],.06,edge);
    for(let i=0;i<22;i++){const row=new CrowdField({seed:i+1,width:38,depth:.8,spacing:1.2,height:.9});row.group.position.z=-19+i*1.78;this.markers.add(row.group);}
    const key=new THREE.DirectionalLight(0xffd19a,2);key.position.set(-10,30,20);this.scene.add(key);this.scene.fog=new THREE.FogExp2(0x070e19,.001);
  }
  update(t:number,s:ShotInfo){this.markers.position.y=.04+Math.sin(t*.5)*.015;}
}
class WaterStage extends Base {
  sky=new SkyDome({sunDirection:SUN,zenithColor:0x548fb7,horizonColor:0xe2cfb4});station=new WaterServiceStation();
  gauge=new DialGauge({radius:.14,min:0,max:6,majorStep:1,minorStep:.2,labelStep:2,title:'PRESSURE',unit:'bar',bezel:'brass',marks:[{value:1,color:'#d85c45'}]});
  crowd=new PedestrianCrowd({seed:82,count:12,dissolve:false,umbrellaCount:0,childFraction:0});backdrop:CityStreet;
  constructor(r:THREE.WebGLRenderer){super();this.daylight(r,this.sky);this.backdrop=new CityStreet({seed:875,blocks:4,vehicles:false,farFieldRadius:0,wetness:.08});this.backdrop.group.position.set(-9.5,0,-8);this.gauge.group.position.set(.7,1.55,-.2);this.scene.add(this.station.group,this.gauge.group,this.crowd.group,this.backdrop.group);box(this.scene,[45,.08,70],surface(0x787873,.9),[0,-.06,0]);
    for(let i=0;i<3;i++){solid(this.scene,new THREE.CylinderGeometry(.10,.08,.25,24),surface(0xb0b8a5,.5),[.2+i*.3,.14,.9]);}
  }
  update(t:number,s:ShotInfo){const u=smoothstep(s.start_s,s.end_s,t);this.station.flow=1-u*.95;this.gauge.value=lerp(2.9,.25,u);this.crowd.fallenProps.visible=false;this.crowd.figures.forEach((p,i)=>{p.root.position.set(1.5+(i%2)*.45,0,-.7-Math.floor(i/2)*.8);p.root.rotation.y=-1.5;p.setPose({...POSE_STAND,headPitch:.03,armL:[-.25,.1,.6],armR:[-.35,.1,.7],breath:Math.sin(t+i)*.1});});this.backdrop.update(t,{lights:0,wetness:.08});this.sky.follow(this.camera);}
}
class ClinicStage extends Base {
  clinic=new ClinicInterior({rooms:3,seed:33});people:Humanoid[]=[];
  constructor(){super();this.scene.add(this.clinic,new THREE.HemisphereLight(0xe3eff0,0x263b40,1.25));for(let i=0;i<12;i++){const p=new Humanoid({height:1.55+i%4*.08,coat:'jacket',coatColor:[0x5b7069,0x766259,0x375e75,0x9a8972][i%4],skinColor:[0xb6815a,0xd9b295,0x64432e][i%3],scarfColor:null});p.root.position.set(i%2===0?-.9:.9,0,3-Math.floor(i/2)*1.7);p.root.rotation.y=i%2===0?.4:-.5;this.people.push(p);this.scene.add(p.root);box(this.scene,[.5,.47,.45],surface(0x657c78),[p.root.position.x,.23,p.root.position.z]);}}
  update(t:number,s:ShotInfo){this.clinic.update(t);this.people.forEach((p,i)=>{p.setPose({...POSE_SIT,hipsY:.49/p.root.scale.y,headYaw:Math.sin(t*.4+i)*.08,breath:Math.sin(t+i)*.1,armL:[-.65,.1,.7],armR:[-.65,.1,.7]});});}
}

const NOTES:Record<string,[string,string,string]>={
 'S01/SH01':['EVERYONE. ONE JUMP.','WHAT HAPPENS TO EARTH?','8.2 BILLION PEOPLE · ILLUSTRATIVE BASELINE'],
 'S02/SH01':['HUMANITY: ~500 MILLION TONNES','EARTH IS VASTLY HEAVIER','ASSUMED MEAN BODY MASS: 62 kg'],
 'S02/SH02':['EARTH : HUMANITY','12 TRILLION : 1','SCHEMATIC · NOT TO SCALE'],
 'S03/SH01':['30 cm UP · A TINY RECOIL','EARTH: ~2.5 × 10⁻¹⁴ m','SCHEMATIC · MOTION EXAGGERATED'],
 'S03/SH02':['SYSTEM CENTER OF MASS','NO ORBITAL BOOST','ISOLATED MODEL · LANDING REVERSES RECOIL'],
 'S04/SH01':['BILLIONS OF LANDINGS','~1.5 TRILLION JOULES','0.30 m JUMP · E = mgh'],
 'S04/SH02':['THE SOUND OF HUMANITY','A COLLECTIVE ROAR','SOUND RINGS ARE SCHEMATIC'],
 'S05/SH01':['KNEES. SOLES. GROUND.','IMPACT GETS CUSHIONED','LOCAL DEFORMATION + HEAT + VIBRATION'],
 'S05/SH02':['LOCAL GROUND VIBRATION','NO GLOBAL QUAKE','SYNTHETIC TRACE · COUPLING IS UNCERTAIN'],
 'S06/SH01':['ALL OF HUMANITY, TOGETHER','THE CROWD IS THE PROBLEM','REPRESENTATIVE BLOCK · NOT ALL 8.2 BILLION'],
 'S06/SH02':['BODIES ALONE AT 5 PEOPLE/m²','~1,640 km²','SCHEMATIC · DANGEROUS DENSITY'],
 'S07/SH01':['ONE CITY’S WATER SUPPLY','BILLIONS WAITING','ILLUSTRATIVE INFRASTRUCTURE SCENARIO'],
 'S07/SH02':['ROADS BUILT FOR A CITY','HUMANITY NEEDS A WAY HOME','ILLUSTRATIVE INFRASTRUCTURE SCENARIO'],
 'S07/SH03':['CARE HAS LIMITED CAPACITY','THE REAL PRESSURE IS HERE','ILLUSTRATIVE INFRASTRUCTURE SCENARIO'],
 'S08/SH01':['JUMP WHERE WE LIVE','PUSHES PARTLY CANCEL','SCHEMATIC · POPULATION IS UNEVEN'],
 'S09/SH01':['SAME PLANET. SAME ORBIT.','A VERY HUMAN PROBLEM','ISOLATED EARTH–HUMAN MODEL'],
 'S09/SH02':['THE BIGGER QUESTION','HOW DOES EVERYONE GET HOME?','ONE JUMP · EIGHT BILLION PEOPLE']};

export async function createFilm(ctx:{renderer:THREE.WebGLRenderer;base:string}):Promise<FilmDefinition>{
 const tex=await loadEarthTextures(ctx.base,8),street=new StreetStage(ctx.renderer),space=new SpaceStage(tex),mass=new MassStage(tex),recoil=new RecoilStage(),instrument=new InstrumentStage(ctx.renderer),area=new AreaStage(),water=new WaterStage(ctx.renderer),clinic=new ClinicStage();
 const stages:Record<string,Stage>={'S01/SH01':street,'S02/SH01':space,'S02/SH02':mass,'S03/SH01':recoil,'S03/SH02':recoil,'S04/SH01':street,'S04/SH02':street,'S05/SH01':street,'S05/SH02':instrument,'S06/SH01':street,'S06/SH02':area,'S07/SH01':water,'S07/SH02':street,'S07/SH03':clinic,'S08/SH01':space,'S09/SH01':space,'S09/SH02':street};
 return {shots:Object.fromEntries(Object.entries(stages).map(([key,stage])=>[key,{stage,post:{exposure:stage===clinic?1.2:1,bloomStrength:stage===space?.20:.10,vignette:.24,grain:.004,saturation:1.04,contrast:1.02}}])),overlay(o){
   const {ctx:c,shot:s,time_s:t}=o,[title,value,tag]=NOTES[s.key];const enter=smoothstep(s.start_s,s.start_s+.3,t),exit=s.sceneId==='S09'?1-smoothstep(62.1,62.8,t):1;c.save();c.globalAlpha=o.alpha*enter*exit;
   const wash=c.createLinearGradient(0,190,0,480);wash.addColorStop(0,'rgba(3,9,17,.66)');wash.addColorStop(.72,'rgba(3,9,17,.4)');wash.addColorStop(1,'rgba(3,9,17,0)');c.fillStyle=wash;c.fillRect(55,190,970,290);
   drawTag(c,tag,90,244,{size:tag.length>42?16:18,accent:'#FACC55'});drawRich(c,title,90,321,{size:title.length>30?23:26,weight:600,tracking:1.5,color:'#f9d68c'});drawRich(c,value,90,385,{size:value.length>27?32:42,weight:700});
   if(s.key==='S02/SH01'){drawTag(c,'EARTH MASS 5.97 × 10²⁴ kg',540,1070,{size:24,align:'center',accent:'#61c9fa'});}
   if(s.key==='S02/SH02'){drawRich(c,'HUMANITY',200,1010,{size:22,color:'#ffd06a'});drawRich(c,'EARTH',735,1010,{size:22,color:'#6bd3f7'});drawRich(c,'Sphere sizes do not encode mass',540,1120,{size:24,align:'center'});}
   if(s.sceneId==='S03'){drawTag(c,s.key==='S03/SH01'?'~4,000× smaller than a typical atom':'Fixed crosshair = system center of mass',540,470,{size:24,align:'center',accent:'#58cdee'});drawRich(c,'Relative motion enlarged for visibility',540,520,{size:23,align:'center'});}
   if(s.key==='S06/SH02'){drawRich(c,'40 km × 41 km ≈ 1,640 km²',540,1040,{size:31,align:'center',color:'#ffe0a0'});drawRich(c,'Excludes roads, services and safe jump space',540,1110,{size:23,align:'center'});}
   if(s.sceneId==='S08'){drawTag(c,'Internal forces cannot propel the whole system',540,1090,{size:21,align:'center',accent:'#61c9fa'});}
   c.restore();
 }};
}
