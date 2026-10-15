import * as THREE from 'three';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { GLSL_NOISE } from '../../../library/util/glsl';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt } from '../timeline';

/**
 * Earth with a stylised ozone layer: a thin violet shell (drawn ~4x thicker than the real 15-35 km band so it reads
 * at phone size). S02: the shell dissolves overnight. S08: it regrows, fastest where sunlight is strongest (tropics),
 * then spreads poleward.
 */
export class GlobeStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 9 / 16, .05, 2000);
  private earth: Earth;
  private stars = new Starfield({ seed: 23, count: 3000, radius: 600, maxSize: 3.5 });
  private shell: THREE.Mesh;
  private sun = new THREE.Vector3(.9, .25, .55).normalize();

  constructor(tex: EarthTextures) {
    this.earth = new Earth(tex, { radius: 1, sunDirection: this.sun, nightLights: 1.4, atmosphereStrength: 1 });
    this.earth.setView(10, 38);
    this.scene.add(this.earth.group, this.stars.points);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: { uAmount: { value: 1 }, uGrow: { value: 1 }, uMode: { value: 0 }, uSun: { value: this.sun }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vW; varying vec3 vObj;
        void main(){ vObj = position; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `uniform float uAmount, uGrow, uMode, uTime; uniform vec3 uSun; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
        ${GLSL_NOISE}
        void main(){
          vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(vN, V)), 2.6);
          float n = fbm(vObj.xy * 3.1 + vObj.z * 2.3 + 7.0);
          float lat = abs(normalize(vObj).y);
          // Vanish: noise-eroded fade. Regrow: tropics first, then toward the poles, on top of a faint even layer.
          float present = uMode < 0.5 ? smoothstep(n - 0.12, n + 0.12, uAmount * 1.3 - 0.15)
                                      : clamp((uGrow * 1.25 - lat * 0.9 - (n - 0.5) * 0.35) * 2.2, 0.0, 1.0) * mix(0.35, 0.8, uGrow);
          float day = 0.55 + 0.45 * max(dot(vN, uSun), 0.0);
          vec3 col = mix(vec3(0.42, 0.33, 1.0), vec3(0.62, 0.46, 1.0), rim) * day;
          float a = present * (0.10 + 1.25 * rim);
          gl_FragColor = vec4(col * a * 2.6, a);
        }`,
    });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1.014, 128, 64), mat);
    this.scene.add(this.shell);
    this.scene.add(new THREE.AmbientLight(0xffffff, .05));
  }

  update(t: number, shot: ShotInfo) {
    this.earth.update(t);
    this.stars.follow(this.camera);
    const u = (this.shell.material as THREE.ShaderMaterial).uniforms;
    if (shot.sceneId === 'S02') { u.uMode.value = 0; u.uAmount.value = 1 - windowAt(t, T.fade0, T.fade1); }
    else { u.uMode.value = 1; u.uGrow.value = windowAt(t, T.regrow0, T.regrow1); }
    u.uTime.value = t;
    this.shell.rotation.copy(this.earth.group.rotation);
  }

  /** Remaining layer fraction shown in the S02 HUD (exact by premise) and day counter for the regrowth. */
  static ozoneFraction(t: number) { return 1 - windowAt(t, T.fade0, T.fade1); }
  static regrowDay(t: number) { return 1 + 59 * windowAt(t, T.regrow0, T.regrow1); }
}
