import * as THREE from 'three';
import {box,rod,surface,solid} from '../util/Modeling';
/** Grounded capacity comparison. The inner cube's volume equals liters/1000; no engineering-strength claim. */
export class WaterVolumeTank extends THREE.Group {
 readonly side:number;readonly water:THREE.Mesh;readonly liters:number;
 constructor(liters:number,color:THREE.ColorRepresentation=0x38a4bc){
  super();this.liters=liters;this.side=Math.cbrt(liters/1000);const s=this.side,wall=Math.max(.025,s*.008),steel=surface(0x59798a,.42,.5);
  box(this,[s+wall*4,wall,s+wall*4],surface(0x9ca7a1,.9),[0,-wall/2,0]);
  const glass=new THREE.MeshPhysicalMaterial({color:0xc5e4e7,roughness:.1,metalness:0,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false});
  for(const x of [-1,1])box(this,[.003,s,s],glass,[x*s/2,s/2,0]);for(const z of [-1,1])box(this,[s,s,.003],glass,[0,s/2,z*s/2]);
  for(const x of [-s/2,s/2])for(const z of [-s/2,s/2])rod(this,[x,0,z],[x,s,z],wall,steel);for(const y of [0,s])for(const sign of [-1,1]){rod(this,[-s/2,y,sign*s/2],[s/2,y,sign*s/2],wall,steel);rod(this,[sign*s/2,y,-s/2],[sign*s/2,y,s/2],wall,steel);}
  const m=new THREE.MeshStandardMaterial({color,roughness:.25,metalness:.08});this.water=box(this,[s,s,s],m,[0,s/2,0]);this.water.receiveShadow=true;this.setFill(0);
  for(const y of [.2,.4,.6,.8])for(const z of [-1,1])rod(this,[-s/2,s*y,z*s/2],[s/2,s*y,z*s/2],wall*.35,steel);
 }
 setFill(f:number){f=Math.max(0,Math.min(1,f));this.water.visible=f>.0001;this.water.scale.y=f;this.water.position.y=this.side*f/2;}
}
