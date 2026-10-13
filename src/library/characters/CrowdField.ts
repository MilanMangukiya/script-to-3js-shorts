import * as THREE from 'three';
import { rng } from '../util/math';
export interface CrowdFieldOptions {seed?:number;width?:number;depth?:number;spacing?:number;height?:number;density?:number;segments?:number}
/** Instanced clothed silhouettes for mid-distance and aerial views. X/Z plane, Y up, metre scale. */
export class CrowdField {
  readonly group=new THREE.Group();readonly count:number;private pieces:THREE.InstancedMesh[]=[];
  constructor(o:CrowdFieldOptions={}) {
    const r=rng(o.seed??410),w=o.width??20,d=o.depth??40,spacing=o.spacing??.75,cols=Math.floor(w/spacing),rows=Math.floor(d/spacing),n=cols*rows;
    const locations:{x:number;z:number;s:number;a:number}[]=[];
    for(let i=0;i<n;i++)if(r()<(o.density??1))locations.push({x:(i%cols-(cols-1)/2)*spacing+(r()-.5)*spacing*.1,z:(Math.floor(i/cols)-(rows-1)/2)*spacing+(r()-.5)*spacing*.1,s:(o.height??1.7)/1.7*(.91+r()*.17),a:(r()-.5)*.55});
    this.count=locations.length;
    const seg=o.segments??6;
    const parts:[THREE.BufferGeometry,number[],number[]][]=[
      [new THREE.CylinderGeometry(.18,.16,.6,seg),[0,1.13,0],[1,1,.68]],
      [new THREE.SphereGeometry(.10,seg,4),[0,1.59,0],[.95,1.15,1]],
      [new THREE.CylinderGeometry(.065,.05,.77,seg),[-.095,.43,0],[1,1,1]],
      [new THREE.CylinderGeometry(.065,.05,.77,seg),[.095,.43,0],[1,1,1]],
      [new THREE.CylinderGeometry(.055,.04,.51,seg),[-.23,1.04,0],[1,1,1]],
      [new THREE.CylinderGeometry(.055,.04,.51,seg),[.23,1.04,0],[1,1,1]]];
    const coats=[0x354b5e,0x98765a,0x748079,0x556155,0x9a856c,0x6c5963,0x35556a],skins=[0xdbb294,0x9e6d4e,0x61422e,0xb78d68];
    const dummy=new THREE.Object3D();
    parts.forEach(([geo,pos,scale],part)=>{
      const mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({roughness:.9}),this.count);
      locations.forEach((v,i)=>{dummy.position.set(v.x+pos[0]*v.s,pos[1]*v.s,v.z+pos[2]*v.s);dummy.rotation.set(0,v.a,0);dummy.scale.set(scale[0]*v.s,scale[1]*v.s,scale[2]*v.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(part===1?skins[i%skins.length]:part===2||part===3?0x28313b:coats[i%coats.length]));});
      mesh.castShadow=mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;this.group.add(mesh);this.pieces.push(mesh);
    });
  }
  update(time_s:number,jumpHeight=0){this.group.position.y=jumpHeight;}
}
