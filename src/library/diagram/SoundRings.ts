import * as THREE from 'three';
import { clamp, smoothstep } from '../util/math';

export interface SoundRingsOptions {
  mode?: 'ground'|'air'|'underwater'; color?:THREE.ColorRepresentation;
  maxRadius?:number; thickness?:number; opacity?:number; speedVisual?:number;
  emissionRate?:number; count?:number; amplitude?:number; noiseFloor?:number;
}
/** Explicitly schematic acoustic rings. All ring ages derive from absolute time. */
export class SoundRings extends THREE.Group {
  private rings:THREE.Mesh[]=[]; private opts:Required<SoundRingsOptions>;
  constructor(o:SoundRingsOptions={}){
    super();this.opts={mode:o.mode??'ground',color:o.color??0xece4c6,maxRadius:o.maxRadius??50,thickness:o.thickness??.012,opacity:o.opacity??.3,speedVisual:o.speedVisual??20,emissionRate:o.emissionRate??1,count:o.count??5,amplitude:o.amplitude??1,noiseFloor:o.noiseFloor??0};
    for(let i=0;i<this.opts.count;i++){
      const g=new THREE.RingGeometry(1-this.opts.thickness,1,128);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:this.opts.color,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
      if(this.opts.mode==='ground')m.rotation.x=-Math.PI/2;
      this.rings.push(m);this.add(m);
    }
  }
  update(time_s:number,start_s=0,stop_s=Infinity,amplitude=this.opts.amplitude){
    const o=this.opts,period=1/o.emissionRate,cycle=Math.floor(Math.max(0,time_s-start_s)/period);
    this.rings.forEach((m,i)=>{const born=start_s+(cycle-i)*period,age=time_s-born,radius=age*o.speedVisual;const signal=amplitude/Math.sqrt(1+radius);
      m.visible=born>=start_s&&born<=stop_s&&age>=0&&radius<=o.maxRadius&&signal>=o.noiseFloor;
      m.scale.setScalar(Math.max(.0001,radius));(m.material as THREE.MeshBasicMaterial).opacity=o.opacity*amplitude*(1-smoothstep(.55,1,radius/o.maxRadius))*smoothstep(0,.035,age);
    });
  }
  /** One comparison pulse, clamped at its maximum to support a held diagram. */
  pulse(age:number,maxRadius=this.opts.maxRadius,fade=1){
    const m=this.rings[0];this.rings.forEach((r,i)=>r.visible=i===0&&age>=0);
    const r=clamp(age*this.opts.speedVisual,.0001,maxRadius);m.scale.setScalar(r);(m.material as THREE.MeshBasicMaterial).opacity=this.opts.opacity*fade;
  }
}
