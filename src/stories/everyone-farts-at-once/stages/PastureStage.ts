import * as THREE from 'three';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { GrassField } from '../../../library/environment/GrassField';
import { BroadleafTree } from '../../../library/environment/BroadleafTree';
import { Cow } from '../../../library/characters/Cow';
import { AshPuffs } from '../../../library/fx/AshCloud';
import { box, solid, surface } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt, pulse } from '../timeline';

// A sunny pasture, 1 unit = 1 m, looking toward -Z. A herd grazes; one by one cows lift their heads and burp
// (most cattle methane leaves through the mouth). The faint tint marks the gas.
const SUN = new THREE.Vector3(-0.5, 0.62, 0.6).normalize();

interface Grazer { cow: Cow; burp: number; ph: number }

export class PastureStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 9000);
  private rig: SunSkylightRig;
  private grass: GrassField;
  private herd: Grazer[] = [];
  private burps: AshPuffs;

  constructor(renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3f7fd6, horizonColor: 0xb4d2ee, hazeColor: 0xd6e4ef, groundColor: 0x6f7a4a,
      hazeAmount: 0.3, sunGlow: 0.35, discRadiance: 14, glareStrength: 1.0, shadowMapSize: 4096 });
    solid(this.scene, new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), surface(0x4d6a2c, 1), [0, 0, 0]).receiveShadow = true;
    this.grass = new GrassField({ area: [-30, 30, -80, 12], count: 110000, minHeight: 0.08, maxHeight: 0.24, width: 0.012,
      baseColor: 0x2f4f1c, tipColor: 0x8fb24e, dryColor: 0xb5ad62, sunDirection: SUN, fogDensity: 0.002, flowerFraction: 0.02, flowerColor: 0xf5f0d0, seed: 4 });
    this.scene.add(this.grass.mesh);
    for (const [x, z, h] of [[-14, -40, 9], [12, -55, 10], [-26, -70, 11], [22, -30, 8]] as const) {
      const tr = new BroadleafTree({ height: h, canopyWidth: h * 0.75, leafCount: 3000, seed: Math.round(x * 3 - z), leafColor: 0x5f8a36 }); tr.position.set(x, 0, z); this.scene.add(tr);
    }
    for (let x = -30; x <= 30; x += 2.5) { box(this.scene, [0.1, 1.1, 0.1], surface(0x6b5a45, 0.9), [x, 0.55, 8]); box(this.scene, [2.5, 0.08, 0.05], surface(0x7a6650, 0.9), [x + 1.25, 0.95, 8]); }
    const r = rng(9);
    const spots: [number, number, number][] = [[1.2, 0.5, 2.6], [-3.0, -2.5, 0.6], [3.6, -5.0, -0.8], [-1.0, -8.0, 2.2], [5.5, -11.0, 1.4], [-5.5, -12.5, -1.0], [0.8, -16.0, 0.3], [-8.0, -20.0, 2.0], [7.5, -22.0, -2.0]];
    spots.forEach(([x, z, yaw], i) => {
      const cow = new Cow({ seed: 30 + i, coat: i % 4 === 3 ? 'brown' : 'holstein', scale: 0.95 + r() * 0.1 });
      cow.root.position.set(x, 0, z); cow.root.rotation.y = yaw; this.scene.add(cow.root);
      this.herd.push({ cow, burp: T.burps[i % T.burps.length] + (i >= T.burps.length ? 1.7 : 0), ph: r() * 6.28 });
    });
    this.burps = new AshPuffs(200, { ashColor: 0xb5c94a, ambient: 0xffffff, sunColor: 0xffffff, hazeColor: 0xd6e4ef, hazeDensity: 0.0008 });
    this.burps.setLook({ light: 0.35 }); this.burps.mesh.renderOrder = 20; this.scene.add(this.burps.mesh);
  }

  update(t: number, _shot: ShotInfo) {
    this.rig.apply(this.scene, this.camera, { sunDirection: SUN, sunIntensity: 7.5, sunColor: 0xfff3e2, skyAmount: 1, groundAmount: 1, envIntensity: 1, hazeDensity: 0.0009,
      focus: new THREE.Vector3(0, 0, -8), shadowHalfWidth: 30, shadowHalfHeight: 30, shadowDepth: 200 });
    this.grass.update(t, { bend: 0.15, direction: new THREE.Vector2(0.7, -0.7), gust: 0.25, gustSpeed: 2.5 });
    const puffs: { x: number; y: number; z: number; size: number; alpha: number; glow: number; seed: number }[] = [];
    for (const g of this.herd) {
      // Graze, lifting the head to burp: jaw opens, a puff rolls out of the mouth and drifts away.
      const lift = pulse(t, g.burp - 0.5, 1.9);
      const chew = 0.25 + 0.25 * Math.sin(t * 7 + g.ph);
      g.cow.setPose({ graze: 0.85 * (1 - lift) + 0.08 * Math.sin(t * 0.4 + g.ph), headYaw: 0.25 * Math.sin(t * 0.3 + g.ph), jaw: Math.max(chew * (1 - lift), pulse(t, g.burp, 0.6)), tail: 0.35 * Math.sin(t * 2.2 + g.ph), ears: Math.max(0, Math.sin(t * 1.3 + g.ph * 3)) ** 8 });
      const age = t - g.burp;
      if (age > 0 && age < 3.5) {
        const m = g.cow.mouthWorld(), fwd = new THREE.Vector3(Math.sin(g.cow.root.rotation.y), 0, Math.cos(g.cow.root.rotation.y));
        for (let k = 0; k < 18; k++) {
          const a = age - k * 0.025; if (a <= 0) continue;
          puffs.push({ x: m.x + fwd.x * a * 0.6 + 0.18 * Math.sin(k * 2.3), y: m.y + a * 0.25 + 0.1 * Math.cos(k * 1.7), z: m.z + fwd.z * a * 0.6 + 0.18 * Math.cos(k * 3.1),
            size: 0.3 + a * 0.45, alpha: 0.45 * Math.min(1, a * 6) * Math.max(0, 1 - a / 3.5), glow: 0, seed: (k * 0.137 + g.ph) % 1 });
        }
      }
    }
    this.burps.set(puffs, this.camera);
  }
}
