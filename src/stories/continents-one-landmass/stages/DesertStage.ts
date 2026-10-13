import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { DuneField } from '../../../library/environment/DuneField';
import { SkyDome } from '../../../library/environment/SkyDome';
import { GrassField } from '../../../library/environment/GrassField';
import { Starfield } from '../../../library/space/Starfield';
import { Humanoid, POSE_STAND } from '../../../library/characters/Humanoid';
import { DialGauge } from '../../../library/props/DialGauge';
import { fbm2, lerp, smoothstep } from '../../../library/util/math';
import { Base, frac, mat, mesh, type Timing } from './common';

const SUN = new THREE.Vector3(0.78, 0.42, -0.46).normalize();   // lowish side light gives the dunes relief
const DAY = { zenith: new THREE.Color(0x7aa9cf), horizon: new THREE.Color(0xf2e4cb), haze: new THREE.Color(0xf6d9ad), fog: new THREE.Color(0xe9d0ad), hemiSky: new THREE.Color(0xfff2df), hemiGround: new THREE.Color(0xb9764a), key: new THREE.Color(0xfff1d8) };
/** The traveller shot looks down a low corridor between the dunes (open horizon); walk and dial are laid out along it. */
const AISLE = new THREE.Vector3(30, 0, -60).normalize(), AISLE_RIGHT = new THREE.Vector3(-AISLE.z, 0, AISLE.x), AISLE_EYE = new THREE.Vector3(-1, 0, 3);
const NIGHT = { zenith: new THREE.Color(0x040a1a), horizon: new THREE.Color(0x18233d), haze: new THREE.Color(0x1d2944), fog: new THREE.Color(0x101a2e), hemiSky: new THREE.Color(0x2c3d60), hemiGround: new THREE.Color(0x0b0f17), key: new THREE.Color(0x8aa6e0) };

/** The supercontinent's dry heart: rust-red dunes, a lone traveller as day turns to a freezing night, a scorching thermometer. */
export class DesertStage extends Base {
  dunes = new DuneField({ size: 420, segments: 420, height: 14, wavelength: 90, windDeg: 35, flatRadius: 14, floor: -0.45, seed: 23, sandColor: 0xc8743c });
  sky = new SkyDome({ zenithColor: DAY.zenith, horizonColor: DAY.horizon, groundColor: 0x9a5a34, hazeColor: DAY.haze, hazeAmount: 0.55, sunDirection: SUN, sunColor: 0xfff3dc, sunIntensity: 10, sunGlow: 0.6, sunSize: 0.009, curve: 0.7 });
  stars = new Starfield({ count: 1800, radius: 400, brightness: 0, minY: 0.02 });
  tufts = new GrassField({ area: [-12, 12, -14, 6], count: 7000, minHeight: 0.05, maxHeight: 0.22, width: 0.007, seed: 5, reject: (x, z) => fbm2(x * 0.6, z * 0.6, 8) < 0.55, baseColor: 0x6b5a3a, tipColor: 0xa58f5f, dryColor: 0xb59a66, sunDirection: SUN, sunColor: 0xfff1d8, skyColor: 0xf2e4cb, fogColor: 0xe9d0ad, fogDensity: 0.004 });
  traveller = new Humanoid({ height: 1.75, coat: 'long', coatColor: 0x5b4632, trouserColor: 0x3a3128, hat: true, scarfColor: 0x8a5a3a });
  weather = new DialGauge({ radius: 0.16, min: 1, max: 11, arcDegrees: 240, majorStep: 1, minorStep: 0.5, labelStep: 1000, title: 'TEMPERATURE', depth: 0.04, bezel: 'steel',
    marks: [{ value: 2, color: '#5aa7ff', label: 'COLD' }, { value: 10, color: '#ff6a3d', label: 'HOT' }] });
  thermo = new DialGauge({ radius: 0.2, min: 0, max: 60, arcDegrees: 270, majorStep: 10, minorStep: 2, labelStep: 10, unit: '°C', title: 'TEMPERATURE', depth: 0.05, bezel: 'brass',
    marks: [{ value: 40, color: '#ff6a3d' }, { value: 50, color: '#d62e1f' }] });
  private weatherPost: THREE.Mesh; private thermoPost: THREE.Mesh;
  private hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, 1.25);
  private key = new THREE.DirectionalLight(DAY.key, 3.0);

  constructor(private T: Timing, renderer: THREE.WebGLRenderer) {
    super();
    this.camera.far = 3000;
    this.scene.add(this.sky.mesh, this.stars.points, this.dunes.mesh, this.tufts.mesh, this.traveller.root, this.hemi, this.key);
    this.scene.environment = this.sky.toEnvironment(renderer, 0.05);
    this.scene.fog = new THREE.FogExp2(DAY.fog, 0.0026);
    this.key.position.copy(SUN).multiplyScalar(40);
    const steel = mat(0x6f767c, 0.5, 0.8);
    const dial = AISLE_EYE.clone().addScaledVector(AISLE, 3.2).addScaledVector(AISLE_RIGHT, 0.3);
    this.weatherPost = mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.4, 12), steel, [dial.x, 0.7, dial.z - 0.04]);
    this.weather.group.position.set(dial.x, 1.55, dial.z); this.weather.group.rotation.y = Math.atan2(-AISLE.x, -AISLE.z);
    this.thermoPost = mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.0, 12), steel, [0, 0.5, -0.04]);
    this.thermo.group.position.set(0, 1.15, 0); this.thermo.group.rotation.y = Math.atan2(-AISLE.x, -AISLE.z);   // faces a camera looking down the corridor
    this.scene.add(this.weatherPost, this.weather.group, this.thermoPost, this.thermo.group);
  }

  update(t: number, shot: ShotInfo) {
    const u = frac(this.T, shot.key, t), walk = shot.key === 'S05/SH02', hot = shot.key === 'S08/SH02';
    this.traveller.root.visible = this.weather.group.visible = this.weatherPost.visible = this.tufts.mesh.visible = walk;
    this.thermo.group.visible = this.thermoPost.visible = hot;
    // Day → night time-lapse only for the traveller shot; the other shots stay in blazing day.
    const night = walk ? smoothstep(0.25, 0.85, u) : 0;
    const su = this.sky.uniforms;
    (su.uZenith.value as THREE.Color).copy(DAY.zenith).lerp(NIGHT.zenith, night);
    (su.uHorizon.value as THREE.Color).copy(DAY.horizon).lerp(NIGHT.horizon, night);
    (su.uHaze.value as THREE.Color).copy(DAY.haze).lerp(NIGHT.haze, night);
    su.uSunIntensity.value = 10 * (1 - smoothstep(0, 0.5, night)) * (hot ? 1.4 : 1); su.uSunGlow.value = (hot ? 0.9 : 0.6) * (1 - night);
    su.uHazeAmount.value = hot ? 0.8 : 0.55;
    const fog = this.scene.fog as THREE.FogExp2; fog.color.copy(DAY.fog).lerp(NIGHT.fog, night); fog.density = hot ? 0.0045 : 0.0026;
    this.scene.environmentIntensity = lerp(1, 0.08, night);   // the day-sky image lighting must fade too, or the sand glows at night
    this.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, night); this.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, night);
    this.hemi.intensity = lerp(1.25, 0.5, night); this.key.color.copy(DAY.key).lerp(NIGHT.key, night); this.key.intensity = lerp(hot ? 3.6 : 3.0, 0.22, night);
    this.stars.brightness = 0.4 * smoothstep(0.55, 1, night); this.stars.follow(this.camera);
    this.tufts.setLight(SUN, new THREE.Color(0xfff1d8).lerp(new THREE.Color(0x40507a), night), this.hemi.color, fog.color);
    this.tufts.update(t, { bend: 0.25, direction: new THREE.Vector2(1, 0.2), gust: 0.5, gustSpeed: 3 });
    if (walk) {
      const w = t - this.T['S05/SH02'].start, ph = w * Math.PI * 2 * 0.95, s = Math.sin(ph);
      const at = AISLE_EYE.clone().addScaledVector(AISLE, 6.0 + 0.85 * w).addScaledVector(AISLE_RIGHT, -0.45);   // walking away toward the horizon
      this.traveller.root.position.set(at.x, 0, at.z); this.traveller.root.rotation.y = Math.atan2(AISLE.x, AISLE.z);
      this.traveller.setPose({ ...POSE_STAND, hipsY: 0.92 - 0.018 * Math.abs(s), lean: 0.12, headPitch: 0.18, legL: [0.38 * s, 0.45 * Math.max(0, -s) + 0.05], legR: [-0.38 * s, 0.45 * Math.max(0, s) + 0.05],
        armL: [-0.32 * s, 0.08, 0.25], armR: [0.32 * s, 0.08, 0.25], breath: 0.01 * Math.sin(t * 1.4) });
      this.weather.value = lerp(9.6, 2.4, smoothstep(0.25, 0.85, u)) + 0.06 * Math.sin(t * 6.3);
    }
    if (hot) this.thermo.value = lerp(30, 48, smoothstep(0.1, 0.8, u)) + 0.25 * Math.sin(t * 5.1);
  }
}
