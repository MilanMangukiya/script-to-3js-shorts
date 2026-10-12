import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { CloudDeck } from '../../../library/environment/CloudDeck';
import { Airliner } from '../../../library/vehicles/Airliner';
import { ramp, smoothstep, wobble } from '../../../library/util/math';
import { T } from '../timeline';

/** Illustrative scene airspeed in m/s: slower than a real cruise so the growing contrail gap stays in frame. */
const AIRSPEED = 45;

/** Air-to-air view of an airliner above a cloud deck at golden hour (metres); S06. */
export class AirlinerStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 9 / 16, 1, 250000);
  private plane: Airliner; private clouds: CloudDeck;
  readonly planeWorld = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene;
    const sunDir = new THREE.Vector3(0.55, 0.17, -0.82).normalize();
    const sky = new SkyDome({ zenithColor: 0x1d3f7c, horizonColor: 0xf2bd8e, groundColor: 0x6f7f9a, hazeColor: 0xffcb92, hazeAmount: 0.6, sunDirection: sunDir, sunColor: 0xffd6a2, sunIntensity: 34, sunGlow: 0.9, curve: 0.5 });
    s.add(sky.mesh);
    s.environment = sky.toEnvironment(renderer); s.environmentIntensity = 0.85;
    this.clouds = new CloudDeck({ level: -1500, scale: 2500, coverage: 0.6, sunDirection: sunDir, sunColor: 0xffdcb4, shadowColor: 0x54688f, belowColor: 0x1b3554, hazeColor: 0xecc29a, hazeDensity: 0.000038 });
    s.add(this.clouds.mesh);
    const sun = new THREE.DirectionalLight(0xffd8ad, 3.6); sun.position.copy(sunDir).multiplyScalar(500);
    s.add(sun, new THREE.HemisphereLight(0x9fbaea, 0xd8ae86, 1.05));
    this.plane = new Airliner({ length: 38, accentColor: 0x2f9c98, contrailLength: 900 });
    s.add(this.plane.group, this.plane.contrailGroup);
  }

  update(t: number, shot: ShotInfo) {
    const g = this.plane.group;
    // About 23% less lift: the aircraft settles roughly 12 m, nose slightly down, then eases its descent.
    const sag = smoothstep(T.sagStart, T.sagEnd + 0.4, t);
    const sink = -12 * Math.pow(sag, 1.25);
    g.position.set(0.25 * wobble(t * 0.9, 1), sink + 0.15 * wobble(t * 1.3, 2), 0);
    const pitch = -0.045 * Math.sin(sag * Math.PI) + 0.012 * smoothstep(0.75, 1, sag);
    g.rotation.set(pitch, 0, 0.012 * wobble(t * 0.7, 3) + 0.02 * Math.sin(sag * Math.PI));
    g.getWorldPosition(this.planeWorld);
    this.plane.update(t, { engineGlow: 1 - ramp(t, T.engineOut, T.engineOut + 0.3), airspeed: AIRSPEED, cutStart: T.engineOut, cutEnd: Infinity });
    this.clouds.update(t, 0, -AIRSPEED * 4.5 * t); // cloud tops far below slide past faster than the near-field trail gap
  }
}
