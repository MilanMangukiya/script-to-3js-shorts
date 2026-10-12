import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { rng } from '../util/math';

export interface PlasticBottleOptions {
  /** Overall height including the cap, and body radius, in metres (default: a 500 mL bottle). */
  height?: number; radius?: number;
  seed?: number;
  tint?: THREE.ColorRepresentation;
  /** Label band colour, or null for a bare bottle. */
  labelColor?: THREE.ColorRepresentation | null;
  capColor?: THREE.ColorRepresentation;
}

// Inward dent pattern on the bottle surface: a few large concave faces with sharp ridges between them, a second
// crossing set of folds and fine wrinkles. Everything is periodic in the angle, so there is no seam.
const CRUMPLE_GLSL = /* glsl */ `
uniform float uCrumple, uSeed, uH, uR;
${GLSL_NOISE}
float bFace(float th, float n, float ph){ float s = fract(n*(th - ph)/6.2831853); return pow(max(sin(3.14159265*s), 0.0), 0.6); }
float bDent(float th, float yn){
  vec2 ring = vec2(cos(th), sin(th));
  float w = smoothstep(0.05, 0.16, yn) * (1.0 - smoothstep(0.62, 0.88, yn));
  float ph1 = uSeed*1.7 + yn*1.9 + uCrumple*0.35 + (vnoise(vec2(yn*6.0, uSeed)) - 0.5)*0.9;
  float ph2 = -uSeed*0.9 - yn*2.6 + (vnoise(vec2(yn*5.0 + 3.0, uSeed + 2.0)) - 0.5)*0.8;
  float d = bFace(th, 3.0, ph1) * (0.66 + 0.34*(vnoise3(vec3(ring*1.3, yn*7.0 + uSeed)) - 0.5));
  d = max(d, bFace(th, 5.0, ph2) * 0.45);
  d = max(d, bFace(th + yn*1.3, 7.0, ph1*1.3 + 1.0) * 0.28 * step(0.3, fract(yn*4.0 + uSeed)));
  d += (vnoise3(vec3(ring*4.5, yn*38.0 + uSeed*3.0)) - 0.5) * 0.2;
  // The collapse starts mid-body and spreads up and down as uCrumple rises.
  float local = smoothstep(0.0, 1.0, uCrumple*1.45 - abs(yn - 0.4)*0.9);
  return clamp(d, 0.0, 1.0) * w * local;
}
`;

const CRUMPLE_NORMAL = /* glsl */ `
vec3 objectNormal = vec3(normal);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
float bR0 = length(position.xz), bTh = atan(position.z, position.x), bYn = position.y / uH;
float bDepth = 0.74 * uR * (bR0 / uR);
float bD = bDent(bTh, bYn);
float bE = 0.004, bEy = 0.004;
float bDth = (bDent(bTh + bE, bYn) - bDent(bTh - bE, bYn)) / (2.0*bE);
float bDy = (bDent(bTh, bYn + bEy) - bDent(bTh, bYn - bEy)) / (2.0*bEy*uH);
vec3 bTan = vec3(-sin(bTh), 0.0, cos(bTh));
objectNormal = normalize(objectNormal + bTan * (bDepth * bDth / max(bR0, 1e-4)) + vec3(0.0, 1.0, 0.0) * (bDepth * bDy));
vec3 bOffset = -vec3(cos(bTh), 0.0, sin(bTh)) * bDepth * bD;
bOffset.y = -uCrumple * 0.05 * uH * smoothstep(0.1, 0.75, bYn);
`;

/**
 * Clear PET bottle (shell, ribbed cap, optional label band) for macro shots. `crumple` (0..1) caves the walls in along
 * seeded concave faces and creases until the inside volume is roughly halved, as a sealed bottle would under one
 * extra atmosphere; base, neck and cap stay rigid. Deformation and normals are computed in the vertex shader, so any
 * crumple value is a pure function of the parameter (no simulation state).
 */
export class PlasticBottle {
  readonly group = new THREE.Group();
  private uniforms: Record<string, THREE.IUniform>;
  readonly height: number; readonly radius: number;

  constructor(o: PlasticBottleOptions = {}) {
    const H = (this.height = o.height ?? 0.21), R = (this.radius = o.radius ?? 0.033), seed = o.seed ?? 3, r = rng(seed);
    this.uniforms = { uCrumple: { value: 0 }, uSeed: { value: 1 + r() * 9 }, uH: { value: H }, uR: { value: R } };
    const inject = (mat: THREE.Material) => {
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, this.uniforms);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${CRUMPLE_GLSL}`)
          .replace('#include <beginnormal_vertex>', CRUMPLE_NORMAL)
          .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + bOffset;');
      };
      mat.customProgramCacheKey = () => 'plastic-bottle-crumple';
      return mat;
    };

    // Profile (radius, height) scaled from a 21 cm / 3.3 cm reference bottle: rounded base, grip ribs, shoulder, neck.
    const sx = R / 0.033, sy = H / 0.21, prof: [number, number][] = [[0, 0.003], [0.02, 0.0015], [0.029, 0.002], [0.0322, 0.006], [0.033, 0.012]];
    const rib = (y0: number, n: number, gap: number) => { for (let i = 0; i < n; i++) { const y = y0 + i * gap; prof.push([0.033, y - 0.003], [0.0316, y - 0.0012], [0.0316, y + 0.0012], [0.033, y + 0.003]); } };
    rib(0.03, 3, 0.011);
    prof.push([0.033, 0.07], [0.033, 0.12]);
    rib(0.13, 2, 0.01);
    for (let i = 1; i <= 10; i++) { const u = i / 10, y = 0.148 + u * 0.036, rr = 0.033 - (0.033 - 0.0128) * (1 - Math.cos(u * Math.PI)) / 2; prof.push([rr, y]); }
    prof.push([0.0128, 0.188], [0.0162, 0.189], [0.0162, 0.1915], [0.0125, 0.1925], [0.0125, 0.2]);
    const pts = prof.map(([x, y]) => new THREE.Vector2(x * sx, y * sy));
    const shellGeo = new THREE.LatheGeometry(pts, 120);
    const shell = new THREE.Mesh(shellGeo, inject(new THREE.MeshPhysicalMaterial({
      color: o.tint ?? 0xeef6ff, roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.0006, ior: 1.57,
      specularIntensity: 1, clearcoat: 0.4, clearcoatRoughness: 0.05, envMapIntensity: 1.25, side: THREE.DoubleSide, depthWrite: false,
    })));
    shell.renderOrder = 3; shell.castShadow = true;
    this.group.add(shell);

    if (o.labelColor !== null) {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const g = c.getContext('2d')!;
      const base = new THREE.Color(o.labelColor ?? 0x8fc6e8), hex = `#${base.getHexString()}`;
      const grad = g.createLinearGradient(0, 0, 0, 128); grad.addColorStop(0, '#f4f9fc'); grad.addColorStop(0.18, hex); grad.addColorStop(0.82, hex); grad.addColorStop(1, '#f4f9fc');
      g.fillStyle = grad; g.fillRect(0, 0, 1024, 128);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5; g.beginPath();
      for (let x = 0; x <= 1024; x += 8) { const y = 70 + Math.sin(x / 1024 * Math.PI * 6) * 14; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; g.beginPath();
      for (let x = 0; x <= 1024; x += 8) { const y = 90 + Math.sin(x / 1024 * Math.PI * 6 + 1.2) * 10; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const label = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.008, R * 1.008, 0.046 * sy, 120, 8, true).translate(0, 0.095 * sy, 0),
        inject(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0, side: THREE.DoubleSide })));
      label.castShadow = true;
      this.group.add(label);
    }

    // Ribbed screw cap.
    const capGeo = new THREE.CylinderGeometry(0.0146 * sx, 0.0146 * sx, 0.017 * sy, 64, 1, false).translate(0, 0.2015 * sy, 0);
    const cp = capGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), z = cp.getZ(i), rr = Math.hypot(x, z);
      if (rr > 0.0145 * sx * 0.98) { const a = Math.atan2(z, x), k = 1 - 0.035 * (Math.cos(a * 32) > 0 ? 1 : 0); cp.setX(i, x * k); cp.setZ(i, z * k); }
    }
    capGeo.computeVertexNormals();
    const cap = new THREE.Mesh(capGeo, inject(new THREE.MeshStandardMaterial({ color: o.capColor ?? 0x2f74c0, roughness: 0.5, metalness: 0 })));
    cap.castShadow = true;
    this.group.add(cap);
  }

  /** 0 = intact, 1 = fully crumpled (about half the inside volume). Values slightly above 1 give an overshoot. */
  set crumple(v: number) { this.uniforms.uCrumple.value = v; }
  get crumple() { return this.uniforms.uCrumple.value; }
}
