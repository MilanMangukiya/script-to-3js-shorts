import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { clamp, rng, smoothstep } from '../../../library/util/math';
import { Base, mesh, type Timing } from './common';

const R = 0.6, HEIGHT = 6;   // schematic air column: 6 m stands for ~10 km of weather
export const COLUMN_RADIUS = R;
export const WATER_DEPTH = 0.025;   // the condensed layer, drawn at true scale against the ruler

/** Schematic studio: all the water vapour above a patch of ground condenses into a 2.5 cm layer at its base. */
export class ColumnStage extends Base {
  private colMat: THREE.ShaderMaterial; private speckMat: THREE.ShaderMaterial;
  private water: THREE.Mesh; private top: THREE.Mesh;

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.scene.background = new THREE.Color(0x0a0f16);
    this.camera.near = 0.01; this.camera.far = 300;
    const floor = mesh(new THREE.CircleGeometry(3.2, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d252e, roughness: 0.7 }));
    const outer = mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c1117, roughness: 0.9 }), [0, -0.002, 0]);
    this.scene.add(floor, outer);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7fb8dc, transparent: true, opacity: 0.55 });
    for (const y of [0.001, HEIGHT]) { const ring = mesh(new THREE.TorusGeometry(R, 0.006, 8, 128).rotateX(Math.PI / 2), ringMat, [0, y, 0]); this.scene.add(ring); }
    // Column shell: additive Fresnel edges and a body glow that is densest near the ground, where most vapour is.
    this.colMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uFill: { value: 1 } },
      vertexShader: `varying vec3 vN; varying vec3 vP; varying float vY; void main(){ vY = position.y/${HEIGHT.toFixed(1)} + 0.5; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uFill; varying vec3 vN; varying vec3 vP; varying float vY;
        void main(){ vec3 V = normalize(cameraPosition - vP); float f = pow(1.0 - abs(dot(normalize(vN), V)), 2.2);
          float body = 0.035 + 0.11*pow(1.0 - vY, 2.0);
          float bands = 0.5 + 0.5*smoothstep(0.985, 1.0, fract(vY*10.0));
          vec3 c = vec3(0.42, 0.68, 1.0)*(body*uFill + f*(0.18 + 0.32*uFill)*bands);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const col = mesh(new THREE.CylinderGeometry(R, R, HEIGHT, 128, 1, true), this.colMat, [0, HEIGHT / 2, 0]);
    col.renderOrder = 4; this.scene.add(col);
    // Vapour specks: most vapour sits in the lowest kilometres. When the rain-out starts they fall to the base.
    const n = 1500, r = rng(31), pos = new Float32Array(n * 3), rnd = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (R - 0.03); pos.set([Math.cos(a) * d, 0.04 + HEIGHT * Math.pow(r(), 1.7) * 0.97, Math.sin(a) * d], i * 3); rnd.set([r(), r() * 6.283, 0.6 + r() * 0.8], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
    this.speckMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uRain: { value: -1 }, uPx: { value: 1 } },
      vertexShader: `attribute vec3 aRnd; uniform float uTime, uRain, uPx; varying float vA;
        void main(){ vec3 p = position;
          p.x += sin(uTime*0.6 + aRnd.y)*0.015; p.z += cos(uTime*0.5 + aRnd.y*1.3)*0.015; p.y += sin(uTime*0.4 + aRnd.y*2.0)*0.03;
          float age = uRain - aRnd.x*1.5; float drop = age > 0.0 ? 0.5*7.0*age*age : 0.0;
          p.y = max(p.y - drop, 0.0);
          vA = (0.3 + 0.3*aRnd.z)*smoothstep(0.0, 0.08, p.y);
          vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(uPx*0.014*aRnd.z/(-mv.z), 1.5, 7.0); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5)*2.0; float a = smoothstep(1.0, 0.2, d)*vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.55, 0.8, 1.0)*a*0.9, a); }`,
    });
    const specks = new THREE.Points(g, this.speckMat); specks.frustumCulled = false; specks.renderOrder = 5; this.scene.add(specks);
    // Condensed water layer and its bright surface.
    this.water = mesh(new THREE.CylinderGeometry(R - 0.002, R - 0.002, 1, 128).translate(0, 0.5, 0), new THREE.MeshPhysicalMaterial({ color: 0x6fbfe8, roughness: 0.05, transmission: 0.55, thickness: 0.03, ior: 1.33, transparent: true, opacity: 0.9, emissive: 0x0c3a58, emissiveIntensity: 0.6 }));
    this.top = mesh(new THREE.CircleGeometry(R - 0.002, 128).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc8ecff, transparent: true, opacity: 0.45, depthWrite: false }));
    this.water.renderOrder = 2; this.top.renderOrder = 3;
    this.scene.add(this.water, this.top);
    // Ruler in true centimetres just outside the column wall.
    const c = document.createElement('canvas'); c.width = 160; c.height = 1140; const x = c.getContext('2d')!;
    x.fillStyle = '#ece6d4'; x.fillRect(0, 0, 160, 1140);
    const pxPerCm = 1140 / 32;
    x.fillStyle = '#ffb45c'; x.fillRect(0, 1140 - 2.5 * pxPerCm - 4, 160, 8);
    x.fillStyle = '#1f1c18'; x.textAlign = 'right'; x.textBaseline = 'middle'; x.font = '600 26px Inter, sans-serif';
    for (let mm = 0; mm <= 320; mm++) { const y = 1140 - (mm / 10) * pxPerCm, len = mm % 10 === 0 ? 58 : mm % 5 === 0 ? 40 : 24; x.fillRect(0, y - 1.2, len, 2.4); if (mm % 10 === 0 && mm > 0) x.fillText(String(mm / 10), 150, y); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const plain = new THREE.MeshStandardMaterial({ color: 0xd8d1bd, roughness: 0.6 });
    const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.32, 0.004), [plain, plain, plain, plain, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), plain]);
    ruler.position.set(-0.11, 0.16, R + 0.032); this.scene.add(ruler);
    // Studio light: soft key from the upper left, cool rim, dim fill.
    const key = new THREE.DirectionalLight(0xfff3e4, 1.6); key.position.set(-4, 7, 6);
    const rim = new THREE.DirectionalLight(0x9cc8ff, 1.0); rim.position.set(5, 3, -6);
    this.scene.add(key, rim, new THREE.HemisphereLight(0x6f8399, 0x0b0f14, 0.6));
    void renderer;
  }

  /** Condensed depth in metres at time t (0 → 2.5 cm while the column rains out). */
  depthAt(t: number) { const a = this.T.S03.start; return WATER_DEPTH * smoothstep(a + 3.3, a + 5.8, t); }

  update(t: number, _shot: ShotInfo) {
    const a = this.T.S03.start, u = t - a;
    this.colMat.uniforms.uFill.value = smoothstep(-0.3, 0.9, u) * (1 - 0.8 * smoothstep(3.3, 5.8, u));
    const s = this.speckMat.uniforms; s.uTime.value = t; s.uRain.value = u > 3.3 ? u - 3.3 : -1;
    s.uPx.value = 1920 / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    const d = this.depthAt(t);
    this.water.visible = this.top.visible = d > 0.0004;
    this.water.scale.y = Math.max(d, 1e-4); this.top.position.y = d + 0.0003;
    this.camera.near = clamp(this.camera.position.length() * 0.004, 0.004, 0.05); this.camera.updateProjectionMatrix();
  }
}
