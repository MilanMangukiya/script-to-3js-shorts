import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AshPuffs } from '../../../library/fx/AshCloud';
import { POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { applyGroundedPose } from '../../../library/characters/CharacterMotion';
import { box, solid, surface } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt, pulse } from '../timeline';
import { Person, gaitPose } from './common';

// Large elevator car, 1 unit = 1 m: x -1..1, z -1.1..1.1, floor y = 0, doors in the front wall (z = +1.1) opening onto a
// lobby (+Z). Everyone faces the doors. "You" are the camera at the front, turned to face the others. A second button
// panel sits on the left side wall by the rider who keeps jabbing it.
const W = 2.0, D = 2.2, H = 2.4, DOOR = 1.0;
const PANEL = new THREE.Vector3(-0.985, 1.15, -0.3);

interface Rider { p: Person; at: [number, number]; heading: number }

export class ElevatorStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(66, 9 / 16, 0.02, 200);
  private riders: Rider[] = [];
  private waiting: Person;
  private doorL: THREE.Mesh; private doorR: THREE.Mesh;
  private display: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; last: string };
  private button: THREE.MeshStandardMaterial;
  private haze: AshPuffs; private hazeSeeds: { x: number; y: number; z: number; s: number; ph: number }[] = [];

  constructor(renderer: THREE.WebGLRenderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x15130f);
    // Brushed steel with a fine vertical grain.
    const g = document.createElement('canvas'); g.width = 64; g.height = 256; const gx = g.getContext('2d')!;
    const r = rng(12); gx.fillStyle = '#9aa0a6'; gx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 160; i++) { gx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.012 + r() * 0.02})`; gx.fillRect(r() * 64, 0, 1, 256); }
    gx.fillStyle = 'rgba(0,0,0,0.35)'; gx.fillRect(0, 0, 1, 256); gx.fillRect(63, 0, 1, 256);
    const grain = new THREE.CanvasTexture(g); grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(3, 1); grain.colorSpace = THREE.SRGBColorSpace;
    const steel = new THREE.MeshStandardMaterial({ map: grain, color: 0xc4c8cc, metalness: 0.75, roughness: 0.34 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x6a6f75, metalness: 0.8, roughness: 0.3 });
    // Car shell: floor, ceiling, back and side walls, front jambs and header.
    box(this.scene, [W, 0.06, D], surface(0x2b2a29, 0.55), [0, -0.03, 0]);
    box(this.scene, [W, 0.05, D], surface(0xd9d6d0, 0.6), [0, H + 0.025, 0]);
    solid(this.scene, new THREE.PlaneGeometry(1.0, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.15, 2.0) }), [0, H - 0.002, 0]).rotation.x = Math.PI / 2;
    box(this.scene, [W, H, 0.04], steel, [0, H / 2, -D / 2 - 0.02]);
    for (const sx of [-1, 1]) box(this.scene, [0.04, H, D], steel, [sx * (W / 2 + 0.02), H / 2, 0]);
    const jamb = (W - DOOR) / 2;
    for (const sx of [-1, 1]) box(this.scene, [jamb, H, 0.05], steel, [sx * (DOOR / 2 + jamb / 2), H / 2, D / 2 + 0.025]);
    box(this.scene, [DOOR, 0.2, 0.05], steel, [0, H - 0.1, D / 2 + 0.025]);
    // Handrails on the back and side walls.
    for (const [w, d, x, z] of [[W - 0.2, 0.04, 0, -D / 2 + 0.05], [0.04, D - 0.3, -W / 2 + 0.05, -0.1], [0.04, D - 0.3, W / 2 - 0.05, -0.1]] as const) box(this.scene, [w, 0.04, d], darkSteel, [x, 0.92, z]);
    // Doors (inside faces), sliding apart behind the jambs.
    this.doorL = box(this.scene, [DOOR / 2, H - 0.2, 0.03], steel, [-DOOR / 4, (H - 0.2) / 2, D / 2 + 0.065]);
    this.doorR = box(this.scene, [DOOR / 2, H - 0.2, 0.03], steel, [DOOR / 4, (H - 0.2) / 2, D / 2 + 0.065]);
    // Button panel and the floor display above the doors.
    box(this.scene, [0.02, 0.5, 0.18], darkSteel, [PANEL.x - 0.005, PANEL.y, PANEL.z]);
    this.button = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffb347, emissiveIntensity: 0, metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const b = solid(this.scene, new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), i === 4 ? this.button : surface(0x2c2c2c, 0.4, 0.6), [PANEL.x + 0.018, PANEL.y + 0.16 - i * 0.065, PANEL.z]);
      b.rotation.z = Math.PI / 2;
    }
    const dc = document.createElement('canvas'); dc.width = 256; dc.height = 96;
    this.display = { tex: new THREE.CanvasTexture(dc), ctx: dc.getContext('2d')!, last: '' };
    this.display.tex.colorSpace = THREE.SRGBColorSpace;
    solid(this.scene, new THREE.PlaneGeometry(0.34, 0.13), new THREE.MeshBasicMaterial({ map: this.display.tex, color: new THREE.Color(1.4, 1.4, 1.4) }), [0, H - 0.1, D / 2 - 0.002]).rotation.y = Math.PI;
    // Light: a ceiling panel and a little fill; the lobby beyond is warmer.
    const lamp = new THREE.PointLight(0xfff4e6, 2.5, 6, 2); lamp.position.set(0, H - 0.15, 0); this.scene.add(lamp);
    const fill = new THREE.PointLight(0xfff4e6, 1.2, 5, 2); fill.position.set(0, 1.2, 0.5); this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0xf2efe8, 0x403a33, 0.35));
    // Lobby.
    box(this.scene, [8, 0.04, 8], surface(0xd8d0c2, 0.35), [0, -0.02, D / 2 + 4]);
    box(this.scene, [8, 3.2, 0.1], surface(0xc9bda8, 0.8), [0, 1.6, D / 2 + 6]);
    for (const sx of [-1, 1]) box(this.scene, [3.4, 3.2, 0.1], surface(0x8a7a66, 0.7), [sx * 2.5, 1.6, D / 2 + 0.12]);
    const lobbyLight = new THREE.PointLight(0xffe2bd, 6, 12, 2); lobbyLight.position.set(0, 2.9, D / 2 + 2.5); this.scene.add(lobbyLight);
    const plantPot = solid(this.scene, new THREE.CylinderGeometry(0.25, 0.2, 0.5, 18), surface(0x5b4636, 0.8), [1.6, 0.25, D / 2 + 3.2]); void plantPot;
    solid(this.scene, new THREE.SphereGeometry(0.5, 14, 10).scale(1, 1.4, 1), surface(0x3e5a32, 0.85), [1.6, 1.0, D / 2 + 3.2]);

    // Riders (five others), facing the doors (+Z), and the person waiting in the lobby.
    const looks: [number, number, number, number][] = [[-0.25, -0.95, 0xb64a3a, 0xe0ac69], [0.3, -0.9, 0x34495e, 0x8d5524], [0.7, -0.55, 0x6b8e23, 0xf1c27d], [-0.62, -0.5, 0x7d6a98, 0xc68642], [0.05, -0.2, 0xd4a017, 0xffdbac]];
    looks.forEach(([x, z, coat, skin], i) => {
      const p = new Person(this.scene, { height: [1.7, 1.82, 1.64, 1.76, 1.68][i], coat, trousers: [0x2f3640, 0x1e272e, 0x3d3d3d, 0x2c3e50, 0x34495e][i], skin, hair: [0x2b1d14, 0x111111, 0x6b4a2e, 0x3b2a1e, 0x8a6a42][i] });
      this.riders.push({ p, at: [x, z], heading: i === 3 ? -0.55 : 0.1 * Math.sin(i * 2.3) });
    });
    this.waiting = new Person(this.scene, { height: 1.78, coat: 0x2e86ab, trousers: 0x2d3436, skin: 0xd4a373, hair: 0x2b1d14 });
    // A faint tinted haze (the gas itself is colourless; the tint lets you see where it is).
    this.haze = new AshPuffs(40, { ashColor: 0xbfc76a, ambient: 0xffffff, sunColor: 0xffffff, hazeColor: 0xffffff, hazeDensity: 0 });
    this.haze.setLook({ light: 0.25 });
    this.haze.mesh.renderOrder = 20; this.scene.add(this.haze.mesh);
    const hr = rng(77);
    for (let i = 0; i < 40; i++) this.hazeSeeds.push({ x: (hr() - 0.5) * 1.7, y: 0.3 + hr() * 1.8, z: -0.9 + hr() * 1.6, s: hr(), ph: hr() * 6.28 });
  }

  private setDisplay(text: string) {
    if (text === this.display.last) return;
    const c = this.display.ctx; c.fillStyle = '#0b0d0e'; c.fillRect(0, 0, 256, 96);
    c.fillStyle = '#ff8a3d'; c.font = 'bold 64px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 128, 52);
    this.display.tex.needsUpdate = true; this.display.last = text;
  }

  update(t: number, shot: ShotInfo) {
    const end = shot.sceneId === 'S08';
    // Floor display: counting down one floor every 2.2 s of film; "G" once the doors open.
    const floor = end ? (t < T.doorsOpen ? 1 : 0) : Math.max(2, 23 - Math.floor(t / 2.2));
    this.setDisplay(floor === 0 ? '▼ G' : `▼ ${floor}`);
    // Doors slide open at T.doorsOpen.
    const open = end ? windowAt(t, T.doorsOpen, T.doorsOpen + 0.9) : 0;
    this.doorL.position.x = -DOOR / 4 - open * DOOR / 2; this.doorR.position.x = DOOR / 4 + open * DOOR / 2;
    // The door-open button glows each time it is jabbed (S03).
    const jab = shot.sceneId === 'S03' ? this.jabAt(t) : 0;
    this.button.emissiveIntensity = 2.5 * jab;
    this.poseRiders(t, end, open);
    this.updateHaze(t, end, open);
  }

  /** 0..1 contact while the rider by the panel presses the button (three quick jabs). */
  private jabAt(t: number) { return [0, 0.45, 0.9].reduce((m, d) => Math.max(m, pulse(t, T.react + 0.35 + d, 0.14)), 0); }

  private poseRiders(t: number, end: boolean, open: number) {
    const f = T.fart, jolt = pulse(t, f, 0.45);                      // the moment it happens: everyone stiffens
    const smell = windowAt(t, T.react, T.react + 0.8);
    this.riders.forEach((rd, i) => {
      const { p, at, heading } = rd, h = p.h;
      const go = T.doorsOpen + 0.45 + [0, 1, 2, 4, 3][i] * 0.3;   // the two flanking the camera leave first
      if (end && t >= go) { this.exit(p, at, t - go, i); return; }
      const idle = Math.sin(t * 1.1 + i * 1.7);
      let pose: HumanoidPose = { ...POSE_STAND, breath: 0.25 * Math.sin(t * 1.6 + i), headYaw: 0.05 * idle, sideLean: 0.01 * idle };
      // Phone in hand for rider 3 until it happens.
      if (i === 3) pose = { ...pose, armR: [-0.55, 0.05, 1.35], headPitch: 0.35 };
      if (t > f - 0.05) {
        // Freeze, then side-eye: two glance at each other, one at the ceiling, one at you.
        const glance = windowAt(t, f + 0.5, f + 0.9);
        const stare = windowAt(t, T.includingYou - 0.15, T.includingYou + 0.2);
        const g: Partial<HumanoidPose>[] = [{ headYaw: 0.9 }, { headYaw: -0.9 }, { headPitch: -0.55, headYaw: 0.25 }, { headPitch: 0.45, headYaw: -0.3 }, { headYaw: 0.85 * (1 - stare), lean: 0.12 * stare, headPitch: -0.08 * stare }];
        pose = lerpPose(pose, { ...pose, ...g[i] }, glance);
        pose = lerpPose(pose, { ...pose, shrug: 1.0, lean: -0.08, headPitch: -0.15 }, jolt);
      }
      // The smell arrives: a hand over the nose, a fanning hand, a collar pulled up, button jabbing, a cringe.
      if (t > T.react) {
        const reacts: Partial<HumanoidPose>[] = [{ headYaw: 0.2, headPitch: 0.15 }, { shrug: 0.4, headPitch: 0.25 }, { headYaw: -0.3 }, { headYaw: -0.6 }, { lean: 0.08, headPitch: 0.2, shrug: 0.5 }];
        pose = lerpPose(pose, { ...pose, ...reacts[i] }, smell);
      }
      if (end) pose = lerpPose(pose, { ...pose, headYaw: 0, headPitch: 0, shrug: 0 }, windowAt(t, T.doorsOpen - 0.3, T.doorsOpen + 0.2));
      h.root.visible = true; h.root.position.set(at[0], 0, at[1]); h.root.rotation.set(0, heading, 0);
      applyGroundedPose(h, pose, 0);
      h.root.updateMatrixWorld(true);
      const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(h.root.matrixWorld);
      const out = new THREE.Vector3(1, -0.5, 0).applyQuaternion(h.root.quaternion);
      if (t > T.react && !end) {
        if (i === 0) h.reachArm('R', local(0.0, 1.5, 0.14), out, smell);                                  // hand over nose
        if (i === 2) h.reachArm('L', local(-0.12 + 0.12 * Math.sin(t * 14), 1.55, 0.3), out.clone().negate(), smell);   // fanning
        if (i === 1) { h.reachArm('L', local(-0.03, 1.47, 0.12), out.clone().negate(), smell); h.reachArm('R', local(0.03, 1.47, 0.12), out, smell); }
        if (i === 4) h.reachArm('R', local(0.08 + 0.14 * Math.sin(t * 13), 1.56, 0.34), out, smell);                 // fanning in front of the face
        if (i === 3) { const pr = this.jabAt(t); h.reachArm('R', PANEL.clone().add(new THREE.Vector3(0.05 + 0.08 * (1 - pr), -0.1, 0)), out, smell); }
      }
      if (i === 3 && t <= T.react && !end) h.reachArm('L', local(0.12, 1.05, 0.28), out.clone().negate(), 1 - jolt);
    });
    // Person waiting in the lobby: steps toward the opening doors, smells it, recoils and backs off.
    const w = this.waiting; w.h.root.visible = end;
    if (end) {
      const recoil = windowAt(t, T.recoil, T.recoil + 0.4), back = windowAt(t, T.recoil + 0.4, T.recoil + 1.6), step = windowAt(t, T.recoil - 1.3, T.recoil - 0.2);
      // Waits beside the door while everyone files out, steps in, gets the smell, backs off.
      const x = 0.95 - 0.7 * step + 0.25 * back, z = D / 2 + 1.5 - 0.75 * step + 0.9 * back;
      const pose: HumanoidPose = lerpPose({ ...POSE_STAND, breath: 0.2 * Math.sin(t * 1.5) }, { ...POSE_STAND, lean: -0.25, headPitch: -0.1, shrug: 0.6 }, recoil);
      w.h.root.position.set(x, 0, z); w.h.root.rotation.set(0, Math.PI + 0.3 * (1 - step), 0);
      applyGroundedPose(w.h, step > 0 && step < 1 ? lerpPose(gaitPose(Math.PI * step * 1.1 / 0.7, 0.35 * Math.sin(Math.PI * step)), pose, 0.4) : pose, 0);
      if (recoil > 0) { w.h.root.updateMatrixWorld(true); w.h.reachArm('R', new THREE.Vector3(-0.02, 1.52, 0.13).applyMatrix4(w.h.root.matrixWorld), new THREE.Vector3(-1, -0.5, 0), recoil); }
    }
  }

  /** Riders file out through the doors into the lobby, briskly, not looking at anyone. */
  private exit(p: Person, at: [number, number], dt: number, i: number) {
    const pts = [new THREE.Vector2(at[0], at[1]), new THREE.Vector2(-0.12 + 0.06 * i, D / 2 - 0.1), new THREE.Vector2(i === 2 ? -2.6 : -1.4 - 0.32 * i, D / 2 + 1.6 + 0.55 * i)];
    const v = 1.5, dist = Math.max(0, dt) * v;
    let d = dist, k = 0; while (k < pts.length - 2 && d > pts[k].distanceTo(pts[k + 1])) { d -= pts[k].distanceTo(pts[k + 1]); k++; }
    const a = pts[k], b = pts[k + 1], seg = Math.max(1e-6, a.distanceTo(b)), u = Math.min(1, d / seg), pos = a.clone().lerp(b, u);
    const h = p.h; h.root.visible = true;
    h.root.position.set(pos.x, 0, pos.y); h.root.rotation.set(0, Math.atan2(b.x - a.x, b.y - a.y), 0);
    applyGroundedPose(h, gaitPose(Math.PI * dist / 0.7, 0.42 * Math.min(1, dt * 3)), 0);
  }

  private updateHaze(t: number, end: boolean, open: number) {
    const build = windowAt(t, T.fart + 0.4, T.react + 1.2);
    const amount = end ? 0.85 * (1 - 0.6 * open) : build;
    const puffs = this.hazeSeeds.map((q, i) => ({
      x: q.x + 0.08 * Math.sin(t * 0.3 + q.ph), y: q.y + 0.06 * Math.sin(t * 0.25 + q.ph * 2), z: q.z + 0.08 * Math.cos(t * 0.28 + q.ph) + (end ? open * (0.6 + q.s) * 1.2 : 0),
      size: 0.6 + 0.6 * q.s, alpha: amount * 0.05 * (0.6 + 0.4 * Math.sin(t * 0.4 + i)), glow: 0, seed: q.s,
    }));
    this.haze.set(puffs, this.camera);
  }
}
