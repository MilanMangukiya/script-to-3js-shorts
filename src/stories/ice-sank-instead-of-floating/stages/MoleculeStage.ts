import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { BokehField } from '../../../library/fx/BokehField';
import { WaterMolecules } from '../../../library/diagram/WaterMolecules';
import { smoothstep, lerp } from '../../../library/util/math';
import { T } from '../timeline';

/** Height of the lattice centre above the origin (camera keyframes look at the origin). */
export const LATTICE_Y = 2.1;
const LIQUID_SCALE = 0.971; // (1/1.09)^(1/3): the liquid needs about 9% less volume than the ice

/** Schematic water molecules freezing into an open hexagonal lattice (S02). Units: O–O bond lengths. */
export class MoleculeStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.5, 400);
  readonly molecules: WaterMolecules;
  private solid: THREE.LineSegments; private bokeh: BokehField;

  constructor() {
    const s = this.scene;
    s.add(new SkyDome({ zenithColor: 0x04102a, horizonColor: 0x0f3a5e, groundColor: 0x030816, hazeColor: 0x1d6f8f, hazeAmount: 0.25, sunIntensity: 0, sunGlow: 0, curve: 0.7 }).mesh);
    this.bokeh = new BokehField({ count: 26, seed: 11, center: new THREE.Vector3(0, 3, -60), extent: new THREE.Vector3(26, 22, 8), colors: [0x6fc3ff, 0x9fe6ee, 0xcfe6ff], size: 150, gain: 0.03 });
    s.add(this.bokeh.points);
    this.molecules = new WaterMolecules({ seed: 6, cells: 2, layers: 2, bond: 1, liquidScale: LIQUID_SCALE });
    this.molecules.group.position.y = LATTICE_Y;
    s.add(this.molecules.group);
    // Volume outlines: dashed = room the liquid needs, solid = room the growing crystal needs.
    const h = this.molecules.halfSize, box = new THREE.EdgesGeometry(new THREE.BoxGeometry(h.x * 2, h.y * 2, h.z * 2));
    const dashed = new THREE.LineSegments(box, new THREE.LineDashedMaterial({ color: 0x8fd0df, transparent: true, opacity: 0.55, dashSize: 0.22, gapSize: 0.16 }));
    dashed.computeLineDistances(); dashed.scale.setScalar(LIQUID_SCALE);
    this.solid = new THREE.LineSegments(box, new THREE.LineBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0 }));
    this.molecules.group.add(dashed, this.solid);
    const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(-5, 8, 10);
    s.add(key, new THREE.HemisphereLight(0x9fc8ff, 0x0a1830, 1.1));
  }

  /** 0 = liquid, 1 = fully frozen at film time t. */
  freezeAt(t: number) { return smoothstep(T.freezeStart, T.freezeEnd, t); }

  update(t: number, _shot: ShotInfo) {
    const f = this.freezeAt(t);
    this.molecules.update(t, f);
    this.solid.scale.setScalar(lerp(LIQUID_SCALE, 1, f));
    (this.solid.material as THREE.LineBasicMaterial).opacity = 0.85 * smoothstep(0.15, 0.6, f);
    this.bokeh.update(t);
  }
}
