import * as THREE from 'three';
import { surface,glow,solid,box,rod,canvasTexture,screen } from '../util/Modeling';
import { mug } from './RoomBox';
import { DialGauge } from '../props/DialGauge';

export interface ShipBridgeOptions {width?:number;autopilotHeading?:number;practicalWarmth?:THREE.ColorRepresentation;nightMode?:boolean;}
/** Merchant bridge, metres, empty chair at origin facing -Z; windows at -2.5 and navigation instruments live. */
export class ShipBridge extends THREE.Group {
  readonly gauge:DialGauge;private radar:THREE.CanvasTexture;private heading:number;
  constructor(o:ShipBridgeOptions={}){super();const w=o.width??10;this.heading=o.autopilotHeading??72;
    const shell=surface(0x64777e,.7,.12),dark=surface(0x162329,.7),rubber=surface(0x26373b,.9),chrome=surface(0xb4bfbd,.35,.7),seat=surface(0x273036,.95);
    box(this,[w,.16,9],rubber,[0,-.09,1]);box(this,[w,.14,8.5],shell,[0,3.5,.5]);for(const x of [-w/2,w/2])box(this,[.16,3.5,8.5],shell,[x,1.75,.5]);
    box(this,[w,1.0,.18],shell,[0,.5,-2.5]);box(this,[w,.3,.22],shell,[0,3.36,-2.5]);
    for(let x=-w/2;x<=w/2;x+=1.66){const p=box(this,[.09,2.3,.13],shell,[x,2.12,-2.5]);p.rotation.x=-.10;}
    const glass=new THREE.MeshPhysicalMaterial({color:0x8cabaf,roughness:.1,transparent:true,opacity:.028,metalness:.3,depthWrite:false});solid(this,new THREE.PlaneGeometry(w,2.2),glass,[0,2.15,-2.54]);
    for(let x=-4.1;x<4.2;x+=1.1){rod(this,[x,1.35,-2.44],[x+.14,2.45,-2.42],.016,dark);rod(this,[x+.14,2.45,-2.42],[x+.65,2.45,-2.42],.023,dark);}
    const console=new THREE.Group();console.position.set(0,.96,-1.58);console.rotation.x=-.48;this.add(console);box(this,[7.6,.85,1.1],shell,[0,.48,-1.65]);box(console,[7.8,.88,.13],dark);
    this.radar=canvasTexture(512,512,c=>this.drawRadar(c,0));screen(console,.72,.72,this.radar,[-1.18,0,.1]);
    const chart=canvasTexture(600,440,c=>{c.fillStyle='#102a35';c.fillRect(0,0,600,440);c.strokeStyle='#284657';c.lineWidth=1;for(let x=0;x<600;x+=60){c.beginPath();c.moveTo(x,0);c.lineTo(x,440);c.stroke();}for(let y=0;y<440;y+=55){c.beginPath();c.moveTo(0,y);c.lineTo(600,y);c.stroke();}c.fillStyle='#566659';c.beginPath();c.moveTo(0,0);c.lineTo(180,0);c.lineTo(240,70);c.lineTo(165,125);c.lineTo(175,200);c.lineTo(80,240);c.lineTo(0,350);c.fill();c.strokeStyle='#cfb978';c.lineWidth=3;c.beginPath();c.moveTo(310,395);c.lineTo(370,290);c.lineTo(490,160);c.stroke();c.fillStyle='#d1d6bf';c.font='20px monospace';c.fillText('NORTH ATLANTIC',278,35);c.fillText('ROUTE ACTIVE',285,410);});screen(console,1.03,.72,chart,[.08,0,.1]);
    const auto=canvasTexture(512,256,c=>{c.fillStyle='#10241f';c.fillRect(0,0,512,256);c.fillStyle='#b8c88b';c.font='26px monospace';c.fillText('AUTOPILOT  /  ENGAGED',25,48);c.font='bold 71px monospace';c.fillText(`HDG ${String(this.heading).padStart(3,'0')}°`,25,140);c.font='24px monospace';c.fillText('COURSE HOLD        78 RPM',25,210);});screen(console,.92,.46,auto,[1.43,.1,.11]);
    this.gauge=new DialGauge({radius:.105,min:0,max:120,majorStep:20,minorStep:5,labelStep:20,title:'MAIN ENGINE',unit:'RPM',bezel:'black',faceColor:'#182a2c',inkColor:'#bdc4ac',needleColor:0xd9a860});this.gauge.group.position.set(-2.06,.05,.13);console.add(this.gauge.group);
    const green=glow(0x70b690,.65),amber=glow(0xbb8d47,.7);for(let i=0;i<27;i++){solid(console,new THREE.CylinderGeometry(.022,.022,.013,8).rotateX(Math.PI/2),i%3?green:amber,[-3.35+(i%9)*.105,-.13+Math.floor(i/9)*.12,.095]);}
    for(const x of [2.4,2.8]){box(console,[.25,.5,.09],shell,[x,0,.1]);rod(console,[x,-.16,.18],[x,-.02,.35],.025,chrome);solid(console,new THREE.SphereGeometry(.055,14,10),dark,[x,-.02,.35]);}
    // Empty helm seat, adjustable pedestal, arms, and the unworn jacket left on its back.
    solid(this,new THREE.CylinderGeometry(.3,.36,.07,24),chrome,[.62,.05,.35]);rod(this,[.62,.07,.35],[.62,.79,.35],.07,chrome);
    box(this,[.61,.17,.62],seat,[.62,.86,.3]);const back=box(this,[.62,.73,.16],seat,[.62,1.22,.58]);back.rotation.x=-.07;
    for(const x of [.24,1.0]){rod(this,[x,.86,.36],[x,1.09,.3],.025,chrome);box(this,[.1,.06,.52],seat,[x,1.12,.24]);}
    const jacket=solid(this,new THREE.PlaneGeometry(.55,.65,12,16),new THREE.MeshStandardMaterial({color:0x746d58,roughness:1,side:THREE.DoubleSide}),[.62,1.23,.685]);const p=jacket.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*35)*.028+Math.sin(p.getY(i)*20)*.015);jacket.geometry.computeVertexNormals();
    mug(this,[-2.25,1.09,-1.32],0xa9a9a0);rod(this,[-4,1.06,1.2],[4,1.06,1.2],.025,chrome);
    for(const x of [-4,4]){box(this,[.28,.08,.1],glow(0xcf4934,.8),[x,.3,-.7]);const red=new THREE.PointLight(0xe55534,2.0,6,2);red.position.set(x,.45,-.7);this.add(red);}
    const screenLight=new THREE.PointLight(0x84beae,2.3,6,2);screenLight.position.set(-.5,1.5,-.9);this.add(screenLight);
    const overhead=box(this,[5.8,.5,.6],dark,[0,3.1,-1.9]);for(let x=-2.6;x<2.7;x+=.3)box(this,[.12,.09,.02],glow(x<0?0xb99455:0x749c80,.7),[x,3.05,-1.59]);
  }
  private drawRadar(c:CanvasRenderingContext2D,t:number){c.fillStyle='#041914';c.fillRect(0,0,512,512);c.strokeStyle='#315e44';c.lineWidth=2;for(const r of [50,100,150,205]){c.beginPath();c.arc(256,256,r,0,Math.PI*2);c.stroke();}for(let a=0;a<Math.PI*2;a+=Math.PI/6){c.beginPath();c.moveTo(256,256);c.lineTo(256+Math.cos(a)*209,256+Math.sin(a)*209);c.stroke();}const a=t*Math.PI*2/2.5;for(let i=0;i<30;i++){c.strokeStyle=`rgba(129,206,142,${.5*(1-i/30)})`;c.beginPath();c.moveTo(256,256);c.lineTo(256+Math.cos(a-i*.012)*205,256+Math.sin(a-i*.012)*205);c.stroke();}c.fillStyle='#b0d4a0';for(const p of [[150,120],[395,307],[130,335]]){c.beginPath();c.arc(p[0],p[1],4,0,6.3);c.fill();}c.font='20px monospace';c.fillText('RADAR  12 NM',20,30);}
  update(t:number){this.drawRadar((this.radar.image as HTMLCanvasElement).getContext('2d')!,t);this.radar.needsUpdate=true;this.gauge.value=78+.3*Math.sin(t*.4*Math.PI*2);}
}
