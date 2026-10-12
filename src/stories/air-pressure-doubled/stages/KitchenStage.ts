import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { BokehField } from '../../../library/fx/BokehField';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { CookingPot } from '../../../library/props/CookingPot';
import { GasBurner } from '../../../library/props/GasBurner';
import { DialGauge } from '../../../library/props/DialGauge';
import { rng, smoothstep, lerp } from '../../../library/util/math';
import { T } from '../timeline';

export const HOB_Y = 0.9;
export const DIAL_POS = new THREE.Vector3(0.06, 1.115, 0.082);

/** Water temperature shown by the thermometer (time-lapse): 92 → 100 °C at "boil", 120 °C at "120", then boiling. */
export function tempAt(t: number): number {
  if (t < T.boil100) return lerp(92, 100, smoothstep(T.S05_start, T.boil100, t) ** 0.8);
  if (t < T.boil120) return lerp(100, 120, smoothstep(T.boil100, T.boil120, t));
  return 120 + 0.25 * Math.sin(t * 7.3) * smoothstep(T.boil120, T.boilFull, t);
}
/** Boil amount for the pot: shimmer, a few bubbles between 100 and 120 °C, rolling boil from 120 °C. */
export function boilAt(t: number): number {
  return 0.05 + 0.17 * smoothstep(T.boil100, T.boil120, t) + 0.78 * smoothstep(T.boil120, T.boilFull, t);
}

/** Home kitchen hob (metres): lit gas burner, stainless pot of water, clip-on dial thermometer, steam. Used by S05. */
export class KitchenStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 9 / 16, 0.01, 50);
  private pot: CookingPot; private burner: GasBurner; private spare: GasBurner; private dial: DialGauge;
  private steam: SmokeWisp[] = []; private bokeh: BokehField;

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene, r = rng(17);
    // Interior environment: bright window to the back-left, warm room, dark counter below.
    const env = new SkyDome({ zenithColor: 0x9aa1a8, horizonColor: 0xc8c2b8, groundColor: 0x3a302a, hazeColor: 0xfff2e2, hazeAmount: 0.3, sunDirection: new THREE.Vector3(-0.7, 0.45, -0.55), sunColor: 0xfff4e4, sunIntensity: 0, sunGlow: 3.5, curve: 0.6 });
    s.add(env.mesh); s.environment = env.toEnvironment(renderer); s.environmentIntensity = 1.0;
    this.bokeh = new BokehField({ count: 40, seed: 9, center: new THREE.Vector3(-0.2, 1.45, -1.6), extent: new THREE.Vector3(1.1, 0.4, 0.3), colors: [0xfff1dc, 0xffe0b6, 0xdfeaf6], size: 110, gain: 0.18 });
    s.add(this.bokeh.points);

    // Counter, hob plate and tiled backsplash.
    const stoneC = document.createElement('canvas'); stoneC.width = stoneC.height = 512; const sc = stoneC.getContext('2d')!;
    sc.fillStyle = '#3b3936'; sc.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5000; i++) { const v = 40 + r() * 70; sc.fillStyle = `rgba(${v + 8},${v + 4},${v},${0.15 + r() * 0.3})`; sc.beginPath(); sc.arc(r() * 512, r() * 512, 0.4 + r() * 1.6, 0, 6.283); sc.fill(); }
    const stoneTex = new THREE.CanvasTexture(stoneC); stoneTex.colorSpace = THREE.SRGBColorSpace; stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.repeat.set(3, 1);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.68), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.35 }));
    counter.position.set(0, HOB_Y - 0.022, -0.12); counter.receiveShadow = true; s.add(counter);
    const hob = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.006, 0.52), new THREE.MeshPhysicalMaterial({ color: 0x18181a, metalness: 0.2, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15 }));
    hob.position.set(-0.12, HOB_Y - 0.003, -0.08); hob.receiveShadow = true; s.add(hob);
    const tiles = document.createElement('canvas'); tiles.width = 1024; tiles.height = 1024; const tc = tiles.getContext('2d')!;
    tc.fillStyle = '#9b9a95'; tc.fillRect(0, 0, 1024, 1024);
    for (let y = 0; y < 16; y++) for (let x = -1; x < 9; x++) { const v = 228 + r() * 18; tc.fillStyle = `rgb(${v},${v - 2},${v - 6})`; tc.fillRect(x * 128 + (y % 2) * 64 + 4, y * 64 + 4, 120, 56); }
    const tileTex = new THREE.CanvasTexture(tiles); tileTex.colorSpace = THREE.SRGBColorSpace; tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(2.4, 1);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshPhysicalMaterial({ map: tileTex, roughness: 0.22, clearcoat: 0.5 }));
    wall.position.set(0, HOB_Y + 0.5, -0.46); wall.receiveShadow = true; s.add(wall);

    // Burners: the lit one under the pot and a cold one beside it.
    this.burner = new GasBurner({ seed: 3 }); this.burner.group.position.set(0, HOB_Y, 0); s.add(this.burner.group);
    this.spare = new GasBurner({ seed: 8, radius: 0.034 }); this.spare.group.position.set(-0.3, HOB_Y, -0.2); s.add(this.spare.group);
    this.pot = new CookingPot({ seed: 6 }); this.pot.group.position.set(0, HOB_Y + this.burner.grateTop, 0); s.add(this.pot.group);
    const potTop = HOB_Y + this.burner.grateTop, waterY = potTop + this.pot.waterLevel;

    // Clip-on thermometer: dial tilted toward the camera, straight stem down into the water.
    this.dial = new DialGauge({ radius: 0.026, min: 0, max: 150, arcDegrees: 270, majorStep: 10, minorStep: 5, labelStep: 50, unit: '°C', bezel: 'steel',
      marks: [{ value: 100, color: '#2f6fd6' }, { value: 120, color: '#d0402a' }], depth: 0.012 });
    this.dial.group.position.copy(DIAL_POS); this.dial.group.rotation.set(-0.375, 0.589, 0, 'YXZ'); s.add(this.dial.group);
    const steel = new THREE.MeshStandardMaterial({ color: 0xd4d8dd, roughness: 0.22, metalness: 1 });
    const stemTop = DIAL_POS.y - 0.026, stemBot = potTop + 0.012;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0016, stemTop - stemBot, 12).translate(0, -(stemTop - stemBot) / 2, 0), steel);
    stem.position.set(DIAL_POS.x - 0.006, stemTop, DIAL_POS.z - 0.009); stem.castShadow = true; s.add(stem);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.006), steel);
    const rimDir = new THREE.Vector2(DIAL_POS.x, DIAL_POS.z).normalize();
    clip.position.set(rimDir.x * 0.104, potTop + 0.122, rimDir.y * 0.104); clip.rotation.y = Math.atan2(rimDir.x, rimDir.y); s.add(clip);

    // Steam wisps over the water (shown as the water nears and reaches the boil).
    for (let i = 0; i < 5; i++) {
      const w = new SmokeWisp({ height: 0.24 + r() * 0.12, baseWidth: 0.03, topWidth: 0.13 + r() * 0.05, curl: 0.05, riseSpeed: 0.14 + r() * 0.05, color: 0xf4f7fa, seed: 2 + i * 3.1, opacity: 0.4 });
      const a = r() * 6.283, rr = r() * 0.06; w.mesh.position.set(Math.cos(a) * rr, waterY + 0.004, Math.sin(a) * rr);
      s.add(w.mesh); this.steam.push(w);
    }
    // Props: wooden spoon and a glass jar of pasta for depth.
    const woodM = new THREE.MeshStandardMaterial({ color: 0xa47548, roughness: 0.7 });
    const spoon = new THREE.Group(); spoon.position.set(0.26, HOB_Y + 0.006, 0.08); spoon.rotation.y = -0.6; s.add(spoon);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.26, 10).rotateZ(Math.PI / 2), woodM); handle.position.set(0.13, 0.008, 0); handle.castShadow = true; spoon.add(handle);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 10).scale(1.3, 0.35, 1), woodM); bowl.position.set(-0.01, 0.009, 0); bowl.castShadow = true; spoon.add(bowl);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 1, thickness: 0.004, ior: 1.5, side: THREE.DoubleSide, depthWrite: false }));
    jar.position.set(-0.42, HOB_Y + 0.1, -0.32); jar.renderOrder = 3; s.add(jar);
    const pasta = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 24), new THREE.MeshStandardMaterial({ color: 0xe0b96a, roughness: 0.9 }));
    pasta.position.set(-0.42, HOB_Y + 0.072, -0.32); s.add(pasta);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 32), new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.6 }));
    lid.position.set(-0.42, HOB_Y + 0.21, -0.32); s.add(lid);

    const key = new THREE.DirectionalLight(0xfff3e2, 2.6); key.position.set(-1.2, 1.1 + HOB_Y, -1.0); key.target.position.set(0, HOB_Y, 0);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -0.6, right: 0.6, top: 0.6, bottom: -0.6, near: 0.1, far: 4 }); key.shadow.bias = -0.0004; key.shadow.radius = 5;
    const front = new THREE.DirectionalLight(0xe2ebf5, 0.55); front.position.set(0.6, 1.0 + HOB_Y, 1.2);
    s.add(key, key.target, front, new THREE.HemisphereLight(0xe8eef5, 0x5a4a3a, 0.55));
  }

  update(t: number, _shot: ShotInfo) {
    const boil = boilAt(t);
    this.pot.update(t, boil);
    this.burner.update(t, 1, this.camera);
    this.spare.update(t, 0);
    this.dial.value = tempAt(t);
    this.bokeh.update(t);
    // Hot water already steams a little at the cut (it matches the climber's breath), more at the boil.
    const steamA = 0.06 + 0.04 * smoothstep(T.boil100 - 0.5, T.boil100 + 0.5, t) + 0.17 * smoothstep(T.boil120, T.boilFull, t) + 0.05 * smoothstep(T.cooker, T.cooker + 1.2, t);
    this.steam.forEach((w, i) => w.update(t, t - (T.S05_start - 1.5 + i * 0.3), steamA, this.camera));
  }
}
