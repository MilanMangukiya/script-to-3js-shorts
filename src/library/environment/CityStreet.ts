import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, clamp } from '../util/math';

export interface CityStreetOptions {
  seed?:number; roadWidth?:number; sidewalkWidth?:number; blocks?:number;
  storeysMin?:number; storeysMax?:number; windowOccupancy?:number;
  wetness?:number; farFieldRadius?:number; vehicles?:boolean;
}
export interface CityStreetState { wetness?:number; lights?:number }
/** Metre-scale street kit: detailed facades, shop interiors, lamps, parked vehicles and an instanced city horizon. */
export class CityStreet {
  readonly group=new THREE.Group(); readonly near=new THREE.Group(); readonly far=new THREE.Group();
  readonly lamps:THREE.PointLight[]=[];
  /** Lamp-head materials in side (-X,+X), then street order; allows per-fixture maintenance/outage shots. */
  readonly lampHeads:THREE.MeshStandardMaterial[]=[];
  private road:THREE.MeshPhysicalMaterial;
  private glows:THREE.MeshBasicMaterial[]=[];
  private emissives:THREE.MeshStandardMaterial[]=[];
  private wet:number;
  constructor(o:CityStreetOptions={}){
    const r=rng(o.seed??4075),rw=o.roadWidth??14,sw=o.sidewalkWidth??5,blocks=o.blocks??9;
    this.wet=o.wetness??1;this.group.add(this.near,this.far);
    const std=(color:THREE.ColorRepresentation,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
    const stone=std(0x777c80),dark=std(0x273037,.4,.6),brick=std(0x414954),kerb=std(0x949994);
    const asphalt=surfaceTexture(o.seed??4075,'asphalt');asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;asphalt.repeat.set(9,85);
    this.road=new THREE.MeshPhysicalMaterial({color:0x384352,map:asphalt,roughness:.22,metalness:.23,clearcoat:.75,clearcoatRoughness:.12});
    const road=box(this.near,rw,.08,blocks*16+70,this.road,0,-.045,-20);road.receiveShadow=true;
    const paving=surfaceTexture(337,'paving');paving.wrapS=paving.wrapT=THREE.RepeatWrapping;paving.repeat.set(sw/2,blocks*8+35);
    const pavingMat=new THREE.MeshStandardMaterial({color:0x727982,map:paving,roughness:.62});
    for(const side of [-1,1]){
      box(this.near,sw,.15,blocks*16+70,pavingMat,side*(rw/2+sw/2),.025,-20);
      box(this.near,.17,.22,blocks*16+70,kerb,side*(rw/2+.03),.065,-20);
      for(let z=-65;z<60;z+=8){box(this.near,.04,.015,.9,dark,side*(rw/2+.13),.19,z);}
    }
    // The crossing runs across the road; worn paint is kept off the curb.
    const stripeTex=surfaceTexture(199,'paint');stripeTex.wrapS=stripeTex.wrapT=THREE.RepeatWrapping;stripeTex.repeat.set(1,5);
    const paint=new THREE.MeshStandardMaterial({color:0xd9dedc,map:stripeTex,roughness:.36,metalness:.1});
    for(let x=-rw/2+.5;x<rw/2;x+=1)box(this.near,.50,.007,3.0,paint,x,.006,0);
    for(const z of [-4,4])box(this.near,rw/2-.7,.008,.19,paint,(z>0?1:-1)*rw/4,.008,z);
    for(let z=-80;z<70;z+=7){if(Math.abs(z)<8)continue;box(this.near,.11,.006,3.1,paint,0,.006,z);}
    const facadeMats:THREE.MeshStandardMaterial[]=[];
    for(let k=0;k<8;k++){
      const {color,emissive}=facadeTexture((o.seed??4075)+k*67,o.windowOccupancy??.55,k);
      const m=new THREE.MeshStandardMaterial({map:color,emissiveMap:emissive,emissive:0xffd1a0,emissiveIntensity:1.10,roughness:.75});facadeMats.push(m);this.emissives.push(m);
    }
    for(const side of [-1,1])for(let b=0;b<blocks;b++){
      const z=(b-Math.floor(blocks/2))*16-13,w=14.7,h=3.2*Math.round((o.storeysMin??5)+r()*((o.storeysMax??9)-(o.storeysMin??5)));
      const x=side*(rw/2+sw+7.5),faceX=side*(rw/2+sw-.03),m=facadeMats[(b+(side>0?2:0)+8)%8];
      const mass=box(this.near,15,h,w,brick,x,h/2,z);mass.castShadow=b<6;
      const facade=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);facade.position.set(faceX,h/2,z);facade.rotation.y=-side*Math.PI/2;this.near.add(facade);
      const stoneCol=new THREE.Color().setHSL(.07+r()*.08,.10,.23+r()*.12),trim=std(stoneCol,.9);
      box(this.near,15.45,.32,w+.35,trim,x,h,z);box(this.near,.5,.2,w+.4,stone,faceX-side*.09,3.6,z);
      for(let floor=1;floor<h/3.2;floor++){box(this.near,.15,.13,w,trim,faceX-side*.05,floor*3.2,z);}
      for(const dz of [-7.25,7.25])box(this.near,.24,h,.20,trim,faceX-side*.11,h/2,z+dz);
      // Roof plant and chimney silhouettes remain visible during the crane rise.
      box(this.near,2.3,.75,2.6,dark,x+2,h+.53,z+3);box(this.near,.65,2.2,.65,trim,x-3,h+1,z-3);
      for(let shop=0;shop<3;shop++){
        const sz=z+(shop-1)*4.55,fx=faceX-side*.035;
        const glass=new THREE.MeshStandardMaterial({color:0x172b30,roughness:.20,metalness:.3,emissive:shop%2===0?0xd8934e:0x86a7af,emissiveIntensity:.18});
        box(this.near,.11,2.7,4.05,glass,fx,1.5,sz);
        const innerMat=new THREE.MeshBasicMaterial({color:shop%2===0?0xceb285:0x829ead});
        box(this.near,.06,.08,3.78,innerMat,fx-side*.09,2.64,sz);
        for(const dz of [-1.92,0,1.92])box(this.near,.20,2.9,.06,dark,fx-side*.12,1.5,sz+dz);
        const awning=std([0x334953,0x67584c,0x3d514c][shop]);box(this.near,1.2,.15,4.15,awning,fx-side*.52,3.1,sz).rotation.z=side*.11;
        box(this.near,.07,.38,3.96,dark,fx-side*.12,3.44,sz);
        // A few warm shop objects create room depth behind the glazing.
        for(let j=0;j<4;j++)box(this.near,.20,.30+.22*r(),.25,trim,fx-side*.12,.7,sz-1.35+j*.8);
      }
    }
    // Street lamps are physical practicals; only the two nearest add point lights.
    for(const side of [-1,1])for(let j=-3;j<4;j++){
      const x=side*(rw/2+.75),z=j*25-6;
      cylinder(this.near,.075,8,dark,x,4,z);box(this.near,1.25,.075,.075,dark,x-side*.52,7.9,z);
      const lampmat=new THREE.MeshStandardMaterial({color:0xe6d5b2,emissive:0xffcf87,emissiveIntensity:5,roughness:.3});this.emissives.push(lampmat);
      this.lampHeads.push(lampmat);
      box(this.near,.75,.095,.32,lampmat,x-side*1.05,7.82,z);
      const glow=reflectionTexture();const gm=new THREE.MeshBasicMaterial({color:0xe0a865,map:glow,transparent:true,opacity:.38,depthWrite:false,blending:THREE.AdditiveBlending});this.glows.push(gm);
      const streak=new THREE.Mesh(new THREE.PlaneGeometry(1.6,14),gm);streak.rotation.x=-Math.PI/2;streak.position.set(x-side*1.6,.017,z+4);this.near.add(streak);
      if(j===0){const lamp=new THREE.PointLight(0xffc990,25,19,1.8);lamp.position.set(x-side*.8,7.6,z);this.lamps.push(lamp);this.near.add(lamp);}
    }
    for(const side of [-1,1]){
      const x=side*(rw/2+.6),z=side*2.1;cylinder(this.near,.045,2.9,dark,x,1.45,z);
      box(this.near,.15,.38,.23,dark,x,2.45,z);
      const signal=new THREE.MeshBasicMaterial({color:0x7affb6});box(this.near,.158,.18,.12,signal,x-side*.02,2.46,z);
      for(let a=0;a<4;a++)box(this.near,.3,.8,.3,dark,side*(rw/2+1),.4,7+a*4);
    }
    if(o.vehicles!==false){for(let i=0;i<7;i++){
      const car=makeCityCar([0x45555b,0x718487,0x694c41,0x202c3b][i%4]);car.position.set(i%2===0?3.25:-3.25,0,(i<3?1:-1)*(7+Math.floor(i/2)*7));if(i%2===1)car.rotation.y=Math.PI;this.near.add(car);
    }}
    if((o.farFieldRadius??1400)>0){
      const extent=o.farFieldRadius??1400,step=65,count=Math.floor(extent*2/step),positions:{x:number;z:number;h:number;w:number;d:number}[]=[];
      for(let ix=0;ix<count;ix++)for(let iz=0;iz<count;iz++){
        const x=(ix-count/2)*step,z=(iz-count/2)*step;if(Math.abs(x)<34&&Math.abs(z)<150)continue;
        positions.push({x:x+(r()-.5)*13,z:z+(r()-.5)*13,h:14+Math.pow(r(),2)*95,w:25+r()*21,d:23+r()*22});
      }
      const fac=facadeTexture(941,o.windowOccupancy??.55,2),mat=new THREE.MeshStandardMaterial({color:0x6d798b,map:fac.color,emissiveMap:fac.emissive,emissive:0xffc28b,emissiveIntensity:1.2,roughness:.7});this.emissives.push(mat);
      const lod=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,positions.length),dummy=new THREE.Object3D();
      positions.forEach((p,i)=>{dummy.position.set(p.x,p.h/2,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();lod.setMatrixAt(i,dummy.matrix);lod.setColorAt(i,new THREE.Color().setHSL(.57,.1,.43+r()*.27));});this.far.add(lod);
      const grid=cityGridTexture(55);grid.wrapS=grid.wrapT=THREE.RepeatWrapping;grid.repeat.set(count/4,count/4);
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(extent*2+100,extent*2+100),new THREE.MeshStandardMaterial({color:0x172433,map:grid,emissive:0xd58d47,emissiveMap:grid,emissiveIntensity:.35,roughness:.7}));plane.rotation.x=-Math.PI/2;plane.position.y=-.12;this.far.add(plane);
    }
    // All geometry in the street is static; combine by material to keep the kit economical in long renders.
    this.near.updateMatrixWorld(true);
    const batches=new Map<THREE.Material,{geometries:THREE.BufferGeometry[];meshes:THREE.Mesh[]}>();
    this.near.traverse(obj=>{if(!(obj instanceof THREE.Mesh)||Array.isArray(obj.material))return;let b=batches.get(obj.material);if(!b){b={geometries:[],meshes:[]};batches.set(obj.material,b);}b.geometries.push(obj.geometry.clone().applyMatrix4(obj.matrixWorld));b.meshes.push(obj);});
    for(const [mat,b] of batches){const geo=mergeGeometries(b.geometries,false);if(!geo)continue;for(const m of b.meshes)m.removeFromParent();const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;mesh.castShadow=!mat.transparent && !(mat instanceof THREE.MeshBasicMaterial);this.near.add(mesh);for(const g of b.geometries)g.dispose();}
    this.update(0);
  }
  update(_time_s:number,state:CityStreetState={}){
    const wet=state.wetness??this.wet,lights=state.lights??1;
    this.road.roughness=.83-wet*.65;this.road.clearcoat=wet*.8;this.road.metalness=.05+wet*.22;
    for(const g of this.glows)g.opacity=.38*wet*lights;
    for(const m of this.emissives){if(m.userData.baseEmission===undefined)m.userData.baseEmission=m.emissiveIntensity;m.emissiveIntensity=m.userData.baseEmission*lights;}
    for(const l of this.lamps)l.intensity=25*lights;
  }
}

export function makeCityCar(color:THREE.ColorRepresentation=0x596871){
  const g=new THREE.Group(),paint=new THREE.MeshPhysicalMaterial({color,roughness:.3,metalness:.55,clearcoat:1}),tire=new THREE.MeshStandardMaterial({color:0x141619,roughness:.85}),glass=new THREE.MeshStandardMaterial({color:0x132430,roughness:.13,metalness:.65});
  box(g,1.82,.56,4.3,paint,0,.70,0);box(g,1.6,.65,2.05,glass,0,1.25,-.10);box(g,1.66,.075,1.72,paint,0,1.6,-.12);
  for(const x of [-.68,.68])box(g,.42,.11,.03,new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,2.5,2.4)}),x,.85,-2.165);
  for(const x of [-.70,.70])box(g,.34,.13,.03,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,.08,.045)}),x,.85,2.165);
  for(const x of [-.94,.94])for(const z of [-1.4,1.4]){const m=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.2,18),tire);m.rotation.z=Math.PI/2;m.position.set(x,.35,z);g.add(m);const rim=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.211,12),new THREE.MeshStandardMaterial({color:0x9ba3a8,metalness:.8,roughness:.25}));rim.rotation.z=Math.PI/2;rim.position.copy(m.position);g.add(rim);}
  for(const x of [-.97,.97])box(g,.15,.11,.22,paint,x,1.21,-.69);
  box(g,1.3,.18,.035,new THREE.MeshStandardMaterial({color:0x172128,roughness:.4,metalness:.5}),0,.62,-2.175);
  return g;
}
function box(parent:THREE.Object3D,x:number,y:number,z:number,mat:THREE.Material,px:number,py:number,pz:number){const m=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),mat);m.position.set(px,py,pz);m.receiveShadow=true;parent.add(m);return m;}
function cylinder(parent:THREE.Object3D,r:number,h:number,mat:THREE.Material,x:number,y:number,z:number){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,10),mat);m.position.set(x,y,z);parent.add(m);return m;}
function texture(canvas:HTMLCanvasElement){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function surfaceTexture(seed:number,type:'asphalt'|'paving'|'paint'){
  const r=rng(seed),c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!;
  x.fillStyle=type==='asphalt'?'#9098a0':type==='paint'?'#d7deda':'#92999d';x.fillRect(0,0,256,256);
  for(let i=0;i<8500;i++){const v=Math.floor(45+r()*120);x.fillStyle=`rgba(${v},${v},${v},${type==='paint'?.3:.24})`;x.fillRect(r()*256,r()*256,1+r()*2,1+r()*2);}
  if(type==='paving'){x.strokeStyle='#4e565c';x.lineWidth=2;for(let y=0;y<256;y+=64){x.beginPath();x.moveTo(0,y);x.lineTo(256,y);x.stroke();for(let xx=(y/64)%2*32;xx<256;xx+=64){x.beginPath();x.moveTo(xx,y);x.lineTo(xx,y+64);x.stroke();}}}
  return texture(c);
}
function facadeTexture(seed:number,occupancy:number,variant:number){
  const r=rng(seed),c=document.createElement('canvas'),e=document.createElement('canvas');c.width=e.width=512;c.height=e.height=1024;
  const x=c.getContext('2d')!,em=e.getContext('2d')!;const palette=['#545154','#65717a','#645951','#48565d','#7b7469','#535f61','#817664','#5e5a62'];
  x.fillStyle=palette[variant%palette.length];x.fillRect(0,0,512,1024);em.fillStyle='#000';em.fillRect(0,0,512,1024);
  // Fine masonry courses and individual mortar joints under the fenestration.
  x.strokeStyle='rgba(20,25,30,.20)';x.lineWidth=1;for(let y=0;y<1024;y+=12){x.beginPath();x.moveTo(0,y);x.lineTo(512,y);x.stroke();for(let xx=(y/12)%2*23;xx<512;xx+=46){x.beginPath();x.moveTo(xx,y);x.lineTo(xx,y+12);x.stroke();}}
  for(let row=0;row<8;row++)for(let col=0;col<5;col++){
    const wx=col*99+24,wy=row*124+31,ww=57,wh=73,lit=r()<occupancy;
    x.fillStyle='#252c33';x.fillRect(wx-5,wy-6,ww+10,wh+13);x.fillStyle='#b2afa4';x.fillRect(wx-6,wy+wh+4,ww+12,4);
    const tint=lit?(r()>.35?'#d5ae78':'#d2c4a3'):'#14212e';x.fillStyle=tint;x.fillRect(wx,wy,ww,wh);
    if(lit){const grad=em.createLinearGradient(wx,wy,wx,wy+wh);grad.addColorStop(0,'#c3a274');grad.addColorStop(.6,'#eed3a0');grad.addColorStop(1,'#685644');em.fillStyle=grad;em.fillRect(wx,wy,ww,wh);}
    // Side curtains, upper blind and dark silhouettes make every room different.
    for(const target of [x,em]){target.fillStyle=lit?'rgba(77,56,43,.7)':'#1b2833';target.fillRect(wx,wy,7+r()*9,wh);target.fillRect(wx+ww-9,wy,9,wh);target.fillStyle='#343a3b';target.fillRect(wx+ww/2-1,wy,2,wh);target.fillRect(wx,wy+wh*.5,ww,2);if(r()>.45)target.fillRect(wx,wy,ww,10+r()*17);target.fillStyle='#262c30';target.fillRect(wx+12+r()*22,wy+wh-17,12,17);}
  }
  return {color:texture(c),emissive:texture(e)};
}
function reflectionTexture(){const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d')!,r=rng(88);x.clearRect(0,0,64,256);for(let y=0;y<256;y+=2){const a=Math.pow(1-Math.abs(y-108)/148,2);x.fillStyle=`rgba(255,244,224,${Math.max(0,a)*(.1+r()*.6)})`;const w=(10+r()*20)*(1-y/380);x.fillRect(32-w/2,y,w,1+r()*2);}return texture(c);}
function cityGridTexture(seed:number){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d')!,r=rng(seed);x.fillStyle='#131d29';x.fillRect(0,0,512,512);for(let j=0;j<4;j++){x.fillStyle='#5b4e3f';x.fillRect(j*128,0,14,512);x.fillRect(0,j*128,512,14);for(let k=0;k<512;k+=12){x.fillStyle=r()>.2?'#d6a86a':'#536679';x.fillRect(j*128+2,k,2,4);x.fillRect(k,j*128+2,4,2);}}return texture(c);}
