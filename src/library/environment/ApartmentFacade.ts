import * as THREE from 'three';
import { RoomBox,tableLamp,plant } from './RoomBox';
import { surface,solid,box,canvasTexture,rod } from '../util/Modeling';
import { rng } from '../util/math';

export interface ApartmentFacadeOptions {seed?:number;floors?:number;columns?:number;floorHeight?:number;windowSize?:[number,number];occupancy?:number;warmth?:THREE.ColorRepresentation;}
/** Actual open room boxes behind real window openings; tableaux can be placed in public rooms. */
export class ApartmentFacade extends THREE.Group {
  readonly rooms:{room:RoomBox;floor:number;column:number;lamp:THREE.PointLight}[]=[];
  constructor(o:ApartmentFacadeOptions={}){super();const floors=o.floors??5,cols=o.columns??5,fh=o.floorHeight??3,r=rng(o.seed??65),w=cols*3.2;
    const tex=canvasTexture(512,512,c=>{c.fillStyle='#453a37';c.fillRect(0,0,512,512);for(let y=0;y<512;y+=32)for(let x=-32;x<512;x+=64){const xx=x+(y/32%2)*32;c.fillStyle=`rgb(${95+Math.floor(r()*27)},${64+Math.floor(r()*16)},${52+Math.floor(r()*17)})`;c.fillRect(xx+2,y+2,60,28);}});tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2,2);
    const brick=new THREE.MeshStandardMaterial({map:tex,color:0xc4b09b,roughness:.95}),stone=surface(0xaaa79b,.85),frame=surface(0xbbb6a1,.7),dark=surface(0x2b343e,.9);
    box(this,[w+1.1,3.6,.75],brick,[0,1.8,-.4]);for(let i=0;i<cols;i++)box(this,[2.3,2.5,.1],dark,[(i-(cols-1)/2)*3.2,1.35,.03]);
    for(let f=0;f<floors;f++){const base=4.2+f*fh;box(this,[w+.5,.8,.8],brick,[0,base-.4,-.3]);box(this,[w+.65,.14,.95],stone,[0,base-.79,-.2]);
      for(let j=0;j<cols;j++){const x=(j-(cols-1)/2)*3.2;box(this,[1.1,2.2,.75],brick,[x+1.55,base+1.1,-.3]);
        const room=new RoomBox({width:3.08,height:2.7,depth:3.2,wallColor:[0xb29b7c,0x9d9480,0xb5a18f][(f+j)%3]});room.position.set(x,base,0);this.add(room);
        // A luminous practical in the rear leaves the foreground silhouettes readable.
        const lit=Math.abs(j-2)<=1&&f<=2||r()<(o.occupancy??.3);const lam=tableLamp(room,[-.95,.5,-2.5],o.warmth??0xffbd7e,lit?5:0);box(room,[.45,.5,.4],surface(0x564637,.8),[-.95,.25,-2.5]);
        for(const xx of [-1.02,1.02])box(room,[.065,2.1,.09],frame,[xx,1.08,.08]);for(const y of [.045,2.1])box(room,[2.12,.08,.12],frame,[0,y,.08]);box(room,[.045,2.08,.07],frame,[0,1.1,.09]);box(room,[2.3,.13,.4],stone,[0,0,.2]);
        // Curtains fold as a real mesh and stay at the edges of the view into the room.
        const curtainMat=new THREE.MeshStandardMaterial({color:0xd1c7b3,roughness:1,transparent:true,opacity:.58,side:THREE.DoubleSide});for(const side of [-1,1]){const geo=new THREE.PlaneGeometry(.38,2.05,12,1),p=geo.attributes.position;for(let k=0;k<p.count;k++)p.setZ(k,Math.sin(p.getX(k)*70)*.035);geo.computeVertexNormals();solid(room,geo,curtainMat,[side*.86,1.05,.02]);}
        const glass=new THREE.MeshPhysicalMaterial({color:0xa5b6c7,transparent:true,opacity:.035,roughness:.25,metalness:.2,depthWrite:false});solid(room,new THREE.PlaneGeometry(2.05,2.08),glass,[0,1.08,.12]);
        if(j===0&&f%2===0){box(this,[2.5,.15,1],stone,[x,base-.1,.6]);for(const xx of [-1.1,0,1.1])rod(this,[x+xx,base,.95],[x+xx,base+1,.95],.03,dark);rod(this,[x-1.1,base+1,.95],[x+1.1,base+1,.95],.03,dark);plant(this,[x+.7,base,.7],.65);}
        this.rooms.push({room,floor:f,column:j,lamp:lam.light});
      }
    }
    box(this,[w+.7,.6,1.2],stone,[0,4.2+floors*fh,-.25]);
  }
}
