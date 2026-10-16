import * as THREE from 'three';
import { surface,rod } from '../util/Modeling';
export interface SwimmingPoolFieldOptions {columns?:number;rows?:number;width?:number;length?:number;depth?:number;gap?:number;waterColor?:THREE.ColorRepresentation;}
/** Physical metre-scale basins. All cavities share an absolute fill fraction; no per-frame accumulation. */
export class SwimmingPoolField extends THREE.Group {
 readonly count:number;readonly capacityLiters:number;readonly width:number;readonly length:number;readonly depth:number;readonly columns:number;readonly rows:number;readonly pitchX:number;readonly pitchZ:number;
 water:THREE.InstancedMesh;lanes:THREE.InstancedMesh;private instanceDummy=new THREE.Object3D();
 constructor(o:SwimmingPoolFieldOptions={}){
  super();this.columns=o.columns??40;this.rows=o.rows??83;this.width=o.width??25;this.length=o.length??50;this.depth=o.depth??2;this.pitchX=this.width+(o.gap??7);this.pitchZ=this.length+(o.gap??7)+1;this.count=this.columns*this.rows;this.capacityLiters=this.width*this.length*this.depth*1000;
  const concrete=surface(0xccd7d3,.9),liner=surface(0x94c3c4,.6),water=surface(o.waterColor??0x299cb2,.22,.12),dark=surface(0x315f72,.6),geo=new THREE.BoxGeometry(1,1,1),d=this.instanceDummy;
  const fixed=(sx:number,sy:number,sz:number,dx:number,yy:number,dz:number,mat:THREE.Material)=>{const m=new THREE.InstancedMesh(geo,mat,this.count);for(let i=0;i<this.count;i++){const p=this.center(i);d.position.set(p.x+dx,yy,p.z+dz);d.scale.set(sx,sy,sz);d.updateMatrix();m.setMatrixAt(i,d.matrix);}m.receiveShadow=true;this.add(m);};
  fixed(this.width,.12,this.length,0,-this.depth-.06,0,liner);
  const side=(this.pitchX-this.width)/2,end=(this.pitchZ-this.length)/2;
  for(const sign of [-1,1]){fixed(side,this.depth+.2,this.length,sign*(this.width/2+side/2),-this.depth/2,0,concrete);fixed(this.pitchX,this.depth+.2,end,0,-this.depth/2,sign*(this.length/2+end/2),concrete);}
  this.water=new THREE.InstancedMesh(geo,water,this.count);this.water.receiveShadow=true;this.add(this.water);this.lanes=new THREE.InstancedMesh(geo,dark,this.count*5);this.add(this.lanes);this.setFill(0);
  // A ladder at the nearest basin gives the close view familiar human scale.
  const p=this.center(0),metal=surface(0xbac7c9,.3,.7);for(const x of [-.35,.35]){rod(this,[p.x+x,.8,p.z+this.length/2+.25],[p.x+x,-1.5,p.z+this.length/2-.18],.035,metal);}for(const y of [-.3,-.7,-1.1])rod(this,[p.x-.35,y,p.z+this.length/2-.18],[p.x+.35,y,p.z+this.length/2-.18],.025,metal);
 }
 center(i:number){return new THREE.Vector3((i%this.columns-(this.columns-1)/2)*this.pitchX,0,(Math.floor(i/this.columns)-(this.rows-1)/2)*this.pitchZ);}
 setFill(fraction:number){const f=Math.max(0,Math.min(1,fraction)),d=this.instanceDummy;this.water.visible=this.lanes.visible=f>.0001;for(let i=0;i<this.count;i++){const p=this.center(i);d.position.set(p.x,-this.depth+this.depth*f/2,p.z);d.scale.set(this.width,this.depth*f,this.length);d.updateMatrix();this.water.setMatrixAt(i,d.matrix);for(let j=0;j<5;j++){d.position.set(p.x+(j-2)*this.width/6,-this.depth+this.depth*f+.008,p.z);d.scale.set(.06,.014,this.length-.5);d.updateMatrix();this.lanes.setMatrixAt(i*5+j,d.matrix);}}this.water.instanceMatrix.needsUpdate=this.lanes.instanceMatrix.needsUpdate=true;}
}
