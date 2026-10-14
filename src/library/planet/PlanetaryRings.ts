import * as THREE from 'three';

/**
 * planetary-ring-system-v1 — Procedural Multi-Band Planetary Ring System
 *
 * Supports both orbital globe views (wrapping `earth-globe-v1`) and terrestrial sky views
 * (arching across `sky-dome-v1`).
 * - Procedural radial band shader with Cassini-style divisions, ice/rock albedo tinting,
 *   and real-time planetary shadow cutout on the night side.
 */

export interface PlanetaryRingsOptions {
  innerRadius?: number;
  outerRadius?: number;
  planetRadius?: number;
  tiltDeg?: number;
  sunDirection?: [number, number, number] | THREE.Vector3;
  colorInner?: string;
  colorOuter?: string;
  opacity?: number;
  seed?: number;
  time_s?: number;
}

const RING_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vLocalXY;

  void main() {
    vLocalXY = position.xy;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const RING_FRAGMENT_SHADER = /* glsl */ `
  uniform float uInnerRadius;
  uniform float uOuterRadius;
  uniform float uPlanetRadius;
  uniform vec3 uSunDir;
  uniform vec3 uColorInner;
  uniform vec3 uColorOuter;
  uniform float uOpacity;
  uniform float uSeed;

  varying vec3 vWorldPos;
  varying vec2 vLocalXY;

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  void main() {
    float r = length(vLocalXY);
    float u = clamp((r - uInnerRadius) / max(0.0001, uOuterRadius - uInnerRadius), 0.0, 1.0);
    if (u <= 0.0 || u >= 1.0) discard;

    // Multi-frequency concentric ringlets + Cassini-style gap around u = 0.62..0.67
    float bands = 0.55
      + 0.25 * sin(u * 95.0 + uSeed)
      + 0.15 * sin(u * 240.0 + uSeed * 2.1)
      + 0.08 * cos(u * 520.0);

    float cassiniGap = smoothstep(0.0, 0.025, abs(u - 0.645) - 0.018);
    float enckeGap = smoothstep(0.0, 0.012, abs(u - 0.86) - 0.006);
    float edgeFade = smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.95, u);

    float density = clamp(bands * cassiniGap * enckeGap * edgeFade, 0.0, 1.0);
    if (density < 0.02) discard;

    // Planetary cylinder shadow on the anti-solar side of the globe
    vec3 sunN = normalize(uSunDir);
    float alongSun = dot(vWorldPos, sunN);
    vec3 perpVec = vWorldPos - alongSun * sunN;
    float perpDist = length(perpVec);
    float inShadow = 1.0;
    if (alongSun < 0.0 && uPlanetRadius > 0.0) {
      inShadow = smoothstep(uPlanetRadius * 0.96, uPlanetRadius * 1.04, perpDist);
    }

    vec3 baseCol = mix(uColorInner, uColorOuter, smoothstep(0.15, 0.85, u));
    vec3 finalCol = baseCol * (0.14 + 0.86 * inShadow);

    gl_FragColor = vec4(finalCol, density * uOpacity);
  }
`;

export class PlanetaryRings {
  public readonly group = new THREE.Group();
  public readonly mesh: THREE.Mesh;
  public readonly material: THREE.ShaderMaterial;

  constructor(options: PlanetaryRingsOptions = {}) {
    const innerRadius = options.innerRadius ?? 1.38;
    const outerRadius = options.outerRadius ?? 2.45;
    const planetRadius = options.planetRadius ?? 1.0;
    const tiltDeg = options.tiltDeg ?? 23.4;

    const sunDir = new THREE.Vector3(1, 0.3, 0.5);
    if (Array.isArray(options.sunDirection)) {
      sunDir.fromArray(options.sunDirection).normalize();
    } else if (options.sunDirection instanceof THREE.Vector3) {
      sunDir.copy(options.sunDirection).normalize();
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: RING_VERTEX_SHADER,
      fragmentShader: RING_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uInnerRadius: { value: innerRadius },
        uOuterRadius: { value: outerRadius },
        uPlanetRadius: { value: planetRadius },
        uSunDir: { value: sunDir },
        uColorInner: { value: new THREE.Color(options.colorInner ?? '#D9C3A5') },
        uColorOuter: { value: new THREE.Color(options.colorOuter ?? '#E2E8F0') },
        uOpacity: { value: options.opacity ?? 0.88 },
        uSeed: { value: options.seed ?? 17.0 },
      },
    });

    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 128, 4);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.x = Math.PI * 0.5;
    this.group.add(this.mesh);

    this.group.rotation.z = (tiltDeg * Math.PI) / 180;
  }

  public setSunDirection(dir: [number, number, number] | THREE.Vector3): void {
    const uSun = this.material.uniforms.uSunDir.value as THREE.Vector3;
    if (Array.isArray(dir)) {
      uSun.fromArray(dir).normalize();
    } else {
      uSun.copy(dir).normalize();
    }
  }

  public setOpacity(opacity: number): void {
    this.material.uniforms.uOpacity.value = Math.max(0, Math.min(1, opacity));
  }

  public update(time_s: number): void {
    // Slow Keplerian visual rotation of the ring plane
    this.mesh.rotation.z = time_s * 0.035;
  }
}