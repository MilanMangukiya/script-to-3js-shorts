import * as THREE from 'three';
import { type Stage,type ShotInfo } from '../../library/render/FilmPipeline';
import { RoomBox,table,chair,mug,plant,tableLamp } from '../../library/environment/RoomBox';
import { Humanoid } from '../../library/characters/Humanoid';
import { applyGroundedPose,seatedPose } from '../../library/characters/CharacterMotion';
import { box,solid,rod,surface,canvasTexture,screen } from '../../library/util/Modeling';
import { Phone,type Mode } from './Phone';
import { T,ramp,pulse,outageSeconds,unit } from './timeline';
const H=.7875,R=.063,A=48*Math.PI/180,SEAT=.5125;
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
function face(person:Humanoid){
 const black=surface(0x202a31,.85),eyes:THREE.Mesh[]=[];for(const x of [-.034,.034])eyes.push(solid(person.head,new THREE.SphereGeometry(.0075,10,8),black,[x,.136,.104]));
 const smile=solid(person.head,new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V(-.026,.082,.102),V(0,.060,.114),V(.026,.082,.102)),16,.003,6,false),black);
 const open=solid(person.head,new THREE.SphereGeometry(.018,14,10).scale(1.5,.60,.2),black,[0,.078,.107]);open.visible=false;
 const teeth=box(person.head,[.036,.004,.002],surface(0xeee2cd),[0,.083,.112]);teeth.visible=false;return {smile,open,teeth,eyes};
}
export class CafeStage implements Stage {
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,9/16,.025,40);
 readonly person=new Humanoid({coat:'jacket',coatColor:0x3c6e78,trouserColor:0x243944,skinColor:0xc9997c,scarfColor:null});
 readonly friend=new Humanoid({coat:'jacket',coatColor:0xbc754a,trouserColor:0x344a52,skinColor:0xb98563,scarfColor:null});
 readonly expressions;readonly cup:THREE.Group;readonly phone:Phone;readonly finger:THREE.Mesh;
 readonly phoneRT=new THREE.WebGLRenderTarget(384,512,{type:THREE.HalfFloatType});readonly phoneCamera=new THREE.PerspectiveCamera(65,384/512,.015,20);
 readonly tapFinger:THREE.Mesh;readonly tapTip:THREE.Mesh;tapWeight=0;tapError=0;
 rightTarget=V(0,0,0);leftTarget=V(0,0,0);gripTarget=V(0,0,0);phoneGrip=V(0,0,0);phoneTap=V(0,0,0);
 cupAngle=0;grabWeight=0;mode:Mode='draft';elapsed=0;phoneSupported=false;
 constructor(private renderer:THREE.WebGLRenderer){
  this.scene.background=new THREE.Color(0xadc4bf);
  const room=new RoomBox({width:5,height:3.4,depth:5,wallColor:0x34585c,floorColor:0x6b5140,ceiling:true});this.scene.add(room);
  room.children[3].visible=false;
  const wall=surface(0x34585c,.95),frame=surface(0xb8c1ac,.6);
  box(room,[.12,3.4,1],wall,[2.5,1.7,-.5]);box(room,[.12,3.4,1],wall,[2.5,1.7,-4.5]);box(room,[.12,.8,3],wall,[2.5,.4,-2.5]);box(room,[.12,.4,3],wall,[2.5,3.2,-2.5]);
  for(const z of [-1,-4])box(room,[.16,2.2,.09],frame,[2.45,1.9,z]);for(const y of [.8,3])box(room,[.16,.08,3.1],frame,[2.45,y,-2.5]);
  const glass=new THREE.MeshBasicMaterial({color:0xc5ddcd});box(room,[.035,2.15,2.9],glass,[2.56,1.9,-2.5]);
  table(room,0,-1.4,1.6,.8);chair(room,.34,-.73,Math.PI,0x635e4d);chair(room,.10,-2.10,0,0x635e4d);
  // The tiny lip supplies the visible tipping support; the cup stays supported throughout.
  box(room,[.012,.014,.8],surface(0x694b33),[.802,H-.001,-1.4]);
  this.cup=mug(room,[.47,H,-1.35],0xe6dfc9);this.cup.scale.setScalar(1.5);
  (this.cup.children[0] as THREE.Mesh).material=(this.cup.children[0] as THREE.Mesh).material.clone();
  ((this.cup.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
  solid(this.cup,new THREE.TorusGeometry(.047,.003,8,36).rotateX(Math.PI/2),surface(0xe6dfc9,.3),[0,.10,0]);
  (this.cup.children[1] as THREE.Mesh).position.y=.025;
  solid(this.cup,new THREE.CylinderGeometry(.042,.042,.008,20),surface(0xe6dfc9,.35),[0,.004,0]);
  const inlay=surface(0x698579,.8);inlay.polygonOffset=true;inlay.polygonOffsetFactor=-1;inlay.polygonOffsetUnits=-1;
  solid(room,new THREE.CylinderGeometry(.10,.10,.006,28),inlay,[.52,H+.003,-1.35]);
  // Coaster is visual only: its shallow recess is flush with the registered tabletop.
  room.children[room.children.length-1].position.y=H-.003;
  plant(room,[-1.6,0,-3.7],1.5);table(room,-1.5,-3.8,.7,.5);plant(room,[-1.5,.79,-3.8],.6);
  const sign=canvasTexture(512,512,c=>{c.fillStyle='#e4cc9f';c.fillRect(0,0,512,512);c.fillStyle='#365b60';c.textAlign='center';c.font='700 88px Inter';c.fillText('COFFEE',256,220);c.font='500 58px Inter';c.fillText('2026',256,330);});screen(room,.8,.8,sign,[-1.1,1.8,-4.88]);
  this.person.root.position.set(.34,0,-.73);this.person.root.rotation.y=Math.PI;
  // Seated POV view model: keep the complete grounded rig for support/IK, render its connected arms.
  this.person.root.traverse(o=>{if(o instanceof THREE.Mesh)o.visible=false;});
  for(const hand of [this.person.handL,this.person.handR])hand.parent!.parent!.traverse(o=>{if(o instanceof THREE.Mesh)o.visible=true;});
  this.friend.root.position.set(.10,0,-2.10);this.friend.root.rotation.y=0;this.expressions=face(this.friend);this.scene.add(this.person.root,this.friend.root);
  this.finger=solid(this.friend.handR,new THREE.CapsuleGeometry(.008,.055,4,8),surface(0xb98563),[0,-.055,0]);
  this.phone=new Phone(this.phoneRT.texture);this.scene.add(this.phone.group);
  this.tapFinger=solid(this.person.handR,new THREE.CylinderGeometry(.007,.008,1,10),surface(0xc9997c));this.tapTip=solid(this.person.handR,new THREE.SphereGeometry(.007,10,8),surface(0xc9997c));
  const key=new THREE.DirectionalLight(0xffd6a8,2.2);key.position.set(2.3,3,-2.5);key.target.position.set(0,.9,-1.3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:12});key.shadow.bias=-.0004;key.shadow.normalBias=.012;
  const fill=new THREE.HemisphereLight(0xa9cbd0,0x71543b,2.0);this.scene.add(key,key.target,fill);
  tableLamp(room,[-1.5,.79,-3.8],0xffbf86,3);
  const rim=new THREE.PointLight(0xf5ba75,2.0,5,2);rim.position.set(-1,2,-3.5);this.scene.add(rim);
 }
 update(t:number,_shot:ShotInfo){
  this.elapsed=outageSeconds(t);this.setCup(t);this.setPhone(t);
  const lean=.26+.34*ramp(t,18.5,T.grip)*(1-ramp(t,28.5,29.5));
  applyGroundedPose(this.person,{...seatedPose(this.person,SEAT),lean,headYaw:.1*ramp(t,25.5,29),armL:[-.6,.15,.6],armR:[-.6,.15,.6]});
  const laugh=pulse(t,T.laugh0,T.laugh0+.25,T.laugh1-.25,T.laugh1),bob=laugh*Math.sin((t-T.laugh0)*Math.PI*1.5);
  applyGroundedPose(this.friend,{...seatedPose(this.friend,SEAT),lean:.12+.045*bob,headYaw:.18,headPitch:.03+.09*bob,shrug:.35*bob,armL:[-.55,.1,.70],armR:[-.55,.1,.70]});
  const point=pulse(t,T.point0,T.point0+.5,T.point1,T.point1+.8);
  this.friend.reachArm('L',V(.32,.85,-1.74),V(0,-1,0),1);this.friend.reachArm('R',V(-.12,.85,-1.74).lerp(V(.22,.96,-1.72),point),V(0,-1,0),1);this.finger.visible=point>.25;
  const warningAxis=this.friend.handR.worldToLocal(this.cup.position.clone().add(V(0,.05,0))).normalize();
  this.finger.position.copy(warningAxis).multiplyScalar(.055);this.finger.quaternion.setFromUnitVectors(V(0,1,0),warningAxis);
  this.expressions.open.visible=this.expressions.teeth.visible=laugh>.15;this.expressions.smile.visible=!this.expressions.open.visible;
  for(const eye of this.expressions.eyes)eye.scale.y=1-.7*laugh;
  this.phone.group.updateMatrixWorld(true);this.cup.updateMatrixWorld(true);
  const tapLocal=t<2?V(0,-.051,.007):t<(T.cameraOn+T.smsOn)/2?V(-.020,-.041,.007):t<11?V(.026,-.068,.007):t<17?V(0,.024,.007):V(0,-.051,.007);
  this.phoneGrip.copy(this.phone.group.localToWorld(V(-.052,-.02,-.045)));this.phoneTap.copy(this.phone.group.localToWorld(tapLocal));
  this.gripTarget.copy(this.cup.localToWorld(V(.085,.06,0)));
  const release=ramp(t,T.phoneDown1,T.phoneRelease);
  this.leftTarget.copy(this.phoneGrip).lerp(V(.16,.73,-.85),release);this.leftTarget.y+=.15*Math.sin(Math.PI*release);this.person.reachArm('L',this.leftTarget,V(-1,0,0),1);
  const tapping=Math.max(pulse(t,.1,.6,.95,1.4),pulse(t,T.cameraOn-.35,T.cameraOn-.05,T.cameraOn,T.cameraOn+.15),pulse(t,T.smsOn-.35,T.smsOn-.05,T.smsOn,T.smsOn+.30),pulse(t,T.retry0-.35,T.retry0,T.retry1,T.retry1+.35));this.tapWeight=tapping;
  this.grabWeight=ramp(t,T.reach0,T.grip)*(1-ramp(t,T.release0,T.release1));
  const offset=V(.075,-.045,.020).applyQuaternion(this.phone.group.quaternion),wrist=this.phoneTap.clone().add(offset),hover=pulse(t,38.5,39.2,40,40.6);
  this.rightTarget.copy(V(.64,.73,-.88)).lerp(wrist,tapping).lerp(this.phoneTap.clone().addScaledVector(offset.clone().normalize(),.14),hover).lerp(this.gripTarget,this.grabWeight);
  const approach=ramp(t,T.reach0,T.grip),withdraw=ramp(t,T.release0,T.release1);
  this.rightTarget.y+=.18*Math.sin(Math.PI*approach)*(1-withdraw)+.15*Math.sin(Math.PI*withdraw);this.person.reachArm('R',this.rightTarget,V(1,-.2,0),1);
  this.tapFinger.visible=this.tapTip.visible=tapping>.2||hover>.2;
  const endpoint=this.person.handR.worldToLocal(this.phoneTap.clone()),length=Math.min(.09,endpoint.length()),axis=endpoint.clone().normalize();
  this.tapFinger.position.copy(axis).multiplyScalar((length+.025)/2);this.tapFinger.scale.y=Math.max(.001,length-.025);this.tapFinger.quaternion.setFromUnitVectors(V(0,1,0),axis);this.tapTip.position.copy(axis).multiplyScalar(length);
  this.tapTip.updateMatrixWorld();this.tapError=this.tapTip.getWorldPosition(V(0,0,0)).distanceTo(this.phoneTap);
  this.mode=t<T.outageOn?'draft':t<T.cameraOn?'empty':t<T.smsOn?'camera':t<11.5?'sms':t<T.restored?'empty':'restored';this.phone.setMode(this.mode);
  if(this.mode==='camera')this.renderPhoneCamera();
 }
 setCup(t:number){
  const q=unit(outageSeconds(t)/outageSeconds(T.edge)),x=.47+(.8-R-.47)*(1.15*q-.15*q*q);
  this.cupAngle=A*ramp(t,T.edge,T.catch)*(1-ramp(t,T.catch,T.cupDown));
  this.cup.rotation.set(0,0,-this.cupAngle);
  if(t<T.edge)this.cup.position.set(x,H,-1.35);
  else if(t<=T.catch)this.cup.position.set(.8-R*Math.cos(this.cupAngle),H+R*Math.sin(this.cupAngle),-1.35);
  else{const u=ramp(t,T.catch,T.cupDown);this.cup.position.set(THREE.MathUtils.lerp(.8-R*Math.cos(A),.52,u),H+(1-u)*R*Math.sin(A)+.06*Math.sin(Math.PI*u),-1.35);}
  // A partly filled, level liquid patch remains below the low rim through the illustrated tilt.
  (this.cup.children[1] as THREE.Mesh).rotation.z=this.cupAngle;
 }
 setPhone(t:number){
  const u=ramp(t,T.phoneDown0,T.phoneDown1),x=THREE.MathUtils.lerp(.11,.12,u),z=THREE.MathUtils.lerp(-1.05,-1.19,u),pitch=THREE.MathUtils.lerp(-.4,Math.PI/2,u),yaw=-.6*(1-u);
  this.phone.group.rotation.set(pitch,yaw,0,'YXZ');
  const low=this.phone.minY(this.phone.group.quaternion),initialLow=this.phone.minY(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.4,-.6,0,'YXZ'))),lift=1.05-H+initialLow;
  this.phone.group.position.set(x,H-low+lift*(1-u),z);this.phoneSupported=t>=T.phoneDown1;
 }
 renderPhoneCamera(){
  this.scene.updateMatrixWorld(true);const eye=this.phone.group.localToWorld(V(0,0,-.016)),dir=V(0,0,-1).transformDirection(this.phone.group.matrixWorld);this.phoneCamera.position.copy(eye);this.phoneCamera.up.copy(V(0,1,0).transformDirection(this.phone.group.matrixWorld));this.phoneCamera.lookAt(eye.clone().add(dir));this.phoneCamera.updateMatrixWorld();
  const rt=this.renderer.getRenderTarget(),vp=this.renderer.getViewport(new THREE.Vector4()),sc=this.renderer.getScissor(new THREE.Vector4()),st=this.renderer.getScissorTest();const g=this.phone.glass.visible,p=this.phone.preview.visible;
  try{this.phone.glass.visible=this.phone.preview.visible=false;this.renderer.setRenderTarget(this.phoneRT);this.renderer.setViewport(0,0,384,512);this.renderer.setScissorTest(false);this.renderer.clear();this.renderer.render(this.scene,this.phoneCamera);}
  finally{this.phone.glass.visible=g;this.phone.preview.visible=p;this.renderer.setRenderTarget(rt);this.renderer.setViewport(vp);this.renderer.setScissor(sc);this.renderer.setScissorTest(st);}
 }
}
