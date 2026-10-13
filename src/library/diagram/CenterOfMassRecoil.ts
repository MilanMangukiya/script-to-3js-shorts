import * as THREE from 'three';
import { Humanoid } from '../characters/Humanoid';
import { surface,glow,box,rod,solid } from '../util/Modeling';
export interface RecoilOptions {massRatio?:number;jumpHeight?:number;visualRecoil?:number;color?:THREE.ColorRepresentation}
/** Two-body COM relationship with independently exaggerated display displacement; label NOT TO SCALE. */
export class CenterOfMassRecoil {
  readonly group=new THREE.Group();readonly earthCarrier=new THREE.Group();readonly peopleCarrier=new THREE.Group();
  readonly center=new THREE.Group();readonly people:Humanoid[]=[];readonly massRatio:number;readonly jumpHeight:number;readonly visualRecoil:number;
  constructor(o:RecoilOptions={}) {
    this.massRatio=o.massRatio??1.175e13;this.jumpHeight=o.jumpHeight??.3;this.visualRecoil=o.visualRecoil??.16;
    const brass=surface(0x9c8357,.3,.8),dark=surface(0x182b3b,.4,.4),cyan=glow(o.color??0x57d6f6,1.4);
    this.group.add(this.earthCarrier,this.peopleCarrier,this.center);
    box(this.earthCarrier,[2.2,.25,1.0],dark,[0,.15,0]);box(this.earthCarrier,[2.22,.035,1.02],brass,[0,.285,0]);
    const globe=solid(this.earthCarrier,new THREE.SphereGeometry(.47,64,32),surface(0x214861,.4,.3),[0,-.36,0]);
    const grid=solid(this.earthCarrier,new THREE.SphereGeometry(.474,24,12),new THREE.MeshBasicMaterial({color:0x5db8d1,wireframe:true,transparent:true,opacity:.22}),[0,-.36,0]);
    for(let i=0;i<5;i++){const person=new Humanoid({height:.51,coat:'jacket',coatColor:i%2?0xb99250:0x487b96,trouserColor:0x667480,shoeColor:0x424d55,skinColor:0xb78a67,scarfColor:null});person.root.position.set((i-2)*.32,.30,0);this.peopleCarrier.add(person.root);this.people.push(person);}
    for(const x of [-1.28,1.28]){rod(this.group,[x,-.82,0],[x,1.9,0],.022,brass);for(let j=0;j<24;j++)box(this.group,[j%4===0?.09:.04,.009,.02],cyan,[x, -.65+j*.1,.025]);}
    box(this.group,[3,.15,1.45],dark,[0,-.9,0]);
    rod(this.center,[-.14,0,.75],[.14,0,.75],.008,cyan);rod(this.center,[0,-.14,.75],[0,.14,.75],.008,cyan);this.center.position.y=.24;
    const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(.97,.8,.2),.7,0xfacc55,.15,.08);this.peopleCarrier.add(arrow);
    const down=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(-.97,.15,.2),.5,0x57cfee,.13,.07);this.earthCarrier.add(down);
  }
  displacement(height=this.jumpHeight){return -height/(this.massRatio+1);}
  update(progress:number,landingProgress=0){const arc=Math.sin(Math.PI*Math.max(0,Math.min(1,progress)))*(1-Math.max(0,Math.min(1,landingProgress)));this.peopleCarrier.position.y=arc*.75;this.earthCarrier.position.y=-arc*this.visualRecoil;}
}
