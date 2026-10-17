import * as THREE from 'three';
import { rng } from '../util/math';

/**
 * insect-swarm-v1 — instanced flying insects around anchor points, in metres: butterflies (painted two-wing quads
 * that flap from the vertex shader, in monarch / morpho / cabbage-white / swallowtail patterns), bees (striped bodies
 * with blurred wings) and fireflies (blinking glow points for dusk). Flight paths are smooth sums of sines around
 * each insect's home — a pure function of time, with per-insect phases.
 */
export type InsectKind = 'butterfly' | 'bee' | 'firefly';
export interface InsectSwarmOptions {
  kind?: InsectKind; count?: number; seed?: number;
  /** Home volume centre and radius (m); insects wander within it. */
  center?: THREE.Vector3; radius?: number; height?: [number, number];
  /** Butterfly wing span (m) and patterns; bee size; firefly colour. */
  size?: number; patterns?: ('monarch' | 'morpho' | 'white' | 'swallowtail')[]; color?: THREE.ColorRepresentation;
}

function wingAtlas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d')!;
  const wing = (ox: number, fill: string, vein: string, spots: string | null, edge: string) => {
    g.save(); g.translate(ox, 0);
    g.beginPath(); g.moveTo(8, 64); g.bezierCurveTo(30, 0, 110, -4, 124, 30); g.bezierCurveTo(120, 58, 96, 66, 70, 66); g.bezierCurveTo(100, 76, 112, 112, 84, 124); g.bezierCurveTo(50, 128, 20, 96, 8, 64); g.closePath();
    g.fillStyle = fill; g.fill(); g.lineWidth = 7; g.strokeStyle = edge; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = vein;
    for (const [x, y] of [[110, 24], [96, 50], [80, 112], [60, 120]]) { g.beginPath(); g.moveTo(10, 64); g.quadraticCurveTo(x * 0.5, y * 0.8 + 6, x, y); g.stroke(); }
    if (spots) { g.fillStyle = spots; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(28 + (i % 5) * 20, i < 5 ? 26 + i * 3 : 100 - (i - 5) * 4, 3.2, 0, 7); g.fill(); } }
    g.restore();
  };
  wing(0, '#e8780e', '#2a1406', '#ffffff', '#1a0c04');      // monarch
  wing(128, '#1f6fe8', '#0b2a66', null, '#0a1530');          // morpho
  wing(256, '#f2f0e6', '#b8b2a0', '#2a2a2a', '#d8d4c4');     // cabbage white
  wing(384, '#f2d23a', '#1a1a1a', '#3a7bd5', '#151515');     // swallowtail
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class InsectSwarm {
  readonly group = new THREE.Group(); readonly kind: InsectKind;
  private mesh: THREE.InstancedMesh | THREE.Points; private bodies?: THREE.InstancedMesh;
  private items: { home: THREE.Vector3; f: THREE.Vector3; ph: THREE.Vector3; amp: THREE.Vector3; flap: number; scale: number }[] = [];
  private u = { uTime: { value: 0 } }; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private v2 = new THREE.Vector3(); private s = new THREE.Vector3();
  constructor(o: InsectSwarmOptions = {}) {
    const kind = this.kind = o.kind ?? 'butterfly', n = o.count ?? (kind === 'firefly' ? 160 : 24), r = rng(o.seed ?? 7);
    const c = o.center ?? new THREE.Vector3(), R = o.radius ?? 4, [h0, h1] = o.height ?? [0.4, 2.2];
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * R;
      this.items.push({ home: new THREE.Vector3(c.x + Math.cos(a) * d, c.y + h0 + (h1 - h0) * r(), c.z + Math.sin(a) * d), f: new THREE.Vector3(0.2 + r() * 0.3, 0.3 + r() * 0.4, 0.17 + r() * 0.3),
        ph: new THREE.Vector3(r() * 6.28, r() * 6.28, r() * 6.28), amp: new THREE.Vector3(0.6 + r(), 0.25 + r() * 0.4, 0.6 + r()).multiplyScalar(kind === 'bee' ? 0.6 : 1), flap: (kind === 'bee' ? 40 : 7) + r() * 3, scale: 0.8 + r() * 0.4 });
    }
    if (kind === 'firefly') {
      const pos = new Float32Array(n * 3), ph = new Float32Array(n);
      this.items.forEach((it, i) => { pos.set([it.home.x, it.home.y, it.home.z], i * 3); ph[i] = it.ph.x; });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
      const mat = new THREE.ShaderMaterial({ uniforms: { ...this.u, uColor: { value: new THREE.Color(o.color ?? 0xd8ff6a) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `attribute float aPhase; uniform float uTime; varying float vB; void main(){ float c = fract(uTime * 0.23 + aPhase * 0.159); vB = smoothstep(0.0, 0.08, c) * (1.0 - smoothstep(0.12, 0.3, c));
          vec3 p = position + vec3(sin(uTime * 0.4 + aPhase), sin(uTime * 0.31 + aPhase * 2.0) * 0.4, cos(uTime * 0.35 + aPhase)) * 0.6; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = 14.0 * (0.4 + vB) / max(-mv.z, 0.5) * 6.0; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */ `uniform vec3 uColor; varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor * (exp(-d * d * 40.0) * 3.0 + exp(-d * d * 8.0) * 0.4) * vB, 1.0); }` });
      this.mesh = new THREE.Points(g, mat); this.mesh.frustumCulled = false; this.group.add(this.mesh); return;
    }
    const S = o.size ?? (kind === 'bee' ? 0.016 : 0.09);
    // Two wing quads hinged on the body axis (local Z = forward). aSide = ±1 flips the wing; the shader flaps it.
    const wings = new THREE.BufferGeometry(), pos: number[] = [], uv: number[] = [], side: number[] = [], idx: number[] = [];
    for (const sd of [-1, 1]) { const b = pos.length / 3; pos.push(0, 0, -S * 0.5, sd * S, 0, -S * 0.5, sd * S, 0, S * 0.5, 0, 0, S * 0.5); uv.push(0, 0, 1, 0, 1, 1, 0, 1); side.push(sd, sd, sd, sd); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    wings.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wings.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wings.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); wings.setIndex(idx); wings.computeVertexNormals();
    const patterns = o.patterns ?? ['monarch', 'morpho', 'white', 'swallowtail'], pIdx = { monarch: 0, morpho: 1, white: 2, swallowtail: 3 };
    const aPat = new Float32Array(n), aFlap = new Float32Array(n);
    this.items.forEach((it, i) => { aPat[i] = pIdx[patterns[Math.floor(r() * patterns.length)]]; aFlap[i] = it.ph.y; });
    wings.setAttribute('aPattern', new THREE.InstancedBufferAttribute(aPat, 1)); wings.setAttribute('aFlapPhase', new THREE.InstancedBufferAttribute(aFlap, 1));
    const wm = new THREE.MeshStandardMaterial({ map: kind === 'butterfly' ? wingAtlas() : null, color: kind === 'bee' ? 0xd6dde6 : 0xffffff, transparent: kind === 'bee', opacity: kind === 'bee' ? 0.35 : 1, alphaTest: kind === 'butterfly' ? 0.5 : 0, side: THREE.DoubleSide, roughness: 0.6 });
    const flapRate = kind === 'bee' ? 45 : 8;
    wm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.u);
      sh.vertexShader = 'uniform float uTime; attribute float aSide, aPattern, aFlapPhase;\n' + sh.vertexShader
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          #ifdef USE_MAP
            vMapUv.x = (aPattern * 128.0 + uv.x * 124.0 + 4.0) / 512.0;   // this insect's wing in the 4-pattern atlas (mirrored per side)
          #endif`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float flap = sin(uTime * ${flapRate.toFixed(1)} + aFlapPhase) * 1.05 + 0.25;
          float c = cos(flap), s = sin(flap);   // both wings rise and fall together about the body axis
          transformed = vec3(transformed.x * c, abs(transformed.x) * s, transformed.z);`);
    };
    this.mesh = new THREE.InstancedMesh(wings, wm, n); this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.group.add(this.mesh);
    const body = kind === 'bee' ? new THREE.CapsuleGeometry(S * 0.45, S * 0.9, 4, 10).rotateX(Math.PI / 2) : new THREE.CapsuleGeometry(S * 0.06, S * 0.8, 4, 8).rotateX(Math.PI / 2);
    const bm = kind === 'bee' ? new THREE.MeshStandardMaterial({ map: (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8; const g = cv.getContext('2d')!; for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#1a1406' : '#e8b11a'; g.fillRect(i * 8, 0, 8, 8); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })(), roughness: 0.6 })
      : new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.7 });
    this.bodies = new THREE.InstancedMesh(body, bm, n); this.bodies.frustumCulled = false; this.bodies.castShadow = true; this.group.add(this.bodies);
    this.update(0);
  }
  /** Positions and headings at absolute time t (heading follows the flight direction). */
  update(t: number) {
    this.u.uTime.value = t;
    if (this.kind === 'firefly') return;
    const im = this.mesh as THREE.InstancedMesh;
    this.items.forEach((it, i) => {
      const p = (tt: number, out: THREE.Vector3) => out.set(it.home.x + Math.sin(tt * it.f.x + it.ph.x) * it.amp.x + Math.sin(tt * it.f.x * 2.3 + it.ph.y) * it.amp.x * 0.3,
        it.home.y + Math.sin(tt * it.f.y + it.ph.y) * it.amp.y + (this.kind === 'butterfly' ? Math.abs(Math.sin(tt * 8 + it.ph.z)) * 0.04 : 0), it.home.z + Math.cos(tt * it.f.z + it.ph.z) * it.amp.z);
      p(t, this.v); p(t + 0.05, this.v2);
      const dir = this.v2.sub(this.v); dir.y *= 0.3;
      if (dir.lengthSq() > 1e-10) this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
      this.s.setScalar(it.scale); this.m4.compose(this.v, this.q, this.s);
      im.setMatrixAt(i, this.m4); this.bodies!.setMatrixAt(i, this.m4);
    });
    im.instanceMatrix.needsUpdate = true; this.bodies!.instanceMatrix.needsUpdate = true;
  }
}
