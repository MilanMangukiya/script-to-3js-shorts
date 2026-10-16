import * as THREE from 'three';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, tauAt } from '../timeline';

// The inner solar system as a diagram: 1 AU = 30 units, Sun and planets enlarged so they read at phone size; light
// travels at its true rate in story time (1 AU in 499 s). After the dark, the Sun shines again at once, but its light
// spreads outward as a shell: each planet stays black until the shell reaches it.
const AU = 30;
const PLANETS: { name: string; au: number; r: number; color: number; ang: number }[] = [
  { name: 'MERCURY', au: 0.387, r: 0.6, color: 0x9a948c, ang: 1.1 },
  { name: 'VENUS', au: 0.723, r: 0.95, color: 0xd8c08a, ang: 0.55 },
  { name: 'EARTH', au: 1.0, r: 1.2, color: 0x3d7fd6, ang: 0.32 },
];

export class SpaceStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 2000);
  private shell: THREE.Mesh; private shellMat: THREE.ShaderMaterial;
  private planets: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; au: number; pos: THREE.Vector3 }[] = [];
  private sunMat: THREE.ShaderMaterial;

  constructor() {
    this.scene.background = new THREE.Color(0x000000);
    // Sun: hot limb-darkened sphere plus a soft corona sprite.
    this.sunMat = new THREE.ShaderMaterial({ uniforms: { uOn: { value: 1 } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform float uOn; varying vec3 vN; varying vec3 vV; void main(){ float mu = max(0.0, dot(normalize(vN), normalize(vV))); vec3 c = vec3(2.5, 2.05, 1.4) * (0.45 + 0.55 * pow(mu, 0.5)); gl_FragColor = vec4(c * uOn, 1.0); }` });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 48, 32), this.sunMat));
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(), color: new THREE.Color(1.0, 0.72, 0.42), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    corona.scale.setScalar(7.5); this.scene.add(corona);
    // Orbits as faint rings.
    for (const p of PLANETS) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.au * AU - 0.03, p.au * AU + 0.03, 256).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a4660, transparent: true, opacity: 0.6 }));
      this.scene.add(ring);
      // Planets lit only once the light shell has reached them.
      const mat = new THREE.ShaderMaterial({ uniforms: { uLit: { value: 0 }, uCol: { value: new THREE.Color(p.color) } },
        vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `uniform float uLit; uniform vec3 uCol; varying vec3 vN; varying vec3 vW; void main(){ vec3 N = normalize(vN), L = normalize(-vW), V = normalize(cameraPosition - vW); float d = max(0.0, dot(N, L)); float rim = pow(1.0 - max(0.0, dot(N, V)), 3.0); gl_FragColor = vec4(uCol * (0.035 + 1.6 * d * uLit + 0.45 * rim * (1.0 - uLit)), 1.0); }` });
      const pos = new THREE.Vector3(Math.cos(p.ang) * p.au * AU, 0, Math.sin(p.ang) * p.au * AU);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.r, 32, 24), mat); mesh.position.copy(pos); this.scene.add(mesh);
      this.planets.push({ mesh, mat, au: p.au, pos });
    }
    // The light front: a shell whose rim glows (seen edge-on it reads as a bright ring).
    this.shellMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 1 } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 7.0); gl_FragColor = vec4(vec3(1.4, 1.15, 0.7) * (0.006 + 0.9 * rim) * uA, 1.0); }` });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.shellMat); this.scene.add(this.shell);
    // A sparse, dim background of distant stars? No: their light is gone too. Space stays black.
    void rng;
  }

  update(t: number, _shot: ShotInfo) {
    const tau = tauAt(t), rad = Math.max(2.3, (tau / T.sunTravelS) * AU);
    this.shell.scale.setScalar(rad); this.shellMat.uniforms.uA.value = rad < AU * 1.6 ? 1 : 0;
    for (const p of this.planets) p.mat.uniforms.uLit.value = Math.max(0, Math.min(1, (rad - p.au * AU) / 0.8 + 0.5));
  }

  /** World position of a planet (for camera aims and callouts). */
  planet(i: number) { return this.planets[i].pos.clone(); }
  /** Current radius of the light front in scene units. */
  frontRadius(t: number) { return Math.max(2.3, (tauAt(t) / T.sunTravelS) * AU); }
  /** A point on the front's visible rim on the side facing planet i (for a callout that rides the front). */
  frontAnchor(t: number, i: number) {
    const v = this.camera.getWorldPosition(new THREE.Vector3()).negate().normalize(), e = this.planets[i].pos.clone().normalize();
    return e.addScaledVector(v, -e.dot(v)).normalize().multiplyScalar(this.frontRadius(t));
  }
}

function radial() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64); grd.addColorStop(0, 'rgba(255,240,210,1)'); grd.addColorStop(0.25, 'rgba(255,200,120,0.45)'); grd.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
