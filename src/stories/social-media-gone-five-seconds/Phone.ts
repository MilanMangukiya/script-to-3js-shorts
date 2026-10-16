import * as THREE from 'three';
import { surface,solid,box,canvasTexture } from '../../library/util/Modeling';
export type Mode='draft'|'empty'|'camera'|'sms'|'restored';
/** Story-local metre-scale phone; original UI is displayed on a physical glass surface. */
export class Phone {
 readonly group=new THREE.Group();readonly glass:THREE.Mesh;readonly preview:THREE.Mesh;readonly textures:Record<Mode,THREE.Texture>;
 readonly supportVertices:THREE.Vector3[]=[];
 constructor(preview:THREE.Texture){
  const w=.086,h=.172,r=.010,s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  const geo=new THREE.ExtrudeGeometry(s,{depth:.009,bevelEnabled:true,bevelSize:.0017,bevelThickness:.0015,bevelSegments:3,steps:1,curveSegments:8});geo.translate(0,0,-.0045);solid(this.group,geo,surface(0x182d37,.3,.45));
  box(this.group,[.009,.025,.002],surface(0x546c75,.25,.6),[-.026,.057,-.007]);
  solid(this.group,new THREE.CircleGeometry(.004,18),new THREE.MeshBasicMaterial({color:0x030e16}),[-.026,.060,-.008]).rotation.y=Math.PI;
  this.textures=Object.fromEntries(['draft','empty','camera','sms','restored'].map(k=>[k,this.ui(k as Mode)])) as Record<Mode,THREE.Texture>;
  this.glass=solid(this.group,new THREE.PlaneGeometry(.078,.156),new THREE.MeshBasicMaterial({map:this.textures.draft}),[0,0,.0065]);this.glass.castShadow=false;
  this.preview=solid(this.group,new THREE.PlaneGeometry(.070,.084),new THREE.MeshBasicMaterial({map:preview}),[0,.002,.007]);this.preview.castShadow=false;
  box(this.group,[.021,.004,.001],surface(0x030a12),[0,.072,.0075]);
  this.group.updateMatrixWorld(true);this.group.traverse(o=>{if(o instanceof THREE.Mesh){const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++)this.supportVertices.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));}});
 }
 minY(q:THREE.Quaternion){let y=Infinity;for(const p of this.supportVertices)y=Math.min(y,p.clone().applyQuaternion(q).y);return y;}
 ui(mode:Mode){return canvasTexture(512,1024,c=>{
  c.fillStyle='#edf1ef';c.fillRect(0,0,512,1024);c.textAlign='center';c.textBaseline='middle';
  c.fillStyle='#152d37';c.font='700 44px Inter';c.fillText('2026',256,68);c.font='700 52px Inter';c.fillText(mode==='sms'?'SMS':mode==='camera'?'CAMERA':mode==='draft'||mode==='restored'?'YOUR DRAFT':'HOME',256,160);
  if(mode==='empty'){
   c.fillStyle='#37545d';c.font='600 38px Inter';c.fillText('Social',256,258);
   c.strokeStyle='#bac9c3';c.lineWidth=5;for(let i=0;i<6;i++){const x=130+(i%3)*126,y=354+Math.floor(i/3)*158;c.beginPath();c.roundRect(x-43,y-43,86,86,18);c.stroke();}
   c.font='700 31px Inter';for(const [x,label,color]of[[125,'CAMERA','#345e78'],[387,'SMS','#49816d']] as const){c.fillStyle=color;c.beginPath();c.roundRect(x-64,730,128,96,18);c.fill();c.fillStyle='#fff';c.fillText(label,x,778);}
  }else if(mode==='sms'){
   c.fillStyle='#316553';c.beginPath();c.roundRect(62,330,388,185,27);c.fill();c.fillStyle='#fff';c.font='600 45px Inter';c.fillText('Still here.',256,400);c.font='600 35px Inter';c.fillText('SENT',350,478);c.fillStyle='#526d66';c.font='500 31px Inter';c.fillText('Carrier SMS',256,606);
  }else if(mode==='camera'){
   c.strokeStyle='#344c56';c.lineWidth=11;c.beginPath();c.arc(256,885,48,0,Math.PI*2);c.stroke();c.fillStyle='#516971';c.font='600 32px Inter';c.fillText('PHOTO',256,964);
   c.fillStyle='#49816d';c.beginPath();c.roundRect(378,930,100,60,12);c.fill();c.fillStyle='#fff';c.font='700 24px Inter';c.fillText('SMS',428,960);
  }else{
   c.fillStyle='#d7e4df';c.fillRect(42,255,428,435);c.fillStyle='#254f55';c.font='600 40px Inter';c.fillText('Coffee break.',256,375);c.font='500 30px Inter';c.fillText('Not posted',256,450);
   c.fillStyle='#3d7d92';c.beginPath();c.roundRect(70,790,372,110,24);c.fill();c.fillStyle='#fff';c.font='700 52px Inter';c.fillText('POST',256,845);
   for(let i=0;i<4;i++){c.fillStyle=['#508cc0','#cf6d63','#8f79b7','#4c9d85'][i];c.beginPath();c.arc(130+i*84,630,25,0,Math.PI*2);c.fill();}
  }
 });}
 setMode(mode:Mode){(this.glass.material as THREE.MeshBasicMaterial).map=this.textures[mode];this.preview.visible=mode==='camera';}
}
