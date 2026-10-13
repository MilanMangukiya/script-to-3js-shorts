import * as THREE from 'three';
import { rng, clamp } from '../util/math';
import { surface,glow,solid,box,rod,canvasTexture } from '../util/Modeling';

export interface PortKitOptions { seed?:number; cranes?:number; containerRows?:number; truckCount?:number; palette?:THREE.ColorRepresentation[]; lightsOn?:boolean; }
export interface PortKitState { stopAt_s?:number; stopDuration_s?:number; }
/** Analytic clock integrating a linear velocity ramp to zero. Never depends on prior frames. */
export function stoppedClock(t:number,start:number,duration:number){const u=clamp(t-start,0,duration);return t<start?t:start+u-u*u/(2*duration);}
/** Original real-scale quay, braced gantry cranes, container yard, tractors, factory and substation. */
export class PortKit extends THREE.Group {
  readonly chimneyAnchor=new THREE.Vector3(32,48,17);
  readonly cranes:{trolley:THREE.Group,spreader:THREE.Group,ropes:THREE.Mesh[]}[]=[];
  readonly trucks:THREE.Group[]=[];
  constructor(o:PortKitOptions={}){
    super();const r=rng(o.seed??2026),concrete=surface(0x727b7b,.92),asphalt=surface(0x344049,.9),steel=surface(0x627e8b,.5,.55),dark=surface(0x28323a,.68,.4),yellow=surface(0xbb9854,.6),white=surface(0xc9cbc6,.5),lamp=glow(0xffe4b5,o.lightsOn===false?0:3);
    box(this,[154,7,382],concrete,[0,-.5,-57]);box(this,[147,.1,376],asphalt,[0,3.06,-57]);
    // Quay edge, bollards, rubber fenders, service lanes and guard lines.
    box(this,[154,1.3,2.4],concrete,[0,3,-245]);for(let x=-72;x<76;x+=10){solid(this,new THREE.CylinderGeometry(.65,.75,1.2,12),dark,[x,4.1,-243]);box(this,[2.2,4,1.7],dark,[x,.9,-246.2]);}
    const stripe=surface(0xb5ae8f,.9);for(let z=-223;z<116;z+=9)for(const x of [-60,-24,20,62])box(this,[.18,.03,4],stripe,[x,3.15,z]);
    const corr=canvasTexture(128,128,c=>{c.fillStyle='#ccc';c.fillRect(0,0,128,128);for(let x=0;x<128;x+=10){c.fillStyle='#999';c.fillRect(x,0,3,128);}c.strokeStyle='#666';c.lineWidth=3;c.strokeRect(1,1,126,126);});
    const mats=(o.palette??[0xa4513f,0x446b78,0xac9471,0x3f7979]).map(c=>new THREE.MeshStandardMaterial({color:c,map:corr,roughness:.63,metalness:.22}));
    const placements:{x:number,y:number,z:number,c:number}[]=[];
    for(let row=0;row<(o.containerRows??9);row++)for(let col=0;col<8;col++){const levels=2+Math.floor(r()*3);for(let h=0;h<levels;h++)placements.push({x:-49+col*13.5,y:4.44+h*2.67,z:-199+row*14,c:Math.floor(r()*mats.length)});}
    const dummy=new THREE.Object3D();for(let k=0;k<mats.length;k++){const a=placements.filter(p=>p.c===k),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(12.2,2.59,2.44),mats[k],a.length);a.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;this.add(mesh);}
    for(let i=0;i<(o.cranes??2);i++){
      const g=new THREE.Group();g.position.set((i-(o.cranes??2)/2+.5)*60,3,-231);this.add(g);
      // Legs are splayed structural frames; diagonals keep the silhouette recognisably a ship-to-shore crane.
      for(const sx of [-1,1])for(const sz of [-1,1]){
        rod(g,[sx*13,1,sz*12],[sx*9,44,sz*7],.8,steel);
        rod(g,[sx*13,3,sz*12],[sx*9,28,-sz*7],.34,steel);
        for(const zz of [-2,2]){const wh=solid(g,new THREE.CylinderGeometry(1,1,1,12).rotateZ(Math.PI/2),dark,[sx*13,1,sz*12+zz]);}
        box(g,[3,1,9],dark,[sx*13,1.2,sz*12]);
      }
      for(const z of [-7,7]){rod(g,[-9,44,z],[9,44,z],.8,steel);rod(g,[-9,29,z],[9,29,z],.5,steel);}
      // Twin lattice rails from back reach through 65 m seaward outreach.
      for(const x of [-3.5,3.5]){rod(g,[x,44,22],[x,44,-65],.65,steel);rod(g,[x,48,22],[x,48,-65],.38,steel);for(let z=-65;z<22;z+=6){rod(g,[x,44,z],[x,48,z+6],.18,steel);rod(g,[x,48,z],[x,44,z+6],.18,steel);}}
      for(let z=-65;z<22;z+=7)rod(g,[-3.5,48,z],[3.5,48,z],.16,steel);
      rod(g,[-3.5,48,-3],[-3.5,58,2],.5,steel);rod(g,[3.5,48,-3],[3.5,58,2],.5,steel);
      for(const x of [-3.5,3.5]){rod(g,[x,58,2],[x,48,-61],.10,dark);rod(g,[x,58,2],[x,48,20],.10,dark);}
      const trolley=new THREE.Group();g.add(trolley);box(trolley,[8,1.3,5.4],yellow,[0,43,0]);
      const spreader=new THREE.Group();trolley.add(spreader);box(spreader,[12.7,.7,3.0],yellow);box(spreader,[12.2,2.59,2.44],mats[i%mats.length],[0,-1.66,0]);
      const ropes:THREE.Mesh[]=[];for(const x of [-5.6,5.6])for(const z of [-.9,.9]){const rope=solid(trolley,new THREE.CylinderGeometry(.055,.055,1,5),dark,[x,0,z]);ropes.push(rope);}
      box(g,[3.4,3.0,3.3],white,[6,40,-4]);box(g,[3.1,1.7,.05],glow(0xd8e5d8,.75),[6,40.4,-5.67]);
      for(const z of [-55,-30,0,20])box(g,[1.2,.4,1.0],lamp,[0,43.7,z]);this.cranes.push({trolley,spreader,ropes});
    }
    for(let i=0;i<(o.truckCount??5);i++){
      const tr=new THREE.Group();this.add(tr);this.trucks.push(tr);box(tr,[2.4,1.3,5.6],dark,[0,1,0]);box(tr,[2.7,2.7,2.6],white,[0,2.3,-1.2]);box(tr,[2.4,1.1,.03],surface(0x17333d,.2,.6),[0,2.8,-2.51]);box(tr,[2.6,.6,13.6],dark,[0,1,8.3]);
      for(const x of [-1.45,1.45])for(const z of [-1.5,1.5,10,12])solid(tr,new THREE.CylinderGeometry(.64,.64,.35,12).rotateZ(Math.PI/2),dark,[x,.65,z]);
      for(const x of [-.9,.9])box(tr,[.45,.3,.1],lamp,[x,1.55,-2.55]);if(i%2===0)box(tr,[2.44,2.59,12.2],mats[(i+1)%mats.length],[0,2.58,8.3]);
    }
    // Warehouse sawtooth roof, factory stacks, conveyor and substation equipment.
    const brick=surface(0x72514b,.95);box(this,[78,13,36],brick,[-15,9.5,31]);for(let x=-49;x<20;x+=13){const roof=solid(this,new THREE.CylinderGeometry(10,10,13,3,1).rotateZ(Math.PI/2),dark,[x,17,31]);roof.scale.z=1.9;}
    for(let x=-48;x<22;x+=7)box(this,[3.3,3,.12],glow(0xf1c780,.5),[x,10,49.08]);
    solid(this,new THREE.CylinderGeometry(2.5,4.5,45,24),brick,[32,25.5,17]);for(const y of [15,27,39,47])solid(this,new THREE.TorusGeometry(y===47?2.6:3.4,.2,6,32).rotateX(Math.PI/2),dark,[32,y,17]);
    const belt=box(this,[8,3,58],dark,[-46,8,-13]);belt.rotation.x=-.15;for(let z=-34;z<20;z+=9){rod(this,[-49,3,z],[-49,8,z],.25,steel);rod(this,[-43,3,z],[-43,8,z],.25,steel);}
    box(this,[39,.6,29],concrete,[37,3.5,-38]);for(const x of [26,39,52]){box(this,[6,5,6],surface(0x6b7b74,.65,.55),[x,6,-38]);for(let j=0;j<5;j++)box(this,[.18,4,6.4],dark,[x-2+j,6,-38]);for(const z of [-40,-36])solid(this,new THREE.CylinderGeometry(.26,.45,2.3,10),surface(0x9eaca2,.3),[x,9.5,z]);}
    for(const x of [-65,65])for(const z of [-218,-132,-46,45]){rod(this,[x,3,z],[x,32,z],.3,steel);box(this,[6,.45,2],dark,[x,32,z]);for(const xx of [-1.8,0,1.8])box(this,[1.3,.3,1.3],lamp,[x+xx,31.6,z]);
      const light=new THREE.PointLight(0xffdfac,450,75,2);light.position.set(x,28,z);this.add(light);}
    // Rope fencing and bollards carry scale even in the high view.
    for(let z=-212;z<130;z+=10)for(const x of [-72,72])rod(this,[x,3,z],[x,5,z],.07,steel);
    for(const x of [-72,72])for(const y of [4,5])rod(this,[x,y,-212],[x,y,130],.04,steel);
  }
  update(t:number,s:PortKitState={}){
    const stop=s.stopAt_s??1e9,d=s.stopDuration_s??.85;
    this.cranes.forEach((c,i)=>{const clock=stoppedClock(t,stop+i*.1,d),age=Math.max(0,t-stop),sw=Math.sin((t-11.9)*Math.PI/5)*.6*Math.exp(-age*1.1);c.trolley.position.z=-16+Math.sin(clock*.075+i*.8)*18;c.spreader.position.set(sw,23+Math.sin(clock*.075+i)*2,0);c.ropes.forEach((rope,j)=>{const h=43-c.spreader.position.y;rope.scale.y=h;rope.position.y=(43+c.spreader.position.y)*.5;rope.position.x=(j<2?-5.6:5.6)+sw*.5;rope.rotation.z=-sw/h;});});
    this.trucks.forEach((tr,i)=>{const clock=stoppedClock(t,stop+.25+i*.13,1.0),dist=(clock*6.2+i*34)%168;tr.position.set(i%2===0?-58:61,3.16,-211+dist);tr.rotation.y=i%2===0?Math.PI:0;});
  }
}
