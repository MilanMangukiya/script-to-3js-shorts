import * as THREE from 'three';
import { type Stage, type ShotInfo } from '../../../library/render/FilmPipeline';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { BroadleafTree } from '../../../library/environment/BroadleafTree';
import { GrassField } from '../../../library/environment/GrassField';
import { CityStreet } from '../../../library/environment/CityStreet';
import { SeaIce } from '../../../library/environment/SeaIce';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Flame } from '../../../library/fx/Flame';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { Humanoid, POSE_STAND } from '../../../library/characters/Humanoid';
import { applyGroundedPose } from '../../../library/characters/CharacterMotion';
import { box, solid, rod, surface, canvasTexture } from '../../../library/util/Modeling';
import { T, DEG, ramp, angleLatitude, zeroTiltSun, canonicalSun } from '../timeline';

const pale = surface(0xb4aa92, .9), timber = surface(0x82654b, .85), iron = surface(0x283640, .45, .65);

class GroundBase implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 9 / 16, .04, 15000);
  protected rig: SunSkylightRig;
  constructor(renderer: THREE.WebGLRenderer, polar = false) {
    this.rig = new SunSkylightRig(this.scene, renderer, {
      zenithColor: polar ? 0x204a7a : 0x3e74b2, horizonColor: polar ? 0xb5b7bd : 0xc1d7e7,
      hazeColor: polar ? 0xd7bfa9 : 0xd0d4cf, groundColor: polar ? 0xa6bbca : 0x756d59,
      hazeAmount: .2, sunGlow: .18, discRadiance: 12, glareStrength: .35,
      shadowMapSize: 2048, envCacheSize: 12,
    });
  }
  protected light(sun: THREE.Vector3, sky: number, ground: number, intensity = 2.7, focus = new THREE.Vector3(0, .6, -2)) {
    this.rig.apply(this.scene, this.camera, {
      sunDirection: canonicalSun(sun), sunIntensity: intensity, sunColor: 0xffeed7,
      skyAmount: sky, groundAmount: ground, envIntensity: .48, hazeDensity: .0015,
      focus, shadowHalfWidth: 8, shadowHalfHeight: 8, shadowDepth: 55,
    });
  }
  update(_t: number, _s: ShotInfo) {}
}

/** One continuous physical backyard anchors the opening, failed month change and practical ending. */
export class PatioStage extends GroundBase {
  readonly grill = new THREE.Group();
  readonly lantern = new THREE.Group();
  readonly calendar = new THREE.Group();
  readonly shadowPost = new THREE.Group();
  readonly actor = new Humanoid({ height: 1.72, coat: 'jacket', coatColor: 0x4e6a6c, trouserColor: 0x303740, skinColor: 0xb77f5a, scarfColor: null });
  private calendarPage: THREE.Mesh;
  private months: Record<string, THREE.Texture> = {};
  private lampGlow: THREE.MeshStandardMaterial;
  private lampLight = new THREE.PointLight(0xffb966, 0, 5, 2);
  private emberLight = new THREE.PointLight(0xff7433, .9, 3, 2);
  private nightFill = new THREE.DirectionalLight(0x9cc6e8, .18);
  private nightAmbient = new THREE.HemisphereLight(0x9ebbd4, 0x262d3a, .08);
  private flame = new Flame({ width: .30, height: .20, turbulence: .5, brightness: 1.4, seed: 51, blueBase: .15 });
  private smoke = new SmokeWisp({ height: .8, baseWidth: .035, topWidth: .25, curl: .12, color: 0xa4acb3, seed: 101 });
  private switchKnob: THREE.Mesh;
  private trees: BroadleafTree[] = [];
  private grass: GrassField;
  /** Character pass can be reviewed after composition; all actions are finite, absolute-time and planted. */
  acting = true;

  constructor(renderer: THREE.WebGLRenderer) {
    super(renderer);
    this.nightFill.position.set(2, 5, 4); this.scene.add(this.nightFill, this.nightAmbient);
    box(this.scene, [80, .12, 80], surface(0x38442c, .95), [0, -.11, -15]);
    for (let x = -3; x <= 3; x++) for (let z = -5; z <= 2; z++)
      box(this.scene, [.69, .045, .69], pale, [x * .7, -.025, z * .7 - .9]);
    const grass = this.grass = new GrassField({ area: [-16, 16, -21, -6], count: 2800, seed: 923, minHeight: .15, maxHeight: .27,
      baseColor: 0x42572b, tipColor: 0x809857, fogDensity: .002, sunDirection: zeroTiltSun(45, 17) });
    grass.update(0, { bend: .07, direction: new THREE.Vector2(1, .2), gust: 0 });
    this.scene.add(grass.mesh);
    for (let i = 0; i < 21; i++) box(this.scene, [.29, 1.23, .10], timber, [-4 + i * .4, .615, -6.8]);
    for (const y of [.35, .93]) box(this.scene, [8.5, .09, .12], timber, [0, y, -6.86]);
    for (const [x, z, h] of [[-4.2, -7.4, 5.1], [4.5, -9, 6]] as const) {
      const tree = new BroadleafTree({ height: h, canopyWidth: 3.8, leafCount: 800, leafColor: 0x658348, seed: x < 0 ? 23 : 29 });
      tree.position.set(x, 0, z); this.scene.add(tree); this.trees.push(tree);
    }
    const city = new CityStreet({ blocks: 2, storeysMin: 2, storeysMax: 3, vehicles: 0, windowOccupancy: .2, seed: 180, farFieldRadius: 150 });
    city.group.position.set(-38, -.08, -75); this.scene.add(city.group);

    // Open kettle barbecue: supported bowl, real grate and food, with steady embers rather than an invented catastrophe.
    this.grill.position.set(-.22, .86, -2);
    solid(this.grill, new THREE.SphereGeometry(.40, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), surface(0x223037, .28, .65));
    for (const x of [-.26, .26]) for (const z of [-.22, .22]) rod(this.grill, [x, -.10, z], [x * 1.25, -.86, z * 1.25], .018, iron);
    solid(this.grill, new THREE.TorusGeometry(.395, .018, 8, 64).rotateX(Math.PI / 2), iron, [0, .01, 0]);
    for (let x = -.30; x <= .301; x += .075) {
      const z = Math.sqrt(.36 ** 2 - x ** 2); rod(this.grill, [x, .012, -z], [x, .012, z], .006, iron);
    }
    for (const [x, z] of [[-.16, -.12], [.13, -.07], [0, .16]]) {
      const patty = solid(this.grill, new THREE.CylinderGeometry(.105, .11, .035, 24), surface(0x8e4925, .88), [x, .04, z]);
      for (let k = -1; k <= 1; k++) box(patty, [.14, .002, .008], surface(0x3a251c, .9), [0, .019, k * .035]);
    }
    this.flame.mesh.position.set(.10, -.12, .12); this.smoke.mesh.position.set(-.08, .07, -.02);
    this.grill.add(this.flame.mesh, this.smoke.mesh); this.emberLight.position.set(-.2, .9, -1.95);
    this.scene.add(this.grill, this.emberLight);
    // Table on the same patio, with a lamp that actually illuminates the meal.
    box(this.scene, [.53, .045, .58], timber, [.43, .77, -1.85]);
    for (const x of [.22, .64]) for (const z of [-2.05, -1.65]) box(this.scene, [.04, .76, .04], iron, [x, .38, z]);
    this.lantern.position.set(.43, .81, -1.85);
    solid(this.lantern, new THREE.CylinderGeometry(.10, .12, .045, 24), iron, [0, .02, 0]);
    this.lampGlow = new THREE.MeshStandardMaterial({ color: 0xe6d1a2, emissive: 0xffb354, emissiveIntensity: 0, roughness: .45 });
    solid(this.lantern, new THREE.CylinderGeometry(.071, .071, .20, 24), this.lampGlow, [0, .14, 0]);
    for (const x of [-.08, .08]) for (const z of [-.06, .06]) rod(this.lantern, [x, .04, z], [x, .25, z], .007, iron);
    solid(this.lantern, new THREE.CylinderGeometry(.11, .08, .04, 24), iron, [0, .26, 0]);
    const handle = solid(this.lantern, new THREE.TorusGeometry(.09, .006, 8, 32, Math.PI), iron, [0, .28, 0]);
    this.switchKnob = solid(this.lantern, new THREE.CylinderGeometry(.015, .015, .018, 16).rotateX(Math.PI / 2), iron, [0, .225, .12]);
    box(this.switchKnob, [.004, .019, .002], surface(0xf2ce8d), [0, 0, .010]);
    this.lampLight.position.set(.43, 1.0, -1.85); this.scene.add(this.lantern, this.lampLight);
    // Physical spiral-bound patio calendar. Full words stay attached to a supported, metre-scale prop.
    this.calendar.position.set(-.48, 1.25, -2.10);
    box(this.calendar, [.52, .44, .04], surface(0x263943, .6));
    this.calendarPage = solid(this.calendar, new THREE.PlaneGeometry(.48, .39), new THREE.MeshStandardMaterial({ roughness: .94, side: THREE.DoubleSide }), [0, 0, .025]);
    for (let i = 0; i < 7; i++) solid(this.calendar, new THREE.TorusGeometry(.018, .004, 5, 12).rotateX(Math.PI / 2), iron, [-.20 + i * .067, .22, .01]);
    rod(this.scene, [-.48, 0, -2.15], [-.48, 1.35, -2.15], .015, iron);
    box(this.scene, [.30, .025, .26], iron, [-.48, .0125, -2.15]);
    for (const month of ['JUNE', 'DECEMBER']) for (const time of ['20:00', '17:00', '12:00']) {
      this.months[`${month}/${time}`] = canvasTexture(768, 512, c => {
        c.fillStyle = '#f2e8d1'; c.fillRect(0, 0, 768, 512); c.fillStyle = '#ad4f32'; c.fillRect(0, 0, 768, 140);
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff3dc'; c.font = 'bold 85px Arial'; c.fillText(month, 384, 80);
        c.fillStyle = '#203644'; c.font = 'bold 112px Arial'; c.fillText(time, 384, 265);
        c.font = 'bold 39px Arial'; c.fillText('LOCAL SOLAR TIME', 384, 360);
        c.font = 'bold 38px Arial'; c.fillStyle = '#ad4f32'; c.fillText('BBQ', 384, 445);
      });
    }
    // A real post and foot supply contact/shadow evidence in the unchanged backyard.
    this.shadowPost.position.set(-.68, 0, -2.55);
    rod(this.shadowPost, [0, 0, 0], [0, .60, 0], .018, iron);
    box(this.shadowPost, [.22, .018, .20], iron, [0, .009, 0]); this.scene.add(this.shadowPost, this.calendar);
    this.actor.root.position.set(.80, 0, -1.43); this.actor.root.rotation.y = -Math.PI / 2;
    this.scene.add(this.actor.root);
  }
  update(t: number, shot: ShotInfo) {
    const hook = shot.sceneId === 'S01', equator = shot.sceneId === 'S06';
    const ending = shot.sceneId === 'S08', reschedule = ending && shot.shotId === 'SH02';
    const night = hook || (reschedule && t < T.clockFlipSwitch);
    const month = (shot.sceneId === 'S03' && t >= 11.7) || (ending && !reschedule) ? 'DECEMBER' : 'JUNE';
    const noonProof = shot.sceneId === 'S03';
    const clock = night ? '20:00' : equator || noonProof ? '12:00' : '17:00';
    // The ending's calendar is rescheduled from 20:00 to 17:00; it is not a seasonal change of Sun altitude.
    const hour = night ? 20 : equator || noonProof ? 12 : 17, latitude = equator ? 0 : 45;
    this.light(zeroTiltSun(latitude, hour), night ? .055 : .78, night ? .035 : .65);
    const grassUniforms = (this.grass.mesh.material as THREE.ShaderMaterial).uniforms;
    grassUniforms.uSunDir.value.copy(canonicalSun(zeroTiltSun(latitude, hour)));
    grassUniforms.uSunColor.value.set(0xfff0d8).multiplyScalar(night ? 0 : 1);
    grassUniforms.uSky.value.set(0x9cb8dc).multiplyScalar(night ? .055 : 1);
    this.nightFill.intensity = night ? .18 : 0; this.nightAmbient.intensity = night ? .08 : 0;
    const lamp = hook ? ramp(t, T.lanternOn, T.lanternSettled) : night ? 1 : reschedule ? 0 : equator ? 0 : .2;
    this.lampGlow.emissiveIntensity = .08 + 2.3 * lamp; this.lampLight.intensity = .2 + 4.7 * lamp;
    this.switchKnob.rotation.z = -.9 * (hook ? ramp(t, .3, .72) : reschedule && !night ? 0 : 1);
    const material = this.calendarPage.material as THREE.MeshStandardMaterial;
    material.map = this.months[`${month}/${clock}`]; material.needsUpdate = false;
    const flip = shot.sceneId === 'S03' ? ramp(t, T.monthFlip0, T.monthFlip1) : reschedule ? ramp(t, T.clockMove0, T.clockMove1) : 0;
    this.calendarPage.rotation.x = Math.sin(Math.PI * flip) * 1.35;
    this.flame.update(t, .24 + .12 * ramp(t, .15, .65), this.camera);
    this.smoke.update(t, 2.0, .12, this.camera);
    // A planted finite hand turns the actual lamp switch, then releases and settles.
    this.actor.root.visible = !equator;
    const reach = hook ? ramp(t, 0, .35) * (1 - ramp(t, 1.25, 1.9))
      : reschedule ? ramp(t, 46.6, 47.1) * (1 - ramp(t, 48.15, 48.9)) : 0;
    const notice = hook ? ramp(t, 0, .35) : .4;
    applyGroundedPose(this.actor, { ...POSE_STAND, headPitch: .20 * notice, headYaw: -.18,
      armL: [.08, .12, .25], armR: [.08, .12, .25], lean: .025 * reach }, 0);
    this.actor.root.updateMatrixWorld(true);
    if (this.acting && reach > 0) this.actor.reachArm('R', new THREE.Vector3(.43, 1.035, -1.73), new THREE.Vector3(1.4, 1.0, -1.3), reach);
    this.actor.root.updateMatrixWorld(true);
    this.shadowPost.visible = true;
    this.trees.forEach(tree => { tree.leafFraction = 1; });
  }
}

/** A geographical move, not a season change: real parallel sunlight and grounded shadows. */
export class SunAngleStage extends GroundBase {
  readonly post = new THREE.Group();
  latitude = 0;
  constructor(renderer: THREE.WebGLRenderer) {
    super(renderer);
    box(this.scene, [100, .1, 100], surface(0x657149), [0, -.08, -25]);
    for (let x = -5; x <= 5; x++) for (let z = -10; z <= 5; z++)
      box(this.scene, [.79, .045, .79], pale, [x * .8, -.025, z * .8 - 1]);
    this.post.position.set(0, 0, -2.2);
    rod(this.post, [0, 0, 0], [0, .85, 0], .026, timber, 12);
    box(this.post, [.26, .025, .26], iron, [0, .013, 0]);
    solid(this.post, new THREE.SphereGeometry(.05, 16, 10), surface(0xc8a24c, .4, .6), [0, .87, 0]);
    this.scene.add(this.post);
    // Anchored pergola edges establish which side is up and retain a human-scale environment.
    for (const x of [-2.7, 2.7]) for (const z of [-4, 1]) box(this.scene, [.09, 2.7, .09], timber, [x, 1.35, z]);
    for (const x of [-2.7, 2.7]) box(this.scene, [.12, .12, 5.2], timber, [x, 2.75, -1.5]);
    for (let z = -4; z <= 1; z += .65) box(this.scene, [5.5, .10, .12], timber, [0, 2.75, z]);
  }
  update(t: number, _shot: ShotInfo) {
    this.latitude = angleLatitude(t);
    this.light(zeroTiltSun(this.latitude, 12), .72, .62, 2.7, new THREE.Vector3(0, .6, -1));
  }
}

/** The exact pole is the reversal: Sun at the horizon, with real sea/ice occlusion. */
export class PolarStage extends GroundBase {
  private ice = new SeaIce({ seed: 150, floeCount: 22, area: [-35, 35, -90, -6], minRadius: 1.3, maxRadius: 4.5, thickness: .7, platformRadius: 6 });
  private ocean = new OceanSurface({ size: 24000, level: -.06, deepColor: 0x17394c, horizonColor: 0xb7b4b9, zenithColor: 0x234d79,
    sunDirection: new THREE.Vector3(0, 0, -1), waveHeight: .15, fogDensity: .00007, glitter: .2 });
  constructor(renderer: THREE.WebGLRenderer) {
    super(renderer, true); this.scene.add(this.ice.group, this.ocean.mesh);
    this.scene.add(new THREE.HemisphereLight(0xabc4de, 0x314456, .23));
    // A supported expedition marker keeps the landscape and low solar angle human-readable.
    rod(this.scene, [-1.1, .13, -3], [-1.1, 1.3, -3], .018, surface(0xa0553e));
    box(this.scene, [.27, .20, .02], surface(0xb7683e), [-.97, 1.17, -3]);
  }
  update(t: number, _shot: ShotInfo) {
    // At exactly 90 degrees latitude and zero tilt the geometric solar centre has zero altitude all day.
    // A short portion of its daily azimuthal circle stays in this fixed eye-level view.
    const az = (-95 + 3 * (t - T.polarCut)) * DEG;
    const sun = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    this.light(sun, .26, .18, 2.0, new THREE.Vector3(0, 0, -20));
    this.ocean.uniforms.uSunDir.value.copy(canonicalSun(sun));
    this.ocean.update(t); this.ice.update(t, 0, 0);
  }
}
