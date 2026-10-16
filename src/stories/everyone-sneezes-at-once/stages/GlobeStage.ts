import * as THREE from 'three';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt } from '../timeline';

const D2R = Math.PI / 180;
const geoDir = (lon: number, lat: number, out = new THREE.Vector3()) =>
  out.set(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lon * D2R));

/**
 * Earth with one tiny pale puff per sample of where people live (city lights, weighted by brightness).
 * S02: every puff pops in the same instant. S07: a one-day time-lapse in which the planet turns once and sneezes
 * twinkle at random everywhere, never in sync.
 */
export class GlobeStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 9 / 16, 0.01, 2000);
  private earth: Earth;
  private stars = new Starfield({ seed: 61, count: 3000, radius: 600, maxSize: 3.5 });
  private sun = new THREE.Vector3(0.8, 0.3, 0.52).normalize();
  private mat: THREE.ShaderMaterial;

  constructor(tex: EarthTextures, private renderer: THREE.WebGLRenderer) {
    this.earth = new Earth(tex, { radius: 1, sunDirection: this.sun, nightLights: 1.3, atmosphereStrength: 1 });
    this.scene.add(this.earth.group, this.stars.points);
    const src = tex.night.image as CanvasImageSource, cw = 1024, ch = 512, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d', { willReadFrequently: true })!; cx.drawImage(src, 0, 0, cw, ch);
    const px = cx.getImageData(0, 0, cw, ch).data, cand: number[] = [], wts: number[] = [];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const k = (y * cw + x) * 4, l = (px[k] + px[k + 1] + px[k + 2]) / 765; if (l > 0.12) { cand.push(y * cw + x); wts.push(l * l); } }
    const total = wts.reduce((a, b) => a + b, 0), N = 6000, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    let acc = 0, j = 0, next = total / N * 0.5;
    for (let i = 0; i < cand.length && j < N; i++) { acc += wts[i]; while (acc >= next && j < N) { const c = cand[i], u = (c % cw + 0.5) / cw, v = (Math.floor(c / cw) + 0.5) / ch;
      geoDir(u * 360 - 180, 90 - v * 180, new THREE.Vector3()).multiplyScalar(1.0045).toArray(pos, j * 3); seed[j] = Math.abs(Math.sin(j * 12.9898) * 43758.5453) % 1; j++; next += total / N; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setDrawRange(0, j);
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uSync: { value: 0 }, uFlicker: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `attribute float aSeed; uniform float uSync, uFlicker, uTime, uPx; varying float vA;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec3 N = normalize(w.xyz); vec3 V = normalize(cameraPosition - w.xyz);
          float facing = smoothstep(-0.05, 0.3, dot(N, V));
          // Random sneezes through the day: each site lights for a short burst at its own times.
          float ph = fract(aSeed * 37.31 + uTime * (0.6 + aSeed * 0.9));
          float rnd = smoothstep(0.0, 0.03, ph) * (1.0 - smoothstep(0.06, 0.12, ph));
          vA = facing * max(uSync, uFlicker * rnd);
          vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (7.0 + 9.0 * aSeed) * (0.55 + 0.45 * max(uSync, rnd)) * 3.2 / -mv.z; }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, d) * vA * 0.85; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.82, 0.93, 1.0) * 1.15, a); }` });
    const pts = new THREE.Points(g, this.mat); pts.frustumCulled = false; pts.renderOrder = 5; this.earth.globe.add(pts);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.05));
  }

  update(t: number, shot: ShotInfo) {
    const s02 = shot.sceneId === 'S02', s07 = shot.sceneId === 'S07', u = this.mat.uniforms;
    if (s02) { this.earth.setView(10, 25); this.earth.spinRate = 0.002; }
    else { this.earth.setView(60, 18); this.earth.spinRate = (Math.PI * 2) / (T.bounds[7] - T.bounds[6]); }
    this.earth.update(s07 ? t - T.bounds[6] : t);
    this.stars.follow(this.camera);
    u.uPx.value = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / 1920;
    u.uTime.value = t;
    u.uSync.value = s02 ? windowAt(t, T.bounds[1], T.bounds[1] + 0.25) * (1 - windowAt(t, T.bounds[1] + 1.4, T.bounds[1] + 2.6)) : 0;
    u.uFlicker.value = s07 ? 1 : 0;
  }

  /** Sneezes counted so far in the S07 time-lapse day (one per person per day on average). */
  static sneezesToday(t: number) { return 8.3e9 * Math.max(0, Math.min(1, (t - T.bounds[6] - 0.2) / (T.bounds[7] - T.bounds[6] - 0.6))); }
}
