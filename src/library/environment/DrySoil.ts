import * as THREE from 'three';
export interface DrySoilOptions {size?:number;cellSize?:number;color?:THREE.ColorRepresentation;dryColor?:THREE.ColorRepresentation;}
/** PBR polygonal desiccation cracks; dryness is a reversible 0..1 visual control. */
export class DrySoil {
  readonly mesh:THREE.Mesh;private u:Record<string,THREE.IUniform>;
  constructor(o:DrySoilOptions={}){
    this.u={uDry:{value:0},uCell:{value:o.cellSize??.45},uDryColor:{value:new THREE.Color(o.dryColor??0xba8957)}};
    const mat=new THREE.MeshStandardMaterial({color:o.color??0x615e3d,roughness:.95});
    mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,this.u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSoil;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSoil=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vSoil;uniform float uDry,uCell;uniform vec3 uDryColor;
      vec2 soilHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
      float cracks(vec2 p){vec2 ip=floor(p),fp=fract(p);float a=10.,b=10.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 q=vec2(float(x),float(y));float d=length(q+soilHash(ip+q)-fp);if(d<a){b=a;a=d;}else if(d<b)b=d;}return 1.-smoothstep(.012,.045,b-a);}
    `).replace('#include <color_fragment>',`#include <color_fragment>
      float c=cracks(vSoil.xz/uCell);float grain=soilHash(floor(vSoil.xz*310.)).x;
      diffuseColor.rgb=mix(diffuseColor.rgb,uDryColor,uDry)*(0.92+grain*.16)*(1.-c*uDry*.8);
    `);};
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(o.size??300,o.size??300).rotateX(-Math.PI/2),mat);this.mesh.receiveShadow=true;
  }
  set dryness(v:number){this.u.uDry.value=THREE.MathUtils.clamp(v,0,1);}
}
