import * as THREE from 'three';
import { rng } from '../util/math';

export interface BroadleafTreeOptions {height?:number;canopyWidth?:number;leafCount?:number;seed?:number;leafColor?:THREE.ColorRepresentation;trunkColor?:THREE.ColorRepresentation;leafFraction?:number;}
/** Seeded deciduous street tree in metres. Instanced individual leaves, branching trunk, editable season. */
export class BroadleafTree extends THREE.Group {
  readonly leaves:THREE.InstancedMesh;private maxLeaves:number;
  constructor(o:BroadleafTreeOptions={}){
    super();const h=o.height??6.6,w=o.canopyWidth??4.2,r=rng(o.seed??93);
    const bark=new THREE.MeshStandardMaterial({color:o.trunkColor??0x75664f,roughness:.95});
    const branch=(a:THREE.Vector3,b:THREE.Vector3,r0:number,r1:number)=>{const delta=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,delta.length(),9),bark);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());m.castShadow=true;this.add(m);};
    branch(new THREE.Vector3(),new THREE.Vector3(.06*h,.68*h,.01*h),.025*h,.009*h);
    const tips:THREE.Vector3[]=[];
    for(let i=0;i<9;i++){
      const a=i*2.399,base=new THREE.Vector3(.03*h,.41*h+i*.025*h,0),tip=new THREE.Vector3(Math.cos(a)*w*.37,.75*h+r()*h*.16,Math.sin(a)*w*.37);
      branch(base,tip,.010*h,.003*h);tips.push(tip);
      for(let j=0;j<4;j++){const along=.42+j*.15,pa=base.clone().lerp(tip,along),ba=a+(j%2?1:-1)*.65,pb=pa.clone().add(new THREE.Vector3(Math.cos(ba)*w*.19,h*(.065+r()*.07),Math.sin(ba)*w*.19));branch(pa,pb,.0035*h,.0012*h);tips.push(pb);}
    }
    const leafShape=new THREE.Shape();leafShape.moveTo(0,-.5);leafShape.quadraticCurveTo(-.38,-.12,0,.5);leafShape.quadraticCurveTo(.38,-.12,0,-.5);
    const geo=new THREE.ShapeGeometry(leafShape,3);const n=this.maxLeaves=o.leafCount??2600;
    const material=new THREE.MeshStandardMaterial({color:o.leafColor??0x728c43,roughness:.85,side:THREE.DoubleSide});
    this.leaves=new THREE.InstancedMesh(geo,material,n);const d=new THREE.Object3D(),baseColor=new THREE.Color(0xffffff);
    for(let i=0;i<n;i++){
      const anchor=tips[Math.floor(r()*tips.length)],a=r()*Math.PI*2,b=Math.acos(2*r()-1),rad=Math.pow(r(),.5);
      d.position.copy(anchor).add(new THREE.Vector3(Math.cos(a)*Math.sin(b)*rad*w*.20,Math.cos(b)*rad*h*.115,Math.sin(a)*Math.sin(b)*rad*w*.20));
      d.rotation.set(r()*Math.PI,r()*Math.PI,r()*Math.PI*2);const len=h*(.025+r()*.023);d.scale.set(len*.8,len,len);d.updateMatrix();this.leaves.setMatrixAt(i,d.matrix);
      baseColor.setHSL(.20+r()*.035,.04+r()*.13,.52+r()*.43);this.leaves.setColorAt(i,baseColor);
    }
    this.leaves.castShadow=true;this.add(this.leaves);this.leafFraction=o.leafFraction??1;
  }
  set leafFraction(v:number){this.leaves.count=Math.round(this.maxLeaves*THREE.MathUtils.clamp(v,0,1));}
}
