import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { rng, clamp, smoothstep } from '../util/math';

export interface CookingPotOptions {
  /** Outer radius, wall height and water depth in metres. */
  radius?: number; height?: number; waterLevel?: number;
  seed?: number;
  /** Number of bubble sprites in the pool. */
  bubbles?: number;
  metalColor?: THREE.ColorRepresentation;
}

/**
 * Stainless cooking pot with water for kitchen close-ups. `update(time_s, boil)`:
 *  boil 0 = still water with a faint shimmer, ~0.3 = a few small bubbles streaming from nucleation sites,
 *  1 = rolling boil (large bubbles bursting through an agitated surface).
 * Bubbles are a stateless function of time (each sprite cycles on its own seeded schedule).
 */
export class CookingPot {
  readonly group = new THREE.Group();
  readonly waterLevel: number; readonly radius: number;
  private surfaceU: Record<string, THREE.IUniform>;
  private bubbleU: Record<string, THREE.IUniform>;
  private surfaceMat!: THREE.MeshPhysicalMaterial;

  constructor(o: CookingPotOptions = {}) {
    const R = (this.radius = o.radius ?? 0.105), H = o.height ?? 0.13, wl = (this.waterLevel = o.waterLevel ?? 0.08), r = rng(o.seed ?? 6);
    const wall = 0.0016, floor = 0.006;
    // Brushed stainless: circumferential streaks in the roughness map.
    const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 64; const bg = bc.getContext('2d')!;
    bg.fillStyle = '#5a5a5a'; bg.fillRect(0, 0, 1024, 64);
    for (let i = 0; i < 900; i++) { bg.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${0.05 + r() * 0.08})`; bg.fillRect(0, r() * 64, 1024, 0.6 + r() * 1.4); }
    const brushed = new THREE.CanvasTexture(bc); brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
    const steel = new THREE.MeshPhysicalMaterial({ color: o.metalColor ?? 0xd2d6db, metalness: 1, roughness: 0.3, roughnessMap: brushed, clearcoat: 0.2, clearcoatRoughness: 0.2, envMapIntensity: 1.1 });
    const prof = [[0, 0], [R - 0.008, 0], [R, 0.006], [R, H - 0.004], [R + 0.004, H - 0.001], [R + 0.004, H + 0.0015], [R - wall, H], [R - wall, floor + 0.006], [R - wall - 0.006, floor], [0, floor]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), steel);
    pot.castShadow = true; pot.receiveShadow = true;
    this.group.add(pot);
    // Side handles with rivets.
    for (const side of [1, -1]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * (R - 0.002), H - 0.03, -0.028), new THREE.Vector3(side * (R + 0.03), H - 0.018, -0.03), new THREE.Vector3(side * (R + 0.045), H - 0.012, 0),
        new THREE.Vector3(side * (R + 0.03), H - 0.018, 0.03), new THREE.Vector3(side * (R - 0.002), H - 0.03, 0.028)]);
      const h = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0045, 10, false), steel); h.castShadow = true; this.group.add(h);
      for (const z of [-0.028, 0.028]) { const rv = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 10, 8), steel); rv.position.set(side * (R + 0.0005), H - 0.03, z); this.group.add(rv); }
    }

    // Water body (seen through the surface) and surface.
    const inner = R - wall - 0.0005;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner - 0.004, wl - floor, 96, 1, true).translate(0, (wl + floor) / 2, 0),
      new THREE.MeshBasicMaterial({ color: 0x6f8f9c, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.BackSide }));
    body.renderOrder = 2; this.group.add(body);
    this.surfaceU = { uTime: { value: 0 }, uBoil: { value: 0 }, uR: { value: inner } };
    const surfMat = new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.06, ior: 1.333,
      attenuationColor: new THREE.Color(0x9cc9d6), attenuationDistance: 0.25, envMapIntensity: 1.1, specularIntensity: 1, depthWrite: false });
    this.surfaceMat = surfMat;
    surfMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.surfaceU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTime, uBoil, uR; varying vec2 vXZ;\n${GLSL_NOISE}`)
        .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); vXZ = position.xz;
          float rr = length(position.xz) / uR, edge = 1.0 - smoothstep(0.86, 1.0, rr);
          float bump = (vnoise(position.xz*55.0 + vec2(uTime*2.1, -uTime*1.7)) - 0.5) + (vnoise(position.xz*120.0 - vec2(uTime*3.3, uTime*2.6)) - 0.5)*0.6;
          transformed.y += bump * 0.0045 * uBoil * edge;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uTime, uBoil, uR; varying vec2 vXZ;\n${GLSL_NOISE}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            float e = 0.0015, a = 0.0003 + uBoil*0.004;
            float t = uTime;
            #define HF(p) ((vnoise((p)*55.0 + vec2(t*2.1, -t*1.7)) - 0.5) + (vnoise((p)*120.0 - vec2(t*3.3, t*2.6)) - 0.5)*0.6)
            float h0 = HF(vXZ), hx = HF(vXZ + vec2(e, 0.0)), hz = HF(vXZ + vec2(0.0, e));
            vec3 wn = normalize(vec3(-(hx - h0)/e * a, 1.0, -(hz - h0)/e * a));
            normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
          }`);
    };
    surfMat.customProgramCacheKey = () => 'cooking-pot-water';
    // Polar grid (not a fan) so the boiling bumps have vertices to move.
    const surface = new THREE.Mesh(polarDisc(inner, 48, 160), surfMat);
    surface.position.y = wl; surface.renderOrder = 4;
    this.group.add(surface);

    // Bubble pool: nucleation streams (small, frequent) and boil bubbles (large, rolling).
    const n = o.bubbles ?? 260, pos = new Float32Array(n * 3), seedA = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * inner * 0.92;
      pos.set([Math.cos(a) * rad, floor, Math.sin(a) * rad], i * 3);
      seedA.set([r(), 0.6 + r() * 0.9, r(), i < n * 0.45 ? 0 : 1], i * 4);   // phase, speed, size, kind (0 nucleation, 1 boil)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(seedA, 4));
    this.bubbleU = { uTime: { value: 0 }, uBoil: { value: 0 }, uTop: { value: wl }, uFloor: { value: floor } };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.bubbleU,
      vertexShader: /* glsl */ `attribute vec4 aS; uniform float uTime, uBoil, uTop, uFloor; varying float vA;
        void main(){
          float kind = aS.w;
          // Nucleation bubbles appear from boil 0.1, boil bubbles from 0.55; both get denser with boil.
          float on = kind < 0.5 ? smoothstep(0.08 + aS.z*0.25, 0.2 + aS.z*0.25, uBoil) : smoothstep(0.5 + aS.z*0.3, 0.62 + aS.z*0.3, uBoil);
          float speed = kind < 0.5 ? 0.06*aS.y : 0.16*aS.y;
          float cycle = (uTop - uFloor) / speed + (kind < 0.5 ? 0.3 : 0.8);
          float age = mod(uTime + aS.x*cycle, cycle);
          vec3 p = position; p.y = uFloor + min(age*speed, uTop - uFloor);
          p.x += sin(age*13.0 + aS.x*40.0) * 0.0012 * (0.5 + kind); p.z += cos(age*11.0 + aS.x*30.0) * 0.0012 * (0.5 + kind);
          float sz = kind < 0.5 ? (0.0012 + aS.z*0.0012) : (0.003 + aS.z*0.006) * (0.6 + 0.4*age*speed/(uTop - uFloor));
          vA = on * smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(uTop - 0.004, uTop, p.y));
          vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(sz * 2.0 * projectionMatrix[1][1] * 960.0 / -mv.z, 0.0, 60.0);
        }`,
      fragmentShader: /* glsl */ `varying float vA;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q)*2.0; if (d > 1.0) discard;
          float rim = smoothstep(0.62, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
          float glint = smoothstep(0.32, 0.0, length(q - vec2(-0.16, -0.18))*2.0);
          float a = (rim*0.85 + glint*0.9 + 0.06) * vA;
          gl_FragColor = vec4(vec3(0.92, 0.97, 1.0) * (0.6 + glint), a); }`,
    }));
    pts.frustumCulled = false; pts.renderOrder = 3;
    this.group.add(pts);
  }

  update(time_s: number, boil: number) {
    const b = clamp(boil, 0, 1.2);
    this.surfaceU.uTime.value = time_s; this.surfaceU.uBoil.value = smoothstep(0.0, 1.0, b) * 0.9 + 0.1 * b;
    this.bubbleU.uTime.value = time_s; this.bubbleU.uBoil.value = b;
    this.surfaceMat.roughness = 0.02 + 0.06 * clamp(b, 0, 1);   // agitated water blurs its reflections
  }
}

/** Disc in the XZ plane (facing +Y) with radial subdivisions so vertex displacement has detail. */
function polarDisc(radius: number, rings: number, segments: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
  pos.push(0, 0, 0); uv.push(0.5, 0.5); nrm.push(0, 1, 0);
  for (let i = 1; i <= rings; i++) {
    const rr = radius * i / rings;
    for (let j = 0; j < segments; j++) { const a = (j / segments) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr; pos.push(x, 0, z); uv.push(0.5 + x / radius / 2, 0.5 - z / radius / 2); nrm.push(0, 1, 0); }
  }
  for (let j = 0; j < segments; j++) idx.push(0, 1 + ((j + 1) % segments), 1 + j);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments, a1 = 1 + i * segments;
    for (let j = 0; j < segments; j++) { const j1 = (j + 1) % segments; idx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}
