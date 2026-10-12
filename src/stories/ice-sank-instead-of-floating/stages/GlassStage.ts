import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { BokehField } from '../../../library/fx/BokehField';
import { GlassOfWater } from '../../../library/props/GlassOfWater';
import { rng, clamp } from '../../../library/util/math';
import { T } from '../timeline';

/** Kitchen-table glass of water with ice cubes (S01 hook and S09 ending). Units: metres. */
export class GlassStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(24, 9 / 16, 0.02, 200);
  private glass: GlassOfWater; private bokeh: BokehField;

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene, r = rng(3);
    // Soft, bright interior: a warm "window" glow at camera left, cool upper room, warm wood bounce below.
    const sky = new SkyDome({ zenithColor: 0x24404e, horizonColor: 0x6f8f96, groundColor: 0x4a3828, hazeColor: 0xd9c9ae, hazeAmount: 0.35, sunDirection: new THREE.Vector3(-0.75, 0.38, -0.55), sunColor: 0xfff0dc, sunIntensity: 0, sunGlow: 2.4, curve: 0.6 });
    s.add(sky.mesh);
    s.environment = sky.toEnvironment(renderer); s.environmentIntensity = 1.0;
    this.bokeh = new BokehField({ count: 46, seed: 5, center: new THREE.Vector3(-0.1, 0.28, -2.4), extent: new THREE.Vector3(1.0, 0.45, 0.5), colors: [0xfff3dc, 0xffe2b8, 0xd9efe2, 0xe4eefb], size: 120, gain: 0.2 });
    s.add(this.bokeh.points);

    const wood = document.createElement('canvas'); wood.width = 1024; wood.height = 1024;
    const wc = wood.getContext('2d')!; wc.fillStyle = '#8a623e'; wc.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 520; i++) { wc.strokeStyle = `rgba(${50 + r() * 60},${28 + r() * 36},${12 + r() * 20},${0.1 + r() * 0.22})`; wc.lineWidth = 0.6 + r() * 2.6; const y = r() * 1024; wc.beginPath(); wc.moveTo(0, y); wc.bezierCurveTo(340, y + (r() - 0.5) * 22, 680, y + (r() - 0.5) * 22, 1024, y + (r() - 0.5) * 12); wc.stroke(); }
    const woodTex = new THREE.CanvasTexture(wood); woodTex.colorSpace = THREE.SRGBColorSpace; woodTex.anisotropy = 8; woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(2, 2);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.42, metalness: 0 }));
    table.receiveShadow = true; s.add(table);

    this.glass = new GlassOfWater({ seed: 8 });
    s.add(this.glass.group);

    const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(-0.7, 0.75, -0.35);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -0.25, right: 0.25, top: 0.25, bottom: -0.25, near: 0.1, far: 3 }); key.shadow.bias = -0.0004; key.shadow.radius = 6;
    const front = new THREE.DirectionalLight(0xdfe9f5, 0.7); front.position.set(0.4, 0.5, 1);
    s.add(key, front, new THREE.HemisphereLight(0xdde8f2, 0x8a6a48, 0.75));
  }

  update(t: number, shot: ShotInfo) {
    const ending = shot.sceneId === 'S09';
    // Hook: cubes drop at "sank". Ending: they lift off the bottom and float again at "the lid".
    const sink = ending ? 1 - clamp((t - T.rise) / (T.riseEnd - T.rise)) : clamp((t - T.sink) / 1.05);
    this.glass.update(t, sink, ending ? (t > T.rise ? t - T.rise : -1) : t - T.sink - 0.1);
    this.bokeh.update(t);
  }
}
