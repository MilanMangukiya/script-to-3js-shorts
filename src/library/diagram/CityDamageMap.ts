import * as THREE from 'three';

/**
 * city-damage-map-v1 — 3D Tactical Metropolitan Radius & Survival Zone Map
 *
 * Designed for the mid-video escalation and "Where would you be on the map? 👇" beat:
 * - Procedural dark-mode satellite street grid with a winding river/coastline channel.
 * - Concentric distance rings (e.g., 0.5 MI, 2 MI, 10 MI, 50 MI) with deterministic expansion.
 * - Pulsing red epicenter pin and vertical beacon.
 * - `ringPointWorld(index, angleDeg)` helper for anchoring `overlay-labels-v1` callouts.
 */

export interface DamageRingSpec {
  radius: number;
  label?: string;
  color?: string;
  fillOpacity?: number;
}

export interface CityDamageMapOptions {
  size?: number;
  seed?: number;
  gridDivisions?: number;
  epicenter?: [number, number];
  rings?: DamageRingSpec[];
  waveSpeed?: number;
  progress?: number;
  time_s?: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep01(t: number): number {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

function createMapGridTexture(seed = 101): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep tactical slate background
  ctx.fillStyle = '#070B14';
  ctx.fillRect(0, 0, 1024, 1024);

  // Winding metropolitan river channel
  ctx.strokeStyle = '#0F2942';
  ctx.lineWidth = 54;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 680);
  ctx.bezierCurveTo(320, 610, 490, 390, 1024, 310);
  ctx.stroke();

  ctx.strokeStyle = '#1E3A5F';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Secondary arterial roads & city blocks
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  const step = 32;
  for (let i = 0; i <= 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Major highway avenues
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 3;
  for (let i = 128; i < 1024; i += 192) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Lit urban block clusters
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let gx = 0; gx < 32; gx++) {
    for (let gy = 0; gy < 32; gy++) {
      const distCenter = Math.hypot(gx - 16, gy - 16);
      const prob = Math.max(0.08, 0.65 - distCenter * 0.032);
      if (rand() < prob) {
        const alpha = 0.08 + rand() * 0.18;
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
        ctx.fillRect(gx * step + 3, gy * step + 3, step - 6, step - 6);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export class CityDamageMap {
  public readonly group = new THREE.Group();
  public readonly rings: DamageRingSpec[];
  public readonly epicenter: [number, number];
  public progress: number;

  private ringMeshes: {
    border: THREE.Mesh;
    fill: THREE.Mesh;
    spec: DamageRingSpec;
  }[] = [];
  private epicenterPin: THREE.Mesh;
  private pulseDisc: THREE.Mesh;
  private shockwaveRing: THREE.Mesh;

  constructor(options: CityDamageMapOptions = {}) {
    const size = options.size ?? 12.0;
    const seed = options.seed ?? 2026;
    this.epicenter = options.epicenter ?? [0, 0];
    this.progress = options.progress ?? 1.0;

    this.rings = options.rings ?? [
      { radius: 0.9, label: '0.5 MI — TOTAL VAPORIZATION', color: '#EF4444', fillOpacity: 0.32 },
      { radius: 2.1, label: '2.0 MI — 3,900,000 G PULL', color: '#F97316', fillOpacity: 0.2 },
      { radius: 3.6, label: '10 MI — STRUCTURAL COLLAPSE', color: '#FACC15', fillOpacity: 0.12 },
      { radius: 5.1, label: '50 MI — SEISMIC SHOCKWAVE', color: '#38BDF8', fillOpacity: 0.07 },
    ];

    // Base map plane
    const mapTex = createMapGridTexture(seed);
    const baseGeo = new THREE.PlaneGeometry(size, size);
    const baseMat = new THREE.MeshStandardMaterial({
      map: mapTex,
      roughness: 0.85,
      metalness: 0.15,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.rotation.x = -Math.PI * 0.5;
    this.group.add(baseMesh);

    const [ex, ez] = this.epicenter;

    // Concentric damage rings
    this.rings.forEach((spec, idx) => {
      const color = new THREE.Color(spec.color ?? '#EF4444');
      const fillGeo = new THREE.CircleGeometry(spec.radius, 64);
      const fillMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: spec.fillOpacity ?? 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.rotation.x = -Math.PI * 0.5;
      fill.position.set(ex, 0.015 + idx * 0.004, ez);
      this.group.add(fill);

      const borderGeo = new THREE.RingGeometry(
        Math.max(0.02, spec.radius - 0.045),
        spec.radius + 0.045,
        64
      );
      const borderMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.rotation.x = -Math.PI * 0.5;
      border.position.set(ex, 0.025 + idx * 0.004, ez);
      this.group.add(border);

      this.ringMeshes.push({ border, fill, spec });
    });

    // Epicenter vertical pin & pulsing disc
    const pinGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.2, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color: '#EF4444' });
    this.epicenterPin = new THREE.Mesh(pinGeo, pinMat);
    this.epicenterPin.position.set(ex, 0.6, ez);
    this.group.add(this.epicenterPin);

    const pulseGeo = new THREE.CircleGeometry(0.28, 32);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: '#FCA5A5',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.pulseDisc = new THREE.Mesh(pulseGeo, pulseMat);
    this.pulseDisc.rotation.x = -Math.PI * 0.5;
    this.pulseDisc.position.set(ex, 0.045, ez);
    this.group.add(this.pulseDisc);

    // Expanding shockwave sweep ring
    const shockGeo = new THREE.RingGeometry(0.92, 1.0, 64);
    const shockMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.shockwaveRing = new THREE.Mesh(shockGeo, shockMat);
    this.shockwaveRing.rotation.x = -Math.PI * 0.5;
    this.shockwaveRing.position.set(ex, 0.05, ez);
    this.group.add(this.shockwaveRing);

    if (options.time_s !== undefined) {
      this.update(options.time_s, this.progress);
    }
  }

  /**
   * Returns the world-space point on ring `ringIndex` at `angleDeg` so `projectToScreen()`
   * and `overlay-labels-v1` can attach leader-line callouts cleanly.
   */
  public ringPointWorld(ringIndex: number, angleDeg = 35): THREE.Vector3 {
    const idx = Math.max(0, Math.min(this.rings.length - 1, ringIndex));
    const r = this.rings[idx].radius;
    const rad = (angleDeg * Math.PI) / 180;
    const local = new THREE.Vector3(
      this.epicenter[0] + Math.cos(rad) * r,
      0.05,
      this.epicenter[1] + Math.sin(rad) * r
    );
    return local.applyMatrix4(this.group.matrixWorld);
  }

  public update(time_s: number, progress = this.progress): void {
    this.progress = clamp01(progress);
    const totalRings = this.ringMeshes.length;

    for (let i = 0; i < totalRings; i++) {
      const item = this.ringMeshes[i];
      const ringStart = (i / totalRings) * 0.65;
      const localU = smoothstep01((this.progress - ringStart) / 0.35);
      const scale = Math.max(0.001, localU);

      item.fill.scale.set(scale, scale, 1);
      item.border.scale.set(scale, scale, 1);
      (item.fill.material as THREE.MeshBasicMaterial).opacity =
        (item.spec.fillOpacity ?? 0.18) * localU;
      (item.border.material as THREE.MeshBasicMaterial).opacity = 0.95 * localU;
    }

    // Epicenter pulse
    const pulse = 1.0 + 0.35 * Math.sin(time_s * 6.5);
    this.pulseDisc.scale.set(pulse, pulse, 1);

    // Continuous radar shockwave sweep across max radius
    const maxR = this.rings[this.rings.length - 1]?.radius ?? 5.0;
    const wavePhase = (time_s * 0.55) % 1.0;
    const waveR = Math.max(0.1, wavePhase * maxR * this.progress);
    this.shockwaveRing.scale.set(waveR, waveR, 1);
    (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity =
      (1.0 - wavePhase) * 0.55 * this.progress;
  }
}