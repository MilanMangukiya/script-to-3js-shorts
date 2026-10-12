import * as THREE from 'three';

export interface MoonOptions { radius?: number; seed?: number; sunDirection?: THREE.Vector3; albedoRock?: number; albedoIce?: number }

/** Reusable procedural near-side Moon. iceAmount and sunDirection are deterministic setters. */
export class Moon {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private static maps: { rock: THREE.CanvasTexture; ice: THREE.CanvasTexture } | undefined;
  constructor(o: MoonOptions = {}) {
    const maps = Moon.maps ??= makeMaps(o.seed ?? 31);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { rock: { value: maps.rock }, ice: { value: maps.ice }, uIce: { value: 0 }, uFront: { value: 0 }, uSun: { value: (o.sunDirection ?? new THREE.Vector3(0.5, 0.3, 1)).clone().normalize() }, uRock: { value: o.albedoRock ?? 0.12 }, uAlbedoIce: { value: o.albedoIce ?? 0.75 }, uEarthshine: { value: 0.02 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader: `uniform sampler2D rock,ice; uniform float uIce,uFront,uRock,uAlbedoIce,uEarthshine,uTime; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN,vP;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vP); float mu=max(dot(N,normalize(uSun)),0.); float mv=max(dot(N,V),0.);
      float edge=hash(floor(vUv*280.))*0.055; float s=(vUv.x+vUv.y*0.42+edge)/1.48;
      float a=smoothstep(s-0.08,s+0.08,uIce*1.2-0.1); vec3 r=texture2D(rock,vUv).rgb; vec3 i=texture2D(ice,vUv).rgb;
      float illum=mu/(mu+mv+0.13); illum=0.06+1.7*illum+uEarthshine*(1.-step(0.02,mu));
      vec3 col=mix(r*uRock*3.8,i*uAlbedoIce*3.8,a)*illum;
      float rim=pow(1.-mv,5.)*a*mu; col+=vec3(.20,.45,.65)*rim*.16;
      gl_FragColor=vec4(col,1.);}`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(o.radius ?? 1, 160, 96), this.mat);
    this.group.add(this.mesh);
  }
  set iceAmount(v: number) { this.mat.uniforms.uIce.value = v; }
  set sunDirection(v: THREE.Vector3) { this.mat.uniforms.uSun.value.copy(v).normalize(); }
  set earthshine(v: number) { this.mat.uniforms.uEarthshine.value = v; }
  update(t: number) { this.mat.uniforms.uTime.value = t; }
}

function makeMaps(seed: number) {
  const W = 1024, H = 512, canv = [document.createElement('canvas'), document.createElement('canvas')];
  let state = seed >>> 0; const rand = () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
  const maria: [number,number,number,number][] = [[.48,.44,.095,.08],[.60,.35,.12,.11],[.40,.53,.13,.09],[.52,.62,.08,.065],[.68,.52,.06,.05],[.30,.39,.055,.055]];
  for (let k=0;k<2;k++) {
    const c=canv[k]; c.width=W;c.height=H; const g=c.getContext('2d')!;
    g.fillStyle=k?'#c8e5ed':'#a9a8a7';g.fillRect(0,0,W,H);
    const img=g.getImageData(0,0,W,H), d=img.data;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const j=(y*W+x)*4, nx=x/W,ny=y/H;let m=0;
      for(const [cx,cy,rx,ry] of maria) { const q=((nx-cx)/rx)**2+((ny-cy)/ry)**2; m=Math.max(m,1-smooth(0.62,1.25,q)); }
      const fine=rand()-.5, stria=Math.sin(nx*300+Math.sin(ny*70)*4)*Math.sin(ny*135+nx*50);
      const b=k ? 0.86+fine*.075+stria*.025 : 0.91-m*.43+fine*.12;
      d[j]=Math.min(255,d[j]*b);d[j+1]=Math.min(255,d[j+1]*b);d[j+2]=Math.min(255,d[j+2]*b);
    }
    g.putImageData(img,0,0);
    for(let n=0;n<(k?700:900);n++) {const x=rand()*W,y=rand()*H,r=(.5+Math.pow(rand(),4)*13)*(k?1.2:1);
      g.strokeStyle=k?'rgba(255,255,255,.24)':'rgba(238,236,231,.25)';g.lineWidth=Math.max(.4,r*.17);g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();
      g.fillStyle=k?'rgba(51,94,122,.08)':'rgba(42,40,43,.10)';g.beginPath();g.arc(x-r*.12,y+r*.1,r*.75,0,Math.PI*2);g.fill();
    }
    if(k) for(let n=0;n<180;n++){let x=rand()*W,y=rand()*H;g.strokeStyle='rgba(61,124,149,.17)';g.lineWidth=.35+rand()*.9;g.beginPath();g.moveTo(x,y);for(let a=0;a<5;a++){x+=rand()*25-12;y+=rand()*23-11;g.lineTo(x,y);}g.stroke();}
  }
  const tex=canv.map(c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=8;return t;});
  return {rock:tex[0],ice:tex[1]};
}
function smooth(a:number,b:number,x:number){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
