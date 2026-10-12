import * as THREE from 'three';
import type { FilmDefinition, Stage, ShotInfo, OverlayContext } from '../../library/render/FilmPipeline';
import { Moon } from '../../library/planet/Moon';
import { Earth, loadEarthTextures, type EarthTextures } from '../../library/planet/Earth';
import { SkyDome } from '../../library/environment/SkyDome';
import { Starfield } from '../../library/space/Starfield';
import { OceanSurface } from '../../library/environment/OceanSurface';
import { Terrain } from '../../library/environment/Terrain';
import { Humanoid, POSE_STAND } from '../../library/characters/Humanoid';
import { Sailboat } from '../../library/vehicles/Sailboat';
import { GrassField } from '../../library/environment/GrassField';
import { BirdFlock } from '../../library/creatures/BirdFlock';
import { BokehField } from '../../library/fx/BokehField';
import { WaterMolecules } from '../../library/diagram/WaterMolecules';
import { DialGauge } from '../../library/props/DialGauge';
import { TidalBulge } from '../../library/diagram/TidalBulge';
import { TidalFlat } from '../../library/environment/TidalFlat';
import { OceanCrossSection } from '../../library/diagram/OceanCrossSection';
import { DungBeetle } from '../../library/creatures/DungBeetle';
import { drawChip, drawTag, drawRich } from '../../library/overlay/Labels';
import { smoothstep } from '../../library/util/math';

const TEAL='#6bd4cb', AMBER='#ffc37a';
const mat=(c:number,r=.8)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:[number,number,number])=>{const x=new THREE.Mesh(g,m);x.position.set(...p);return x;};
const light=(s:THREE.Scene,p:[number,number,number],power=2)=>{const l=new THREE.DirectionalLight(0xd7e9ff,power);l.position.set(...p);s.add(l,new THREE.HemisphereLight(0x9cb9d7,0x0c1728,.65));return l;};
const scene=()=>{const s=new THREE.Scene();s.background=new THREE.Color(0x020813);return s;};
abstract class Base implements Stage {scene=scene();camera=new THREE.PerspectiveCamera(35,9/16,.01,100000);abstract update(t:number,shot:ShotInfo):void;}

class SeaMoon extends Base {
  moon=new Moon({radius:45.4,sunDirection:new THREE.Vector3(.12,.2,1)});water=new OceanSurface({size:60000,waveHeight:.42,deepColor:0x081d30,horizonColor:0x637188,zenithColor:0x142444,fogColor:0x474d68,fogDensity:.00003,sunDirection:new THREE.Vector3(0,.027,-1),sunColor:0xd7e7f3});stars=new Starfield({count:600,radius:9000,minY:.05,brightness:.17});
  constructor(){super();this.camera.near=.1;this.camera.far=30000;this.moon.group.position.set(0,262,-10000);this.scene.add(new SkyDome({zenithColor:0x040d25,horizonColor:0x48445f,groundColor:0x0b1830,hazeColor:0x8c7381,hazeAmount:.16,sunIntensity:0,sunGlow:0}).mesh,this.stars.points,this.water.mesh,this.moon.group);this.scene.fog=new THREE.FogExp2(0x242e4a,.000018);}
  update(t:number,shot:ShotInfo){const loop=shot.sceneId==='S10';this.camera.lookAt(0,85,-10000);this.camera.updateMatrixWorld(true);this.moon.iceAmount=loop?0:smoothstep(.6,2.1,t);this.water.uniforms.uGlitter.value=.0025*(loop?1:1+5*smoothstep(1,2.4,t));this.water.update(loop?t-74:t);this.stars.follow(this.camera);this.moon.update(t);}
}
class SpaceMoon extends Base {
  moon=new Moon({radius:1.737});stars=new Starfield({count:1900,radius:150,brightness:.3});outline:THREE.LineLoop;vapor:THREE.Mesh;
  constructor(){super();this.camera.far=500;this.scene.add(this.moon.group,this.stars.points);const g=new THREE.BufferGeometry().setFromPoints(Array.from({length:192},(_,i)=>new THREE.Vector3(1.76*Math.cos(i*2*Math.PI/192),1.76*Math.sin(i*2*Math.PI/192),.05)));this.outline=new THREE.LineLoop(g,new THREE.LineDashedMaterial({color:0xadd9e0,dashSize:.08,gapSize:.055,transparent:true,opacity:.8}));this.outline.computeLineDistances();this.scene.add(this.outline);
    this.vapor=new THREE.Mesh(new THREE.SphereGeometry(1.79,96,64),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uFade:{value:0}},vertexShader:`varying vec3 vN,vP;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`uniform float uTime,uFade;varying vec3 vN,vP;void main(){vec3 n=normalize(vN),v=normalize(cameraPosition-vP);float rim=pow(1.-max(dot(n,v),0.),4.);float sun=smoothstep(-.1,.3,n.x);float wisps=.65+.35*sin(n.y*80.+uTime*.7)*sin(n.z*57.-uTime*.4);float a=.085*rim*sun*wisps*uFade;gl_FragColor=vec4(.48,.78,1.,a);}`}));this.scene.add(this.vapor);}
  update(t:number,shot:ShotInfo){const face=shot.key==='S02/SH02',limb=shot.sceneId==='S09';this.moon.group.scale.setScalar(limb?1:face?.38:.5);this.outline.scale.setScalar(limb?1:face?.38:.5);this.moon.iceAmount=face?smoothstep(9.9,10.9,t):1;this.moon.sunDirection=limb?new THREE.Vector3(1,.2,.15):face?new THREE.Vector3(0,.1,1):new THREE.Vector3(1,.3,.5);this.moon.earthshine=limb?.07:.02;this.outline.visible=shot.key==='S02/SH01'&&t>4.6&&t<7.6;this.vapor.visible=limb;const vm=this.vapor.material as THREE.ShaderMaterial;vm.uniforms.uTime.value=t;vm.uniforms.uFade.value=smoothstep(61.6,62.8,t);this.stars.follow(this.camera);this.moon.update(t);}
}
class Cove extends Base {
  water=new OceanSurface({size:1600,waveHeight:.2,deepColor:0x071e2d,horizonColor:0x172c49,zenithColor:0x091831,glitter:1});stars=new Starfield({count:1400,radius:500,minY:.03,brightness:.4});person=new Humanoid({height:1.75,coat:'long',coatColor:0x171e29,scarfColor:0x8c7774});moonlight:THREE.DirectionalLight;
  constructor(){super();this.camera.far=1200;this.scene.add(new SkyDome({zenithColor:0x030b1b,horizonColor:0x172a45,groundColor:0x06111f,hazeAmount:.05,sunIntensity:0,sunGlow:0}).mesh,this.stars.points,this.water.mesh);this.moonlight=light(this.scene,[-8,15,5],.45);this.person.root.position.set(0,1,-9);this.person.root.rotation.y=Math.PI;this.scene.add(this.person.root);
    const wood=mat(0x4d514c);for(let i=0;i<16;i++)this.scene.add(mesh(new THREE.BoxGeometry(3.2,.13,.85),wood,[0,.85,3-i*.95]));for(let z of [-7,-1,3])for(let x of [-1.35,1.35])this.scene.add(mesh(new THREE.BoxGeometry(.13,2.2,.13),wood,[x,.1,z]));
    const headland=new Terrain({width:280,depth:240,peakHeight:95,segmentsX:70,segmentsZ:55,treeLine:500,snowLine:900});headland.mesh.position.set(-180,-12,-300);this.scene.add(headland.mesh);this.scene.fog=new THREE.FogExp2(0x09172c,.002);
  }
  update(t:number,shot:ShotInfo){const bright=shot.key==='S03/SH02',f=bright?smoothstep(15.3,16.7,t):0;this.moonlight.intensity=.45+2.25*f;this.water.uniforms.uGlitter.value=1+5*f;this.water.update(t);this.stars.brightness=.4-.29*f;this.stars.follow(this.camera);this.person.setPose({...POSE_STAND,headYaw:f*.45,armR:[-.7*f,.13,.45*f],breath:.015*Math.sin(t*1.2)});}
}
class Cutaway extends Base {
  a=new Moon({radius:1.2});b=new Moon({radius:1.2});
  constructor(){super();this.a.group.position.y=1.35;this.b.group.position.y=-1.35;this.b.iceAmount=1;this.scene.add(this.a.group,this.b.group);light(this.scene,[6,7,13],3);
    for(let y of [1.35,-1.35]){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.22,.018,8,100),new THREE.MeshBasicMaterial({color:y>0?0x6bd4cb:0xffc37a}));ring.position.set(0,y,1.1);this.scene.add(ring);}
    const core=mesh(new THREE.SphereGeometry(.72,48,32),new THREE.MeshBasicMaterial({color:0x527e9b,transparent:true,opacity:.33}),[0,-1.35,1.1]);this.scene.add(core);
  }
  update(t:number){this.a.iceAmount=0;this.b.iceAmount=1;this.a.update(t);this.b.update(t);this.a.group.rotation.y=.16*Math.sin(t*.3);this.b.group.rotation.y=.16*Math.sin(t*.3);}
}
class TideEarth extends Base {
  earth:Earth; bulge=new TidalBulge(3,[0x6bd4cb,0xffc37a]);moon=new Moon({radius:.68});
  constructor(tex:EarthTextures){super();this.earth=new Earth(tex,{radius:3,cloudOpacity:.75,atmosphereStrength:.7});this.earth.spinRate=0;this.earth.setView(-25,10);this.scene.add(this.earth.group,this.bulge.group,this.moon.group);this.moon.group.position.set(14,0,0);this.moon.iceAmount=1;const sun=mesh(new THREE.SphereGeometry(1.1,24,16),new THREE.MeshBasicMaterial({color:0xffcf78}),[-16,1,0]);this.scene.add(sun);light(this.scene,[15,7,15],1.5);}
  update(t:number,shot:ShotInfo){this.earth.update(t);this.moon.update(t);const top=shot.sceneId==='S05',cx=top?0:8;this.earth.group.position.x=cx;this.bulge.group.position.x=cx;this.moon.group.position.set(top?8*Math.cos(t*.42):13,top?8*Math.sin(t*.42):0,0);this.bulge.update([{direction:new THREE.Vector3(this.moon.group.position.x-cx,this.moon.group.position.y,0),amplitude:top?.31:smoothstep(23.6,25.2,t)*.31+1-smoothstep(23.6,25.2,t)},{direction:new THREE.Vector3(-1,.1,0),amplitude:.46}]);this.bulge.group.rotation.x=top?-.4:0;}
}
class TideClock extends Base {
  today=new DialGauge({radius:.72,min:0,max:24,arcDegrees:360,majorStep:3,minorStep:1,labelStep:6,unit:'H',title:'TODAY',bezel:'steel'});ice=new DialGauge({radius:.72,min:0,max:24,arcDegrees:360,majorStep:3,minorStep:1,labelStep:6,unit:'H',title:'ICE MOON',bezel:'steel'});
  constructor(){super();this.today.group.position.set(0,1.2,0);this.ice.group.position.set(0,-.8,0);this.scene.add(this.today.group,this.ice.group);light(this.scene,[0,5,8],2.8);}
  update(t:number){this.today.value=9+(t-32.7)*.83;this.ice.value=9+.14*Math.sin((t-32.7)*1.1);}
}
class Estuary extends Base {
  flat=new TidalFlat(240);birds=new BirdFlock({count:130,seed:19,wingspan:.4,spread:[80,1,45],bodyColor:0xdedcd2,wingColor:0xb7bdba});water=new OceanSurface({size:1600,waveHeight:.15,glitter:.65});fisher=new Humanoid({height:1.75,coatColor:0xd5a543,hat:true});boats:Sailboat[]=[];
  quay:THREE.Group=new THREE.Group();
  constructor(){super();this.camera.far=2500;this.scene.background=new THREE.Color(0x9aaebe);this.scene.add(new SkyDome({zenithColor:0x668ea8,horizonColor:0xc2b4a5,sunIntensity:0,sunGlow:.04}).mesh);this.scene.add(this.flat.group,this.birds.mesh,this.water.mesh,this.quay);this.birds.mesh.position.y=2;this.fisher.root.position.set(-2,.55,-3);this.scene.add(this.fisher.root);for(let i=0;i<3;i++){const b=new Sailboat({length:3.7,sails:false,seed:22+i});b.group.position.set(-3+i*3,0,-8-i*2);this.scene.add(b.group);this.boats.push(b);}const q=mat(0x666962);this.quay.add(mesh(new THREE.BoxGeometry(9,1.3,4),q,[-2,-.2,1]));for(let i=0;i<5;i++)this.quay.add(mesh(new THREE.BoxGeometry(.3,2,.3),q,[-6+i*2,-.4,-1]));const board=mesh(new THREE.BoxGeometry(3,1.3,.13),mat(0x233747),[-2,2,-3]);this.quay.add(board);light(this.scene,[15,30,8],2.6);}
  update(t:number,shot:ShotInfo){const harbor=shot.key==='S06/SH02';this.flat.group.visible=!harbor;this.birds.mesh.visible=!harbor;this.fisher.root.visible=harbor;this.water.mesh.visible=harbor;this.quay.visible=harbor;for(const b of this.boats)b.group.visible=harbor;if(!harbor){this.flat.tideLevel=-1.6+1.3*smoothstep(38.5,40.8,t);this.birds.update(t,{center:new THREE.Vector3(0,2,-20),heading:new THREE.Vector3(1,0,0),flapRate:.5,glide:.6});}else {this.water.update(t);this.boats.forEach(b=>b.update(t,{bob:.15}));this.fisher.setPose({...POSE_STAND,headYaw:.2*Math.sin(t*.3)});}}
}
class Meadow extends Base {
  grass=new GrassField({area:[-25,25,-35,8],count:13000,minHeight:.14,maxHeight:.5,baseColor:0x65735e,tipColor:0xa4ab88,dryColor:0x9c977c});stars=new Starfield({count:1300,radius:200,brightness:.18,minY:.08});eyes:THREE.Mesh[]=[];
  constructor(){super();this.scene.add(new SkyDome({zenithColor:0x071229,horizonColor:0x1a2b42,sunIntensity:0,sunGlow:0,hazeAmount:.04}).mesh,this.stars.points,this.grass.mesh);const ground=mesh(new THREE.PlaneGeometry(80,80).rotateX(-Math.PI/2),mat(0x303a30),[0,-.05,-12]);this.scene.add(ground);for(let i=0;i<12;i++){const e=mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshBasicMaterial({color:0xdad4a4}),[(i%6-2.5)*2.3,.33,-8-Math.floor(i/6)*6]);this.scene.add(e);this.eyes.push(e);}light(this.scene,[-9,15,5],1.4);}
  update(t:number){this.grass.update(t,{bend:.14,direction:new THREE.Vector2(1,.3),gust:.3});this.stars.follow(this.camera);this.eyes.forEach((e,i)=>{e.visible=t<46.8+i*.1;});}
}
class BeetleStage extends Base {
  beetle=new DungBeetle();bokeh=new BokehField({count:32,center:new THREE.Vector3(0,.1,-.7),extent:new THREE.Vector3(.5,.3,.2),size:110,gain:.04,colors:[0x95c9d5,0xd7d6c0]});pattern=new THREE.Group();
  constructor(){super();this.camera.near=.001;this.camera.far=5;this.scene.add(this.beetle.group,this.bokeh.points,this.pattern,mesh(new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),mat(0x4c5145),[0,-.003,0]));light(this.scene,[-1,3,1],2.2);
    for(let j=0;j<5;j++){const pts=Array.from({length:90},(_,i)=>{const a=i*Math.PI/89;return new THREE.Vector3(Math.cos(a)*(.10+j*.045),.13+Math.sin(a)*(.10+j*.045),-.27-j*.02);});this.pattern.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8dc5de,transparent:true,opacity:.2-j*.025})));}}
  update(t:number){this.beetle.update(t);this.bokeh.update(t);this.pattern.rotation.z=.03*Math.sin(t*.7);}
}
class DeepStage extends Base {slice=new OceanCrossSection(40,5);constructor(){super();this.scene.add(this.slice.group);light(this.scene,[2,10,9],1.8);}update(t:number,shot:ShotInfo){this.slice.update(t,shot.key==='S08/SH01'?1:1-.75*smoothstep(57,58.6,t));}}
class LatticeStage extends Base {molecules=new WaterMolecules({seed:12,cells:2,layers:2,bond:1});floaters:THREE.Mesh[]=[];
  constructor(){super();this.molecules.group.position.y=1;this.scene.add(this.molecules.group);for(let i=0;i<7;i++){const b=mesh(new THREE.SphereGeometry(.14,12,8),mat(0xd25c54,.3),[(i%4-1.5)*1.2,1.8,Math.floor(i/4)*.3]);this.scene.add(b);this.floaters.push(b);}light(this.scene,[4,7,9],2.8);}
  update(t:number){this.molecules.update(t,1);this.floaters.forEach((b,i)=>{const q=Math.max(0,t-65.4-i*.48);b.visible=q>0;b.position.y=1.8+q*.65;b.position.x=(i%4-1.5)*1.2+Math.sin(q+i)*.25;});}
}

export async function createFilm(ctx:{renderer:THREE.WebGLRenderer;base:string}):Promise<FilmDefinition>{
  const tex=await loadEarthTextures(ctx.base,Math.min(8,ctx.renderer.capabilities.getMaxAnisotropy()));
  const sea=new SeaMoon(),space=new SpaceMoon(),cove=new Cove(),cut=new Cutaway(),tide=new TideEarth(tex),clock=new TideClock(),flats=new Estuary(),meadow=new Meadow(),beetle=new BeetleStage(),deep=new DeepStage(),lattice=new LatticeStage();
  const shots:FilmDefinition['shots']={
    'S01/SH01':{stage:sea,post:{exposure:1,bloomStrength:.5}},
    'S02/SH01':{stage:space,post:{exposure:1,bloomStrength:.27}},'S02/SH02':{stage:space,post:{exposure:1,bloomStrength:.33}},
    'S03/SH01':{stage:cove,post:{exposure:1,bloomStrength:.27}},'S03/SH02':{stage:cove,post:{exposure:1,bloomStrength:.27}},
    'S04/SH01':{stage:cut,post:{exposure:1,bloomStrength:.22}},'S04/SH02':{stage:tide,post:{exposure:1,bloomStrength:.24}},
    'S05/SH01':{stage:tide,post:{exposure:1,bloomStrength:.26}},'S05/SH02':{stage:clock,post:{exposure:1,bloomStrength:.16}},
    'S06/SH01':{stage:flats,post:{exposure:1,bloomStrength:.15}},'S06/SH02':{stage:flats,post:{exposure:1,bloomStrength:.16}},
    'S07/SH01':{stage:meadow,post:{exposure:1,bloomStrength:.25}},'S07/SH02':{stage:beetle,post:{exposure:1,bloomStrength:.3}},
    'S08/SH01':{stage:deep,post:{exposure:1,bloomStrength:.38}},'S08/SH02':{stage:deep,post:{exposure:1,bloomStrength:.31}},
    'S09/SH01':{stage:space,post:{exposure:.5,bloomStrength:.18}},'S09/SH02':{stage:lattice,post:{exposure:1,bloomStrength:.3}},
    'S10/SH01':{stage:sea,post:{exposure:1,bloomStrength:.48}},
  };
  const notes:Record<string,[string,string,string?]>={
    'S01/SH01':['WHAT IF','MOON OF ICE','TRUE SIZE · TELEPHOTO VIEW'],
    'S02/SH01':['SAME SIZE','SAME ORBIT','ILLUSTRATIVE'],
    'S02/SH02':['DARK LAVA SEAS','GONE','ILLUSTRATIVE TRANSFORMATION'],
    'S03/SH01':['TODAY','MOONLIGHT','EXPOSURE LOCKED'],
    'S03/SH02':['ICE MOON','≈ 6× BRIGHTER','ESTIMATE · EXPOSURE LOCKED'],
    'S04/SH01':['SAME SIZE','≈ ⅓ THE MASS','SCHEMATIC · ICE INTERIOR SIMPLIFIED'],
    'S04/SH02':['LUNAR TIDAL PULL','≈ 31% OF TODAY','SCHEMATIC · NOT TO SCALE'],
    'S05/SH01':['SUN TAKES OVER','46% VS 31%','SCHEMATIC · NOT TO SCALE'],
    'S05/SH02':['HIGH TIDE','NEARLY THE SAME HOUR','SCHEMATIC · LOCAL DELAYS VARY'],
    'S06/SH01':['MUDFLATS','NARROWER FEEDING GROUND','ILLUSTRATIVE · COASTS VARY'],
    'S06/SH02':['COASTAL LIFE','GENTLER TIDES','ILLUSTRATIVE'],
    'S07/SH01':['BRIGHTER NIGHTS','SOME ANIMALS HIDE','BEHAVIOR VARIES BY SPECIES'],
    'S07/SH02':['MOONLIGHT NAVIGATION','DUNG BEETLE','POLARIZATION SCHEMATIC'],
    'S08/SH01':['TODAY','DEEP-OCEAN MIXING','SCHEMATIC · VERTICAL SCALE EXAGGERATED'],
    'S08/SH02':['ICE MOON','≈ ¼ TIDAL ENERGY','EFFECTS UNCERTAIN'],
    'S09/SH01':['SUNLIT ICE','SLOW VAPOR LOSS','VAPOR ILLUSTRATIVE · INVISIBLE TO EYE'],
    'S09/SH02':['SUBLIMATION','ICE → VAPOR','MOLECULES SCHEMATIC'],
    'S10/SH01':['TODAY','BUILT TO LAST','TRUE SIZE · TELEPHOTO VIEW'],
  };
  const overlay=(o:OverlayContext)=>{const {ctx:c,shot,time_s:t,alpha}=o;const [a,b,tag]=notes[shot.key];c.globalAlpha=alpha;const show=!(shot.sceneId==='S01'&&t<2.2||shot.sceneId==='S10'&&t>72.6);if(show){drawChip(c,a,b,85,225,{dot:shot.key.includes('S10')||shot.key.includes('SH01')?TEAL:AMBER,valueColor:AMBER});if(tag)drawTag(c,tag,105,330,{accent:AMBER,size:20});}
    if(shot.key==='S04/SH01'){drawRich(c,'ROCK  100%',540,710,{size:35,weight:700,color:TEAL,align:'center'});drawRich(c,'ICE  ≈31%',540,1180,{size:35,weight:700,color:AMBER,align:'center'});}
    if(shot.key==='S06/SH02')drawRich(c,'HIGH TIDE ≈ 9 AM DAILY',540,1090,{size:38,weight:700,color:AMBER,align:'center'});
    if(shot.key==='S05/SH01')drawRich(c,'SOLAR TIDE  0.46    ·    ICE MOON  0.31',540,1110,{size:29,weight:700,color:'#e5eced',align:'center'});
    c.globalAlpha=1;};
  return{shots,overlay};
}
