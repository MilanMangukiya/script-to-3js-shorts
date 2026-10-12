import * as THREE from 'three';

export interface SkyDomeOptions {
  radius?: number;
  zenithColor?: THREE.ColorRepresentation; horizonColor?: THREE.ColorRepresentation; groundColor?: THREE.ColorRepresentation;
  /** Unit vector toward the sun (or moon). */
  sunDirection?: THREE.Vector3; sunColor?: THREE.ColorRepresentation;
  /** Sun disc angular radius in radians and wide glow strength. */
  sunSize?: number; sunGlow?: number; sunIntensity?: number;
  /** Horizon haze colour/amount. */
  hazeColor?: THREE.ColorRepresentation; hazeAmount?: number;
  /** Gradient exponent: <1 keeps the horizon colour higher into the sky. */
  curve?: number;
}

/**
 * Gradient sky dome with sun disc/glow and horizon haze. `scatter` scales scattered skylight only
 * (not the direct sun), so it can represent a thinner or denser atmosphere.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(o: SkyDomeOptions = {}) {
    this.uniforms = {
      uZenith: { value: new THREE.Color(o.zenithColor ?? 0x24427a) }, uHorizon: { value: new THREE.Color(o.horizonColor ?? 0xa9c4e0) },
      uGround: { value: new THREE.Color(o.groundColor ?? 0x3a4654) },
      uSunDir: { value: (o.sunDirection ?? new THREE.Vector3(0.3, 0.4, -0.8)).clone().normalize() },
      uSunColor: { value: new THREE.Color(o.sunColor ?? 0xfff0d0) }, uSunSize: { value: o.sunSize ?? 0.0047 },
      uSunGlow: { value: o.sunGlow ?? 0.35 }, uSunIntensity: { value: o.sunIntensity ?? 18 },
      uHaze: { value: new THREE.Color(o.hazeColor ?? 0xd9c8b4) }, uHazeAmount: { value: o.hazeAmount ?? 0.35 },
      uCurve: { value: o.curve ?? 0.55 }, uScatter: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: this.uniforms,
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,0.0); gl_Position = projectionMatrix*vec4(p.xyz,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor, uHaze;
        uniform float uSunSize, uSunGlow, uSunIntensity, uHazeAmount, uCurve, uScatter;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), uCurve));
          col = mix(col, uGround, smoothstep(0.0, -0.3, h));
          col = mix(col, uHaze, uHazeAmount * exp(-abs(h)*7.0));
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunColor * uSunGlow * (pow(sd, 6.0)*0.35 + pow(sd, 60.0)*0.9);   // scattered aureole
          col *= uScatter;
          float ang = acos(clamp(sd, -1.0, 1.0));
          col += uSunColor * uSunIntensity * smoothstep(uSunSize*1.25, uSunSize*0.85, ang) * step(-0.02, h);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(o.radius ?? 1, 48, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
  }

  /**
   * Bake this sky into a prefiltered environment map so PBR materials (metal, clearcoat) reflect it.
   * The sun disc is dimmed during the bake to avoid fireflies; pair with a DirectionalLight for the direct sun.
   */
  toEnvironment(renderer: THREE.WebGLRenderer, sunDiscScale = 0.08): THREE.Texture {
    const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene();
    sc.add(new THREE.Mesh(this.mesh.geometry, this.mesh.material));
    const keep = this.uniforms.uSunIntensity.value;
    this.uniforms.uSunIntensity.value = keep * sunDiscScale;
    const tex = pm.fromScene(sc, 0, 0.1, 100).texture;
    this.uniforms.uSunIntensity.value = keep;
    pm.dispose();
    return tex;
  }

  /** Scattered-skylight multiplier (1 = normal atmosphere). */
  set scatter(v: number) { this.uniforms.uScatter.value = v; }
  /** Keep the dome centred on the camera so it behaves as an infinitely distant backdrop. */
  follow(camera: THREE.Camera) { this.mesh.position.copy(camera.position); }
}
