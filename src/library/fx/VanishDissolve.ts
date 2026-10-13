import * as THREE from 'three';
import { clamp, rng } from '../util/math';

export interface VanishDissolveOptions {
  seed?: number; duration_s?: number; noiseScale?: number; edgeWidth?: number;
  rimColor?: THREE.ColorRepresentation; rimIntensity?: number; moteCount?: number;
  moteLifetime_s?: number; moteDrift?: THREE.Vector3;
}

/** Reversible, stateless world-space material erosion; owner chooses the event time. */
export class VanishDissolve {
  readonly motes: THREE.Points;
  private progress = { value: 0 };
  private offsets: Float32Array;
  private o: Required<Omit<VanishDissolveOptions, 'rimColor' | 'moteDrift'>> & {moteDrift: THREE.Vector3};
  private positions: Float32Array;

  constructor(root: THREE.Object3D, options: VanishDissolveOptions = {}) {
    this.o = { seed: options.seed ?? 1, duration_s: options.duration_s ?? .7, noiseScale: options.noiseScale ?? 16,
      edgeWidth: options.edgeWidth ?? .035, rimIntensity: options.rimIntensity ?? .6,
      moteCount: options.moteCount ?? 26, moteLifetime_s: options.moteLifetime_s ?? 1,
      moteDrift: options.moteDrift ?? new THREE.Vector3(.15, 0, .02) };
    root.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      const modify = (original: THREE.Material) => {
        const m = original.clone() as THREE.MeshStandardMaterial;
        m.onBeforeCompile = shader => {
          shader.uniforms.vanishProgress = this.progress;
          shader.uniforms.vanishRim = {value: new THREE.Color(options.rimColor ?? 0xffe9c9)};
          shader.vertexShader = 'varying vec3 vanishWorld;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvanishWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader = 'varying vec3 vanishWorld; uniform float vanishProgress; uniform vec3 vanishRim;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            float vn=fract(sin(dot(floor(vanishWorld*${this.o.noiseScale.toFixed(2)}),vec3(12.9898,78.233,37.719)))*43758.5453);
            float ve=vn-vanishProgress;
            if(vanishProgress>0.0 && ve<0.0)discard;
            outgoingLight += vanishRim*${this.o.rimIntensity.toFixed(3)}*(1.0-smoothstep(0.0,${this.o.edgeWidth.toFixed(3)},ve))*step(0.001,vanishProgress);
            #include <opaque_fragment>`);
        };
        m.customProgramCacheKey = () => 'vanish-erosion-v1';
        return m;
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(modify) : modify(obj.material);
    });
    const r = rng(this.o.seed);
    this.offsets = new Float32Array(this.o.moteCount * 3); this.positions = new Float32Array(this.offsets.length);
    for (let i=0; i<this.o.moteCount; i++) this.offsets.set([(r()-.5)*.55,.2+r()*1.45,(r()-.5)*.35],i*3);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions,3));
    this.motes = new THREE.Points(geometry,new THREE.PointsMaterial({color:options.rimColor ?? 0xffe9c9,size:.015,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.motes.frustumCulled=false;
  }

  update(time_s: number, start_s: number, origin: THREE.Vector3, enabled = true) {
    const age = time_s-start_s, p=enabled?clamp(age/this.o.duration_s):0;
    this.progress.value=p;
    const life=clamp(age/this.o.moteLifetime_s);
    this.motes.visible=enabled && age>0 && life<1;
    (this.motes.material as THREE.PointsMaterial).opacity=.5*Math.sin(life*Math.PI);
    for(let i=0;i<this.o.moteCount;i++)for(let a=0;a<3;a++)this.positions[i*3+a]=this.offsets[i*3+a]+origin.getComponent(a)+this.o.moteDrift.getComponent(a)*Math.max(age,0);
    this.motes.geometry.attributes.position.needsUpdate=true;
    return p;
  }
}
