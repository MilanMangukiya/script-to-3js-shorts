import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { SkyDome } from '../../../library/environment/SkyDome';
import { CloudCeiling } from '../../../library/environment/CloudCeiling';
import { GrassField } from '../../../library/environment/GrassField';
import { BroadleafTree } from '../../../library/environment/BroadleafTree';
import { Rain } from '../../../library/fx/Rain';
import { VillageHouses } from '../../../library/environment/VillageHouses';
import { PedestrianCrowd, makeUmbrella } from '../../../library/characters/PedestrianCrowd';
import { fbm2, rng, smoothstep } from '../../../library/util/math';
import { Base, frac, mat, mesh, type Timing } from './common';

const STORM = 0x59626b;
const LAND_Y = 0.35;
const shoreX = (z: number) => -3 + 1.2 * Math.sin(z * 0.12) + 0.8 * (fbm2(z * 0.05, 1.3, 4) - 0.5) * 4;
/** Seafront footpath strip (world x range) that the walkers follow. */
const PATH: [number, number] = [-0.1, 1.7];

/** A monsoon-lashed, crowded coast of the supercontinent: rough sea, low dark clouds, slanting rain, a lit seaside village, walkers under umbrellas, trees bending, a lightning flash. */
export class CoastStage extends Base {
  sea = new OceanSurface({ size: 4000, waveHeight: 1.4, waveScale: 0.8, deepColor: 0x1d3a3c, horizonColor: STORM, zenithColor: 0x3a4248, sunDirection: new THREE.Vector3(0, 0.3, -1), glitter: 0, fogColor: STORM, fogDensity: 0.0045 });
  sky = new SkyDome({ zenithColor: 0x2e3439, horizonColor: STORM, groundColor: 0x2b2f2d, hazeColor: 0x6b7378, hazeAmount: 0.4, sunIntensity: 0, sunGlow: 0 });
  clouds = new CloudCeiling({ altitude: 380, coverage: 1, scale: 420, darkColor: 0x2a2f35, lightColor: 0x5e666e, hazeColor: STORM, hazeDensity: 0.0011, sunGlow: 0 });
  rain = new Rain({ count: 32000, box: [30, 16, 30], fallSpeed: 8, wind: [-3.5, 0.6], streakLength: 0.6, width: 0.0026, opacity: 0.55, brightness: 1.15, far: 26, seed: 61 });
  grass = new GrassField({ area: [-2, 16, -34, 8], count: 32000, minHeight: 0.25, maxHeight: 0.62, width: 0.012, seed: 14, ground: () => LAND_Y, reject: (x, z) => x < shoreX(z) + 1.4 || (x > PATH[0] - 0.15 && x < PATH[1] + 0.15 && z > -36 && z < 16),
    baseColor: 0x2f4a22, tipColor: 0x6f8f43, dryColor: 0x5d6e38, sunDirection: new THREE.Vector3(-0.3, 0.9, 0.2), sunColor: 0x9aa6b0, skyColor: 0x8090a0, fogColor: STORM, fogDensity: 0.012 });
  trees: BroadleafTree[] = [];
  village: VillageHouses;
  // Three lanes of walkers on the shore path; each holds an umbrella in the right hand (two-bone IK onto the handle).
  walkers = new PedestrianCrowd({ seed: 5, count: 33, width: 64, depth: 1.6, speedRange: [0.9, 1.25], umbrellaCount: 0, childFraction: 0.1, dissolve: false });
  private umbrellas: THREE.Group[] = [];
  private hemi = new THREE.HemisphereLight(0x8090a0, 0x2b2f2d, 0.9);
  private key = new THREE.DirectionalLight(0xb0c0d0, 0.45);

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.camera.far = 6000;
    this.scene.add(this.sky.mesh, this.clouds.mesh, this.sea.mesh, this.grass.mesh, this.rain.mesh, this.hemi, this.key);
    this.scene.environment = this.sky.toEnvironment(renderer, 0.05);
    this.scene.fog = new THREE.FogExp2(STORM, 0.012);
    this.key.position.set(-10, 20, 8);
    // Land: a wet green-brown shelf above the sea with a darker sandy beach along its edge.
    const land = new THREE.PlaneGeometry(80, 140, 160, 280).rotateX(-Math.PI / 2), p = land.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 36, z = p.getZ(i) - 40, edge = shoreX(z); p.setXYZ(i, x, x < edge ? -0.6 : LAND_Y * smoothstep(edge, edge + 1.6, x) + 0.04 * fbm2(x * 0.4, z * 0.4, 2), z); }
    land.computeVertexNormals();
    this.scene.add(mesh(land, new THREE.MeshStandardMaterial({ color: 0x3b3a2a, roughness: 0.55, metalness: 0 })));
    [[3.4, -4, 8.5], [5, -9, 7.2], [3.0, -15, 9], [7.5, -2, 6.4], [4.2, -20, 8], [9, -13, 7.6]].forEach(([x, z, h], i) => {
      const tr = new BroadleafTree({ height: h, canopyWidth: h * 0.62, leafCount: 2200, seed: 31 + i, leafColor: 0x3f5b2e, trunkColor: 0x4a4034 });
      tr.position.set(x, LAND_Y, z); this.scene.add(tr); this.trees.push(tr);
    });
    // Wet earth footpath along the shore.
    this.scene.add(mesh(new THREE.PlaneGeometry(PATH[1] - PATH[0], 52).rotateX(-Math.PI / 2), mat(0x3a342b, 0.32, 0), [(PATH[0] + PATH[1]) / 2, LAND_Y + 0.015, -10]));
    // Two rows of houses along the coast, fronts facing the sea, windows lit against the storm.
    const r = rng(41), sites: [number, number, number][] = [];
    for (const z of [-26, -34, -42, -50, -58, -66, -75]) sites.push([shoreX(z) + 8 + r() * 1.2, z + (r() - 0.5) * 2, -Math.PI / 2 + (r() - 0.5) * 0.3]);
    for (const z of [-18, -29, -40, -51, -62, -73]) sites.push([shoreX(z) + 16 + r() * 2, z + (r() - 0.5) * 3, -Math.PI / 2 + (r() - 0.5) * 0.4]);
    this.village = new VillageHouses({ sites, ground: () => LAND_Y, seed: 12, stilts: 0.6, litFraction: 0.7 });
    this.scene.add(this.village.group);
    // People on the seafront path under umbrellas: the crowd walks along local x, turned to follow the shore.
    this.walkers.group.rotation.y = Math.PI / 2; this.walkers.group.position.set((PATH[0] + PATH[1]) / 2, LAND_Y, -18);   // path ends behind the camera and deep in the rain haze
    const cols = [0x2b4a6b, 0x8a2f2f, 0x4f6b3f, 0x24282d, 0x9a7a2e, 0x5d4a72, 0x2f6b6b];
    this.walkers.figures.forEach((fig, i) => { const um = makeUmbrella(cols[i % cols.length]); um.position.set(-0.13, 1.16, 0.16); fig.root.add(um); this.umbrellas.push(um); });
    this.scene.add(this.walkers.group);
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t);
    // Lightning: a bright double flicker around 45% of the shot.
    const f = Math.max(0, 1 - Math.abs(u - 0.45) / 0.012) * 1.0 + Math.max(0, 1 - Math.abs(u - 0.47) / 0.008) * 0.7;
    this.hemi.intensity = 0.9 + 5 * f; this.sky.scatter = 1 + 2.5 * f;
    (this.clouds.uniforms.uLight.value as THREE.Color).set(0x5e666e).multiplyScalar(1 + 3 * f);
    this.clouds.update(t, t * 9, t * 2);
    this.sea.update(t);
    const gust = 0.5 + 0.5 * Math.sin(t * 0.9);
    this.grass.update(t, { bend: 0.7 + 0.25 * gust, direction: new THREE.Vector2(-1, 0.15), gust: 0.6, gustSpeed: 6 });
    this.trees.forEach((tr, i) => { tr.rotation.z = 0.05 + 0.05 * gust + 0.025 * Math.sin(t * 2.3 + i * 1.7); tr.rotation.x = 0.015 * Math.sin(t * 1.9 + i); });
    this.rain.intensity = 1; this.rain.update(t, this.camera);
    // Walk on the shot's own clock so the seeded spacing holds (no one overlaps); hold each umbrella by its handle.
    this.walkers.update(t, { clock_s: t - this.T['S05/SH01'].start });
    const grip = new THREE.Vector3(), pole = new THREE.Vector3();
    this.walkers.figures.forEach((fig, i) => {
      const um = this.umbrellas[i]; um.rotation.set(0.1 + 0.05 * Math.sin(t * 2.1 + i), 0, 0.06 * Math.sin(t * 1.7 + i * 0.7));
      fig.root.updateMatrixWorld(true);
      grip.set(-0.13, 1.2, 0.16); fig.root.localToWorld(grip);
      pole.set(-1, -1, -0.3).transformDirection(fig.root.matrixWorld);
      fig.reachArm('R', grip, pole, 1);
    });
    this.village.glow = 1.6 + 0.6 * f;
  }
}
