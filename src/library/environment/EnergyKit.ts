import * as THREE from 'three';

/**
 * energy-kit-v1 — utility-scale infrastructure in metres (base on y = 0): a three-blade wind turbine (tapered tower,
 * nacelle, spinner and twisted, tapering blades that turn at `rpm` from `update(t)`, with a red aviation light), a
 * lattice transmission pylon with insulator strings, and `PowerLine` catenary cables sagging between pylon arms.
 */
const white = () => new THREE.MeshStandardMaterial({ color: 0xeef0ee, roughness: 0.45, metalness: 0.15 });

export class WindTurbine {
  readonly group = new THREE.Group(); readonly rotor = new THREE.Group(); private beacon: THREE.MeshStandardMaterial;
  rpm: number; private phase: number;
  constructor(o: { height?: number; blade?: number; rpm?: number; phase?: number; yaw?: number } = {}) {
    const H = o.height ?? 90, B = o.blade ?? 55, m = white();
    this.rpm = o.rpm ?? 14; this.phase = o.phase ?? 0;
    const prof = [new THREE.Vector2(H * 0.025, 0), new THREE.Vector2(H * 0.024, H * 0.02), new THREE.Vector2(H * 0.015, H), new THREE.Vector2(0.001, H)];
    const tower = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), m); tower.castShadow = tower.receiveShadow = true; this.group.add(tower);
    const head = new THREE.Group(); head.position.y = H; head.rotation.y = o.yaw ?? 0; this.group.add(head);
    const nac = new THREE.Mesh(new THREE.CapsuleGeometry(H * 0.03, H * 0.1, 8, 20).rotateX(Math.PI / 2), m); nac.position.set(0, H * 0.02, -H * 0.03); nac.castShadow = true; head.add(nac);
    this.rotor.position.set(0, H * 0.02, H * 0.05); head.add(this.rotor);
    const spin = new THREE.Mesh(new THREE.SphereGeometry(H * 0.03, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 1.6), m); spin.castShadow = true; this.rotor.add(spin);
    // Blade: an aerofoil-ish lens cross-section, tapering in chord and thickness with a root-to-tip twist.
    const bladeGeo = new THREE.BoxGeometry(1, 1, 1, 1, 24, 1).translate(0, 0.5, 0), p = bladeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = p.getY(i), chord = B * (u < 0.15 ? 0.05 + u * 0.35 : 0.11 - (u - 0.15) * 0.1), thick = chord * (0.28 - u * 0.2), twist = (1 - u) * 0.35;
      const x = p.getX(i) * chord, z = p.getZ(i) * thick * (1 - Math.abs(p.getX(i)) * 1.2);
      p.setXYZ(i, x * Math.cos(twist) - z * Math.sin(twist), u * B, x * Math.sin(twist) + z * Math.cos(twist));
    }
    bladeGeo.computeVertexNormals();
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(bladeGeo, m); b.rotation.z = (k / 3) * Math.PI * 2; b.castShadow = true; this.rotor.add(b); }
    this.beacon = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a10, emissiveIntensity: 0, roughness: 0.3 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(H * 0.006, 10, 8), this.beacon); lamp.position.set(0, H * 0.055, -H * 0.06); head.add(lamp);
  }
  /** Rotor angle from rpm (deterministic) and the beacon blink (night 0..1). */
  update(t: number, night = 0) {
    this.rotor.rotation.z = -(this.phase + t * this.rpm / 60 * Math.PI * 2);
    this.beacon.emissiveIntensity = night * ((t % 2) < 0.25 ? 8 : 0.2);
  }
}

/** Lattice steel transmission tower with three cross-arms; `arms` gives the insulator tips (local) for cables. */
export class PowerPylon {
  readonly group = new THREE.Group(); readonly arms: THREE.Vector3[] = [];
  constructor(o: { height?: number } = {}) {
    const H = o.height ?? 40, steel = new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.5, metalness: 0.8 });
    const bar = (a: THREE.Vector3, b: THREE.Vector3, r: number) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.BoxGeometry(r, d.length(), r), steel); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; this.group.add(m); };
    const w = (y: number) => H * 0.12 * (1 - y / H) + H * 0.025, legs = (y: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3(x * w(y), y, z * w(y)));
    const levels = 10;
    for (let i = 0; i < levels; i++) {
      const y0 = (i / levels) * H * 0.92, y1 = ((i + 1) / levels) * H * 0.92, a = legs(y0), b = legs(y1);
      for (let k = 0; k < 4; k++) { bar(a[k], b[k], H * 0.008); bar(a[k], b[(k + 1) % 4], H * 0.004); bar(b[k], b[(k + 1) % 4], H * 0.004); }
    }
    bar(new THREE.Vector3(0, H * 0.92, 0), new THREE.Vector3(0, H, 0), H * 0.006);
    for (const [y, span] of [[0.62, 0.42], [0.75, 0.34], [0.88, 0.26]]) {
      const yy = H * y, s = H * span;
      bar(new THREE.Vector3(-s, yy, 0), new THREE.Vector3(s, yy, 0), H * 0.007); bar(new THREE.Vector3(-s, yy, 0), new THREE.Vector3(0, yy + H * 0.05, 0), H * 0.004); bar(new THREE.Vector3(s, yy, 0), new THREE.Vector3(0, yy + H * 0.05, 0), H * 0.004);
      for (const x of [-s, s]) {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.006, H * 0.006, H * 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x6f8a95, roughness: 0.25 })); ins.position.set(x, yy - H * 0.03, 0); this.group.add(ins);
        this.arms.push(new THREE.Vector3(x, yy - H * 0.06, 0));
      }
    }
  }
}

/** Catenary cables between matching arm points of two pylons (world space), with a sag fraction of the span. */
export class PowerLine {
  readonly group = new THREE.Group();
  constructor(a: PowerPylon, b: PowerPylon, o: { sag?: number; radius?: number } = {}) {
    a.group.updateMatrixWorld(true); b.group.updateMatrixWorld(true);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.4, metalness: 0.7 });
    a.arms.forEach((pa, i) => {
      const p0 = pa.clone().applyMatrix4(a.group.matrixWorld), p1 = b.arms[i].clone().applyMatrix4(b.group.matrixWorld), span = p0.distanceTo(p1), sag = span * (o.sag ?? 0.035);
      const pts = Array.from({ length: 33 }, (_, k) => { const u = k / 32, x = u * 2 - 1; return p0.clone().lerp(p1, u).add(new THREE.Vector3(0, -sag * (1 - (Math.cosh(x * 1.2) - 1) / (Math.cosh(1.2) - 1)), 0)); });
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, o.radius ?? 0.04, 6), mat); m.castShadow = true; this.group.add(m);
    });
  }
}
