import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoomBox } from '../../../library/environment/RoomBox';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { box, canvasTexture, glow, rod, solid, surface } from '../../../library/util/Modeling';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';

const ease = (v: number) => { const u = THREE.MathUtils.clamp(v, 0, 1); return u * u * (3 - 2 * u); };

/** Cryostorage and IVF workbench, including an actual optically magnified specimen image.
 * All world dimensions, including the offscreen specimen, are in metres. The specimen
 * never grows into a free-floating prop: its image is displayed on the microscope.
 */
export class LabStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 9 / 16, .003, 80);
  readonly storageAnchor = new THREE.Vector3(0, 1.45, -1);
  readonly dishAnchor = new THREE.Vector3(0, .980, -3.44);
  readonly scopeScreenAnchor = new THREE.Vector3(.48, 1.36, -3.64);

  private tanks = new THREE.Group();
  private laboratory = new THREE.Group();
  private canister = new THREE.Group();
  private vapour: SmokeWisp[] = [];
  private pipette = new THREE.Group();
  private scopeFocus = new THREE.Group();
  private microScene = new THREE.Scene();
  private microCamera = new THREE.OrthographicCamera(-.00010, .00010, .00010, -.00010, .000001, .003);
  private microTarget = new THREE.WebGLRenderTarget(768, 768, {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: true, samples: 2,
  });
  private specimen = new THREE.Group();
  private savedViewport = new THREE.Vector4();

  constructor(private renderer: THREE.WebGLRenderer) {
    this.scene.background = new THREE.Color(0x263f4a);
    this.scene.fog = new THREE.Fog(0x263f4a, 8, 20);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(environment, .04).texture;
    this.scene.environmentIntensity = .30;
    environment.dispose(); pmrem.dispose();

    const room = new RoomBox({ width: 7, height: 3.2, depth: 6.7, wallColor: 0x344c55, floorColor: 0x415b64, ceiling: false });
    this.scene.add(room, this.tanks, this.laboratory);
    const tile = surface(0x49636b, .52, .15), rearTrim = surface(0x61767b, .6, .12), dark = surface(0x263d48, .45, .3);
    const rearCabinet = surface(0x52696e, .6, .12);
    box(room, [6.9, .018, 6.6], tile, [0, .015, -3.35]);
    for (let i = 1; i < 7; i++) box(room, [6.85, .002, .009], surface(0x29414a), [0, .026, -.95 * i]);
    for (const x of [-2.3, -.8, .8, 2.3]) box(room, [.009, .002, 6.6], surface(0x29414a), [x, .026, -3.35]);
    for (const x of [-3.38, 3.38]) {
      box(room, [.055, .045, 5.9], glow(0x6ebfcf, .30), [x, .13, -3.3]);
      box(room, [.07, .7, 5.9], dark, [x, .42, -3.3]);
      box(room, [.025, .018, 5.8], glow(0x76c2ce, .25), [x * .991, .79, -3.3]);
    }
    // A glazed observation wall gives the lab depth without floating graphic elements.
    box(room, [5.5, 1.15, .06], dark, [0, 1.95, -6.55]);
    const window = new THREE.MeshPhysicalMaterial({ color: 0x6399a6, roughness: .12, metalness: .25, transparent: true, opacity: .28 });
    box(room, [5.35, 1.02, .022], window, [0, 1.95, -6.50]);
    for (const x of [-1.8, 0, 1.8]) box(room, [.035, 1.06, .05], rearTrim, [x, 1.95, -6.46]);
    for (const x of [-2, 2]) {
      box(room, [1.1, .68, .6], rearCabinet, [x, .36, -6.07]);
      box(room, [1.13, .055, .65], rearTrim, [x, .73, -6.07]);
      for (const y of [.24, .46]) {
        box(room, [1.00, .015, .016], dark, [x, y, -5.756]);
        rod(room, [x - .12, y + .07, -5.73], [x + .12, y + .07, -5.73], .009, rearTrim);
      }
    }
    for (const x of [-2, 0, 2]) {
      box(room, [.8, .06, 1.65], surface(0x708286), [x, 3.08, -3.2]);
      box(room, [.68, .012, 1.5], glow(0xd2f1ee, .45), [x, 3.04, -3.2]);
    }
    // Keep the clinical room readable, with quieter fill behind the sample action.
    this.scene.add(new THREE.HemisphereLight(0xe2e9e5, 0x303e45, .65));
    const key = new THREE.DirectionalLight(0xe5ece8, 2.25);
    key.position.set(-2, 5, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 18 });
    key.shadow.bias = -.00015; key.shadow.normalBias = .006; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xa7cbd0, .65); rim.position.set(3, 3, -6); this.scene.add(rim);
    const warm = new THREE.PointLight(0xffe5bc, 1.8, 5, 2); warm.position.set(-1.4, 2.1, -2.7); this.scene.add(warm);
    // Local task illumination comes from immediately beneath the visible hood strip.
    const benchFill = new THREE.PointLight(0xe5f1ed, 3, 3.5, 2); benchFill.position.set(0, 2.02, -3.74); this.laboratory.add(benchFill);
    this.buildStorage(); this.buildLaboratory(); this.buildMicroscopeImage();
  }

  private buildStorage() {
    const steel = new THREE.MeshPhysicalMaterial({ color: 0xaabec7, roughness: .24, metalness: .86, clearcoat: .3 });
    const collar = surface(0x243e4c, .34, .65), rubber = surface(0x172d38, .6), white = surface(0xdde7df, .7);
    const tag = canvasTexture(512, 256, c => {
      c.fillStyle = '#e3ece6'; c.fillRect(0, 0, 512, 256);
      c.fillStyle = '#234957'; c.font = 'bold 62px sans-serif'; c.fillText('CRYOSTORAGE', 24, 83);
      c.font = 'bold 92px sans-serif'; c.fillText('LN₂', 24, 193);
      c.font = 'bold 48px monospace'; c.fillText('−196°C', 225, 189);
      for (let i = 0; i < 35; i++) c.fillRect(24 + i * 12, 223, i % 3 ? 3 : 6, 19);
    });
    for (let i = 0; i < 3; i++) {
      const tank = new THREE.Group(); tank.position.set((i - 1) * 1.30, 0, -1 - Math.abs(i - 1) * .82); this.tanks.add(tank);
      solid(tank, new THREE.CylinderGeometry(.38, .34, 1.0, 64), steel, [0, .58, 0]);
      solid(tank, new THREE.TorusGeometry(.35, .036, 12, 64).rotateX(Math.PI / 2), rubber, [0, .10, 0]);
      solid(tank, new THREE.TorusGeometry(.38, .018, 12, 64).rotateX(Math.PI / 2), steel, [0, 1.08, 0]);
      solid(tank, new THREE.CylinderGeometry(.22, .37, .17, 48), steel, [0, 1.165, 0]);
      solid(tank, new THREE.CylinderGeometry(.123, .123, .10, 40, 1, true), collar, [0, 1.30, 0]);
      solid(tank, new THREE.CircleGeometry(.116, 40).rotateX(-Math.PI / 2), rubber, [0, 1.274, 0]);
      solid(tank, new THREE.TorusGeometry(.127, .014, 12, 48).rotateX(Math.PI / 2), steel, [0, 1.35, 0]);
      if (i !== 1) {
        solid(tank, new THREE.CylinderGeometry(.13, .13, .035, 40), white, [0, 1.365, 0]);
        rod(tank, [-.07, 1.4, 0], [.07, 1.4, 0], .012, collar);
      }
      const label = solid(tank, new THREE.PlaneGeometry(.30, .15), new THREE.MeshBasicMaterial({ map: tag }), [0, .84, .379]);
      label.castShadow = false;
      for (const sign of [-1, 1]) {
        rod(tank, [sign * .33, .94, 0], [sign * .45, 1.02, 0], .021, collar);
        rod(tank, [sign * .45, 1.02, 0], [sign * .45, 1.12, 0], .021, collar);
        rod(tank, [sign * .45, 1.12, 0], [sign * .30, 1.14, 0], .021, collar);
      }
      const wisp = new SmokeWisp({ height: .59, baseWidth: .065, topWidth: .29, curl: .16, riseSpeed: .16, color: 0xd5f0f4, seed: 71 + i, opacity: .22 });
      wisp.mesh.position.copy(tank.position).add(new THREE.Vector3(0, 1.36, 0)); this.tanks.add(wisp.mesh); this.vapour.push(wisp);
    }
    this.tanks.add(this.canister); this.canister.position.set(0, 1.05, -1);
    solid(this.canister, new THREE.CylinderGeometry(.083, .083, .23, 32, 1, true), surface(0x7d9eae, .26, .84));
    solid(this.canister, new THREE.CylinderGeometry(.083, .083, .014, 32), steel, [0, -.108, 0]);
    rod(this.canister, [0, -.03, 0], [0, .36, 0], .008, steel);
    rod(this.canister, [-.045, .36, 0], [.045, .36, 0], .01, collar);
    const caps = [0xe3bc61, 0xda8179, 0x79c4ce, 0x9dc4ae];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39996, x = Math.cos(a) * .055, z = Math.sin(a) * .055;
      solid(this.canister, new THREE.CylinderGeometry(.004, .004, .19, 10), surface(0xc3d8df, .26), [x, .1, z]);
      solid(this.canister, new THREE.CylinderGeometry(.005, .005, .02, 10), surface(caps[i % caps.length], .3), [x, .205, z]);
    }
  }

  private buildLaboratory() {
    const white = surface(0xd8e6e1, .32, .08), steel = surface(0x9bb5bf, .24, .8), dark = surface(0x163340, .38, .32);
    const cabinet = surface(0xa1b2b0, .5, .08), cabinetBack = surface(0x38515a, .55, .15);
    box(this.laboratory, [2.9, .08, 1.25], cabinet, [0, .85, -3.5]);
    for (const x of [-1.29, 1.29]) for (const z of [-3.97, -3.03]) rod(this.laboratory, [x, .05, z], [x, .81, z], .034, steel);
    box(this.laboratory, [2.65, .025, .75], steel, [0, .23, -3.62]);
    // Laminar-flow cabinet encloses the bench rather than leaving laboratory props in a void.
    for (const x of [-1.47, 1.47]) box(this.laboratory, [.075, 1.35, 1.16], cabinet, [x, 1.52, -3.64]);
    box(this.laboratory, [2.97, .18, 1.20], cabinet, [0, 2.19, -3.64]);
    box(this.laboratory, [2.68, .02, .72], glow(0xc2f0ef, .65), [0, 2.085, -3.74]);
    box(this.laboratory, [2.86, 1.22, .06], cabinetBack, [0, 1.51, -4.23]);
    for (let i = 0; i < 26; i++) box(this.laboratory, [.025, .28, .008], dark, [-1.24 + i * .099, 1.94, -4.19]);

    const microscope = new THREE.Group(); microscope.position.set(0, .89, -3.50); this.laboratory.add(microscope);
    box(microscope, [.43, .045, .42], white, [0, .022, 0]);
    box(microscope, [.16, .38, .14], white, [0, .245, -.15]);
    const arm = box(microscope, [.13, .20, .28], white, [0, .47, -.085]); arm.rotation.x = -.15;
    box(microscope, [.37, .024, .31], dark, [0, .075, .055]);
    solid(microscope, new THREE.CylinderGeometry(.04, .04, .035, 32), glow(0xb9e9ef, .35), [0, .05, .06]);
    solid(microscope, new THREE.CylinderGeometry(.032, .032, .20, 32), white, [0, .34, .045]);
    this.scopeFocus.position.set(0, .22, .045); microscope.add(this.scopeFocus);
    solid(this.scopeFocus, new THREE.CylinderGeometry(.063, .063, .045, 32), dark);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, x = Math.sin(a) * .04, z = Math.cos(a) * .04;
      solid(this.scopeFocus, new THREE.CylinderGeometry(.014, .018, .10, 24), steel, [x, -.065, z]);
      solid(this.scopeFocus, new THREE.CylinderGeometry(.018, .018, .018, 24), surface(i === 0 ? 0xd6b65e : i === 1 ? 0xb04c4d : 0x5a92b8), [x, -.096, z]);
    }
    for (const x of [-.115, .115]) {
      solid(microscope, new THREE.CylinderGeometry(.047, .047, .022, 28).rotateZ(Math.PI / 2), dark, [x, .24, -.14]);
      solid(microscope, new THREE.CylinderGeometry(.026, .026, .035, 24).rotateZ(Math.PI / 2), steel, [x * 1.15, .24, -.14]);
    }
    const ocular = new THREE.Group(); ocular.position.set(0, .59, -.035); ocular.rotation.x = .55; microscope.add(ocular);
    for (const x of [-.044, .044]) {
      solid(ocular, new THREE.CylinderGeometry(.028, .025, .13, 24), dark, [x, 0, 0]);
      solid(ocular, new THREE.CylinderGeometry(.032, .032, .027, 24), surface(0x15252c), [x, .074, 0]);
    }

    // A 60 mm culture dish sits on the microscope's physical stage. The 150 μm
    // specimen is too small to see here; only the instrument's screen resolves it.
    const dish = new THREE.Group(); dish.position.copy(this.dishAnchor); this.laboratory.add(dish);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xe5f7f4, roughness: .07, transmission: .76, thickness: .001, ior: 1.46, transparent: true, opacity: .72, depthWrite: false });
    solid(dish, new THREE.CylinderGeometry(.030, .030, .0014, 64), glass, [0, 0, 0]);
    solid(dish, new THREE.CylinderGeometry(.030, .030, .008, 64, 1, true), glass, [0, .004, 0]);
    solid(dish, new THREE.TorusGeometry(.030, .0009, 8, 64).rotateX(Math.PI / 2), surface(0xdbf5ed, .1, .18), [0, .008, 0]);
    solid(dish, new THREE.CircleGeometry(.0285, 64).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xbce2d7, roughness: .06, transparent: true, opacity: .28, depthWrite: false }), [0, .003, 0]);
    for (const x of [-.11, .11]) box(microscope, [.025, .008, .15], steel, [x, .092, .065]);

    // Micromanipulator: the capillary is supported by a mechanical arm and always
    // points into the culture dish. Its motion represents laboratory work only.
    this.pipette.position.set(.24, 1.07, -3.42); this.laboratory.add(this.pipette);
    box(this.pipette, [.14, .095, .10], white, [.12, .01, 0]);
    rod(this.pipette, [.11, 0, 0], [-.12, -.05, 0], .010, steel);
    rod(this.pipette, [-.12, -.05, 0], [-.22, -.065, 0], .003, surface(0xf5eee1, .22));
    rod(this.laboratory, [.48, .90, -3.74], [.48, 1.23, -3.74], .018, steel);
    // The circular microscope field is visibly embedded in a real mounted display.
    box(this.laboratory, [.43, .47, .055], dark, [.48, 1.36, -3.68]);
    box(this.laboratory, [.395, .43, .008], surface(0x06141b, .18), [.48, 1.36, -3.647]);
    const display = solid(this.laboratory, new THREE.CircleGeometry(.171, 96), new THREE.MeshBasicMaterial({ map: this.microTarget.texture, toneMapped: false }), [.48, 1.36, -3.639]);
    display.castShadow = false; display.receiveShadow = false;
    solid(this.laboratory, new THREE.TorusGeometry(.176, .005, 12, 96), steel, [.48, 1.36, -3.634]);
    for (let i = 0; i < 3; i++) solid(this.laboratory, new THREE.SphereGeometry(.0037, 8, 8), glow(i === 0 ? 0x7de6b3 : 0x385866, i === 0 ? .7 : 0), [.43 + i * .05, 1.15, -3.639]);

    // Real consumables provide scale and purposeful laboratory detail.
    const rack = new THREE.Group(); rack.position.set(-.92, .89, -3.78); this.laboratory.add(rack);
    box(rack, [.31, .032, .15], surface(0x72aab0, .4), [0, .02, 0]);
    for (let i = 0; i < 6; i++) {
      const x = -.12 + (i % 3) * .12, z = i < 3 ? -.04 : .04;
      solid(rack, new THREE.CylinderGeometry(.012, .010, .092, 16), surface(0xc6dfe0, .2), [x, .070, z]);
      solid(rack, new THREE.CylinderGeometry(.014, .014, .018, 16), surface(i % 2 ? 0xe6b65c : 0x58aebb, .32), [x, .126, z]);
    }
    box(this.laboratory, [.25, .18, .19], surface(0xbdd9d7, .55), [1.02, .98, -3.79]);
    const tissue = box(this.laboratory, [.09, .06, .002], surface(0xe4eeea, .9), [1.02, 1.09, -3.79]); tissue.rotation.z = .2;
  }

  private buildMicroscopeImage() {
    this.microScene.background = new THREE.Color(0xa4b1a5);
    this.microScene.environment = this.scene.environment; this.microScene.environmentIntensity = .10;
    this.microScene.add(new THREE.HemisphereLight(0xfff3d4, 0x5b7e75, .8));
    const key = new THREE.DirectionalLight(0xfff0d2, 1.6); key.position.set(-1, 3, 2); this.microScene.add(key);
    const fill = new THREE.DirectionalLight(0x9ccbc6, .35); fill.position.set(2, 1, -2); this.microScene.add(fill);
    this.microCamera.position.set(.00002, .00032, .00006); this.microCamera.lookAt(0, 0, 0);
    this.microCamera.updateProjectionMatrix();
    this.microScene.add(this.specimen);
    const membrane = new THREE.MeshPhysicalMaterial({ color: 0xb8a47e, roughness: .36, metalness: 0, clearcoat: .2, clearcoatRoughness: .2, sheen: .18, sheenColor: new THREE.Color(0xe2d8b7) });
    // Eight blastomeres inside a single zona pellucida. Overall diameter ~150 μm.
    for (let i = 0; i < 8; i++) {
      const x = (i & 1 ? 1 : -1) * .000025, y = (i & 2 ? 1 : -1) * .000025, z = (i & 4 ? 1 : -1) * .000025;
      const cell = solid(this.specimen, new THREE.SphereGeometry(.0000285, 48, 32), membrane, [x, y, z]);
      cell.scale.set(1 + (i % 3) * .025, 1 - (i % 2) * .035, 1); cell.castShadow = false; cell.receiveShadow = false;
      // Subtle intracellular granules give the specimen optical texture without
      // adding diagram-like nuclei or implying an already developed fetus.
      for (let k = 0; k < 17; k++) {
        const a = k * 2.399 + i, r = .000015 * Math.sqrt((k + .5) / 17);
        const gx = x + Math.cos(a) * r, gz = z + Math.sin(a) * r;
        const gy = y + Math.sqrt(Math.max(0, .0000285 ** 2 - r * r)) * .989;
        const granule = solid(this.specimen, new THREE.SphereGeometry(.0000010 + (k % 3) * .00000012, 8, 6), surface(k % 2 ? 0xa49373 : 0xc8b78f, .6), [gx, gy, gz]);
        granule.castShadow = false; granule.receiveShadow = false;
      }
    }
    const zona = solid(this.specimen, new THREE.SphereGeometry(.000075, 96, 64), new THREE.MeshPhysicalMaterial({ color: 0xe4dec4, roughness: .18, transparent: true, opacity: .20, depthWrite: false, side: THREE.FrontSide, clearcoat: .4 }));
    zona.castShadow = false; zona.receiveShadow = false; zona.renderOrder = 2;
    const outer = solid(this.specimen, new THREE.SphereGeometry(.000077, 96, 64), new THREE.MeshBasicMaterial({ color: 0xf1e8d4, transparent: true, opacity: .085, depthWrite: false, side: THREE.BackSide }));
    outer.castShadow = false; outer.receiveShadow = false;
    const floor = solid(this.microScene, new THREE.PlaneGeometry(.002, .002).rotateX(-Math.PI / 2), surface(0xa5b2a6, .9), [0, -.000080, 0]);
    floor.castShadow = false; floor.receiveShadow = false;
  }

  update(t: number, shot: ShotInfo): void {
    const inStorage = shot.sceneId === 'S05';
    this.tanks.visible = inStorage; this.laboratory.visible = !inStorage;
    this.canister.position.y = 1.05 + .40 * ease((t - 24) / 2);
    this.canister.rotation.y = .035 * Math.sin(t * .75);
    for (const [i, wisp] of this.vapour.entries()) wisp.update(t, 12, inStorage ? (i === 1 ? .34 : .12) : 0, this.camera);
    this.pipette.position.y = 1.07 - .020 * ease((t - 28.8) / 1.8) + .020 * ease((t - 32) / 1.3);
    this.scopeFocus.position.y = .22 - .012 * ease((t - 28.2) / 2.2);
    // Very small specimen drift in culture medium; no invented division or birth.
    this.specimen.position.set(Math.sin(t * .24) * .00000035, 0, Math.cos(t * .19) * .00000028);
    if (!inStorage) {
      const target = this.renderer.getRenderTarget();
      this.renderer.getViewport(this.savedViewport);
      this.renderer.setRenderTarget(this.microTarget);
      this.renderer.render(this.microScene, this.microCamera);
      this.renderer.setRenderTarget(target);
      this.renderer.setViewport(this.savedViewport);
    }
  }
}
