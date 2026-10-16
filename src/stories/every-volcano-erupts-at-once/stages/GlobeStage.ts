import * as THREE from 'three';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { GLSL_NOISE } from '../../../library/util/glsl';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt } from '../timeline';
import { volcanoSites } from '../volcanoBelts';

const D2R = Math.PI / 180;
const geoDir = (lon: number, lat: number, out = new THREE.Vector3()) =>
  out.set(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lon * D2R));

/** Equirectangular canvas of where the stratospheric veil is at one stage of its spread. */
function veilCanvas(sites: { lat: number; lon: number; size: number }[], stage: 0 | 1 | 2) {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  const big = sites.filter((s) => s.size > 0.45);                     // only the biggest blasts reach the stratosphere
  const px = (lon: number) => (lon + 180) / 360 * W, py = (lat: number) => (90 - lat) / 180 * H;
  x.globalCompositeOperation = 'lighter';
  for (const s of big) {
    const cx = px(s.lon), cy = py(s.lat);
    // Stage 0: fresh clouds; stage 1: smeared along the winds into bands; stage 2: spread over most of the globe.
    const rx = stage === 0 ? 10 + 30 * s.size : stage === 1 ? 160 + 260 * s.size : 520, ry = stage === 0 ? rx : stage === 1 ? 12 + 26 * s.size : 120 + 60 * s.size;
    for (const dx of [-W, 0, W]) {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(255,255,255,${stage === 2 ? 0.16 : 0.5})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.save(); x.translate(cx + dx + (stage === 1 ? rx * 0.3 : 0), cy); x.scale(rx, ry); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, Math.PI * 2); x.fill(); x.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}

/**
 * Earth with ~1,350 eruption sites along the volcanic belts (S02) and the sulfate veil that the biggest blasts lift
 * to ~20 km, spreading over weeks (S06). Points and veil are children of the globe so they turn with it.
 */
export class GlobeStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 9 / 16, 0.05, 2000);
  private earth: Earth;
  private stars = new Starfield({ seed: 31, count: 3000, radius: 600, maxSize: 3.5 });
  private sun = new THREE.Vector3(0.85, 0.3, 0.45).normalize();
  private glow: THREE.Points; private glowMat: THREE.ShaderMaterial;
  private puffs: THREE.Points; private puffMat: THREE.ShaderMaterial;
  private veil: THREE.Mesh; private veilMat: THREE.ShaderMaterial;

  constructor(tex: EarthTextures, private renderer: THREE.WebGLRenderer) {
    this.earth = new Earth(tex, { radius: 1, sunDirection: this.sun, nightLights: 1.2, atmosphereStrength: 1 });
    this.earth.setView(128, 12);
    this.scene.add(this.earth.group, this.stars.points);
    const sites = volcanoSites(1350, 1350), n = sites.length;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 2), d = new THREE.Vector3();
    sites.forEach((s, i) => { geoDir(s.lon, s.lat, d).multiplyScalar(1.0025); pos.set([d.x, d.y, d.z], i * 3); seed.set([s.seed, s.size], i * 2); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    this.glowMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uOn: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `attribute vec2 aSeed; uniform float uOn, uTime, uPx; varying float vA;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec3 N = normalize(w.xyz);
          vec3 V = normalize(cameraPosition - w.xyz); float facing = smoothstep(-0.05, 0.25, dot(N, V));
          vA = uOn * facing * (0.65 + 0.35 * sin(uTime * (3.0 + aSeed.x * 5.0) + aSeed.x * 40.0)) * (0.6 + 0.8 * aSeed.y);
          vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (5.0 + 9.0 * aSeed.y) * 12.0 / -mv.z; }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d) * vA; if (a < 0.01) discard;
          vec3 c = mix(vec3(1.0, 0.32, 0.06), vec3(1.0, 0.85, 0.5), smoothstep(0.5, 0.0, d)); gl_FragColor = vec4(c * a * 2.2, a); }`,
    });
    this.glow = new THREE.Points(g, this.glowMat); this.glow.frustumCulled = false; this.glow.renderOrder = 4;
    // Little ash puffs above each site, drifting with the wind.
    this.puffMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uGrow: { value: 0 }, uPx: { value: 1 }, uSun: { value: this.sun } },
      vertexShader: /* glsl */ `attribute vec2 aSeed; uniform float uGrow, uPx; uniform vec3 uSun; varying float vA; varying float vLit;
        void main(){ vec4 w = modelMatrix * vec4(position * (1.0 + 0.004 * uGrow * (0.4 + aSeed.y)), 1.0); vec3 N = normalize(w.xyz);
          vec3 V = normalize(cameraPosition - w.xyz); vA = uGrow * smoothstep(-0.05, 0.3, dot(N, V)) * (0.35 + 0.65 * aSeed.y);
          vLit = 0.25 + 0.75 * smoothstep(-0.1, 0.3, dot(N, uSun));
          vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (6.0 + 22.0 * aSeed.y) * uGrow * 9.0 / -mv.z; }`,
      fragmentShader: /* glsl */ `varying float vA; varying float vLit; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, d) * vA * 0.8; if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(0.42, 0.39, 0.36) * vLit, a); }`,
    });
    this.puffs = new THREE.Points(g, this.puffMat); this.puffs.frustumCulled = false; this.puffs.renderOrder = 5;
    // Sulfate veil at ~20 km (drawn at 1.006 R so it reads), crossfading through three stages of spread.
    this.veilMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { t0: { value: veilCanvas(sites, 0) }, t1: { value: veilCanvas(sites, 1) }, t2: { value: veilCanvas(sites, 2) }, uK: { value: 0 }, uOn: { value: 0 }, uSun: { value: this.sun } },
      vertexShader: /* glsl */ `varying vec3 vObj; varying vec3 vN; varying vec3 vW; void main(){ vObj = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform sampler2D t0, t1, t2; uniform float uK, uOn; uniform vec3 uSun; varying vec3 vObj; varying vec3 vN; varying vec3 vW;
        ${GLSL_NOISE}
        void main(){
          vec3 d = normalize(vObj); float lat = asin(clamp(d.y, -1.0, 1.0)), lon = atan(-d.z, d.x);
          vec2 uv = vec2((lon + 3.14159265) / 6.2831853, (lat + 1.5707963) / 3.1415927);
          float a0 = texture2D(t0, uv).r, a1 = texture2D(t1, uv).r, a2 = texture2D(t2, uv).r;
          float cov = mix(mix(a0, a1, smoothstep(0.0, 0.45, uK)), max(a1 * 0.7, a2), smoothstep(0.4, 1.0, uK));
          cov = clamp(cov * 1.3, 0.0, 1.0) * (0.75 + 0.5 * fbm(d.xz * 6.0 + d.y * 3.0));
          vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(vN, V)), 2.2);
          float day = smoothstep(-0.15, 0.35, dot(vN, uSun));
          float a = uOn * cov * (0.18 + 0.75 * rim) * day * (0.35 + 0.65 * uK);
          gl_FragColor = vec4(vec3(0.94, 0.95, 0.97) * (0.85 + 0.3 * day), a); }`,
    });
    this.veil = new THREE.Mesh(new THREE.SphereGeometry(1.006, 160, 80), this.veilMat);
    const holder = this.earth.globe; holder.add(this.glow, this.puffs, this.veil);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.05));
  }

  update(t: number, shot: ShotInfo) {
    this.earth.update(t);
    this.stars.follow(this.camera);
    const s02 = shot.sceneId === 'S02', s06 = shot.sceneId === 'S06';
    const px = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / 1920;
    this.glowMat.uniforms.uTime.value = t; this.glowMat.uniforms.uPx.value = px; this.puffMat.uniforms.uPx.value = px;
    // S02: every site is erupting from the first frame (simultaneous by premise); plumes grow over the shot.
    this.glowMat.uniforms.uOn.value = s02 ? 1 : s06 ? 0.35 * (1 - windowAt(t, T.bounds[5], T.bounds[5] + 2.5)) : 0;
    this.puffMat.uniforms.uGrow.value = s02 ? 0.35 + 0.65 * windowAt(t, T.bounds[1], T.bounds[2]) : s06 ? 1 - windowAt(t, T.bounds[5], T.bounds[5] + 2.5) : 0;
    this.veilMat.uniforms.uOn.value = s06 ? 1 : 0;
    this.veilMat.uniforms.uK.value = s06 ? Math.pow(windowAt(t, T.bounds[5] + 0.3, T.bounds[6] - 0.6), 1.3) : 0;
  }

  /** Week counter for the S06 HUD (weeks 1 to 10 across the shot). */
  static week(t: number) { return 1 + 9 * windowAt(t, T.bounds[5] + 0.3, T.bounds[6] - 0.6); }
}
