import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import type { EarthTextures } from '../../../library/planet/Earth';
import { PlateDriftGlobe, MID_ATLANTIC_RIDGE, geoDir } from '../../../library/planet/PlateDriftGlobe';
import { OvercastShell } from '../../../library/planet/OvercastShell';
import { Starfield } from '../../../library/space/Starfield';
import { lerp, smoothstep } from '../../../library/util/math';
import { Base, frac, type Timing } from './common';

export const SUN = new THREE.Vector3(1, 0.32, 0.55).normalize();
/** Moisture streams on the assembled map: [lon0, lat0] over open ocean → [lon1, lat1] inland, sideways bend. */
const STREAMS: [number, number, number, number, number][] = [
  [-62, -5, -26, -8, 0.04], [-54, -24, -12, -22, -0.03], [-40, -42, 6, -38, 0.03], [-86, 22, -50, 26, -0.04], [-80, 42, -58, 46, 0.03],
  [86, 18, 52, 22, 0.04], [90, 2, 58, -8, -0.03], [32, 86, 38, 64, 0.03], [100, -12, 98, -28, 0.03], [-24, -58, 10, -50, -0.03],
];

/** Earth from orbit: today's continents drift together into a Pangaea-like supercontinent and back. */
export class GlobeStage extends Base {
  globe: PlateDriftGlobe;
  clouds = new OvercastShell({ radius: 1.02, coverage: 0.3, scale: 3.6, sunDirection: SUN, seed: 9 });
  stars = new Starfield({ count: 2600, radius: 400, brightness: 0.3 });
  /** World direction of the supercontinent's interior (fixed Africa sits at its heart). */
  center: THREE.Vector3;
  private streams = new THREE.Group();
  private streamMat: THREE.ShaderMaterial;

  constructor(private T: Timing, tex: EarthTextures, private duration: number) {
    super();
    this.scene.background = new THREE.Color(0x01040a);
    this.camera.near = 0.3; this.camera.far = 600;
    this.globe = new PlateDriftGlobe(tex, { radius: 1, sunDirection: SUN, viewLon: -2, viewLat: 6, ridge: MID_ATLANTIC_RIDGE, atmosphereStrength: 0.9, glint: 0.6 });
    this.globe.group.add(this.clouds.mesh);
    this.scene.add(this.globe.group, this.stars.points);
    this.center = this.globe.pointOn(16, 4);
    // Schematic moisture streams: glowing arcs from the open ocean onto the coasts of the assembled supercontinent,
    // dashes flowing inland and fading out a few hundred kilometres past the shore.
    this.streamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime, uAmount; varying vec2 vUv;
        void main(){ float x = vUv.x, f = fract(x*5.0 - uTime*0.7), dash = smoothstep(0.0, 0.2, f)*(1.0 - smoothstep(0.35, 0.6, f));
          float a = uAmount*smoothstep(0.0, 0.1, x)*(1.0 - smoothstep(0.5, 0.95, x))*(0.25 + 0.75*dash);
          gl_FragColor = vec4(vec3(0.45, 0.8, 1.0)*a, a); }`,
    });
    for (const [lon0, lat0, lon1, lat1, bend] of STREAMS) {
      const a = geoDir(lon0, lat0), b = geoDir(lon1, lat1), side = new THREE.Vector3().crossVectors(a, b).normalize().multiplyScalar(bend);
      const pts = Array.from({ length: 24 }, (_, i) => { const t = i / 23; return a.clone().lerp(b, t).add(side.clone().multiplyScalar(Math.sin(Math.PI * t))).normalize().multiplyScalar(1.024); });
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.009, 6, false), this.streamMat);
      m.renderOrder = 30; this.streams.add(m);
    }
    this.globe.frame.add(this.streams);
  }

  update(t: number, shot: ShotInfo) {
    const T = this.T, u = frac(T, shot.key, t);
    let p = 1, over: Record<string, number> = {}, dry = 0, heat = 0, ridge = 0, streams = 0;
    switch (shot.key) {
      case 'S01/SH01': p = 0.3 * smoothstep(0.22, 1, u); break;
      case 'S02/SH01': p = 0.3 + 0.7 * smoothstep(0, 0.62, u); break;
      case 'S03/SH01': over = { 'south-america': lerp(0.55, 1, smoothstep(0.08, 0.7, u)) }; break;
      case 'S03/SH02': p = 0.15 * (1 - smoothstep(0, 1, u)); ridge = 0.9 * smoothstep(0, 0.2, u); break;
      case 'S04/SH01': dry = smoothstep(0.15, 0.9, u); streams = smoothstep(0.02, 0.15, u) * (1 - smoothstep(0.88, 1.05, u)); break;
      case 'S08/SH01': heat = smoothstep(0.1, 0.8, u); break;
      case 'S09/SH01': p = 1 - smoothstep(0, 0.8, u); break;
    }
    // Key light from behind the camera, upper right: the visible face stays lit with a crescent terminator on the left.
    const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
    this.camera.getWorldDirection(fwd); right.crossVectors(fwd, this.camera.up).normalize(); up.crossVectors(right, fwd).normalize();
    const sun = right.multiplyScalar(0.62).add(up.multiplyScalar(0.38)).add(fwd.multiplyScalar(-0.68)).normalize();
    this.globe.sunDirection = sun; this.clouds.sunDirection = sun;
    this.globe.setProgress(p, over);
    this.globe.setDryness(dry, this.center, 0.8);   // coasts stay green, the heart dries
    this.globe.setHeat(heat, this.center, 1.35);
    this.globe.ridgeGlow = ridge;
    this.globe.glint = shot.key === 'S03/SH01' ? 0.25 : 0.6;   // the close seam view would otherwise carry a large glare patch
    this.globe.update(t);
    // Clouds drift out and back so frame 0 and the last frame match for a seamless loop.
    const ct = t < this.duration / 2 ? t : this.duration - t;
    this.clouds.update(ct);
    this.streamMat.uniforms.uTime.value = t; this.streamMat.uniforms.uAmount.value = streams; this.streams.visible = streams > 0.001;
    this.stars.follow(this.camera);
  }
}
