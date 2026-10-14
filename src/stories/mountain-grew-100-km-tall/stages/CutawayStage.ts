import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import type { EarthMapSet } from '../../../library/environment/PlanetAtmosphere';
import { PeakCutaway } from '../../../library/environment/GiantPeak';
import { PlanetStage, win, type Anchor } from './common';
import { CRACKS, T } from '../timeline';

/** Cross-section of the peak (z <= 0 half kept) with the overburden stress map, then staggered base fractures. */
export class CutawayStage extends PlanetStage {
  cap: PeakCutaway;
  constructor(maps: EarthMapSet) {
    super(maps, { sunPower: 4.5, skyGain: 1.5, cloudOpacity: 0.8, near: 1, far: 8000 });
    this.peak.uniforms.uClipZ.value = 0;
    this.cap = new PeakCutaway(this.peak, { halfWidth: 1100, depth: 340, limitDepth: 7.5 });
    this.scene.add(this.cap.mesh);
  }
  /** Fracture amount: four staggered bursts, each a fast rise to its plateau. */
  crack(t: number) { return CRACKS.reduce((s, at, i) => s + 0.25 * win(t, at, at + 0.06 + 0.02 * i), 0); }
  update(t: number, shot: ShotInfo) {
    const c = this.cap.uniforms, cr = this.crack(t);
    c.uReveal.value = win(t, 42.2, 44.6); c.uLimit.value = win(t, 43.3, 43.9); c.uTime.value = t;
    c.uCrack.value = cr; c.uBright.value = 1 + 0.35 * Math.max(0, ...CRACKS.map((a) => Math.exp(-Math.max(0, t - a) * 9) * (t >= a ? 1 : 0)));
    this.peak.uniforms.uCrack.value = cr; this.peak.uniforms.uCrackFront.value = 26 * cr;
    this.peak.collapse = 0.06 * win(t, 47.0, 47.6);
    this.syncSky(t);
  }
  anchors(t: number, shot: ShotInfo): Anchor[] {
    if (shot.shotId !== 'SH01') return [];
    const base = this.peak.surfacePoint(0, 0, -99.2);
    // A point on the dashed limit line, 7.5 km under the surface about 120 km out from the summit column.
    const x = 118, lim = this.peak.surfacePoint(x, 0, -7.5);
    return [
      { world: base, label: 'BASE', value: '26,000 ATM', accent: '#EF4444', dx: 70, dy: 110, alpha: win(t, T.feels + 1.2, T.feels + 1.6) },
      { world: lim, label: 'GRANITE CRUSHES', value: '≈ 2,000 ATM', accent: '#38BDF8', dx: 40, dy: -150, alpha: win(t, 43.6, 44.0) },
    ];
  }
}
