import * as THREE from 'three';
import { OrbitMap, ellipsePoint } from '../../../library/diagram/OrbitMap';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { GasGiant } from '../../../library/planet/GasGiant';
import { RockyPlanet } from '../../../library/planet/RockyPlanet';
import { Moon } from '../../../library/planet/Moon';
import { Starfield } from '../../../library/space/Starfield';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import ORB from '../orbits.json';
import { T, B, ease, windowAt } from '../timeline';

type Track = { t: number; e: [number, number]; m: [number, number]; r: [number, number] };
const TR = ORB.tracks as unknown as Track[];
/** Map orientation: rotate the ecliptic so the encounter point sits toward the top of the portrait frame. */
export const MAP_ROT = -0.35;
const MARS_LON0 = 5, MARS_RATE = 360 / 686.98;

function sample(t: number, key: 'e' | 'm' | 'r'): [number, number] {
  if (t <= TR[0].t) return TR[0][key];
  for (let i = 0; i < TR.length - 1; i++) {
    const a = TR[i], b = TR[i + 1];
    if (t <= b.t) { const u = (t - a.t) / (b.t - a.t); return [a[key][0] + (b[key][0] - a[key][0]) * u, a[key][1] + (b[key][1] - a[key][1]) * u]; }
  }
  return TR[TR.length - 1][key];
}

/** S08/SH02 and S09 — top-down orbit map of the pass at true AU geometry (markers enlarged). */
export class OrbitStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 9 / 16, 0.01, 2000);
  readonly map = new OrbitMap({ unitsPerAu: 1, sunRadius: 0.07 });
  private stars = new Starfield({ seed: 19, count: 5000, radius: 900, maxSize: 3.0, minY: -1 });
  private earth: Earth;
  private rogue = new GasGiant({ radius: 0.055, seed: 11, bands: 7, turbulence: 0.6, zoneColors: [0xe8e0cc, 0xc9d6df], beltColors: [0x667790, 0x9b6c55], segments: 48 });
  private mars = new RockyPlanet({ radius: 0.032, seed: 4 });
  private moon = new Moon({ radius: 0.018, seed: 31 });
  /** Overlay anchors in world space. */
  readonly anchors = { earth: new THREE.Vector3(), mars: new THREE.Vector3(), rogue: new THREE.Vector3(), moon: new THREE.Vector3(), aphelion: new THREE.Vector3(), marsOrbit: new THREE.Vector3(), moonOrbit: new THREE.Vector3() };

  constructor(tex: EarthTextures) {
    this.earth = new Earth(tex, { radius: 0.04, segments: 48 });
    this.map.group.rotation.y = MAP_ROT;
    this.scene.add(this.map.group, this.stars.points);
    const O = T.orbit;
    this.map.addEllipse('earthOld', O.earthOld[0], O.earthOld[1], O.earthOld[2], { color: 0x5fa8ff, radius: 0.004, intensity: 0.8, opacity: 0.55 });
    this.map.addEllipse('mars', O.mars[0], O.mars[1], O.mars[2], { color: 0xd8673f, radius: 0.0045, intensity: 1.0, opacity: 0.85 });
    const rogueRoute = TR.map((k) => k.r);
    this.map.addPath('rogue', rogueRoute, { color: 0xd9c8ff, radius: 0.0055, intensity: 1.5, segments: 900 });
    this.map.addEllipse('earthNew', O.earthNew[0], O.earthNew[1], O.earthNew[2], { color: 0x38e1ff, radius: 0.0065, intensity: 1.6, startLonDeg: 0 });
    const moonEsc = TR.filter((k) => k.t >= ORB.closest_t_d - 0.5).map((k) => k.m);
    this.map.addPath('moonPath', moonEsc, { color: 0xc8ccd4, radius: 0.0045, intensity: 1.4, segments: 500 });
    const mn = ORB.elements.moonNew;
    this.map.addEllipse('moonNew', mn.a_au, mn.e, mn.periLon_deg, { color: 0xb8bcc6, radius: 0.0035, intensity: 1.0, opacity: 0.7, startLonDeg: 10 });
    this.map.addBody('earth', this.earth.group);
    this.map.addBody('rogue', this.rogue.group);
    this.map.addBody('mars', this.mars.group);
    this.map.addBody('moon', this.moon.group);
  }

  /** Story day on the map for a film time. */
  private dayAt(t: number) {
    const s08 = T.cuts.s08, enc = s08 + 0.8;
    if (t < enc) return -60 + (ORB.closest_t_d + 60) * (t - s08) / (enc - s08);
    if (t < B[8]) return ORB.closest_t_d + (75 - ORB.closest_t_d) * ease((t - enc) / (B[8] - enc)) ;
    return 75 + 75 * (t - B[8]) / (B[9] - B[8]);
  }

  update(t: number, _shot: ShotInfo) {
    const m = this.map, s08 = T.cuts.s08, day = this.dayAt(t);
    m.update(t, this.camera);
    this.stars.follow(this.camera); this.stars.brightness = 0.9;
    m.setDraw('earthOld', 1); m.setDraw('mars', 1);
    // The rogue's path draws up to its current position.
    const ri = TR.findIndex((k) => k.t >= day), rf = (ri < 0 ? TR.length : ri) / TR.length;
    m.setDraw('rogue', rf); m.setGlow('rogue', 1);
    const enc = s08 + 0.8;
    m.setDraw('earthNew', windowAt(t, enc + 0.1, enc + 2.3));
    m.setDraw('moonPath', ease((day - ORB.closest_t_d) / 150));
    m.setDraw('moonNew', windowAt(t, enc + 1.6, enc + 3.6));
    // Highlights in the payoff: the Moon's new path, then Earth's new orbit.
    const moonHi = windowAt(t, 45.4, 45.9) - windowAt(t, 47.6, 48.3), earthHi = windowAt(t, 48.2, 48.7) - windowAt(t, 50.6, 51.4);
    m.setGlow('moonPath', 1 + 1.4 * moonHi); m.setGlow('moonNew', 1 + 1.6 * moonHi, 0.7 + 0.3 * moonHi);
    m.setGlow('earthNew', 1 + 0.9 * earthHi);
    m.setGlow('earthOld', 1, t > enc + 2.3 ? 0.35 : 0.55);
    // Bodies.
    const [ex, ey] = sample(day, 'e'), [rx, ry] = sample(day, 'r'), [mx, my] = sample(day, 'm');
    const mars = ellipsePoint(T.orbit.mars[0], T.orbit.mars[1], T.orbit.mars[2], MARS_LON0 + MARS_RATE * (day - ORB.closest_t_d));
    m.setBody('earth', ex, ey); m.setBody('rogue', rx, ry, Math.hypot(rx, ry) < 3.1); m.setBody('mars', mars[0], mars[1]);
    // The Moon sits beside Earth until it escapes; nudge it outward so the marker does not hide inside Earth's.
    const sepAu = Math.hypot(mx - ex, my - ey), push = day < ORB.closest_t_d + 2 ? 0 : 0.05 * Math.min(1, sepAu / 0.02);
    const dx = (mx - ex) / Math.max(1e-6, sepAu), dy = (my - ey) / Math.max(1e-6, sepAu);
    m.setBody('moon', mx + dx * push, my + dy * push, day > ORB.closest_t_d + 1);
    this.earth.update(t);
    this.rogue.update(t, t * 0.8);
    // Each body is lit from the Sun at the origin.
    const sunFrom = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).negate().normalize();
    this.map.group.updateMatrixWorld(true);
    this.earth.sunDirection = sunFrom(this.earth.group);
    this.rogue.sunDirection = sunFrom(this.rogue.group);
    this.mars.sunDirection = sunFrom(this.mars.group);
    this.moon.sunDirection = sunFrom(this.moon.group);
    this.earth.group.getWorldPosition(this.anchors.earth); this.rogue.group.getWorldPosition(this.anchors.rogue);
    this.mars.group.getWorldPosition(this.anchors.mars); this.moon.group.getWorldPosition(this.anchors.moon);
    const ap = ellipsePoint(T.orbit.earthNew[0], T.orbit.earthNew[1], T.orbit.earthNew[2], T.orbit.earthNew[2] + 180);
    this.anchors.aphelion.copy(m.toWorld(ap[0], ap[1])).applyMatrix4(this.map.group.matrixWorld);
    const mo = ellipsePoint(T.orbit.mars[0], T.orbit.mars[1], T.orbit.mars[2], 55);
    this.anchors.marsOrbit.copy(m.toWorld(mo[0], mo[1])).applyMatrix4(this.map.group.matrixWorld);
    const mn = ORB.elements.moonNew, mp = ellipsePoint(mn.a_au, mn.e, mn.periLon_deg, 200);
    this.anchors.moonOrbit.copy(m.toWorld(mp[0], mp[1])).applyMatrix4(this.map.group.matrixWorld);
  }
}
