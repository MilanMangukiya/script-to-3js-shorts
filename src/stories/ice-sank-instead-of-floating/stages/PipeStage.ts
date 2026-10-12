import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { GLSL_NOISE } from '../../../library/util/glsl';
import { rng, smoothstep, settle } from '../../../library/util/math';
import { T } from '../timeline';

export const PIPE_TODAY_Y = 1.3, PIPE_WHATIF_Y = 1.21;
const PIPE_R = 0.014, PIPE_Z = 0.045;

/** Two copper water pipes on a cold basement wall (S08). Units: metres. Top = today (bursts), bottom = what if (holds). */
export class PipeStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(26, 9 / 16, 0.05, 60);
  private burst = { value: 0 }; private frost = { value: 0 }; private iceBlob: THREE.Mesh; private glint: THREE.PointLight;

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene, r = rng(31);
    const sky = new SkyDome({ zenithColor: 0x39424e, horizonColor: 0x8d98a6, groundColor: 0x23262b, hazeColor: 0xb9c6d6, hazeAmount: 0.3, sunDirection: new THREE.Vector3(-0.6, 0.5, 0.6), sunColor: 0xe6eeff, sunIntensity: 0, sunGlow: 1.2, curve: 0.6 });
    s.background = new THREE.Color(0x0c0e12);
    s.environment = sky.toEnvironment(renderer); s.environmentIntensity = 0.9;

    const cv = document.createElement('canvas'); cv.width = cv.height = 1024; const c = cv.getContext('2d')!;
    c.fillStyle = '#6f7378'; c.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 60000; i++) { const v = 80 + r() * 90; c.fillStyle = `rgba(${v},${v + 2},${v + 6},${0.18 + r() * 0.3})`; c.fillRect(r() * 1024, r() * 1024, 1 + r() * 3, 1 + r() * 3); }
    for (let i = 0; i < 9; i++) { c.strokeStyle = 'rgba(40,42,46,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, i * 128 + 20); c.lineTo(1024, i * 128 + 20); c.stroke(); }
    const wt = new THREE.CanvasTexture(cv); wt.colorSpace = THREE.SRGBColorSpace; wt.anisotropy = 8;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ map: wt, bumpMap: wt, bumpScale: 0.6, roughness: 0.95 }));
    wall.position.set(0, 1.25, 0); wall.receiveShadow = true; s.add(wall);

    const copper = (burst: boolean) => {
      const m = new THREE.MeshStandardMaterial({ color: 0xb8733a, metalness: 1, roughness: 0.3, side: THREE.DoubleSide });
      if (burst) m.onBeforeCompile = (sh) => {
        sh.uniforms.uBurst = this.burst;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uBurst;').replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            // Open the seam that faces the camera: push both lips apart around the pipe and flare them outward.
            float theta = uv.x * 6.2831853;
            float side = uv.x < 0.5 ? 1.0 : -1.0, mag = uv.x < 0.5 ? theta : 6.2831853 - theta;
            float w = exp(-pow(position.x / 0.032, 2.0)) * uBurst;
            float a2 = side * (mag + w * 0.62 * (1.0 - mag / 3.14159));
            float rr = length(position.yz) * (1.0 + 0.32 * w * exp(-pow(mag / 0.8, 2.0)));
            transformed.y = sin(a2) * rr; transformed.z = cos(a2) * rr;
          }`);
      };
      return m;
    };
    const frostMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uFrost: this.frost },
      vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uFrost; varying vec3 vP; varying vec3 vN; ${GLSL_NOISE}
        void main(){ float n = fbm(vP.xy*90.0 + vP.z*60.0) * 0.6 + vnoise(vP.xz*400.0) * 0.4;
          float a = smoothstep(1.05 - uFrost*0.95, 1.2 - uFrost*0.9, n + 0.35) * (0.55 + 0.45*max(vN.z, 0.0)); gl_FragColor = vec4(vec3(0.82, 0.9, 0.96), a*0.75); }`,
    });
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xc9dfee, roughness: 0.5, emissive: 0x6f9cc0, emissiveIntensity: 0.12 });
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.6, roughness: 0.5 });
    for (const [y, isToday] of [[PIPE_TODAY_Y, true], [PIPE_WHATIF_Y, false]] as const) {
      const g = new THREE.Group(); g.position.set(0, y, PIPE_Z); s.add(g);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_R, PIPE_R, 1.4, 64, 160, true).rotateZ(Math.PI / 2), copper(isToday)); pipe.castShadow = true; g.add(pipe);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_R * 0.9, PIPE_R * 0.9, 1.4, 24).rotateZ(Math.PI / 2), iceMat); g.add(core);
      const fr = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_R * 1.045, PIPE_R * 1.045, 1.4, 48, 1, true).rotateZ(Math.PI / 2), frostMat); fr.renderOrder = 2; g.add(fr);
      for (const x of [-0.19, 0.2]) { const clip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, PIPE_Z + 0.02), clipMat); clip.position.set(x, 0, -PIPE_Z / 2 + 0.008); clip.castShadow = true; g.add(clip); }
      if (isToday) {
        // Ice squeezed out through the split.
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), iceMat), p = blob.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) { const k = 0.8 + r() * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
        blob.geometry.computeVertexNormals(); blob.position.set(0, 0, PIPE_R * 0.55); blob.castShadow = true; g.add(blob); this.iceBlob = blob;
      }
    }
    this.iceBlob = this.iceBlob!;
    const work = new THREE.SpotLight(0xdfe9ff, 9, 6, 0.6, 0.6, 1.4); work.position.set(-0.7, 2.0, 1.1); work.target.position.set(0, 1.25, 0);
    work.castShadow = true; work.shadow.mapSize.set(2048, 2048); work.shadow.bias = -0.0005; work.shadow.radius = 5;
    this.glint = new THREE.PointLight(0xfff1d8, 0, 1.2, 2); this.glint.position.set(0.12, PIPE_WHATIF_Y + 0.03, 0.2);
    s.add(work, work.target, this.glint, new THREE.HemisphereLight(0x9fb0c8, 0x2a2622, 0.5));
  }

  update(t: number, _shot: ShotInfo) {
    this.frost.value = 0.17 * smoothstep(T.frostStart, T.burstStart + 0.2, t);
    const b = settle((t - T.burstStart) * 2.2, 10, 5);
    this.burst.value = Math.max(0, b);
    this.iceBlob.scale.set(0.03 * this.burst.value, 0.008 * this.burst.value, 0.009 * this.burst.value);
    this.iceBlob.visible = this.burst.value > 0.02;
    // A small warm glint passes over the intact pipe on "never burst".
    this.glint.intensity = 0.05 * smoothstep(63.6, 64.4, t) * (1 - smoothstep(65.2, 65.8, t));
    this.glint.position.x = -0.1 + 0.25 * smoothstep(63.6, 65.6, t);
  }
}
