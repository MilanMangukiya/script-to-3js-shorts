import * as THREE from 'three';
export interface PyramidOptions { maxAge?:number; step?:number; millionsPerUnit?:number; color?:THREE.ColorRepresentation; depth?:number }
/** Annual population bars. Caller supplies counts in millions; no demographic assumptions are embedded. */
export class PopulationPyramid {
  readonly group=new THREE.Group();private bars:THREE.Mesh[][]=[[],[]];private step:number;private unit:number;
  constructor(o:PyramidOptions={}){this.step=o.step??.028;this.unit=o.millionsPerUnit??100;
    const mat=new THREE.MeshStandardMaterial({color:o.color??0xdbd5bc,roughness:.32,metalness:.25});
    for(let sex=0;sex<2;sex++)for(let age=0;age<=(o.maxAge??100);age++){const b=new THREE.Mesh(new THREE.BoxGeometry(1,this.step*.72,o.depth??.16),mat);b.position.y=age*this.step;this.bars[sex].push(b);this.group.add(b);}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.05,.1),new THREE.Vector3(0,(o.maxAge??100)*this.step+.08,.1)]),new THREE.LineBasicMaterial({color:0x71868a}));this.group.add(line);
  }
  update(male:number[],female:number[]){for(let sex=0;sex<2;sex++)this.bars[sex].forEach((b,age)=>{const w=Math.max(0,(sex===0?male:female)[age]??0)/this.unit;b.visible=w>.00005;b.scale.x=Math.max(.00001,w);b.position.x=(sex===0?-1:1)*(w*.5+.008);});}
}
