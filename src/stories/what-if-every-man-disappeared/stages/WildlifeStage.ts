import * as THREE from 'three';
import { type Stage, type ShotInfo } from '../../../library/render/FilmPipeline';
import { Underwater } from '../../../library/environment/Underwater';
import { FishSchool } from '../../../library/creatures/FishSchool';
import { RightWhale } from '../../../library/creatures/RightWhale';
import { Songbird } from '../../../library/creatures/Songbird';
import { ContainerShip } from '../../../library/vehicles/ContainerShip';
import { CityStreet } from '../../../library/environment/CityStreet';
import { GrassField } from '../../../library/environment/GrassField';
import { SkyDome } from '../../../library/environment/SkyDome';
import { BroadleafTree } from '../../../library/environment/BroadleafTree';
import { BokehField } from '../../../library/fx/BokehField';
import { SoundRings } from '../../../library/diagram/SoundRings';
import { rng, smoothstep, clamp } from '../../../library/util/math';

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const basic=(c:THREE.ColorRepresentation,roughness=.8)=>new THREE.MeshStandardMaterial({color:c,roughness});
const box=(g:THREE.Object3D,p:number[],s:number[],m:THREE.Material)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(...s as [number,number,number]),m);b.position.set(...p as [number,number,number]);b.receiveShadow=true;g.add(b);return b;};
const rod=(g:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,rad:number,m:THREE.Material)=>{const d=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,d.length(),10),m);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());g.add(mesh);return mesh;};
function lighting(scene:THREE.Scene,sun:THREE.Vector3,intensity=3){
  scene.add(new THREE.HemisphereLight(0xc7e1e3,0x303a28,1.45));
  const key=new THREE.DirectionalLight(0xffe4b7,intensity);key.position.copy(sun).multiplyScalar(40);scene.add(key);
  const fill=new THREE.DirectionalLight(0xa7d9df,.65);fill.position.set(-7,5,15);scene.add(fill);
}
abstract class WildlifeBase implements Stage {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,9/16,.02,2000);
  abstract update(t:number,shot:ShotInfo):void;
  protected cameraAt(fov:number,position:THREE.Vector3,target:THREE.Vector3){this.camera.fov=fov;this.camera.position.copy(position);this.camera.lookAt(target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);}
}

function waterSet(scene:THREE.Scene,density:number,renderer?:THREE.WebGLRenderer){
  const water=new Underwater({depth:120,extent:90,waterColor:0x1f5f63,deepColor:0x082630,surfaceColor:0x9cc7c2,sunDirection:V(-.3,1,-.5),rayStrength:.046,rayCount:8,fogDensity:density,grassCount:0,particleCount:1900,seed:765});
  scene.add(water.group);scene.fog=new THREE.FogExp2(water.fogColor,density);
  scene.add(new THREE.HemisphereLight(0xafd8d4,0x163b49,2.4));
  const key=new THREE.DirectionalLight(0xcaf7e9,4.5);key.position.set(-12,25,12);scene.add(key);
  const rim=new THREE.DirectionalLight(0x4faebe,2.8);rim.position.set(10,4,-18);scene.add(rim);
  const fill=new THREE.DirectionalLight(0x94cace,1.6);fill.position.set(-10,-12,20);scene.add(fill);
  if(renderer){const sk=new SkyDome({zenithColor:0x72adad,horizonColor:0x447378,groundColor:0x102b32,sunIntensity:0,sunGlow:0});scene.environment=sk.toEnvironment(renderer);scene.environmentIntensity=.5;}
  return water;
}

/** S06/SH01 — physically sized stern and braking propeller; no seafloor. */
export class PropellerStage extends WildlifeBase {
  private water:Underwater;private ship:ContainerShip;private rings:SoundRings;
  constructor(renderer?:THREE.WebGLRenderer){
    super();this.water=waterSet(this.scene,.022,renderer);
    this.ship=new ContainerShip({length:300,beam:48,draft:13,containerFill:.72});
    this.ship.position.set(0,-.85,-138);this.scene.add(this.ship);
    this.rings=new SoundRings({mode:'underwater',color:0x9ac6c5,opacity:.22,maxRadius:30,speedVisual:17,emissionRate:2.2,count:6,thickness:.009});this.rings.position.set(0,-8,2);this.scene.add(this.rings);
  }
  update(t:number){
    const q=clamp((t-35.5)/3.1);this.cameraAt(48,V(20-q*2,-19+q*1.3,23-q*2),V(0,-7.5,-1));
    // Integral of a smoothstep deceleration: angle and speed are continuous at both ends.
    const d=clamp((t-36.9)/1.3),integral=d-d*d*d+.5*d*d*d*d;
    const turns=t<36.9?(t-35.5)*1.3:1.4*1.3+1.3*1.3*integral;
    this.ship.update(t,{rpm:0});this.ship.propeller.rotation.z=turns*Math.PI*2;
    this.rings.update(t,34.8,37.65,1-smoothstep(37.25,38.45,t));this.water.update(t,this.camera);
  }
}

/** S06/SH02 — side tracking right whale mother and calf, distinct body silhouettes. */
export class WhaleStage extends WildlifeBase {
  private water:Underwater;private mother=new RightWhale({length:14,callositySeed:72});
  private calf=new RightWhale({length:5,preset:'calf',callositySeed:13});private fish:FishSchool;
  constructor(renderer?:THREE.WebGLRenderer){
    super();this.water=waterSet(this.scene,.013,renderer);this.scene.add(this.mother,this.calf);
    this.fish=new FishSchool({count:230,length:.25,spread:[7,1.8,2.2],fogColor:this.water.fogColor,fogDensity:.018,seed:901});this.scene.add(this.fish.mesh);
  }
  update(t:number){
    const q=clamp(t-38.6,0,3.7),x=-2.2+q*1.2;
    this.mother.position.set(x,-15,0);this.mother.rotation.set(.19,-.075,.017*Math.sin(q*.7));this.mother.update(q,.04);
    this.calf.position.set(x+2.2,-12.5,1.0);this.calf.rotation.set(.19,-.07,0);this.calf.update(q+.8,.03);
    const lift=smoothstep(41.8,42.3,t);
    this.cameraAt(46,V(x+5.5,-10.5,43.5-q*.3),V(x-.35,-15.4+lift*1.0,0));
    this.fish.update(q,V(x-2,-18,-18),V(1,0,0));this.water.update(t,this.camera);
  }
}

/** S07/SH01 — fully modelled songbird and feather detail in a soft morning background. */
export class SparrowStage extends WildlifeBase {
  private bird=new Songbird({length:.16,seed:44});private sky:SkyDome;private grass:GrassField;private bokeh:BokehField;private rings:SoundRings;
  constructor(renderer?:THREE.WebGLRenderer){
    super();this.scene.background=new THREE.Color(0x6d8466);const sun=V(-.65,.45,.6).normalize();
    this.sky=new SkyDome({sunDirection:sun,zenithColor:0x5d86a3,horizonColor:0xd5caa4,sunIntensity:1.8,sunGlow:.14});this.scene.add(this.sky.mesh);lighting(this.scene,sun,3.2);
    if(renderer){this.scene.environment=this.sky.toEnvironment(renderer);this.scene.environmentIntensity=.3;}
    this.bird.position.set(0,1.1,0);this.scene.add(this.bird);
    const wire=new THREE.MeshStandardMaterial({color:0x81847c,roughness:.39,metalness:.8});rod(this.scene,V(-2,1.1,0),V(2,1.1,0),.002,wire);
    const timber=basic(0x746a51,.91);box(this.scene,[-.32,.58,0],[.09,1.2,.09],timber);
    for(let i=0;i<15;i++)rod(this.scene,V(-.362+i*.005,.02,.046),V(-.362+i*.005,1.16,.046),.00065,basic(i%2?0x83775d:0x5f573f));
    this.grass=new GrassField({area:[-3,3,-3,-.12],count:14000,minHeight:.13,maxHeight:.35,flowerFraction:.035,flowerColor:0xf4e9a8,sunDirection:sun,fogColor:0x839976,fogDensity:.15,seed:781});this.scene.add(this.grass.mesh);
    // A softly graded photographic-style defocus background, behind real foreground geometry.
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=384;const c=canvas.getContext('2d')!;
    const gr=c.createLinearGradient(0,0,0,384);gr.addColorStop(0,'#a3aa8b');gr.addColorStop(.42,'#829274');gr.addColorStop(1,'#3b5235');c.fillStyle=gr;c.fillRect(0,0,256,384);
    const rand=rng(45);for(let i=0;i<38;i++){const xx=rand()*256,yy=rand()*384,rr=20+rand()*60;const bg=c.createRadialGradient(xx,yy,0,xx,yy,rr);bg.addColorStop(0,i%3?'rgba(208,218,149,.16)':'rgba(49,79,44,.22)');bg.addColorStop(1,'rgba(113,132,75,0)');c.fillStyle=bg;c.fillRect(xx-rr,yy-rr,rr*2,rr*2);}
    const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;
    const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshBasicMaterial({map:tx}));backdrop.position.set(-.4,1.2,-2);this.scene.add(backdrop);
    this.bokeh=new BokehField({count:35,center:V(-.20,1.18,-.9),extent:V(.62,.70,.20),colors:[0xffde91,0xcad4b3,0xacc7c2],size:50,gain:.14,seed:96});this.scene.add(this.bokeh.points);
    this.rings=new SoundRings({mode:'air',maxRadius:.29,speedVisual:.19,emissionRate:1.4,count:3,color:0xf3e6c8,opacity:.12,thickness:.004});this.rings.position.set(.067,1.183,.02);this.scene.add(this.rings);
  }
  update(t:number){
    const q=clamp((t-42.3)/3.4),song=(smoothstep(42.60,42.73,t)*(1-smoothstep(44.42,44.6,t))+smoothstep(44.9,45.04,t)*(1-smoothstep(45.5,45.7,t)));
    this.cameraAt(29,V(.22-q*.025,1.176,.675-q*.035),V(-.005,1.174,0));
    this.bird.update(t,{songEnvelope:song,headTurn:-.06+.18*Math.sin((t-42.3)*1.4),tailFlick:Math.exp(-Math.pow((t-44.7)/.11,2))});
    this.rings.update(t,42.7,45.35,song*.8);this.sky.follow(this.camera);this.bokeh.update(t);this.grass.update(t,{bend:.1,direction:new THREE.Vector2(1,.3),gust:.2});
  }
}

/** S07/SH02 — physically sized birds with overlay anchors, 25 m vs 48.5 m propagation. */
export class BirdReachStage extends WildlifeBase {
  readonly singerAnchor=V(0,1.2,10);readonly listenerAnchor=V(4,4,-38.33);
  private city:CityStreet;private sky:SkyDome;private grass:GrassField;private singer=new Songbird({seed:44});private listener=new Songbird({seed:79});
  private oldRing:SoundRings;private newRing:SoundRings;private haze:THREE.Mesh;
  constructor(renderer?:THREE.WebGLRenderer){
    super();const sun=V(-.6,.4,.2).normalize();this.city=new CityStreet({seed:4075,roadWidth:20,sidewalkWidth:4,blocks:7,wetness:0,storeysMin:2,storeysMax:4,farFieldRadius:0,windowOccupancy:.25});this.scene.add(this.city.group);
    this.sky=new SkyDome({sunDirection:sun,zenithColor:0x5385a3,horizonColor:0xc9d0c3,sunIntensity:4,sunGlow:.17});this.scene.add(this.sky.mesh);lighting(this.scene,sun,3);
    if(renderer){this.scene.environment=this.sky.toEnvironment(renderer);this.scene.environmentIntensity=.35;}
    this.scene.fog=new THREE.FogExp2(0xb4c4bc,.0048);
    box(this.scene,[0,.15,-15],[3.8,.3,68],basic(0x8c937f));box(this.scene,[0,.315,-15],[3.5,.025,67.5],basic(0x566442));
    this.grass=new GrassField({area:[-1.7,1.7,-48,18],count:25000,minHeight:.15,maxHeight:.36,flowerFraction:.026,flowerColor:0xf4e9a8,ground:()=>.33,sunDirection:sun,seed:832});this.scene.add(this.grass.mesh);
    const wire=basic(0x707967,.55);for(let z=-45;z<19;z+=5)rod(this.scene,V(-1.35,.3,z),V(-1.35,1.22,z),.025,wire);rod(this.scene,V(-1.35,1.16,-46),V(-1.35,1.16,20),.004,wire);
    // Perch bridge at singer; second perch is integrated into a street planter tree.
    rod(this.scene,V(-1.35,1.2,10),V(.25,1.2,10),.004,wire);
    this.singer.position.copy(this.singerAnchor);this.listener.position.copy(this.listenerAnchor);this.listener.rotation.y=Math.PI;this.scene.add(this.singer,this.listener);
    box(this.scene,[4,.4,-38.33],[2.4,.8,2.4],basic(0x8a8b78));
    const tree=new BroadleafTree({height:6.2,canopyWidth:4,leafCount:2400,seed:66});tree.position.set(4,.8,-38.33);this.scene.add(tree);
    this.oldRing=new SoundRings({mode:'ground',color:0x8daba9,opacity:.47,speedVisual:28,maxRadius:25,count:1,thickness:.005});this.newRing=new SoundRings({mode:'ground',color:0xffebbc,opacity:.62,speedVisual:40,maxRadius:48.5,count:1,thickness:.005});
    this.oldRing.position.set(0,.55,10);this.newRing.position.copy(this.oldRing.position);this.scene.add(this.oldRing,this.newRing);
    this.haze=new THREE.Mesh(new THREE.CylinderGeometry(25,25,3,96,1,true),new THREE.MeshBasicMaterial({color:0x8a9096,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));this.haze.position.set(0,1.6,10);this.scene.add(this.haze);
  }
  update(t:number){
    const q=clamp((t-45.7)/2.9);this.cameraAt(49,V(-24+q*1.7,37-q,53-q*1.4),V(0,-1,-3));
    this.city.update(t,{wetness:0,lights:.25});this.sky.follow(this.camera);this.grass.update(t,{bend:.1,direction:new THREE.Vector2(1,.3),gust:.2});
    this.singer.update(t,{songEnvelope:1});this.listener.update(t,{headTurn:smoothstep(47.95,48.2,t)*.65});
    this.oldRing.pulse(t-45.7,25,1-smoothstep(46.65,46.95,t));this.newRing.pulse(t-46.95,48.5,smoothstep(46.95,47.1,t));
    (this.haze.material as THREE.MeshBasicMaterial).opacity=.12*(1-smoothstep(46.7,46.95,t));
  }
}
