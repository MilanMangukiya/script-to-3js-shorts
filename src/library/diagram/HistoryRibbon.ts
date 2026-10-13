import * as THREE from 'three';
export interface RibbonOptions{width?:number;height?:number;maxValue?:number;color?:THREE.ColorRepresentation}
/** Data-driven extruded time-series ribbon, usable with any annual series. */
export class HistoryRibbon {
 readonly group=new THREE.Group(); readonly dot:THREE.Mesh;private pts:THREE.Vector3[];
 constructor(data:{year:number,value:number}[],o:RibbonOptions={}){const w=o.width??3,h=o.height??1.6,max=o.maxValue??10;
  this.pts=data.map((d,i)=>new THREE.Vector3((i/(data.length-1)-.5)*w,d.value/max*h,0));
  const curve=new THREE.CatmullRomCurve3(this.pts);this.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(80,data.length*3),.012,6,false),new THREE.MeshBasicMaterial({color:o.color??0xe8d6a7})));
  const positions:number[]=[];for(let i=0;i<this.pts.length-1;i++){const a=this.pts[i],b=this.pts[i+1];positions.push(a.x,0,-.015,a.x,a.y,-.015,b.x,b.y,-.015,a.x,0,-.015,b.x,b.y,-.015,b.x,0,-.015);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();this.group.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x50777a,transparent:true,opacity:.20,side:THREE.DoubleSide,depthWrite:false})));
  for(let v=0;v<=max;v+=2){this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-w/2,v/max*h,-.025),new THREE.Vector3(w/2,v/max*h,-.025)]),new THREE.LineBasicMaterial({color:0x8ca3aa,transparent:true,opacity:.2})));}
  this.dot=new THREE.Mesh(new THREE.SphereGeometry(.035,16,12),new THREE.MeshBasicMaterial({color:0xffc878}));this.group.add(this.dot);
 }
 update(fraction:number){const q=Math.max(0,Math.min(1,fraction))*(this.pts.length-1),i=Math.min(this.pts.length-2,Math.floor(q));this.dot.position.copy(this.pts[i]).lerp(this.pts[i+1],q-i);}
}
