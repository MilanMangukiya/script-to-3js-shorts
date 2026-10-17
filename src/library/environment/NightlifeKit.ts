import * as THREE from 'three';
import { rng } from '../util/math';
import { LightBeam } from '../fx/LightBeam';

/**
 * nightlife-kit-v1 — party and evening-out set dressing in metres, animated from absolute time:
 *  - `StringLights`: catenary strands of warm (or multicolour) bulbs between anchor points, with soft glow and a
 *    gentle flicker; `lit` 0..1.
 *  - `StageBeams`: a truss of moving-head spotlights sweeping volumetric beams in a colour programme synced to `bpm`.
 *  - `LedDanceFloor`: a tiled floor that plays beat-synced colour patterns (checker pulses, ripples, sweeps).
 *  - `StageDeck`: a raised stage with a dark backdrop to host beams, a DJ table and screens.
 */
export class StringLights {
  readonly group = new THREE.Group(); private mat: THREE.MeshBasicMaterial; private glowMat: THREE.MeshBasicMaterial; private base: THREE.Color;
  constructor(o: { anchors: THREE.Vector3[]; sag?: number; spacing?: number; color?: THREE.ColorRepresentation; multicolor?: boolean; seed?: number }) {
    const r = rng(o.seed ?? 2), sp = o.spacing ?? 0.5, pts: THREE.Vector3[] = [], cols: number[] = [];
    this.base = new THREE.Color(o.color ?? 0xffc983);
    const wire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    for (let i = 0; i < o.anchors.length - 1; i++) {
      const a = o.anchors[i], b = o.anchors[i + 1], span = a.distanceTo(b), sag = span * (o.sag ?? 0.08), n = Math.max(2, Math.round(span / sp));
      const curve: THREE.Vector3[] = [];
      for (let k = 0; k <= 24; k++) { const u = k / 24; curve.push(a.clone().lerp(b, u).add(new THREE.Vector3(0, -sag * 4 * u * (1 - u), 0))); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve), 48, 0.008, 4), wire); this.group.add(m);
      for (let k = 0; k < n; k++) { const u = (k + 0.5) / n; pts.push(a.clone().lerp(b, u).add(new THREE.Vector3(0, -sag * 4 * u * (1 - u) - 0.06, 0))); cols.push(o.multicolor ? [0xff4f6a, 0x4fd4ff, 0xffd84f, 0x7cff6a, 0xd36aff][Math.floor(r() * 5)] : 0xffffff); }
    }
    this.mat = new THREE.MeshBasicMaterial({ color: this.base, toneMapped: false });
    this.glowMat = new THREE.MeshBasicMaterial({ color: this.base, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), this.mat, pts.length), glows = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), this.glowMat, pts.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    pts.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4); glows.setMatrixAt(i, m4); bulbs.setColorAt(i, c.set(cols[i])); glows.setColorAt(i, c.set(cols[i])); });
    this.group.add(bulbs, glows); this.lit = 1;
  }
  set lit(v: number) { this.mat.color.copy(this.base).multiplyScalar(0.3 + 4.5 * v); this.glowMat.opacity = 0.2 * v; }
  update(t: number, lit = 1) { this.lit = lit * (0.96 + 0.04 * Math.sin(t * 9.0) * Math.sin(t * 3.7)); }
}

export class StageBeams {
  readonly group = new THREE.Group(); private beams: { b: LightBeam; pivot: THREE.Group; phase: number }[] = []; bpm: number;
  constructor(o: { count?: number; span?: number; length?: number; bpm?: number; seed?: number } = {}) {
    const n = o.count ?? 6, span = o.span ?? 10, L = o.length ?? 22, r = rng(o.seed ?? 5); this.bpm = o.bpm ?? 124;
    const truss = new THREE.Mesh(new THREE.BoxGeometry(span + 1, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.8 })); this.group.add(truss);
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Group(); pivot.position.set(-span / 2 + (i + 0.5) * span / n, -0.25, 0); this.group.add(pivot);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.4, 14), new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.4, metalness: 0.7 })); head.position.y = -0.1; pivot.add(head);
      const b = new LightBeam({ length: L, radius: L * 0.09, color: 0xffffff, intensity: 0.25, edge: 2.6, falloff: 0.8, nearFade: 1.5 }); b.mesh.position.y = -0.3; pivot.add(b.mesh);
      this.beams.push({ b, pivot, phase: r() * 6.28 });
    }
  }
  update(t: number, level = 1) {
    const beat = t * this.bpm / 60, hueBase = Math.floor(beat / 8) * 0.17;
    this.beams.forEach(({ b, pivot, phase }, i) => {
      const sweep = Math.sin(beat * Math.PI / 4 + phase) * 0.6, tilt = Math.sin(beat * Math.PI / 8 + phase * 2) * 0.35;
      pivot.rotation.set(tilt, 0, sweep * (i % 2 ? 1 : -1));
      b.color = new THREE.Color().setHSL((hueBase + i * 0.08) % 1, 0.9, 0.6);
      b.level = level * (0.55 + 0.45 * Math.max(0, Math.cos(beat * Math.PI * 2 + i)));
    });
  }
}

const FLOOR_FS = /* glsl */ `uniform float uTime, uBpm, uLevel; uniform vec2 uTiles; varying vec2 vUv;
  vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
  void main(){
    vec2 g = vUv * uTiles, id = floor(g), f = fract(g); float beat = uTime * uBpm / 60.0, bar = floor(beat / 4.0), mode = mod(bar, 3.0);
    float on;
    if (mode < 1.0) on = step(0.5, fract((id.x + id.y) * 0.5 + floor(beat) * 0.5));
    else if (mode < 2.0) { float d = length(id - uTiles * 0.5); on = smoothstep(0.6, 0.0, abs(fract(d * 0.25 - beat * 0.5) - 0.5) * 2.0 - 0.4); }
    else on = step(abs(id.x - mod(floor(beat * 2.0), uTiles.x)), 1.0) + step(abs(id.y - mod(floor(beat * 2.0 + 3.0), uTiles.y)), 0.5);
    float edge = smoothstep(0.0, 0.06, f.x) * smoothstep(1.0, 0.94, f.x) * smoothstep(0.0, 0.06, f.y) * smoothstep(1.0, 0.94, f.y);
    vec3 col = hsv(fract(bar * 0.13 + (id.x + id.y) * 0.02), 0.85, 1.0) * clamp(on, 0.0, 1.0) * (0.75 + 0.25 * fract(-beat)) * edge;
    gl_FragColor = vec4(col * 1.15 * uLevel + vec3(0.02, 0.02, 0.03), 1.0);
  }`;
export class LedDanceFloor {
  readonly mesh: THREE.Mesh; private u: Record<string, THREE.IUniform>;
  constructor(o: { width?: number; depth?: number; tile?: number; bpm?: number } = {}) {
    const W = o.width ?? 8, D = o.depth ?? 8, T = o.tile ?? 0.8;
    this.u = { uTime: { value: 0 }, uBpm: { value: o.bpm ?? 124 }, uLevel: { value: 1 }, uTiles: { value: new THREE.Vector2(Math.round(W / T), Math.round(D / T)) } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: FLOOR_FS, toneMapped: false }));
    this.mesh.position.y = 0.012;
  }
  update(t: number, level = 1) { this.u.uTime.value = t; this.u.uLevel.value = level; }
}

/** Raised stage with a dark backdrop wall and a DJ table; children positioned in metres from its front centre. */
export function stageDeck(o: { width?: number; depth?: number; height?: number } = {}) {
  const g = new THREE.Group(), W = o.width ?? 10, D = o.depth ?? 5, H = o.height ?? 1.1;
  const dark = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.6 }), metal = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.4, metalness: 0.8 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), dark); deck.position.set(0, H / 2, -D / 2); deck.receiveShadow = true; g.add(deck);
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, 6, 0.3), dark); back.position.set(0, H + 3, -D + 0.15); g.add(back);
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 0.8), metal); table.position.set(0, H + 0.5, -D * 0.45); table.castShadow = true; g.add(table);
  for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.3), metal); p.position.set(x, 3.5, -0.3); g.add(p); }
  return g;
}
