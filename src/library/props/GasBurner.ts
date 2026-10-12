import * as THREE from 'three';
import { Flame } from '../fx/Flame';
import { rng } from '../util/math';

export interface GasBurnerOptions {
  /** Burner head radius in metres and number of flame jets around it. */
  radius?: number; jets?: number;
  /** Flame jet height in metres. */
  flameHeight?: number;
  /** Include the four-arm cast-iron pan support. */
  grate?: boolean;
  /** HDR brightness of each flame jet. */
  brightness?: number;
  seed?: number;
}

/**
 * Domestic gas hob burner: enamel cap, aluminium head with ports, cast-iron grate and a ring of small blue flames
 * (flame-v1 billboards with gas-flame colours). `update(time_s, intensity, camera)` is deterministic.
 * Origin at the hob surface; the grate top (where a pot sits) is at `grateTop`.
 */
export class GasBurner {
  readonly group = new THREE.Group();
  readonly grateTop: number;
  private flames: { flame: Flame; tilt: THREE.Group }[] = [];
  readonly light: THREE.PointLight;

  constructor(o: GasBurnerOptions = {}) {
    const R = o.radius ?? 0.042, n = o.jets ?? 18, fh = o.flameHeight ?? 0.016, r = rng(o.seed ?? 2);
    const alu = new THREE.MeshStandardMaterial({ color: 0x8c8f93, roughness: 0.55, metalness: 0.8 });
    const enamel = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.35, metalness: 0.3 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.7, metalness: 0.45 });
    const head = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.15, 0.012, 48).translate(0, 0.006, 0), alu); head.receiveShadow = true; this.group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R * 0.92, 0.006, 48).translate(0, 0.015, 0), enamel); this.group.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.6, 0.004, 8, 64).rotateX(Math.PI / 2), alu); ring.position.y = 0.0015; this.group.add(ring);
    this.grateTop = 0.034;
    if (o.grate !== false) {
      const arm = new THREE.BoxGeometry(0.11, 0.008, 0.008);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4, m = new THREE.Mesh(arm, iron);
        m.position.set(Math.cos(a) * (R * 1.3 + 0.055), this.grateTop - 0.004, Math.sin(a) * (R * 1.3 + 0.055)); m.rotation.y = -a; m.castShadow = true; this.group.add(m);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.008, this.grateTop, 0.008), iron); leg.position.set(Math.cos(a) * (R * 1.3 + 0.108), this.grateTop / 2, Math.sin(a) * (R * 1.3 + 0.108)); this.group.add(leg);
      }
      const outer = new THREE.Mesh(new THREE.TorusGeometry(R * 1.3 + 0.108, 0.005, 8, 64).rotateX(Math.PI / 2), iron); outer.position.y = this.grateTop - 0.004; this.group.add(outer);
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const f = new Flame({ width: fh * 0.6, height: fh * (0.9 + r() * 0.25), seed: 1 + r() * 40, turbulence: 0.12, speed: 2.2, brightness: o.brightness ?? 1.1, blueBase: 1,
        colorCore: 0xc9e6ff, colorMid: 0x5a8dff, colorTip: 0x3346d8, colorBase: 0x67a6ff });
      const holder = new THREE.Group(); holder.position.set(Math.cos(a) * R * 1.02, 0.009, Math.sin(a) * R * 1.02);
      holder.rotation.set(0, 0, 0); holder.lookAt(holder.position.clone().multiplyScalar(2).setY(0.009));   // face outward
      const tilt = new THREE.Group(); tilt.rotation.x = 0.85; holder.add(tilt); tilt.add(f.mesh);   // jets lean outward, as from side ports
      this.group.add(holder); this.flames.push({ flame: f, tilt });
    }
    this.light = new THREE.PointLight(0x5b8cff, 0.6, 0.6, 2); this.light.position.y = 0.02; this.group.add(this.light);
  }

  /** @param camera when given, each jet turns about its own axis to face it (jets are flat billboards). */
  update(time_s: number, intensity = 1, camera?: THREE.Camera) {
    if (camera) this.group.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    for (const { flame, tilt } of this.flames) {
      flame.update(time_s, intensity);
      if (camera) { tilt.worldToLocal(camera.getWorldPosition(p)); flame.mesh.rotation.y = Math.atan2(p.x, p.z); }
    }
    this.light.intensity = 0.6 * intensity * (0.92 + 0.08 * Math.sin(time_s * 23.0));
  }
}
