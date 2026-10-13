import * as THREE from 'three';
import type { Stage,ShotInfo } from '../../../library/render/FilmPipeline';
import { PortKit } from '../../../library/environment/PortKit';
import { ContainerShip } from '../../../library/vehicles/ContainerShip';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { SkyDome } from '../../../library/environment/SkyDome';
import { Sailboat } from '../../../library/vehicles/Sailboat';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { BirdFlock } from '../../../library/creatures/BirdFlock';
import { smoothstep } from '../../../library/util/math';

export class PortStage implements Stage {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(14,9/16,.2,15000);
  private port=new PortKit();private ship=new ContainerShip();private sky:SkyDome;private ocean:OceanSurface;private smoke:SmokeWisp;private boats:Sailboat[]=[];private gull:BirdFlock;private hemi:THREE.HemisphereLight;
  constructor(renderer:THREE.WebGLRenderer){
    this.sky=new SkyDome({zenithColor:0x263e64,horizonColor:0xb47857,groundColor:0x273139,sunIntensity:0,sunGlow:.05,hazeAmount:.2});this.scene.add(this.sky.mesh);this.scene.environment=this.sky.toEnvironment(renderer);this.scene.environmentIntensity=.55;
    this.ocean=new OceanSurface({size:9000,deepColor:0x10262e,horizonColor:0x896452,zenithColor:0x263e64,waveHeight:.15,waveScale:.6,glitter:.1,fogDensity:.0003});this.scene.add(this.ocean.mesh,this.port);
    this.ship.position.set(0,0,-278);this.ship.rotation.y=Math.PI/2;this.scene.add(this.ship);
    this.hemi=new THREE.HemisphereLight(0x89a7ce,0x5c4935,1.9);this.scene.add(this.hemi);const key=new THREE.DirectionalLight(0xffc593,1.3);key.position.set(-100,190,110);this.scene.add(key);
    this.scene.fog=new THREE.FogExp2(0x223645,.00065);
    this.smoke=new SmokeWisp({height:60,baseWidth:4,topWidth:18,curl:18,riseSpeed:1.2,color:0xb9b4ad,opacity:.5});this.smoke.mesh.position.copy(this.port.chimneyAnchor);this.scene.add(this.smoke.mesh);
    for(let i=0;i<3;i++){const b=new Sailboat({length:9+i,sails:false,seed:22+i});b.group.position.set(86+i*14,0,-218);this.boats.push(b);this.scene.add(b.group);}
    this.gull=new BirdFlock({count:1,spread:[0,0,0],wingspan:1.3,seed:17,ambient:0xadb9cb});this.scene.add(this.gull.mesh);
  }
  update(t:number,shot:ShotInfo){
    this.port.update(t,{stopAt_s:15.95,stopDuration_s:.85});this.ocean.update(t);this.ship.update(t,{rpm:0});this.smoke.update(t,60,.5*(1-smoothstep(16.5,18,t)),this.camera);
    const night=smoothstep(15.95,16.9,t),dawn=smoothstep(17.0,18.4,t);this.hemi.intensity=1.9-1.0*night+.55*dawn;this.sky.scatter=1-.72*night+.32*dawn;this.ocean.skyScale=1-.64*night+.3*dawn;this.sky.follow(this.camera);
    this.boats.forEach(b=>b.update(t,{bob:.6}));this.gull.mesh.visible=t>=17.9;
    const a=smoothstep(17.9,18.45,t);this.gull.update(t,{center:new THREE.Vector3(33-23*a,61-10*a,-274+12*a),heading:new THREE.Vector3(-1,0,.5).normalize(),glide:1},t*4);
  }
}
