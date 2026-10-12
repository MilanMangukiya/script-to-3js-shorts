import * as THREE from 'three';

/** Small scarab pushing a fibrous ball; gait and rolling are functions of absolute time. */
export class DungBeetle {
  readonly group=new THREE.Group(); private legs:THREE.Group[]=[];private ball:THREE.Mesh;
  constructor(public length=.045,public speed=.012) {
    const dark=new THREE.MeshPhysicalMaterial({color:0x10271f,roughness:.27,metalness:.38,clearcoat:.9});
    const shell=new THREE.Mesh(new THREE.SphereGeometry(length*.44,24,16),dark);shell.scale.set(.74,.52,1.1);shell.position.y=length*.30;this.group.add(shell);
    const seam=new THREE.Mesh(new THREE.BoxGeometry(.001,length*.25,length*.65),new THREE.MeshBasicMaterial({color:0x07130e}));seam.position.set(0,length*.48,0);this.group.add(seam);
    const head=new THREE.Mesh(new THREE.SphereGeometry(length*.18,16,12),dark);head.position.set(0,length*.28,-length*.45);this.group.add(head);
    const legMat=new THREE.MeshStandardMaterial({color:0x1d3026,metalness:.2,roughness:.45});
    for(let s of [-1,1])for(let i=0;i<3;i++){const pivot=new THREE.Group();pivot.position.set(s*length*.24,length*.28,(i-1)*length*.25);const leg=new THREE.Mesh(new THREE.CylinderGeometry(length*.02,length*.009,length*.53,6),legMat);leg.rotation.z=s*.85;leg.position.set(s*length*.16,-length*.14,0);pivot.add(leg);this.group.add(pivot);this.legs.push(pivot);}
    this.ball=new THREE.Mesh(new THREE.IcosahedronGeometry(length*.43,2),new THREE.MeshStandardMaterial({color:0x4a3729,roughness:1,flatShading:true}));this.ball.position.set(0,length*.43,-length*1.4);this.group.add(this.ball);
    for(let i=0;i<18;i++){const a=i*2.399,r=length*.36;const f=new THREE.Mesh(new THREE.BoxGeometry(length*.025,length*.008,length*.16),new THREE.MeshStandardMaterial({color:0x695441,roughness:1}));f.position.set(Math.cos(a)*r,length*.43+Math.sin(a)*r,-length*1.4);f.rotation.z=a;this.group.add(f);}
  }
  update(t:number){this.group.position.x=(t-48.4)*this.speed;this.ball.rotation.x=-(t-48.4)*this.speed/(this.length*.43);this.legs.forEach((v,i)=>v.rotation.z=Math.sin(t*17+i*2.3)*.26);}
}
