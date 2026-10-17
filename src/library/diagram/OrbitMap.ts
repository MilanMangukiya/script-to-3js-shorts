import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface OrbitMapOptions {
  /** World units per astronomical unit (the map lies in the XZ plane; ecliptic +y maps to world -Z). */
  unitsPerAu?: number;
  sunRadius?: number;
}
export interface LineStyle { color: THREE.ColorRepresentation; radius?: number; intensity?: number; opacity?: number; segments?: number }
interface LineRig { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: THREE.Color; intensity: number; segs: number; radial: number; closed: boolean }

/** Point on a Kepler ellipse (AU, ecliptic x/y) at heliocentric longitude `lonDeg`. */
export function ellipsePoint(a: number, e: number, periLonDeg: number, lonDeg: number): [number, number] {
  const nu = THREE.MathUtils.degToRad(lonDeg - periLonDeg), r = a * (1 - e * e) / (1 + e * Math.cos(nu)), l = THREE.MathUtils.degToRad(lonDeg);
  return [r * Math.cos(l), r * Math.sin(l)];
}

/**
 * orbit-map-v1 — top-down solar-system orbit map at true AU geometry: Kepler ellipses and sampled trajectories as
 * glowing tubes that can draw on progressively and pulse for emphasis, a glowing Sun, and caller-supplied markers
 * (planet meshes, enlarged for visibility). Deterministic: every state is set explicitly per frame.
 */
export class OrbitMap {
  readonly group = new THREE.Group();
  readonly sun: THREE.Mesh;
  readonly unitsPerAu: number;
  private lines = new Map<string, LineRig>();
  private bodies = new Map<string, THREE.Object3D>();
  private sunMat: THREE.ShaderMaterial;
  private glow: THREE.Mesh;

  constructor(o: OrbitMapOptions = {}) {
    this.unitsPerAu = o.unitsPerAu ?? 1;
    const sr = o.sunRadius ?? 0.06;
    this.sunMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime; varying vec3 vP; varying vec3 vN; varying vec3 vW; ${GLSL_NOISE}
        void main(){ float f = fbm3(normalize(vP) * 9.0 + vec3(uTime * 0.03)); float mu = max(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0);
          vec3 c = vec3(2.0, 1.2, 0.42) * (0.75 + 0.5 * f) * (0.55 + 0.45 * pow(mu, 0.4)); gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(sr, 48, 32), this.sunMat);
    // Corona glow: a camera-facing quad with an analytic radial falloff (reaches exactly zero at its edge).
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float a = pow(max(1.0 - r, 0.0), 2.2) * 0.32 + pow(max(1.0 - r, 0.0), 8.0) * 0.55; gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * a, 1.0); }' }));
    this.glow.scale.setScalar(sr * 6); this.group.add(this.glow);
    this.group.add(this.sun);
  }

  /** Ecliptic AU (x, y) to world. */
  toWorld(x: number, y: number, h = 0): THREE.Vector3 { return new THREE.Vector3(x * this.unitsPerAu, h, -y * this.unitsPerAu); }

  private addLine(id: string, pts: THREE.Vector3[], closed: boolean, s: LineStyle) {
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
    const segs = s.segments ?? Math.max(64, pts.length * 2), radial = 6;
    const geo = new THREE.TubeGeometry(curve, segs, (s.radius ?? 0.004) * this.unitsPerAu, radial, closed);
    const base = new THREE.Color(s.color);
    const mat = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(s.intensity ?? 1), transparent: true, opacity: s.opacity ?? 1, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2;
    this.group.add(mesh);
    this.lines.set(id, { mesh, mat, base, intensity: s.intensity ?? 1, segs, radial, closed });
    return mesh;
  }
  /** Closed Kepler ellipse; drawing starts at `startLonDeg` and runs prograde. */
  addEllipse(id: string, a: number, e: number, periLonDeg: number, s: LineStyle & { startLonDeg?: number }) {
    const n = 360, start = s.startLonDeg ?? 0, pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) { const [x, y] = ellipsePoint(a, e, periLonDeg, start + i * 360 / n); pts.push(this.toWorld(x, y)); }
    return this.addLine(id, pts, true, { segments: 720, ...s });
  }
  /** Open path through sampled AU points. */
  addPath(id: string, points: [number, number][], s: LineStyle) {
    return this.addLine(id, points.map(([x, y]) => this.toWorld(x, y)), false, s);
  }
  /** Fraction (0..1) of a line drawn from its start. */
  setDraw(id: string, fraction: number) {
    const L = this.lines.get(id); if (!L) return;
    const f = Math.min(1, Math.max(0, fraction));
    L.mesh.visible = f > 0.0005;
    L.mesh.geometry.setDrawRange(0, Math.floor(f * L.segs) * L.radial * 6);
  }
  /** Brightness multiplier and opacity. */
  setGlow(id: string, k: number, opacity?: number) {
    const L = this.lines.get(id); if (!L) return;
    L.mat.color.copy(L.base).multiplyScalar(L.intensity * k);
    if (opacity !== undefined) L.mat.opacity = opacity;
  }
  addBody(id: string, obj: THREE.Object3D) { this.bodies.set(id, obj); this.group.add(obj); return obj; }
  setBody(id: string, x: number, y: number, visible = true) {
    const b = this.bodies.get(id); if (!b) return;
    b.visible = visible; b.position.copy(this.toWorld(x, y));
  }
  /** Pass the camera so the Sun's corona quad faces it. */
  update(time_s: number, camera?: THREE.Camera) {
    this.sunMat.uniforms.uTime.value = time_s;
    if (camera) this.glow.quaternion.copy(camera.quaternion).premultiply(this.group.getWorldQuaternion(new THREE.Quaternion()).invert());
  }
}
