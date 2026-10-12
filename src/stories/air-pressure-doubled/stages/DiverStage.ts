import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { Underwater } from '../../../library/environment/Underwater';
import { FishSchool } from '../../../library/creatures/FishSchool';
import { Humanoid, POSE_STAND, type HumanoidPose } from '../../../library/characters/Humanoid';
import { ScubaGear } from '../../../library/characters/ScubaGear';
import { BubbleStream } from '../../../library/fx/BubbleStream';
import { smoothstep, clamp } from '../../../library/util/math';
import { T } from '../timeline';

export const DIVER_DEPTH = 10;
export const LINE_X = 1.4, LINE_Z = -3.6;

/** Open coastal water (metres, surface y = 0, floor y = -14): a diver hovering at the 10 m tag of a descent line. */
export class DiverStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.05, 400);
  private water: Underwater; private school: FishSchool;
  private diver: Humanoid; private gear: ScubaGear; private bubbles: BubbleStream;
  private noseWorld = new THREE.Vector3();

  constructor() {
    const s = this.scene, sun = new THREE.Vector3(-0.3, 1, -0.2).normalize();
    this.water = new Underwater({ depth: 14, extent: 60, waterColor: 0x1a8096, deepColor: 0x053049, surfaceColor: 0xa8f0f0, sunDirection: sun, rayStrength: 0.62, rayCount: 18, causticStrength: 1.2, fogDensity: 0.052, grassCount: 900, particleCount: 1800, seed: 21 });
    s.add(this.water.group);
    s.fog = new THREE.FogExp2(this.water.fogColor.getHex(), this.water.fogDensity);
    const key = new THREE.DirectionalLight(0xbff0ff, 2.3); key.position.copy(sun).multiplyScalar(20); s.add(key);
    s.add(new THREE.HemisphereLight(0x7fd6e2, 0x0a3242, 1.0));
    this.school = new FishSchool({ count: 90, seed: 14, length: 0.24, spread: [3.2, 0.9, 1.6], speed: 0.6, fogColor: this.water.fogColor, fogDensity: this.water.fogDensity, lightDirection: sun });
    s.add(this.school.mesh);

    // Descent line from a surface buoy to a weight on the floor, with depth tags.
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 14, 8).translate(0, -7, 0), new THREE.MeshStandardMaterial({ color: 0xd9c37a, roughness: 0.8 }));
    rope.position.set(LINE_X, 0, LINE_Z); s.add(rope);
    for (const d of [5, 10]) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!;
      g.fillStyle = '#f2c230'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#1b1a17'; g.font = '700 84px Inter, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${d} m`, 128, 68);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.17, 0.014), [0, 0, 0, 0, 1, 1].map((k) => new THREE.MeshStandardMaterial(k ? { map: tex, roughness: 0.6 } : { color: 0xf2c230, roughness: 0.6 })));
      tag.position.set(LINE_X + 0.18, -d, LINE_Z); tag.rotation.y = 0.35; s.add(tag);
    }
    const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.9 }));
    weight.position.set(LINE_X, -13.9, LINE_Z); s.add(weight);

    // Diver: horizontal, head toward +X, face down, kicking slowly.
    this.diver = new Humanoid({ height: 1.72, coatColor: 0x121417, trouserColor: 0x121417, skinColor: 0xb58a6c, scarfColor: 0x15171a, coat: 'jacket', hat: true });
    this.gear = new ScubaGear(this.diver, { jacketColor: 0x1f6f78, tankColor: 0xbac3ca, finColor: 0x16181c, hoseColor: 0xf2c230 });
    this.diver.root.position.set(-0.66, -DIVER_DEPTH, -3.0);
    this.diver.root.rotation.set(Math.PI / 2 - 0.12, Math.PI / 2, 0, 'YXZ');
    s.add(this.diver.root);
    this.bubbles = new BubbleStream({ period: T.exhale2 - T.exhale1, perBurst: 34, bursts: 3, riseSpeed: 0.5, size: 0.0065, surfaceY: 0, surfacePressure: 2, seed: 5 });
    s.add(this.bubbles.points);
  }

  update(t: number, _shot: ShotInfo) {
    this.water.update(t, this.camera);
    const fig = this.diver;
    // Slow flutter kick, gentle body undulation; head lifted to look ahead.
    const k = Math.sin(t * 2 * Math.PI * 0.55);
    const pose: HumanoidPose = { ...POSE_STAND, hipsY: 0.92, lean: 0.05 + 0.02 * Math.sin(t * 1.1), headPitch: -0.75, headYaw: 0.05 * Math.sin(t * 0.6),
      armL: [-0.1, 0.18, 0.9], armR: [-0.1, 0.18, 0.9], legL: [0.12 + 0.22 * k, 0.25 + 0.12 * k], legR: [0.12 - 0.22 * k, 0.25 - 0.12 * k], shrug: 0.1, breath: 0.5 + 0.5 * Math.sin(t * 1.2) };
    fig.root.position.y = -DIVER_DEPTH + 0.05 * Math.sin(t * 0.7);
    fig.setPose(pose);
    // Equalize: the right hand comes up to pinch the nose of the mask, then returns.
    const eq = smoothstep(T.equalize - 0.35, T.equalize + 0.25, t) * (1 - smoothstep(T.equalizeEnd - 0.3, T.equalizeEnd + 0.3, t));
    if (eq > 0.001) {
      fig.headAnchor.localToWorld(this.noseWorld.set(0.0, 0.0, 0.135));
      const pole = new THREE.Vector3(0.1, -0.45, 1).normalize();
      fig.reachArm('R', this.noseWorld, pole, clamp(eq));
    }
    this.bubbles.update(t, this.gear.regulatorWorld(), T.exhale1);
    // A loose school crosses far behind the diver.
    const u = t - T.S03_start;
    this.school.update(t, new THREE.Vector3(-7 + 0.75 * u, -8.6 + 0.3 * Math.sin(0.4 * t), -10.5), new THREE.Vector3(1, 0.04 * Math.cos(0.4 * t), 0.1).normalize());
  }
}
