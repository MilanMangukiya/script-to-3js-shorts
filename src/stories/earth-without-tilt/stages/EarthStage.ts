import * as THREE from 'three';
import { type Stage, type ShotInfo } from '../../../library/render/FilmPipeline';
import { Earth, type EarthTextures } from '../../../library/planet/Earth';
import { Starfield } from '../../../library/space/Starfield';
import { solid, rod } from '../../../library/util/Modeling';
import { ramp, DEG } from '../timeline';

const marker = (color: number) => new THREE.MeshBasicMaterial({ color });

/** World +Y is the orbital normal, with genuine zero obliquity and an unchanged mildly eccentric orbit. */
export class EarthStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 9 / 16, .02, 300);
  readonly earth: Earth;
  readonly carrier = new THREE.Group();
  readonly orbit = new THREE.Group();
  readonly northPin = new THREE.Group();
  readonly southPin = new THREE.Group();
  private stars = new Starfield({ seed: 96, count: 1400, radius: 70, brightness: .36 });
  private axis: THREE.Mesh;
  private sun: THREE.Mesh;
  private rays: THREE.Line[] = [];
  private seasonalRays: THREE.Line[] = [];
  private incident: THREE.IUniform;
  private equator: THREE.Line;
  private meridian: THREE.Line;
  private readonly a = 1.47;
  readonly eccentricity = .0167;
  solarFlux = 100;

  constructor(textures: EarthTextures) {
    this.earth = new Earth(textures, { radius: 1.2, segments: 128, sunDirection: new THREE.Vector3(1, 0, 0), atmosphereStrength: .6, cloudOpacity: .35, nightLights: 1.6 });
    // Film-local illumination scalar; preserve the shared asset and keep city lights independent of sunlight.
    const globeMaterial = this.earth.globe.material as THREE.ShaderMaterial;
    this.incident = globeMaterial.uniforms.uIncidentFlux = { value: 1 };
    globeMaterial.fragmentShader = 'uniform float uIncidentFlux;\n' + globeMaterial.fragmentShader.replace(
      'vec3 col = mix(nightCol, dayCol, day);', 'vec3 col = mix(nightCol, dayCol * uIncidentFlux, day);');
    this.earth.setView(30, 0); this.earth.spinRate = .72; this.earth.cloudDrift = .0005;
    this.carrier.add(this.earth.group); this.scene.add(this.carrier, this.stars.points, this.orbit);
    this.axis = rod(this.carrier, [0, -1.58, 0], [0, 1.58, 0], .012, marker(0x7fc5db), 10);
    for (const y of [-1.58, 1.58]) solid(this.carrier, new THREE.SphereGeometry(.035, 16, 10), marker(0xc5efff), [0, y, 0]);
    const ring = (points: THREE.Vector3[], color: number, parent: THREE.Group) => {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .72 }));
      parent.add(line); return line;
    };
    const pts = Array.from({ length: 129 }, (_, i) => { const a = i / 128 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 1.205, 0, Math.sin(a) * 1.205); });
    this.equator = ring(pts, 0xf8cc75, this.carrier);
    this.meridian = ring(pts.map(p => new THREE.Vector3(p.x, p.z, 0)), 0x86d8e2, this.carrier);
    for (const [g, latitude, c] of [[this.northPin, 45, 0xffc35e], [this.southPin, -45, 0x6bd7ea]] as const) {
      const phi = latitude * DEG, n = new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0);
      rod(g, n.clone().multiplyScalar(1.22), n.clone().multiplyScalar(1.36), .018, marker(c), 10);
      solid(g, new THREE.SphereGeometry(.06, 16, 12), marker(c), n.clone().multiplyScalar(1.39).toArray() as [number, number, number]);
      this.carrier.add(g);
    }
    const e = this.eccentricity, b = this.a * Math.sqrt(1 - e * e);
    ring(Array.from({ length: 257 }, (_, i) => {
      const E = i / 256 * Math.PI * 2; return new THREE.Vector3(this.a * (Math.cos(E) - e), 0, b * Math.sin(E));
    }), 0x7497af, this.orbit);
    this.sun = solid(this.orbit, new THREE.SphereGeometry(.145, 40, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.5, .5) }));
    const sunLight = new THREE.PointLight(0xffe4b5, .6, 10); this.orbit.add(sunLight);
    for (let i = -2; i <= 2; i++) {
      const z = i * .23, line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(2.1, .35, z), new THREE.Vector3(1.22, .35, z),
      ]), new THREE.LineBasicMaterial({ color: 0xffd58d, transparent: true, opacity: .35 }));
      this.scene.add(line); this.rays.push(line);
    }
    for (const side of [-1, 1]) {
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0xffd58d, transparent: true, opacity: .5 }));
      ray.userData.hemisphere = side; this.scene.add(ray); this.seasonalRays.push(ray);
    }
  }
  update(t: number, shot: ShotInfo) {
    const orbital = shot.sceneId === 'S07', searching = shot.sceneId === 'S04';
    this.orbit.visible = orbital;
    this.carrier.scale.setScalar(orbital ? .23 : 1);
    this.carrier.rotation.set(0, 0, 0); // Explicit obliquity carrier: never use geographic setView latitude for tilt.
    this.carrier.position.set(0, 0, 0);
    this.earth.setView(30, 0); this.earth.update(t);
    this.earth.sunDirection = new THREE.Vector3(1, 0, 0);
    this.northPin.visible = this.southPin.visible = searching;
    if (searching) {
      const q = ramp(t, 18.4, 20.5);
      this.northPin.scale.setScalar(1 - .65 * q);
      this.southPin.scale.setScalar(.35 + .65 * q);
    } else { this.northPin.scale.setScalar(1); this.southPin.scale.setScalar(1); }
    this.equator.visible = !orbital;
    this.meridian.visible = searching;
    this.rays.forEach(ray => { ray.visible = !orbital; });
    this.solarFlux = 100;
    this.incident.value = 1; this.earth.scatter = 1;
    this.seasonalRays.forEach(ray => { ray.visible = orbital; });
    if (orbital) {
      const E = Math.PI * (1 - ramp(t, 35.5, 40.0)), e = this.eccentricity;
      const x = this.a * (Math.cos(E) - e), z = this.a * Math.sqrt(1 - e * e) * Math.sin(E);
      this.carrier.position.set(x, 0, z);
      this.earth.sunDirection = this.carrier.position.clone().negate().normalize();
      const r = this.carrier.position.length() / this.a;
      this.solarFlux = 100 * ((1 + e) / r) ** 2;
      this.incident.value = this.solarFlux / 100; this.earth.scatter = this.solarFlux / 100;
      const towardSun = this.carrier.position.clone().negate().normalize();
      for (const ray of this.seasonalRays) {
        const target = this.carrier.position.clone().addScaledVector(towardSun, .195)
          .add(new THREE.Vector3(0, ray.userData.hemisphere * .195, 0));
        const source = target.clone().addScaledVector(towardSun, .60);
        const attr = ray.geometry.getAttribute('position') as THREE.BufferAttribute;
        attr.setXYZ(0, source.x, source.y, source.z); attr.setXYZ(1, target.x, target.y, target.z);
        attr.needsUpdate = true; ray.geometry.computeBoundingSphere();
        (ray.material as THREE.LineBasicMaterial).opacity = .5 * this.solarFlux / 100;
      }
      this.axis.visible = true;
    }
    this.stars.follow(this.camera);
  }
}
