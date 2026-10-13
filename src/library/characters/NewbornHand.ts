import * as THREE from 'three';
export interface HandOptions{skinColor?:THREE.ColorRepresentation;scale?:number;roughness?:number}
/** Metre-scale newborn palm with five articulated digits, soft skin, nails and subtle joint creases. */
export class NewbornHand{
 readonly group=new THREE.Group();private fingers:THREE.Group[][]=[];
 constructor(o:HandOptions={}){const skin=new THREE.MeshPhysicalMaterial({color:o.skinColor??0xbc826a,roughness:o.roughness??.65,clearcoat:.08,sheen:.45,sheenColor:0xeead98});
  const sphere=(at:number[],size:number[],material:THREE.Material=skin)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),material);m.position.set(...at as [number,number,number]);m.scale.set(...size as [number,number,number]);return m;};
  this.group.add(sphere([0,0,0],[.022,.009,.024]),sphere([0,-.001,-.03],[.013,.008,.024]));
  for(let i=0;i<5;i++){const thumb=i===0,base=new THREE.Group();base.position.set(thumb?-.024:(i-2.5)*.011,0,thumb?-.005:.015);base.rotation.y=thumb?-.85:(i-2.5)*-.035;this.group.add(base);const joints:THREE.Group[]=[];let parent=base;
   for(let j=0;j<3;j++){const g=new THREE.Group(),len=(thumb?.008:.010)*(1-j*.14)*(i===4?.8:1),radius=(thumb?.005:.0046)*(1-j*.08);if(j>0)g.position.z=(thumb?.008:.010)*(1-(j-1)*.14)*(i===4?.8:1);parent.add(g);g.add(sphere([0,0,len*.5],[radius,radius*.88,len*.67]));
    if(j===2){const nail=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),new THREE.MeshPhysicalMaterial({color:0xe0b4a4,roughness:.38,clearcoat:.25}));nail.scale.set(radius*.65,.00035,len*.35);nail.position.set(0,radius*.81,len*.54);g.add(nail);}else{const curve=new THREE.EllipseCurve(0,0,radius*.72,.00055,0,Math.PI,false,0),pts=curve.getPoints(16).map(p=>new THREE.Vector3(p.x,radius*.86,p.y+len*.86));g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x976551,transparent:true,opacity:.22})));}
    joints.push(g);parent=g;
   }this.fingers.push(joints);
  }this.group.scale.setScalar(o.scale??1);
 }
 update(t:number,grasp:number){this.fingers.forEach((joints,i)=>joints.forEach((j,k)=>{j.rotation.x=(i===0?-.38:.08)+grasp*(k===0?.65:.75)+.015*Math.sin(t*1.4+i+k);}));}
}
