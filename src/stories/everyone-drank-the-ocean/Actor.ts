import * as THREE from 'three';
import {Humanoid,POSE_STAND} from '../../library/characters/Humanoid';
import {applyGroundedPose} from '../../library/characters/CharacterMotion';
import {solid,surface} from '../../library/util/Modeling';
import {T,ramp} from './timeline';
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
function setRod(m:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3){const d=b.clone().sub(a);m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());}
export class StrawActor {
 person:Humanoid;rods:THREE.Mesh[]=[];grip=V(0,0,0);mouth=V(0,0,0);top=V(0,0,0);join=V(0,0,0);source=V(0,0,0);hero:boolean;
 constructor(public scene:THREE.Scene,at:[number,number,number],coat:number,skin:number,hero=false){
  this.hero=hero;this.person=new Humanoid({coat:'jacket',coatColor:coat,skinColor:skin,trouserColor:0x294154,scarfColor:null});this.person.root.position.set(...at);scene.add(this.person.root);
  const dark=surface(0x1d2830);for(const x of [-.033,.033])solid(this.person.head,new THREE.SphereGeometry(.006,8,6),dark,[x,.135,.104]);solid(this.person.head,new THREE.SphereGeometry(.010,10,8).scale(1,.65,.3),dark,[0,.075,.106]);
  for(let i=0;i<4;i++)this.rods.push(solid(scene,new THREE.CylinderGeometry(.009,.009,1,8),surface(0xe8c84f,.4)));
  this.join.set(at[0]+.4,.85,at[2]+.62);this.source.set(at[0]>=0?3.1:-3.1,-.62,at[2]+.93);
 }
 update(t:number){
  const quitting=ramp(t,T.quit0,T.quit1),active=ramp(t,0,.6)*(1-quitting),lean=.06+.055*active,scan=ramp(t,17.4,20.3)*(1-ramp(t,22,23));
  applyGroundedPose(this.person,{...POSE_STAND,lean,headPitch:.05+.06*active,headYaw:.12+.22*scan,armL:[.03,.12,.3],armR:[-.7,.12,.9]});
  this.mouth.copy(this.person.head.localToWorld(V(0,.075,.112)));this.top.copy(this.mouth).lerp(V(this.person.root.position.x-.1,1.16,this.person.root.position.z+.25),quitting);
  const elbow=this.top.clone().add(V(-.09,-.27,.22));this.grip.copy(this.top).lerp(elbow,.50);this.person.reachArm('R',this.grip,V(-1,0,0),1);
  const edge=this.source.clone();edge.y=.15;
  setRod(this.rods[0],this.top,elbow);setRod(this.rods[1],elbow,this.join);setRod(this.rods[2],this.join,edge);setRod(this.rods[3],edge,this.source);
  this.person.reachArm('L',V(this.person.root.position.x+.26,1.0+.16*quitting,this.person.root.position.z+.18),V(1,-.5,0),quitting);
 }
}
