import * as THREE from 'three';
import { surface,glow,solid,box,rod } from '../util/Modeling';

export interface RoomBoxOptions {width?:number;height?:number;depth?:number;wallColor?:THREE.ColorRepresentation;floorColor?:THREE.ColorRepresentation;ceiling?:boolean;}
/** Open-front architectural room. Origin is centre of the front threshold; interior extends along -Z. */
export class RoomBox extends THREE.Group {
  constructor(o:RoomBoxOptions={}){super();const w=o.width??3,h=o.height??2.7,d=o.depth??3.8,wall=surface(o.wallColor??0xb5a087,.9),wood=surface(o.floorColor??0x6f5240,.82);
    box(this,[w,.10,d],wood,[0,-.05,-d/2]);box(this,[w,h,.12],wall,[0,h/2,-d]);for(const x of [-w/2,w/2])box(this,[.12,h,d],wall,[x,h/2,-d/2]);if(o.ceiling!==false)box(this,[w,.1,d],wall,[0,h,-d/2]);
    const trim=surface(0xd0bc9b,.8);box(this,[w,.11,.04],trim,[0,.08,-d+.08]);for(const x of [-w/2+.08,w/2-.08])box(this,[.04,.11,d],trim,[x,.08,-d/2]);
    for(let i=0;i<Math.ceil(w/.24);i++)box(this,[.008,.002,d-.12],surface(0x332a24,.8),[-w/2+.24*i,.005,-d/2]);
  }
}
export function chair(parent:THREE.Object3D,x:number,z:number,angle=0,color:THREE.ColorRepresentation=0x73543e){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;parent.add(g);const mat=surface(color,.85),metal=surface(0x393734,.65,.25);
  box(g,[.48,.085,.48],mat,[0,.47,0]);box(g,[.46,.52,.07],mat,[0,.78,-.22]);for(const xx of [-.18,.18])for(const zz of [-.18,.18])rod(g,[xx,.05,zz],[xx,.47,zz],.028,metal);return g;
}
export function table(parent:THREE.Object3D,x:number,z:number,w=1.2,d=.75){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);const wood=surface(0x8b6745,.7);box(g,[w,.075,d],wood,[0,.75,0]);for(const xx of [-w*.42,w*.42])for(const zz of [-d*.38,d*.38])rod(g,[xx,.03,zz],[xx,.75,zz],.035,wood);return g;}
export function mug(parent:THREE.Object3D,at:[number,number,number],color:THREE.ColorRepresentation=0xddd0b1){const mat=surface(color,.25),g=new THREE.Group();g.position.set(...at);parent.add(g);solid(g,new THREE.CylinderGeometry(.048,.042,.1,18,1,true),mat,[0,.05,0]);solid(g,new THREE.CircleGeometry(.038,18).rotateX(-Math.PI/2),surface(0x362419,.8),[0,.094,0]);solid(g,new THREE.TorusGeometry(.031,.009,7,15),mat,[.055,.06,0]);return g;}
export function plant(parent:THREE.Object3D,at:[number,number,number],scale=1){const g=new THREE.Group();g.position.set(...at);g.scale.setScalar(scale);parent.add(g);const pot=surface(0x9b6c4c,.88),leaf=surface(0x49654a,.87);solid(g,new THREE.CylinderGeometry(.14,.1,.23,14),pot,[0,.115,0]);for(let i=0;i<7;i++){const a=i*2.399,x=Math.cos(a)*.16,z=Math.sin(a)*.16;rod(g,[0,.2,0],[x,.48+i*.025,z],.009,leaf,5);const l=solid(g,new THREE.SphereGeometry(1,8,6).scale(.055,.17,.012),leaf,[x,.51+i*.025,z]);l.rotation.set(.45,a,.5);}return g;}
export function tableLamp(parent:THREE.Object3D,at:[number,number,number],color:THREE.ColorRepresentation=0xffc58c,intensity=2){const g=new THREE.Group();g.position.set(...at);parent.add(g);const metal=surface(0x5e5143,.45,.6);solid(g,new THREE.CylinderGeometry(.12,.15,.035,18),metal);rod(g,[0,0,0],[0,.32,0],.013,metal);solid(g,new THREE.CylinderGeometry(.12,.21,.25,24,1,true),glow(0xd3b891,.35),[0,.39,0]);const l=new THREE.PointLight(color,intensity,5,2);l.position.set(0,.33,0);g.add(l);return {group:g,light:l};}
