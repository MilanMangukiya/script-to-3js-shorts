import * as THREE from 'three';
import { rng } from '../util/math';
import { surface, glow, solid, box, rod, canvasTexture } from '../util/Modeling';

export interface ContainerShipOptions { length?:number; beam?:number; draft?:number; containerFill?:number; palette?:THREE.ColorRepresentation[]; seed?:number; deckLights?:boolean; navLights?:boolean; }
export interface ContainerShipState { rpm?:number; speed?:number; pitch?:number; }
/** Unbranded freighter. Bow -Z, stern +Z, waterline Y=0. Propeller shaft is Z; rotation may be overridden analytically. */
export class ContainerShip extends THREE.Group {
  readonly propeller = new THREE.Group(); readonly deckhouse = new THREE.Group(); readonly length:number; readonly beam:number; readonly draft:number;
  constructor(o:ContainerShipOptions = {}) {
    super(); const L=this.length=o.length??300, B=this.beam=o.beam??48,D=this.draft=o.draft??13, r=rng(o.seed??87);
    const steel=surface(0x25333c,.46,.55), red=surface(0x653129,.75,.15), deck=surface(0x555a5c,.9,.1), white=surface(0xc2c9c6,.58,.15);
    const positions:number[]=[],colors:number[]=[],ids:number[]=[]; const n=60,m=26;
    for(let i=0;i<=n;i++) { const u=i/n,z=(u-.5)*L;
      const taper=u<.17 ? Math.pow(Math.sin(u/.17*Math.PI/2),.58) : u>.81 ? .58+.42*Math.cos((u-.81)/.19*Math.PI/2) : 1;
      const sternRise = u>.82 ? Math.min(1,(u-.82)/.15) : 0, localDraft=D*(1-.83*sternRise);
      for(let j=0;j<=m;j++){ const a=j/m*Math.PI-Math.PI/2, x=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.32)*B*.5*Math.max(.015,taper), y=6-(6+localDraft)*Math.pow(Math.cos(a),.45);
        positions.push(x,y,z); const c=new THREE.Color(y<.3?0x653129:0x25333c); colors.push(c.r,c.g,c.b);
      }
    }
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=i*(m+1)+j,b=a+m+1;ids.push(a,b,a+1,b,b+1,a+1);}
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(ids);geo.computeVertexNormals();
    solid(this,geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.63,metalness:.28,side:THREE.DoubleSide}));
    box(this,[B*.97,.5,L*.70],deck,[0,6,0]);
    // Sharply raked forecastle and a bulb below the waterline.
    const bow = new THREE.Shape();bow.moveTo(-B*.45,0);bow.lineTo(0,-L*.145);bow.lineTo(B*.45,0);bow.closePath();
    solid(this,new THREE.ExtrudeGeometry(bow,{depth:1.6,bevelEnabled:false}).rotateX(Math.PI/2),steel,[0,8,-L*.35]);
    solid(this,new THREE.SphereGeometry(1,24,12).scale(B*.075,D*.19,L*.035),red,[0,-D*.58,-L*.487]);
    // Corrugated paint makes individual containers legible from the deck and far aerial views.
    const palette=o.palette??[0x9c5246,0x416574,0x9a8970,0x3d736e,0x65747a];
    const corrugation=canvasTexture(128,128,ctx=>{ctx.fillStyle='#aaaaaa';ctx.fillRect(0,0,128,128);for(let x=0;x<128;x+=12){ctx.fillStyle='#888888';ctx.fillRect(x,0,3,128);ctx.fillStyle='#cccccc';ctx.fillRect(x+3,0,2,128);}ctx.strokeStyle='#555';ctx.lineWidth=3;ctx.strokeRect(1,1,126,126);});
    const mats=palette.map(c=>new THREE.MeshStandardMaterial({color:c,map:corrugation,roughness:.58,metalness:.2}));
    const placements:{p:THREE.Vector3,c:number}[]=[]; const bay=13.0,col=2.75, cols=Math.floor(B*.82/col), bays=Math.floor(L*.64/bay);
    for(let iz=0;iz<bays;iz++)for(let ix=0;ix<cols;ix++){const h=Math.floor(3+r()*3); for(let iy=0;iy<h;iy++)if(r()<(o.containerFill??.85)) placements.push({p:new THREE.Vector3((ix-(cols-1)/2)*col,7.5+iy*2.7,-L*.31+iz*bay),c:Math.floor(r()*mats.length)});}
    const dummy=new THREE.Object3D();for(let k=0;k<mats.length;k++){const ps=placements.filter(p=>p.c===k); const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(2.44,2.59,12.2),mats[k],ps.length);ps.forEach((p,i)=>{dummy.position.copy(p.p);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.castShadow=true;inst.receiveShadow=true;this.add(inst);}
    this.deckhouse.position.set(0,6,L*.29);this.add(this.deckhouse);
    box(this.deckhouse,[B*.53,18,17],white,[0,9,0]); box(this.deckhouse,[B*.74,3.7,18],white,[0,20.7,-1]);box(this.deckhouse,[B*.8,.7,20],steel,[0,23,-1]);
    const glass=surface(0x172d34,.2,.65);for(let ix=-5;ix<=5;ix++)box(this.deckhouse,[B*.055,1.6,.1],glass,[ix*B*.062,21,-10.06]);
    for(let iy=0;iy<4;iy++)for(let ix=-3;ix<=3;ix++)box(this.deckhouse,[1.4,.8,.1],glow(0xe3cb92,.8),[ix*2.4,3+iy*3.2,-8.57]);
    box(this.deckhouse,[6,8,5],red,[B*.13,26,2]);box(this.deckhouse,[6.3,1,5.3],steel,[B*.13,30,2]);rod(this.deckhouse,[-7,23,-3],[-7,35,-3],.24,white);rod(this.deckhouse,[-12,32,-3],[-2,32,-3],.15,white);
    // Continuous bulwarks and upright stanchions.
    for(const side of [-1,1]){rod(this,[side*B*.49,7,-L*.34],[side*B*.49,7,L*.4],.13,white);for(let z=-L*.34;z<L*.41;z+=7)rod(this,[side*B*.49,5.9,z],[side*B*.49,7,z],.08,white);}
    if(o.deckLights!==false){const lamp=glow(0xffdfad,3);for(const z of [-L*.26,-L*.08,L*.09,L*.25])for(const side of [-1,1]){rod(this,[side*B*.44,6,z],[side*B*.44,22,z],.13,steel);box(this,[1.5,.6,1],lamp,[side*B*.44,22,z]);}}
    if(o.navLights!==false){box(this.deckhouse,[.7,.5,.7],glow(0x39ff77,2),[-B*.38,22,0]);box(this.deckhouse,[.7,.5,.7],glow(0xff392e,2),[B*.38,22,0]);}
    // Bronze skewed five-blade screw with polished leading ridges and shaft, suitable for underwater close views.
    this.propeller.position.set(0,-D*.55,L*.46);this.add(this.propeller);const bronze=surface(0xb79a52,.29,.83);
    solid(this.propeller,new THREE.SphereGeometry(1,28,18).scale(D*.11,D*.11,D*.19),bronze);
    for(let i=0;i<5;i++){const blade=new THREE.Group();blade.rotation.z=i*Math.PI*2/5;this.propeller.add(blade);
      const sh=new THREE.Shape();sh.moveTo(-.65,.45);sh.bezierCurveTo(-1.6,2.6,-.8,4.4,.65,4.8);sh.bezierCurveTo(2.4,4.8,3.2,3.6,1.5,2.4);sh.bezierCurveTo(.55,1.7,.7,.9,.55,.45);sh.closePath();
      const g=new THREE.ExtrudeGeometry(sh,{depth:.22,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.12,bevelThickness:.1,curveSegments:12});g.scale(D/13,D/13,D/13);const part=solid(blade,g,bronze);part.rotation.y=.35;
    }
    rod(this,[0,-D*.55,L*.38],[0,-D*.55,L*.463],D*.065,steel,18);
    box(this,[.7,D*.64,L*.038],red,[0,-D*.4,L*.488]);
  }
  update(t:number,s:ContainerShipState={}){this.propeller.rotation.z=t*(s.rpm??78)*Math.PI*2/60;this.rotation.x=s.pitch??0;}
}
