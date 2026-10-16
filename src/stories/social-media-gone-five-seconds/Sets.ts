import * as THREE from 'three';
import { RoomBox,table,chair,plant,tableLamp } from '../../library/environment/RoomBox';
import { CityStreet } from '../../library/environment/CityStreet';
import { Humanoid } from '../../library/characters/Humanoid';
import { box,solid,rod,surface,canvasTexture,screen,glow } from '../../library/util/Modeling';
import { Device } from './Devices';
import { type City } from './timeline';
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z),H=.7875;
export function features(p:Humanoid){const dark=surface(0x20242b);for(const x of [-.033,.033])solid(p.head,new THREE.SphereGeometry(.006,8,6),dark,[x,.13,.104]);solid(p.head,new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V(-.022,.08,.103),V(0,.068,.110),V(.022,.08,.103)),10,.0025,5),dark);}
export function makeGame(room:THREE.Group){
 const rt=new THREE.WebGLRenderTarget(640,360,{type:THREE.HalfFloatType}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,640/360,.02,30);scene.background=new THREE.Color(0x122540);camera.position.set(1.3,1.75,2.4);camera.lookAt(0,.25,.2);
 box(scene,[2.4,.06,3.4],surface(0x3c6573),[0,-.03,0]);for(const x of [-1.1,1.1])box(scene,[.10,.35,3.2],surface(0x8595a0),[x,.15,0]);for(const z of [-1.4,-.7,0,.7,1.4])box(scene,[2.2,.003,.015],glow(0x62a9b1,.3),[0,.005,z]);
 const actor=new Humanoid({height:.52,coat:'jacket',coatColor:0xffdd68,scarfColor:null});scene.add(actor.root);box(scene,[.28,.27,.22],surface(0xab5059),[-.20,.135,-1.3]);const hazard=solid(scene,new THREE.SphereGeometry(.075,12,10),glow(0xff796d,1),[-.20,.24,-1.2]);
 const light=new THREE.DirectionalLight(0xffffff,2.8);light.position.set(2,4,2);scene.add(light,new THREE.HemisphereLight(0xafdbef,0x52636a,2));
 const monitor=new THREE.Group();room.add(monitor);monitor.position.set(-.10,1.14,-.96);monitor.rotation.y=Math.PI;screen(monitor,.76,.43,rt.texture,[0,0,0]);rod(room,[-.10,H,-.96],[-.10,.93,-.96],.021,surface(0x293744));
 return{rt,scene,camera,actor,hazard};
}
export function makeSet(scene:THREE.Scene,person:Humanoid,city:City){
 let device=new Device(),customer:Humanoid|undefined,customerFinger:THREE.Mesh|undefined,controller:THREE.Group|undefined,game:ReturnType<typeof makeGame>|undefined;const food:THREE.Vector3[]=[];
 const colors={tokyo:0x223147,london:0x6b8090,lagos:0xc9956a,sao:0x445070,mumbai:0x8e7358,nyc:0x667d88};
 const room=new RoomBox({width:5,depth:5,height:3.2,wallColor:colors[city],floorColor:0x675a49,ceiling:false});scene.add(room);person.root.position.set(0,0,-1.7);
 if(city==='tokyo'){
  room.children[1].visible=room.children[2].visible=room.children[3].visible=false;
  const skyline=new CityStreet({seed:2726,blocks:2,vehicles:0,storeysMin:5,storeysMax:10,farFieldRadius:85,lights:true});skyline.group.position.set(0,-11,-30);scene.add(skyline.group);box(room,[5,.8,.12],surface(0x24313d),[0,.4,-3]);
  const metal=surface(0x202a35,.35,.65);device.group.position.set(.38,1.31,-.48);rod(room,[.38,.03,-.48],[.38,1.27,-.48],.016,metal);for(const x of [-.22,.22])rod(room,[.38,.34,-.48],[.38+x,.015,-.30],.014,metal);
  solid(room,new THREE.TorusGeometry(.19,.014,8,44),glow(0xf1deda,.3),[.38,1.31,-.52]);const fill=new THREE.PointLight(0xffb6dc,1.4,5);fill.position.set(.3,1.5,-.5);scene.add(fill);person.root.position.set(-.08,0,-1.55);
 }else if(city==='london'){
  const sign=canvasTexture(768,256,c=>{c.fillStyle='#1b3443';c.fillRect(0,0,768,256);c.fillStyle='#f3f1df';c.font='700 78px Inter';c.textAlign='center';c.fillText('PLATFORM 2',384,155);});screen(room,1.3,.43,sign,[.4,2.0,-4.9]);
  for(const x of [-1.8,1.8])rod(room,[x,0,-3],[x,2.7,-3],.045,surface(0xadb5b6,.4,.5));box(room,[4,.8,.18],surface(0x2e4653),[0,.7,-3.9]);for(const x of [-1.3,0,1.3])box(room,[.9,.7,.03],surface(0x91b6c1,.3),[x,1.5,-3.78]);
 }else if(city==='lagos'){
  person.root.position.x=-.3;room.children[2].visible=room.children[3].visible=false;table(room,0,-1.12,1.75,.65);for(const x of [-1,1])rod(room,[x,0,-1.2],[x,2.4,-1.2],.035,surface(0x6f5341));for(let i=0;i<8;i++)box(room,[.28,.05,1.8],surface(i%2?0xe0bd6a:0x447c68),[-.98+i*.28,2.45,-1.8]);
  box(room,[.62,.035,.29],surface(0xa8b0a7,.32,.5),[.35,H+.018,-1.1]);for(let i=0;i<5;i++){const p=V(.14+i*.105,H+.07,-1.1);solid(room,new THREE.SphereGeometry(.052,12,8).scale(1,.65,1),surface(0xbe743e),p.toArray() as [number,number,number]);food.push(p);}
  const menu=canvasTexture(512,256,c=>{c.fillStyle='#e8d2a0';c.fillRect(0,0,512,256);c.fillStyle='#365f4b';c.font='800 70px Inter';c.textAlign='center';c.fillText('HOT & READY',256,155);});screen(room,.85,.42,menu,[-.85,1.65,-4.9]);
  customer=new Humanoid({coat:'jacket',coatColor:0xc97f52,skinColor:0x906347,scarfColor:null});features(customer);customer.root.position.set(.75,0,-.55);customer.root.rotation.y=-2.3;scene.add(customer.root);customerFinger=solid(customer.handR,new THREE.CapsuleGeometry(.007,.048,4,8),surface(0x906347));
 }else if(city==='sao'){
  chair(room,0,-1.75,0,0x43505b);table(room,.1,-.93,1.6,.72);person.root.position.z=-1.75;game=makeGame(room);device=new Device(.22,.35);device.group.position.set(.59,1.13,-.96);device.group.rotation.y=Math.PI;device.set('chat');rod(room,[.59,H,-.96],[.59,.96,-.96],.019,surface(0x283344));
  controller=new THREE.Group();box(controller,[.19,.045,.09],surface(0x192330,.5));for(const x of [-.065,.065])solid(controller,new THREE.SphereGeometry(.019,12,8),surface(0x677b9a),[x,.027,0]);controller.position.set(.02,.91,-1.32);scene.add(controller);box(room,[1.5,.022,.025],glow(0x7769bb,.7),[0,1.8,-4.85]);plant(room,[-1.8,0,-3.5],1.5);
 }else if(city==='mumbai'){
  const metal=surface(0x725b48);for(const x of [-1.7,-1.3,-.9,-.5,-.1,.3,.7,1.1,1.5])rod(room,[x,.5,-4.85],[x,2.8,-4.85],.013,metal);box(room,[3.6,2.5,.02],surface(0xd5c2a3),[0,1.6,-4.93]);plant(room,[1.6,0,-2.8],1.3);table(room,-1.4,-3.6,.7,.5);tableLamp(room,[-1.4,.79,-3.6],0xffc881,1.2);
 }else{
  chair(room,0,-1.75,0,0x4b565b);table(room,.1,-1.12,1.5,.76);person.root.position.z=-1.75;device=new Device(.23,.31);device.group.position.set(.13,1.08,-1.25);device.group.rotation.y=Math.PI;device.set('reply');rod(room,[.13,H,-1.24],[.13,.96,-1.24],.022,surface(0x2d3e47,.3,.6));box(room,[.22,.014,.16],surface(0x2d3e47),[.13,H+.007,-1.25]);
  plant(room,[1.6,0,-3.5],1.4);table(room,-1.5,-3.6,.7,.5);tableLamp(room,[-1.5,.79,-3.6],0xfad3a1,1.4);box(room,[2.0,1.2,.025],surface(0xbbced1),[.4,1.7,-4.87]);for(const x of [-.5,.4,1.3])box(room,[.035,1.3,.03],surface(0x485b66),[x,1.7,-4.82]);
 }
 scene.add(device.group);if(!['tokyo','sao','nyc'].includes(city)){device.group.position.set((city==='lagos'?-.3:0)+.17,1.21,-1.32);device.group.rotation.y=Math.PI;}
 const night=city==='tokyo';scene.background=new THREE.Color(night?0x101e39:city==='sao'?0x263451:0xa9b9b9);const key=new THREE.DirectionalLight(night?0x86bcff:0xffddaf,night?1.7:2.5);key.position.set(2.5,4,1);key.target.position.set(0,1,-1.4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});key.shadow.bias=-.0004;key.shadow.normalBias=.01;scene.add(key,key.target,new THREE.HemisphereLight(night?0x798dbd:0xc6d8dc,0x73634f,night?1:1.8));
 return{device,customer,customerFinger,controller,game,food};
}
