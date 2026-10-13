import * as THREE from 'three';
import type { Stage,ShotInfo } from '../../../library/render/FilmPipeline';
import { ApartmentFacade } from '../../../library/environment/ApartmentFacade';
import { ClinicInterior } from '../../../library/environment/ClinicInterior';
import { ShipBridge } from '../../../library/environment/ShipBridge';
import { table,chair,mug,plant,RoomBox } from '../../../library/environment/RoomBox';
import { Humanoid,POSE_STAND,POSE_SIT,HumanoidPose } from '../../../library/characters/Humanoid';
import { surface,glow,solid,box,rod,canvasTexture } from '../../../library/util/Modeling';
import { SkyDome } from '../../../library/environment/SkyDome';
import { Starfield } from '../../../library/space/Starfield';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { ContainerShip } from '../../../library/vehicles/ContainerShip';
import { smoothstep } from '../../../library/util/math';

const PEOPLE_COLORS=[0x76847c,0x9a7965,0x536b78,0x94785e,0x737481];
type Resident={person:Humanoid;pose:HumanoidPose;kind?:string;};
function figure(parent:THREE.Object3D,at:[number,number,number],angle:number,idx:number,height=1.65,seated=false):Resident{
  const p=new Humanoid({height,coat:'jacket',coatColor:PEOPLE_COLORS[idx%5],trouserColor:0x333941,skinColor:[0xc59775,0x906447,0xd6b39a][idx%3],hairColor:idx===2?0xaaa59b:0x342922,scarfColor:null});p.root.position.set(...at);p.root.rotation.y=angle;parent.add(p.root);
  const pose={...(seated?POSE_SIT:POSE_STAND),headPitch:seated?.15:.1,lean:seated?.18:.04};p.setPose(pose);return {person:p,pose};
}
function wallPicture(room:RoomBox){const tex=canvasTexture(256,192,c=>{c.fillStyle='#8f9b91';c.fillRect(0,0,256,192);c.fillStyle='#9c8470';c.fillRect(0,125,256,67);c.fillStyle='#575f50';c.beginPath();c.moveTo(0,130);c.lineTo(90,44);c.lineTo(175,135);c.fill();});box(room,[.9,.68,.045],surface(0x5a4635),[0,1.6,-3.1]);solid(room,new THREE.PlaneGeometry(.8,.58),new THREE.MeshBasicMaterial({map:tex}),[0,1.6,-3.068]);}

export class ApartmentStage implements Stage {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,9/16,.05,1000);private facade=new ApartmentFacade();private residents:Resident[]=[];private comfort?:Resident;private rocker?:Resident;private darkLamp?:THREE.PointLight;
  constructor(renderer:THREE.WebGLRenderer){this.scene.background=new THREE.Color(0x071320);this.scene.add(this.facade,new THREE.HemisphereLight(0x6b87ab,0x33281b,.68));const blue=new THREE.DirectionalLight(0x52729b,.9);blue.position.set(-18,22,15);this.scene.add(blue);
    const warm=new THREE.PointLight(0xffbc70,65,35,2);warm.position.set(-5,6,5);this.scene.add(warm);rod(this.scene,[-5,0,4],[-5,7,4],.08,surface(0x3d4445,.6,.5));box(this.scene,[.55,.12,.55],glow(0xfad39b,2),[-5,7,4]);
    for(const rec of this.facade.rooms){const {room,floor:f,column:c}=rec;wallPicture(room);if(f>2||Math.abs(c-2)>1)continue;
      const n=f*3+c-1;
      if(n===7){ // Central third-floor table for two, the emotional focus of the dolly.
        table(room,0,-1.25,1.05,.7);chair(room,-.7,-1.25,Math.PI/2);chair(room,.7,-1.25,-Math.PI/2);const woman=figure(room,[-.7,0,-1.25],Math.PI/2,0,1.63,true);woman.pose={...woman.pose,armL:[-.8,.1,1.2],armR:[-.8,.1,1.2],headPitch:.24};this.residents.push(woman);
        for(const x of [-.32,.32]){solid(room,new THREE.CylinderGeometry(.15,.15,.018,28),surface(0xd4c8ac,.3),[x,.801,-1.24]);mug(room,[x,.805,-1.49]);}plant(room,[1.2,0,-2.55],.9);
      }else if(n===0){ // A woman and girl lean together on a sofa.
        const sofa=surface(0x626f73,.95);box(room,[1.65,.32,.62],sofa,[0,.34,-1.75]);box(room,[1.7,.62,.2],sofa,[0,.62,-2.0]);for(const x of [-.89,.89])box(room,[.17,.47,.75],sofa,[x,.48,-1.75]);const a=figure(room,[-.35,0,-1.67],0,1,1.64,true),b=figure(room,[.23,.1,-1.66],0,3,1.18,true);b.pose={...b.pose,sideLean:.2,headPitch:.2};this.residents.push(a,b);
      }else if(n===1){ // Older resident, photograph turned toward her.
        const a=figure(room,[.25,0,-.65],-.55,2,1.58);a.pose={...a.pose,lean:.12,headPitch:.28,armL:[-.55,.12,1.3],armR:[-.65,.05,1.2]};this.residents.push(a);box(a.person.handL,[.18,.24,.015],surface(0x534239),[0,-.04,.02]);
      }else if(n===2){ // Kitchen embrace.
        box(room,[2.5,.85,.48],surface(0x8d8870),[0,.43,-2.7]);box(room,[2.5,.04,.55],surface(0xcbc1a5),[0,.88,-2.7]);const a=figure(room,[-.12,0,-1.3],.7,3),b=figure(room,[.2,0,-1.05],Math.PI+.7,4,1.6);a.pose={...a.pose,armL:[-1.05,.26,.5],armR:[-1.1,.15,.6]};b.pose={...b.pose,lean:.12,headPitch:.23,armL:[-1,.2,.5]};this.residents.push(a,b);
      }else if(n===3){ // Child's unworn coat and backpack remain on the hooks.
        box(room,[.9,2,.08],surface(0x756553),[.65,1,-3.08]);rod(room,[-1.1,1.4,-2.99],[-.2,1.4,-2.99],.025,surface(0x3a3630));const coat=solid(room,new THREE.CapsuleGeometry(.15,.37,4,12),surface(0x9c8768),[-.82,1.1,-2.9]);coat.scale.z=.45;rod(room,[-.93,1.33,-2.9],[-1.15,1.02,-2.9],.07,surface(0x9c8768));rod(room,[-.70,1.33,-2.9],[-.50,1.01,-2.9],.07,surface(0x9c8768));box(room,[.28,.4,.12],surface(0x7d6861),[-.25,1.06,-2.89]);
      }else if(n===4){ // Baby rocked by a nightlight.
        const a=figure(room,[0,0,-1.2],.1,1,1.64);a.pose={...a.pose,armL:[-.85,.12,1.7],armR:[-.75,.1,1.8],headPitch:.3};this.residents.push(a);this.rocker=a;const blanket=solid(a.person.root,new THREE.CapsuleGeometry(.105,.24,6,16).rotateZ(Math.PI/2),surface(0xccc4ab),[0,1.05,.21]);solid(a.person.root,new THREE.SphereGeometry(.062,14,10),surface(0xc0a087),[-.17,1.08,.21]);
      }else if(n===5){ // Empty bunk beds.
        const steel=surface(0x657277,.6,.25),linen=surface(0xa5aa95);for(const y of [.5,1.52]){box(room,[.92,.13,1.85],linen,[0,y,-1.65]);box(room,[.7,.12,.38],surface(0xd1c6ae),[0,y+.11,-2.22]);for(const x of [-.51,.51])rod(room,[x,y+.25,-2.5],[x,y+.25,-.8],.02,steel);}for(const x of [-.51,.51])for(const z of [-2.55,-.74])rod(room,[x,0,z],[x,1.85,z],.035,steel);for(let y=.15;y<1.7;y+=.25)rod(room,[.56,y,-1],[.56,y,-1.55],.02,steel);
      }else if(n===6){ // Three women gather; hand rests on a shoulder.
        table(room,0,-1.35,1.3,.65);for(const [i,x,z,a] of [[0,-.8,-1.3,1.57],[1,.8,-1.3,-1.57],[2,.1,-2,0]]){chair(room,x,z,a);const person=figure(room,[x,0,z],a,i,1.63,true);this.residents.push(person);if(i===2){this.comfort=person;person.pose={...person.pose,armL:[-.6,.5,1.1]};}}mug(room,[0,.79,-1.4]);
      }else{ // Teenager folded onto a stair landing.
        for(let j=0;j<4;j++)box(room,[1.55,.19,1.6-j*.25],surface(0x777468),[0,.09+j*.19,-2.3-j*.13]);const a=figure(room,[0,.35,-1.5],-.2,4,1.5,true);a.pose={...a.pose,lean:.4,headPitch:.25,legL:[1.9,2.0],legR:[1.9,2],armL:[-1.1,.1,1.5],armR:[-1.1,.1,1.5]};this.residents.push(a);
      }
    }
    this.darkLamp=this.facade.rooms.find(r=>r.floor===4&&r.column===2)?.lamp;
  }
  update(t:number,shot:ShotInfo){for(let i=0;i<this.residents.length;i++){const r=this.residents[i],pose={...r.pose,breath:Math.sin(t*Math.PI*.5+i)*.3,headYaw:r.pose.headYaw+Math.sin(t*.22+i)*.04};if(r===this.rocker)pose.sideLean=Math.sin(t*Math.PI*.5)*.035;if(r===this.comfort)pose.armL=[-.6-.35*smoothstep(28.1,28.7,t),.5,1.1];r.person.setPose(pose);}if(this.darkLamp)this.darkLamp.intensity=5*(1-smoothstep(30.1,30.3,t));}
}

export class ClinicStage implements Stage {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,9/16,.025,200);private clinic=new ClinicInterior();private people:Resident[]=[];private patients:Resident[]=[];
  constructor(renderer:THREE.WebGLRenderer){this.scene.background=new THREE.Color(0x344751);this.scene.add(this.clinic,new THREE.HemisphereLight(0xc4d7dd,0x607579,.95));
    const staffLocations:[[number,number,number],number][]=[[[.05,0,1.4],0],[[1.95,0,-1.0],-1.57],[[-2.0,0,1.1],1.57],[[-.75,0,-3.1],.6],[[.65,0,-6],0]];
    staffLocations.forEach(([p,a],i)=>{const h=new Humanoid({height:1.6+i*.035,coat:'jacket',coatColor:[0x3e7d81,0x3c596c,0xa1b3af,0x527b76,0x3c6578][i],trouserColor:[0x41666a,0x344955,0x637b7d][i%3],skinColor:[0x9c7156,0xc69d80,0x79513c][i%3],scarfColor:null,hairColor:0x272323});h.root.position.set(...p);h.root.rotation.y=a;this.clinic.add(h.root);this.people.push({person:h,pose:{...POSE_STAND}});
      // Subtle bun and identification patch convey staff attire at a respectful mid-distance.
      solid(h.head,new THREE.SphereGeometry(.055,12,8),surface(0x302825),[0,.13,-.10]);box(h.root,[.065,.09,.012],surface(0xd4d9c7),[.13,1.24,.15]);
      if(i===0){box(h.handL,[.19,.25,.017],surface(0x1d3039),[0,-.03,.025]);}
    });
    this.clinic.beds.forEach((bed,i)=>{const patient=figure(bed,[0,.8,-.35],Math.PI,i,1.58);patient.person.root.rotation.x=-Math.PI/2;patient.person.root.scale.multiplyScalar(.82);this.patients.push(patient);});
  }
  update(t:number,shot:ShotInfo){this.clinic.update(t);const dt=t-30.6,turn=smoothstep(32.3,32.9,t);this.people.forEach((r,i)=>{const p={...POSE_STAND,breath:Math.sin(t*1.5+i)*.3,headPitch:i===0?.25:.06};if(i===0){const gait=Math.sin(dt*6);p.legL=[gait*.26,.1+Math.max(0,-gait)*.35];p.legR=[-gait*.26,.1+Math.max(0,gait)*.35];p.armL=[-.8,.1,1.25];p.armR=[-.8,.1,1.15];r.person.root.position.set(.05+turn*1.75,0,1.4+Math.min(dt,1.8)*1.1);r.person.root.rotation.y=turn*Math.PI/2;}if(i===1)p.armL=[-1.9,.15,.55+Math.sin(dt*.9)*.08];if(i===3){p.armL=[-1.15,.15,.8];p.headPitch=.18;}if(i===4){p.armL=[-.9,.1,.3];p.armR=[-.9,.1,.3];r.person.root.position.z=-6+dt*.8;}r.person.setPose(p);});this.clinic.cart.position.set(.65,0,-5.15+dt*.8);this.patients.forEach((p,i)=>p.person.setPose({...POSE_STAND,breath:Math.sin(t*1.2+i)*.2}));}
}

export class BridgeStage implements Stage {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,9/16,.02,20000);private bridge=new ShipBridge();private ship=new ContainerShip({deckLights:true});private ocean:OceanSurface;private stars=new Starfield({count:1800,radius:9000,minY:.015,brightness:.75,maxSize:1.7});private sky:SkyDome;
  constructor(renderer:THREE.WebGLRenderer){this.sky=new SkyDome({zenithColor:0x060e1a,horizonColor:0x203c4d,groundColor:0x091019,sunIntensity:0,sunGlow:0,hazeAmount:0});this.scene.add(this.sky.mesh,this.stars.points,this.bridge);this.scene.environment=this.sky.toEnvironment(renderer);this.scene.environmentIntensity=.5;
    this.ocean=new OceanSurface({size:14000,level:-31,deepColor:0x04101a,horizonColor:0x263b4c,zenithColor:0x091622,waveHeight:.6,glitter:0,fogDensity:.0002});this.scene.add(this.ocean.mesh);
    // Align the real ship bridge altitude with this set, and remove its exterior deckhouse to expose the deck view.
    this.ship.deckhouse.visible=false;this.ship.position.set(0,-31,-89);this.scene.add(this.ship);this.scene.add(new THREE.HemisphereLight(0x92adbd,0x273d43,.62));
    const deckFill=new THREE.DirectionalLight(0xa0b3b4,1.1);deckFill.position.set(20,45,20);this.scene.add(deckFill);
  }
  update(t:number,shot:ShotInfo){this.bridge.update(t);this.ocean.update(t);this.ship.update(t,{rpm:78});this.sky.follow(this.camera);this.stars.follow(this.camera);const pitch=Math.sin(t*Math.PI*2/9)*.4*Math.PI/180;this.ship.rotation.x=pitch;}
}
