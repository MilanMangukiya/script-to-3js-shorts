import * as THREE from 'three';
import { type Stage, type ShotInfo } from '../../library/render/FilmPipeline';
import { RoomBox, table, mug, tableLamp } from '../../library/environment/RoomBox';
import { CityStreetClassic, makeClassicCityCar } from '../../library/environment/CityStreetClassic';
import { SunSkylightRig } from '../../library/environment/SunSkylightRig';
import { Earth, type EarthTextures } from '../../library/planet/Earth';
import { Starfield } from '../../library/space/Starfield';
import { Humanoid, POSE_STAND } from '../../library/characters/Humanoid';
import { applyGroundedPose } from '../../library/characters/CharacterMotion';
import { surface, glow, box, solid, rod, screen, canvasTexture } from '../../library/util/Modeling';
import { T, unit, ramp, localSun, roadAltitude } from './timeline';

const cam = () => new THREE.PerspectiveCamera(40,9/16,.08,16000);
function textTexture(text: string, color='#f8c583', background='#111a20', size=48) {
  return canvasTexture(512,192,c=>{c.fillStyle=background;c.fillRect(0,0,512,192);c.fillStyle=color;c.font=`700 ${size}px Inter`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,96);});
}

export class BedroomStage implements Stage {
  scene=new THREE.Scene(); camera=cam(); rig:SunSkylightRig;
  readonly person=new Humanoid({coat:'jacket',coatColor:0x516b71,trouserColor:0x343b48,skinColor:0xc08e70});
  readonly button=new THREE.Vector3(-.92,1.21,-2.77);
  readonly blind=new THREE.Group(); readonly hem:THREE.Mesh;
  readonly lamp; readonly fill=new THREE.HemisphereLight(0x9bb5d1,0x6a5040,.4);
  cover=0; handError=0;
  constructor(renderer:THREE.WebGLRenderer) {
    const room=new RoomBox({width:4,height:4.2,depth:3,wallColor:0xb1b6af,floorColor:0x735e4a,ceiling:true});
    // Replace only the registered room's solid rear panel with supported window surrounds.
    room.children[1].visible=false; this.scene.add(room);
    const wall=surface(0xb1b6af,.9),frame=surface(0xddd1b6,.6);
    box(room,[1.0,4.2,.12],wall,[-1.5,2.1,-3]);box(room,[1.0,4.2,.12],wall,[1.5,2.1,-3]);
    box(room,[2,.8,.12],wall,[0,.4,-3]);box(room,[2,1.8,.12],wall,[0,3.3,-3]);
    for(const x of [-1,1])box(room,[.09,1.7,.17],frame,[x,1.6,-2.91]);
    for(const y of [.8,2.4])box(room,[2.1,.09,.20],frame,[0,y,-2.91]);
    box(room,[2.18,.08,.38],frame,[0,.77,-2.84]);
    // Opaque roller fabric is attached at its top; the lower rail travels to the sill.
    this.scene.add(this.blind); this.blind.position.set(0,2.38,-2.82);
    box(this.blind,[1.96,1,.027],surface(0x3a4652,.95),[0,-.5,0]);
    this.hem=box(this.scene,[2.03,.055,.06],surface(0x89969b,.55,.4),[0,2.38,-2.80]);
    const roller=rod(room,[-1.05,2.45,-2.82],[1.05,2.45,-2.82],.065,frame,20);
    roller.name='supported roller';
    box(room,[.11,.18,.07],surface(0x525e62),[-.92,1.21,-2.84]);
    box(room,[.05,.045,.018],glow(0x91d0b6,.3),[-.92,1.21,-2.794]);
    // Readable physical retained human clock, placed beside the pillow.
    table(room,.77,-1.84,.75,.7);mug(room,[1,.79,-1.80]);
    screen(room,.63,.24,textTexture('00:00','#fbd28b','#0d151b',76),[.69,1.00,-1.98]);
    box(room,[1.3,.3,1.80],surface(0x514239),[-.88,.30,-.95]);
    box(room,[1.34,.23,1.86],surface(0xb1b7ae),[-.88,.56,-.95]);
    box(room,[1.36,.10,1.06],surface(0x507985),[-.88,.72,-.58]);
    solid(room,new THREE.SphereGeometry(1,24,12).scale(.49,.12,.24),surface(0xe8dfcc),[-.88,.75,-1.55]);
    this.lamp=tableLamp(room,[1.0,.79,-2.03],0xffc08c,.15);
    this.person.root.position.set(-1.28,0,-2.37);this.person.root.rotation.y=Math.PI/2;this.scene.add(this.person.root);
    this.scene.add(this.fill);
    const outside=new CityStreetClassic({seed:725,blocks:3,storeysMin:2,storeysMax:3,roadWidth:8,sidewalkWidth:3,farFieldRadius:0,vehicles:false,wetness:0});
    outside.group.position.z=-45;outside.update(0,{lights:.15,wetness:0});this.scene.add(outside.group);
    box(this.scene,[300,.1,1000],surface(0x54605e),[0,-.16,-500]);
    // No terrain behind the window: the fixed distant Sun is visible through the real aperture.
    this.rig=new SunSkylightRig(this.scene,renderer,{zenithColor:0x527989,horizonColor:0xe7b682,discRadiance:25,shadowMapSize:2048,envCacheSize:4});
  }
  update(t:number, shot:ShotInfo) {
    const ending=shot.sceneId==='S08';
    this.cover=ending?ramp(t,T.close0,T.close1):.15*(1-ramp(t,T.open0,T.open1));
    const h=Math.max(.012,1.6*this.cover);this.blind.scale.set(1,h,1);this.hem.position.y=2.38-h;
    const p0=ending?T.closingPress:T.openingPress,p1=ending?T.closingRelease:T.openingRelease;
    const press=ramp(t,p0-.25,p0)*(1-ramp(t,p1,p1+.45));
    applyGroundedPose(this.person,{...POSE_STAND,headYaw:-.3+.5*ramp(t,p1,p1+.7),headPitch:.04,armL:[-.3,.15,.35]});
    this.person.reachArm('L',this.button,new THREE.Vector3(-1,0,.5),press);
    const palm=this.person.handL.getWorldPosition(new THREE.Vector3());this.handError=palm.distanceTo(this.button);
    const light=1-this.cover;this.fill.intensity=.04+.35*light;this.lamp.light.intensity=.14;
    this.rig.apply(this.scene,this.camera,{sunDirection:localSun(ending?1:8),sunIntensity:2.4*light,skyAmount:.3+.6*light,groundAmount:.25*light,envIntensity:.05+.28*light,hazeDensity:0,focus:new THREE.Vector3(0,1,-1.5),shadowHalfWidth:4,shadowHalfHeight:3,shadowDepth:20});
  }
}

export class GlobeStage implements Stage {
  scene=new THREE.Scene();camera=cam();readonly earth:Earth;readonly carrier=new THREE.Group();
  readonly marker:THREE.Mesh;readonly sun:THREE.Mesh;readonly orbit:THREE.LineLoop;readonly transport=new THREE.Group();readonly facingLink:THREE.Mesh;
  readonly stars=new Starfield({count:2400,seed:741});
  paths:{curve:THREE.CatmullRomCurve3,beads:THREE.Mesh[]}[]=[];phase=0;
  constructor(tex:EarthTextures) {
    this.earth=new Earth(tex,{radius:1.2,nightLights:1.8,cloudOpacity:.65,atmosphereStrength:.65});
    this.earth.setView(0,0);this.earth.spinRate=0;this.earth.cloudDrift=0;
    this.carrier.add(this.earth.group);this.scene.add(this.carrier,this.transport,this.stars.points);
    this.marker=solid(this.carrier,new THREE.SphereGeometry(.075,14,10),new THREE.MeshBasicMaterial({color:0xffce65}),[0,0,1.23]);
    const ring=solid(this.carrier,new THREE.TorusGeometry(.14,.019,8,30),new THREE.MeshBasicMaterial({color:0xffd887}),[0,0,1.23]);
    ring.name='fixed geographic marker';
    this.sun=solid(this.scene,new THREE.SphereGeometry(.4,40,28),new THREE.MeshBasicMaterial({color:new THREE.Color(5,2.7,1)}));
    const pts=Array.from({length:160},(_,i)=>new THREE.Vector3(1.85*Math.cos(i/160*Math.PI*2),0,1.85*Math.sin(i/160*Math.PI*2)));
    this.orbit=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x667f96,transparent:true,opacity:.6}));this.scene.add(this.orbit);
    this.facingLink=solid(this.scene,new THREE.CylinderGeometry(.009,.009,1,6),new THREE.MeshBasicMaterial({color:0xe4ba64}));
    // Possible surface-adjacent advection paths, not a temperature field or forecast circulation.
    for(let k=0;k<3;k++) {
      const pts=[];for(let j=0;j<=36;j++){const a=(-.4+j/36*3.0),lat=(k-1)*.34;pts.push(new THREE.Vector3(Math.cos(a)*Math.cos(lat),Math.sin(lat)+.08*Math.sin(j/36*Math.PI),Math.sin(a)*Math.cos(lat)).normalize().multiplyScalar(1.25+k*.025));}
      const curve=new THREE.CatmullRomCurve3(pts),mat=new THREE.MeshBasicMaterial({color:k===1?0x5caad5:0xf7b15c,transparent:true,opacity:.5});
      solid(this.transport,new THREE.TubeGeometry(curve,72,.008,5,false),mat);
      const beads=Array.from({length:5},()=>solid(this.transport,new THREE.SphereGeometry(.024,8,6),new THREE.MeshBasicMaterial({color:k===1?0x8cdbff:0xffd094})));
      this.paths.push({curve,beads});
    }
  }
  update(t:number,shot:ShotInfo) {
    const orbit=shot.sceneId==='S02';this.sun.visible=this.orbit.visible=this.facingLink.visible=orbit;this.transport.visible=!orbit&&t>=T.heatReveal;
    this.carrier.scale.setScalar(orbit?.24:1);this.marker.visible=orbit;this.carrier.children[2].visible=orbit;
    if(orbit){this.phase=2*Math.PI*unit((t-5)/6);this.carrier.position.set(1.85*Math.cos(this.phase),0,1.85*Math.sin(this.phase));this.carrier.rotation.set(0,-this.phase-Math.PI/2,0);this.earth.sunDirection=this.carrier.position.clone().negate();const dir=this.carrier.position.clone().normalize();this.facingLink.position.copy(dir).multiplyScalar((.43+1.55)/2);this.facingLink.scale.y=1.55-.43;this.facingLink.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);}
    else{this.carrier.position.set(0,0,0);this.carrier.rotation.set(0,0,0);this.earth.sunDirection=new THREE.Vector3(1,0,.15);}
    this.earth.update(t);this.stars.follow(this.camera);
    for(const {curve,beads} of this.paths)beads.forEach((m,j)=>m.position.copy(curve.getPoint(((t-T.heatReveal)*.11+j/5+10)%1)));
  }
}

export class RouteStage implements Stage {
  scene=new THREE.Scene();camera=cam();rig:SunSkylightRig;street:CityStreetClassic;
  car=makeClassicCityCar(0xcba36b);readonly solar=new THREE.Group();readonly cloud=new THREE.Group();readonly stars=new Starfield({count:1200,seed:123});
  readonly porch=new THREE.PointLight(0xffc28d,0,7,2);readonly porchMat=glow(0xffc28d,0);
  readonly display:THREE.Mesh;readonly displays=[textTexture('STANDBY','#92b5b5','#172b31',46),textTexture('SOLAR','#d2edb7','#172b31',54),textTexture('BACKUP','#f7cf87','#172b31',54)];
  sunAltitude=8;cover=0;carDistance=0;
  constructor(renderer:THREE.WebGLRenderer) {
    this.street=new CityStreetClassic({seed:724,blocks:5,storeysMin:2,storeysMax:4,roadWidth:10,sidewalkWidth:4,farFieldRadius:0,vehicles:false,wetness:0});
    this.scene.add(this.street.group,this.car,this.solar,this.cloud,this.stars.points);
    box(this.scene,[1500,.1,18000],surface(0x4a514e,.95),[0,-.16,-8500]);
    const panel=surface(0x2d6188,.48,.12),frame=surface(0x8296a1,.62,.25),cell=surface(0x91b8c9,.6,.15);
    // Rack is in a paved front courtyard, beside the road; each strut meets the platform.
    this.solar.position.set(7,.105,-4);box(this.solar,[3.6,.12,3],surface(0x8a8981),[0,.06,0]);
    const rack=new THREE.Group();rack.position.set(0,.95,0);rack.rotation.x=-.12;this.solar.add(rack);
    box(rack,[2.4,.08,2.3],frame);box(rack,[2.27,.025,2.17],panel,[0,.053,0]);
    for(let i=-2;i<=2;i++)box(rack,[.012,.006,2.13],cell,[i*.44,.069,0]);for(let j=-3;j<=3;j++)box(rack,[2.23,.006,.012],cell,[0,.070,j*.30]);
    for(const x of [-.9,.9])for(const z of [-.55,.55])rod(this.solar,[x,.12,z],[x,.95+z*Math.sin(.12),z],.038,frame);
    box(this.solar,[.5,.78,.25],surface(0xbfc3b6),[1.48,.55,.6]);
    this.display=screen(this.solar,.40,.18,this.displays[0],[1.48,.71,.742]);
    rod(this.solar,[.8,.8,.4],[1.48,.19,.55],.014,surface(0x141a20));
    box(this.scene,[.30,.12,.14],this.porchMat,[8.8,2.4,-6.5]);this.porch.position.set(8.8,2.25,-6.3);this.scene.add(this.porch);
    rod(this.scene,[9,.1,-.5],[9,3,-.5],.045,frame);box(this.scene,[.35,.10,.25],glow(0xffc994,1.8),[9,3,-.5]);
    const yardLight=new THREE.PointLight(0xffc994,17,11,2);yardLight.position.set(9,2.9,-.5);this.scene.add(yardLight);
    // Broad, distant 3D cloud bank passes across the line of sight, rather than moving the Sun.
    const cloudMat=surface(0x5e6c78,1);cloudMat.emissive.set(0x697d8e);cloudMat.emissiveIntensity=.15;cloudMat.fog=false;
    for(let i=0;i<7;i++){const m=solid(this.cloud,new THREE.SphereGeometry(1,24,16),cloudMat,[(i-3)*110,105+(i%3)*24,0]);m.scale.set(210,70+(i%2)*30,120);m.castShadow=false;}
    this.rig=new SunSkylightRig(this.scene,renderer,{zenithColor:0x254760,horizonColor:0xd7ad80,hazeColor:0xa2afb2,sunGlow:.2,discRadiance:30,glareAngularRadius:.025,glareStrength:.8,shadowMapSize:2048,envCacheSize:32});
  }
  update(t:number,shot:ShotInfo) {
    const travel=shot.sceneId==='S03',panels=shot.sceneId==='S05',cloud=shot.sceneId==='S07';
    this.sunAltitude=travel?roadAltitude(t):panels?-8:1;
    const p=travel?ramp(t,T.road0,T.road1):ramp(t,T.arrival0,T.arrival1);
    this.carDistance=travel?24*p:7*p;
    this.car.position.set(travel?1.7:2.0,0,travel?-1-this.carDistance:-5-7*p);this.car.rotation.set(0,0,0);
    // Following movement is authored in the storyboard camera keyframes; no runtime override.
    this.solar.visible=!travel;
    this.cloud.visible=cloud;
    const cloudX=-1700+1500*ramp(t,T.cloud0,T.cloudCentre)+400*ramp(t,T.cloudCentre,T.cloudExit)+1500*ramp(t,T.cloudExit,T.cloud1);
    this.cloud.position.set(cloudX,0,-6000);
    this.cover=cloud?Math.exp(-Math.pow(this.cloud.position.x/510,4)):0;
    const sky=panels?.025:Math.round((.53-.20*this.cover)*1000)/1000,ground=panels?0:Math.round((.32-.20*this.cover)*1000)/1000;
    this.rig.apply(this.scene,this.camera,{sunDirection:localSun(this.sunAltitude),sunIntensity:1.3*(1-this.cover),skyAmount:sky,groundAmount:ground,envIntensity:panels?.3:.65,hazeDensity:0.000045,focus:new THREE.Vector3(4,1,-8),shadowHalfWidth:25,shadowHalfHeight:18,shadowDepth:75});
    // Environment is canonical for cache purity; visible Sun/shadow geometry retains continuous local travel.
    const alt=this.sunAltitude*Math.PI/180,dir=new THREE.Vector3(0,Math.sin(alt),-Math.cos(alt)),f=SunSkylightRig.discFraction(alt,0,.00465);
    this.rig.sun.position.copy(this.rig.sun.target.position).addScaledVector(dir,37.5);this.rig.sun.intensity=1.3*(1-this.cover)*f;this.rig.sun.updateMatrixWorld();
    this.rig.disc.position.copy(this.camera.position).addScaledVector(dir,9000);this.rig.glare.position.copy(this.camera.position).addScaledVector(dir,8991);
    this.rig.disc.visible=this.rig.glare.visible=f>0;(this.rig.glare.material as THREE.ShaderMaterial).uniforms.uStrength.value=.8*Math.sqrt(f);this.rig.dome.uniforms.uSunDir.value.copy(dir);
    (this.display.material as THREE.MeshBasicMaterial).map=this.displays[panels?0:t>=T.porchOn?2:1];
    this.street.update(t,{wetness:0,lights:panels?.75:.12+.42*this.cover});
    const on=panels?1:.15+.85*ramp(t,T.porchOn,T.porchOn+.4);this.porch.intensity=12*on;this.porchMat.emissiveIntensity=2*on;
    this.stars.brightness=panels?.35:0;this.stars.follow(this.camera);
  }
}
