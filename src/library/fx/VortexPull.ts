import * as THREE from 'three';
import { mulberry32, clamp, smoothstep } from '../util/math';

/**
 * vortex-debris-pull-v1 — Deterministic Singularity / Vortex Debris Accretion Rig
 *
 * Built for high-retention destruction sequences ("The cars go first, then the roofs..."):
 * - Renders an event-horizon core + glowing photon/accretion ring (`showCore: true`).
 * - Spirals `count` instanced 3D debris chunks (masonry, roof tiles, vehicle fragments,
 *   asphalt slabs) from a ground scatter field inward into the vortex origin.
 * - Pure deterministic function of `time_s` and `progress` (0..1).
 */

export interface VortexPullOptions {
  seed?: number;
  count?: number;
  origin?: [number, number, number];
  fieldRadius?: number;
  coreRadius?: number;
  showCore?: boolean;
  ringColor?: string;
  progress?: number;
  time_s?: number;
}

interface DebrisParticle {
  startRadius: number;
  startAngle: number;
  startY: number;
  angularSpeed: number;
  scale: [number, number, number];
  staggerOffset: number;
  tumbleAxis: THREE.Vector3;
}

export class VortexPull {
  public readonly group = new THREE.Group();
  public readonly instancedMesh: THREE.InstancedMesh;
  public readonly coreGroup = new THREE.Group();

  public origin: THREE.Vector3;
  public progress: number;
  private particles: DebrisParticle[] = [];
  private dummy = new THREE.Object3D();
  private photonRing: THREE.Mesh;

  constructor(options: VortexPullOptions = {}) {
    const seed = options.seed ?? 887;
    const rng = mulberry32(seed);
    const count = options.count ?? 320;
    const fieldRadius = options.fieldRadius ?? 18.0;
    const coreRadius = options.coreRadius ?? 0.38;
    const showCore = options.showCore ?? true;

    this.origin = new THREE.Vector3(...(options.origin ?? [0, 3.2, -4.0]));
    this.progress = options.progress ?? 0;

    // 1. Optional Black Hole / Singularity Core + Relativistic Photon Ring
    this.coreGroup.position.copy(this.origin);
    this.coreGroup.visible = showCore;

    const horizonGeo = new THREE.SphereGeometry(coreRadius, 32, 32);
    const horizonMat = new THREE.MeshBasicMaterial({ color: '#000000' });
    const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    this.coreGroup.add(horizonMesh);

    const ringGeo = new THREE.TorusGeometry(coreRadius * 1.65, coreRadius * 0.14, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: options.ringColor ?? '#F97316',
    });
    this.photonRing = new THREE.Mesh(ringGeo, ringMat);
    this.photonRing.rotation.x = Math.PI * 0.38;
    this.coreGroup.add(this.photonRing);

    const haloGeo = new THREE.RingGeometry(coreRadius * 1.15, coreRadius * 2.6, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: '#FACC15',
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.coreGroup.add(haloMesh);

    this.group.add(this.coreGroup);

    // 2. Instanced Debris Swirl Field
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      metalness: 0.25,
      vertexColors: false,
    });
    this.instancedMesh = new THREE.InstancedMesh(boxGeo, boxMat, count);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const palette = [
      new THREE.Color('#334155'),
      new THREE.Color('#64748B'),
      new THREE.Color('#94A3B8'),
      new THREE.Color('#B45309'),
      new THREE.Color('#1E293B'),
      new THREE.Color('#EF4444'),
    ];

    for (let i = 0; i < count; i++) {
      const r = 1.2 + Math.pow(rng(), 0.65) * fieldRadius;
      const angle = rng() * Math.PI * 2;
      const startY = rng() < 0.65 ? 0.15 + rng() * 0.6 : 2.5 + rng() * 8.0; // Street level vs roof level
      const angularSpeed = (2.2 + rng() * 3.5) * (12.0 / (r + 2.0));
      const sx = 0.12 + rng() * 0.45;
      const sy = 0.06 + rng() * 0.25;
      const sz = 0.18 + rng() * 0.65;

      // Closer street objects lift earlier than distant roof slabs
      const staggerOffset = clamp((r / fieldRadius) * 0.45 + (startY > 2.0 ? 0.18 : 0.0), 0, 0.65);

      this.particles.push({
        startRadius: r,
        startAngle: angle,
        startY,
        angularSpeed,
        scale: [sx, sy, sz],
        staggerOffset,
        tumbleAxis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
      });

      this.instancedMesh.setColorAt(i, palette[i % palette.length]);
    }
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    this.group.add(this.instancedMesh);

    if (options.time_s !== undefined) {
      this.update(options.time_s, this.progress);
    }
  }

  public update(time_s: number, progress = this.progress): void {
    this.progress = clamp(progress, 0, 1);
    this.coreGroup.position.copy(this.origin);
    this.photonRing.rotation.z = time_s * 3.2;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const localU = smoothstep(
        0,
        1,
        (this.progress - p.staggerOffset) / Math.max(0.15, 1.0 - p.staggerOffset)
      );

      // Spiral inward as localU approaches 1
      const currentR = p.startRadius * (1.0 - localU * 0.94);
      const theta = p.startAngle + time_s * p.angularSpeed * (0.25 + localU * 2.4);

      const x = this.origin.x + Math.cos(theta) * currentR;
      const z = this.origin.z + Math.sin(theta) * currentR;
      const y =
        p.startY * (1.0 - localU) +
        this.origin.y * localU +
        Math.sin(theta * 2.0 + i) * localU * 0.65;

      // Spaghettification / swallow scale shrink inside the inner 8% radius
      const swallowFade = localU > 0.92 ? (1.0 - localU) / 0.08 : 1.0;
      const activeVis = this.progress > 0.01 ? 1.0 : 0.0;
      const s = swallowFade * activeVis;

      this.dummy.position.set(x, y, z);
      this.dummy.quaternion.setFromAxisAngle(p.tumbleAxis, time_s * 4.5 * localU + i);
      this.dummy.scale.set(p.scale[0] * s, p.scale[1] * s, p.scale[2] * s);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}