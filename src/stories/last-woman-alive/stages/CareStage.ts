import * as THREE from 'three';
import { ClinicInterior } from '../../../library/environment/ClinicInterior';
import { RoomBox, tableLamp, chair, plant } from '../../../library/environment/RoomBox';
import { POSE_STAND, lerpPose } from '../../../library/characters/Humanoid';
import { actionProgress, applyGroundedPose, applyStraightWalk, seatedPose } from '../../../library/characters/CharacterMotion';
import { box, rod, solid, surface, glow, canvasTexture, screen } from '../../../library/util/Modeling';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { SetStage, lightSet, person } from './common';

/** Aftermath: surviving male staff care for patients; no vanished staff remain in the ward. */
export class CareStage extends SetStage {
  private clinic = new ClinicInterior({ rooms: 3 });
  private workers: ReturnType<typeof person>[] = [];
  private patients: ReturnType<typeof person>[] = [];
  private waiting = new THREE.Group();
  private survivor: ReturnType<typeof person>;
  private consultationDoctor: ReturnType<typeof person>;
  private porter: ReturnType<typeof person>;
  private waitingCart = new THREE.Group();
  private callScreen: THREE.Mesh;
  constructor(_renderer?: THREE.WebGLRenderer) {
    super(); this.scene.background = new THREE.Color(0x738b93); this.scene.add(this.clinic, this.waiting); lightSet(this.scene, true);
    const locations: [number, number, number][] = [[-.15, 0, 1.5], [2.7, .05, 2.1], [.35, 0, -4.8]];
    locations.forEach((at, i) => { const h = person(this.clinic, at, i, true, false); h.root.rotation.y = i === 1 ? -.6 : 0; this.workers.push(h); });
    box(this.workers[0].handL, [.18, .22, .018], surface(0x24414f), [0, -.04, .03]);
    this.clinic.beds.forEach((bed, i) => {
      const p = person(bed, [0, .95, .63], i, false, false);
      p.root.rotation.x = -Math.PI / 2; p.root.scale.multiplyScalar(.73);
      p.setPose({ ...POSE_STAND, armL: [-.03, .08, .2], armR: [-.03, .08, .2], headPitch: -.02 }); this.patients.push(p);
    });
    const waitingRoom = new RoomBox({ width: 6, depth: 6, wallColor: 0xa5b8b5, floorColor: 0x718887 });
    this.waiting.add(waitingRoom); chair(waitingRoom, -.65, -1.6, .16, 0x627f82);
    chair(waitingRoom, -1.85, -3.7, .12, 0x627f82); plant(waitingRoom, [2.5, 0, -5.2]);
    tableLamp(waitingRoom, [-2.1, .9, -2.3], 0xffcf9a, 3);
    box(waitingRoom, [.65, .82, .65], surface(0x526f76), [-2.15, .41, -2.3]);
    this.survivor = person(waitingRoom, [-.65, 0, -1.6], 0, false, true); this.survivor.root.rotation.y = .16;
    this.survivor.root.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.color.getHex() === 0xac7d69) o.material.color.set(0xc29345); });
    box(this.survivor.handR, [.075, .143, .012], surface(0x233641, .3), [0, -.08, .08]);
    const call = canvasTexture(192, 384, c => {
      c.fillStyle = '#183747'; c.fillRect(0, 0, 192, 384);
      c.fillStyle = '#dceae8'; c.font = 'bold 43px sans-serif'; c.textAlign = 'center'; c.fillText('DAD', 96, 76);
      c.font = '20px sans-serif'; c.fillText('Incoming call', 96, 112);
      c.fillStyle = '#90b2bd'; c.beginPath(); c.arc(96, 187, 39, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#254c5a'; c.beginPath(); c.arc(96, 174, 12, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(96, 203, 23, 16, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#b45b61'; c.beginPath(); c.arc(49, 313, 23, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#58b28d'; c.beginPath(); c.arc(143, 313, 23, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#e7f4ed'; c.lineWidth = 5;
      c.beginPath(); c.arc(143, 310, 11, .3, 2.7); c.stroke();
    });
    this.callScreen = solid(this.survivor.handR, new THREE.PlaneGeometry(.06, .123), new THREE.MeshBasicMaterial({ map: call, toneMapped: false }), [0, -.08, .087]);
    this.consultationDoctor = person(waitingRoom, [1.15, 0, -2.25], 1, true, false); this.consultationDoctor.root.rotation.y = -.8;
    this.porter = person(waitingRoom, [1.65, 0, -4.4], 2, true, false); this.porter.root.rotation.y = -.4;
    this.waiting.add(this.waitingCart);
    const chrome = surface(0xa9b9bd, .3, .72), white = surface(0xcbd7d2, .75);
    for (const y of [.25, .86]) box(this.waitingCart, [.58, .055, .78], chrome, [0, y, 0]);
    for (const x of [-.25, .25]) for (const z of [-.32, .32]) {
      rod(this.waitingCart, [x, .1, z], [x, 1.02, z], .018, chrome);
      solid(this.waitingCart, new THREE.CylinderGeometry(.06, .06, .045, 10).rotateZ(Math.PI / 2), surface(0x23363b), [x, .07, z]);
    }
    box(this.waitingCart, [.32, .12, .27], white, [.04, .95, .03]);
  }
  update(t: number, shot: ShotInfo) {
    const consult = shot.sceneId === 'S04'; this.clinic.visible = !consult; this.waiting.visible = consult;
    this.clinic.update(t);
    // A planted clinician reads the attached chart rather than marching on the spot.
    this.workers[0].root.position.set(-.15, -.02, 1.5); this.workers[0].root.rotation.set(0, 0, 0);
    applyGroundedPose(this.workers[0], { ...POSE_STAND, armL: [-.8, .12, 1.1], armR: [-.4, .1, .5],
      headPitch: .12, headYaw: -.12 * actionProgress(t, 13.4, 14.1), breath: Math.sin(t * 1.3) * .06 }, -.02);
    const reach = actionProgress(t, 13.5, 14.3) * (1 - actionProgress(t, 15.3, 16.2));
    this.workers[1].root.position.set(2.7, .055, 1.65); this.workers[1].root.rotation.set(0, -.6, 0);
    applyGroundedPose(this.workers[1], { ...POSE_STAND, lean: .06 + reach * .025,
      armL: [-.22, .1, .35], armR: [-.2, .1, .35], headPitch: .08 + .10 * reach,
      headYaw: -.12 - .25 * actionProgress(t, 13.25, 13.7), breath: Math.sin(t * 1.3 + 1) * .05 }, .055);
    // Actual existing IV tubing, midway between its upper and lower endpoints.
    const ivTarget = this.clinic.ivPoles[0].localToWorld(new THREE.Vector3(.095, 1.315, .05));
    this.workers[1].reachArm('R', ivTarget, new THREE.Vector3(.8, -.5, .3), reach);
    const clinicTravel = applyStraightWalk(this.workers[2], t, { origin: [.35, -.02, -4.8],
      start_s: 13.2, end_s: 16.0, distance_m: 1.32, steps: 6, groundY: -.02,
      pose: { lean: .055, armL: [-.85, .13, .7], armR: [-.85, .13, .7], headYaw: 0, breath: 0 } });
    this.clinic.cart.position.set(.35, 0, -4.0 + clinicTravel.distance_m);
    this.clinic.cart.rotation.set(0, 0, 0); this.clinic.cart.updateMatrixWorld(true);
    for (const side of ['L', 'R'] as const) {
      const grip = this.clinic.cart.localToWorld(new THREE.Vector3(side === 'L' ? .26 : -.26, 1.10, -.36));
      this.workers[2].reachArm(side, grip, new THREE.Vector3(side === 'L' ? .7 : -.7, -.4, .1));
    }
    this.patients.forEach((h, i) => h.setPose({ ...POSE_STAND, breath: Math.sin(t * 1.4 + i) * .24, armL: [-.03, .08, .2], armR: [-.03, .08, .2] }));
    const notice = actionProgress(t, 16.7, 17.25), lift = actionProgress(t, 17.05, 18.25);
    this.survivor.root.position.set(-.65, 0, -1.6); this.survivor.root.rotation.set(0, .16, 0);
    const seated = seatedPose(this.survivor, .5125);
    applyGroundedPose(this.survivor, { ...lerpPose({ ...seated, lean: .10, armR: [-.25, .1, .55], armL: [-.4, .13, .9],
      headYaw: .12, headPitch: .02 }, { lean: .13, armR: [-.65, .1, 1.13], headYaw: -.13, headPitch: .18 }, lift),
      headPitch: .02 + .16 * notice, breath: Math.sin(t * 1.3) * .06 });
    const invite = actionProgress(t, 17.0, 17.75) * (1 - actionProgress(t, 18.5, 19.15));
    this.consultationDoctor.root.position.set(1.15, 0, -2.25); this.consultationDoctor.root.rotation.set(0, -.8, 0);
    applyGroundedPose(this.consultationDoctor, { ...POSE_STAND, armL: [-.15, .1, .25],
      armR: [-.15 - .5 * invite, .12 + .15 * invite, .25 + .5 * invite],
      headYaw: -.4, headPitch: .05, breath: Math.sin(t * 1.25 + 2) * .05 });
    const waitingTravel = applyStraightWalk(this.porter, t, { origin: [1.65, 0, -4.4],
      start_s: 16.5, end_s: 18.7, distance_m: .66, steps: 3,
      pose: { lean: .055, armL: [-.85, .13, .7], armR: [-.85, .13, .7], headYaw: 0, breath: 0 } });
    this.waitingCart.position.set(1.65, 0, -3.70 + waitingTravel.distance_m);
    this.waitingCart.rotation.set(0, 0, 0); this.waitingCart.updateMatrixWorld(true);
    for (const side of ['L', 'R'] as const) {
      const grip = this.waitingCart.localToWorld(new THREE.Vector3(side === 'L' ? .25 : -.25, 1.0, -.32));
      this.porter.reachArm(side, grip, new THREE.Vector3(side === 'L' ? .7 : -.7, -.4, .1));
    }
    if (consult && shot.shotId === 'SH02') {
      // Follow the real handset surface rather than guessing a world-space close-up point.
      this.survivor.root.updateMatrixWorld(true);
      const center = this.callScreen.getWorldPosition(new THREE.Vector3());
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(this.callScreen.matrixWorld);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(this.callScreen.matrixWorld);
      const right = new THREE.Vector3(1, 0, 0).transformDirection(this.callScreen.matrixWorld);
      this.camera.position.copy(center).addScaledVector(normal, .45).addScaledVector(up, .01)
        .addScaledVector(right, .0015 * Math.sin(t * 19));
      this.camera.up.copy(up); this.camera.lookAt(center.clone().addScaledVector(up, -.03));
      this.camera.updateMatrixWorld(true);
    }
  }
}

/** A conventional neonatal incubator, empty: never depicts an artificial human womb. */
export class NeonatalStage extends SetStage {
  private clinicians: ReturnType<typeof person>[] = [];
  private monitorTexture: THREE.CanvasTexture;
  private incubator = new THREE.Group();
  constructor(_renderer?: THREE.WebGLRenderer) {
    super(); this.scene.background = new THREE.Color(0x819b9f); lightSet(this.scene, true);
    const room = new RoomBox({ width: 6, depth: 6, wallColor: 0xa5beb9, floorColor: 0x6c8685 }); this.scene.add(room, this.incubator);
    const chrome = surface(0xb3c3c5, .27, .72), white = surface(0xdce4d9, .6), teal = surface(0x517b7d);
    this.incubator.position.set(-.15, 0, -1.9);
    box(this.incubator, [1.2, .15, .7], white, [0, .92, 0]);
    for (const x of [-.5, .5]) for (const z of [-.27, .27]) {
      rod(this.incubator, [x, .08, z], [x, .9, z], .028, chrome);
      solid(this.incubator, new THREE.CylinderGeometry(.075, .075, .05, 12).rotateZ(Math.PI / 2), surface(0x263c40), [x, .075, z]);
    }
    box(this.incubator, [.9, .055, .51], surface(0xe8ebe0, .85), [0, 1.02, 0]);
    const hood = new THREE.MeshPhysicalMaterial({ color: 0xd5efed, transparent: true, opacity: .2, roughness: .08, metalness: .02, side: THREE.DoubleSide, depthWrite: false });
    box(this.incubator, [1.09, .38, .6], hood, [0, 1.25, 0]);
    for (const x of [-.53, .53]) for (const z of [-.29, .29]) rod(this.incubator, [x, 1.04, z], [x, 1.44, z], .012, white);
    for (const x of [-.53, .53]) rod(this.incubator, [x, 1.44, -.29], [x, 1.44, .29], .012, white);
    for (const z of [-.29, .29]) rod(this.incubator, [-.53, 1.44, z], [.53, 1.44, z], .012, white);
    for (const x of [-.25, .25]) {
      solid(this.incubator, new THREE.TorusGeometry(.085, .012, 8, 24), white, [x, 1.2, .307]);
      solid(this.incubator, new THREE.CircleGeometry(.074, 24), hood, [x, 1.2, .309]);
    }
    box(this.incubator, [.26, .14, .17], teal, [.58, .85, 0]);
    this.monitorTexture = canvasTexture(384, 256, c => this.drawMonitor(c, 0)); screen(room, .72, .48, this.monitorTexture, [-1.7, 1.65, -2.7]);
    rod(room, [-1.7, .1, -2.75], [-1.7, 1.7, -2.75], .03, chrome);
    const h = person(room, [1.1, 0, -2.6], 0, true, false); h.root.rotation.y = -.72; this.clinicians.push(h);
    const distant = person(room, [1.8, 0, -4.8], 1, true, false); distant.root.rotation.y = -.3; this.clinicians.push(distant);
    const cart = box(room, [.7, .05, .65], chrome, [1.7, .9, -4]);
    for (const x of [-.3, .3]) for (const z of [-.27, .27]) rod(cart, [x, -.8, z], [x, -.03, z], .018, chrome);
    box(room, [.56, .07, .45], white, [1.7, .98, -4]);
    solid(room, new THREE.PlaneGeometry(.9, .28), glow(0xc5d8d3, .1), [.1, 2.1, -5.9]);
  }
  private drawMonitor(c: CanvasRenderingContext2D, t: number) {
    c.fillStyle = '#0c282e'; c.fillRect(0, 0, 384, 256);
    c.fillStyle = '#a9d9d2'; c.font = 'bold 27px monospace'; c.fillText('STANDBY', 22, 48);
    c.font = 'bold 54px monospace'; c.fillText('--', 38, 119);
    c.strokeStyle = '#588d8c'; c.lineWidth = 3; c.beginPath(); c.moveTo(25, 177); c.lineTo(355, 177); c.stroke();
    c.fillStyle = Math.sin(t * 2) > 0 ? '#7ab5a5' : '#396a67'; c.beginPath(); c.arc(344, 40, 6, 0, Math.PI * 2); c.fill();
  }
  update(t: number) {
    this.drawMonitor((this.monitorTexture.image as HTMLCanvasElement).getContext('2d')!, t); this.monitorTexture.needsUpdate = true;
    const inspect = actionProgress(t, 34.8, 35.7) * (1 - actionProgress(t, 38.0, 38.8));
    this.clinicians[0].root.position.set(1.1, 0, -2.6); this.clinicians[0].root.rotation.set(0, -.72, 0);
    applyGroundedPose(this.clinicians[0], { ...POSE_STAND, lean: .035 + .055 * inspect,
      armL: [-.16, .1, .3], armR: [-.16, .1, .3], headYaw: -.18 - .18 * inspect,
      headPitch: .06 + .12 * inspect, breath: Math.sin(t * 1.2) * .05 });
    this.clinicians[1].root.position.set(1.8, 0, -4.8); this.clinicians[1].root.rotation.set(0, -.3, 0);
    applyGroundedPose(this.clinicians[1], { ...POSE_STAND, headYaw: -.10 * actionProgress(t, 35.5, 36.4),
      armL: [-.15, .1, .3], armR: [-.15, .1, .3], breath: Math.sin(t * 1.2 + 1) * .04 });
  }
}
