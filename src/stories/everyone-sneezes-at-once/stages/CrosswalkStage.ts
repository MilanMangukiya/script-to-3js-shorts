import * as THREE from 'three';
import { CityStreetClassic } from '../../../library/environment/CityStreetClassic';
import { SunSkylightRig } from '../../../library/environment/SunSkylightRig';
import { AshPuffs } from '../../../library/fx/AshCloud';
import { Dog } from '../../../library/characters/Dog';
import { POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { applyGroundedPose } from '../../../library/characters/CharacterMotion';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T, windowAt, pulse, sneezeClock, SPEED_CAR } from '../timeline';
import { Person, carRig, setCarLights, SIDEWALK_Y, type CarRig } from './common';

// A city crosswalk, 1 unit = 1 m. Road along Z (x -7..7), zebra crossing at z -1.5..1.5, sidewalks beyond |x| = 7.
// You wait on the -X curb; neighbours wait beside you and across the road; a dog sits by its owner. Cars pass at
// 50 km/h. The morning sun stands over the far side of the road, so your side of the street is in sunlight.
const SUN = new THREE.Vector3(0.35, 0.82, 0.45).normalize();
const CURB = SIDEWALK_Y;

interface Walker { p: Person; at: [number, number]; heading: number; elbow: boolean; ph: number; mouth: THREE.Vector3; fwd: THREE.Vector3 }
interface Spray { pts: THREE.Points; mat: THREE.ShaderMaterial; who: Walker }

/** Sneeze body language: wind-up (head back, chest up), the sneeze (snap forward), then recovery; 0 before, 1 after. */
export function sneezePose(k: number, elbow: boolean, idle: HumanoidPose): HumanoidPose {
  const wind = windowAt(k, -0.8, -0.05) * (1 - windowAt(k, -0.05, 0.02));
  const snap = pulse(k, -0.03, 0.55), settle = windowAt(k, 0.5, 1.3);
  let p = lerpPose(idle, { ...idle, headPitch: -0.4, lean: -0.12, shrug: 0.5, breath: 1 }, wind);
  p = lerpPose(p, { ...p, headPitch: 0.6, lean: 0.38, shrug: 0.7, legL: [0.18, 0.32], legR: [0.12, 0.3], breath: -0.6 }, snap);
  if (elbow) p = lerpPose(p, { ...p, armR: [-1.45, -0.25, 2.25] }, windowAt(k, -0.6, -0.15) * (1 - windowAt(k, 0.6, 1.2)));
  return lerpPose(p, { ...p, headPitch: 0.1, lean: 0.04 }, settle * (1 - windowAt(k, 2.5, 3.5)));
}

export class CrosswalkStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.03, 9000);
  private city = new CityStreetClassic({ seed: 1717, blocks: 7, storeysMin: 5, storeysMax: 9, wetness: 0, farFieldRadius: 2400, vehicles: false });
  private rig: SunSkylightRig;
  private people: Walker[] = [];
  private owner: Walker;
  readonly dog = new Dog({ coat: 0xc8923e });
  private cars: { rig: CarRig; lane: number; dir: number; z0: number; t0: number }[] = [];
  private sprays: Spray[] = [];
  private cloud: AshPuffs;
  private blindStrip: THREE.Mesh; private blindMat: THREE.MeshBasicMaterial;
  private rings: THREE.InstancedMesh; private ringSrc: THREE.Vector2[] = [];
  private youMarker: THREE.Mesh;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.rig = new SunSkylightRig(this.scene, renderer, { zenithColor: 0x3d7ad0, horizonColor: 0xaecbea, hazeColor: 0xd5e3f1, groundColor: 0x8d867c,
      hazeAmount: 0.28, sunGlow: 0.35, discRadiance: 14, glareStrength: 1.0, shadowMapSize: 4096, discDistance: 8000 });
    this.scene.add(this.city.group);
    // Pedestrian signals show "don't walk" (red) while the cars have green.
    this.city.group.traverse((o) => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial && o.material.color.getHex() === 0x7affb6) o.material.color.set(0xff3b2f); });
    // People waiting on both curbs. Near side faces +X (the road); far side faces -X (toward you).
    const looks: [number, number, number, number, number, boolean][] = [
      [-7.75, 0.75, 0x2e4053, 0xe0ac69, 1.78, false],   // dog owner
      [-7.45, -0.7, 0xb03a2e, 0x8d5524, 1.7, true],
      [-8.45, 0.05, 0x1e8449, 0xf1c27d, 1.66, false],
      [-8.1, -1.75, 0x7d3c98, 0xc68642, 1.81, true],
      [7.7, -0.45, 0xd4ac0d, 0xffdbac, 1.72, true],
      [8.35, 0.85, 0x2874a6, 0x8d5524, 1.76, false],
      [7.65, 1.95, 0xca6f1e, 0xe0ac69, 1.62, false],
      [8.55, -1.7, 0x5d6d7e, 0xc68642, 1.84, true],
    ];
    const r = rng(31);
    looks.forEach(([x, z, coat, skin, h, elbow], i) => {
      const p = new Person(this.scene, { height: h, coat, trousers: [0x2c3e50, 0x1f2937, 0x3d3d3d, 0x34495e][i % 4], skin, hair: [0x2b1d14, 0x111111, 0x6b4a2e, 0x3b2a1e][i % 4] });
      const w: Walker = { p, at: [x, z], heading: x < 0 ? Math.PI / 2 + 0.15 * Math.sin(i * 2.1) : -Math.PI / 2 + 0.15 * Math.sin(i * 1.7), elbow, ph: r() * 6.28, mouth: new THREE.Vector3(), fwd: new THREE.Vector3(1, 0, 0) };
      this.people.push(w);
    });
    this.owner = this.people[0];
    this.dog.root.position.set(-7.3, CURB, 1.3); this.dog.root.rotation.y = Math.PI / 2 - 0.25; this.scene.add(this.dog.root);
    // Traffic: near lane comes toward you (+Z), far lane goes away (-Z), at 50 km/h.
    // The near-lane red car reaches the crossing exactly as everyone sneezes.
    const tc = T.sneeze - 68 / SPEED_CAR;
    for (const [lane, dir, z0, t0, color] of [[-3.4, 1, -70, tc, 0x9a2b24], [3.4, -1, 60, tc + 1.4, 0x2b5d9a], [-3.4, 1, -70, tc + T.whiteCar, 0xd0d3d6], [3.4, -1, 60, tc + 6.0, 0x3f3f3f],
      [-3.4, 1, -70, tc + T.bounds[3] + 1.6 - T.sneeze, 0x2e7d4f], [3.4, -1, 60, tc + T.bounds[3] + 3.4 - T.sneeze, 0xc9a227]] as const) {
      this.cars.push({ rig: carRig(this.scene, color), lane, dir, z0, t0 });
    }
    // Sneeze spray: a cone of droplets from each mouth (shader-driven from the sneeze clock) plus a soft breath cloud.
    for (const w of this.people) this.sprays.push(this.makeSpray(w, w === this.people[2] ? 2600 : 260));
    this.cloud = new AshPuffs(160, { ashColor: 0xf2f4f6, ambient: 0xffffff, sunColor: 0xffffff, hazeColor: 0xd5e3f1, hazeDensity: 0.0006 });
    this.cloud.setLook({ sun: SUN, light: 0.6 }); this.cloud.mesh.renderOrder = 18; this.scene.add(this.cloud.mesh);
    // The stretch of road a car covers with its driver's eyes shut (S03).
    this.blindMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.15), transparent: true, opacity: 0, depthWrite: false });
    this.blindStrip = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1).rotateX(-Math.PI / 2), this.blindMat); this.blindStrip.renderOrder = 4; this.scene.add(this.blindStrip);
    // Sound from every sneeze in the city spreads at 343 m/s (S05): one ring per source, drawn just above the roofs.
    const N = 170, rr = rng(9);
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.992, 1, 128).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.85, 1.1), transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }), N);
    for (let i = 0; i < N; i++) { const a = rr() * Math.PI * 2, d = 60 + Math.sqrt(rr()) * 2300; this.ringSrc.push(new THREE.Vector2(Math.cos(a) * d, Math.sin(a) * d)); }
    this.rings.frustumCulled = false; this.rings.renderOrder = 6; this.scene.add(this.rings);
    this.youMarker = new THREE.Mesh(new THREE.RingGeometry(14, 22, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 0.4), transparent: true, opacity: 0.9, depthWrite: false }));
    this.youMarker.position.set(-7.6, 45, 2.2); this.youMarker.renderOrder = 7; this.scene.add(this.youMarker);
  }

  private makeSpray(w: Walker, n: number): Spray {
    const r = rng(Math.round((w.at[0] + 20) * 100 + w.at[1] * 7)), dir = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, c = Math.pow(r(), 0.6) * 0.42; dir.set([Math.cos(a) * c, Math.sin(a) * c + 0.05, 1, 2.5 + r() * 9], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aDir', new THREE.BufferAttribute(dir, 4));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uK: { value: -1 }, uO: { value: new THREE.Vector3() }, uF: { value: new THREE.Vector3(1, 0, 0) }, uU: { value: new THREE.Vector3(0, 1, 0) }, uPx: { value: 1 }, uSun: { value: SUN } },
      vertexShader: /* glsl */ `attribute vec4 aDir; uniform float uK, uPx; uniform vec3 uO, uF, uU; varying float vA;
        void main(){
          float k = max(uK, 0.0);
          vec3 side = normalize(cross(uF, uU));
          vec3 d = normalize(uF + side * aDir.x + uU * aDir.y);
          // Droplets leave fast and slow quickly in air (drag), then sink.
          float s = aDir.w * 0.22 * (1.0 - exp(-k / 0.22));
          vec3 p = uO + d * s + vec3(0.0, -4.9 * k * k * 0.12, 0.0);
          vA = step(0.0, uK) * smoothstep(0.0, 0.02, k) * (1.0 - smoothstep(0.5, 1.6, k)) * (0.5 + 0.5 * fract(aDir.w * 7.3));
          vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uPx * (1.4 + 2.2 * fract(aDir.w * 3.1)) * 2.4 / -mv.z * 3.0, 1.0, 9.0 * uPx + 1.5); }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * a * 1.4, a); }` });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 19; this.scene.add(pts);
    return { pts, mat, who: w };
  }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId, aerial = sc === 'S05';
    const k = sneezeClock(t, sc);                                    // seconds since the sneeze, as this scene tells it
    const cam = this.camera.getWorldPosition(new THREE.Vector3());
    this.rig.apply(this.scene, this.camera, { sunDirection: SUN, sunIntensity: 7.5, sunColor: 0xfff1dc, skyAmount: 1, groundAmount: 1, envIntensity: 1, hazeDensity: aerial ? 0.00022 : 0.0006,
      focus: aerial ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(-4, 1, 0), shadowHalfWidth: aerial ? 400 : 26, shadowHalfHeight: aerial ? 400 : 26, shadowDepth: aerial ? 1600 : 200 });
    this.city.update(t, { lights: 0, wetness: 0 });
    // ---- people: idle, then everyone sneezes on the same frame
    const px = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / 1920;
    const tEmit = t - (sc === 'S06' ? k * T.slowmo : k);              // film time of this scene's sneeze
    const idleAt = (w: Walker, tt: number): HumanoidPose => ({ ...POSE_STAND, breath: 0.25 * Math.sin(tt * 1.5 + w.ph), headYaw: 0.15 * Math.sin(tt * 0.4 + w.ph) });
    const q = new THREE.Quaternion();
    for (const w of this.people) {
      // Droplets keep the start point and heading they had when the sneeze left the mouth, so replay that pose first.
      w.p.h.root.position.set(w.at[0], 0, w.at[1]); w.p.h.root.rotation.set(0, w.heading, 0);
      applyGroundedPose(w.p.h, sneezePose(0, w.elbow, idleAt(w, tEmit)), CURB); w.p.h.root.updateMatrixWorld(true);
      const f = new THREE.Vector3(0, 0, 1).applyQuaternion(w.p.h.head.getWorldQuaternion(q)); f.y = 0; f.normalize();
      w.mouth.copy(w.p.h.head.getWorldPosition(new THREE.Vector3())).addScaledVector(f, 0.11).add(new THREE.Vector3(0, -0.05, 0));
      w.fwd.copy(f).multiplyScalar(Math.cos(0.2)).add(new THREE.Vector3(0, -Math.sin(0.2), 0));
      let pose = sneezePose(k, w.elbow, idleAt(w, t));
      if (w === this.owner && sc === 'S08') pose = lerpPose(pose, { ...pose, headPitch: 0.35, headYaw: -0.45 }, windowAt(t, T.bounds[7] + 0.6, T.bounds[7] + 1.4));
      // The slow-motion profile leaves out the neighbour in the spray's path and the one standing right behind the subject.
      w.p.h.root.visible = !aerial && !(sc === 'S06' && (w === this.people[1] || w === this.people[3]));
      applyGroundedPose(w.p.h, pose, CURB);
      if (w === this.owner && sc === 'S08') { w.p.h.root.updateMatrixWorld(true); w.p.h.reachArm('R', new THREE.Vector3(0.0, 1.5, 0.14).applyMatrix4(w.p.h.root.matrixWorld), new THREE.Vector3(0, -1, 0), windowAt(t, T.bounds[7] + 0.2, T.bounds[7] + 0.8)); }
    }
    // ---- spray from each mouth, aligned with the head
    const puffs: { x: number; y: number; z: number; size: number; alpha: number; glow: number; seed: number }[] = [];
    const mist = sc === 'S06' ? 0.4 : 1;                               // the breath cloud stays faint in slow motion
    for (const s of this.sprays) {
      const { mouth, fwd } = s.who, kk = k;
      s.mat.uniforms.uK.value = aerial || s.who.elbow ? -1 : kk; s.mat.uniforms.uO.value.copy(mouth); s.mat.uniforms.uF.value.copy(fwd);
      s.mat.uniforms.uPx.value = px;
      s.pts.visible = !aerial && !s.who.elbow;
      if (!aerial && kk > 0 && kk < 2.5) for (let i = 0; i < 6; i++) {
        const a = kk - i * 0.03; if (a <= 0) continue;
        const reach = (s.who.elbow ? 0.25 : 0.9) * (1 - Math.exp(-a / 0.3));
        puffs.push({ x: mouth.x + fwd.x * reach + 0.05 * Math.sin(i * 2.1), y: mouth.y + fwd.y * reach - 0.02 * i + a * 0.05, z: mouth.z + fwd.z * reach + 0.05 * Math.cos(i * 1.3),
          size: (0.12 + a * 0.55 + i * 0.03) * (sc === 'S06' ? 0.75 : 1), alpha: mist * (s.who.elbow ? 0.08 : 0.16) * Math.min(1, a * 10) * Math.max(0, 1 - a / 2.5), glow: 0, seed: (i * 0.17 + s.who.ph) % 1 });
      }
    }
    this.cloud.set(puffs, this.camera);
    // ---- traffic rolls on straight through the blink (S03 replays the same moment from the curb)
    const tt = sc === 'S03' ? t - (T.s03Sneeze - T.sneeze) : t;
    // ---- the dog: the one pair of eyes left open. It follows the passing cars (a weighted glance at the nearest, a
    // beat behind), looks up at the sneezing people in S01, and turns to you for the punchline in S08.
    const dp = this.dog.root.position, dRot = this.dog.root.rotation.y;
    let wSum = 0.03, ySum = 0;
    for (const c of this.cars) {
      const dx = c.lane - (dp.x + 0.24), dz = c.z0 + c.dir * SPEED_CAR * (tt - 0.12 - c.t0) - (dp.z + 0.06), d = Math.hypot(dx, dz);
      const yaw = Math.atan2(Math.sin(Math.atan2(dx, dz) - dRot), Math.cos(Math.atan2(dx, dz) - dRot)), wt = Math.exp(-d / 12);
      wSum += wt; ySum += wt * Math.max(-1.1, Math.min(1.1, yaw));
    }
    let yaw = ySum / wSum, pitch = -0.05, tilt = 0, ears = 0.55;
    if (sc === 'S01') { const up = windowAt(k, 0.35, 0.85); yaw += (0.95 - yaw) * up; pitch += -0.45 * up; tilt = 0.25 * windowAt(k, 0.9, 1.4); ears = 0.55 - 0.25 * up; }
    const bark = sc === 'S08' ? pulse(t, T.bark, 0.32) : 0;
    if (sc === 'S08') {
      const toCam = Math.atan2(cam.x - dp.x, cam.z - dp.z) - dRot;
      yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(toCam), Math.cos(toCam)))); pitch = -0.12;
      tilt = 0.32 * windowAt(t, T.headTilt, T.headTilt + 0.45) * (1 - windowAt(t, T.bark - 0.25, T.bark)); ears = 0.3 + 0.7 * windowAt(t, T.headTilt, T.headTilt + 0.4);
    }
    this.dog.root.visible = !aerial;
    this.dog.setPose({ sit: 1, headYaw: yaw, headPitch: pitch - 0.25 * bark, headTilt: tilt, mouth: Math.max(0.12 + 0.08 * Math.sin(t * 9), bark), tailWag: 0.5 * Math.sin(t * (sc === 'S08' ? 10 : 6)), tailLift: 0.6, ears: Math.max(ears, bark) });
    for (const c of this.cars) {
      const z = c.z0 + c.dir * SPEED_CAR * (tt - c.t0);
      c.rig.g.visible = !aerial && Math.abs(z) < 80; c.rig.g.position.set(c.lane, 0, z); c.rig.g.rotation.set(0, c.dir > 0 ? Math.PI : 0, 0);
      setCarLights(c.rig, 0, 'run');
    }
    // ---- S03: the blind stretch painted on the road under the near-lane car
    const s3 = sc === 'S03';
    const zClose = this.cars[0].z0 + SPEED_CAR * (T.sneeze - this.cars[0].t0), blind = SPEED_CAR * T.eyesShut;
    const grow = s3 ? Math.max(0, Math.min(1, (t - T.s03Sneeze) / T.eyesShut)) : 0;
    this.blindStrip.visible = s3 && grow > 0;
    this.blindStrip.scale.set(1, 1, Math.max(0.01, blind * grow)); this.blindStrip.position.set(-3.4, 0.03, zClose + blind * grow / 2);
    this.blindMat.opacity = 0.55 * (1 - windowAt(t, T.bounds[3] - 0.6, T.bounds[3]));
    // ---- S05: expanding sound rings from every sneeze in the city
    this.rings.visible = aerial; this.youMarker.visible = aerial;
    if (aerial) {
      const R = 343 * Math.max(0, k), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc3 = new THREE.Vector3();
      this.ringSrc.forEach((p, i) => { const rr = Math.max(0.01, R); m.compose(new THREE.Vector3(p.x, 38, p.y), q, sc3.set(rr, 1, rr)); this.rings.setMatrixAt(i, m); });
      this.rings.instanceMatrix.needsUpdate = true;
      (this.rings.material as THREE.MeshBasicMaterial).opacity = 0.32 * Math.max(0.2, 1 - R / 3000);
      this.youMarker.scale.setScalar(1 + 0.15 * Math.sin(t * 5));
    }
  }

  /** World position of your crosswalk marker (for the overlay callout in S05). */
  youWorld() { return this.youMarker.position.clone(); }
  /** World position of the near-lane car (for the S03 callout). */
  blindLabelWorld() { const zClose = this.cars[0].z0 + SPEED_CAR * (T.sneeze - this.cars[0].t0); return new THREE.Vector3(-3.4, 0.1, zClose + SPEED_CAR * T.eyesShut / 2); }
}
