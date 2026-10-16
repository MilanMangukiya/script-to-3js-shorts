import * as THREE from 'three';
import {type Stage,type ShotInfo} from '../../library/render/FilmPipeline';
import {SkyDome} from '../../library/environment/SkyDome';
import {OceanSurface} from '../../library/environment/OceanSurface';
import {Sailboat} from '../../library/vehicles/Sailboat';
import {PlasticBottle} from '../../library/props/PlasticBottle';
import {SwimmingPoolField} from '../../library/environment/SwimmingPoolField';
import {WaterVolumeTank} from '../../library/props/WaterVolumeTank';
import {Humanoid,POSE_STAND} from '../../library/characters/Humanoid';
import {applyGroundedPose} from '../../library/characters/CharacterMotion';
import {box,solid,rod,surface,canvasTexture,screen} from '../../library/util/Modeling';
import {rng} from '../../library/util/math';
import {StrawActor} from './Actor';
import {T,intake,ramp,DROP_NM,MM_EACH_L,FULL_EACH_L} from './timeline';
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z),SUN=V(.4,.75,.3).normalize();
class Exterior implements Stage {
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,9/16,.025,30000);sky:SkyDome;
 constructor(renderer:THREE.WebGLRenderer,extent=30){
  this.sky=new SkyDome({zenithColor:0x377eaf,horizonColor:0xb8d5db,groundColor:0x9f976c,sunDirection:SUN,sunGlow:.15,hazeAmount:.12,sunIntensity:10});this.scene.add(this.sky.mesh);this.scene.environment=this.sky.toEnvironment(renderer,.025);
  const k=new THREE.DirectionalLight(0xffedcb,2.5);k.position.copy(SUN).multiplyScalar(extent*2);k.target.position.set(0,extent*.15,0);k.castShadow=true;k.shadow.mapSize.set(1024,1024);Object.assign(k.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:extent*8});k.shadow.bias=-.0003;k.shadow.normalBias=.018;this.scene.add(k,k.target,new THREE.HemisphereLight(0xc1d8e6,0xb3996d,1.45));
 }
 update(t:number,_shot:ShotInfo){this.sky.follow(this.camera);}
}
export class CoastStage extends Exterior {
 ocean:OceanSurface;actors:StrawActor[]=[];hero:StrawActor;boat=new Sailboat({length:7,sails:false,seed:4});bottle=new PlasticBottle({height:.28,radius:.043,labelColor:0x4a9db3});
 constructor(renderer:THREE.WebGLRenderer){
  super(renderer);this.ocean=new OceanSurface({size:15000,level:-.45,deepColor:0x14617c,horizonColor:0xb8d5db,zenithColor:0x377eaf,sunDirection:SUN,waveHeight:.42,glitter:.45});this.scene.add(this.ocean.mesh);
  const wood=surface(0xa98c64,.85),post=surface(0x6b6653,.85);box(this.scene,[5.7,.16,21],wood,[0,-.08,-9.6]);for(let z=-19;z<.8;z+=.28)box(this.scene,[5.65,.004,.012],surface(0x6c6554),[0,.002,z]);
  for(const x of [-2.65,2.65])for(let z=-18;z<1;z+=3){solid(this.scene,new THREE.CylinderGeometry(.16,.19,2.8,10),post,[x,-1.3,z]);rod(this.scene,[x,.1,z],[x,1.0,z],.035,post);}
  const beach=new THREE.BufferGeometry();beach.setAttribute('position',new THREE.Float32BufferAttribute([-300,-.45,-18,300,-.45,-18,-300,1.2,-70,300,1.2,-70],3));beach.setIndex([0,2,1,1,2,3]);beach.computeVertexNormals();const sand=new THREE.Mesh(beach,surface(0xd8c29a,.97));sand.receiveShadow=true;this.scene.add(sand);box(this.scene,[600,.4,500],surface(0xcab590),[0,.8,-320]);
  for(let i=0;i<5;i++){const g=new THREE.Group();g.position.set(-12-i*8,1,-28-i*3);this.scene.add(g);rod(g,[0,0,0],[.5,5,0],.17,surface(0x917453));for(let j=0;j<6;j++){const a=j*Math.PI/3;solid(g,new THREE.SphereGeometry(1,10,6).scale(1.7,.13,.32).rotateY(a),surface(0x568673),[.5+Math.cos(a)*.8,5,Math.sin(a)*.8]);}}
  this.boat.group.position.set(-16,-.45,-2);this.scene.add(this.boat.group);
  this.hero=new StrawActor(this.scene,[0,0,0],0xdf8661,0xc29b78,true);this.actors.push(this.hero);const r=rng(8300),colors=[0x497f99,0x5ca48c,0xd4ad61,0x9882ae,0xd97773],skins=[0x916a4b,0xba8e6c,0xd9b693,0x765542];
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){const x=(col-2)*1.0,z=-2.0-row*2.2;this.actors.push(new StrawActor(this.scene,[x,0,z],colors[Math.floor(r()*colors.length)],skins[Math.floor(r()*skins.length)]));}
  this.bottle.group.position.set(1.15,.005,.2);this.scene.add(this.bottle.group);
  const label=canvasTexture(256,256,c=>{c.fillStyle='#dfe9df';c.fillRect(0,0,256,256);c.fillStyle='#204e60';c.font='800 86px Inter';c.textAlign='center';c.fillText('1 L',128,160);});const plate=screen(this.scene,.10,.10,label,[1.15,.15,.246]);
  const p=solid(this.scene,new THREE.CylinderGeometry(.19,.19,1.6,16),surface(0x746b5b),[2.8,-.7,-17.2]);solid(this.scene,new THREE.CylinderGeometry(.194,.194,.035,16),surface(0x303c3d),[2.8,-.45,-17.2]);
 }
 update(t:number,shot:ShotInfo){super.update(t,shot);this.ocean.update(t);this.ocean.mesh.position.y=-.45-intake(t)*DROP_NM*1e-9;this.actors.forEach(a=>a.update(t));this.boat.update(t,{bob:.45});}
}
export class PoolStage extends Exterior {
 pools=new SwimmingPoolField({columns:40,rows:83,width:25,length:50,depth:2,gap:7});
 constructor(renderer:THREE.WebGLRenderer){super(renderer,3200);this.camera.near=.5;this.camera.updateProjectionMatrix();this.scene.add(this.pools);}
 update(t:number,shot:ShotInfo){super.update(t,shot);this.pools.setFill(ramp(t,T.pool0,T.pool1));}
}
export class TankStage extends Exterior {
 tank:WaterVolumeTank;person=new Humanoid({coat:'jacket',coatColor:0xdf8661,skinColor:0xc29b78,scarfColor:null});bottle=new PlasticBottle({height:.28,radius:.043,labelColor:0x4a9db3});big:boolean;ocean:OceanSurface;
 constructor(renderer:THREE.WebGLRenderer,big=false){
  const liters=big?FULL_EACH_L:MM_EACH_L,s=Math.cbrt(liters/1000);super(renderer,big?1200:20);this.big=big;this.camera.near=big?2:.1;this.camera.updateProjectionMatrix();this.tank=new WaterVolumeTank(liters);this.scene.add(this.tank);box(this.scene,[s*3+12,.25,s*3+12],surface(0xc4bda9,.93),[0,-.125,0]);
  this.ocean=new OceanSurface({size:15000,level:-.6,deepColor:0x14617c,sunDirection:SUN,waveHeight:.4,glitter:.3});this.scene.add(this.ocean.mesh);
  this.person.root.position.set(big?440:2.8,0,big?440:1.8);this.person.root.rotation.y=-.3;this.scene.add(this.person.root);this.bottle.group.position.set(this.person.root.position.x-.1,1.0,this.person.root.position.z+.25);this.scene.add(this.bottle.group);
 }
 update(t:number,shot:ShotInfo){super.update(t,shot);this.ocean.update(t);this.tank.setFill(this.big?1:ramp(t,T.small0,T.small1));applyGroundedPose(this.person,{...POSE_STAND,headPitch:this.big?-.20:-.12,headYaw:-.2,armL:[.04,.1,.3],armR:[-.7,.1,.8]});const p=this.bottle.group.localToWorld(V(0,.10,0));this.person.reachArm('R',p,V(-1,0,0),1);}
}
