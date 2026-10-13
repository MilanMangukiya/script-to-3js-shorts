import * as THREE from 'three';
import type {Stage,ShotInfo} from '../../../library/render/FilmPipeline';
import {Earth,type EarthTextures} from '../../../library/planet/Earth';
import {Starfield} from '../../../library/space/Starfield';
import {HistoryRibbon} from '../../../library/diagram/HistoryRibbon';
import {PopulationPyramid} from '../../../library/diagram/PopulationPyramid';
import {Seismometer} from '../../../library/props/Seismometer';
import {NewbornHand} from '../../../library/characters/NewbornHand';
import {CityStreet} from '../../../library/environment/CityStreet';
import {SkyDome} from '../../../library/environment/SkyDome';
import {BokehField} from '../../../library/fx/BokehField';
import {surface,solid,box,rod,canvasTexture} from '../../../library/util/Modeling';
import {smoothstep,lerp,rng,clamp} from '../../../library/util/math';
export interface PopulationData{history:{year:number,value:number}[];female:number[];survivors:number[];source:string}
abstract class Base implements Stage{scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,9/16,.001,10000);constructor(){this.scene.background=new THREE.Color(0x081219);}abstract update(t:number,s:ShotInfo):void;cam(p:number[],look:number[],fov:number){this.camera.position.set(...p as [number,number,number]);this.camera.lookAt(...look as [number,number,number]);this.camera.fov=fov;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);}}
const lights=(s:THREE.Scene,p:number[],power=2)=>{const l=new THREE.DirectionalLight(0xffe4c4,power);l.position.set(...p as [number,number,number]);s.add(l,new THREE.HemisphereLight(0xb6d4e7,0x27323b,1.2));};
export class PopulationEarthStage extends Base{
 earth:Earth;stars=new Starfield({count:1400,radius:150,brightness:.18});ribbon:HistoryRibbon;
 constructor(tex:EarthTextures,data:PopulationData){super();this.earth=new Earth(tex,{radius:6.371,sunDirection:new THREE.Vector3(-1,.45,.7),nightLights:1.2,atmosphereStrength:.6});this.earth.setView(10,29);this.earth.spinRate=.005;this.earth.group.position.set(0,-5,-4);this.ribbon=new HistoryRibbon(data.history,{width:3.1,height:1.4,maxValue:10});this.ribbon.group.position.set(0,.45,2.3);this.scene.add(this.earth.group,this.stars.points,this.ribbon.group);}
 update(t:number){this.cam([.14*Math.sin(t*.15),1.8,11],[0,.3,0],38);this.earth.update(t);this.stars.follow(this.camera);this.ribbon.update(1-smoothstep(7.6,10.7,t)*(2026-1975)/(2026-1950));}
}
export class SeismicStage extends Base{
 sensor=new Seismometer();section=new THREE.Group();vault=new THREE.Group();traces:THREE.Line[]=[];
 constructor(){super();lights(this.scene,[1,4,2],2.3);this.scene.add(this.vault,this.section);
  box(this.vault,[2,.22,1.5],surface(0x636b66),[0,-.15,0]);box(this.vault,[2,1.2,.12],surface(0x535d60),[0,.42,-.65]);for(let i=0;i<13;i++)rod(this.vault,[-.9+i*.15,-.035,-.62],[-.9+i*.15,1,-.62],.0025,surface(0x313b3e));
  this.vault.add(this.sensor.group);box(this.vault,[.45,.035,.40],surface(0x92958d),[0,-.018,0]);
  const r=rng(714);for(let k=0;k<5;k++){box(this.section,[16,.9,4],surface([0x625243,0x706252,0x3b4341,0x4f5551,0x343d40][k]),[0,-.5-k*.9,0]);for(let i=0;i<23;i++)solid(this.section,new THREE.SphereGeometry(.035+r()*.1,7,5),surface(0x6c6b60),[-7.7+r()*15.4,-.15-k*.9-r()*.7,2.01]);}
  box(this.section,[16,.13,4],surface(0x25313a),[0,.04,0]);const building=surface(0x44515b);for(let i=0;i<7;i++){const h=1+r()*3;box(this.section,[1.45,h,1.1],building,[-6.5+i*2,h/2,-1.5]);for(let y=.4;y<h;y+=.5)for(let x of [-.4,0,.4])box(this.section,[.22,.26,.02],surface(0x90a9ad),[-6.5+i*2+x,y,-.93]);}
  for(let j=0;j<3;j++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(180*3),3));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x9bc5b7,transparent:true,opacity:.40-j*.08}));this.traces.push(l);this.section.add(l);}
 }
 update(t:number,s:ShotInfo){const cut=s.shotId==='SH02';this.vault.visible=!cut;this.section.visible=cut;this.sensor.update(t,1-.5*smoothstep(20.4,22.1,t));if(!cut)this.cam([.5,.6,1.65],[.04,.25,-.02],36);else{const q=smoothstep(22.6,25.8,t);this.cam([5-q*2,1+q*3,19],[0,-.7+q*.7,0],48);this.traces.forEach((l,j)=>{const a=l.geometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<180;i++){const x=(i/179-.5)*16;a.setXYZ(i,x,-.5-j*1.25+(.13-j*.02)*.5*Math.sin(x*6-t*5)*Math.sin(x*2.1+t),2.025);}a.needsUpdate=true;});}}
}
export class NewbornStage extends Base{
 hand=new NewbornHand({skinColor:0xc99379});bokeh=new BokehField({count:24,center:new THREE.Vector3(0,.1,-.18),extent:new THREE.Vector3(.3,.2,.04),size:180,gain:.027,colors:[0xffc28a,0xffecc5]});
 constructor(){super();this.scene.background=new THREE.Color(0x342e2a);this.scene.add(this.hand.group,this.bokeh.points);this.hand.group.position.y=.013;this.hand.group.rotation.y=-.2;
  const blanket=new THREE.PlaneGeometry(1,1,120,120);blanket.rotateX(-Math.PI/2);const p=blanket.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,-.017+.006*Math.sin(x*48+z*11)+.002*Math.sin(z*127));}blanket.computeVertexNormals();const cloth=surface(0xbeb6a0,.98);cloth.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor *= .96 + .04*sin(gl_FragCoord.x*2.)*sin(gl_FragCoord.y*2.);');};solid(this.scene,blanket,cloth);
  const adult=new THREE.Mesh(new THREE.CapsuleGeometry(.0065,.105,12,32),new THREE.MeshPhysicalMaterial({color:0x855944,roughness:.75,sheen:.45,sheenColor:0xbd8d72}));adult.rotation.z=Math.PI/2;adult.position.set(.035,.035,.040);this.scene.add(adult);
  const nail=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshPhysicalMaterial({color:0xab8472,roughness:.5,clearcoat:.1}));nail.scale.set(.009,.0005,.004);nail.position.set(-.010,.042,.040);this.scene.add(nail);lights(this.scene,[-.15,.25,.18],2.2);const rim=new THREE.DirectionalLight(0x97b5d9,.7);rim.position.set(.2,.08,-.3);this.scene.add(rim);
 }
 update(t:number){this.hand.update(t,smoothstep(49.6,50.4,t)*.85);this.bokeh.update(t);const q=smoothstep(48.6,52.8,t);this.cam([.105-q*.02,.16,.235],[.009,-.004,.006],30);}
}
export class BirthCityStage extends Base{
 city=new CityStreet({seed:4175,blocks:5,farFieldRadius:1250,vehicles:false});window=new THREE.Group();glints:THREE.Mesh[]=[];sky=new SkyDome({zenithColor:0x121d33,horizonColor:0x344158,sunIntensity:0,sunGlow:0});
 constructor(renderer:THREE.WebGLRenderer){super();this.scene.add(this.city.group,this.sky.mesh,this.window);this.scene.environment=this.sky.toEnvironment(renderer);this.scene.environmentIntensity=.4;lights(this.scene,[4,30,20],.7);this.scene.fog=new THREE.FogExp2(0x243547,.0015);
  // Independent nursery facade faces the camera, above the city roofline sightline.
  box(this.window,[17,21,2],surface(0x46515b),[0,10.5,-8]);for(let y=2;y<21;y+=3)for(let x=-6;x<=6;x+=3){box(this.window,[1.6,1.7,.035],surface(0x8b8c78),[x,y,-6.97]);box(this.window,[1.62,.04,.06],surface(0x192a35),[x,y,-6.94]);}
  box(this.window,[2.6,2.2,.04],new THREE.MeshBasicMaterial({color:0xf5be79}),[0,12,-6.91]);for(const x of [-.65,.65])box(this.window,[.05,2.3,.12],surface(0x374147),[x,12,-6.85]);
  for(let i=0;i<3;i++){box(this.window,[.48,.12,.04],surface(0xe8dcc0),[-.82+i*.82,11.5,-6.83]);}
  const r=rng(777);for(let i=0;i<70;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({color:0xffdc9d,transparent:true,opacity:0,depthWrite:false}));m.position.set((r()-.5)*500,15+r()*38,-60-r()*650);this.glints.push(m);this.scene.add(m);}
 }
 update(t:number){const q=smoothstep(52.8,56.8,t);this.cam([lerp(0,12,q),lerp(12.2,105,q),lerp(-1,290,q)],[0,lerp(12,15,q),-8],36);this.city.update(t,{lights:1,wetness:.2});this.glints.forEach((m,i)=>{const a=smoothstep(53.4+i*.036,53.75+i*.036,t)*(1-smoothstep(54.0+i*.036,54.7+i*.036,t));m.scale.setScalar(.2+1.3*a);(m.material as THREE.MeshBasicMaterial).opacity=.8*a;});}
}
export class PyramidStage extends Base{
 pyramid=new PopulationPyramid({millionsPerUnit:75,step:.028});year=.75;data:PopulationData;hatches=new THREE.Group();
 constructor(data:PopulationData){super();this.data=data;this.scene.add(this.pyramid.group,this.hatches);box(this.scene,[2.8,.16,1.2],surface(0x17262d,.35,.25),[0,-.15,0]);lights(this.scene,[1,4,5],2.6);
  for(let age=0;age<20;age++)for(const sex of [-1,1]){const m=solid(this.hatches,new THREE.BoxGeometry(.038,.003,.165),surface(0xaa9570,.4),[sex*.027,age*.028,.01]);m.rotation.z=.15;}
 }
 update(t:number,s:ShotInfo){this.year=s.shotId==='SH01'?lerp(.75,2,smoothstep(58.3,60.2,t)):lerp(2,20,smoothstep(60.9,64.1,t));const shift=this.year,whole=Math.floor(shift),part=shift-whole;
  const female=Array(101).fill(0),male=Array(101).fill(0);for(let age=0;age<101;age++){const src=age-whole;if(src>=0){const n=(this.data.female[src]??0)*(1-part)+(this.data.female[src-1]??0)*part;const l0=this.data.survivors[Math.max(0,Math.round(age-shift))]||1,lt=this.data.survivors[age]||0;female[age]=n*Math.min(1,lt/l0);}}
  // The first nine months are an estimate; later tiny bars show uncertainty, not a fertility forecast.
  const cohortAge=Math.max(0,shift-.75),low=Math.floor(cohortAge),q=cohortAge-low;male[low]+=50*(1-q)*.98;male[Math.min(100,low+1)]+=50*q*.98;female[low]+=48*(1-q)*.98;female[Math.min(100,low+1)]+=48*q*.98;
  for(let a=0;a<cohortAge;a++){male[a]+=.8;female[a]+=.8;}this.pyramid.update(male,female);this.hatches.children.forEach((m,i)=>m.visible=Math.floor(i/2)<cohortAge);
  const zoom=smoothstep(61,64.4,t);this.cam([lerp(-.7,.25,zoom),lerp(1.55,.92,zoom),lerp(8,4.9,zoom)],[0,lerp(1.35,.75,zoom),0],40);
 }
}
