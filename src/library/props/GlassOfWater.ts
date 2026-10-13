import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rng, lerp, clamp } from '../util/math';

export interface GlassOfWaterOptions {
  /** Outer radius at the rim and base, height, and water level, all in metres. */
  radius?: number; baseRadius?: number; height?: number; waterLevel?: number;
  cubes?: number; cubeSize?: number; seed?: number;
  waterTint?: THREE.ColorRepresentation;
}

/**
 * Tumbler of water with ice cubes for macro shots. The glass and water use physical transmission (refraction of
 * the opaque scene behind them); the cubes are frosted solids so they stay visible through both.
 * `update(time_s, sink)`: sink 0 = cubes float with about a tenth above the waterline (real ice),
 * 1 = cubes rest on the bottom (denser-than-water ice). Intermediate values animate the fall, staggered per cube.
 */
export class GlassOfWater {
  readonly group = new THREE.Group();
  private cubes: { mesh: THREE.Mesh; float: THREE.Vector3; rest: THREE.Vector3; rotF: THREE.Euler; rotR: THREE.Euler; delay: number; ph: number }[] = [];
  private bubbles: THREE.Points; private surface: THREE.Mesh;
  private water!: THREE.Mesh; private tint!: THREE.Mesh; private sheet!: THREE.Mesh; private rAt!: (y: number) => number;
  private floorY = 0; private topY = 0; private current = 0;
  /** Water level given at construction (metres above the glass base). See `setWaterLevel` to change it. */
  readonly waterLevel: number;

  constructor(o: GlassOfWaterOptions = {}) {
    const R = o.radius ?? 0.038, Rb = o.baseRadius ?? 0.033, H = o.height ?? 0.105, wl = (this.waterLevel = o.waterLevel ?? 0.084), r = rng(o.seed ?? 8);
    const wall = 0.0022, floor = 0.009;
    // Glass shell: outer wall up, over the rim, inner wall down to a thick base.
    const prof = [[0, 0], [Rb, 0], [R, H], [R - wall, H], [Rb - wall, floor], [0, floor]].map(([x, y]) => new THREE.Vector2(x, y));
    const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.004, ior: 1.5, envMapIntensity: 1.2, specularIntensity: 1, depthWrite: false }));
    glass.renderOrder = 3;
    const rAt = (y: number) => lerp(Rb, R, y / H) - wall - 0.0004;
    const waterGeo = new THREE.LatheGeometry([[0, floor + 0.0003], [rAt(floor), floor + 0.0003], [rAt(wl), wl], [0, wl]].map(([x, y]) => new THREE.Vector2(x, y)), 64);
    this.rAt = rAt; this.floorY = floor; this.topY = H - 0.002; this.current = wl;
    const water = this.water = new THREE.Mesh(waterGeo, new THREE.MeshPhysicalMaterial({ color: o.waterTint ?? 0xdff3ff, roughness: 0.0, transmission: 1, thickness: 0.05, ior: 1.33, attenuationColor: new THREE.Color(0x7fc4e2), attenuationDistance: 0.09, envMapIntensity: 0.9, depthWrite: false }));
    water.renderOrder = 2;
    // Bright meniscus ring so the waterline reads clearly.
    this.surface = new THREE.Mesh(new THREE.RingGeometry(rAt(wl) * 0.9, rAt(wl), 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    this.surface.position.y = wl + 0.0002; this.surface.renderOrder = 5;
    // Faint sheet across the whole surface so the waterline reads from the side.
    const sheet = this.sheet = new THREE.Mesh(new THREE.CircleGeometry(rAt(wl) * 0.9, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbfe6f5, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    sheet.position.y = wl + 0.0001; sheet.renderOrder = 5;
    // Transmission alone barely tints a small volume, so a faint blue body makes the water readable on any backdrop.
    const tint = this.tint = new THREE.Mesh(waterGeo, new THREE.MeshBasicMaterial({ color: 0x7fc6e6, transparent: true, opacity: 0.16, depthWrite: false })); tint.renderOrder = 4;
    this.group.add(water, glass, tint, this.surface, sheet);

    const n = o.cubes ?? 4, s = o.cubeSize ?? 0.021;
    const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xd6ecfa, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0x86bfe6, emissiveIntensity: 0.3, envMapIntensity: 1.3, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) });
    for (let i = 0; i < n; i++) {
      const size = s * (0.88 + r() * 0.24), m = new THREE.Mesh(new RoundedBoxGeometry(size, size * (0.85 + r() * 0.2), size, 4, size * 0.16), iceMat);
      const a = (i / n) * Math.PI * 2 + r() * 0.6, rad = rAt(wl) * 0.5 * (0.5 + r() * 0.5);
      // Floating: about 9% of the cube's height above the waterline.
      const float = new THREE.Vector3(Math.cos(a) * rad, wl - size * 0.41, Math.sin(a) * rad);
      const a2 = a + (r() - 0.5) * 1.2, rad2 = rAt(floor) * 0.55 * (0.4 + r() * 0.6);
      const rest = new THREE.Vector3(Math.cos(a2) * rad2, floor + size * 0.5 + (i === n - 1 ? size * 0.75 : 0), Math.sin(a2) * rad2);
      m.castShadow = true;
      this.cubes.push({ mesh: m, float, rest, rotF: new THREE.Euler((r() - 0.5) * 0.5, r() * 6.283, (r() - 0.5) * 0.5), rotR: new THREE.Euler((r() - 0.5) * 0.25, r() * 6.283, (r() - 0.5) * 0.25), delay: r() * 0.28, ph: r() * 6.283 });
      this.group.add(m);
    }
    // Small air bubbles shaken loose as cubes move (driven by `sink`).
    const nb = 70, bp = new Float32Array(nb * 3), bs = new Float32Array(nb * 2);
    for (let i = 0; i < nb; i++) { const a = r() * 6.283, rad = Math.sqrt(r()) * rAt(floor) * 0.85; bp.set([Math.cos(a) * rad, floor + r() * (wl - floor), Math.sin(a) * rad], i * 3); bs.set([r(), 0.6 + r() * 0.8], i * 2); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.setAttribute('aB', new THREE.BufferAttribute(bs, 2));
    this.bubbles = new THREE.Points(bg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uT: { value: -1 }, uTop: { value: wl }, uFloor: { value: floor } },
      vertexShader: `attribute vec2 aB; uniform float uT, uTop, uFloor; varying float vA;
        void main(){ vec3 p = position; float age = uT - aB.x*0.9; p.y = position.y + max(age, 0.0)*0.05*aB.y; p.x += sin(age*9.0 + aB.x*30.0)*0.0012;
          vA = step(0.0, age) * step(0.0, uT) * smoothstep(uTop, uTop - 0.008, p.y) * smoothstep(2.2, 0.8, age);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(1.4*aB.y/(-mv.z), 2.0, 9.0); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0, 0.7, d)*(0.35 + 0.65*smoothstep(0.4, 0.9, d))*vA; gl_FragColor = vec4(vec3(1.0), a*0.8); }`,
    }));
    this.bubbles.renderOrder = 4; this.bubbles.frustumCulled = false;
    this.group.add(this.bubbles);
  }

  /**
   * Change the water level (metres above the glass base) for a filling or draining glass: the water body is rebuilt
   * to the glass's taper and the meniscus follows. 0 (or anything at the floor) empties the glass.
   */
  setWaterLevel(level: number) {
    const wl = clamp(level, 0, this.topY);
    if (Math.abs(wl - this.current) < 1e-6) return;
    this.current = wl;
    const show = wl > this.floorY + 0.0008;
    for (const m of [this.water, this.tint, this.surface, this.sheet]) m.visible = show;
    (this.bubbles.material as THREE.ShaderMaterial).uniforms.uTop.value = wl;
    if (!show) return;
    const f = this.floorY, rAt = this.rAt;
    const geo = new THREE.LatheGeometry([[0, f + 0.0003], [rAt(f), f + 0.0003], [rAt(wl), wl], [0, wl]].map(([x, y]) => new THREE.Vector2(x, y)), 64);
    this.water.geometry.dispose(); this.water.geometry = geo; this.tint.geometry = geo;
    const k = rAt(wl) / rAt(this.waterLevel);
    this.surface.scale.set(k, 1, k); this.surface.position.y = wl + 0.0002;
    this.sheet.scale.set(k, 1, k); this.sheet.position.y = wl + 0.0001;
  }

  /**
   * @param sink 0..1 progress of the cubes from floating to resting on the bottom (per-cube stagger applied inside)
   * @param bubbleAge seconds since bubbles were released (negative hides them)
   */
  update(time_s: number, sink: number, bubbleAge = -1) {
    for (const c of this.cubes) {
      const u = clamp((sink * 1.28 - c.delay) / 1.0), e = u * u * (3 - 2 * u);
      // Slight overshoot/settle on arrival and a lazy bob while floating.
      const bob = Math.sin(time_s * 1.3 + c.ph) * 0.0009 * (1 - e), settle = Math.sin(clamp((u - 0.85) / 0.15) * Math.PI) * 0.0012;
      c.mesh.position.lerpVectors(c.float, c.rest, e); c.mesh.position.y += bob + settle;
      c.mesh.position.x += Math.sin(e * Math.PI) * Math.sin(c.ph) * 0.004;
      c.mesh.rotation.set(lerp(c.rotF.x, c.rotR.x, e) + Math.sin(time_s * 0.9 + c.ph) * 0.05 * (1 - e), lerp(c.rotF.y, c.rotR.y, e) + time_s * 0.05 * (1 - e), lerp(c.rotF.z, c.rotR.z, e));
    }
    (this.bubbles.material as THREE.ShaderMaterial).uniforms.uT.value = bubbleAge;
  }
}
