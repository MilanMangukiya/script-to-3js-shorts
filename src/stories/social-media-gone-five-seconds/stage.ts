import * as THREE from 'three';
import { type Stage,type ShotInfo } from '../../library/render/FilmPipeline';
import { Humanoid,POSE_STAND } from '../../library/characters/Humanoid';
import { applyGroundedPose,seatedPose,applyStraightWalk } from '../../library/characters/CharacterMotion';
import { solid,surface } from '../../library/util/Modeling';
import { features,makeSet } from './Sets';
import { type City,localSeconds,ramp,pulse } from './timeline';
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
export class ReactionStage implements Stage {
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,9/16,.025,250);person:Humanoid;set:ReturnType<typeof makeSet>;finger:THREE.Mesh;tip:THREE.Mesh;
 phoneTarget=V(0,0,0);rightTarget=V(0,0,0);tapError=0;tapWeight=0;customerTarget=V(0,0,0);
 constructor(public city:City,private renderer:THREE.WebGLRenderer){
  const coat={tokyo:0xe76c83,london:0x476d9b,lagos:0x3f967a,sao:0x7c6db4,mumbai:0xd49b4d,nyc:0x627d88}[city],skin={tokyo:0xcba482,london:0xbba090,lagos:0x805a43,sao:0xbb8e70,mumbai:0xa67a54,nyc:0xb89980}[city];
  this.person=new Humanoid({coat:'jacket',coatColor:coat,trouserColor:0x26343f,skinColor:skin,scarfColor:null});features(this.person);this.scene.add(this.person.root);this.finger=solid(this.person.handR,new THREE.CylinderGeometry(.006,.008,1,10),surface(skin));this.tip=solid(this.person.handR,new THREE.SphereGeometry(.007,10,8),surface(skin));this.set=makeSet(this.scene,this.person,city);
 }
 update(t:number,_shot:ShotInfo){
  const s=localSeconds(this.city,t),sit=this.city==='sao'||this.city==='nyc',{device,controller,game,customer,customerFinger,food}=this.set;
  let pose={...(sit?seatedPose(this.person,.5125):POSE_STAND),lean:sit?.18:.03,headPitch:.08,headYaw:0,armL:[-.6,.1,.7] as [number,number,number],armR:[-.6,.1,.7] as [number,number,number]};
  if(this.city==='tokyo'){const dance=1-ramp(s,1.2,2.8),wave=Math.sin(s*3)*dance;pose={...pose,sideLean:wave*.1,twist:wave*.1,headYaw:ramp(s,2.8,3.7)*.3,armL:[-1.5+wave*.2,.45,.5],armR:[-1.1-wave*.4,.4,.6]};}
  else if(this.city==='sao')pose={...pose,lean:.18,sideLean:-.08*pulse(t,27.15,27.45,27.85,28.3),headPitch:.12};
  else if(this.city==='nyc')pose={...pose,lean:.30,headPitch:.10,headYaw:.05};
  else pose={...pose,headPitch:.22,headYaw:this.city==='lagos'?ramp(s,2,3.6)*.6:0};
  applyGroundedPose(this.person,pose);this.finger.visible=this.tip.visible=false;this.tapWeight=0;this.tapError=0;
  if(this.city==='tokyo')device.set('creator');
  else if(this.city==='sao'){
   controller!.rotation.z=.025*pulse(t,23.9,24.2,24.5,24.8);controller!.updateMatrixWorld(true);
   this.person.reachArm('L',controller!.localToWorld(V(.085,0,0)),V(0,-1,0),1);this.person.reachArm('R',controller!.localToWorld(V(-.085,0,0)),V(0,-1,0),1);
   applyStraightWalk(game!.actor,t,{origin:[-.20,0,.55],heading:Math.PI/2,start_s:27.15,end_s:27.85,distance_m:.45,steps:6,settle_s:.25});
   const z=t<27?THREE.MathUtils.lerp(-1.2,-.5,ramp(t,24,27)):THREE.MathUtils.lerp(-.5,1.5,ramp(t,27,29.2));game!.hazard.position.set(-.20,.24,z);game!.hazard.visible=t>=24&&t<29.5;this.renderGame();
  }else{
   if(this.city==='nyc')this.phoneTarget.set(.18,.83,-1.46);else this.phoneTarget.copy(device.point(0,-.105,-.010));this.person.reachArm('L',this.phoneTarget,V(1,-.5,0),1);
   let tap=0;if(this.city==='london')tap=Math.max(pulse(s,.3,.65,.85,1.2),pulse(s,2.5,2.85,3.05,3.4));if(this.city==='mumbai')tap=Math.max(pulse(s,1.9,2.2,2.35,2.6),pulse(s,3.2,3.45,3.6,3.85));if(this.city==='nyc')tap=pulse(s,1.2,2.75,4,4.5);this.tapWeight=tap;
   const target=device.point(this.city==='nyc'?.06:0,this.city==='nyc'?-.09:this.city==='mumbai'?-.055:.01),offset=V(.060,-.045,.045).applyQuaternion(device.group.quaternion),wrist=target.clone().add(offset);
   this.rightTarget.copy(V(this.person.root.position.x-.3,sit?.82:1,-1.42)).lerp(wrist,tap);this.person.reachArm('R',this.rightTarget,V(-1,-.3,0),1);
   const local=this.person.handR.worldToLocal(target.clone()),len=Math.min(.09,local.length()),axis=local.clone().normalize();this.finger.position.copy(axis).multiplyScalar((len+.022)/2);this.finger.scale.y=Math.max(.001,len-.022);this.finger.quaternion.setFromUnitVectors(V(0,1,0),axis);this.tip.position.copy(axis).multiplyScalar(len);this.finger.visible=this.tip.visible=tap>.2;this.tip.updateMatrixWorld();this.tapError=this.tip.getWorldPosition(V(0,0,0)).distanceTo(target);
   device.set(this.city==='london'?'feed':this.city==='lagos'?'inbox':this.city==='nyc'?'reply':s<2.35?'messages':s<3.6?'sms':'sent');
  }
  if(customer){const a=ramp(s,1.8,3.2);applyGroundedPose(customer,{...POSE_STAND,headYaw:.2,headPitch:.16,armL:[.1,.1,.1],armR:[-.2,.1,.5]});const hand=V(.65,1.13,-.68).lerp(V(.52,1.13,-.86),a);this.customerTarget.copy(hand);customer.reachArm('R',hand,V(1,-.2,0),1);const axis=customer.handR.worldToLocal(food[3].clone()).normalize();customerFinger!.position.copy(axis).multiplyScalar(.05);customerFinger!.quaternion.setFromUnitVectors(V(0,1,0),axis);customerFinger!.visible=a>.2;}
 }
 renderGame(){const game=this.set.game!,rt=this.renderer.getRenderTarget(),vp=this.renderer.getViewport(new THREE.Vector4()),sc=this.renderer.getScissor(new THREE.Vector4()),st=this.renderer.getScissorTest();try{this.renderer.setRenderTarget(game.rt);this.renderer.setViewport(0,0,640,360);this.renderer.setScissorTest(false);this.renderer.clear();this.renderer.render(game.scene,game.camera);}finally{this.renderer.setRenderTarget(rt);this.renderer.setViewport(vp);this.renderer.setScissor(sc);this.renderer.setScissorTest(st);}}
}
