import * as THREE from 'three';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { GasGiant } from '../../../library/planet/GasGiant';
import { Starfield } from '../../../library/space/Starfield';
import { MilkyWaySky } from '../../../library/space/MilkyWay';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';

/** S08/SH01 — space near Earth weeks after the pass (1 unit = 1,000 km): Earth alone, the rogue a small banded disc leaving. */
export class SpaceStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 9 / 16, 0.5, 80000);
  private earth: Earth;
  private rogue = new GasGiant({ radius: 71.492, seed: 11, bands: 7, turbulence: 0.7, zoneColors: [0xe8e0cc, 0xc9d6df], beltColors: [0x667790, 0x9b6c55], poleColor: 0x77889e, segments: 96,
    storms: [{ lat: -22, lon: 40, size: 6, color: 0xf3efe6, strength: 0.9, spin: 1 }, { lat: 18, lon: -70, size: 4, color: 0x5d4a44, strength: 0.75, spin: -1 }] });
  private stars = new Starfield({ seed: 5, count: 6000, radius: 60000, maxSize: 3.2, minY: -1 });
  /** The Milky Way crossing the frame behind Earth (milky-way-sky-v1). */
  private galaxy = new MilkyWaySky({ band: 0.9, stars: 1.1, center: new THREE.Vector3(-0.45, -0.35, -1), along: new THREE.Vector3(1, 0.62, -0.1), seed: 7.3 });
  private mars: THREE.Sprite;
  readonly sunDir = new THREE.Vector3(-0.86, 0.12, 0.49).normalize();
  /** Overlay anchors (world). */
  readonly anchors = { earth: new THREE.Vector3(), rogue: new THREE.Vector3(), mars: new THREE.Vector3() };

  constructor(tex: EarthTextures) {
    this.earth = new Earth(tex, { radius: 6.371, sunDirection: this.sunDir, nightLights: 2.0, atmosphereStrength: 1.1 });
    this.earth.setView(-12, 38);
    this.earth.spinRate = 0.01;
    this.rogue.group.position.set(1100, 1500, -10200);
    this.rogue.sunDirection = this.sunDir; this.rogue.exposure = 1.25; this.rogue.ambient = 0.002;
    this.rogue.body.rotation.set(0.2, 0, 0.35);
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,170,120,1)'); r.addColorStop(0.25, 'rgba(230,110,70,0.6)'); r.addColorStop(1, 'rgba(200,80,40,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.mars = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.mars.position.set(2600, 3400, -30000); this.mars.scale.setScalar(160);
    this.galaxy.addTo(this.scene);
    this.scene.add(this.earth.group, this.rogue.group, this.stars.points, this.mars);
  }

  update(t: number, _shot: ShotInfo) {
    this.earth.update(t);
    this.rogue.update(t, t * 0.2);
    this.stars.follow(this.camera); this.stars.brightness = 0.55;
    this.galaxy.update(t, this.camera);
    this.earth.group.getWorldPosition(this.anchors.earth);
    this.anchors.rogue.copy(this.rogue.group.position);
    this.anchors.mars.copy(this.mars.position);
  }
}
