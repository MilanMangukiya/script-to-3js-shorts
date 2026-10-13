import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { GlassOfWater } from '../../../library/props/GlassOfWater';
import { SkyDome } from '../../../library/environment/SkyDome';
import { clamp, smoothstep } from '../../../library/util/math';
import { Base, mesh, type Timing } from './common';

const FLOOR = 0.009;               // GlassOfWater base thickness
export const M_PER_RAIN_M = 0.35;  // 1 m of yearly rain = 0.35 m of cylinder
export const GAUGE_X = 0.19;
export const TODAY = { sahara: 0.02, forest: 2.3 }, EVEN = 1.1;   // metres of rain per year
export const levelY = (rainM: number) => FLOOR + rainM * M_PER_RAIN_M;

/** Two yearly rain gauges in a dark studio: the Sahara's fills and the rainforest's drains to the same even line. */
export class GaugeStage extends Base {
  sahara = new GlassOfWater({ radius: 0.075, baseRadius: 0.075, height: 0.92, waterLevel: 0.3, cubes: 0, seed: 1 });
  forest = new GlassOfWater({ radius: 0.075, baseRadius: 0.075, height: 0.92, waterLevel: 0.3, cubes: 0, seed: 2 });
  private line: THREE.Mesh;

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.scene.background = new THREE.Color(0x0b1016);
    this.camera.near = 0.02; this.camera.far = 100;
    const dome = new SkyDome({ zenithColor: 0x56677a, horizonColor: 0x1d252e, groundColor: 0x0a0d11, sunIntensity: 0, sunGlow: 0, hazeAmount: 0 });
    this.scene.environment = dome.toEnvironment(renderer);
    const slate = mesh(new THREE.BoxGeometry(1.0, 0.04, 0.42), new THREE.MeshPhysicalMaterial({ color: 0x252b31, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }), [0, -0.02, 0]);
    const floor = mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0e1217, roughness: 0.9 }), [0, -0.04, 0]);
    this.scene.add(slate, floor);
    this.sahara.group.position.x = -GAUGE_X; this.forest.group.position.x = GAUGE_X;
    this.scene.add(this.sahara.group, this.forest.group);
    // Scale strips beside each gauge: a major tick per metre of yearly rain, minor ticks per 25 cm.
    for (const side of [-1, 1]) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 1840; const g = c.getContext('2d')!;
      g.clearRect(0, 0, 128, 1840); g.fillStyle = 'rgba(232,238,242,0.9)'; g.font = '700 40px Inter, sans-serif'; g.textBaseline = 'middle';
      const px = 1840 / 0.92;
      for (let q = 0; q <= 10; q++) { const y = 1840 - (FLOOR + q * 0.25 * M_PER_RAIN_M) * px, major = q % 4 === 0; if (y < 20) break; g.fillRect(side < 0 ? 128 - (major ? 46 : 24) : 0, y - 2, major ? 46 : 24, 4); if (major && q) { g.textAlign = side < 0 ? 'right' : 'left'; g.fillText(`${q / 4} M`, side < 0 ? 72 : 56, y); } }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const strip = mesh(new THREE.PlaneGeometry(0.06, 0.92), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), [side * (GAUGE_X + 0.112), 0.46, 0.0]);
      this.scene.add(strip);
    }
    // Dashed amber line at the even-rain level, drawn on from left to right.
    this.line = mesh(new THREE.PlaneGeometry(0.86, 0.007), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uP: { value: 0 } },
      vertexShader: `varying float vX; void main(){ vX = position.x/0.86 + 0.5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
      fragmentShader: `uniform float uP; varying float vX; void main(){ float dash = step(fract(vX*30.0), 0.62); float a = dash*step(vX, uP); if (a < 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.62, 0.3)*1.6, 1.0); }`,
    }), [0, levelY(EVEN), 0.085]);
    this.line.renderOrder = 9; this.scene.add(this.line);
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(1, 4, 5);
    const rimL = new THREE.DirectionalLight(0x9cc8ff, 1.2); rimL.position.set(-5, 2, -3);
    const rimR = new THREE.DirectionalLight(0xbfe0ff, 1.0); rimR.position.set(5, 2, -3);
    this.scene.add(key, rimL, rimR, new THREE.HemisphereLight(0x6a7c90, 0x0a0d10, 0.5));
  }

  /** Yearly rain shown in each gauge at time t: today's value easing to the even global value. */
  rainAt(t: number) {
    const a = this.T.S06.start;
    return { sahara: TODAY.sahara + (EVEN - TODAY.sahara) * smoothstep(a + 0.85, a + 3.85, t), forest: TODAY.forest + (EVEN - TODAY.forest) * smoothstep(a + 1.7, a + 4.7, t) };
  }

  update(t: number, _shot: ShotInfo) {
    const r = this.rainAt(t), a = this.T.S06.start;
    this.sahara.setWaterLevel(levelY(r.sahara)); this.forest.setWaterLevel(levelY(r.forest));
    this.sahara.update(t, 0); this.forest.update(t, 0);
    (this.line.material as THREE.ShaderMaterial).uniforms.uP.value = clamp((t - (a + 3.9)) / 0.9);
  }
}
