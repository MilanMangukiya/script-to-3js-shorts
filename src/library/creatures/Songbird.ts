import * as THREE from 'three';
import { rng, clamp } from '../util/math';

export interface SongbirdOptions {
  preset?:'white-crowned-sparrow'; length?:number; seed?:number; quality?:number;
}
export interface SongbirdPose { songEnvelope?:number; headTurn?:number; tailFlick?:number; }

/** Perched white-crowned sparrow facing +X, feet at local origin. Scale in metres.
 * Bold adult crown bands, grey breast, orange bill, streaked brown wings and two wing bars.
 */
export class Songbird extends THREE.Group {
  readonly head=new THREE.Group(); private jaw=new THREE.Group();private throat:THREE.Mesh;
  private tail=new THREE.Group();private torso:THREE.Mesh;
  constructor(o:SongbirdOptions={}){
    super();this.scale.setScalar((o.length??.16)/1.14);const r=rng(o.seed??271);
    const grey=new THREE.MeshStandardMaterial({color:0xb6b6ac,roughness:.83});
    const breast=new THREE.MeshStandardMaterial({color:0xc0c0b6,roughness:.88});
    const brown=new THREE.MeshStandardMaterial({color:0x806349,roughness:.83});
    const tan=new THREE.MeshStandardMaterial({color:0xb69d7b,roughness:.87});
    const dark=new THREE.MeshStandardMaterial({color:0x342e29,roughness:.88});
    const white=new THREE.MeshStandardMaterial({color:0xe4e3d8,roughness:.85});
    const black=new THREE.MeshStandardMaterial({color:0x181b1b,roughness:.77});
    const bill=new THREE.MeshPhysicalMaterial({color:0xdca87c,roughness:.38,clearcoat:.17});
    const legMat=new THREE.MeshStandardMaterial({color:0x93745c,roughness:.7});
    // Fine overlapping feather vanes, generated once as a repeatable bump texture.
    const featherCanvas=document.createElement('canvas');featherCanvas.width=512;featherCanvas.height=512;const fc=featherCanvas.getContext('2d')!;
    fc.fillStyle='#808080';fc.fillRect(0,0,512,512);const fr=rng((o.seed??271)+45);
    for(let row=0;row<19;row++)for(let col=0;col<17;col++){
      const x=col*32+(row%2)*16,y=row*29;fc.strokeStyle='rgba(45,45,45,.22)';fc.lineWidth=1;
      fc.beginPath();fc.moveTo(x-13,y);fc.quadraticCurveTo(x-11,y+19,x,y+31);fc.quadraticCurveTo(x+11,y+19,x+13,y);fc.stroke();
      for(let j=0;j<12;j++){const yy=y+j*2.0;fc.strokeStyle=`rgba(${fr()>.5?'192,192,192':'64,64,64'},.22)`;fc.beginPath();fc.moveTo(x,yy+4);fc.lineTo(x-12+j*.3,yy-3);fc.moveTo(x,yy+4);fc.lineTo(x+12-j*.3,yy-3);fc.stroke();}
    }
    const plumage=new THREE.CanvasTexture(featherCanvas);plumage.wrapS=plumage.wrapT=THREE.RepeatWrapping;
    const dc=document.createElement('canvas');dc.width=512;dc.height=512;const dx=dc.getContext('2d')!,pixels=fc.getImageData(0,0,512,512);
    for(let i=0;i<pixels.data.length;i+=4){const g=THREE.MathUtils.clamp((pixels.data[i]-128)*3.7+232,130,255);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=g;}
    dx.putImageData(pixels,0,0);const diffuseFeathers=new THREE.CanvasTexture(dc);diffuseFeathers.colorSpace=THREE.SRGBColorSpace;
    for(const m of [grey,breast,brown,tan,dark,white]){m.bumpMap=plumage;m.bumpScale=.007;m.map=diffuseFeathers;}
    const sphere=new THREE.SphereGeometry(1,26,20);
    const ell=(p:THREE.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material)=>{const a=new THREE.Mesh(sphere,m);a.position.set(x,y,z);a.scale.set(sx,sy,sz);p.add(a);return a;};
    this.torso=ell(this,-.10,.38,0,.285,.307,.196,breast);this.torso.rotation.z=-.33;
    ell(this,-.19,.43,-.006,.238,.22,.166,brown).rotation.z=-.40;
    this.head.position.set(.143,.651,0);this.add(this.head);
    ell(this.head,0,0,0,.200,.209,.170,grey);
    this.throat=ell(this.head,.035,-.102,0,.105,.125,.128,breast);
    this.throat.visible=false;
    // Crown bands are curved patches following the skull, running from forehead to nape.
    const patch=(z0:number,z1:number,mat:THREE.Material)=>{
      const positions:number[]=[],indices:number[]=[],nx=30,nz=8;
      for(let i=0;i<=nx;i++){const theta=-1.29+i/nx*2.57;
        for(let j=0;j<=nz;j++){const z=z0+(z1-z0)*j/nz;const rr=Math.sqrt(Math.max(.001,1-z*z/.170**2));positions.push(Math.sin(theta)*.202*rr,Math.cos(theta)*.212*rr,z);}}
      for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=i*(nz+1)+j,b=a+nz+1;indices.push(a,a+1,b,b,a+1,b+1);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);this.head.add(m);
    };
    // Central white crown, black lateral crown stripes, white superciliary lines.
    patch(-.035,.035,white);patch(.035,.087,black);patch(-.087,-.035,black);patch(.087,.126,white);patch(-.126,-.087,white);
    for(const side of [-1,1]){
      const eye=ell(this.head,.082,.003,side*.153,.021,.023,.011,new THREE.MeshPhysicalMaterial({color:0x040606,roughness:.025,clearcoat:1}));
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.023,.0022,8,28),new THREE.MeshStandardMaterial({color:0x756d5a,roughness:.7}));ring.position.copy(eye.position);ring.position.z=side*.16;this.head.add(ring);
      ell(this.head,.088,.011,side*.165,.0038,.0038,.002,new THREE.MeshBasicMaterial({color:0xf5f2dc}));
      // Lores taper subtly to the upper mandible.
      ell(this.head,.143,-.014,side*.095,.054,.016,.01,grey).rotation.z=-.15;
    }
    // Broad, conical seed bill, sculpted upper and hinged lower mandibles.
    const beak=(upper:boolean)=>{
      const verts=new Float32Array([.158,-.029,-.059,.158,-.029,.059,.322,-.065,0,.169,upper?.021:-.081,0]);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(verts,3));g.setIndex([0,2,1,0,3,2,1,2,3,0,1,3]);g.computeVertexNormals();return new THREE.Mesh(g,bill);
    };
    this.head.add(beak(true));this.jaw.position.set(.158,-.029,0);const lower=beak(false);lower.position.set(-.158,.029,0);this.jaw.add(lower);this.head.add(this.jaw);
    for(const side of [-1,1])ell(this.head,.184,-.013,side*.043,.010,.004,.002,black);
    // Layered wing coverts and long primaries form a compact natural folded wing.
    for(const side of [-1,1]){
      const wing=ell(this,-.18,.40,side*.16,.225,.169,.053,brown);wing.rotation.z=.39;
      for(let row=0;row<3;row++)for(let j=0;j<7;j++){
        const x=-.01-j*.049-row*.026,y=.51-row*.066-j*.018,z=side*(.184+Math.sin(j/6*Math.PI)*.015);
        const edge=ell(this,x,y,z,.063,.022,.012,tan);edge.rotation.z=.31;
        const core=ell(this,x+.001,y+.001,z+side*.006,.052,.014,.008,j%3===0?brown:dark);core.rotation.z=.31;
      }
      for(let i=0;i<7;i++){const f=ell(this,-.29-i*.017,.268-i*.008,side*(.159+i*.006),.155,.016,.008,dark);f.rotation.z=.40+i*.035;const rim=ell(this,-.29-i*.017,.280-i*.008,side*(.16+i*.006),.141,.004,.009,tan);rim.rotation.z=.40+i*.035;}
      for(let row=0;row<2;row++)for(let i=0;i<7;i++){
        const f=ell(this,-.059-i*.027-row*.047,.442-row*.084-i*.013,side*.212,.021,.007,.003,white);f.rotation.z=.43;
      }
    }
    // Fine chest feather tips catch the low sun. Narrow enough to read as plumage.
    this.tail.position.set(-.31,.213,0);this.add(this.tail);
    for(let i=0;i<7;i++){const x=-.169-Math.abs(i-3)*.006,z=(i-3)*.020;const f=ell(this.tail,x,-.050,z,.206,.013,.014,i===0||i===6?tan:dark);f.rotation.z=.23;f.rotation.y=(i-3)*.023;}
    // Slim scaly tarsi with three forward toes and a rear gripping toe.
    const tube=(pts:THREE.Vector3[],radius:number,mat:THREE.Material)=>new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),14,radius,6,false),mat);
    for(const side of [-1,1]){
      const z=side*.065;this.add(tube([new THREE.Vector3(-.05,.20,z),new THREE.Vector3(-.005,.103,z),new THREE.Vector3(.018,.025,z)],.008,legMat));
      for(let i=0;i<3;i++)this.add(tube([new THREE.Vector3(.018,.028,z),new THREE.Vector3(.079,.006,z+(i-1)*.025),new THREE.Vector3(.077,-.014,z+(i-1)*.034)],.004,legMat));
      this.add(tube([new THREE.Vector3(.018,.025,z),new THREE.Vector3(-.042,.018,z),new THREE.Vector3(-.057,-.012,z)],.004,legMat));
      for(let i=0;i<5;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.009,.0014,5,10),tan);ring.rotation.x=Math.PI/2;ring.position.set(.003+i*.002,.056+i*.01,z);this.add(ring);}
    }
  }
  update(time_s:number,p:SongbirdPose={}){
    const song=clamp(p.songEnvelope??0),gape=song*(.27+.15*Math.sin(time_s*43)**2);
    this.jaw.rotation.z=-gape;this.head.rotation.y=p.headTurn??Math.sin(time_s*.8)*.10;this.head.rotation.z=.03+song*.08;
    this.throat.scale.y=.125*(1+.045*song*Math.sin(time_s*49));
    this.tail.rotation.z=(p.tailFlick??0)*.23+.018*Math.sin(time_s*1.8);
    this.torso.scale.y=.307*(1+.006*Math.sin(time_s*4));
  }
}
