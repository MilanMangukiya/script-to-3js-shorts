import * as THREE from 'three';
import type { ShotInfo } from '../../../library/render/FilmPipeline';
import { standardPressureAtm, type EarthMapSet } from '../../../library/environment/PlanetAtmosphere';
import { depthClearer } from '../../../library/environment/GiantPeak';
import { GlassOfWater } from '../../../library/props/GlassOfWater';
import { rng, fbm2, smoothstep, clamp } from '../../../library/util/math';
import { GLSL_NOISE } from '../../../library/util/glsl';
import { PlanetStage, SUN, win, type Anchor } from './common';
import { makeMountaineer, climbPose, makeSuitedFigure, kneelPose, Puffs, Spindrift, BoilingBubbles } from './gear';
import { fmtAtm } from './PeakStage';
import { T } from '../timeline';

export type LedgeKind = 'snow' | 'rock';

/**
 * Metre-scale patch of the real flank (1,400 m radius built from GiantPeak.surfacePoint, so its edge meets the big mesh)
 * with local drifts/rocks, placed so world origin is the flank point at `targetAlt` km on the south side. The 100 km
 * mesh is drawn first with logarithmic depth, then depth is cleared and the foreground drawn on top.
 */
export class LedgeStage extends PlanetStage {
  readonly originKm: THREE.Vector3; readonly originAlt: number;
  private ground!: THREE.Mesh; private grad = new THREE.Vector2();
  climber?: ReturnType<typeof makeMountaineer>; suit?: ReturnType<typeof makeSuitedFigure>;
  breath?: Puffs; drift?: Spindrift; glass?: GlassOfWater; boil?: BoilingBubbles; steam?: Puffs;
  sun: THREE.DirectionalLight;
  private bandY = 1e9; zCross = 0;
  /** Unit direction (x, z) from the ledge toward the summit. */
  readonly uphill = new THREE.Vector2();
  constructor(maps: EarthMapSet, private renderer: THREE.WebGLRenderer, readonly kind: LedgeKind, targetAlt: number, bandAlt?: number, azimuth = Math.PI / 2) {
    super(maps, { sunPower: 4.5, skyGain: kind === 'snow' ? 1.7 : 1.5, cloudOpacity: 0.9, near: 0.02, far: 400000 });
    const p = this.peak, th = azimuth;
    let lo = 0, hi = 200;
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (p.heightPolar(mid, th) > targetAlt) lo = mid; else hi = mid; }
    const rr = (lo + hi) / 2, ox = rr * Math.cos(th), oz = rr * Math.sin(th);
    this.uphill.set(-Math.cos(th), -Math.sin(th));
    this.originKm = p.surfacePoint(ox, oz); this.originAlt = p.heightAt(ox, oz);
    const e = 0.004; this.grad.set((p.heightAt(ox + e, oz) - p.heightAt(ox - e, oz)) / (2 * e), (p.heightAt(ox, oz + e) - p.heightAt(ox, oz - e)) / (2 * e));
    p.place(1000, new THREE.Vector3(0, 0, 0), this.originKm);
    p.uniforms.uLogDepth.value = 1; p.uniforms.uLogFar.value = 4.5e5; p.uniforms.uHole.value.set(ox, 0, oz, 1.2);
    p.mesh.renderOrder = -50;
    this.scene.add(depthClearer(-40));
    if (bandAlt !== undefined) this.bandY = (bandAlt - this.originAlt) * 1000;
    this.buildGround(ox, oz);
    // Where the climber's path (x = 0) meets the glowing contour, found on the actual micro-relief.
    let za = -6, zb = 4;
    // Path: s metres along `uphill` from the origin; find s where the ground crosses the band.
    for (let i = 0; i < 40; i++) { const sm = (za + zb) / 2; if (this.groundY(this.uphill.x * sm, this.uphill.y * sm) > this.bandY) zb = sm; else za = sm; }
    this.zCross = (za + zb) / 2;
    // Sunlight at this altitude (direct beam through the thin air above) plus sky and cloud-sea bounce.
    const sky = kind === 'snow' ? 0x5d86c4 : 0x2b3c78;
    this.sun = new THREE.DirectionalLight(0xfff6ea, kind === 'snow' ? 2.6 : 4.0);
    this.sun.position.copy(SUN).multiplyScalar(40); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target, new THREE.HemisphereLight(sky, 0xd8dde4, kind === 'snow' ? 0.42 : 0.35));
    if (kind === 'snow') {
      this.climber = makeMountaineer(); this.scene.add(this.climber.root);
      this.breath = new Puffs({ count: 40, period: 1.1, life: 1.3, size: 0.045, drift: new THREE.Vector3(0.22, 0.12, -0.18), spread: 0.025, opacity: 0.3, seed: 9 });
      this.drift = new Spindrift((x, z) => this.groundY(x, z), { count: 1100, extent: 14, seed: 4 });
      this.scene.add(this.breath.points, this.drift.points);
    } else {
      // A flat-topped boulder carries the glass; the suited figure kneels beside it.
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1).scale(1.25, 0.62, 0.95), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.93, flatShading: true }));
      boulder.position.set(0, this.groundY(0, 0) + 0.12, 0); boulder.castShadow = boulder.receiveShadow = true;
      const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 9), new THREE.MeshStandardMaterial({ color: 0x4a423b, roughness: 0.9, flatShading: true }));
      slab.position.set(0, 0.39, 0); slab.castShadow = slab.receiveShadow = true;
      this.glass = new GlassOfWater({ cubes: 0, seed: 3 }); this.glass.group.position.set(0, 0.42, 0);
      this.boil = new BoilingBubbles({ radius: 0.031, floor: 0.011, top: 0.083, count: 300, seed: 12 }); this.glass.group.add(this.boil.points);
      this.steam = new Puffs({ count: 30, period: 0.55, life: 1.3, size: 0.018, drift: new THREE.Vector3(0.015, 0.07, 0.02), spread: 0.008, opacity: 0.1, color: 0xffffff, seed: 21 });
      this.suit = makeSuitedFigure(); this.suit.root.position.set(-0.62, this.groundY(-0.62, -0.3), -0.3); this.suit.root.rotation.y = 1.2;
      this.scene.add(boulder, slab, this.glass.group, this.steam.points, this.suit.root);
    }
    this.atmo.setCamera(this.originKm.clone().add(new THREE.Vector3(0, 0.0017, 0)));
    this.scene.environment = this.atmo.toEnvironment(renderer); this.scene.environmentIntensity = kind === 'snow' ? 0.45 : 0.35;
  }
  /** Ground height (m) of the local patch at (x, z) metres. */
  groundY(x: number, z: number) { return this.grad.x * x + this.grad.y * z + this.micro(x, z); }
  private micro(x: number, z: number) {
    // Small relief near the origin (cameras and figures sit on the slope plane), larger undulation further out.
    const d = Math.hypot(x, z), fade = 1 - smoothstep(60, 400, d), far = smoothstep(12, 60, d);
    if (this.kind === 'snow') return ((fbm2(x / 3.5, z / 9, 41, 4) - 0.5) * 0.35 + (fbm2(x / 0.9, z / 2.4, 43, 3) - 0.5) * 0.06 + (fbm2(x / 30, z / 30, 47, 3) - 0.5) * 2.5 * far) * fade;
    return ((fbm2(x / 1.6, z / 1.6, 51, 4) - 0.5) * 0.3 + (fbm2(x / 0.35, z / 0.35, 53, 3) - 0.5) * 0.06 + (fbm2(x / 20, z / 20, 57, 3) - 0.5) * 3 * far) * fade;
  }
  private buildGround(ox: number, oz: number) {
    const n = 420, R = 1400, pos = new Float32Array((n + 1) * (n + 1) * 3), col = new Float32Array((n + 1) * (n + 1) * 3), idx: number[] = [];
    const warp = (u: number) => Math.sign(u) * R * u * u, p = this.peak, v = new THREE.Vector3(), c = new THREE.Color();
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = warp(i / n * 2 - 1), z = warp(j / n * 2 - 1);
      p.surfacePoint(ox + x / 1000, oz + z / 1000, 0, 1, 0, v); v.sub(this.originKm).multiplyScalar(1000);
      const near = 1 - smoothstep(30, 400, Math.hypot(x, z));
      v.y = v.y * (1 - near) + (this.grad.x * x + this.grad.y * z) * near + this.micro(x, z);
      const k = (j * (n + 1) + i) * 3; pos.set([v.x, v.y, v.z], k);
      const nn = fbm2(x / 2.2, z / 2.2, 61, 3);
      if (this.kind === 'snow') c.setRGB(0.7 + nn * 0.08, 0.74 + nn * 0.07, 0.8); else c.setRGB(0.19 + nn * 0.1, 0.165 + nn * 0.08, 0.15 + nn * 0.06);
      col.set([c.r, c.g, c.b], k);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, cc = a + n + 1, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: this.kind === 'snow' ? 0.72 : 0.94, metalness: 0 });
    const bandY = this.bandY;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBandY = { value: bandY }; sh.uniforms.uBandOn = { value: 0 }; (mat.userData as any).shader = sh;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform float uBandY, uBandOn;\n' + GLSL_NOISE)
        // Wind-carved snow / rock grain as a screen-derivative bump on the shading normal.
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { float hb = vnoise(vW.xz*vec2(0.55, 0.22))*0.9 + vnoise(vW.xz*vec2(2.1, 0.9))*0.32 + vnoise(vW.xz*7.0)*0.08 + vnoise(vW.xz*0.08)*2.5;
            hb *= ${this.kind === 'snow' ? '0.06' : '0.11'};
            vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
            float det = dot(sx, r1); vec2 dh = vec2(dFdx(hb), dFdy(hb));
            normal = normalize(abs(det)*normal - sign(det)*(dh.x*r1 + dh.y*r2)); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float bw = 0.05 + fwidth(vW.y)*1.2; float bd = abs(vW.y - uBandY);
          totalEmissiveRadiance += vec3(1.0, 0.72, 0.28)*uBandOn*(smoothstep(bw, bw*0.3, bd)*7.0 + exp(-bd/0.5)*0.6);`);
    };
    this.ground = new THREE.Mesh(geo, mat); this.ground.receiveShadow = true; this.scene.add(this.ground);
  }
  private setBand(on: number) { const sh = (this.ground.material as THREE.Material).userData.shader; if (sh) sh.uniforms.uBandOn.value = on; }
  private pxScale() { const s = new THREE.Vector2(); this.renderer.getDrawingBufferSize(s); return s.y / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2); }
  update(t: number, shot: ShotInfo) {
    const px = this.pxScale();
    if (this.kind === 'snow' && this.climber && this.breath && this.drift) {
      this.setBand(win(t, 12.2, 12.8));
      // Climber trudges uphill (-z), crossing the 8,849 m line on "pass Everest".
      const s = this.zCross + 0.42 * (t - T.passEverest), x = this.uphill.x * s, z = this.uphill.y * s;
      const phase = (t - 11.5) * Math.PI * 2 / 1.25;
      const breathCycle = Math.sin((t - 11.5) * Math.PI * 2 / 1.1);
      this.climber.root.position.set(x, this.groundY(x, z), z); this.climber.root.rotation.y = Math.atan2(this.uphill.x, this.uphill.y);
      this.climber.setPose(climbPose(phase, breathCycle));
      const mouth = new THREE.Vector3(0, 0.06, 0.16); this.climber.head.localToWorld(mouth);
      this.breath.update(t, mouth, shot.shotId === 'SH02' ? 1 : 0.6); (this.breath.points.material as THREE.ShaderMaterial).uniforms.uScale.value = px;
      this.drift.update(t);
      this.sun.target.position.copy(this.climber.root.position); this.sun.position.copy(this.climber.root.position).addScaledVector(SUN, 40);
    } else if (this.glass && this.boil && this.steam && this.suit) {
      const boil = win(t, 18.0, 18.7) * 0.7 + win(t, 18.7, 19.6) * 0.3;
      this.boil.update(t, boil, px);
      const top = new THREE.Vector3(0, 0.42 + 0.088, 0);
      this.steam.update(t, top, win(t, 18.8, 19.6)); (this.steam.points.material as THREE.ShaderMaterial).uniforms.uScale.value = px;
      this.glass.update(t, 0, -1);
      // Surface shiver once the boil starts.
      this.glass.group.children.forEach((o) => { if ((o as THREE.Mesh).isMesh && o.position.y > 0.08) o.position.y = 0.0842 + Math.sin(t * 61) * 0.0006 * boil; });
      const look = win(t, 21.2, 22.3);
      this.suit.setPose(kneelPose(look, Math.sin(t * 2.4) * 0.4));
      this.sun.target.position.set(0, 0.4, 0); this.sun.position.copy(SUN).multiplyScalar(40);
    }
    this.syncSky(t);
  }
  anchors(t: number, shot: ShotInfo): Anchor[] {
    if (this.kind === 'rock' && shot.shotId === 'SH01') return [{ world: new THREE.Vector3(0.03, 0.51, 0), label: 'WATER AT 37°C', value: 'BOILING', accent: '#FACC15', dx: 80, dy: -150, alpha: win(t, T.boils - 0.1, T.boils + 0.25) }];
    if (this.kind === 'rock' && shot.shotId === 'SH02' && this.suit) {
      const head = new THREE.Vector3(0, 0.25, 0); this.suit.head.localToWorld(head);
      return [{ world: head, label: 'ARMSTRONG LIMIT', value: '19 KM', accent: '#F97316', dx: 70, dy: -120, alpha: win(t, 20.2, 20.5) }];
    }
    if (this.kind === 'snow' && shot.shotId === 'SH01' && this.climber) { const hip = new THREE.Vector3(0.25, 1.15, 0); this.climber.root.localToWorld(hip); return [{ world: hip, label: 'EVEREST HEIGHT', value: '8,849 M', accent: '#FACC15', dx: 70, dy: -120, alpha: win(t, T.passEverest - 0.25, T.passEverest + 0.1) }]; }
    return [];
  }
  hudLine(): string | undefined { return `AIR PRESSURE ${fmtAtm(standardPressureAtm(Math.max(this.camAlt, 0)))}`; }
}
