import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import type { EarthTextures } from '../../../library/planet/Earth';
import { PlanetCutaway } from '../../../library/planet/PlanetCutaway';
import { MagneticFieldLines } from '../../../library/space/MagneticFieldLines';
import { Starfield } from '../../../library/space/Starfield';
import { smoothstep } from '../../../library/util/math';
import { Base, frac, type Timing } from './common';

/** Space: Earth with a quarter wedge cut to the centre (facing the camera side), its core states and the dipole field. */
export class CoreStage extends Base {
  cut: PlanetCutaway;
  field = new MagneticFieldLines({ radius: 1, shells: [1.5, 2.05, 2.8, 3.8], linesPerShell: 8, thickness: 0.0065, color: 0x7fe3ff, seed: 8 });
  stars = new Starfield({ count: 2600, radius: 400, brightness: 0.3 });

  constructor(private T: Timing, tex: EarthTextures, private duration: number) {
    super();
    this.scene.background = new THREE.Color(0x01040a);
    this.camera.near = 0.03; this.camera.far = 800;
    this.cut = new PlanetCutaway({ radius: 1, surface: tex.day, atmosphereStrength: 0.9 });
    this.scene.add(this.cut.group, this.field.group, this.stars.points);
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t);
    let solid = 0, field = 0, flow = 0, pulse = 0;
    switch (shot.key) {
      case 'S01/SH01': solid = smoothstep(0.3, 0.95, u); field = 1 - smoothstep(0.35, 0.95, u); break;
      case 'S03/SH01': field = smoothstep(0.02, 0.4, u) * (1 - smoothstep(0.55, 0.95, u)); solid = smoothstep(0.55, 0.9, u); break;
      case 'S06/SH02': solid = 1; flow = smoothstep(0, 0.15, u); break;
      case 'S07/SH01': field = smoothstep(0.35, 0.85, u); pulse = smoothstep(0, 0.1, u) * (1 - smoothstep(0.45, 0.6, u)) * (0.65 + 0.35 * Math.sin(t * 4)); break;
    }
    // Key light from behind the camera, upper right: the surface shell stays lit around the cut.
    const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
    this.camera.getWorldDirection(fwd); right.crossVectors(fwd, this.camera.up).normalize(); up.crossVectors(right, fwd).normalize();
    this.cut.sunDirection = right.multiplyScalar(0.62).add(up.multiplyScalar(0.42)).add(fwd.multiplyScalar(-0.66)).normalize();
    this.cut.outerCoreSolid = solid; this.cut.mantleFlow = flow; this.cut.innerEdgePulse = pulse;
    this.field.strength = field;
    // The surface turns slowly out and back so the first and last frames match (the turn reverses mid-film, off screen).
    this.cut.spin = 0.05 * (t < this.duration / 2 ? t : this.duration - t);
    this.cut.update(t); this.field.update(t);
    this.stars.follow(this.camera);
  }
}
