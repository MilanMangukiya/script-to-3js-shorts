import * as THREE from 'three';
import { Humanoid, POSE_STAND } from './Humanoid';
import { VanishDissolve } from '../fx/VanishDissolve';
import { clamp, rng, smoothstep } from '../util/math';

export interface PedestrianCrowdOptions {
  seed?: number; count?: number; width?: number; depth?: number;
  speedRange?: [number,number]; heightRange?: [number,number]; childFraction?: number;
  flagFraction?: number; umbrellaCount?: number; dissolve?: boolean;
}
export interface CrowdState {
  clock_s?: number; vanishStart_s?: number; dissolveEnabled?: boolean;
  survivorStop_s?: number; visibleCount?: number; youngGeneration?: number;
}
interface Walker { person: Humanoid; x:number; z:number; speed:number; dir:number; phase:number; flagged:boolean; effect?:VanishDissolve; umbrella?:THREE.Group; backpack?:THREE.Mesh; startJitter:number }

/** Seeded crossing paths, analytic gait and reversible removal, using the studio human rig. */
export class PedestrianCrowd {
  readonly group = new THREE.Group(); readonly figures: Humanoid[]=[];
  private walkers:Walker[]=[]; private width:number;
  readonly fallenProps = new THREE.Group();
  private dropUmbrella: THREE.Group;
  private bike:THREE.Group;
  private tote:THREE.Mesh;
  private phone:THREE.Mesh;
  constructor(o:PedestrianCrowdOptions={}) {
    const r=rng(o.seed??42075), n=o.count??44; this.width=o.width??14;
    const coats=[0x344557,0x797564,0x927653,0x68545b,0x384b42,0x1c2f42,0xa79881,0x665a45,0x485a62];
    const skins=[0xe2bda1,0xc1906e,0x91613f,0x593b2d,0xb77e58,0xe7c9af];
    for(let i=0;i<n;i++){
      const child=i>0&&i<1+Math.floor(n*(o.childFraction??.12));
      const height=child?1.10+r()*.32:(o.heightRange?.[0]??1.52)+r()*((o.heightRange?.[1]??1.92)-(o.heightRange?.[0]??1.52));
      const p=new Humanoid({height,coatColor:coats[i%coats.length],skinColor:skins[i%skins.length],trouserColor:i%4===0?0x625e56:0x252d36,scarfColor:i%3===0?0xae865e:null,coat:i%4===0?'long':'jacket',hat:i%7===0,hairColor:i%5===0?0x8a7460:0x261c17});
      if(child)p.head.scale.setScalar(1.12);
      // Darker layered hair on a subset; clothing colors overlap all disappearance flags.
      if(i%3===0){const hair=new THREE.Mesh(new THREE.CapsuleGeometry(.072,.12,4,10),new THREE.MeshStandardMaterial({color:0x30251f,roughness:.94}));hair.position.set(0,.04,-.06);p.head.add(hair);}
      const row=Math.floor(i/11),rows=Math.ceil(n/11), x=-this.width*.457+(i%11)*this.width*.0871+(r()-.5)*.5, z=(row-(rows-1)/2)*(o.depth??2.56)/rows+(r()-.5)*.26;
      const flagged=o.flagFraction===undefined?i%2===0:((i*17)%n)/n<clamp(o.flagFraction);
      const w:Walker={person:p,x,z,speed:(o.speedRange?.[0]??1.25)+r()*((o.speedRange?.[1]??1.45)-(o.speedRange?.[0]??1.25)),dir:row%2===0?1:-1,phase:r()*Math.PI*2,flagged,startJitter:r()*.35};
      this.figures.push(p);this.group.add(p.root);this.walkers.push(w);
      if(i<(o.umbrellaCount??9)){
        const umbrella=makeUmbrella([0x24384c,0x535b5d,0x665746,0x334642][i%4]);p.root.add(umbrella);umbrella.position.set(.23,height>1.5?1.40:1.47,.07);w.umbrella=umbrella;
      }else if(i%5===0){
        const pack=new THREE.Mesh(new THREE.BoxGeometry(.28,.34,.13),new THREE.MeshStandardMaterial({color:0x5f5344,roughness:.85}));pack.position.set(0,-.03,-.065);p.backAnchor.add(pack);w.backpack=pack;
      }
      if(o.dissolve!==false && w.flagged){w.effect=new VanishDissolve(p.root,{seed:i+73,moteCount:22});this.group.add(w.effect.motes);}
    }
    this.group.add(this.fallenProps);
    this.dropUmbrella=makeUmbrella(0x223850);this.fallenProps.add(this.dropUmbrella);
    this.bike=makeBicycle();this.fallenProps.add(this.bike);
    this.tote=new THREE.Mesh(new THREE.BoxGeometry(.34,.36,.1),new THREE.MeshStandardMaterial({color:0xc3b49a,roughness:.85}));this.fallenProps.add(this.tote);
    this.phone=new THREE.Mesh(new THREE.BoxGeometry(.075,.012,.15),new THREE.MeshStandardMaterial({color:0x182028,roughness:.22,metalness:.5}));this.fallenProps.add(this.phone);
  }
  update(time_s:number,state:CrowdState={}){
    const t=state.clock_s??time_s, enabled=state.dissolveEnabled??false, start=state.vanishStart_s??Infinity;
    const stop=state.survivorStop_s??Infinity;
    const motion=t<stop?t:stop+Math.min(.36,Math.max(0,t-stop)-Math.pow(Math.min(.72,Math.max(0,t-stop)),2)/1.44);
    const gaitWeight=Number.isFinite(stop)?1-smoothstep(stop,stop+.72,t):1;
    for(let i=0;i<this.walkers.length;i++){
      const w=this.walkers[i], p=w.person;
      const vanishT=start+w.startJitter, localMotion=enabled&&w.flagged?Math.min(motion,vanishT):motion;
      const path=((w.x+w.dir*w.speed*localMotion+this.width/2) % this.width+this.width)%this.width-this.width/2;
      p.root.position.set(path,.035,w.z);p.root.rotation.y=w.dir*Math.PI/2;
      const gait=(enabled&&w.flagged?Math.min(t,vanishT):t)*5.2+w.phase;
      const walk=Math.sin(gait)*.30*gaitWeight, knee=Math.max(0,-Math.sin(gait))*.4*gaitWeight;
      p.setPose({...POSE_STAND,hipsY:.92+Math.abs(Math.sin(gait))*.022*gaitWeight,legL:[walk,knee],legR:[-walk,Math.max(0,Math.sin(gait))*.4*gaitWeight],armL:[-walk*.7,.06,.18],armR:[walk*.7,.06,.18],headYaw:enabled?smoothstep(stop,stop+1.2,t)*Math.sin(i*2.13)*.38:0,breath:Math.sin(t*1.6+w.phase)*.3});
      const gone=w.effect?.update(t,vanishT,p.root.position,enabled)??0;
      p.root.visible=i<(state.visibleCount??this.walkers.length)&&gone<.999;
      if(w.umbrella){w.umbrella.visible=!(enabled&&w.flagged&&t>vanishT);w.umbrella.rotation.z=.06*Math.sin(gait);}
    }
    this.fallenProps.visible=enabled && t>=start;
    const age=Math.max(0,t-start), fall=(h:number)=>Math.max(.06,h-4.905*age*age)+Math.max(0,.04*Math.exp(-8*Math.max(0,age-.45))*Math.sin(Math.max(0,age-.45)*24));
    this.dropUmbrella.position.set(1.6+Math.min(age,.5)*.24,fall(1.5),-.48);this.dropUmbrella.rotation.set(0,.4,Math.min(1,age/.6)*1.43);
    this.tote.position.set(-1.9,fall(.94),.36);this.tote.rotation.z=smoothstep(0,.5,age)*1.3;
    this.phone.position.set(3.3,fall(.83),.8);this.phone.rotation.y=Math.min(age,.6)*.7;
    this.bike.position.set(-4.2,.055,-.65);this.bike.rotation.set(smoothstep(0,.65,age)*1.5,0,0);
  }
}

export function makeUmbrella(color:THREE.ColorRepresentation){
  const g=new THREE.Group();
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(.56,16,8,0,Math.PI*2,0,Math.PI*.44),new THREE.MeshStandardMaterial({color,roughness:.3,metalness:.05,side:THREE.DoubleSide}));canopy.scale.y=.5;canopy.position.y=.62;g.add(canopy);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.75,6),new THREE.MeshStandardMaterial({color:0x8e969c,metalness:.8,roughness:.3}));pole.position.y=.38;g.add(pole);
  const ribmat=new THREE.LineBasicMaterial({color:0x66727c});
  for(let i=0;i<8;i++){const a=i*Math.PI/4,pts=[];for(let k=0;k<8;k++){const th=k/7*Math.PI*.44;pts.push(new THREE.Vector3(Math.sin(th)*.56*Math.cos(a),.62+Math.cos(th)*.28,Math.sin(th)*.56*Math.sin(a)));}g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),ribmat));}
  return g;
}
export function makeBicycle(){
  const g=new THREE.Group(),frame=new THREE.MeshStandardMaterial({color:0x3e715a,metalness:.5,roughness:.3}),rubber=new THREE.MeshStandardMaterial({color:0x11161a,roughness:.8}),chrome=new THREE.MeshStandardMaterial({color:0x87939b,metalness:.8,roughness:.3});
  const tube=(a:THREE.Vector3,b:THREE.Vector3,r=.025,m=frame)=>{const d=b.clone().sub(a);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),7),m);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());g.add(mesh);};
  for(const x of [-.62,.62]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.34,.024,8,32),rubber);wheel.position.set(x,.34,0);g.add(wheel);for(let j=0;j<12;j++){const a=j*Math.PI/6;tube(new THREE.Vector3(x,.34,0),new THREE.Vector3(x+.31*Math.cos(a),.34+.31*Math.sin(a),0),.003,chrome);}}
  const p=[new THREE.Vector3(-.62,.34,0),new THREE.Vector3(-.2,.77,0),new THREE.Vector3(.0,.34,0),new THREE.Vector3(.43,.82,0),new THREE.Vector3(.62,.34,0)];
  for(const [a,b] of [[0,1],[1,2],[2,0],[1,3],[2,3],[3,4]])tube(p[a],p[b]);
  tube(p[1],new THREE.Vector3(-.23,.96,0));tube(p[3],new THREE.Vector3(.43,1.05,0),.02,chrome);tube(new THREE.Vector3(.43,1.05,-.22),new THREE.Vector3(.43,1.05,.22),.018,chrome);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.25,.06,.17),rubber);seat.position.set(-.23,.98,0);g.add(seat);return g;
}
