import * as THREE from 'three';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { GrassField } from '../../../library/environment/GrassField';
import { BroadleafTree } from '../../../library/environment/BroadleafTree';
import { VillageHouses } from '../../../library/environment/VillageHouses';
import { Snowfall } from '../../../library/fx/Snowfall';
import { box, solid, surface } from '../../../library/util/Modeling';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt } from '../timeline';
import { Person } from './common';

// A New England farm, 1 unit = 1 m. Yard and house on the left (-X), crop field on the right (+X), looking toward -Z.
// S07 (June 1816): grey overcast, snow falling on green crops and leafy trees. S08 (next June): frosty dawn, the low
// sun rising ahead through haze over the same field, a silo added.
const SUN_OVERCAST = new THREE.Vector3(0.2, 0.75, -0.3).normalize();
const SUN_DAWN = new THREE.Vector3(0.07, 0.075, -1).normalize();
const LEAF = new THREE.Color(0x5f7f38), SNOWY = new THREE.Color(0xdfe6ea);

export class FarmStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 12000);
  private rig: SunSkylightRig;
  private ground: THREE.MeshStandardMaterial;
  private yard: GrassField; private crop: GrassField;
  private trees: BroadleafTree[] = [];
  private snow: Snowfall;
  private roofSnow: THREE.Mesh[] = [];
  private silo = new THREE.Group();
  private farmer1816: Person; private farmer: Person;

  constructor(renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x8a96a3, horizonColor: 0xc4cad0, hazeColor: 0xc9ced3, groundColor: 0x6d6b5e,
      hazeAmount: 0.6, sunGlow: 0.5, discRadiance: 10, glareStrength: 0.9, glareAngularRadius: 0.07, shadowMapSize: 2048 });
    this.ground = new THREE.MeshStandardMaterial({ color: 0x4d4632, roughness: 1 });
    solid(this.scene, new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), this.ground, [0, 0, 0]).receiveShadow = true;
    this.yard = new GrassField({ area: [-40, 5.6, -90, 30], count: 60000, minHeight: 0.08, maxHeight: 0.22, width: 0.012, baseColor: 0x34501f, tipColor: 0x7e9e48, dryColor: 0x9a9a5a, sunDirection: SUN_OVERCAST, fogDensity: 0.004, seed: 3 });
    this.crop = new GrassField({ area: [6.5, 50, -140, 20], count: 90000, minHeight: 0.35, maxHeight: 0.62, width: 0.012, ground: () => 0.02,
      reject: (x) => (x * 1.6) % 1.6 > 1.1, baseColor: 0x3d6224, tipColor: 0x8bb054, dryColor: 0xa7a85e, sunDirection: SUN_OVERCAST, fogDensity: 0.004, seed: 8 });
    this.scene.add(this.yard.mesh, this.crop.mesh);
    // House, barn, fence and trees.
    const house = new VillageHouses({ sites: [[-10, -16, 0.35]], seed: 4, width: [9, 9], depth: [7, 7], height: [5.5, 5.5], roofPitch: [0.42, 0.42],
      wallColors: [0xe9e4d8], roofColors: [0x4a4f57], windowColor: 0xffd9a0, litFraction: 0.3 });
    this.scene.add(house.group);
    const red = surface(0x8d2f23, 0.85), grey = surface(0x4a4a48, 0.8);
    const barn = new THREE.Group(); barn.position.set(-24, 0, -30); barn.rotation.y = 0.5; this.scene.add(barn);
    box(barn, [12, 6, 9], red, [0, 3, 0]);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 6.8, 3.6, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.72), grey); roof.position.set(0, 7.8, 0); roof.rotation.y = Math.PI / 2; barn.add(roof);
    barn.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    for (let z = 10; z > -60; z -= 2.6) {
      box(this.scene, [0.12, 1.1, 0.12], surface(0x6b5a45, 0.9), [6.0, 0.55, z]);
      for (const y of [0.45, 0.9]) box(this.scene, [0.07, 0.09, 2.7], surface(0x7a6650, 0.9), [6.0, y, z - 1.3]);
    }
    for (const [x, z, h] of [[-5, -4, 9], [-17, -8, 10], [-36, -44, 11], [-4, -82, 12], [-14, -60, 10]] as const) {
      const tr = new BroadleafTree({ height: h, canopyWidth: h * 0.7, leafCount: 3800, seed: Math.round(x * 7 + z), leafColor: LEAF.getHex() });
      tr.position.set(x, 0, z); tr.rotation.y = x; this.scene.add(tr); this.trees.push(tr);
    }
    // Snow caps on the roofs (S07), shown as thin pale slabs.
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf0f3f5, roughness: 0.9, transparent: true, opacity: 0 });
    for (const [x, z, w, d, y, ry] of [[-10, -16, 9.6, 7.8, 7.0, 0.35], [-24, -30, 12.4, 9.4, 7.6, 0.5]] as const) {
      const m = solid(this.scene, new THREE.BoxGeometry(w, 0.08, d), snowMat, [x, y, z]); m.rotation.y = ry; this.roofSnow.push(m);
    }
    // Modern grain silo (S08).
    solid(this.silo, new THREE.CylinderGeometry(3, 3, 12, 32), surface(0xb9bcc0, 0.4, 0.7), [0, 6, 0]);
    solid(this.silo, new THREE.ConeGeometry(3.2, 2.2, 32), surface(0xa7aab0, 0.4, 0.7), [0, 13.1, 0]);
    this.silo.position.set(-30, 0, -46); this.silo.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; }); this.scene.add(this.silo);
    this.snow = new Snowfall({ count: 6000, seed: 18, box: [40, 18, 40], fallSpeed: 0.9, drift: 0.6, size: 30, minPx: 1.4, maxPx: 6, color: 0xffffff, brightness: 0.9, additive: false });
    this.scene.add(this.snow.points);
    this.farmer1816 = new Person(this.scene, { height: 1.76, coat: 0x2e2a26, trousers: 0x3a342c, skin: 0xd6a88a, hair: 0x3b2a1e, hat: true });
    this.farmer = new Person(this.scene, { height: 1.79, coat: 0x6b5a2e, trousers: 0x2f3a48, skin: 0xa8734f, hair: 0x2a1f18, hat: true });
  }

  update(t: number, shot: ShotInfo) {
    const s07 = shot.sceneId === 'S07', S = s07 ? 1 : 0;
    const sun = s07 ? SUN_OVERCAST : SUN_DAWN;
    this.rig.apply(this.scene, this.camera, { sunDirection: sun, sunIntensity: s07 ? 0.6 : 2.4, sunColor: s07 ? 0xdde3ea : 0xffb070,
      skyAmount: s07 ? 0.75 : 0.65, groundAmount: s07 ? 0.8 : 0.5, envIntensity: s07 ? 1.1 : 0.8, hazeDensity: s07 ? 0.011 : 0.0028,
      focus: new THREE.Vector3(0, 0, -10), shadowHalfWidth: 45, shadowHalfHeight: 45, shadowDepth: 200 });
    // Snow thickens through S07: ground, roofs, crop tips and leaves whiten. S08: frost on the crop and grass.
    const snowCover = s07 ? 0.35 + 0.45 * windowAt(t, T.bounds[6], T.bounds[7]) : 0;
    const frost = s07 ? 0 : 0.75;
    this.ground.color.set(0x4d4632).lerp(new THREE.Color(0xdfe4e8), Math.max(snowCover * 0.85, frost * 0.45));
    for (const m of this.roofSnow) (m.material as THREE.MeshStandardMaterial).opacity = snowCover;
    const whiten = (f: GrassField, base: number, tip: number) => {
      const u = (f as any).u;
      u.uBase.value.set(base).lerp(new THREE.Color(0xc9d2d8), Math.max(snowCover * 0.5, frost * 0.55));
      u.uTip.value.set(tip).lerp(new THREE.Color(0xf2f5f7), Math.max(snowCover, frost * 0.85));
      u.uSunDir.value.copy(sun);
    };
    whiten(this.yard, 0x34501f, 0x7e9e48); whiten(this.crop, 0x3d6224, 0x8bb054);
    const wind = { bend: 0.08, direction: new THREE.Vector2(1, 0.2), gust: 0.1, gustSpeed: 1.5 };
    this.yard.update(t, wind); this.crop.update(t, wind);
    for (const tr of this.trees) (tr.leaves.material as THREE.MeshStandardMaterial).color.copy(LEAF).lerp(SNOWY, snowCover * 0.6 + frost * 0.25);
    this.snow.points.visible = s07; this.snow.amount = S; this.snow.update(t);
    const cam = this.camera.getWorldPosition(new THREE.Vector3()); this.snow.points.position.set(cam.x, 0, cam.z - 14);
    this.silo.visible = !s07;
    this.farmer1816.h.root.visible = false; this.farmer.h.root.visible = false;
    if (s07) {
      // The farmer looks up at the snow, then holds out a hand to catch it.
      const reach = windowAt(t, T.bounds[6] + 2.6, T.bounds[6] + 3.6);
      this.farmer1816.stand([0.6, 5.0], 0.35, { headPitch: -0.45 + 0.3 * reach, headYaw: -0.1, armR: [-1.15 * reach, 0.12, 0.35 * reach + 0.12], breath: 0.25 * Math.sin(t * 2.2) });
    } else {
      // The farmer walks the field edge toward the lens, stops and looks down at the frosted crop.
      const t0 = T.bounds[7], stop = t0 + 4.2;
      if (t < stop) this.farmer.walk(t, { start: [7.4, -9], heading: 0.03, t0, speed: [[0, 1.0], [stop - 0.6, 1.0], [stop, 0]], ground: 0 });
      else this.farmer.stand([7.4 + Math.sin(0.03) * 3.9, -9 + Math.cos(0.03) * 3.9], 0.03 + 1.2 * windowAt(t, stop, stop + 1), { headPitch: 0.5 * windowAt(t, stop, stop + 1), headYaw: 0.2 }, 0);
    }
  }
}
