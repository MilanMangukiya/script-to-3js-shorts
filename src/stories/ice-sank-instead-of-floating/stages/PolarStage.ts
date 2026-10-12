import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { SkyDome } from '../../../library/environment/SkyDome';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { SeaIce } from '../../../library/environment/SeaIce';
import { PenguinColony } from '../../../library/creatures/PenguinColony';
import { Snowfall } from '../../../library/fx/Snowfall';
import { smoothstep } from '../../../library/util/math';
import { T } from '../timeline';

/**
 * S07. SH01: orbital view of the Arctic (Earth radius = 1) whose floating sea ice fades out.
 * SH02/SH03: Antarctic fast ice with an emperor penguin colony (metres), then the same view with no floating ice.
 */
export class PolarStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.05, 60000);
  private orbit = new THREE.Group(); private edge = new THREE.Group();
  private earth: Earth; private stars: Starfield;
  private ocean: OceanSurface; private seaIce: SeaIce; private colony: PenguinColony; private snow: Snowfall;
  private fog = new THREE.FogExp2(0xdfe8f0, 0.0009); private env: THREE.Texture;

  constructor(renderer: THREE.WebGLRenderer, tex: EarthTextures) {
    const s = this.scene; s.add(this.orbit, this.edge);
    // ---- orbit
    this.earth = new Earth(tex, { radius: 1, sunDirection: new THREE.Vector3(0.7, 0.3, 0.65), atmosphereStrength: 0.9, cloudOpacity: 0.5 });
    this.earth.setView(-30, 74); this.earth.spinRate = 0.0025;
    this.stars = new Starfield({ seed: 23, count: 1800, radius: 900, brightness: 0.45, maxSize: 4 });
    this.orbit.add(this.earth.group, this.stars.points);
    // ---- ice edge
    const sunDir = new THREE.Vector3(0.42, 0.15, -0.9).normalize(), horizon = 0xe6edf4, zenith = 0x8aa6c6;
    const sky = new SkyDome({ zenithColor: zenith, horizonColor: horizon, groundColor: 0x9fb2c6, hazeColor: 0xf6f1e8, hazeAmount: 0.55, sunDirection: sunDir, sunColor: 0xfff1dc, sunIntensity: 7, sunGlow: 0.7, curve: 0.5 });
    this.env = sky.toEnvironment(renderer);
    this.ocean = new OceanSurface({ size: 40000, level: 0, deepColor: 0x0e2f44, horizonColor: horizon, zenithColor: zenith, sunDirection: sunDir, sunColor: 0xfff1dc, waveHeight: 0.42, waveScale: 0.5, fogColor: 0xdfe8f0, fogDensity: 0.0011, glitter: 0.35 });
    this.seaIce = new SeaIce({ seed: 14, floeCount: 80, area: [-230, 230, -440, -22], minRadius: 3, maxRadius: 24, thickness: 1.6, platformRadius: 14, iceberg: { position: new THREE.Vector3(-115, 0, -390), size: [260, 140], freeboard: 28 }, avoid: [[6.5, 16.5, 5]] });
    this.colony = new PenguinColony({ adults: 36, chicks: 12, seed: 21, spread: [6.5, 4.2], height: 1.15 });
    this.colony.group.position.set(-0.5, 0.26, -1.0);
    this.snow = new Snowfall({ count: 900, seed: 6, box: [34, 12, 34], fallSpeed: 1.1, drift: 0.7, size: 32, minPx: 1.5, maxPx: 6, brightness: 0.5, far: 28 });
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.3); sun.position.copy(sunDir).multiplyScalar(70); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 160 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.edge.add(sky.mesh, this.ocean.mesh, this.seaIce.group, this.colony.group, this.snow.points, sun, new THREE.HemisphereLight(0xcfe0f5, 0xa9bccf, 1.25));
  }

  update(t: number, shot: ShotInfo) {
    const inOrbit = shot.shotId === 'SH01', cam = this.camera;
    this.orbit.visible = inOrbit; this.edge.visible = !inOrbit;
    this.scene.background = inOrbit ? new THREE.Color(0x01030a) : null;
    this.scene.fog = inOrbit ? null : this.fog; this.scene.environment = inOrbit ? null : this.env; this.scene.environmentIntensity = 0.6;
    cam.near = inOrbit ? 0.05 : 0.3; cam.far = inOrbit ? 3000 : 60000; cam.updateProjectionMatrix();
    if (inOrbit) {
      this.earth.seaIce = 1 - smoothstep(T.seaIceOut, T.seaIceGone, t);
      this.earth.update(t); this.stars.follow(cam);
    } else {
      const whatIf = shot.shotId === 'SH03';
      this.seaIce.group.visible = !whatIf; this.colony.group.visible = !whatIf;
      this.seaIce.update(t, 0); this.colony.update(t); this.ocean.update(t);
      this.snow.points.position.set(cam.position.x, 0, cam.position.z - 12); this.snow.update(t);
    }
  }
}
