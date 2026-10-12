import * as THREE from 'three';

/** Layered, vertically exaggerated deep-ocean slice with deterministic current and mixing cues. */
export class OceanCrossSection {
  readonly group=new THREE.Group(); private arrows:THREE.Group[]=[];private eddies:THREE.Mesh[]=[];
  constructor(public width=40,public depth=5,seed=17) {
    const bg=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({color:0x0a3251,side:THREE.DoubleSide}));bg.position.y=-depth/2;bg.position.z=-1;this.group.add(bg);
    for(let j=0;j<7;j++){const band=new THREE.Mesh(new THREE.PlaneGeometry(width,depth/7),new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(.015+j*.009,.08+j*.017,.13+j*.022),transparent:true,opacity:.7,side:THREE.DoubleSide}));band.position.set(0,-depth+(j+.5)*depth/7,-.7+j*.01);this.group.add(band);}
    const shape=new THREE.Shape();shape.moveTo(-width/2,-depth);for(let i=0;i<=80;i++){const x=-width/2+i*width/80,y=-depth+2.6*Math.exp(-((x/7)**2))+.25*Math.sin(x*.8);shape.lineTo(x,y);}shape.lineTo(width/2,-depth-3);shape.lineTo(-width/2,-depth-3);
    const floor=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:0x172635,roughness:.95,side:THREE.DoubleSide}));floor.position.z=.5;this.group.add(floor);
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(width,.045),new THREE.MeshBasicMaterial({color:0x83d5e7}));surface.position.z=.2;this.group.add(surface);
    for(let k=0;k<12;k++){const group=new THREE.Group();const mat=new THREE.MeshBasicMaterial({color:k%2?0x64b6d7:0x8fd6df,transparent:true,opacity:.64});const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.1,6),mat);shaft.rotation.z=Math.PI/2;group.add(shaft);const head=new THREE.Mesh(new THREE.ConeGeometry(.13,.32,8),mat);head.rotation.z=-Math.PI/2;head.position.x=.66;group.add(head);group.position.set(-15+(k%6)*6,-1.2-Math.floor(k/6)*1.15,.8);this.group.add(group);this.arrows.push(group);}
    let state=seed>>>0;const rand=()=>((state=(1664525*state+1013904223)>>>0)/4294967296);
    for(let i=0;i<250;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.018+rand()*.027,5,4),new THREE.MeshBasicMaterial({color:0x7ac8e2,transparent:true,opacity:.45}));m.userData={x:(rand()-.5)*21,y:rand()*3.3,p:rand()*6.28};this.group.add(m);this.eddies.push(m);}
  }
  update(t:number,mixing=1){for(let i=0;i<this.arrows.length;i++){const a=this.arrows[i];a.scale.x=(.35+.65*mixing)*(.85+.15*Math.sin(t*1.4));a.rotation.z=.07*Math.sin(t*1.2+i*.5);}
    for(let i=0;i<this.eddies.length;i++){const m=this.eddies[i],d=m.userData;const q=(d.y+t*(.12+.13*mixing))%3.3;m.position.set(d.x+Math.sin(t*.6+d.p)*(.2+mixing*.3),-4.5+q,.9);m.visible=i<Math.floor(250*mixing);}
  }
}
