import * as THREE from 'three';
import { surface,glow,solid,box,rod,canvasTexture,screen } from '../util/Modeling';
import { tableLamp,plant } from './RoomBox';

export interface ClinicInteriorOptions {corridorLength?:number;rooms?:number;lightingMix?:number;seed?:number;}
/** Calm original ward geometry; public bed and IV anchors accept story-specific figures and poses. */
export class ClinicInterior extends THREE.Group {
  readonly beds:THREE.Group[]=[];readonly ivPoles:THREE.Group[]=[];readonly cart=new THREE.Group();
  private monitorTextures:THREE.CanvasTexture[]=[];
  constructor(o:ClinicInteriorOptions={}){super();const len=o.corridorLength??23,wall=surface(0xb2bcb7,.83),floor=surface(0x788b91,.24,.07),teal=surface(0x466c70,.7),chrome=surface(0x9facb0,.28,.72),ivory=surface(0xd0d0c2,.75),dark=surface(0x1f333b,.5);
    box(this,[12,.16,len],floor,[0,-.1,-len/2+9]);box(this,[12,.12,len],wall,[0,2.9,-len/2+9]);box(this,[.12,2.9,5.3],wall,[-1.6,1.45,6.35]);box(this,[.12,2.9,13.5],wall,[-1.6,1.45,-7.25]);box(this,[.12,.65,4.2],wall,[-1.6,2.6,1.6]);
    // The station opens through the left wall; its low counter catches the desk practical.
    box(this,[2.4,.95,3.3],teal,[-2.2,.48,1.2]);box(this,[2.6,.07,3.5],ivory,[-2.2,.98,1.2]);box(this,[.12,1.45,5],wall,[-1.6,.7,1.2]);
    for(const z of [6,0,-6,-12]){box(this,[1.65,.05,1.1],glow(0xddecec,.9),[0,2.82,z]);const l=new THREE.PointLight(0xc5dce2,6,8,2);l.position.set(0,2.6,z);this.add(l);}
    for(const x of [-1.52,1.52])for(const y of [.88,1.08])rod(this,[x,y,8],[x,y,-14],.03,chrome);
    for(let z=8;z>-14;z-=2)box(this,[3,.008,.016],surface(0x99a8aa,.3),[0,.001,z]);
    for(let i=0;i<(o.rooms??3);i++){const z=3-i*5.4;box(this,[.12,2.9,3.2],wall,[1.6,1.45,z-1.3]);box(this,[.12,.55,2.2],wall,[1.6,2.63,z+1.4]);
      box(this,[4.9,2.9,.12],wall,[4.1,1.45,z-2.9]);box(this,[.1,2.9,5.4],wall,[6.5,1.45,z-.4]);box(this,[4.9,.11,5.3],floor,[4.1,0,z-.4]);
      const trim=surface(0x859b9a,.6);for(const zz of [z+.35,z+2.45])box(this,[.2,2.4,.1],trim,[1.56,1.2,zz]);
      const door=new THREE.Group();door.position.set(1.67,0,z+.4);door.rotation.y=.85;this.add(door);box(door,[.07,2.35,1.08],surface(0x6d847d,.65),[0,1.18,.54]);box(door,[.075,.48,.65],surface(0x587078,.25,.4),[0,1.72,.54]);rod(door,[-.055,1.02,.84],[-.055,1.02,.96],.018,chrome);
      const bed=new THREE.Group();bed.position.set(3.5,.05,z+.2);bed.rotation.y=-Math.PI/2;this.add(bed);this.beds.push(bed);
      box(bed,[1.04,.18,2.15],chrome,[0,.55,0]);box(bed,[.98,.23,2.07],ivory,[0,.74,0]);box(bed,[.99,.12,1.46],surface(0xb3c1b6,.86),[0,.91,.27]);box(bed,[.75,.15,.42],surface(0xe6e2d5,.8),[0,.96,-.71]);
      for(const zz of [-1.06,1.06])box(bed,[1.05,.55,.08],ivory,[0,.79,zz]);for(const x of [-.57,.57])for(const y of [.78,1.05])rod(bed,[x,y,-.55],[x,y,.72],.024,chrome);
      for(const x of [-.4,.4])for(const zz of [-.85,.85]){rod(bed,[x,.16,zz],[x,.52,zz],.03,chrome);solid(bed,new THREE.CylinderGeometry(.09,.09,.055,10).rotateZ(Math.PI/2),dark,[x,.12,zz]);}
      const pole=new THREE.Group();pole.position.set(2.4,0,z-1);this.add(pole);this.ivPoles.push(pole);rod(pole,[0,.12,0],[0,2.12,0],.02,chrome);rod(pole,[-.18,2.12,0],[.18,2.12,0],.015,chrome);for(let j=0;j<5;j++){const a=j*1.256;rod(pole,[0,.16,0],[Math.cos(a)*.3,.06,Math.sin(a)*.3],.018,chrome);}box(pole,[.12,.24,.045],new THREE.MeshPhysicalMaterial({color:0xcde3db,transparent:true,opacity:.6,roughness:.1}),[.13,1.9,0]);rod(pole,[.13,1.78,0],[.06,.85,.1],.005,ivory);
      const mon=canvasTexture(384,256,c=>this.drawMonitor(c,0));this.monitorTextures.push(mon);screen(this,.52,.35,mon,[2.25,1.65,z-2.8]);
      const lamp=new THREE.PointLight(0x9ddbcf,1.6,5,2);lamp.position.set(3.5,1.9,z-.1);this.add(lamp);
    }
    tableLamp(this,[-2,1.05,2.1],0xffbc7e,3);plant(this,[-2.8,1.05,1.2],.7);
    screen(this,.52,.35,canvasTexture(256,192,c=>{c.fillStyle='#1c353d';c.fillRect(0,0,256,192);c.fillStyle='#b2c8c4';for(let i=0;i<8;i++)c.fillRect(20,22+i*19,180-i*8,4);}),[-2.3,1.3,.2]);
    const exit=canvasTexture(256,128,c=>{c.fillStyle='#154932';c.fillRect(0,0,256,128);c.fillStyle='#d5e8db';c.font='bold 58px sans-serif';c.fillText('EXIT',42,83);});screen(this,.8,.36,exit,[0,2.4,-14]);
    box(this,[3.2,2.9,.12],wall,[0,1.45,-14.2]);
    this.add(this.cart);for(const y of [.25,.85])box(this.cart,[.62,.06,.83],chrome,[0,y,0]);for(const x of [-.26,.26])for(const z of [-.36,.36]){rod(this.cart,[x,.12,z],[x,1.12,z],.02,chrome);solid(this.cart,new THREE.CylinderGeometry(.065,.065,.04,10).rotateZ(Math.PI/2),dark,[x,.075,z]);}for(let i=0;i<3;i++)box(this.cart,[.28,.12,.24],ivory,[.1,.95+i*.12,0]);
  }
  private drawMonitor(c:CanvasRenderingContext2D,t:number){c.fillStyle='#081d22';c.fillRect(0,0,384,256);c.strokeStyle='#6eaa91';c.lineWidth=3;for(let row=0;row<2;row++){c.beginPath();for(let x=0;x<300;x++){const p=((x/70-t*1.1)%1+1)%1;const spike=Math.exp(-Math.pow((p-.35)/.035,2))*35-Math.exp(-Math.pow((p-.41)/.045,2))*17;const y=70+row*95-spike-Math.sin(p*Math.PI*2)*3; x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}c.fillStyle='#a6d8b9';c.font='bold 32px monospace';c.fillText('72',310,73);c.fillStyle='#7dbbc5';c.fillText('98',310,169);}
  update(t:number){for(const tex of this.monitorTextures){this.drawMonitor((tex.image as HTMLCanvasElement).getContext('2d')!,t);tex.needsUpdate=true;}}
}
