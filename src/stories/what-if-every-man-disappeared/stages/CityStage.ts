import * as THREE from 'three';
import { CityStreet, makeCityCar } from '../../../library/environment/CityStreet';
import { PedestrianCrowd } from '../../../library/characters/PedestrianCrowd';
import { Humanoid, POSE_STAND } from '../../../library/characters/Humanoid';
import { SkyDome } from '../../../library/environment/SkyDome';
import { CloudDeck } from '../../../library/environment/CloudDeck';
import { BroadleafTree } from '../../../library/environment/BroadleafTree';
import { BirdFlock } from '../../../library/creatures/BirdFlock';
import { Flame } from '../../../library/fx/Flame';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { clamp, lerp, rng, smoothstep } from '../../../library/util/math';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';

/** One continuous intersection, from the opening event to the final generation. */
export class CityStage implements Stage {
  readonly scene=new THREE.Scene(); readonly camera=new THREE.PerspectiveCamera(35,1080/1920,.045,80000);
  readonly city=new CityStreet({seed:4075,blocks:9,farFieldRadius:1650,wetness:1});
  readonly crowd=new PedestrianCrowd({seed:42075,count:44,umbrellaCount:9});
  readonly sky=new SkyDome({zenithColor:0x0e1b33,horizonColor:0x2b4a73,groundColor:0x1b2431,hazeColor:0x3a5578,hazeAmount:.25,sunIntensity:0,sunGlow:0});
  private clouds=new CloudDeck({level:1800,size:60000,coverage:.64,scale:1600,sunColor:0x9b9cad,shadowColor:0x3b567b,belowColor:0x182e48,hazeColor:0x627e9b,hazeDensity:.00005});
  private birds=new BirdFlock({count:8,wingspan:.68,spread:[6,.8,2.1],bodyColor:0x7e848c,wingColor:0x8d939a,tipColor:0x3b3f45,seed:47});
  private hemi=new THREE.HemisphereLight(0x92b4e4,0x3c3025,1.6);
  private key=new THREE.DirectionalLight(0xf7d5ad,1.8);
  private fill=new THREE.DirectionalLight(0x9cc8ff,1.0);
  private memorial=new THREE.Group();private repair=new THREE.Group();private tree=new THREE.Group();
  private flames:Flame[]=[];private smoke=new SmokeWisp({height:.46,baseWidth:.016,topWidth:.08,curl:.065,riseSpeed:.18,seed:8});
  private workers:Humanoid[]=[];private repairedLamp:THREE.Mesh;
  private broadleaf=new BroadleafTree({height:3.0,canopyWidth:1.8,leafCount:1200,seed:9,leafColor:0x69764f});
  private leafMat=this.broadleaf.leaves.material as THREE.MeshStandardMaterial;
  private openingPosition=new THREE.Vector3(10.7,1.68,4.5);private openingTarget=new THREE.Vector3(-2,1.17,0);

  constructor(renderer:THREE.WebGLRenderer){
    this.scene.add(this.city.group,this.crowd.group,this.sky.mesh,this.clouds.mesh,this.birds.mesh,this.hemi,this.key,this.fill);
    this.scene.environment=this.sky.toEnvironment(renderer);this.scene.environmentIntensity=.65;
    this.scene.fog=new THREE.FogExp2(0x334359,.009);
    this.key.position.set(-12,28,5);this.fill.position.set(7,10,-20);
    this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);this.key.shadow.camera.left=-22;this.key.shadow.camera.right=22;this.key.shadow.camera.top=20;this.key.shadow.camera.bottom=-20;this.key.shadow.camera.near=.5;this.key.shadow.camera.far=100;this.key.shadow.bias=-.0003;this.key.shadow.normalBias=.025;
    this.scene.add(this.memorial,this.repair,this.tree);this.buildMemorial();this.repairedLamp=this.buildRepair();this.buildTree();
  }
  update(t:number,shot:ShotInfo){
    const ending=shot.sceneId==='S10',repair=ending&&shot.shotId==='SH01',future=ending&&shot.shotId==='SH02',aerial=shot.sceneId==='S02';
    this.memorial.visible=repair;this.repair.visible=repair;this.tree.visible=true;
    this.clouds.mesh.visible=aerial&&t>6.34;
    const fog=this.scene.fog as THREE.FogExp2;
    let lightCycle=0,wet=1;
    if(future){const settle=smoothstep(73.4,74.4,t);lightCycle=(.5+.5*Math.sin((t-69.4)*5))*Math.sin(clamp((t-69.4)/5)*Math.PI)*(1-settle);wet=smoothstep(73.4,74.4,t);}
    const dawn=repair?1:lightCycle;
    this.sky.uniforms.uZenith.value.copy(new THREE.Color(0x0e1b33)).lerp(new THREE.Color(0x5876a8),dawn);
    this.sky.uniforms.uHorizon.value.copy(new THREE.Color(0x2b4a73)).lerp(new THREE.Color(0xf2b47a),dawn);
    this.sky.uniforms.uHaze.value.copy(new THREE.Color(0x3a5578)).lerp(new THREE.Color(0xc6b2a1),dawn);
    this.hemi.intensity=lerp(1.6,2.1,dawn);this.key.intensity=lerp(1.8,3.0,dawn);
    this.key.color.copy(new THREE.Color(0xf7d5ad)).lerp(new THREE.Color(0xffc78c),dawn);
    fog.color.copy(new THREE.Color(0x334359)).lerp(new THREE.Color(0x8b8e9e),dawn);fog.density=.009;
    this.city.update(t,{wetness:repair?0:wet,lights:repair?.32:1});
    if(repair){
      // The maintenance fixture is replaced by the separately animated lamp head below.
      this.city.lampHeads[10].emissiveIntensity=0;
      const u=smoothstep(66.5,69.2,t),p=new THREE.Vector3(10.6,.92,5.2).lerp(new THREE.Vector3(9.8,2.3,6.3),u),target=new THREE.Vector3(8.55,.36,2.38).lerp(new THREE.Vector3(6.95,7.35,-5.6),u);
      this.setCamera(p,target,38);
      this.crowd.update(t,{clock_s:1.7,dissolveEnabled:false,visibleCount:4});
      for(let i=0;i<this.flames.length;i++)this.flames[i].update(t,i===0?1-smoothstep(68.2,68.35,t):.8+.12*Math.sin(t*8.3+i),this.camera);
      this.smoke.update(t,t-68.2,.5*(1-smoothstep(68.4,69.4,t)),this.camera);
      const w=this.workers[0];w.setPose({...POSE_STAND,headPitch:-.25,armL:[-1.65,.12,.45],armR:[-1.4,.13,.65],breath:Math.sin(t*1.2)*.2});
      w.reachArm('L',new THREE.Vector3(6.76,7.74,-6),new THREE.Vector3(0,0,1),smoothstep(66.8,67.6,t));
      (this.repairedLamp.material as THREE.MeshStandardMaterial).emissiveIntensity=5*smoothstep(68.8,68.95,t);
      this.birds.mesh.visible=t>67.2;this.birds.update(t,{center:new THREE.Vector3(lerp(-20,20,clamp((t-67.2)/2.1)),20,-23),heading:new THREE.Vector3(1,0,0),glide:.3},t*22);
    } else if(future){
      const settle=smoothstep(69.4,74.2,t),pos=new THREE.Vector3(11.6,3.0,6.3).lerp(this.openingPosition,settle);
      this.setCamera(pos,new THREE.Vector3(-2,1.5,0).lerp(this.openingTarget,settle),35);
      const count=Math.round(lerp(6,44,smoothstep(70.2,73.4,t)));
      const clock=t>=73.8?t-75:(t-69.4)*3.3;
      this.crowd.update(t,{clock_s:clock,dissolveEnabled:false,visibleCount:count});
      this.birds.mesh.visible=false;
      const season=.5+.5*Math.sin((t-69.4)*5.2);this.leafMat.color.copy(new THREE.Color(0x69764f)).lerp(new THREE.Color(0xae8147),season*(1-smoothstep(73.5,74.4,t)));
      this.broadleaf.leafFraction=lerp(.12+.88*season,1,smoothstep(73.5,74.4,t));
      this.tree.scale.setScalar(1+.15*Math.sin(clamp((t-69.4)/5.6)*Math.PI));
    } else {
      this.tree.scale.setScalar(1);this.leafMat.color.set(0x69764f);this.broadleaf.leafFraction=1;
      this.crowd.update(t,{clock_s:t,dissolveEnabled:true,vanishStart_s:.9,survivorStop_s:1.65});
      if(!aerial){const move=smoothstep(0,3.3,t);this.setCamera(this.openingPosition.clone().add(new THREE.Vector3(-.65*move,-.025*move,-.1*move)),this.openingTarget,35);}
      else {
        // Log-altitude rise maintains the continuous street camera, then opens to the city grid.
        const keys=[{t:3.3,p:[10.05,1.655,4.4],a:[-2,1.17,0]},{t:3.9,p:[10,5,5],a:[-2,.5,0]},{t:4.5,p:[9,19,12],a:[0,0,-3]},{t:5.1,p:[14,75,51],a:[0,0,-10]},{t:5.7,p:[30,270,190],a:[0,0,-40]},{t:6.25,p:[60,1450,950],a:[0,230,-650]},{t:6.7,p:[80,2300,1650],a:[0,1900,-4000]}];
        let k=0;while(k<keys.length-2&&t>keys[k+1].t)k++;const a=keys[k],b=keys[k+1],u=smoothstep(a.t,b.t,t),p=new THREE.Vector3(...a.p as [number,number,number]).lerp(new THREE.Vector3(...b.p as [number,number,number]),u);p.y=Math.exp(lerp(Math.log(a.p[1]),Math.log(b.p[1]),u));
        this.setCamera(p,new THREE.Vector3(...a.a as [number,number,number]).lerp(new THREE.Vector3(...b.a as [number,number,number]),u),35);
        fog.density=lerp(.009,.00015,smoothstep(4.1,5.7,t));this.clouds.update(t,t*2,0);
      }
      this.birds.mesh.visible=t>2.3&&t<4.4;this.birds.update(t,{center:new THREE.Vector3(-9+(t-2.3)*4,10+(t-2.3)*2,-2-(t-2.3)*6),heading:new THREE.Vector3(.5,.2,-1).normalize(),glide:.1},t*30);
    }
    this.sky.follow(this.camera);
  }
  private setCamera(p:THREE.Vector3,target:THREE.Vector3,fov:number){this.camera.position.copy(p);this.camera.fov=fov;this.camera.lookAt(target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);}
  private buildMemorial(){
    const r=rng(1658),glass=new THREE.MeshPhysicalMaterial({color:0xc9d9dc,roughness:.2,metalness:.12,transparent:true,opacity:.5,side:THREE.DoubleSide}),leaf=new THREE.MeshStandardMaterial({color:0x52734e,roughness:.85});
    this.memorial.position.set(8.5,.155,2.4);
    for(let j=0;j<4;j++){
      const x=(j-1.5)*.27,z=(j%2)*.22-.13,h=.21+r()*.13;const jar=new THREE.Mesh(new THREE.CylinderGeometry(.10,.09,h,20,1,true),glass);jar.position.set(x,h/2,z);this.memorial.add(jar);
      for(let f=0;f<6;f++){
        const yy=h+.1+r()*.24,xx=x+(r()-.5)*.16,zz=z+(r()-.5)*.16;this.rod(this.memorial,new THREE.Vector3(x,.08,z),new THREE.Vector3(xx,yy,zz),.003,leaf);
        const petal=new THREE.MeshStandardMaterial({color:[0xd19b9a,0xe4d1b1,0xc7b0d0,0xa899cb][(j+f)%4],roughness:.75});
        for(let n=0;n<5;n++){const a=n*Math.PI*2/5,m=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6).scale(.72,1.2,.55),petal);m.position.set(xx+Math.cos(a)*.014,yy,zz+Math.sin(a)*.014);m.rotation.z=Math.cos(a)*.55;this.memorial.add(m);}
      }
    }
    for(let i=0;i<6;i++){
      const x=(i-2.5)*.20,z=.30+(i%2)*.11;const holder=new THREE.Mesh(new THREE.CylinderGeometry(.066,.057,.14,20,1,true),glass);holder.position.set(x,.07,z);this.memorial.add(holder);
      const candle=new THREE.Mesh(new THREE.CylinderGeometry(.046,.046,.058,16),new THREE.MeshStandardMaterial({color:0xe8d4b0,roughness:.55}));candle.position.set(x,.05,z);this.memorial.add(candle);
      const flame=new Flame({width:.045,height:.065,turbulence:.1,brightness:1.6,blueBase:.03,seed:i+1});flame.mesh.position.set(x,.082,z);this.memorial.add(flame.mesh);this.flames.push(flame);
      if(i===0){this.smoke.mesh.position.copy(flame.mesh.position);this.memorial.add(this.smoke.mesh);}
    }
    const paper=new THREE.MeshStandardMaterial({color:0xe7d7bc,roughness:.9,side:THREE.DoubleSide});for(let i=0;i<4;i++){const p=new THREE.Mesh(new THREE.PlaneGeometry(.13,.19),paper);p.position.set(-.45+i*.3,.007,.52);p.rotation.set(-Math.PI/2,0,(r()-.5)*.7);this.memorial.add(p);}
    const practical=new THREE.PointLight(0xffb064,.28,2,2);practical.position.set(0,.18,.33);this.memorial.add(practical);
  }
  private buildRepair(){
    const truck=makeCityCar(0xd6d7d0);truck.scale.set(1.25,1.12,1.25);truck.position.set(6,.02,-6);this.repair.add(truck);
    const white=new THREE.MeshStandardMaterial({color:0xd4d6cf,roughness:.55,metalness:.18}),steel=new THREE.MeshStandardMaterial({color:0x535e64,roughness:.38,metalness:.6}),hi=new THREE.MeshStandardMaterial({color:0xb7c853,roughness:.7});
    const bed=new THREE.Mesh(new THREE.BoxGeometry(2.22,.72,2.35),white);bed.position.set(6,1.23,-4.4);this.repair.add(bed);
    this.rod(this.repair,new THREE.Vector3(6,1.8,-4.7),new THREE.Vector3(6,4.6,-2.9),.13,white);this.rod(this.repair,new THREE.Vector3(6,4.6,-2.9),new THREE.Vector3(6.95,6.6,-5.6),.105,white);
    this.rod(this.repair,new THREE.Vector3(6,2.1,-4.2),new THREE.Vector3(6,4.4,-3.0),.044,steel);
    for(const side of [-1,1]){this.rod(this.repair,new THREE.Vector3(6+side,1.1,-4.3),new THREE.Vector3(6+side*1.8,.2,-4.3),.07,steel);const pad=new THREE.Mesh(new THREE.BoxGeometry(.44,.12,.38),steel);pad.position.set(6+side*1.8,.06,-4.3);this.repair.add(pad);}
    const bucket=new THREE.Mesh(new THREE.BoxGeometry(1.16,.82,.87),white);bucket.position.set(6.92,6.27,-5.65);this.repair.add(bucket);
    for(let i=0;i<2;i++){
      const person=new Humanoid({height:i===0?1.67:1.72,coat:'jacket',coatColor:0xb6bf54,trouserColor:0x344353,skinColor:i===0?0xa77755:0xd5ad8c,scarfColor:null});person.root.position.set(i===0?6.95:8.05,i===0?6.35:.15,i===0?-5.65:-3.4);person.root.rotation.y=i===0?Math.PI/2:-1.3;this.repair.add(person.root);this.workers.push(person);
      const helmet=new THREE.Mesh(new THREE.SphereGeometry(.125,16,10,0,Math.PI*2,0,Math.PI*.56),white);helmet.position.set(0,.15,0);person.head.add(helmet);
      const tape=new THREE.Mesh(new THREE.BoxGeometry(.34,.052,.26),new THREE.MeshStandardMaterial({color:0xe2e4cb,roughness:.4,metalness:.2}));tape.position.set(0,-.06,0);person.chestAnchor.add(tape);
    }
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(.75,.1,.32),new THREE.MeshStandardMaterial({color:0xd9d4c4,emissive:0xffcb83,emissiveIntensity:0,roughness:.3}));lamp.position.set(6.72,7.84,-6);this.repair.add(lamp);return lamp;
  }
  private buildTree(){
    this.tree.position.set(9.8,.15,-9);const planter=new THREE.Mesh(new THREE.BoxGeometry(1.35,.65,1.35),new THREE.MeshStandardMaterial({color:0x566367,roughness:.8}));planter.position.y=.325;this.tree.add(planter);
    this.broadleaf.position.y=.6;this.tree.add(this.broadleaf);
  }
  private rod(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material){const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(m);return m;}
}
