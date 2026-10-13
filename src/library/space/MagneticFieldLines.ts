import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../util/math';

export interface MagneticFieldLinesOptions {
  /** Planet radius in scene units. */
  radius?: number;
  /** Field-line shells: equatorial crossing distance in planet radii (L values). */
  shells?: number[];
  /** Lines per shell, spread evenly in longitude. */
  linesPerShell?: number;
  /** Tube radius as a fraction of the planet radius. */
  thickness?: number;
  color?: THREE.ColorRepresentation;
  /** Dipole axis (default +Y). */
  axis?: THREE.Vector3;
  seed?: number;
}

/**
 * Schematic dipole magnetic field: lines r = L·R·sin²θ from pole to pole as thin additive tubes with pulses flowing
 * along them. `strength` fades the field (outer shells go first); deterministic `update(time_s)`.
 */
export class MagneticFieldLines {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;

  constructor(o: MagneticFieldLinesOptions = {}) {
    const R = o.radius ?? 1, shells = o.shells ?? [1.45, 1.9, 2.5, 3.3, 4.3], per = o.linesPerShell ?? 10, r = rng(o.seed ?? 3);
    const parts: THREE.BufferGeometry[] = [];
    shells.forEach((L, si) => {
      const th0 = Math.asin(Math.sqrt(1 / L));
      for (let k = 0; k < per; k++) {
        const phi = (k / per) * Math.PI * 2 + si * 0.37 + (r() - 0.5) * 0.12, pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 96; i++) {
          const th = th0 + (Math.PI - 2 * th0) * (i / 96), rr = L * R * Math.sin(th) ** 2;
          pts.push(new THREE.Vector3(rr * Math.sin(th) * Math.cos(phi), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(phi)));
        }
        const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, R * (o.thickness ?? 0.006), 5, false).toNonIndexed();
        // Per line: pulse phase, shell fraction (outer shells fade first) and the longitude of its meridian plane.
        const n = g.attributes.position.count, line = new Float32Array(n * 3), ph = r();
        for (let i = 0; i < n; i++) line.set([ph, si / Math.max(1, shells.length - 1), phi], i * 3);
        g.setAttribute('aLine', new THREE.BufferAttribute(line, 3));
        parts.push(g);
      }
    });
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 1 }, uColor: { value: new THREE.Color(o.color ?? 0x7fe3ff) } },
      vertexShader: /* glsl */ `attribute vec3 aLine; varying vec2 vUv; varying vec2 vLine; varying vec3 vN; varying vec3 vP; varying vec3 vPlaneN; varying vec3 vCenter;
        void main(){ vUv = uv; vLine = aLine.xy; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz;
          vPlaneN = normalize(mat3(modelMatrix) * vec3(-sin(aLine.z), 0.0, cos(aLine.z))); vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform float uTime, uStrength; uniform vec3 uColor; varying vec2 vUv; varying vec2 vLine; varying vec3 vN; varying vec3 vP; varying vec3 vPlaneN; varying vec3 vCenter;
        void main(){
          float u = vUv.x;
          // Outer shells fade first as the field weakens.
          float keep = smoothstep(vLine.y * 0.6, vLine.y * 0.6 + 0.4, uStrength);
          float pulse = smoothstep(0.0, 0.25, fract(u * 3.0 - uTime * 0.22 + vLine.x)) * (1.0 - smoothstep(0.25, 0.5, fract(u * 3.0 - uTime * 0.22 + vLine.x)));
          float ends = smoothstep(0.0, 0.07, u) * smoothstep(1.0, 0.93, u);
          float edge = pow(abs(dot(normalize(vN), normalize(cameraPosition - vP))), 0.6);   // brighter tube core
          // A loop seen edge-on collapses into a straight streak across the planet: fade it out.
          float side = smoothstep(0.06, 0.28, abs(dot(vPlaneN, normalize(cameraPosition - vCenter))));
          float a = keep * ends * (0.3 + 0.7 * pulse) * edge * side * 0.85;
          gl_FragColor = vec4(uColor * a, a); }`,
    });
    const mesh = new THREE.Mesh(mergeGeometries(parts), this.mat);
    mesh.renderOrder = 25; mesh.frustumCulled = false;
    if (o.axis) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), o.axis.clone().normalize());
    this.group.add(mesh);
  }

  /** 0 = no field, 1 = full field. */
  set strength(v: number) { this.mat.uniforms.uStrength.value = v; this.group.visible = v > 0.002; }
  update(time_s: number) { this.mat.uniforms.uTime.value = time_s; }
}
