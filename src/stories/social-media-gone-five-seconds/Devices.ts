import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box,solid,surface,canvasTexture } from '../../library/util/Modeling';
export type DeviceState='creator'|'feed'|'inbox'|'messages'|'sms'|'sent'|'reply'|'chat';
export class Device {
 group=new THREE.Group();display:THREE.Mesh;states=new Map<DeviceState,THREE.CanvasTexture>();
 constructor(public w=.096,public h=.18){
  solid(this.group,new RoundedBoxGeometry(w,h,.014,3,.007),surface(0x111923,.3,.35));
  this.display=solid(this.group,new THREE.PlaneGeometry(w-.012,h-.018),new THREE.MeshBasicMaterial({toneMapped:false}),[0,0,.0075]);
  box(this.group,[w*.30,.004,.002],surface(0x131b22),[0,h/2-.009,.0085]);
  for(const state of ['creator','feed','inbox','messages','sms','sent','reply','chat'] as DeviceState[]){
   this.states.set(state,canvasTexture(640,1120,c=>{
    c.fillStyle='#eaf0f2';c.fillRect(0,0,640,1120);c.textAlign='left';c.fillStyle='#172933';c.font='700 37px Inter';c.fillText('2026',34,65);
    for(let i=0;i<4;i++){c.fillStyle='#31a998';c.fillRect(502+i*22,65-(i+1)*8,14,(i+1)*8);}c.font='600 26px Inter';c.fillText('DATA ON',446,110);
    c.textAlign='center';c.font='800 64px Inter';
    const titles={creator:'STREAM LOST',feed:'EMPTY FEED',inbox:'NO INBOX',messages:'NO MESSAGES',sms:'SMS',sent:'SMS',reply:'NOT SENT',chat:'CHAT GONE'};c.fillText(titles[state],320,230);
    if(state==='sms'||state==='sent'){
     c.font='600 34px Inter';c.fillText('Ordinary text',320,310);c.fillStyle=state==='sent'?'#25896e':'#c9d8df';c.beginPath();c.roundRect(72,430,496,190,22);c.fill();c.fillStyle=state==='sent'?'#ffffff':'#172933';c.font='700 42px Inter';c.fillText('Happy birthday!',320,510);c.font='600 31px Inter';c.fillText(state==='sent'?'SENT':'READY TO SEND',320,570);
     c.fillStyle='#25896e';c.beginPath();c.roundRect(80,830,480,112,20);c.fill();c.fillStyle='white';c.font='800 44px Inter';c.fillText(state==='sent'?'SENT':'SEND SMS',320,902);
    }else{
     c.font='600 34px Inter';c.fillStyle='#5c6d75';c.fillText('Social apps unavailable',320,330);
     for(let j=0;j<2;j++)for(let i=0;i<3;i++){c.strokeStyle='#bbc8ce';c.lineWidth=5;c.beginPath();c.roundRect(82+i*170,440+j*165,132,132,22);c.stroke();}
     c.fillStyle='#9cabb3';c.font='600 35px Inter';c.fillText('No social connection',320,840);
     if(state==='messages'){c.fillStyle='#25896e';c.beginPath();c.roundRect(100,922,440,105,18);c.fill();c.fillStyle='white';c.font='800 43px Inter';c.fillText('OPEN SMS',320,992);}
    }
   }));
  }this.set('feed');
 }
 set(state:DeviceState){(this.display.material as THREE.MeshBasicMaterial).map=this.states.get(state)!;}
 point(x:number,y:number,z=.008){return this.group.localToWorld(new THREE.Vector3(x,y,z));}
}
