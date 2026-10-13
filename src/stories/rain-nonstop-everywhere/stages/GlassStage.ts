import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { GlassOfWater } from '../../../library/props/GlassOfWater';
import { Rain, RainSplashes } from '../../../library/fx/Rain';
import { BokehField } from '../../../library/fx/BokehField';
import { GLSL_NOISE } from '../../../library/util/glsl';
import { clamp, rng } from '../../../library/util/math';
import { Base, overcastSky, type Timing } from './common';

const FLOOR = 0.009;   // GlassOfWater base thickness
export const MM_PER_DAY = 3;

/** A straight tumbler on a wet patio table collecting even drizzle: about 3 mm a day, ~9 cm in a month. */
export class GlassStage extends Base {
  glass = new GlassOfWater({ radius: 0.036, baseRadius: 0.036, height: 0.105, waterLevel: 0.03, cubes: 0, seed: 3 });
  rain = new Rain({ count: 2600, box: [1.6, 1.4, 1.6], fallSpeed: 3.2, wind: [0.15, 0.05], streakLength: 0.08, width: 0.0006, minPx: 1.3, opacity: 0.42, brightness: 1.3, near: 0.14, far: 2.2, groundY: 0, seed: 17 });
  inGlass = new RainSplashes({ radius: 0.0335, cell: 0.013, period: 1.0, life: 0.35, ringScale: 0.5, lineWidth: 0.07, opacity: 0.55, seed: 2 });
  onTable = new RainSplashes({ size: [1.5, 1.1], cell: 0.05, period: 1.3, life: 0.32, ringScale: 0.3, lineWidth: 0.06, opacity: 0.3, seed: 8 });
  bokeh = new BokehField({ count: 70, seed: 5, center: new THREE.Vector3(0, 0.35, -2.1), extent: new THREE.Vector3(1.3, 0.5, 0.3), size: 70, gain: 0.05, colors: [0xdfe8ee, 0xc6d5df] });

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.camera.near = 0.01; this.camera.far = 200;
    const sky = overcastSky(this.scene, renderer, { fogDensity: 0.0001 });
    sky.ceiling.mesh.visible = false; this.scene.fog = null;
    // Weathered planks, beaded and glossy with rain.
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const g = c.getContext('2d')!, r = rng(4);
    g.fillStyle = '#5a4130'; g.fillRect(0, 0, 1024, 128);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${30 + r() * 30},${18 + r() * 20},${10 + r() * 12},${0.25 + r() * 0.35})`; g.lineWidth = 1 + r() * 3; g.beginPath(); const y = r() * 128; g.moveTo(0, y); for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 4 + (r() - 0.5) * 3); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const wood = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.85, clearcoatRoughness: 0.12, envMapIntensity: 1.1 });
    for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.115), wood); p.position.set(0, -0.015, -0.55 + i * 0.123); p.receiveShadow = true; this.scene.add(p); }
    // Out-of-focus hedge behind the table (soft, low-frequency foliage so it reads as shallow depth of field).
    const hedge = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.ShaderMaterial({
      fog: false, uniforms: {},
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv; ${GLSL_NOISE}
        void main(){ vec2 p = vUv*vec2(9.0, 4.5)*0.9; float n = fbm(p*0.8 + 3.0), m = fbm(p*2.2 + 7.0);
          vec3 dark = vec3(0.022, 0.04, 0.026), mid = vec3(0.06, 0.1, 0.055), hi = vec3(0.13, 0.17, 0.11);
          vec3 c = mix(dark, mid, smoothstep(0.35, 0.7, n)); c = mix(c, hi, smoothstep(0.55, 0.85, m)*0.6);
          c = mix(c, vec3(0.32, 0.35, 0.38), smoothstep(0.78, 0.98, vUv.y + (n - 0.5)*0.15));
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    hedge.position.set(0, 1.4, -2.7); this.scene.add(hedge);
    this.glass.group.traverse((o) => { o.castShadow = false; });
    this.inGlass.mesh.renderOrder = 7;
    this.scene.add(this.glass.group, this.rain.mesh, this.inGlass.mesh, this.onTable.mesh, this.bokeh.points);
    this.onTable.mesh.position.y = 0.0006;
  }

  /** Days of drizzle shown at time t (1 → 30 across the shot's time-lapse). */
  dayAt(t: number) { const sh = this.T['S04/SH02']; return 1 + 29 * clamp((t - (sh.start + 0.9)) / (sh.end - sh.start - 1.4)); }

  update(t: number, _shot: ShotInfo) {
    const level = FLOOR + (MM_PER_DAY / 1000) * this.dayAt(t);
    this.glass.setWaterLevel(level); this.glass.update(t, 0);
    this.inGlass.mesh.position.y = level + 0.0004; this.inGlass.update(t); this.onTable.update(t);
    this.rain.update(t, this.camera); this.bokeh.update(t);
  }
}
