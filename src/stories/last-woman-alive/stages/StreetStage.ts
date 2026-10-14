import * as THREE from 'three';
import { CityStreetClassic, makeClassicCityCar } from '../../../library/environment/CityStreetClassic';
import { PedestrianCrowd } from '../../../library/characters/PedestrianCrowd';
import { POSE_STAND } from '../../../library/characters/Humanoid';
import { VanishDissolve } from '../../../library/fx/VanishDissolve';
import { applyCameraSpec } from '../../../library/camera/KeyframeRig';
import { box, solid, surface, canvasTexture, screen } from '../../../library/util/Modeling';
import { rng } from '../../../library/util/math';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { SetStage, outdoor, person, movingPose } from './common';

const vanishAt = .65;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (t: number, a: number, b: number) => { const u = clamp((t - a) / (b - a)); return u * u * (3 - 2 * u); };

/** The crowd's flagged half represents women; the sole survivor is a separate adult rig. */
export class StreetStage extends SetStage {
  private city = new CityStreetClassic({ seed: 7278, blocks: 7, farFieldRadius: 900, wetness: .7, vehicles: false });
  private crowd = new PedestrianCrowd({ seed: 9854, count: 24, width: 13, depth: 8,
    umbrellaCount: 0, heightRange: [1.6, 1.84], childFraction: 0, flagFraction: .5, dissolve: false });
  private sky: ReturnType<typeof outdoor>;
  private friend: ReturnType<typeof person>;
  private friendVanish: VanishDissolve;
  private survivor: ReturnType<typeof person>;
  private cup = new THREE.Group();
  private lid: THREE.Mesh;
  private phone = new THREE.Group();
  private spill: THREE.Mesh;
  private cars = [makeClassicCityCar(0xa45a45), makeClassicCityCar(0x648392)];
  private debris = new THREE.Group();
  private shards: { mesh: THREE.Mesh; x: number; z: number; speed: number; hit: number }[] = [];
  private droplets: THREE.Mesh[] = [];
  constructor(renderer: THREE.WebGLRenderer) {
    super(); this.sky = outdoor(this.scene, renderer);
    this.scene.add(this.city.group, this.crowd.group, this.cup, this.phone, this.debris, ...this.cars);
    // Install gender markers before creating the erosion material, including the friend.
    for (const a of this.crowd.agents) {
      a.baseZ = -3.4 - (this.crowd.agents.indexOf(a) % 5) * 1.35;
      if (a.flagged) {
        solid(a.figure.head, new THREE.SphereGeometry(.06, 12, 8), surface(0x2b211b), [0, .10, -.12]);
        a.dissolveFx = new VanishDissolve(a.root, { seed: 924 + this.crowd.agents.indexOf(a), duration_s: .38 });
        this.crowd.group.add(a.dissolveFx.motes);
      }
    }
    this.friend = person(this.scene, [.15, 0, .3], 2, false, true);
    this.friend.root.rotation.y = .12;
    this.friendVanish = new VanishDissolve(this.friend.root, { seed: 2461, duration_s: .38, moteCount: 52 });
    this.scene.add(this.friendVanish.motes);
    const paper = surface(0xd8cab2, .72), brown = surface(0x755442, .7), dark = surface(0x23303a, .3, .2);
    solid(this.cup, new THREE.CylinderGeometry(.068, .049, .18, 28, 1, true), paper, [0, .09, 0]);
    solid(this.cup, new THREE.CylinderGeometry(.063, .053, .075, 28, 1, true), brown, [0, .09, 0]);
    solid(this.cup, new THREE.CircleGeometry(.061, 28).rotateX(-Math.PI / 2), surface(0x39251a, .18), [0, .174, 0]);
    this.lid = solid(this.scene, new THREE.CylinderGeometry(.071, .073, .019, 28), surface(0x312f2a, .45));
    box(this.phone, [.078, .151, .012], dark);
    screen(this.phone, .064, .131, canvasTexture(128, 240, c => {
      c.fillStyle = '#243d52'; c.fillRect(0, 0, 128, 240);
      c.fillStyle = '#c7d8de'; c.font = 'bold 20px sans-serif'; c.fillText('09:41', 13, 38);
      c.fillStyle = '#e1a34a'; c.beginPath(); c.arc(64, 110, 29, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#cbd7d3'; for (let i = 0; i < 3; i++) c.fillRect(18, 162 + i * 14, 92 - i * 13, 5);
    }), [0, 0, 0]);
    this.spill = solid(this.scene, new THREE.CircleGeometry(.3, 40).rotateX(-Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0x3c2618, roughness: .16, clearcoat: .85, transparent: true, opacity: .9 }), [.44, .014, .63]);
    const r = rng(5218);
    for (let i = 0; i < 22; i++) {
      this.droplets.push(solid(this.scene, new THREE.SphereGeometry(.006 + r() * .009, 6, 4), surface(0x4a2d1d, .22)));
      const m = box(this.debris, [.03 + r() * .07, .015, .035 + r() * .07], surface(i % 3 ? 0x94b0ba : 0x292e33, .25, .45));
      this.shards.push({ mesh: m, x: (r() - .5) * 2, z: (r() - .5) * 2, speed: .8 + r() * 1.8, hit: 12 + (i % 2) * .12 });
    }
    this.survivor = person(this.scene, [.55, 0, .15], 0, false, true);
    this.survivor.root.rotation.y = .22;
    this.survivor.root.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.color.getHex() === 0xac7d69) o.material.color.set(0xc29345);
    });
    const survivorPhone = new THREE.Group(); this.survivor.handR.add(survivorPhone);
    box(survivorPhone, [.075, .143, .012], surface(0x233641, .3), [0, -.01, .018]);
    solid(survivorPhone, new THREE.PlaneGeometry(.06, .123), new THREE.MeshBasicMaterial({ color: 0x8bb5ca }), [0, -.01, .025]);
  }

  update(t: number, shot: ShotInfo) {
    const ending = shot.sceneId === 'S09', memory = ending && t >= 52;
    const clock = memory ? 3 * (1 - ease(t, 52, 54.8)) : ending ? 3 + (t - 48) * .6 : t;
    this.city.update(t, { wetness: .7, lights: 1 });
    this.crowd.dissolveEnabled = true; this.crowd.vanishStart_s = vanishAt; this.crowd.survivorStop_s = 999;
    this.crowd.update(clock, clock);
    for (let i = 0; i < this.crowd.agents.length; i++) {
      const a = this.crowd.agents[i];
      if (a.flagged) {
        a.dissolveFx!.update(clock, vanishAt, a.root.position, true);
        a.root.visible = clock < 1.03; // Also removes their unmodified shadow pass.
      } else if (shot.sceneId === 'S03') {
        // Keep witnesses on the far sidewalk, clear of both curb impacts.
        a.root.position.set(-7.9 - (i % 3) * .4, .14, -2.7 - (i % 6) * 1.5 + .14 * Math.sin(t + i));
        a.root.rotation.y = 1.2;
        movingPose(a.figure, t, i, { armR: [-1.05, .24, .8], headYaw: .35, lean: -.04 });
      } else if (clock > 1.03) {
        // Some keep walking; others turn and reach toward the now-empty crossing.
        if (i % 3 === 0) {
          a.root.rotation.y += .35 * Math.sin(clock * .7 + i);
          movingPose(a.figure, clock, i, { armL: [-.65, .2, .65], headYaw: Math.sin(clock + i) * .4 });
        }
      }
    }
    this.friend.root.visible = (!ending || memory) && clock < 1.03 && shot.sceneId !== 'S03';
    this.friend.root.position.set(.15 + .04 * Math.sin(clock * 2), 0, .3);
    movingPose(this.friend, clock, 1, { legL: [.08 * Math.sin(clock * 3), .04], legR: [-.08 * Math.sin(clock * 3), .04],
      armL: [-.65, .16, 1.02], armR: [-.42, .12, 1.13], headYaw: -.15 + Math.sin(clock * 1.6) * .14 });
    this.friendVanish.update(clock, vanishAt, this.friend.root.position, !ending || memory);
    this.survivor.root.visible = ending && !memory;
    this.survivor.root.position.set(.55 + Math.sin((t - 47.5) * .6) * .07, 0, .15 - .06 * clamp((t - 47.5) / 4.5));
    movingPose(this.survivor, t, 3, { legL: [.025 * Math.sin(t), .04], legR: [-.025 * Math.sin(t), .04],
      armR: [-.92, .14, 1.23], armL: [-.22, .1, .7], headPitch: .15 + Math.sin(t * .8) * .035, headYaw: -.2 });
    const showDrop = shot.sceneId === 'S01' || memory;
    this.cup.visible = this.phone.visible = this.lid.visible = showDrop;
    const age = Math.max(0, clock - vanishAt), cupAge = Math.min(age, .7), phoneAge = Math.min(age, .82), lidAge = Math.min(age, .94);
    const bounce = Math.max(0, clock - 1.35);
    this.cup.position.set(.42 + Math.min(age, .7) * .13, Math.max(.056, 1.16 * (1 - (cupAge / .7) ** 2)) + .045 * Math.abs(Math.sin(bounce * 18)) * Math.exp(-bounce * 7), .62 + Math.min(age, .7) * .07);
    const cupSettle = ease(clock, 1.35, 1.58), phoneSettle = ease(clock, 1.47, 1.65), lidSettle = ease(clock, 1.59, 1.82);
    this.cup.rotation.set(0, cupAge * 1.1, Math.min(age * 2.1, 1.47) + (Math.PI / 2 - 1.47) * cupSettle);
    this.phone.position.set(-.15 - Math.min(age, .82) * .09, Math.max(.028, 1.17 * (1 - (phoneAge / .82) ** 2)), .67 + Math.min(age, .82) * .12);
    this.phone.rotation.set(-Math.PI / 2 * clamp(age / .82), .25 + phoneAge * .4, phoneAge * 1.8 * (1 - phoneSettle) + .08 * phoneSettle);
    this.lid.position.set(.42 + Math.min(age, .94) * .43, Math.max(.022, 1.35 * (1 - (lidAge / .94) ** 2)), .64 - Math.min(age, .94) * .13);
    this.lid.rotation.set(lidAge * 3.3 * (1 - lidSettle) + Math.PI * lidSettle, 0, lidAge * 4.7 * (1 - lidSettle));
    this.spill.visible = showDrop && clock >= 1.35;
    const spread = ease(clock, 1.35, 1.8); this.spill.scale.set(.3 + spread * .9, .3 + spread * .5, 1);
    this.droplets.forEach((m, i) => {
      const dt = clock - 1.35, a = i * 2.399, v = .25 + (i % 5) * .12;
      m.visible = showDrop && dt > 0 && dt < .45;
      m.position.set(.44 + Math.cos(a) * dt * v, .03 + Math.max(0, dt * (.7 + (i % 3) * .15) - 4.9 * dt * dt), .63 + Math.sin(a) * dt * v);
    });
    this.cars.forEach((car, i) => {
      const hit = 12 + i * .12, u = ease(t, 10.5 + i * .12, hit), dt = Math.max(0, t - hit);
      car.visible = shot.sceneId === 'S03';
      // Rotated body half-extent is1.675m at contact; center5.27 meets the curb's inner face6.945.
      car.position.set(3.05 + 2.22 * u + .12 * Math.sin(dt * 22) * Math.exp(-dt * 5),
        Math.abs(Math.sin(dt * 16)) * .1 * Math.exp(-dt * 4), -24 - i * 7 + 16.2 * u);
      car.rotation.set(.025 * Math.sin(dt * 18) * Math.exp(-dt * 4), Math.PI + .4 * u,
        -.055 * Math.sin(dt * 16) * Math.exp(-dt * 4));
    });
    this.debris.visible = shot.sceneId === 'S03' && t >= 12;
    this.shards.forEach(({ mesh, x, z, speed, hit }, i) => {
      const age = Math.max(0, Math.min(t - hit, .9)); mesh.visible = t >= hit;
      mesh.position.set(6.8 + x * age, Math.max(.024, speed * age - 4.9 * age * age), -7.8 - (i % 2) * 7 + z * age);
      mesh.rotation.set(age * speed * 4, age * speed, age * 5);
    });
    if (memory) applyCameraSpec(this.camera, { ...shot.camera, handheld_sway: 0 }, t, 9 / 16);
    this.sky.follow(this.camera);
  }
}
