import * as THREE from 'three';
import { smoothstep } from '../util/math';
export interface WaterPhotolysisOptions {count?:number;spacing?:number;scale?:number;escapeHeight?:number;}
/** Simplified H2O + UV -> OH + H diagram, followed by schematic hydrogen escape. */
export class WaterPhotolysis {
  readonly group=new THREE.Group();private molecules:{root:THREE.Group;h:THREE.Mesh;bond:THREE.Mesh;ray:THREE.Mesh;phase:number}[]=[];
  private height:number;
  constructor(o:WaterPhotolysisOptions={}){
    this.height=o.escapeHeight??3;
    const O=new THREE.MeshStandardMaterial({color:0xe74731,roughness:.26,metalness:.16}),H=new THREE.MeshStandardMaterial({color:0xd8f5ff,roughness:.22,emissive:0x467b96,emissiveIntensity:.3}),B=new THREE.MeshStandardMaterial({color:0x9aabb9,roughness:.3,metalness:.6});
    for(let i=0;i<(o.count??3);i++){
      const root=new THREE.Group(),s=o.scale??1;
      root.position.set((i-((o.count??3)-1)/2)*(o.spacing??.62),.1+Math.sin(i*2)*.12,-i*.12);root.scale.setScalar(s);
      root.add(new THREE.Mesh(new THREE.SphereGeometry(.115,32,24),O));
      const first=new THREE.Mesh(new THREE.SphereGeometry(.06,24,16),H);first.position.set(-.16,.125,0);root.add(first);
      const h=new THREE.Mesh(first.geometry,H);root.add(h);
      const makeBond=(x:number)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.024,.024,.205,12),B);m.position.set(x*.08,.0625,0);m.rotation.z=-x*.91;root.add(m);return m;};
      makeBond(-1);const bond=makeBond(1);
      const ray=new THREE.Mesh(new THREE.CylinderGeometry(.006,.014,1.25,8),new THREE.MeshBasicMaterial({color:0xc3a6ff,transparent:true,opacity:.8}));ray.position.set(-.35,.75,0);ray.rotation.z=-.6;root.add(ray);
      this.group.add(root);this.molecules.push({root,h,bond,ray,phase:i*.16});
    }
  }
  update(time_s:number,progress:number){for(const m of this.molecules){const q=smoothstep(.12+m.phase,.44+m.phase,progress);m.h.position.set(.16+.12*q,.125+this.height*q*q,0);m.bond.scale.setScalar(1-q);m.ray.visible=progress>.08+m.phase&&progress<.46+m.phase;m.root.rotation.y=Math.sin(time_s*.4+m.phase)*.18;}}
}
