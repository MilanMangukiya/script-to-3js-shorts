import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { RockyPlanet } from '../planet/RockyPlanet';
import { GasGiant } from '../planet/GasGiant';
import { PlanetaryRings } from '../planet/PlanetaryRings';
import { Moon } from '../planet/Moon';
import { Earth, type EarthTextures } from '../planet/Earth';
import { AsteroidField } from './Asteroids';

/**
 * solar-system-v1 — the Sun and its eight planets as a cinematic, compressed-scale system (units: arbitrary scene
 * units; orbital distances and radii are exaggerated for readability, periods follow Kepler's a^1.5 law).
 *  - `Sun`: animated granulation (cellular convection cells), limb darkening, drifting sunspot groups, a streaming
 *    corona and soft glow sprites, all HDR for bloom.
 *  - `SolarSystem`: Mercury, Venus, Earth (NASA textures when given, with its Moon), Mars, Jupiter (Great Red Spot),
 *    Saturn (rings), Uranus and Neptune, glowing orbit rings, an asteroid belt; every planet is lit from the Sun's
 *    true direction each frame. `planetWorld(name)` gives a body's position for camera targets.
 */
const SUN_VS = /* glsl */ `varying vec3 vN; varying vec3 vP; varying vec3 vObj; void main(){ vObj = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SUN_FS = /* glsl */ `uniform float uTime, uBright; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
  ${GLSL_NOISE}
  float cells(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec3 g = vec3(float(x), float(y), float(z)), o = vec3(hash31(i + g), hash31(i + g + 7.1), hash31(i + g + 3.3));
      float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return d2 - d1; }
  void main(){
    vec3 n = normalize(vObj), V = normalize(cameraPosition - vP); float mu = clamp(dot(normalize(vN), V), 0.0, 1.0);
    vec3 q = n * 18.0 + vec3(0.0, uTime * 0.05, 0.0) + (vec3(fbm3(n * 6.0), fbm3(n * 6.0 + 4.0), fbm3(n * 6.0 + 9.0)) - 0.5) * 1.6;   // warped, so cells are soft and irregular
    float gran = smoothstep(0.0, 0.55, cells(q)) * 0.6 + 0.25 * fbm3(n * 9.0 + uTime * 0.03) + 0.15 * fbm3(n * 2.5 - uTime * 0.01);   // bright cells, soft dark lanes, supergranulation
    float spots = smoothstep(0.73, 0.8, fbm3(n * 3.2 + vec3(uTime * 0.01, 0.0, 0.0))) * smoothstep(0.55, 0.2, abs(n.y));
    float limb = 0.35 + 0.65 * pow(mu, 0.55);
    vec3 col = mix(vec3(0.9, 0.3, 0.04), vec3(1.0, 0.72, 0.32), gran) * limb;
    col *= 1.0 - spots * 0.85;
    col += vec3(1.0, 0.5, 0.15) * pow(1.0 - mu, 3.0) * 0.6;
    gl_FragColor = vec4(col * uBright, 1.0);
  }`;
const CORONA_FS = /* glsl */ `uniform float uTime, uBright; varying vec2 vUv;
  ${GLSL_NOISE}
  void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
    float streams = 0.55 + 0.45 * fbm(vec2(a * 3.0, r * 2.0 - uTime * 0.05)) + 0.3 * fbm(vec2(a * 9.0, uTime * 0.03));
    float k = smoothstep(1.0, 0.3, r) * pow(max(0.0, 1.0 - (r - 0.3) / 0.7), 2.2) * streams, inner = exp(-pow((r - 0.3) / 0.05, 2.0)) * 0.6;
    gl_FragColor = vec4(vec3(1.0, 0.7, 0.4) * (k * 1.4 + inner) * uBright, 1.0); }`;
export class Sun {
  readonly group = new THREE.Group(); private u: Record<string, THREE.IUniform>; private cu: Record<string, THREE.IUniform>; private corona: THREE.Mesh;
  constructor(o: { radius?: number; brightness?: number } = {}) {
    const R = o.radius ?? 10;
    this.u = { uTime: { value: 0 }, uBright: { value: o.brightness ?? 0.95 } };   // modest HDR so the photosphere keeps its orange under tone mapping
    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SUN_VS, fragmentShader: SUN_FS, toneMapped: false })); this.group.add(body);
    this.cu = { uTime: { value: 0 }, uBright: { value: (o.brightness ?? 0.95) * 0.9 } };
    this.corona = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.4, R * 3.4), new THREE.ShaderMaterial({ uniforms: this.cu, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: CORONA_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.group.add(this.corona);
    const light = new THREE.PointLight(0xfff1dc, 3, 0, 0); this.group.add(light);
  }
  update(t: number, camera?: THREE.Camera) { this.u.uTime.value = t; this.cu.uTime.value = t; if (camera) this.corona.quaternion.copy(camera.quaternion); }
}

type Body = { name: string; group: THREE.Group; a: number; period: number; phase: number; spin: number; incl: number; setSun: (v: THREE.Vector3) => void; update: (t: number) => void; radius: number };
export interface SolarSystemOptions { scale?: number; earthTextures?: EarthTextures; timeScale?: number; seed?: number; orbits?: boolean; belt?: boolean }
export class SolarSystem {
  readonly group = new THREE.Group(); readonly sun: Sun; readonly bodies: Body[] = []; private belt?: AsteroidField; private orbitMats: THREE.LineBasicMaterial[] = []; private o: SolarSystemOptions;
  private tmp = new THREE.Vector3();
  constructor(o: SolarSystemOptions = {}) {
    this.o = o; const k = o.scale ?? 1;
    this.sun = new Sun({ radius: 10 * k }); this.group.add(this.sun.group);
    const add = (name: string, a: number, radius: number, period: number, obj: { group: THREE.Group }, setSun: (v: THREE.Vector3) => void, update: (t: number) => void, spin = 0.2, incl = 0) => {
      const g = new THREE.Group(); g.add(obj.group); this.group.add(g);
      this.bodies.push({ name, group: g, a: a * k, period, phase: (name.length * 1.7) % 6.28, spin, incl, setSun, update, radius: radius * k });
      if (o.orbits !== false) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 256; i++) { const u = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(u) * a * k, 0, Math.sin(u) * a * k)); }
        const m = new THREE.LineBasicMaterial({ color: 0x6f8fc8, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }); this.orbitMats.push(m);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m); line.rotation.x = incl; this.group.add(line); }
    };
    const rocky = (radius: number, palette: [number, number, number], craters: number, cap = 0, atmo?: number) => { const p = new RockyPlanet({ radius: radius * k, palette, craters, capSize: cap, atmosphereColor: atmo ?? 0xffffff, atmosphereStrength: atmo ? 0.6 : 0 }); return p; };
    const merc = rocky(1.2, [0x4a4744, 0x7a7570, 0xa8a29a], 0.9); add('mercury', 22, 1.2, 0.24, merc, (v) => (merc.sunDirection = v), () => {}, 0.05);
    const venus = new GasGiant({ radius: 2.1 * k, zoneColors: [0xf0d9a8, 0xe8cf98], beltColors: [0xdcc28a, 0xd6b97c], poleColor: 0xefdcb0, bands: 3, turbulence: 0.25, hazeColor: 0xffe8b0, hazeStrength: 0.8 });
    add('venus', 32, 2.1, 0.62, venus, (v) => (venus.sunDirection = v), (t) => venus.update(t, t * 0.02), 0.02);
    // Earth: textured globe when NASA textures are supplied, else a blue rocky stand-in; with its Moon.
    const eg = new THREE.Group(); let earthSun: (v: THREE.Vector3) => void = () => {}, earthUpd: (t: number) => void = () => {};
    if (o.earthTextures) { const e = new Earth(o.earthTextures, { radius: 2.3 * k, segments: 128 }); eg.add(e.group); earthSun = (v) => (e.sunDirection = v); earthUpd = (t) => e.update(t * 10); }
    else { const e = rocky(2.3, [0x1d4f8a, 0x3a7a4a, 0xd9e2e8], 0.05, 0.12, 0x6aa8ff); eg.add(e.group); earthSun = (v) => (e.sunDirection = v); }
    const moon = new Moon({ radius: 0.62 * k }); moon.group.position.set(5 * k, 0.6 * k, 0); eg.add(moon.group);
    add('earth', 44, 2.3, 1, { group: eg }, (v) => { earthSun(v); moon.sunDirection = v; }, (t) => { earthUpd(t); moon.update(t); moon.group.position.set(Math.cos(t * 0.6) * 5 * k, 0.6 * k, Math.sin(t * 0.6) * 5 * k); });
    const mars = rocky(1.6, [0x5a2a18, 0xa4532c, 0xd08a55], 0.5, 0.12, 0xffb08a); add('mars', 57, 1.6, 1.88, mars, (v) => (mars.sunDirection = v), () => {}, 0.25);
    const jup = new GasGiant({ radius: 6.5 * k, storms: [{ lat: -22, lon: 40, size: 9, color: 0xc0583a, strength: 0.9, spin: 1 }] }); add('jupiter', 92, 6.5, 11.9, jup, (v) => (jup.sunDirection = v), (t) => jup.update(t, t * 0.5), 0.5);
    const sat = new GasGiant({ radius: 5.4 * k, zoneColors: [0xe8d5a8, 0xdcc89a], beltColors: [0xc9a96e, 0xbfa070], poleColor: 0xb8b090, bands: 7, turbulence: 0.3 });
    const satG = new THREE.Group(); satG.add(sat.group); const rings = new PlanetaryRings({ innerRadius: 7 * k, outerRadius: 13 * k, planetRadius: 5.4 * k, tiltDeg: 26.7 }); satG.add(rings.group);
    add('saturn', 128, 5.4, 29.5, { group: satG }, (v) => { sat.sunDirection = v; (rings.material.uniforms.uSunDir.value as THREE.Vector3).copy(v); }, (t) => { sat.update(t, t * 0.45); rings.update(t); }, 0.45);
    const ura = new GasGiant({ radius: 3.6 * k, zoneColors: [0x9fe0e6, 0x95d8de], beltColors: [0x8fd0d8, 0x88c8d2], poleColor: 0xa8e6ea, bands: 4, turbulence: 0.1 }); ura.group.rotation.z = 1.7;
    add('uranus', 160, 3.6, 84, ura, (v) => (ura.sunDirection = v), (t) => ura.update(t, t * 0.3), 0.3);
    const nep = new GasGiant({ radius: 3.5 * k, zoneColors: [0x3f6fe0, 0x3a66d6], beltColors: [0x2f55c0, 0x2a4fb5], poleColor: 0x4a7ae8, bands: 5, turbulence: 0.35, storms: [{ lat: -20, lon: 120, size: 7, color: 0x1a2e7a, strength: 0.8 }] });
    add('neptune', 190, 3.5, 165, nep, (v) => (nep.sunDirection = v), (t) => nep.update(t, t * 0.3), 0.3);
    if (o.belt !== false) { this.belt = new AsteroidField({ count: 2600, inner: 68 * k, outer: 80 * k, thickness: 2.5 * k, minRadius: 0.05 * k, maxRadius: 0.55 * k, orbitSpeed: 0.03, seed: o.seed ?? 6 }); this.group.add(this.belt.group); }
    this.update(0);
  }
  /** Orbits at absolute time t (one Earth year = 60 s × timeScale⁻¹), spins, lighting from the Sun. */
  update(t: number, camera?: THREE.Camera) {
    const ts = this.o.timeScale ?? 1;
    this.sun.update(t, camera);
    for (const b of this.bodies) {
      const ang = b.phase + (t * ts / 60) * Math.PI * 2 / Math.pow(b.period, 0.55);   // visually compressed Kepler: outer worlds still move
      b.group.position.set(Math.cos(ang) * b.a, 0, Math.sin(ang) * b.a).applyAxisAngle(new THREE.Vector3(1, 0, 0), b.incl);
      b.setSun(this.tmp.copy(b.group.position).negate().normalize()); b.update(t);
    }
    this.belt?.update(t * ts);
  }
  planetWorld(name: string, out = new THREE.Vector3()) { const b = this.bodies.find((x) => x.name === name); return b ? b.group.getWorldPosition(out) : out.set(0, 0, 0); }
  radiusOf(name: string) { return this.bodies.find((x) => x.name === name)?.radius ?? 1; }
  set orbitOpacity(v: number) { for (const m of this.orbitMats) m.opacity = v; }
}
