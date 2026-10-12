import * as THREE from 'three';

/** Exaggerated equilibrium tidal-potential contours around a planet; directions and amplitudes are relative. */
export class TidalBulge {
  readonly group = new THREE.Group();
  private lines: THREE.LineLoop[] = [];
  constructor(public radius = 3, colors: number[] = [0x66c7c1, 0xffb45c]) {
    for (let k=0;k<colors.length;k++) {
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(256*3),3));
      const line=new THREE.LineLoop(g,new THREE.LineBasicMaterial({color:colors[k],transparent:true,opacity:.78,depthTest:false}));
      line.renderOrder=5;this.group.add(line);this.lines.push(line);
    }
  }
  update(bodies: {direction: THREE.Vector3; amplitude: number}[], phase=0) {
    for(let k=0;k<this.lines.length;k++){
      const line=this.lines[k], body=bodies[k];line.visible=!!body;if(!body)continue;
      const d=body.direction.clone().normalize();const a=line.geometry.attributes.position as THREE.BufferAttribute;
      for(let i=0;i<256;i++) {const q=2*Math.PI*i/256+phase, x=Math.cos(q),y=Math.sin(q),dot=x*d.x+y*d.y;
        const r=this.radius*(1+.19*body.amplitude*(1.5*dot*dot-.5));a.setXYZ(i,x*r,y*r,0);
      }a.needsUpdate=true;
    }
  }
}
