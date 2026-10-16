import * as THREE from 'three';
import { surface,glow,solid,box,rod } from '../util/Modeling';

/** Rectangular window opening (metres) in the back wall (centre = x) or a side wall (centre = z, interior is −Z). */
export interface RoomWindow {wall:'back'|'left'|'right';center:number;sill:number;width:number;height:number;frameColor?:THREE.ColorRepresentation;}
export interface RoomBoxOptions {width?:number;height?:number;depth?:number;wallColor?:THREE.ColorRepresentation;floorColor?:THREE.ColorRepresentation;ceiling?:boolean;
  /** Optional window opening with a painted frame and cross mullions (default none, so existing rooms are unchanged). */
  window?:RoomWindow;}
/** Open-front architectural room. Origin is centre of the front threshold; interior extends along -Z. */
export class RoomBox extends THREE.Group {
  constructor(o:RoomBoxOptions={}){super();const w=o.width??3,h=o.height??2.7,d=o.depth??3.8,wall=surface(o.wallColor??0xb5a087,.9),wood=surface(o.floorColor??0x6f5240,.82);
    box(this,[w,.10,d],wood,[0,-.05,-d/2]);
    const wn=o.window,walls:[string,number][]=[['back',0],['left',-w/2],['right',w/2]];
    for(const [side,x] of walls){
      const span=side==='back'?w:d,along=(v:number)=>side==='back'?[v,0,-d]:[x,0,-d/2+v] as number[],size=(len:number,hh:number)=>(side==='back'?[len,hh,.12]:[.12,hh,len]) as [number,number,number];
      if(!wn||wn.wall!==side){const c=along(0);box(this,size(span,h),wall,[c[0],h/2,c[2]]);continue;}
      // Wall pieces around the opening (positions along the wall measured from its centre).
      const c0=side==='back'?wn.center:wn.center+d/2,a0=c0-wn.width/2,a1=c0+wn.width/2,top=wn.sill+wn.height;
      const seg=(l0:number,l1:number,y0:number,y1:number)=>{if(l1-l0<1e-3||y1-y0<1e-3)return;const c=along((l0+l1)/2);box(this,size(l1-l0,y1-y0),wall,[c[0],(y0+y1)/2,c[2]]);};
      seg(-span/2,a0,0,h);seg(a1,span/2,0,h);seg(a0,a1,0,wn.sill);seg(a0,a1,top,h);
      const fm=surface(wn.frameColor??0xe9e4d8,.55),ft=.05,fd=.14;
      const bar=(l0:number,l1:number,y0:number,y1:number)=>{const c=along((l0+l1)/2);box(this,(side==='back'?[l1-l0,y1-y0,fd]:[fd,y1-y0,l1-l0]) as [number,number,number],fm,[c[0],(y0+y1)/2,c[2]]);};
      bar(a0,a1,wn.sill-ft,wn.sill);bar(a0,a1,top,top+ft);bar(a0-ft,a0,wn.sill,top);bar(a1,a1+ft,wn.sill,top);
      bar((a0+a1)/2-.02,(a0+a1)/2+.02,wn.sill,top);bar(a0,a1,wn.sill+wn.height*.55-.02,wn.sill+wn.height*.55+.02);
      const sill=along(c0);box(this,(side==='back'?[wn.width+.16,.04,.24]:[.24,.04,wn.width+.16]) as [number,number,number],fm,[sill[0]+(side==='left'?.06:side==='right'?-.06:0),wn.sill-.02,sill[2]+(side==='back'?.06:0)]);
    }
    if(o.ceiling!==false)box(this,[w,.1,d],wall,[0,h,-d/2]);
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
/** Double bed with headboard, mattress, pillows and a duvet; head against -Z. Returns the mattress top height and the pillow centre. */
export function bed(parent:THREE.Object3D,x:number,z:number,o:{width?:number;length?:number;frameColor?:THREE.ColorRepresentation;sheetColor?:THREE.ColorRepresentation;duvetColor?:THREE.ColorRepresentation}={}){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);const W=o.width??1.45,L=o.length??2.05,wood=surface(o.frameColor??0x6b4d36,.7),sheet=surface(o.sheetColor??0xe9e5dc,.95),duvet=surface(o.duvetColor??0x8fa3b5,.97);
  box(g,[W+.08,.28,L+.06],wood,[0,.18,-L/2]);box(g,[W+.12,.95,.07],wood,[0,.5,-L-.02]);for(const xx of [-W/2,W/2])box(g,[.06,.12,.06],wood,[xx,.03,-.05]);
  const mattressTop=.52;box(g,[W,.2,L],sheet,[0,.42,-L/2]);
  const pillow=new THREE.SphereGeometry(1,20,12).scale(.32,.07,.2);for(const xx of [-W/4,W/4])solid(g,pillow,sheet,[xx,mattressTop+.06,-L+.28]);
  return {group:g,mattressTop,pillow:new THREE.Vector3(x-W/4,mattressTop+.06,z-L+.28),duvetMat:duvet};
}
