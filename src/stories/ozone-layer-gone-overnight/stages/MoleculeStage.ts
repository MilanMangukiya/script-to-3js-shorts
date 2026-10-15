import * as THREE from 'three';
import { Starfield } from '../../../library/space/Starfield';
import { rng } from '../../../library/util/math';
import type { ShotInfo, Stage } from '../../../library/render/FilmPipeline';
import { T } from '../timeline';

/**
 * Directed scale change into the stratosphere (about 30 km): UV photons from the sun direction split O2 into atoms;
 * each freed atom joins a nearby O2 to make bent O3 (Chapman mechanism). Three scripted events near frame centre,
 * background N2/O2 drifting; every position is a pure function of absolute time.
 */
const R_ATOM = .12, BOND = .24;
const SUN = new THREE.Vector3(-.55, .62, .56).normalize();     // photons travel along -SUN
interface Mol { a: THREE.Mesh; b: THREE.Mesh; base: THREE.Vector3; axis: THREE.Vector3; ph: number }
interface Event { at: number; split: Mol; partners: [Mol, Mol]; extra: [THREE.Mesh, THREE.Mesh]; flash: THREE.Mesh[]; photon: THREE.Mesh }

export class MoleculeStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 9 / 16, .02, 1000);
  private mols: Mol[] = [];
  private events: Event[] = [];
  private streaks: { mesh: THREE.Mesh; offset: THREE.Vector3; ph: number }[] = [];
  private oMat = new THREE.MeshStandardMaterial({ color: 0xd8473c, roughness: .32, metalness: .05 });
  private nMat = new THREE.MeshStandardMaterial({ color: 0x9db4c8, roughness: .4, metalness: .05 });
  private o3Mat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: .3, metalness: .05, emissive: 0x4c1d95, emissiveIntensity: .35 });

  constructor() {
    this.scene.background = new THREE.Color(0x060a1c);
    this.scene.add(new Starfield({ seed: 5, count: 1200, radius: 300, maxSize: 3 }).points);
    this.scene.add(new THREE.HemisphereLight(0x6f86ff, 0x0a0d1a, .55));
    const key = new THREE.DirectionalLight(0xf1edff, 2.6); key.position.copy(SUN).multiplyScalar(10); this.scene.add(key);
    const sphere = new THREE.SphereGeometry(R_ATOM, 24, 16), r = rng(808);
    const mol = (base: THREE.Vector3, mat: THREE.Material): Mol => {
      const a = new THREE.Mesh(sphere, mat), b = new THREE.Mesh(sphere, mat); this.scene.add(a, b);
      const axis = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize();
      return { a, b, base, axis, ph: r() * 6.28 };
    };
    // Scripted events: an O2 splits, its two atoms each join a neighbouring O2.
    const centres = [new THREE.Vector3(-.35, .55, 0), new THREE.Vector3(.45, -.2, .25), new THREE.Vector3(-.15, -.95, -.1)];
    T.splits.forEach((at, k) => {
      const c = centres[k], split = mol(c.clone(), this.oMat);
      const pa = mol(c.clone().add(new THREE.Vector3(-.78, .22, .1)), this.oMat), pb = mol(c.clone().add(new THREE.Vector3(.74, -.3, -.12)), this.oMat);
      const extra: [THREE.Mesh, THREE.Mesh] = [new THREE.Mesh(sphere, this.oMat), new THREE.Mesh(sphere, this.oMat)];
      this.scene.add(...extra);
      const flash = [0, 1, 2].map(() => { const f = new THREE.Mesh(new THREE.SphereGeometry(.35, 16, 12), new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); this.scene.add(f); return f; });
      const photon = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1.4, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 4.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      photon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN); this.scene.add(photon);
      this.events.push({ at, split, partners: [pa, pb], extra, flash, photon });
      this.mols.push(split, pa, pb);
    });
    // Background air: about four N2 for every O2, kept clear of the event centres.
    for (let i = 0; i < 60; i++) {
      const p = new THREE.Vector3((r() - .5) * 4.4, (r() - .5) * 6.4, -r() * 3.5 + .8);
      if (centres.some(c => c.distanceTo(p) < 1.15)) continue;
      this.mols.push(mol(p, r() < .22 ? this.oMat : this.nMat));
    }
    // Passing UV photons that are not absorbed in view.
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1.1, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, .8, 2.8), transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN); this.scene.add(m);
      this.streaks.push({ mesh: m, offset: new THREE.Vector3((r() - .5) * 4, (r() - .5) * 5, -r() * 2.5), ph: r() });
    }
  }

  /** Position of a molecule's atoms at time t (gentle drift and tumble). */
  private pose(m: Mol, t: number, calm = 1) {
    const c = m.base.clone().add(new THREE.Vector3(Math.sin(t * .4 + m.ph) * .06, Math.cos(t * .33 + m.ph) * .06, Math.sin(t * .27 + m.ph * 2) * .05).multiplyScalar(calm));
    const dir = new THREE.Vector3(1, 0, 0).applyAxisAngle(m.axis, m.ph + t * .35 * calm);
    return { c, a: c.clone().addScaledVector(dir, -BOND / 2), b: c.clone().addScaledVector(dir, BOND / 2), dir };
  }

  update(t: number, _shot: ShotInfo) {
    for (const m of this.mols) { const p = this.pose(m, t); m.a.position.copy(p.a); m.b.position.copy(p.b); m.a.visible = m.b.visible = true; }
    for (const e of this.events) {
      const target = this.pose(e.split, e.at);
      // Photon arrives along -SUN and is absorbed at the split moment.
      const pu = (t - (e.at - .5)) / .5;
      (e.photon.material as THREE.MeshBasicMaterial).opacity = pu > 0 && pu < 1 ? 1 : 0;
      e.photon.position.copy(target.c).addScaledVector(SUN, (1 - Math.min(1, Math.max(0, pu))) * 3 + .7);
      const s = (t - e.at) / T.bindDelay;
      e.extra.forEach((x, j) => {
        const partner = e.partners[j], pp = this.pose(partner, t);
        // Docking site: 117 degree bend off the partner's nearer atom.
        const near = j === 0 ? pp.b : pp.a, far = j === 0 ? pp.a : pp.b;
        const bond = near.clone().sub(far).normalize(), perp = new THREE.Vector3().crossVectors(bond, new THREE.Vector3(0, 0, 1)).normalize();
        const dock = near.clone().addScaledVector(bond.clone().multiplyScalar(Math.cos(Math.PI - 2.04)).addScaledVector(perp, Math.sin(Math.PI - 2.04)).normalize(), BOND);
        const from = j === 0 ? target.a : target.b, u = Math.min(1, Math.max(0, s)), k = 1 - (1 - u) ** 3;
        const lag = j === 1 ? .12 / T.bindDelay : 0, k2 = Math.min(1, Math.max(0, (s - lag) / (1 - lag))), kk = j === 1 ? 1 - (1 - k2) ** 3 : k;
        x.position.copy(from).lerp(dock, kk);
        x.visible = t >= e.at;
        // A free oxygen atom stays red; once bound, all three atoms read as ozone.
        const bound = s >= 1 + lag;
        partner.a.material = partner.b.material = x.material = bound ? this.o3Mat : this.oMat;
      });
      e.split.a.visible = e.split.b.visible = t < e.at;
      const fl = (f: THREE.Mesh, at: number, where: THREE.Vector3) => { const v = (t - at) / .35; (f.material as THREE.MeshBasicMaterial).opacity = v > 0 && v < 1 ? .55 * (1 - v) : 0; f.position.copy(where); f.scale.setScalar(.5 + v); };
      fl(e.flash[0], e.at, target.c);
      fl(e.flash[1], e.at + T.bindDelay, e.extra[0].position);
      fl(e.flash[2], e.at + T.bindDelay + .12, e.extra[1].position);
    }
    for (const s of this.streaks) {
      const u = ((t * .9 + s.ph) % 1);
      s.mesh.position.copy(s.offset).addScaledVector(SUN, 3.2 - 6.4 * u);
    }
  }

  /** Number of ozone molecules formed in view by time t (two per split). */
  static ozoneCount(t: number) { return T.splits.reduce((n, at) => n + (t >= at + T.bindDelay ? 1 : 0) + (t >= at + T.bindDelay + .12 ? 1 : 0), 0); }
}
