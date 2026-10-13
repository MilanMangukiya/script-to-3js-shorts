import * as THREE from 'three';
import { surface,rod,solid,box } from '../util/Modeling';
export interface WaterServiceStationOptions {tankRadius?:number;tankHeight?:number;pipeRadius?:number;color?:THREE.ColorRepresentation}
/** Generic unbranded storage tank, supports and public tap manifold, metres. */
export class WaterServiceStation {
  readonly group=new THREE.Group();private stream:THREE.Mesh;
  constructor(o:WaterServiceStationOptions={}){
    const r=o.tankRadius??.65,h=o.tankHeight??1.8,p=o.pipeRadius??.045,steel=surface(0xabb6b9,.3,.8),paint=surface(o.color??0x718b8d,.45,.25);
    solid(this.group,new THREE.CylinderGeometry(r,r,h,64),paint,[-.75,h/2+.35,-.5]);
    for(const y of [.4,.4+h*.45,.35+h])solid(this.group,new THREE.TorusGeometry(r+.012,.027,8,64).rotateX(Math.PI/2),steel,[-.75,y,-.5]);
    for(const x of [-1.15,-.35])box(this.group,[.08,.4,.75],steel,[x,.2,-.5]);
    rod(this.group,[-.1,.6,-.5],[.7,.6,-.5],p,steel);rod(this.group,[.7,.6,-.5],[.7,1.2,-.5],p,steel);rod(this.group,[.7,1.2,-.5],[.7,1.2,.1],p,steel);
    for(const x of [.4,1.0]){rod(this.group,[x,1.2,-.5],[x,1.2,.1],p*.65,steel);solid(this.group,new THREE.TorusGeometry(.09,.015,8,24),surface(0xb34c3a,.4,.5),[x,1.32,-.1]);}
    box(this.group,[1,.16,.55],surface(0x6c777b,.3,.5),[.7,.65,.1]);
    this.stream=solid(this.group,new THREE.CylinderGeometry(.012,.02,.43,8),new THREE.MeshPhysicalMaterial({color:0xb3d9e5,transparent:true,opacity:.65,roughness:.1}),[.7,.94,.1]);
  }
  set flow(value:number){this.stream.visible=value>0;this.stream.scale.x=this.stream.scale.z=Math.max(.02,value);}
}
