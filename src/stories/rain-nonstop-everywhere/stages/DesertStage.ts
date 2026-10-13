import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { DuneField } from '../../../library/environment/DuneField';
import { GrassField } from '../../../library/environment/GrassField';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Rain } from '../../../library/fx/Rain';
import { clamp, fbm2, lerp, rng, smoothstep } from '../../../library/util/math';
import { Base, OVERCAST, overcastSky, type Timing } from './common';

/** Low dawn sun 10° right of -Z, where the dune horizon from the wide camera is lowest, so the sunrise is in frame. */
const SUN = new THREE.Vector3(0.1724, 0.1219, -0.9775).normalize();
const WARM = { zenith: new THREE.Color(0x8d9fb3), horizon: new THREE.Color(0xe7b88a), haze: new THREE.Color(0xf1c99d), fog: new THREE.Color(0xd8b48e) };
const GREY = { zenith: new THREE.Color(OVERCAST.zenith), horizon: new THREE.Color(OVERCAST.horizon), haze: new THREE.Color(OVERCAST.haze), fog: new THREE.Color(OVERCAST.fog) };

/**
 * Central Sahara: the opening first drop, the wet and greening dune sea of S05 and the sunrise that returns to the
 * frame-0 macro in S09. Weather is a pure function of time and the storyboard's scene windows.
 */
export class DesertStage extends Base {
  dunes = new DuneField({ size: 420, segments: 420, height: 14, wavelength: 90, windDeg: 20, flatRadius: 14, floor: -0.45, seed: 11 });
  rain = new Rain({ count: 22000, box: [24, 12, 24], fallSpeed: 4, wind: [0.5, 0.2], streakLength: 0.26, width: 0.0022, opacity: 0.45, brightness: 1.25, color: 0xe4ecf4, far: 22, seed: 21 });
  pools = new OceanSurface({ size: 520, level: -0.3, waveHeight: 0.05, waveScale: 3, deepColor: 0x343c41, horizonColor: OVERCAST.horizon, zenithColor: OVERCAST.zenith, glitter: 0, fogColor: OVERCAST.fog, fogDensity: 0.0065 });
  grass: GrassField;
  sky: ReturnType<typeof overcastSky>;
  private drop: THREE.Mesh; private crown: THREE.InstancedMesh; private crownDirs: THREE.Vector3[] = []; private mark: THREE.Mesh;
  private tmp = new THREE.Object3D();

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.camera.far = 4000;
    this.sky = overcastSky(this.scene, renderer, { sunDirection: SUN, altitude: 700, fogDensity: 0.0065 });
    this.scene.add(this.dunes.mesh, this.pools.mesh, this.rain.mesh);
    this.grass = new GrassField({
      area: [-7, 7, -12, 3], count: 16000, minHeight: 0.04, maxHeight: 0.16, width: 0.006, seed: 44,
      reject: (x, z) => fbm2(x * 0.85, z * 0.85, 3) < 0.5,
      ground: (x, z) => this.dunes.heightAt(x, z), baseColor: 0x3d5a24, tipColor: 0x9dc66a, dryColor: 0x8fa158,
      sunDirection: new THREE.Vector3(-0.3, 0.9, 0.2), sunColor: 0xc9ccc4, skyColor: OVERCAST.hemiSky, fogColor: OVERCAST.fog, fogDensity: 0.0065,
    });
    this.scene.add(this.grass.mesh);
    // The opening drop: a 3 mm drop, a crown of droplets and a wet mark that darkens the sand beneath it.
    const water = new THREE.MeshPhysicalMaterial({ color: 0xdfeaf2, roughness: 0.04, metalness: 0, transmission: 0.55, thickness: 0.003, ior: 1.33, envMapIntensity: 2.2, clearcoat: 1 });
    this.drop = new THREE.Mesh(new THREE.SphereGeometry(0.0019, 24, 16), water);
    this.crown = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0007, 10, 8), water, 14);
    this.crown.frustumCulled = false;
    const r = rng(7);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + r() * 0.3; this.crownDirs.push(new THREE.Vector3(Math.cos(a) * (0.06 + r() * 0.04), 0.12 + r() * 0.07, Math.sin(a) * (0.06 + r() * 0.04))); }
    this.mark = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
      uniforms: { uK: { value: 0 } },
      vertexShader: `varying vec2 vQ; void main(){ vQ = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
      fragmentShader: `uniform float uK; varying vec2 vQ;
        void main(){ float a = atan(vQ.y, vQ.x), r = length(vQ)*(1.0 + 0.12*sin(a*5.0) + 0.07*sin(a*11.0 + 1.3));
          float m = smoothstep(1.0, 0.72, r)*uK; gl_FragColor = vec4(mix(vec3(1.0), vec3(0.55, 0.49, 0.43), m), 1.0); }`,
    }));
    // Drawn in the opaque pass right after the sand, without a depth test: grazing macro depth precision on some GPUs
    // cannot separate a decal from the ground, and nothing can stand between the camera and this spot in S01.
    this.mark.position.y = 0.0004; this.mark.renderOrder = 1;
    this.scene.add(this.drop, this.crown, this.mark);
  }

  update(t: number, shot: ShotInfo) {
    const T = this.T, S01 = T.S01, S05 = T.S05, S09 = T.S09;
    const open = shot.sceneId === 'S01', green = shot.sceneId === 'S05', end = shot.sceneId === 'S09';
    // Weather state.
    let warm = 0, rainI = 0.5, wet = 1, greening = 0, growth = 0, coverage = 1, poolLevel = -0.3;
    if (open) {
      const u = t - S01.start;
      warm = 0.7 * (1 - smoothstep(0.8, 3.6, u)); rainI = smoothstep(0.9, 3.4, u); wet = 0.86 * smoothstep(0.9, 4.4, u); coverage = lerp(0.8, 1, smoothstep(0.4, 3.2, u));
    } else if (green) {
      const sh1 = T['S05/SH01'], sh2 = T['S05/SH02'];
      greening = t < sh2.start ? 0.22 * smoothstep(sh1.start, sh2.start, t) : 0.22 + 0.16 * smoothstep(sh2.start, sh2.end, t);
      growth = smoothstep(sh2.start + 0.1, sh2.end - 0.6, t);
    } else if (end) {
      const u = t - S09.start;
      warm = 0.7 * smoothstep(0.1, 1.8, u); rainI = 0.4 * (1 - smoothstep(0.3, 2.0, u)); coverage = lerp(1, 0.45, smoothstep(0.1, 1.8, u));
      wet = 1 - smoothstep(1.0, 3.0, u); greening = 0.38 * (1 - smoothstep(1.8, 3.8, u)); growth = 1 - smoothstep(1.8, 3.6, u);
      poolLevel = lerp(-0.3, -0.75, smoothstep(0.7, 3.2, u));
    }
    this.dunes.wetness = wet; this.dunes.greening = greening;
    this.grass.growth = growth;
    this.pools.mesh.visible = !open && poolLevel > -0.7; this.pools.mesh.position.y = poolLevel; this.pools.update(t);
    this.rain.intensity = rainI; this.rain.update(t, this.camera);
    // Light and sky: flat grey overcast ↔ warm low dawn light under a thinning cloud deck.
    const s = this.sky, su = s.sky.uniforms;
    (su.uZenith.value as THREE.Color).copy(GREY.zenith).lerp(WARM.zenith, warm);
    (su.uHorizon.value as THREE.Color).copy(GREY.horizon).lerp(WARM.horizon, warm);
    (su.uHaze.value as THREE.Color).copy(GREY.haze).lerp(WARM.haze, warm);
    su.uSunIntensity.value = 9 * smoothstep(0.25, 0.7, warm); su.uSunGlow.value = 0.6 * warm;
    s.ceiling.coverage = coverage; s.ceiling.sunGlow = 0.15 + 1.4 * warm; s.ceiling.setGap(990, -5590, 2600, warm > 0.01 ? smoothstep(0, 0.7, warm) : 0); s.ceiling.update(t, t * 3, 0);
    const fog = this.scene.fog as THREE.FogExp2; fog.color.copy(GREY.fog).lerp(WARM.fog, warm); fog.density = lerp(0.0065, 0.004, warm);
    s.hemi.intensity = lerp(1.35, 1.1, warm); s.hemi.color.set(OVERCAST.hemiSky).lerp(new THREE.Color(0xd9c7b0), warm);
    s.key.color.set(0xf4f1ea).lerp(new THREE.Color(0xffc489), warm); s.key.intensity = 1.1 + 1.9 * warm;
    s.key.position.set(16, 12, 4).lerp(SUN.clone().multiplyScalar(30), warm);
    this.grass.setLight(s.key.position.clone().normalize(), new THREE.Color(0xc9ccc4).lerp(new THREE.Color(0xffc489), warm).multiplyScalar(0.7 + warm), s.hemi.color, fog.color);
    this.grass.update(t, { bend: 0.12, direction: new THREE.Vector2(0.9, 0.3), gust: 0.4, gustSpeed: 2 });
    // The opening drop (slow motion, labelled) lands at the origin 0.6 s into S01.
    const u = t - S01.start, hit = 0.6, fall = open ? clamp((u - 0.15) / (hit - 0.15)) : 1;
    this.drop.visible = open && u > 0.15 && u < hit;
    this.drop.position.set(0, 0.0019 + 0.07 * (1 - fall), 0); this.drop.scale.set(1, 1.15, 1);
    const age = u - hit;
    this.crown.visible = open && age > 0 && age < 0.55;
    if (this.crown.visible) {
      for (let i = 0; i < 14; i++) {
        const d = this.crownDirs[i], k = Math.max(0, 1 - age / 0.55);
        this.tmp.position.set(d.x * age, Math.max(0.0005, d.y * age - 0.9 * age * age), d.z * age); this.tmp.scale.setScalar(0.35 + 0.65 * k); this.tmp.updateMatrix();
        this.crown.setMatrixAt(i, this.tmp.matrix);
      }
      this.crown.instanceMatrix.needsUpdate = true;
    }
    this.mark.visible = open && age > 0;
    this.mark.scale.setScalar(0.004 + 0.011 * smoothstep(0, 0.18, age));
    (this.mark.material as THREE.ShaderMaterial).uniforms.uK.value = smoothstep(0, 0.06, age) * (1 - smoothstep(2.5, 4.2, u));
    // Tight near plane for the 12 cm macro, relaxed for wide views.
    const h = Math.max(0.02, this.camera.position.y - this.dunes.heightAt(this.camera.position.x, this.camera.position.z));
    this.camera.near = clamp(h * 0.15, 0.01, 0.1); this.camera.updateProjectionMatrix();
  }
}
