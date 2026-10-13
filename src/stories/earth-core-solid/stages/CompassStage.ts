import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Compass } from '../../../library/props/Compass';
import { BokehField } from '../../../library/fx/BokehField';
import { rng, smoothstep } from '../../../library/util/math';
import { Base, frac, type Timing } from './common';

/** Old paper map: parchment tones, faint grid, coast-like contours. */
function mapTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!, r = rng(19);
  const grad = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
  grad.addColorStop(0, '#e7d6ae'); grad.addColorStop(1, '#b89b67'); g.fillStyle = grad; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,60,30,${r() * 0.05})`; g.fillRect(r() * S, r() * S, 2 + r() * 6, 2 + r() * 6); }
  g.strokeStyle = 'rgba(80,55,30,0.25)'; g.lineWidth = 1.5;
  for (let x = 0; x <= S; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(S, x); g.stroke(); }
  g.strokeStyle = 'rgba(70,45,25,0.55)'; g.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
    for (let i = 0; i < 90; i++) { x += (r() - 0.5) * 40; y += (r() - 0.35) * 22; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function woodTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!, r = rng(7);
  g.fillStyle = '#5a3a22'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 140; i++) { g.strokeStyle = `rgba(${30 + r() * 30},${18 + r() * 15},${8 + r() * 10},${0.25 + r() * 0.3})`; g.lineWidth = 1 + r() * 3; const y = r() * S; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 20, S * 0.6, y + (r() - 0.5) * 20, S, y + (r() - 0.5) * 10); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}

/** Macro tabletop: a brass compass on an old map under warm lamp light; the needle loses north. */
export class CompassStage extends Base {
  compass = new Compass({ radius: 0.035 });
  bokeh = new BokehField({ count: 40, seed: 4, center: new THREE.Vector3(0.05, 0.12, -0.7), extent: new THREE.Vector3(0.9, 0.35, 0.2), colors: [0xffb766, 0xffd29a, 0xff9a4a], size: 0.05, gain: 0.8 });

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.camera.near = 0.004; this.camera.far = 20;
    // A soft room environment gives the brass something to reflect (metal renders black without one).
    this.scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    this.scene.background = new THREE.Color(0x120c08);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.6 }));
    const map = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: mapTexture(), roughness: 0.9 }));
    map.position.set(0.02, 0.0008, -0.02); map.rotation.y = 0.18;
    this.compass.group.rotation.y = -0.35;
    const lamp = new THREE.PointLight(0xffb36b, 1.1, 0, 2); lamp.position.set(-0.35, 0.42, 0.12);
    const fill = new THREE.HemisphereLight(0x8aa0c0, 0x2a1a10, 0.35);
    this.scene.add(table, map, this.compass.group, lamp, fill, this.bokeh.points);
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t);
    // Points north with a tiny tremble, then wanders with no preferred direction.
    const lost = smoothstep(0.22, 0.6, u);
    this.compass.heading = 0.35 + 0.02 * Math.sin(t * 9) * (1 - lost) + lost * (1.9 * Math.sin(t * 0.9 + 0.6) + 0.7 * Math.sin(t * 2.3));
    this.bokeh.update(t);
  }
}
