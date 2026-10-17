import * as THREE from 'three';
import {type Stage,type ShotInfo} from '../../library/render/FilmPipeline';
import {CityStreetClassic} from '../../library/environment/CityStreetClassic';
import {SkyDome} from '../../library/environment/SkyDome';
import {SoundRings} from '../../library/diagram/SoundRings';
import {box,rod,surface,canvasTexture} from '../../library/util/Modeling';
import {ClapActor} from './ClapActor';
import {C,T,localClock,ramp} from './timeline';
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z),SUN=V(-.45,.82,.55).normalize();
class Exterior implements Stage{
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,9/16,.08,8000);sky:SkyDome;key:THREE.DirectionalLight;
 constructor(renderer:THREE.WebGLRenderer){
  this.sky=new SkyDome({zenithColor:0x367fa9,horizonColor:0xc2d8dd,groundColor:0x9c9d80,sunDirection:SUN,sunGlow:.13,hazeAmount:.1,sunIntensity:10});this.scene.add(this.sky.mesh);this.scene.environment=this.sky.toEnvironment(renderer,.025);
  this.key=new THREE.DirectionalLight(0xffe7bd,2.7);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);this.key.shadow.bias=-.0002;this.key.shadow.normalBias=.015;this.scene.add(this.key,this.key.target,new THREE.HemisphereLight(0xc4d9e6,0xb79c7d,1.5));
 }
 update(t:number,shot:ShotInfo){
  this.sky.follow(this.camera);const wide=this.camera.position.y>50,far=shot.sceneId==='S04'&&shot.shotId==='SH01',focus=V(8.3,0,far?-1000:wide&&shot.sceneId==='S04'?-500:0),extent=wide?800:35;
  this.key.position.copy(focus).addScaledVector(SUN,1800);this.key.target.position.copy(focus);Object.assign(this.key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:1,far:4000});this.key.shadow.camera.updateProjectionMatrix();this.camera.near=wide?1:.08;this.camera.updateProjectionMatrix();
 }
}
export class StreetStage extends Exterior{
 city=new CityStreetClassic({seed:8303,blocks:3,storeysMin:3,storeysMax:6,wetness:0,vehicles:false,farFieldRadius:0});
 farCity=new CityStreetClassic({seed:8304,blocks:2,storeysMin:3,storeysMax:5,wetness:0,vehicles:false,farFieldRadius:0});
 actors:ClapActor[]=[];hero:ClapActor;source:ClapActor;wave=new SoundRings({mode:'ground',color:0x1988ae,speedVisual:C,maxRadius:1200,thickness:.005,opacity:.8,count:1});
 constructor(renderer:THREE.WebGLRenderer){
  super(renderer);this.scene.add(this.city.group);this.farCity.group.position.z=-1000;this.scene.add(this.farCity.group);box(this.scene,[1800,.12,2400],surface(0x94a18a,.98),[0,-.18,-500]);
  for(const z of [-220,-480,-740]){const mid=this.city.near.clone(true);mid.position.z=z;this.scene.add(mid);}
  // A clear kilometre sidewalk/road connects the selected endpoints; buildings stay outside the path.
  // Fill only gaps between the registered street kits. Overlapping long planes
  // caused depth conflicts in close shots and would also shimmer from the air.
  for(const [a,b] of [[-181,-79],[-441,-299],[-701,-559],[-969,-819]]){
   box(this.scene,[14,.08,b-a],surface(0x59656a,.9),[0,-.045,(a+b)/2]);
   box(this.scene,[4,.15,b-a],surface(0x9a9f98,.93),[9,.025,(a+b)/2]);
  }
  this.hero=new ClapActor(this.scene,[8.3,.1,0],0xe39758,0xc89a76,true);this.actors.push(this.hero);
  const coats=[0x4d91a0,0x759b75,0xc4807c,0x9a83ac,0xd6b563],skins=[0x825e43,0xc29a78,0xd8b292,0x6e4e38];
  for(let row=0;row<4;row++)for(let col=0;col<3;col++)this.actors.push(new ClapActor(this.scene,[7.5+col*1.0,.1,-2.4-row*2.2],coats[(row+col)%5],skins[(row*3+col)%4],false,row*3+col+1));
  this.source=new ClapActor(this.scene,[8.3,.1,-1000],0x599cb2,0xba8b65,true,15);this.actors.push(this.source);for(let i=0;i<5;i++)this.actors.push(new ClapActor(this.scene,[7.5+i%3,.1,-1002-Math.floor(i/3)*2],coats[i],skins[i%4],false,20+i));
  this.wave.position.y=.205;this.wave.traverse(o=>{if(o instanceof THREE.Mesh&&(o.material as THREE.MeshBasicMaterial).isMeshBasicMaterial)(o.material as THREE.MeshBasicMaterial).blending=THREE.NormalBlending;});this.scene.add(this.wave);
 }
 update(t:number,shot:ShotInfo){
  super.update(t,shot);this.city.update(t,{lights:0,wetness:0});this.farCity.update(t,{lights:0,wetness:0});const k=localClock(t,shot.sceneId);this.actors.forEach(a=>a.update(k));
  const travel=shot.sceneId==='S04'||shot.sceneId==='S05',macro=shot.sceneId==='S03';this.wave.position.set(8.3,.205,travel?-1000:0);const age=k-.9;this.wave.pulse(age,travel?1200:320);this.wave.visible=(travel||macro)&&age>=0&&age*C<(travel?1200:320);
  if(shot.sceneId==='S05')this.hero.person.head.rotation.y=.34*ramp(t,T.arrival,T.arrival+.55);
 }
}
export class OpenStage extends Exterior{
 actors:ClapActor[]=[];hero:ClapActor;wave=new SoundRings({mode:'ground',color:0x5ec3d8,speedVisual:C,maxRadius:15,thickness:.018,opacity:.25,count:1});
 constructor(renderer:THREE.WebGLRenderer){super(renderer);box(this.scene,[1600,.12,1600],surface(0x9da986,.96),[0,-.06,0]);box(this.scene,[12,.014,12],surface(0xc2ba9e,.95),[2,.007,0]);this.hero=new ClapActor(this.scene,[0,.014,0],0xe39758,0xc89a76,true);this.actors.push(this.hero,new ClapActor(this.scene,[2,.014,0],0x4d91a0,0x9e7859,false,1),new ClapActor(this.scene,[4,.014,0],0x9c81a5,0xd3b08d,false,2));this.wave.position.y=.04;this.scene.add(this.wave);}
 update(t:number,shot:ShotInfo){super.update(t,shot);const k=localClock(t,shot.sceneId);this.actors.forEach(a=>a.update(k));this.wave.pulse(k-.9,15);this.wave.visible=k>=.9&&k<.945;}
}
export class EchoStage extends Exterior{
 city=new CityStreetClassic({seed:8303,blocks:3,storeysMin:3,storeysMax:6,wetness:0,vehicles:false,farFieldRadius:1500});actors:ClapActor[]=[];hero:ClapActor;
 direct=new SoundRings({mode:'ground',color:0x5ec3d8,speedVisual:C,maxRadius:70,thickness:.012,opacity:.32,count:1});reflection=new SoundRings({mode:'ground',color:0xf3cc6b,speedVisual:C,maxRadius:75,thickness:.012,opacity:.24,count:1});paths:THREE.Mesh[]=[];
 constructor(renderer:THREE.WebGLRenderer){
  super(renderer);this.scene.add(this.city.group);this.hero=new ClapActor(this.scene,[8.3,.1,0],0xe39758,0xc89a76,true);this.actors.push(this.hero,new ClapActor(this.scene,[9.5,.1,-2],0x759c9f,0x825b43,false,1));
  const tex=canvasTexture(512,512,c=>{c.fillStyle='#b99b76';c.fillRect(0,0,512,512);c.strokeStyle='#8c816b';c.lineWidth=5;for(let y=0;y<512;y+=36){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();for(let x=(y/36%2)*40;x<512;x+=80){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+36);c.stroke();}}});tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(8,2);box(this.scene,[30,7,.7],new THREE.MeshStandardMaterial({map:tex,roughness:.92}),[0,3.5,-30]);
  this.direct.position.set(8.3,.205,0);this.reflection.position.set(8.3,.205,-60);this.scene.add(this.direct,this.reflection);
  const m=new THREE.MeshBasicMaterial({color:0xefc65a,transparent:true,opacity:.35,depthWrite:false});this.paths.push(rod(this.scene,[8.15,1.2,.4],[8.15,1.2,-29.65],.018,m),rod(this.scene,[8.45,1.2,-29.65],[8.45,1.2,.4],.018,m));
 }
 update(t:number,shot:ShotInfo){super.update(t,shot);this.city.update(t,{lights:0,wetness:0});const k=localClock(t,shot.sceneId),age=k-.9;this.actors.forEach(a=>a.update(k));this.direct.pulse(age,70);this.direct.visible=age>=0&&age*C<70;this.reflection.pulse(age,75);this.reflection.visible=age>=30/C&&age*C<75;this.paths.forEach((p,i)=>p.visible=age>=(i?60:30)/C);this.hero.person.head.rotation.y=.38*ramp(t,36.6,37.3);}
}
