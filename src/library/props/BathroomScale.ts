import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DialGauge, type DialMark } from './DialGauge';

export interface BathroomScaleOptions {
  /** Platform width/depth and height in metres. */
  width?: number; depth?: number; height?: number;
  /** Dial range, unit and coloured reference marks (e.g. a "today" reading). */
  min?: number; max?: number; unit?: string; marks?: DialMark[];
  bodyColor?: THREE.ColorRepresentation; matColor?: THREE.ColorRepresentation;
  /** Who reads the dial: 'user' (the person standing on it, default) or 'front' (a camera in front of the scale). */
  readFrom?: 'user' | 'front';
}

/**
 * Mechanical bathroom scale: rounded platform, rubber standing mat and an analog dial (dial-gauge-v1) near the front
 * edge, tilted toward its reader. Origin at floor level, centre of the platform; the person on it faces +Z, toward
 * the dial at the front edge.
 * `value` is a plain setter in the dial's unit; `topY` is the standing surface height for posing a figure.
 */
export class BathroomScale {
  readonly group = new THREE.Group();
  readonly dial: DialGauge;
  readonly topY: number;

  constructor(o: BathroomScaleOptions = {}) {
    const W = o.width ?? 0.32, D = o.depth ?? 0.34, H = o.height ?? 0.05;
    const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, H * 0.45), new THREE.MeshStandardMaterial({ color: o.bodyColor ?? 0xf1efea, roughness: 0.32, metalness: 0 }));
    body.position.y = H / 2 + 0.006; body.castShadow = body.receiveShadow = true; this.group.add(body);
    const mat = new THREE.Mesh(new RoundedBoxGeometry(W * 0.86, 0.004, D * 0.58, 2, 0.002), new THREE.MeshStandardMaterial({ color: o.matColor ?? 0x9aa3a6, roughness: 0.9 }));
    mat.position.set(0, H + 0.008, -D * 0.12); mat.receiveShadow = true; this.group.add(mat);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // feet
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.008, 12), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 }));
      f.position.set(x * W * 0.38, 0.004, z * D * 0.38); this.group.add(f);
    }
    this.dial = new DialGauge({ radius: Math.min(W, D) * 0.17, min: o.min ?? 0, max: o.max ?? 150, arcDegrees: 280, majorStep: 5, minorStep: 1, labelStep: 5,
      unit: o.unit ?? 'kg', marks: o.marks, bezel: 'steel', depth: 0.01 });
    const DR = Math.min(W, D) * 0.17;
    this.dial.group.position.set(0, H + 0.011 + DR * Math.sin(0.32) + 0.004, D * 0.29);   // raised so the full bezel clears the platform
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(DR * 1.16, DR * 1.22, 0.06, 64).rotateX(Math.PI / 2), body.material as THREE.Material);
    pod.position.z = -0.031; pod.castShadow = pod.receiveShadow = true; this.dial.group.add(pod);   // dial housing (behind the face, into the body)
    // Face up, tilted 18° toward the reader; turned half a revolution when the reader is the person on the scale.
    this.dial.group.rotation.set(-Math.PI / 2 + 0.32, o.readFrom === 'front' ? 0 : Math.PI, 0, 'YXZ');
    this.group.add(this.dial.group);
    this.topY = H + 0.012;
  }

  set value(v: number) { this.dial.value = v; }
}
