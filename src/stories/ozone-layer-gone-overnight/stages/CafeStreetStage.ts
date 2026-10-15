import * as THREE from 'three';
import { CityStreetClassic } from '../../../library/environment/CityStreetClassic';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { RoomBox, chair, mug } from '../../../library/environment/RoomBox';
import { DialGauge } from '../../../library/props/DialGauge';
import { Starfield } from '../../../library/space/Starfield';
import type { HumanoidPose } from '../../../library/characters/Humanoid';
import { box, solid, surface, rod } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt, meterValue, hatchClosure } from '../timeline';
import { Person, carRig, setCarLights, SIDEWALK_Y, type CarRig } from './common';

// Street along Z. The cafe is the middle shop of the north-side (+X) block at z = 3; its terrace sits on the sunlit
// sidewalk (x 7-12). Morning sun 57 degrees high from the -X side, slightly toward -Z.
const SUN_DAY = new THREE.Vector3(-0.52, 0.839, -0.16).normalize();
const SUN_NIGHT = new THREE.Vector3(0.3, -0.5, 0.81).normalize();
const SEAT_Y = SIDEWALK_Y + .47;
const TABLE_TOP = SIDEWALK_Y + .76;
const HATCH = { z0: 3.6, z1: 4.6, x: 11.93 };

function roundTable(parent: THREE.Object3D, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, SIDEWALK_Y, z); parent.add(g);
  const metal = surface(0x2c3136, .45, .6), top = surface(0xe6e1d6, .35);
  solid(g, new THREE.CylinderGeometry(.36, .36, .03, 32), top, [0, .745, 0]);
  rod(g, [0, .02, 0], [0, .73, 0], .03, metal);
  solid(g, new THREE.CylinderGeometry(.22, .25, .025, 24), metal, [0, .012, 0]);
  return g;
}

export class CafeStreetStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, .03, 15000);
  private city = new CityStreetClassic({ seed: 5521, blocks: 7, storeysMin: 5, storeysMax: 8, wetness: 0, farFieldRadius: 900, vehicles: false });
  private rig: SunSkylightRig;
  private stars = new Starfield({ seed: 77, count: 2400, radius: 400, maxSize: 4, minY: .02 });
  private windowMats: THREE.MeshStandardMaterial[] = [];
  private people: Record<string, Person> = {};
  private cars: CarRig[] = [];
  private props: Record<string, THREE.Object3D> = {};
  private hatch = new THREE.Group();
  private interiorLights: THREE.PointLight[] = [];
  private stringLights: { bulbs: THREE.MeshBasicMaterial; lights: THREE.PointLight[] };
  readonly meter: DialGauge;
  readonly meterAnchor = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3d7ad0, horizonColor: 0xaecbea, hazeColor: 0xd5e3f1,
      groundColor: 0x8d867c, hazeAmount: .28, sunGlow: .35, discRadiance: 14, glareStrength: 1.0, shadowMapSize: 4096 });
    this.scene.add(this.city.group, this.stars.points);
    this.city.group.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.emissiveMap && !this.windowMats.includes(o.material)) this.windowMats.push(o.material);
    });
    for (const m of this.windowMats) m.userData.baseEmission ??= m.emissiveIntensity;
    this.buildCafe();
    this.buildTerrace();

    const P = (k: string, o: ConstructorParameters<typeof Person>[1]) => (this.people[k] = new Person(this.scene, o));
    P('you', { height: 1.74, coat: 0x3d5a6b, trousers: 0x23272e, skin: 0xc49573 });
    P('reader', { height: 1.78, coat: 0xd8cfb8, trousers: 0x3a3f4a, skin: 0xe2b996, hair: 0x6b4a2e });
    P('barista', { height: 1.68, coat: 0x2b2b2e, trousers: 0x1c1d22, skin: 0x8d5a3f });
    const palette = [[0x7c2d12, 0xf1c27d], [0x334155, 0xc68642], [0x3f6212, 0x8d5524], [0x581c87, 0xe0ac69], [0x1e3a8a, 0xffdbac], [0x5b5f66, 0xc68642],
      [0x9a3412, 0xe0ac69], [0x155e75, 0x8d5524], [0x6b7280, 0xf1c27d], [0xa16207, 0xc68642], [0x4c1d95, 0xffdbac], [0x14532d, 0xe0ac69]];
    palette.forEach(([coat, skin], i) => P(`p${i}`, { height: 1.6 + (i % 5) * .045, coat, trousers: 0x1f2937, skin, hat: i === 4 }));
    // Barista's apron and the reader's newspaper.
    box(this.people.barista.h.root, [.34, .5, .02], surface(0x8a5a35, .9), [0, .78, .14]);
    const paper = new THREE.Group(); this.scene.add(paper); this.props.paper = paper;
    box(paper, [.56, .38, .006], surface(0xe9e4d6, .95), [0, 0, 0]);
    for (let i = 0; i < 6; i++) box(paper, [.22, .012, .007], surface(0x6a6a66, .9), [-.12 + (i % 2) * .26, .12 - Math.floor(i / 2) * .07, .001]);
    // Mug held by "you" in the afternoon shot.
    this.props.heldMug = mug(this.people.you.h.handR, [0, -.03, .05], 0xf2ede2);
    // Your coffee at the lower left of the terrace POV (opening and night callback).
    this.props.povMug = mug(this.scene, [0, 0, 0], 0xf2ede2);

    for (let i = 0; i < 16; i++) { const c = carRig(this.scene, [0x45555b, 0x718487, 0x694c41, 0x202c3b, 0x8a8f93, 0x6c2f2f][i % 6]); c.g.visible = false; this.cars.push(c); }

    this.meter = new DialGauge({ radius: .065, min: 0, max: 16, arcDegrees: 260, majorStep: 2, minorStep: 1, labelStep: 4, unit: 'UV INDEX', title: 'UV METER',
      bezel: 'black', faceColor: '#F4F1E8', needleColor: 0xd92d20,
      marks: [...[0.5, 1, 1.5, 2, 2.5].map(v => ({ value: v, color: '#22A447' })), ...[3, 3.5, 4, 4.5, 5, 5.5].map(v => ({ value: v, color: '#E9C320' })),
        ...[6, 6.5, 7, 7.5].map(v => ({ value: v, color: '#F08A1C' })), ...[8, 8.5, 9, 9.5, 10, 10.5].map(v => ({ value: v, color: '#D7263D' })),
        ...[11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16].map(v => ({ value: v, color: '#7B3FC4' }))] });
    const housing = new THREE.Group(); this.props.meter = housing; this.scene.add(housing);
    box(housing, [.17, .22, .045], surface(0x1d2024, .5), [0, 0, -.03]);
    housing.add(this.meter.group); this.meter.group.position.set(0, .02, 0);
    // The printed face should read cleanly: no self-shadow striping from the needle at grazing sun.
    this.meter.group.traverse(o => { if (o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).map) o.receiveShadow = false; });
    solid(housing, new THREE.CylinderGeometry(.012, .012, .03, 12), surface(0x9aa3ab, .3, .7), [0, -.095, 0]);
  }

  private buildCafe() {
    const inside = new THREE.Group(); this.scene.add(inside);
    // Replace this shop's opaque glazing with real glass and a sliding service hatch.
    this.city.group.traverse(o => {
      if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
      if (o.material.color.getHex() !== 0x172b30) return;
      o.geometry.computeBoundingBox(); const c = new THREE.Vector3(); o.geometry.boundingBox!.getCenter(c);
      if (Math.abs(c.x - 11.935) < .1 && Math.abs(c.z - 3) < .2) o.visible = false;
    });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfd0d6, transparent: true, opacity: .08, roughness: .04, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
    const frame = surface(0x1f2428, .45, .4);
    const pane = (z0: number, z1: number, x: number, parent: THREE.Object3D = inside) => {
      const m = solid(parent, new THREE.BoxGeometry(.02, 2.7, z1 - z0), glass, [x, SIDEWALK_Y + 1.5 - .1, (z0 + z1) / 2]); m.castShadow = false;
      for (const z of [z0, z1]) box(parent, [.05, 2.7, .04], frame, [x, SIDEWALK_Y + 1.4, z]);
    };
    pane(1.08, HATCH.z0, 11.93); pane(HATCH.z1, 4.92, 11.93);
    box(inside, [.06, .05, HATCH.z1 - HATCH.z0], frame, [11.93, SIDEWALK_Y + .05, (HATCH.z0 + HATCH.z1) / 2]);
    this.scene.add(this.hatch); pane(0, HATCH.z1 - HATCH.z0, 0, this.hatch);
    box(this.hatch, [.04, .16, .03], surface(0xb9bec3, .3, .8), [.04, SIDEWALK_Y + 1.15, .08]);
    // Interior: open-front room behind the glass, header above the glazing, a window counter and a back bar.
    const room = new RoomBox({ width: 3.84, height: 3.0, depth: 5.2, wallColor: 0xcdb99a, floorColor: 0x6a4a36 });
    room.position.set(12.0, SIDEWALK_Y, 3.0); room.rotation.y = -Math.PI / 2; inside.add(room);
    box(inside, [.1, .3, 3.84], surface(0xcdb99a, .9), [12.03, SIDEWALK_Y + 2.98, 3.0]);
    const wood = surface(0x7a5638, .6), stone = surface(0xe8e2d6, .35);
    box(inside, [.36, .05, 1.8], stone, [12.22, SIDEWALK_Y + .86, 3.95]);
    box(inside, [.3, .8, 1.7], wood, [12.25, SIDEWALK_Y + .43, 3.95]);
    box(inside, [.7, 1.05, 3.4], wood, [16.6, SIDEWALK_Y + .52, 3.0]);
    box(inside, [.75, .05, 3.5], stone, [16.6, SIDEWALK_Y + 1.07, 3.0]);
    box(inside, [.45, .55, .4], surface(0x9aa3ab, .25, .9), [16.65, SIDEWALK_Y + 1.37, 2.4]);
    for (const [x, z] of [[14.2, 2.0], [14.6, 4.2]] as const) { roundTable(inside, x, z); chair(inside, x + .55, z, -Math.PI / 2, 0x5b3d2a).position.y = SIDEWALK_Y; }
    for (const [x, z] of [[14.0, 2.6], [15.6, 3.6]]) {
      const l = new THREE.PointLight(0xffc98f, 0, 7, 2); l.position.set(x, SIDEWALK_Y + 2.7, z); inside.add(l); this.interiorLights.push(l);
      solid(inside, new THREE.SphereGeometry(.09, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.3, 1.5) }), [x, SIDEWALK_Y + 2.62, z]);
    }
    inside.traverse(o => { if (o instanceof THREE.Mesh && o.material !== glass) { o.castShadow = true; o.receiveShadow = true; } });
  }

  private buildTerrace() {
    const t = new THREE.Group(); this.scene.add(t);
    for (const z of [-4.6, -1.0, 3.0, 6.0]) {
      roundTable(t, 8.3, z);
      chair(t, 7.72, z, Math.PI / 2, 0x2d3a3f).position.y = SIDEWALK_Y;
      chair(t, 8.88, z, -Math.PI / 2, 0x2d3a3f).position.y = SIDEWALK_Y;
    }
    this.props.yourMug = mug(t, [8.18, TABLE_TOP, 2.86], 0xf2ede2);
    this.props.coupleMugs = new THREE.Group(); t.add(this.props.coupleMugs);
    mug(this.props.coupleMugs, [8.15, TABLE_TOP, -1.1], 0xe9e2cf); mug(this.props.coupleMugs, [8.45, TABLE_TOP, -.9], 0xdcd5c2);
    this.props.readerMug = mug(t, [8.42, TABLE_TOP, 5.9], 0xe9e2cf);
    this.props.nightMugs = new THREE.Group(); t.add(this.props.nightMugs);
    for (const [x, z] of [[8.12, -4.7], [8.5, -4.4], [8.2, 6.1], [8.45, 5.85]] as const) mug(this.props.nightMugs, [x, TABLE_TOP, z], 0xe9e2cf);
    // String lights under the awning line, for the night scene.
    const bulbs = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) }), lights: THREE.PointLight[] = [];
    const pts: THREE.Vector3[] = [];
    for (let z = -6.5; z <= 7.5; z += .5) { const u = ((z + 6.5) % 3.5) / 3.5; pts.push(new THREE.Vector3(10.65, SIDEWALK_Y + 2.95 - .28 * Math.sin(Math.PI * u), z)); }
    for (const p of pts) solid(t, new THREE.SphereGeometry(.035, 8, 6), bulbs, [p.x, p.y, p.z]);
    for (let i = 0; i < pts.length - 1; i++) rod(t, pts[i].toArray(), pts[i + 1].toArray(), .004, surface(0x111111, .8), 4);
    for (const z of [-3.5, 0, 3.5]) { const l = new THREE.PointLight(0xffc27a, 0, 9, 2); l.position.set(10.2, SIDEWALK_Y + 2.6, z); t.add(l); lights.push(l); }
    this.stringLights = { bulbs, lights };
    t.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId, key = shot.key, night = sc === 'S10';
    for (const p of Object.values(this.people)) p.h.root.visible = false;
    for (const c of this.cars) c.g.visible = false;

    // ---- light
    const dir = night ? SUN_NIGHT : SUN_DAY;
    const indoors = sc === 'S06' || sc === 'S07' || key === 'S09/SH02';
    const focus = indoors || sc === 'S05' ? new THREE.Vector3(10, 2, 3) : new THREE.Vector3(4, 4, -4);
    const half = key === 'S03/SH01' ? 14 : 40;
    this.rig.apply(this.scene, this.camera, { sunDirection: dir, sunIntensity: night ? 0 : 9, sunColor: 0xfff3e2, skyAmount: night ? .035 : 1, groundAmount: night ? 0 : 1,
      envIntensity: night ? .6 : 1, hazeDensity: .0025, focus: key === 'S03/SH01' ? new THREE.Vector3(8.3, 1, 3) : focus, shadowHalfWidth: half, shadowHalfHeight: half, shadowDepth: 160 });
    this.stars.brightness = night ? .9 : 0;
    this.stars.follow(this.camera);
    this.city.update(t, { wetness: 0, lights: night ? 1 : .3 });
    for (const m of this.city.lampHeads) m.emissiveIntensity = night ? 5 : 0;
    for (const l of this.city.lamps) l.intensity = night ? 25 : 0;
    this.windowMats.forEach((m, i) => { m.emissiveIntensity = m.userData.baseEmission * (night ? .75 + .3 * (i % 3) / 2 : .25); });
    for (const l of this.interiorLights) l.intensity = night ? 9 : 3;
    this.stringLights.bulbs.color.setRGB(night ? 9 : .08, night ? 6.4 : .07, night ? 3.2 : .05);
    for (const l of this.stringLights.lights) l.intensity = night ? 20 : 0;

    // ---- hatch: open until the barista slides it shut in S06; closed afterwards
    const closed = sc < 'S06' ? 0 : sc === 'S06' ? hatchClosure(t) : 1;
    this.hatch.position.set(HATCH.x + .055 * (1 - closed), 0, HATCH.z0 - (HATCH.z1 - HATCH.z0) * (1 - closed));

    // ---- props
    this.props.coupleMugs.visible = this.props.readerMug.visible = !night;
    this.props.nightMugs.visible = night;
    this.props.yourMug.visible = sc !== 'S09';
    this.props.paper.visible = !night;
    this.props.heldMug.visible = key === 'S09/SH02';
    const m = this.props.meter;
    if (sc <= 'S04') { m.position.set(8.43, TABLE_TOP + .11, 3.13); m.rotation.set(-.55, .95, 0, 'YXZ'); }
    else if (sc === 'S05' || sc === 'S06') {
      // S05: held in your hand at the lower right of the POV, tilted toward the eye. S06: set down on the counter.
      m.position.copy(this.camera.localToWorld(new THREE.Vector3(.06, -.11, -.45)));
      m.quaternion.copy(this.camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.35, -.25, .08)));
      if (sc === 'S06') { m.position.set(12.2, SIDEWALK_Y + .99, 4.1); m.rotation.set(-.4, .97, 0, 'YXZ'); }
    } else { m.position.set(12.2, SIDEWALK_Y + .99, 4.1); m.rotation.set(-.4, .97, 0, 'YXZ'); }
    m.visible = sc <= 'S07' || key === 'S09/SH02';
    const pov = this.props.povMug, holding = sc === 'S01' || sc === 'S10';
    pov.visible = holding;
    if (holding) { pov.position.copy(this.camera.localToWorld(new THREE.Vector3(-.12, -.2, -.62))); pov.quaternion.copy(this.camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.45, 2.4, 0))); pov.updateMatrixWorld(true); }
    this.meter.value = meterValue(t, sc);
    m.updateMatrixWorld(true); this.meter.group.getWorldPosition(this.meterAnchor);

    // ---- people and traffic
    if (sc <= 'S05') this.dayTerrace(t, sc);
    if (sc === 'S06') { this.dayTerrace(t, sc); this.barista(t); }
    if (sc <= 'S06') this.traffic(t, false);
    if (sc === 'S07' || key === 'S09/SH02') this.traffic(t, true);
    if (key === 'S09/SH02') this.youAtWindow(t);
    if (night) this.nightStreet(t);
  }

  private dayTerrace(t: number, sc: string) {
    const p = this.people;
    // The couple chats in the sun, unaware; heads turn as they talk.
    p.p0.sit([7.72, -1.0], Math.PI / 2, SEAT_Y, { headYaw: .25 * Math.sin(t * .9), headPitch: .05, armL: [-.7, .1, 1.1], armR: [-.85, .12, 1.25], lean: .22 });
    p.p1.sit([8.88, -1.0], -Math.PI / 2, SEAT_Y, { headYaw: -.2 * Math.sin(t * .7 + 1), headPitch: .02, armL: [-.6, .1, .9], armR: [-.75, .15, 1.3], lean: .25 });
    this.reader(t);
    if (sc === 'S06') return;
    p.p2.walk(t, { start: [10.4, -26], heading: 0, t0: 0, speed: [[0, 1.25]] });
    p.p3.walk(t, { start: [-9.4, -2], heading: Math.PI, t0: 0, speed: [[0, 1.2]] });
    p.p4.walk(t, { start: [-10.3, -34], heading: 0, t0: 0, speed: [[0, 1.3]] });
    p.p5.walk(t, { start: [9.9, -46], heading: 0, t0: 0, speed: [[0, 1.15]] });
  }

  /** The reader turns a page once, otherwise reads and sips; full state from absolute time. */
  private reader(t: number) {
    const r = this.people.reader, turn = windowAt(t, T.pageTurn, T.pageTurn + .6) - windowAt(t, T.pageTurn + .7, T.pageTurn + 1.2);
    r.sit([8.3, 6.62], Math.PI, SEAT_Y, { headPitch: .32, headYaw: .05 * Math.sin(t * .6), lean: .08, breath: .15 * Math.sin(t * 1.3), armL: [-.9, .2, 1.3], armR: [-.9, .2, 1.3] });
    r.h.root.updateMatrixWorld(true);
    const chest = new THREE.Vector3(); r.h.chestAnchor.getWorldPosition(chest);
    const paperAt = chest.clone().add(new THREE.Vector3(0, -.2, -.36));
    const paper = this.props.paper;
    paper.position.copy(paperAt); paper.rotation.set(-1.05, Math.PI + .25 * turn, 0, 'YXZ'); paper.scale.setScalar(.82);
    paper.updateMatrixWorld(true);
    const corner = (x: number) => new THREE.Vector3(x, -.12, .01).applyMatrix4(paper.matrixWorld);
    r.h.reachArm('L', corner(.24 + .08 * turn), new THREE.Vector3(1, -.6, 0), 1);
    r.h.reachArm('R', corner(-.24), new THREE.Vector3(-1, -.6, 0), 1);
  }

  private barista(t: number) {
    const b = this.people.barista, close = hatchClosure(t);
    b.stand([12.5, 3.25], 0, { headPitch: .15, headYaw: -.6 + .1 * close, lean: .05, twist: -.3 });
    if (t > T.hatch0 - .5 && t < T.hatch1 + .5) {
      const handle = new THREE.Vector3(HATCH.x + .09, SIDEWALK_Y + 1.15, this.hatch.position.z + .08);
      b.h.reachArm('R', handle, new THREE.Vector3(.3, -.8, -1), windowAt(t, T.hatch0 - .5, T.hatch0) * (1 - windowAt(t, T.hatch1, T.hatch1 + .5)));
    }
  }

  private traffic(t: number, jam: boolean) {
    this.cars.forEach((c, i) => {
      const lane = i % 2 === 0 ? 1 : -1, k = Math.floor(i / 2);
      if (!jam && k > 1) return;
      c.g.visible = true; c.g.rotation.y = lane > 0 ? 0 : Math.PI;
      let z: number;
      if (jam) {
        // Bumper-to-bumper creep with stop-and-go: brake lights on while stopped.
        const t0 = T.bounds[6], creep = .35 * (t - t0) + .25 * Math.sin((t - t0) * .9 + k);
        z = lane > 0 ? 30 - k * 6.4 - creep : -40 + k * 6.4 + creep;
        setCarLights(c, 0, Math.sin((t - t0) * .9 + k) < .2 ? 'brake' : 'run');
      } else {
        z = lane > 0 ? 18 - (9.5 * t) - k * 34 : -70 + 8.5 * t + k * 30;
        setCarLights(c, 0, 'run');
      }
      c.g.position.set(lane * 3.5, 0, z);
    });
  }

  private youAtWindow(t: number) {
    const you = this.people.you, sip = windowAt(t, T.sip, T.sip + .6) - windowAt(t, T.sip + 1.0, T.sip + 1.5);
    you.stand([12.6, 4.15], 2.29, { headPitch: -.06, headYaw: .85 - .3 * sip, breath: .2 * Math.sin(t * 1.4), armR: [-1.0 - .55 * sip, .25, 1.6 + .4 * sip], armL: [.05, .1, .2] });
  }

  private nightStreet(t: number) {
    const p = this.people, r = rng(91);
    const seats: [number, number, number][] = [[7.72, -4.6, Math.PI / 2], [8.88, -4.6, -Math.PI / 2], [7.72, -1.0, Math.PI / 2], [8.88, -1.0, -Math.PI / 2], [7.72, 6.0, Math.PI / 2], [8.88, 6.0, -Math.PI / 2]];
    seats.forEach(([x, z, h], i) => {
      const ph = r() * 6;
      p[`p${i}`].sit([x, z], h, SEAT_Y, { headYaw: .3 * Math.sin(t * (.7 + .1 * i) + ph), headPitch: .05, lean: .2 + .05 * Math.sin(t + ph),
        armL: [-.7, .1, 1.1], armR: [-.8 - .15 * Math.sin(t * 1.3 + ph), .14, 1.25] } as Partial<HumanoidPose>);
    });
    const t0 = T.bounds[9];
    p.p6.walk(t, { start: [10.4, -20], heading: 0, t0, speed: [[0, 1.2]] });
    p.p7.walk(t, { start: [10.1, -8], heading: Math.PI, t0, speed: [[0, 1.1]] });
    p.p8.walk(t, { start: [-9.2, -14], heading: 0, t0, speed: [[0, 1.25]] });
    p.p9.walk(t, { start: [-10.2, -6], heading: Math.PI, t0, speed: [[0, 1.15]] });
    p.p10.walk(t, { start: [-9.6, -30], heading: 0, t0, speed: [[0, 1.3]] });
    p.p11.walk(t, { start: [10.6, -34], heading: 0, t0, speed: [[0, 1.2]] });
    p.barista.stand([16.1, 3.4], Math.PI / 2, { headPitch: .2, armL: [-.8, .1, 1.2], armR: [-.6, .1, 1.0] });
    for (const [i, c] of this.cars.slice(0, 2).entries()) {
      c.g.visible = true; const lane = i === 0 ? 1 : -1; c.g.rotation.y = lane > 0 ? 0 : Math.PI;
      c.g.position.set(lane * 3.5, 0, lane > 0 ? 25 - 8 * (t - t0) : -60 + 7 * (t - t0)); setCarLights(c, 1, 'run');
    }
  }
}
