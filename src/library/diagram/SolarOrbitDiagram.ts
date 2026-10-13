import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface SolarOrbitOptions {
  baselineAu?: number; targetAu?: number; unitsPerAu?: number;
  center?: THREE.Vector3; sunRadius?: number; markerRadius?: number;
  habitableInnerAu?: number; habitableOuterAu?: number; segments?: number;
}
/** Orbital geometry and Kepler race. All lengths are diagram units; label NOT TO SCALE. */
export class SolarOrbitDiagram {
  readonly group = new THREE.Group(); readonly rings = new THREE.Group();
  readonly sun: THREE.Mesh; readonly baselineMarker: THREE.Mesh; readonly targetMarker: THREE.Mesh;
  readonly band: THREE.Mesh; private center: THREE.Vector3; private scale: number; private a: number; private b: number;
  constructor(o: SolarOrbitOptions = {}) {
    this.center = o.center?.clone() ?? new THREE.Vector3(); this.scale = o.unitsPerAu ?? 1.4;
    this.a = o.baselineAu ?? 1; this.b = o.targetAu ?? .9;
    const seg = o.segments ?? 256;
    for (const [a,color] of [[this.a,0x4daee0],[this.b,0xffb94c]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(a*this.scale,.007*this.scale,8,seg),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7}));
      ring.rotation.x = Math.PI/2; this.rings.add(ring);
    }
    this.band = new THREE.Mesh(new THREE.RingGeometry((o.habitableInnerAu??.975)*this.scale,(o.habitableOuterAu??1.025)*this.scale,seg),new THREE.MeshBasicMaterial({color:0x47bfa7,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));
    this.band.rotation.x=-Math.PI/2; this.band.position.y=-.01; this.rings.add(this.band);
    this.rings.position.copy(this.center); this.group.add(this.rings);
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(o.sunRadius??.14,64,40),new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vP;uniform float uTime;${GLSL_NOISE}\nvoid main(){float f=fbm3(normalize(vP)*28.+vec3(uTime*.015));gl_FragColor=vec4(vec3(3.6,1.5,.32)*(0.6+f*.8),1.);}`}));
    this.sun.position.copy(this.center); this.group.add(this.sun);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glow(),color:0xffad36,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow.scale.setScalar((o.sunRadius??.14)*8);this.sun.add(glow);
    this.baselineMarker=new THREE.Mesh(new THREE.SphereGeometry(o.markerRadius??.065,24,16),new THREE.MeshBasicMaterial({color:0x65c4ff}));
    this.targetMarker=new THREE.Mesh(this.baselineMarker.geometry,new THREE.MeshBasicMaterial({color:0xffb03d}));
    this.group.add(this.baselineMarker,this.targetMarker);
  }
  private glow(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!,r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,.65)');r.addColorStop(.2,'rgba(255,225,160,.25)');r.addColorStop(1,'rgba(255,200,100,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
  update(time_s:number,orbitProgress=0){
    (this.sun.material as THREE.ShaderMaterial).uniforms.uTime.value=time_s;
    const place=(m:THREE.Mesh,a:number,phase:number)=>m.position.copy(this.center).add(new THREE.Vector3(Math.cos(phase)*a*this.scale,.025,Math.sin(phase)*a*this.scale));
    place(this.baselineMarker,this.a,orbitProgress*Math.PI*2);place(this.targetMarker,this.b,orbitProgress*Math.PI*2*Math.pow(this.a/this.b,1.5));
  }
}
