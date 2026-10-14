import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { standardPressureAtm, type EarthMapSet } from '../../../library/environment/PlanetAtmosphere';
import { Starfield } from '../../../library/space/Starfield';
import { MeteorStreaks, type MeteorSpawn } from '../../../library/fx/MeteorStreaks';
import { PlanetStage, SUN, win, ease, type Anchor } from './common';
import { growAt, T } from '../timeline';

const EVEREST = 8.849;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Kilometre-scale stage around the peak: orbit, side views, high flank, summit, survival map, weather and collapse. */
export class PeakStage extends PlanetStage {
  stars = new Starfield({ seed: 911, count: 2600, radius: 1, brightness: 0.6, maxSize: 4 });
  meteors: MeteorStreaks;
  constructor(maps: EarthMapSet) {
    super(maps, { sunPower: 4.5, skyGain: 1.5, cloudOpacity: 0.85, near: 0.5, far: 8000 });
    // Seven meteors burning up between 80 and 95 km beside the 80 km camera; the brightest crosses at 26.3 s.
    // Spawned in the 80 km camera's own frame (S05/SH02 mid-shot pose), 6-25 km out in open air beside the flank.
    const C = V(12, 80.75, 34), F = V(-3, 97.5, 0).sub(C).normalize(), Rt = F.clone().cross(V(0, 1, 0)).normalize(), Up = Rt.clone().cross(F).normalize();
    const m = (at: number, d: number, a: number, b: number, side: number, trail: number, width: number, bright: number, life = 0.6): MeteorSpawn => ({
      at_s: at, life_s: life, start: C.clone().addScaledVector(F, d).addScaledVector(Rt, a * d / 10).addScaledVector(Up, b * d / 10),
      velocity: Rt.clone().multiplyScalar(-30 * side).addScaledVector(Up, -17).addScaledVector(F, 6), trail, width, brightness: bright });
    this.meteors = new MeteorStreaks({ meteors: [
      m(25.45, 18, 3.5, 4.5, 1, 9, 0.06, 0.9), m(25.95, 22, -2.5, 6.0, -1, 11, 0.07, 1.0, 0.55),
      m(26.3, 7, 2.0, 3.0, 1, 7, 0.035, 2.4, 0.75), m(26.85, 20, 1.0, 6.5, 1, 12, 0.07, 0.9),
      m(27.2, 15, -3.0, 4.0, -1, 10, 0.05, 1.3, 0.5), m(27.55, 12, 4.0, 5.0, 1, 8, 0.05, 0.9), m(27.8, 24, 0.0, 3.5, -1, 10, 0.06, 1.0, 0.45),
    ] });
    // Depth-only planet sphere so stars and meteors never show through the Earth below the horizon.
    const occ = new THREE.Mesh(new THREE.SphereGeometry(6371, 512, 256), new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.position.y = -6371; occ.renderOrder = -60;
    this.scene.add(occ, this.stars.points, this.meteors.mesh);
    this.peak.mesh.position.set(0, 0, 0); this.peak.mesh.scale.setScalar(1);
  }
  update(t: number, shot: ShotInfo) {
    const k = shot.key, u = this.u, p = this.peak;
    p.clearBands(); p.uniforms.uZoneAmt.value = 0; p.uniforms.uCrack.value = 0; p.collapse = 0; p.grow = 1;
    u.uWeather.value.set(0, 0, 0, 0); u.uCloudSea.value.set(0, 700, 170, 0); u.uCloudOpacity.value = 0.85; u.uDesertGround.value = 0; u.uSunDir.value.copy(SUN); u.uCloudShift.value = 0;
    this.meteors.mesh.visible = false;
    let near = 0.5, far = 8000, starB = 0;
    switch (k) {
      case 'S02/SH01': // orbit: the spire breaks through the limb
        p.grow = growAt(t); near = 20; far = 9000; starB = 0.55; u.uCloudSea.value.set(0.55, 650, 170, 0); break;
      case 'S02/SH02': { // eleven Everests and the cloud sea at its ankles
        near = 2; far = 6000; u.uCloudSea.value.set(0.95, 760, 175, 0);
        for (let i = 0; i < 10; i++) p.setBand(i, EVEREST * (i + 1), win(t, T.ringsStart + 0.12 * i, T.ringsStart + 0.12 * i + 0.18), 0xffc35a);
        // The eleventh ring shares the slot of the tenth after its own reveal (only ten band slots).
        if (t > T.ringsStart + 1.2) p.setBand(9, EVEREST * 11, win(t, T.ringsStart + 1.2, T.ringsStart + 1.38), 0xffc35a);
        break;
      }
      case 'S05/SH01': near = 0.3; far = 6000; starB = 0.15 + 0.35 * win(t, 23.6, 25.3); u.uCloudSea.value.set(0.7, 700, 175, 0); break;
      case 'S05/SH02': near = 0.05; far = 6000; starB = 0.75; this.meteors.mesh.visible = true; break;
      case 'S06/SH01': near = 0.05; far = 6000; starB = 0.85; break;
      case 'S06/SH02': {
        near = 2; far = 6000; u.uCloudSea.value.set(0.85, 760, 175, 0);
        p.setBand(0, 8, win(t, 30.1, 30.35), 0xff4a3d); p.setBand(1, 19, win(t, 30.6, 30.85), 0xff9a3c); p.setBand(2, 99.4, win(t, 31.1, 31.35), 0x52d4ff);
        p.uniforms.uZoneAlt.value = 8; p.uniforms.uZoneAmt.value = win(t, T.deathZone - 0.1, T.deathZone + 0.45);
        (p.uniforms.uZoneCol.value as THREE.Color).set(0xff3a2e);
        break;
      }
      case 'S07/SH01': case 'S07/SH02': {
        near = 5; far = 12000; starB = 0.1;
        u.uSunDir.value.set(-0.38, 0.72, 0.58).normalize();
        const storm = 0.45 + 0.45 * win(t, 33.3, 36.6) + 0.1 * win(t, 36.6, T.drowns + 0.4);
        u.uWeather.value.set(storm, 0.35 + 0.65 * win(t, 34.4, T.desert), 0.15 + 0.85 * win(t, T.desert - 1.0, T.desert + 1.0), 26);
        u.uCloudSea.value.set(0.8, 1200, 175, k === 'S07/SH02' ? win(t, 36.7, 37.2) : 0.35);
        u.uDesertGround.value = 0.7 * win(t, T.desert - 1.0, T.desert + 1.2);
        u.uCloudShift.value = 0.0;
        break;
      }
      case 'S09/SH01': {
        near = 2; far = 6000; u.uCloudSea.value.set(0.85, 760, 175, 0);
        const c = 0.06 + 0.94 * ease((t - 47.7) / 3.5);
        p.collapse = c; p.uniforms.uCrack.value = 0.9 * (1 - win(t, 48.2, 50.6)); p.uniforms.uCrackFront.value = 32;
        break;
      }
    }
    this.setClip(near, far);
    this.stars.points.scale.setScalar(far * 0.8); this.stars.brightness = starB; this.stars.points.visible = starB > 0.01; this.stars.follow(this.camera);
    this.meteors.update(t, this.camera);
    this.syncSky(t);
  }
  /** Peak height (km) after growth and collapse. */
  peakHeight(): number { const c = this.peak.uniforms.uCollapse.value as number; return Math.max(0, 100 * (this.peak.uniforms.uGrow.value as number) * (1 - 0.9 * c) - 4 * c); }
  anchors(t: number, shot: ShotInfo): Anchor[] {
    const p = this.peak, top = () => p.surfacePoint(0, 0, 0, p.uniforms.uGrow.value as number, p.uniforms.uCollapse.value as number);
    switch (shot.key) {
      case 'S02/SH01': return t > 6.3 ? [{ world: top(), label: '100 KM', value: 'EDGE OF SPACE', accent: '#38BDF8', dx: 80, dy: -90, alpha: win(t, 6.3, 6.6) }] : [];
      case 'S06/SH01': return [{ world: top(), label: 'KÁRMÁN LINE', value: '100 KM', accent: '#38BDF8', dx: 90, dy: -110, alpha: win(t, 28.5, 28.8) }];
      case 'S06/SH02': {
        // Point on the camera-facing flank (azimuth th from +x toward +z) where the surface crosses `alt` km.
        const at = (alt: number, th: number) => {
          let lo = 0, hi = 200;
          for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (p.heightPolar(mid, th) > alt) lo = mid; else hi = mid; }
          const r = (lo + hi) / 2; return p.surfacePoint(r * Math.cos(th), r * Math.sin(th), 0.2);
        };
        return [
          { world: at(8, Math.PI / 2 + 0.22), label: 'DEATH ZONE', value: '8 KM', accent: '#EF4444', dx: -70, dy: 40, alpha: win(t, 30.2, 30.45) },
          { world: at(19, Math.PI / 2 - 0.22), label: 'ARMSTRONG LIMIT', value: '19 KM', accent: '#F97316', dx: 70, dy: 30, alpha: win(t, 30.7, 30.95) },
          { world: top(), label: 'SPACE', value: '100 KM', accent: '#38BDF8', dx: 80, dy: -60, alpha: win(t, 31.2, 31.45) },
        ];
      }
      case 'S07/SH02': return [
        { world: V(-260, 5, 30), label: 'STORMS', value: 'WINDWARD', accent: '#38BDF8', dx: -60, dy: -80, alpha: win(t, 37.0, 37.3) },
        { world: V(420, 0, 20), label: 'DESERT', value: 'RAIN SHADOW', accent: '#F59E0B', dx: 40, dy: 90, alpha: win(t, 39.2, 39.5) },
      ];
      default: return [];
    }
  }
  hudLine(t: number, shot: ShotInfo): string | undefined {
    switch (shot.key) {
      case 'S05/SH01': case 'S05/SH02': case 'S06/SH01': return `AIR PRESSURE ${fmtAtm(standardPressureAtm(Math.max(this.camAlt, 0)))}`;
      case 'S09/SH01': return `PEAK HEIGHT ${Math.round(this.peakHeight())} KM`;
      case 'S07/SH01': return 'WEATHER CEILING ≈ 11 KM';
      default: return undefined;
    }
  }
}

export function fmtAtm(p: number): string {
  if (p >= 0.1) return `${p.toFixed(2)} ATM`;
  if (p >= 0.001) return `${p.toFixed(3)} ATM`;
  const e = Math.floor(Math.log10(p)), m = p / Math.pow(10, e);
  return `${m.toFixed(1)}×10^{${e}} ATM`;
}
