import * as THREE from 'three';
import { rng } from '../util/math';

export interface CowOptions {
  /** Seed for the coat pattern and small proportion variations. */
  seed?: number;
  /** 'holstein' black-and-white patches, 'brown' solid brown, 'jersey' fawn. */
  coat?: 'holstein' | 'brown' | 'jersey';
  /** Uniform scale (1 = a 1.45 m-at-the-withers dairy cow, about 2.4 m long). */
  scale?: number;
}

export interface CowPose {
  /** 0 = head up and alert, 1 = muzzle down grazing in the grass. */
  graze?: number;
  /** Head turn left/right in radians. */
  headYaw?: number;
  /** 0..1 jaw open (chewing or a burp). */
  jaw?: number;
  /** Tail swing in radians (side to side). */
  tail?: number;
  /** Ear flick 0..1. */
  ears?: number;
}

/**
 * dairy-cow-v1 — procedural stylised dairy cow in metres, facing +Z with its feet on y = 0. Rounded capsule body and
 * head, four legs with hooves, udder, ears, tail with a tuft, and a canvas coat (Holstein patches or a solid coat).
 * setPose() drives grazing, head turn, jaw, tail and ears; mouthWorld() gives the muzzle tip for breath or burp puffs.
 * Static geometry; every pose call sets the full state.
 */
export class Cow {
  readonly root = new THREE.Group();
  private neck = new THREE.Group(); private head = new THREE.Group(); private jawG = new THREE.Group();
  private tailG = new THREE.Group(); private earL = new THREE.Group(); private earR = new THREE.Group();
  private mouth = new THREE.Object3D();

  constructor(o: CowOptions = {}) {
    const r = rng(o.seed ?? 1), coat = o.coat ?? 'holstein';
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d')!;
    x.fillStyle = coat === 'holstein' ? '#f2efe8' : coat === 'brown' ? '#6b3f22' : '#b9864e'; x.fillRect(0, 0, 256, 128);
    if (coat === 'holstein') {
      x.fillStyle = '#16130f';
      for (let i = 0; i < 9; i++) {
        const cx = r() * 256, cy = 10 + r() * 108, rx = 18 + r() * 34, ry = 12 + r() * 24;
        x.beginPath();
        for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, w = 1 + 0.25 * Math.sin(a * 3 + i) + 0.12 * Math.sin(a * 7 + i * 2); x.lineTo(cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w); }
        x.fill();
        if (cx < 40 || cx > 216) { x.save(); x.translate(cx < 40 ? 256 : -256, 0); x.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; x.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); } x.fill(); x.restore(); }
      }
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
    const hide = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const plain = new THREE.MeshStandardMaterial({ color: coat === 'holstein' ? 0x1a1612 : coat === 'brown' ? 0x5a341c : 0x9d7040, roughness: 0.8 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xd99a92, roughness: 0.6 });
    const hoof = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.7 });
    const add = (p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, pos: [number, number, number], rot?: [number, number, number]) => {
      const mesh = new THREE.Mesh(g, m); mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); mesh.castShadow = true; mesh.receiveShadow = true; p.add(mesh); return mesh;
    };
    const s = o.scale ?? 1; this.root.scale.setScalar(s);
    // Body: a capsule lying along Z, slightly deeper than wide, plus a belly and hips.
    add(this.root, new THREE.CapsuleGeometry(0.4, 1.1, 8, 20).rotateX(Math.PI / 2).scale(1, 1.12, 1), hide, [0, 1.05, 0]);
    add(this.root, new THREE.SphereGeometry(0.45, 18, 12).scale(1, 0.85, 1.25), hide, [0, 0.94, 0.05]);
    add(this.root, new THREE.SphereGeometry(0.33, 14, 10), hide, [0, 1.18, -0.62]);
    // Legs with hooves.
    for (const [lx, lz] of [[-0.24, 0.55], [0.24, 0.55], [-0.24, -0.62], [0.24, -0.62]]) {
      add(this.root, new THREE.CylinderGeometry(0.075, 0.06, 0.78, 10), hide, [lx, 0.43, lz]);
      add(this.root, new THREE.CylinderGeometry(0.065, 0.075, 0.1, 10), hoof, [lx, 0.05, lz]);
    }
    add(this.root, new THREE.SphereGeometry(0.17, 14, 10).scale(1.1, 0.8, 1.2), pink, [0, 0.66, -0.42]);
    for (const [tx, tz] of [[-0.06, -0.36], [0.06, -0.36], [-0.06, -0.5], [0.06, -0.5]]) add(this.root, new THREE.CylinderGeometry(0.018, 0.014, 0.08, 6), pink, [tx, 0.55, tz]);
    // Neck and head (head hangs from the neck pivot at the shoulders).
    this.neck.position.set(0, 1.25, 0.72); this.root.add(this.neck);
    add(this.neck, new THREE.CapsuleGeometry(0.2, 0.35, 6, 12).rotateX(Math.PI / 2 - 0.5), hide, [0, 0.02, 0.2]);
    this.head.position.set(0, 0.08, 0.5); this.neck.add(this.head);
    add(this.head, new THREE.CapsuleGeometry(0.16, 0.32, 6, 12).rotateX(Math.PI / 2 + 0.55).scale(1, 1, 1), hide, [0, -0.08, 0.14]);
    add(this.head, new THREE.SphereGeometry(0.13, 14, 10).scale(1.05, 0.85, 0.9), coat === 'holstein' ? pink : plain, [0, -0.27, 0.32]);
    for (const sx of [-1, 1]) add(this.head, new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1b1310, roughness: 0.3 }), [sx * 0.12, 0.02, 0.17]);
    this.jawG.position.set(0, -0.3, 0.22); this.head.add(this.jawG);
    add(this.jawG, new THREE.BoxGeometry(0.16, 0.04, 0.16), coat === 'holstein' ? pink : plain, [0, -0.02, 0.06]);
    this.mouth.position.set(0, -0.05, 0.16); this.jawG.add(this.mouth);
    for (const [g, sx] of [[this.earL, -1], [this.earR, 1]] as const) {
      g.position.set(sx * 0.15, 0.06, 0.06); this.head.add(g);
      add(g, new THREE.SphereGeometry(1, 10, 6).scale(0.09, 0.035, 0.05), plain, [sx * 0.08, 0, 0]);
    }
    // Tail.
    this.tailG.position.set(0, 1.28, -0.95); this.root.add(this.tailG);
    add(this.tailG, new THREE.CylinderGeometry(0.02, 0.025, 0.75, 6), hide, [0, -0.38, -0.02]);
    add(this.tailG, new THREE.SphereGeometry(0.05, 8, 6).scale(1, 2, 1), plain, [0, -0.8, -0.02]);
    this.setPose({});
  }

  /** Set the full pose; unspecified fields return to their neutral values. */
  setPose(p: CowPose) {
    const g = Math.max(0, Math.min(1, p.graze ?? 0));
    this.neck.rotation.set(0.15 + 0.95 * g, (p.headYaw ?? 0) * (1 - 0.5 * g), 0);
    this.head.rotation.set(-0.1 + 0.25 * g, 0, 0);
    this.jawG.rotation.x = 0.35 * Math.max(0, Math.min(1, p.jaw ?? 0));
    this.tailG.rotation.set(0.12, 0, p.tail ?? 0);
    const e = p.ears ?? 0; this.earL.rotation.set(0, 0, 0.3 + 0.5 * e); this.earR.rotation.set(0, 0, -0.3 - 0.5 * e);
    this.root.updateMatrixWorld(true);
  }

  /** World position of the muzzle (call after setPose). */
  mouthWorld(out = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.mouth.getWorldPosition(out); }
}
