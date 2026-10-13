import * as THREE from 'three';
import { rng, clamp } from '../util/math';

export interface RightWhaleOptions {
  length?: number; preset?: 'adult' | 'calf'; callositySeed?: number;
  flukePeriod_s?: number; skinColor?: THREE.ColorRepresentation; quality?: number;
}

/** North Atlantic right whale, +X forward; no dorsal fin. Origin at midbody, metres.
 * Analytic swim poses preserve arbitrary frame ordering. Callosity pattern is seeded.
 */
export class RightWhale extends THREE.Group {
  private tail = new THREE.Group(); private flippers: THREE.Group[] = [];
  private period: number; private body: THREE.Mesh; private original: Float32Array;
  private length: number;
  constructor(o: RightWhaleOptions = {}) {
    super(); const L = this.length = o.length ?? (o.preset === 'calf' ? 5 : 14);
    const q = o.quality ?? 1, r = rng(o.callositySeed ?? 76);
    this.period = o.flukePeriod_s ?? (o.preset === 'calf' ? 2.6 : 4.2);
    const skin = new THREE.MeshPhysicalMaterial({ color:o.skinColor ?? 0x263435, roughness:.43, metalness:.07, clearcoat:.35, clearcoatRoughness:.27 });
    skin.onBeforeCompile = s => {
      s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWhaleP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWhaleP=position;');
      s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWhaleP;').replace('#include <color_fragment>','#include <color_fragment>\nfloat striae=sin(vWhaleP.x*149.0+sin(vWhaleP.z*70.0)*1.7)*sin(vWhaleP.z*187.0); diffuseColor.rgb*=0.93+striae*0.055;');
    };
    // Smooth thick torso blends into a high, blunt arched rostrum. Elliptical sections.
    const profiles = [
      [-.43,.010,.016,-.006],[-.35,.039,.04,-.006],[-.24,.088,.075,0],[-.10,.119,.095,.008],
      [.07,.132,.106,.005],[.23,.127,.100,.006],[.34,.110,.083,.025],[.43,.081,.049,.037],[.49,.025,.023,.038],[.502,.001,.001,.033],
    ];
    const shape = new THREE.CatmullRomCurve3(profiles.map(p=>new THREE.Vector3(p[0],p[1],p[2])));
    const ns=Math.round(100*q), nr=Math.round(44*q), pos:number[]=[], uv:number[]=[], idx:number[]=[];
    for(let i=0;i<=ns;i++) {
      const f=i/ns, p=shape.getPoint(f), k=f*(profiles.length-1), j=Math.min(profiles.length-2,Math.floor(k));
      const cy=THREE.MathUtils.lerp(profiles[j][3],profiles[j+1][3],k-j);
      for(let a=0;a<=nr;a++){const th=a/nr*Math.PI*2;pos.push(p.x*L,(cy+Math.cos(th)*p.y)*L,Math.sin(th)*p.z*L);uv.push(f,a/nr);}
    }
    for(let i=0;i<ns;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,b=a+nr+1;idx.push(a,b,a+1,b,b+1,a+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    // Ring ordering runs along X, so correct the inward winding.
    const ia=geo.index!;for(let i=0;i<ia.count;i+=3){const keep=ia.getX(i+1);ia.setX(i+1,ia.getX(i+2));ia.setX(i+2,keep);}geo.computeVertexNormals();
    this.body=new THREE.Mesh(geo,skin);this.body.castShadow=true;this.body.receiveShadow=true;this.add(this.body);this.original=new Float32Array(pos);
    const unitSphere=new THREE.SphereGeometry(1,28,18);
    const ellipsoid=(parent:THREE.Object3D,p:number[],s:number[],mat:THREE.Material)=>{const m=new THREE.Mesh(unitSphere,mat);m.position.set(p[0]*L,p[1]*L,p[2]*L);m.scale.set(s[0]*L,s[1]*L,s[2]*L);parent.add(m);return m;};
    // Paired broad paddles are far forward; right whales have no throat pleats.
    for(const side of [-1,1]){
      const f=new THREE.Group();f.position.set(.135*L,-.073*L,side*.077*L);this.add(f);this.flippers.push(f);
      const paddle=ellipsoid(f,[-.055,-.049,side*.071],[.098,.024,.060],skin);paddle.rotation.x=side*.48;paddle.rotation.y=side*.34;paddle.rotation.z=.25;
    }
    this.tail.position.set(-.415*L,0,0);this.add(this.tail);
    ellipsoid(this.tail,[-.007,0,0],[.045,.021,.035],skin);
    // Fluke outline: swept leading edge, broad flattened lobes and a deep median notch.
    const outline=[[-.015,0],[-.02,.036],[-.025,.093],[-.07,.167],[-.095,.198],[-.13,.173],[-.135,.11],[-.119,.047],[-.09,0],[-.119,-.047],[-.135,-.11],[-.13,-.173],[-.095,-.198],[-.07,-.167],[-.025,-.093],[-.02,-.036]];
    const fshape=new THREE.Shape();outline.forEach((p,i)=>i?fshape.lineTo(p[0]*L,p[1]*L):fshape.moveTo(p[0]*L,p[1]*L));fshape.closePath();
    const flukeGeo=new THREE.ExtrudeGeometry(fshape,{depth:L*.011,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:L*.006,bevelThickness:L*.006,curveSegments:24});flukeGeo.rotateX(Math.PI/2);flukeGeo.translate(0,.005*L,0);
    this.tail.add(new THREE.Mesh(flukeGeo,skin));
    // Curved mouth seams under the arched rostrum; paired low-set eyes.
    const seamMat=new THREE.MeshStandardMaterial({color:0x101717,roughness:.75});
    for(const side of [-1,1]){
      const curve=new THREE.CatmullRomCurve3([[.494,.035,.013],[.453,.003,.044],[.37,-.04,.08],[.27,-.064,.096],[.185,-.063,.094]].map(p=>new THREE.Vector3(p[0]*L,p[1]*L,p[2]*L*side)));
      this.add(new THREE.Mesh(new THREE.TubeGeometry(curve,54,L*.0018,6,false),seamMat));
      ellipsoid(this,[.235,-.008,side*.099],[.006,.005,.003],new THREE.MeshPhysicalMaterial({color:0x060b0b,roughness:.04,clearcoat:1}));
      // Tiny eyelid follows the eye contour, unlike a cartoon protruding eyeball.
      const arc=new THREE.EllipseCurve(0,0,L*.008,L*.005,0,Math.PI,false,0);
      const ac=new THREE.CatmullRomCurve3(arc.getPoints(15).map(p=>new THREE.Vector3(.235*L+p.x,-.008*L+p.y,side*.101*L)));
      this.add(new THREE.Mesh(new THREE.TubeGeometry(ac,16,L*.001,4,false),skin));
    }
    const callosity=new THREE.MeshStandardMaterial({color:o.preset==='calf'?0x949785:0xc0b9a0,roughness:1});
    const patches=[ [.457,.097,.018,.017],[.388,.123,.035,.015],[.308,.132,.042,.012],[.228,.032,.098,.012],[.437,-.020,.046,.013],[.349,-.059,.073,.010] ];
    for(const side of [-1,1]) for(const [x,y,z,size] of patches){
      const bumps=o.preset==='calf'?8:19;
      for(let n=0;n<bumps;n++){const a=r()*Math.PI*2,rad=Math.sqrt(r())*size;
        const m=ellipsoid(this,[x+Math.cos(a)*rad,y+(r()-.35)*size*.32,side*(z+Math.sin(a)*rad*.60)],[size*(.22+r()*.18),size*(.16+r()*.12),size*(.2+r()*.14)],callosity);m.rotation.set(r(),r(),r());
      }
    }
    // Two blowholes sit behind the rostrum; very restrained pale scarring.
    for(const side of [-1,1]){const bh=ellipsoid(this,[.272,.135,side*.013],[.013,.0015,.006],seamMat);bh.rotation.y=side*.2;}
    const scarMat=new THREE.MeshStandardMaterial({color:0x6e7b77,roughness:.7,transparent:true,opacity:.52});
    for(let i=0;i<5;i++){const x=-.16+r()*.31,y=.015+r()*.06,z=.098;const sc=new THREE.CatmullRomCurve3([new THREE.Vector3(x*L,y*L,z*L),new THREE.Vector3((x+.015)*L,(y+.008)*L,z*L),new THREE.Vector3((x+.037)*L,(y+.006)*L,(z-.008)*L)]);this.add(new THREE.Mesh(new THREE.TubeGeometry(sc,12,L*.0007,4,false),scarMat));}
  }
  update(time_s:number,bank=0){
    const phase=time_s*Math.PI*2/this.period;this.tail.rotation.z=Math.sin(phase)*.18;
    this.flippers.forEach((f,i)=>{f.rotation.x=(i===0?-1:1)*(.055*Math.sin(phase+.8)+bank);});
    const a=this.body.geometry.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<a.count;i++){const x=this.original[i*3],k=clamp((-x/this.length-.12)/.32);a.setY(i,this.original[i*3+1]+Math.sin(phase+k*.8)*this.length*.010*k*k);}
    a.needsUpdate=true;this.body.geometry.computeVertexNormals();
  }
}
