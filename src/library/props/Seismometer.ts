import * as THREE from 'three';
import {box,solid,rod,surface,glow} from '../util/Modeling';
export interface SeismometerOptions{radius?:number;color?:THREE.ColorRepresentation;traceWidth?:number}
/** Original generic broadband sensor and schematic live trace. Trace is synthetic, never measured data. */
export class Seismometer{
 readonly group=new THREE.Group();private line:THREE.Line;private positions:Float32Array;private width:number;
 constructor(o:SeismometerOptions={}){this.width=o.traceWidth??1.05;const r=o.radius??.13,metal=surface(o.color??0xb4afa1,.33,.7);
  solid(this.group,new THREE.CylinderGeometry(r,r,.22,48),metal,[0,.11,0]);solid(this.group,new THREE.CylinderGeometry(r*.93,r*.93,.028,48),surface(0x23312e,.5),[0,.234,0]);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;box(this.group,[.045,.025,.07],metal,[Math.cos(a)*r,.015,Math.sin(a)*r]);solid(this.group,new THREE.SphereGeometry(.004,8,6),glow(0x67e3a4,.6),[.022+i*.018,.25,.035]);}
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(r,.07,0),new THREE.Vector3(.3,.015,.08),new THREE.Vector3(.39,.01,-.13),new THREE.Vector3(.52,.05,-.14)]);solid(this.group,new THREE.TubeGeometry(path,40,.007,6,false),surface(0x171d1f));
  box(this.group,[this.width+.09,.4,.05],surface(0x1e2a31,.4),[.1,.4,-.30]);
  this.positions=new Float32Array(512*3);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x7bd5c4}));this.group.add(this.line);
 }
 update(t:number,amplitude=1){for(let i=0;i<512;i++){const x=i/511,q=x*31+t*2;this.positions[i*3]=.1+(x-.5)*this.width;this.positions[i*3+1]=.4+amplitude*.065*(Math.sin(q*3.7)*.5+Math.sin(q*8.21)*.3+Math.sin(q*17.3)*.2);this.positions[i*3+2]=-.269;}(this.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate=true;}
}
