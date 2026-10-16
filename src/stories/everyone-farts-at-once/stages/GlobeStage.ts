import * as THREE from 'three';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { GLSL_NOISE } from '../../../library/util/glsl';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt } from '../timeline';

const D2R = Math.PI / 180;
const geoDir = (lon: number, lat: number, out = new THREE.Vector3()) =>
  out.set(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lon * D2R));
/** The film's city (the speck's location in S06). */
export const CITY = { lat: 40.7, lon: -74.0 };

/**
 * S02: Earth with faint puffs blooming at the same second over every populated place (city lights stand in for
 * people). S06: all of it, pooled into one 100 m bubble, is a speck over the city that spreads into the whole
 * atmosphere and thins to nothing.
 */
export class GlobeStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 9 / 16, 0.01, 2000);
  readonly earth: Earth;
  private stars = new Starfield({ seed: 83, count: 3000, radius: 600, maxSize: 3.5 });
  private sun = new THREE.Vector3(0.75, 0.35, 0.56).normalize();
  private shell: THREE.Mesh; private shellMat: THREE.ShaderMaterial;
  private speck: THREE.Mesh; private speckMat: THREE.MeshBasicMaterial;
  private puffs: THREE.Points; private puffMat: THREE.ShaderMaterial;
  readonly speckLocal = geoDir(CITY.lon, CITY.lat).multiplyScalar(1.004);

  constructor(tex: EarthTextures, private renderer?: THREE.WebGLRenderer) {
    this.earth = new Earth(tex, { radius: 1, sunDirection: this.sun, nightLights: 1.3, atmosphereStrength: 1 });
    this.earth.setView(-40, 28);
    this.earth.spinRate = 0.002;
    this.scene.add(this.earth.group, this.stars.points);
    this.shellMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { tNight: { value: tex.night }, uPop: { value: 0 }, uSpread: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 }, uSun: { value: this.sun }, uCity: { value: geoDir(CITY.lon, CITY.lat) } },
      vertexShader: /* glsl */ `varying vec3 vObj; varying vec3 vN; varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vObj = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform sampler2D tNight; uniform float uPop, uSpread, uFade, uTime; uniform vec3 uSun, uCity; varying vec3 vObj; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
        ${GLSL_NOISE}
        void main(){
          vec3 d = normalize(vObj);
          // S02: puffs where people live (city lights), blooming everywhere at once.
          float lights = dot(texture2D(tNight, vUv).rgb, vec3(0.33));
          float L = smoothstep(0.004, 0.05, lights);
          float blob = smoothstep(0.62 - 0.22 * uPop, 0.9, vnoise(vUv * vec2(360.0, 180.0)) * 0.7 + vnoise(vUv * vec2(1080.0, 540.0)) * 0.3);
          float pop = L * (0.22 + 0.78 * blob) * uPop;
          // S06: one speck at the city spreading into a thin global film that fades away.
          float ang = acos(clamp(dot(d, normalize(uCity)), -1.0, 1.0));
          float film = (1.0 - smoothstep(uSpread * 3.2, uSpread * 3.2 + 0.25, ang)) * uFade * (0.7 + 0.3 * fbm(d.xz * 9.0 + uTime * 0.05));
          vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(vN, V)), 2.0);
          float a = clamp(pop * 0.9 + film * (0.25 + 0.6 * rim), 0.0, 0.9);
          gl_FragColor = vec4(vec3(0.78, 0.92, 0.3) * (1.0 + 0.6 * pop), a); }`,
    });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1.003, 192, 96), this.shellMat);
    this.speckMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 0.6), transparent: true, opacity: 0 });
    this.speck = new THREE.Mesh(new THREE.SphereGeometry(0.004, 16, 12), this.speckMat);
    this.speck.position.copy(this.speckLocal);
    this.earth.globe.add(this.shell, this.speck);
    // Puffs where people are: sample the city-lights map (brighter = more people), one sprite per sample.
    const src = tex.night.image as CanvasImageSource, cw = 1024, ch = 512, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d', { willReadFrequently: true })!; cx.drawImage(src, 0, 0, cw, ch);
    const px = cx.getImageData(0, 0, cw, ch).data, cand: number[] = [], wts: number[] = [];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const k = (y * cw + x) * 4, l = (px[k] + px[k + 1] + px[k + 2]) / 765; if (l > 0.12) { cand.push(y * cw + x); wts.push(l * l); } }
    const total = wts.reduce((a, b) => a + b, 0), N = 5200, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    let acc = 0, j = 0; const step = total / N; let next = step * 0.5;
    for (let i = 0; i < cand.length && j < N; i++) { acc += wts[i]; while (acc >= next && j < N) { const c = cand[i], u = (c % cw + 0.5) / cw, v = (Math.floor(c / cw) + 0.5) / ch;
      geoDir(u * 360 - 180, 90 - v * 180, new THREE.Vector3()).multiplyScalar(1.0045).toArray(pos, j * 3); seed[j] = (Math.sin(j * 12.9898) * 43758.5453) % 1; j++; next += step; } }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); pg.setDrawRange(0, j);
    this.puffMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPop: { value: 0 }, uPx: { value: 1 } },
      vertexShader: 'attribute float aSeed; uniform float uPop, uPx; varying float vA; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec3 N = normalize(w.xyz); vec3 V = normalize(cameraPosition - w.xyz); vA = uPop * smoothstep(-0.05, 0.3, dot(N, V)); vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (7.0 + 9.0 * abs(aSeed)) * (0.5 + 0.5 * uPop) * 3.2 / -mv.z; }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.25, d) * vA * 0.8; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.82, 0.95, 0.32), a); }' });
    this.puffs = new THREE.Points(pg, this.puffMat); this.puffs.frustumCulled = false; this.puffs.renderOrder = 5; this.earth.globe.add(this.puffs);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.05));
  }

  update(t: number, shot: ShotInfo) {
    this.earth.update(t);
    this.stars.follow(this.camera);
    const s02 = shot.sceneId === 'S02', s06 = shot.sceneId === 'S06', u = this.shellMat.uniforms;
    // S02 looks at the most populous belt (South and East Asia); S06 at the film's city.
    if (s02) this.earth.setView(92, 22); else this.earth.setView(-40, 28);
    this.earth.update(t);
    u.uTime.value = t;
    u.uPop.value = s02 ? 0.5 * windowAt(t, T.bounds[1], T.bounds[1] + 0.5) : 0;
    this.puffMat.uniforms.uPop.value = s02 ? windowAt(t, T.bounds[1], T.bounds[1] + 0.6) : 0;
    this.puffMat.uniforms.uPx.value = this.renderer ? this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / 1920 : 1;
    const spread = s06 ? windowAt(t, T.spread0, T.spread1) : 0;
    u.uSpread.value = spread; u.uFade.value = s06 ? 0.55 * (1 - windowAt(t, T.spread0 + 0.6, T.spread1)) * Math.min(1, spread * 6) : 0;
    this.speck.visible = s06; this.speckMat.opacity = s06 ? 1 - windowAt(t, T.spread0 - 0.2, T.spread0 + 0.6) : 0;
    this.speck.scale.setScalar(1 + 0.3 * Math.sin(t * 6));
  }

  /** World position of the speck (for the overlay callout). */
  speckWorld(out = new THREE.Vector3()) { this.earth.globe.updateMatrixWorld(true); return out.copy(this.speckLocal).applyMatrix4(this.earth.globe.matrixWorld); }
}
