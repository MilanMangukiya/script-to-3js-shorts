import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { CloudDeck } from '../../../library/environment/CloudDeck';
import { Terrain } from '../../../library/environment/Terrain';
import { Humanoid, POSE_STAND, lerpPose } from '../../../library/characters/Humanoid';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { Snowfall } from '../../../library/fx/Snowfall';
import { fbm2, ridged2, smoothstep, clamp, lerp } from '../../../library/util/math';
import { T } from '../timeline';

/** Summit at local (0, 0, 0) = 8,849 m; the cloud sea lies 2.1 km below. */
export const CLOUD_Y = -2100;
const SUN = new THREE.Vector3(0.9, 0.11, 0.42).normalize();

/** Height of the illustrative summit pyramid: smooth maximum of three face planes (sharp ridges, rounded top), rock buttresses. */
const FACES: [number, number, number][] = [[Math.cos(0.4), Math.sin(0.4), 1.05], [Math.cos(2.6), Math.sin(2.6), 0.9], [Math.cos(4.7), Math.sin(4.7), 1.25]];
function summitHeight(x: number, z: number): number {
  const r = Math.hypot(x, z), soft = 0.9 + r * 0.015;
  let sum = 0;
  for (const [nx, nz, sl] of FACES) sum += Math.exp((sl * (nx * x + nz * z)) / soft);
  let h = -soft * Math.log(sum) + 0.9 * Math.log(3);
  h += (ridged2(x / 120 + 3.1, z / 120 + 1.7, 7, 5) - 0.45) * 34 * smoothstep(15, 400, r);
  h += (fbm2(x / 14, z / 14, 11, 4) - 0.5) * 1.6 * smoothstep(4, 40, r) + (fbm2(x / 2.5, z / 2.5, 13, 3) - 0.5) * 0.15;
  return h;
}

/** Radial grid: fine near the summit (about 0.3 m), coarse far away (about 60 m at 3 km). */
function summitGeometry(): THREE.BufferGeometry {
  const rings = 230, seg = 384, rMin = 0.3, rMax = 3600;
  const pos = new Float32Array((rings * seg + 1) * 3), col = new Float32Array((rings * seg + 1) * 3), idx: number[] = [];
  pos.set([0, summitHeight(0, 0), 0], 0);
  for (let i = 0; i < rings; i++) {
    const rr = rMin * Math.pow(rMax / rMin, i / (rings - 1));
    for (let j = 0; j < seg; j++) { const a = (j / seg) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr; pos.set([x, summitHeight(x, z), z], (1 + i * seg + j) * 3); }
  }
  for (let j = 0; j < seg; j++) idx.push(0, 1 + ((j + 1) % seg), 1 + j);
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < seg; j++) {
    const a = 1 + i * seg + j, b = 1 + i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // Snow on gentle slopes, dark rock on steep faces and in noisy bands, a pale "yellow band" of rock lower down.
  const n = g.attributes.normal as THREE.BufferAttribute, snow = new THREE.Color(0xeef3fa), shade = new THREE.Color(0xc9d6ea), rock = new THREE.Color(0x3d3a38), rock2 = new THREE.Color(0x5a524a), band = new THREE.Color(0x9c8a6a), c = new THREE.Color();
  for (let k = 0; k < pos.length / 3; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], steep = 1 - n.getY(k);
    const nz = fbm2(x / 30, z / 30, 21, 3);
    c.copy(snow).lerp(shade, clamp(steep * 1.4));
    const rocky = smoothstep(0.32, 0.5, steep + (nz - 0.5) * 0.35) * smoothstep(2, 12, Math.hypot(x, z));
    c.lerp(nz > 0.55 ? rock2 : rock, rocky);
    c.lerp(band, smoothstep(-260, -300, y) * (1 - smoothstep(-420, -470, y)) * rocky * 0.8);
    col.set([c.r, c.g, c.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Himalayan summit at sunrise (metres): illustrative three-ridged snow pyramid, cloud sea below, distant peaks and a
 * climber who lifts away an oxygen mask and breathes. Used by S04.
 */
export class SummitStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 120000);
  private clouds: CloudDeck; private climber: Humanoid; private mask: THREE.Group; private breath: SmokeWisp; private spindrift: Snowfall;
  private faceW = new THREE.Vector3(); private handW = new THREE.Vector3(); private chestW = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene;
    const sky = new SkyDome({ zenithColor: 0x07215f, horizonColor: 0xa9c2de, groundColor: 0x8a96aa, hazeColor: 0xf3d9c0, hazeAmount: 0.22, sunDirection: SUN, sunColor: 0xffe0b4, sunIntensity: 24, sunGlow: 0.7, curve: 0.36 });
    s.add(sky.mesh);
    s.environment = sky.toEnvironment(renderer); s.environmentIntensity = 0.8;
    s.fog = new THREE.FogExp2(0xb9c8dc, 0.000016);
    const summit = new THREE.Mesh(summitGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }));
    summit.receiveShadow = true; s.add(summit);
    this.clouds = new CloudDeck({ level: CLOUD_Y, size: 240000, scale: 2600, coverage: 0.86, sunDirection: SUN, sunColor: 0xffe8d2, shadowColor: 0x7d8bb2, belowColor: 0x4a5a78, hazeColor: 0xc8d4e6, hazeDensity: 0.000016 });
    s.add(this.clouds.mesh);
    // Distant peaks rising through the clouds (snow from just above their bases).
    const peaks: [number, number, number, number, number, number][] = [
      [3200, -7600, 2150, 5200, 31, 1.0], [-2600, -12500, 1900, 6400, 17, 1.0], [9800, -15500, 2300, 7000, 44, 1.0], [-11000, -6000, 1700, 6000, 9, 1.0], [16000, -30000, 2000, 9000, 27, 1.0], [-20000, -24000, 1800, 8000, 52, 1.0], [-14000, 9000, 1600, 6000, 61, 1.0],
    ];
    for (const [x, z, h, w, seed] of peaks) {
      const t = new Terrain({ seed, width: w, depth: w * 0.85, segmentsX: 220, segmentsZ: 190, peakHeight: h, snowLine: 250, treeLine: -900 });
      t.mesh.position.set(x, CLOUD_Y - 250, z); s.add(t.mesh);
    }

    const sun = new THREE.DirectionalLight(0xffd8a6, 3.4);
    sun.position.copy(SUN).multiplyScalar(60); sun.target.position.set(0, 0, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 140 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    s.add(sun, sun.target, new THREE.HemisphereLight(0x86a6e0, 0xe6edf8, 0.75));

    // Climber in a red down suit with pack, goggles and an oxygen mask.
    this.climber = new Humanoid({ height: 1.75, coatColor: 0xb8342a, trouserColor: 0xa72e25, skinColor: 0xb7896a, scarfColor: 0x1b1b1f, coat: 'jacket', hat: true, shoeColor: 0x0f0f12 });
    const y0 = summitHeight(0, 0);
    this.climber.root.position.set(0, y0 - 0.04, 0); this.climber.root.rotation.y = Math.atan2(SUN.x, SUN.z);
    s.add(this.climber.root);
    const dark = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.6 });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.18), new THREE.MeshStandardMaterial({ color: 0x2d3440, roughness: 0.85 }));
    pack.position.set(0, -0.06, -0.04); pack.castShadow = true; this.climber.backAnchor.add(pack);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 16), new THREE.MeshStandardMaterial({ color: 0xd7a21f, roughness: 0.4, metalness: 0.5 }));
    bottle.position.set(0.11, 0.05, -0.1); this.climber.backAnchor.add(bottle);
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.045, 0.04), new THREE.MeshPhysicalMaterial({ color: 0xff8a2a, roughness: 0.05, metalness: 0.6, clearcoat: 1 }));
    goggles.position.set(0, 0.075, 0.09); this.climber.headAnchor.add(goggles);
    this.mask = new THREE.Group();
    const m1 = new THREE.Mesh(new THREE.SphereGeometry(0.058, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1.0, 0.9, 0.85), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.55, side: THREE.DoubleSide })); m1.castShadow = true;
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd06a1f, roughness: 0.5 })); valve.position.z = 0.05;
    this.mask.add(m1, valve); s.add(this.mask);
    this.breath = new SmokeWisp({ height: 0.55, baseWidth: 0.05, topWidth: 0.32, curl: 0.12, riseSpeed: 0.5, color: 0xf2f6fb, seed: 4, opacity: 0.5 });
    s.add(this.breath.mesh);
    this.spindrift = new Snowfall({ count: 900, seed: 6, box: [16, 5, 16], fallSpeed: 0.25, drift: 2.2, size: 26, minPx: 1, maxPx: 5, brightness: 0.8, glint: 0.4, far: 20 });
    this.spindrift.points.position.set(0, 0.5, 0); s.add(this.spindrift.points);
  }

  update(t: number, _shot: ShotInfo) {
    this.clouds.update(t, t * 3.0, t * 1.2);
    this.spindrift.update(t);
    const fig = this.climber;
    const lift = smoothstep(T.maskOff - 0.1, T.maskOff + 0.35, t), pull = smoothstep(T.maskOff + 0.3, T.maskOffEnd, t);
    const breathIn = smoothstep(T.breathIn, T.breathIn + 1.4, t) * (1 - smoothstep(T.exhaleVapor - 0.3, T.exhaleVapor + 0.6, t));
    const pose = lerpPose(POSE_STAND, { headPitch: -0.12, lean: 0.04, armL: [0.1, 0.12, 0.25] }, 1);
    pose.headPitch = lerp(-0.12, -0.28, breathIn); pose.shrug = 0.25 * breathIn; pose.breath = 0.3 + 0.7 * breathIn + 0.1 * Math.sin(t * 1.6);
    fig.setPose(pose);
    // Mask: on the face, then the right hand lifts it away and holds it at chest height.
    fig.headAnchor.localToWorld(this.faceW.set(0, -0.035, 0.115));
    fig.chestAnchor.localToWorld(this.chestW.set(-0.12, -0.05, 0.25));
    const target = this.faceW.clone().lerp(this.chestW, pull);
    if (lift > 0.001) fig.reachArm('R', target, new THREE.Vector3(-0.3, -1, 0.2).applyQuaternion(fig.root.quaternion), clamp(lift));
    fig.handR.getWorldPosition(this.handW);
    this.mask.position.copy(lift > 0.5 ? this.handW.clone().lerp(target, 0.35) : this.faceW);
    this.mask.quaternion.copy(fig.root.quaternion);
    // One frosty exhale after the deep breath (match-cuts to the kitchen steam).
    this.breath.mesh.position.copy(this.faceW).add(new THREE.Vector3(0, -0.02, 0).add(new THREE.Vector3(0.05, 0, 0.06).applyQuaternion(fig.root.quaternion)));
    this.breath.update(t, t - T.exhaleVapor, 0.42 * (1 - smoothstep(T.exhaleVapor + 0.9, T.S04_end, t)), this.camera);
  }
}
