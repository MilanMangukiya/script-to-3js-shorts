import * as THREE from 'three';

/** Procedural estuary with branching channels, wet mud, and a tide controlled water sheet. */
export class TidalFlat {
  readonly group=new THREE.Group(); readonly water: THREE.Mesh;
  constructor(public size=220, seed=13) {
    const N=96,g=new THREE.PlaneGeometry(size,size,N,N);g.rotateX(-Math.PI/2);
    const p=g.attributes.position as THREE.BufferAttribute, colors:number[]=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i), bank=.018*x+.006*z;
      const channel=Math.exp(-Math.pow((z-13*Math.sin(x*.045)-5*Math.sin(x*.13))*.08,2))*1.45;
      const creek=Math.exp(-Math.pow((x+36+8*Math.sin(z*.06))*.12,2))*.7;
      const h=bank-channel-creek+.07*Math.sin(x*.43+z*.18)*Math.cos(z*.31);
      p.setY(i,h);const wet=THREE.MathUtils.clamp((h+1.5)/4,0,1);const c=new THREE.Color().setRGB(.12+wet*.12,.14+wet*.12,.14+wet*.10);colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const mud=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.34,metalness:.06,side:THREE.DoubleSide}));this.group.add(mud);
    const waterMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTide:{value:0}},
      vertexShader:`varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uTide;varying vec3 vP;void main(){float x=vP.x,z=vP.z;float bank=.018*x+.006*z;float channel=exp(-pow((z-13.*sin(x*.045)-5.*sin(x*.13))*.08,2.))*1.45;float creek=exp(-pow((x+36.+8.*sin(z*.06))*.12,2.))*.7;float h=bank-channel-creek+.07*sin(x*.43+z*.18)*cos(z*.31);if(h>uTide)discard;float dep=clamp((uTide-h)*.5,0.,1.);gl_FragColor=vec4(mix(vec3(.05,.15,.20),vec3(.12,.33,.39),dep),.78);}`});
    this.water=new THREE.Mesh(new THREE.PlaneGeometry(size,size).rotateX(-Math.PI/2),waterMat);this.water.position.y=0;this.group.add(this.water);
    // Tall marsh tufts stay on the higher outer bank.
    let state=seed>>>0;const rand=()=>((state=(1664525*state+1013904223)>>>0)/4294967296);
    const blades=new THREE.InstancedMesh(new THREE.ConeGeometry(.2,2,3),new THREE.MeshStandardMaterial({color:0x77836c,roughness:1}),1200);
    const d=new THREE.Object3D();for(let i=0;i<1200;i++){const x=(rand()-.5)*size,z=(rand()-.5)*size;d.position.set(x,1.5+rand(),z);d.scale.set(.3+rand()*.4,.4+rand()*.8,.3+rand()*.4);d.rotation.y=rand()*6.28;d.updateMatrix();blades.setMatrixAt(i,d.matrix);}this.group.add(blades);
  }
  set tideLevel(v:number){this.water.position.y=v;(this.water.material as THREE.ShaderMaterial).uniforms.uTide.value=v;}
}
