import * as THREE from 'three';

export interface DialMark { value: number; color: string; label?: string }
export interface DialGaugeOptions {
  /** Dial face radius in metres. */
  radius?: number;
  /** Value range and the total needle sweep in degrees (centred on 12 o'clock, clockwise = increasing). */
  min?: number; max?: number; arcDegrees?: number;
  majorStep?: number; minorStep?: number; labelStep?: number;
  /** Small unit text under the hub and an optional title above it. */
  unit?: string; title?: string;
  /** Coloured tick marks with optional short labels (e.g. a boiling point). */
  marks?: DialMark[];
  bezel?: 'brass' | 'steel' | 'black';
  faceColor?: string; inkColor?: string; needleColor?: THREE.ColorRepresentation;
  /** Case depth behind the face, metres. */
  depth?: number;
  /** Optional probe stem hanging below the case (thermometers), length and radius in metres. */
  stemLength?: number; stemRadius?: number;
  fontFamily?: string;
}

const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

/**
 * Analog dial gauge for barometers, thermometers and pressure gauges: canvas-drawn face with ticks, labels and
 * coloured marks, metal bezel, glass cover, tapered needle and an optional probe stem. The face points along +Z.
 * `value` is a plain setter (no internal time), so a stage can drive it from any deterministic function.
 */
export class DialGauge {
  readonly group = new THREE.Group();
  private needle = new THREE.Group();
  private o: Required<Omit<DialGaugeOptions, 'title' | 'marks' | 'needleColor'>> & Pick<DialGaugeOptions, 'title' | 'marks' | 'needleColor'>;

  constructor(opts: DialGaugeOptions = {}) {
    const o = this.o = {
      radius: 0.03, min: 0, max: 100, arcDegrees: 270, majorStep: 10, minorStep: 2, labelStep: 20, unit: '', depth: 0.012,
      bezel: 'steel', faceColor: '#F3EEDF', inkColor: '#1E1B17', stemLength: 0, stemRadius: 0.0025, fontFamily: FONT, ...opts,
    } as any;
    const R = o.radius;
    const metal = o.bezel === 'brass' ? new THREE.MeshStandardMaterial({ color: 0xb58b45, roughness: 0.3, metalness: 0.95 })
      : o.bezel === 'black' ? new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.45, metalness: 0.2 })
      : new THREE.MeshStandardMaterial({ color: 0xd4d8dd, roughness: 0.22, metalness: 1.0 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.08, R * 1.1, o.depth, 64).rotateX(Math.PI / 2), metal);
    body.position.z = -o.depth / 2; body.castShadow = true; this.group.add(body);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(R * 1.04, R * 0.075, 16, 96), metal);
    bezel.position.z = 0.0015; bezel.castShadow = true; this.group.add(bezel);

    // Face texture.
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N / 2);
    grad.addColorStop(0, o.faceColor); grad.addColorStop(1, shade(o.faceColor, -0.09));
    g.fillStyle = grad; g.fillRect(0, 0, N, N);
    g.translate(N / 2, N / 2); g.textAlign = 'center'; g.textBaseline = 'middle';
    const rad = (v: number) => THREE.MathUtils.degToRad(this.angleDeg(v));
    const at = (v: number, r: number): [number, number] => [Math.sin(rad(v)) * r, -Math.cos(rad(v)) * r];
    for (const m of o.marks ?? []) {   // coloured band segments behind the ticks
      g.strokeStyle = m.color; g.lineWidth = 26; g.beginPath();
      g.arc(0, 0, 452, rad(m.value) - Math.PI / 2 - 0.035, rad(m.value) - Math.PI / 2 + 0.035); g.stroke();
    }
    g.strokeStyle = o.inkColor; g.fillStyle = o.inkColor; g.lineCap = 'round';
    const eps = 1e-6;
    for (let v = o.min; v <= o.max + eps; v += o.minorStep) {
      const major = Math.abs(v / o.majorStep - Math.round(v / o.majorStep)) < 1e-4;
      const [x1, y1] = at(v, major ? 392 : 418), [x2, y2] = at(v, 462);
      g.lineWidth = major ? 9 : 4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      if (Math.abs(v / o.labelStep - Math.round(v / o.labelStep)) < 1e-4) {
        g.font = `600 78px ${o.fontFamily}`; const [x, y] = at(v, 318); g.fillText(fmt(v), x, y);
      }
    }
    for (const m of o.marks ?? []) {
      g.strokeStyle = m.color; g.lineWidth = 12; const [x1, y1] = at(m.value, 370), [x2, y2] = at(m.value, 466);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      if (m.label) { g.fillStyle = m.color; g.font = `700 50px ${o.fontFamily}`; const [x, y] = at(m.value, 238); g.fillText(m.label, x, y); }
    }
    g.fillStyle = shade(o.inkColor, 0.25);
    if (o.unit) { g.font = `600 64px ${o.fontFamily}`; g.fillText(o.unit, 0, 200); }
    if (o.title) { g.font = `600 40px ${o.fontFamily}`; g.fillText(o.title, 0, -168); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    const face = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0 }));
    face.receiveShadow = true; this.group.add(face);

    // Tapered needle with a counterweight tail; hub cap.
    const shape = new THREE.Shape();
    shape.moveTo(-R * 0.035, -R * 0.2); shape.lineTo(R * 0.035, -R * 0.2); shape.lineTo(R * 0.012, R * 0.86); shape.lineTo(0, R * 0.9); shape.lineTo(-R * 0.012, R * 0.86); shape.closePath();
    const needleMat = new THREE.MeshStandardMaterial({ color: o.needleColor ?? 0xb3262a, roughness: 0.4, metalness: 0.3 });
    const nm = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: R * 0.02, bevelEnabled: false }), needleMat);
    nm.castShadow = true; this.needle.add(nm);
    this.needle.position.z = R * 0.03; this.group.add(this.needle);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.07, R * 0.07, R * 0.05, 24).rotateX(Math.PI / 2), metal);
    hub.position.z = R * 0.06; this.group.add(hub);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(R * 1.0, 64), new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false,
    }));
    glass.position.z = R * 0.1; glass.renderOrder = 6; this.group.add(glass);
    if (o.stemLength > 0) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(o.stemRadius, o.stemRadius * 0.7, o.stemLength, 16).translate(0, -o.stemLength / 2, 0), metal);
      stem.position.set(0, -R * 1.05, -o.depth / 2); stem.castShadow = true; this.group.add(stem);
    }
    this.value = o.min;
  }

  /** Needle angle in degrees clockwise from 12 o'clock for a value (clamped to the scale). */
  angleDeg(v: number): number {
    const o = this.o, u = THREE.MathUtils.clamp((v - o.min) / (o.max - o.min), 0, 1);
    return -o.arcDegrees / 2 + u * o.arcDegrees;
  }
  set value(v: number) { this.needle.rotation.z = -THREE.MathUtils.degToRad(this.angleDeg(v)); }
}

function fmt(v: number) { return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1); }
function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  if (k < 0) c.multiplyScalar(1 + k); else c.lerp(new THREE.Color(1, 1, 1), k);
  return `#${c.getHexString()}`;
}
