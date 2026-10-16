import * as THREE from 'three';
import { Humanoid } from './Humanoid';
import { VanishDissolve } from '../fx/VanishDissolve';
import { mulberry32, clamp, smoothstep } from '../util/math';

/**
 * pedestrian-crowd-v1 — Deterministic Articulated Pedestrian Crowd
 *
 * Preserves all 16 original registry.json parameters and makeUmbrella()[cite: 1].
 * Upgraded with viral simulation action states:
 * - `panicRun` (0..1): Fleeing/evacuation sprint with forward torso lean and rapid gait.
 * - `syncJump`: Deterministic crouch + parabolic vertical jump + landing absorption.
 * - `vortexPull`: Spirals and lifts figures toward a singularity or tornado origin.
 */

export interface SyncJumpSpec {
  start_s: number;
  duration_s?: number;
  height_m?: number;
}

export interface VortexPullSpec {
  start_s: number;
  duration_s: number;
  origin: [number, number, number];
  maxLift_m?: number;
}

export interface PedestrianCrowdOptions {
  seed?: number;
  count?: number;
  width?: number;
  depth?: number;
  speedRange?: [number, number];
  heightRange?: [number, number];
  childFraction?: number;
  flagFraction?: number;
  umbrellaCount?: number;
  dissolve?: boolean;
  clock_s?: number;
  vanishStart_s?: number;
  dissolveEnabled?: boolean;
  survivorStop_s?: number;
  visibleCount?: number;
  time_s?: number;
  // New simulation parameters
  panicRun?: number;
  syncJump?: SyncJumpSpec;
  vortexPull?: VortexPullSpec;
}

export function makeUmbrella(color = '#1E293B', radius = 0.52): THREE.Group {
  const group = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.68, 8);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: '#94A3B8',
    metalness: 0.7,
    roughness: 0.3,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = 0.34;
  group.add(shaft);

  const canopyGeo = new THREE.ConeGeometry(radius, 0.22, 12, 1, true);
  const canopyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 0.64;
  group.add(canopy);

  return group;
}

interface CrowdAgent {
  figure: Humanoid;
  root: THREE.Group;
  dissolveFx?: VanishDissolve;
  baseX: number;
  baseZ: number;
  direction: 1 | -1;
  baseSpeed: number;
  height: number;
  phase: number;
  flagged: boolean;
  hasUmbrella: boolean;
  umbrellaGroup?: THREE.Group;
}

export class PedestrianCrowd {
  public readonly group = new THREE.Group();
  public readonly agents: CrowdAgent[] = [];

  private width: number;
  private depth: number;
  public vanishStart_s: number;
  public dissolveEnabled: boolean;
  public survivorStop_s: number;
  public visibleCount: number;
  public panicRun: number;
  public syncJump?: SyncJumpSpec;
  public vortexPull?: VortexPullSpec;

  constructor(options: PedestrianCrowdOptions = {}) {
    const seed = options.seed ?? 101;
    const rng = mulberry32(seed);
    const count = options.count ?? 18;
    this.width = options.width ?? 9.0;
    this.depth = options.depth ?? 6.0;
    const speedRange = options.speedRange ?? [1.1, 1.55];
    const heightRange = options.heightRange ?? [1.58, 1.84];
    const childFraction = options.childFraction ?? 0.12;
    const flagFraction = options.flagFraction ?? 0.5;
    const umbrellaCount = options.umbrellaCount ?? 0;
    const enableDissolve = options.dissolve ?? false;

    this.vanishStart_s = options.vanishStart_s ?? 9999;
    this.dissolveEnabled = options.dissolveEnabled ?? enableDissolve;
    this.survivorStop_s = options.survivorStop_s ?? 9999;
    this.visibleCount = options.visibleCount ?? count;
    this.panicRun = options.panicRun ?? 0;
    this.syncJump = options.syncJump;
    this.vortexPull = options.vortexPull;

    const coatPalette = [
      '#1E293B',
      '#334155',
      '#7C2D12',
      '#1E3A8A',
      '#3F6212',
      '#581C87',
      '#B45309',
      '#0F172A',
    ];
    const trouserPalette = ['#0F172A', '#1E293B', '#374151', '#27272A'];
    const skinPalette = ['#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#FFDBAC'];

    for (let i = 0; i < count; i++) {
      const isChild = rng() < childFraction;
      const height = isChild
        ? 1.15 + rng() * 0.22
        : heightRange[0] + rng() * (heightRange[1] - heightRange[0]);

      const figure = new Humanoid({
        height,
        coatColor: coatPalette[Math.floor(rng() * coatPalette.length)],
        trouserColor: trouserPalette[Math.floor(rng() * trouserPalette.length)],
        skinColor: skinPalette[Math.floor(rng() * skinPalette.length)],
        coat: 'long',
        hat: rng() < 0.22,
      });

      const root = new THREE.Group();
      root.add(figure.group);

      const direction: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const baseX = (rng() - 0.5) * this.width;
      const baseZ = (rng() - 0.5) * this.depth;
      const baseSpeed = speedRange[0] + rng() * (speedRange[1] - speedRange[0]);
      const phase = rng() * Math.PI * 2;
      const flagged = i / count < flagFraction;
      const hasUmbrella = i < umbrellaCount;

      let umbrellaGroup: THREE.Group | undefined;
      if (hasUmbrella) {
        umbrellaGroup = makeUmbrella(coatPalette[(i + 3) % coatPalette.length]);
        umbrellaGroup.position.set(0.22, height * 0.58, 0.18);
        root.add(umbrellaGroup);
      }

      let dissolveFx: VanishDissolve | undefined;
      if (enableDissolve && flagged) {
        dissolveFx = new VanishDissolve(root, {
          seed: seed + i * 19,
          duration_s: 1.8,
        });
        this.group.add(dissolveFx.motes);
      }

      this.group.add(root);
      this.agents.push({
        figure,
        root,
        dissolveFx,
        baseX,
        baseZ,
        direction,
        baseSpeed,
        height,
        phase,
        flagged,
        hasUmbrella,
        umbrellaGroup,
      });
    }

    if (options.time_s !== undefined) {
      this.update(options.time_s, options.clock_s ?? options.time_s);
    }
  }

  public update(time_s: number, clock_s = time_s): void {
    const halfW = this.width * 0.5;
    const panic = clamp(this.panicRun, 0, 1);

    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      agent.root.visible = i < this.visibleCount;
      if (!agent.root.visible) continue;

      // Speed multiplier when panicRun > 0
      const speedMult = 1.0 + panic * 2.1;
      let effectiveClock = clock_s;

      if (!agent.flagged && clock_s > this.survivorStop_s) {
        const dt = clock_s - this.survivorStop_s;
        const decel = Math.min(dt, 1.2) - 0.4 * Math.min(dt, 1.2) ** 2;
        effectiveClock = this.survivorStop_s + Math.max(0, decel);
      }

      const travel = effectiveClock * agent.baseSpeed * speedMult * agent.direction;
      let x = agent.baseX + travel;
      // Wrap inside crosswalk width for continuous deterministic evaluation
      const span = this.width + 2.0;
      x = ((((x + halfW + 1.0) % span) + span) % span) - (halfW + 1.0);
      let y = 0;
      let z = agent.baseZ;

      // 1. Synchronized Jump Override (every-human-jumped-at-once)
      let crouchAmount = 0;
      if (this.syncJump) {
        const jStart = this.syncJump.start_s;
        const jDur = this.syncJump.duration_s ?? 0.52;
        const jHeight = this.syncJump.height_m ?? 0.3;
        const crouchWindow = 0.42;

        if (time_s >= jStart - crouchWindow && time_s < jStart) {
          crouchAmount = Math.sin(((time_s - (jStart - crouchWindow)) / crouchWindow) * Math.PI);
          y = -crouchAmount * 0.14;
        } else if (time_s >= jStart && time_s <= jStart + jDur) {
          const u = (time_s - jStart) / jDur;
          y = 4.0 * jHeight * u * (1.0 - u);
        } else if (time_s > jStart + jDur && time_s <= jStart + jDur + 0.35) {
          const landU = (time_s - (jStart + jDur)) / 0.35;
          crouchAmount = Math.sin(landU * Math.PI) * 0.75;
          y = -crouchAmount * 0.1;
        }
      }

      // 2. Vortex / Black Hole Lift Override (coin-black-hole-city)
      let tumbleTilt = 0;
      if (this.vortexPull && time_s >= this.vortexPull.start_s) {
        const pU = smoothstep(
          0,
          1,
          (time_s - this.vortexPull.start_s) / Math.max(0.01, this.vortexPull.duration_s)
        );
        const staggeredU = clamp(pU * 1.25 - (i % 5) * 0.06, 0, 1);
        const [ox, oy, oz] = this.vortexPull.origin;
        const swirlAngle = staggeredU * Math.PI * 2.5 + agent.phase;
        const pullFactor = staggeredU * staggeredU;

        x = x * (1 - pullFactor * 0.85) + ox * pullFactor * 0.85 + Math.cos(swirlAngle) * staggeredU * 0.8;
        z = z * (1 - pullFactor * 0.85) + oz * pullFactor * 0.85 + Math.sin(swirlAngle) * staggeredU * 0.8;
        y += oy * pullFactor + staggeredU * (this.vortexPull.maxLift_m ?? 3.5);
        tumbleTilt = staggeredU * 1.4;
      }

      agent.root.position.set(x, y, z);

      const yaw = agent.direction > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      const forwardLean = panic * 0.22 + crouchAmount * 0.28 + tumbleTilt;
      agent.root.rotation.set(forwardLean, yaw, tumbleTilt * 0.5);

      // Analytic limb gait
      const strideFreq = (2.4 + panic * 2.6) * agent.baseSpeed;
      const gaitPhase = effectiveClock * strideFreq + agent.phase;
      if (typeof (agent.figure as any).setGait === 'function') {
        (agent.figure as any).setGait(gaitPhase, 0.55 + panic * 0.45);
      }

      // Dissolve update if enabled
      if (agent.dissolveFx) {
        const agentVanishStart = this.vanishStart_s + (i % 6) * 0.12;
        agent.dissolveFx.update(
          time_s,
          agentVanishStart,
          agent.root.position,
          this.dissolveEnabled
        );
      }
    }
  }
}