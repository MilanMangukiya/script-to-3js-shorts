import * as THREE from 'three';
import { SkyDome } from './SkyDome';

/**
 * sun-skylight-rig-v1 — outdoor light split into its physical parts so a story can change one of them:
 * direct sun (shadow-casting DirectionalLight scaled by the visible disc fraction), scattered skylight (visible
 * SkyDome plus its share of the environment bake), sunlit-ground bounce (the bake's lower hemisphere), and aerial
 * haze (FogExp2). The sun disc is a world-space billboard at true angular size, depth-tested so sea or terrain
 * clips it at the real horizon. Every call to apply() sets the full state from its arguments only; environment
 * bakes are cached by quantised state, so a frame renders the same after any seek order.
 */
export interface SunSkylightRigOptions {
  zenithColor?: THREE.ColorRepresentation; horizonColor?: THREE.ColorRepresentation;
  hazeColor?: THREE.ColorRepresentation; hazeAmount?: number; sunGlow?: number;
  /** Radiance of sunlit ground in the environment bake (lower hemisphere at groundAmount = 1). */
  groundColor?: THREE.ColorRepresentation;
  /** Sun disc angular radius in radians (0.00465 = 0.2665 degrees) and billboard distance in scene units. */
  discAngularRadius?: number; discDistance?: number;
  /** HDR multiplier of the disc colour. */
  discRadiance?: number;
  /** Round in-eye glare around the disc: angular radius (radians) and peak HDR value (keep below the bloom threshold). */
  glareAngularRadius?: number; glareStrength?: number;
  shadowMapSize?: number;
  /** Number of cached environment bakes kept before the oldest is disposed. */
  envCacheSize?: number;
}

export interface SunSkylightState {
  /** Unit vector toward the sun. */
  sunDirection: THREE.Vector3;
  /** DirectionalLight intensity with the whole disc above the horizon. */
  sunIntensity: number;
  sunColor?: THREE.ColorRepresentation;
  /** Apparent horizon elevation in radians (negative below eye level) used for the visible disc fraction. */
  horizon?: number;
  /** 0..1 scattered skylight (1 = normal clear sky, 0 = black sky). */
  skyAmount: number;
  /** 0..1 sunlit-ground radiance in the environment. */
  groundAmount: number;
  envIntensity: number;
  /** FogExp2 density applied at skyAmount 1 (scaled by skyAmount: haze is scattering too). */
  hazeDensity: number;
  /** Centre and half-extents of the shadow-map box. */
  focus: THREE.Vector3; shadowHalfWidth: number; shadowHalfHeight: number; shadowDepth: number;
}

export class SunSkylightRig {
  readonly dome: SkyDome;
  readonly sun = new THREE.DirectionalLight(0xffffff, 1);
  readonly disc: THREE.Mesh;
  readonly glare: THREE.Mesh;
  /** Visible fraction of the disc after the last apply(). */
  discFractionNow = 1;
  private envDome: SkyDome;
  private envScene = new THREE.Scene();
  private pmrem: THREE.PMREMGenerator;
  private cache = new Map<string, THREE.WebGLRenderTarget>();
  private fog: THREE.FogExp2;
  private o: Required<Omit<SunSkylightRigOptions, 'zenithColor' | 'horizonColor' | 'hazeColor' | 'groundColor'>> & { zenith: THREE.Color; horizon: THREE.Color; haze: THREE.Color; ground: THREE.Color };

  constructor(scene: THREE.Scene, private renderer: THREE.WebGLRenderer, opts: SunSkylightRigOptions = {}) {
    this.o = {
      zenith: new THREE.Color(opts.zenithColor ?? 0x3f78c9), horizon: new THREE.Color(opts.horizonColor ?? 0xa9c9ea),
      haze: new THREE.Color(opts.hazeColor ?? 0xd3e2f0), ground: new THREE.Color(opts.groundColor ?? 0x6f6a62),
      hazeAmount: opts.hazeAmount ?? 0.25, sunGlow: opts.sunGlow ?? 0.35,
      discAngularRadius: opts.discAngularRadius ?? 0.00465, discDistance: opts.discDistance ?? 9000,
      discRadiance: opts.discRadiance ?? 40, glareAngularRadius: opts.glareAngularRadius ?? 0.045, glareStrength: opts.glareStrength ?? 1.2, shadowMapSize: opts.shadowMapSize ?? 4096, envCacheSize: opts.envCacheSize ?? 8,
    };
    const domeOpts = { zenithColor: this.o.zenith, horizonColor: this.o.horizon, hazeColor: this.o.haze, hazeAmount: this.o.hazeAmount,
      groundColor: this.o.ground, sunGlow: this.o.sunGlow, sunIntensity: 0 };
    this.dome = new SkyDome(domeOpts);
    this.envDome = new SkyDome(domeOpts);
    this.envScene.add(new THREE.Mesh(this.envDome.mesh.geometry, this.envDome.mesh.material));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.fog = new THREE.FogExp2(this.o.haze.getHex(), 0);
    scene.fog = this.fog;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.o.shadowMapSize, this.o.shadowMapSize);
    this.sun.shadow.bias = -0.00025; this.sun.shadow.normalBias = 0.025;
    const radius = this.o.discDistance * Math.tan(this.o.discAngularRadius);
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, fog: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1).multiplyScalar(this.o.discRadiance) } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; varying vec2 vP;
        void main(){ float r = clamp(length(vP) / ${radius.toFixed(4)}, 0.0, 1.0);
          float mu = sqrt(max(1.0 - r*r, 0.0));
          float limb = 1.0 - 0.6*(1.0 - mu);                       // mild limb darkening
          float edge = smoothstep(1.0, 0.94, r);
          gl_FragColor = vec4(uColor * limb * edge, edge); }`,
    }));
    this.disc.frustumCulled = false;
    this.disc.renderOrder = -80;
    const glareSize = this.o.discDistance * Math.tan(this.o.glareAngularRadius);
    this.glare = new THREE.Mesh(new THREE.PlaneGeometry(2 * glareSize, 2 * glareSize), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, fog: false, blending: THREE.AdditiveBlending,
      uniforms: { uStrength: { value: this.o.glareStrength } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uStrength; varying vec2 vUv;
        void main(){ float r = length(vUv);
          float g = (0.62 * exp(-r * 11.0) + 0.3 * exp(-r * 4.0) + 0.08 * exp(-r * 1.6)) * (1.0 - smoothstep(0.75, 1.0, r));
          gl_FragColor = vec4(vec3(1.0, 0.99, 0.97) * g * uStrength, 1.0); }`,
    }));
    this.glare.frustumCulled = false;
    this.glare.renderOrder = -79;
    scene.add(this.dome.mesh, this.sun, this.sun.target, this.disc, this.glare);
  }

  /** Visible fraction of a disc of angular radius r whose centre is at `altitude` above a horizon line at `horizon`. */
  static discFraction(altitude: number, horizon: number, r: number): number {
    const d = (altitude - horizon) / r;
    if (d >= 1) return 1;
    if (d <= -1) return 0;
    const a = -d;
    return (Math.acos(a) - a * Math.sqrt(1 - a * a)) / Math.PI;
  }

  private environment(sky: number, ground: number, dir: THREE.Vector3): THREE.Texture | null {
    if (sky <= 1e-4 && ground <= 1e-4) return null;
    const key = `${sky.toFixed(3)}|${ground.toFixed(3)}|${dir.x.toFixed(2)},${dir.y.toFixed(2)},${dir.z.toFixed(2)}`;
    let target = this.cache.get(key);
    if (!target) {
      const u = this.envDome.uniforms;
      (u.uZenith.value as THREE.Color).copy(this.o.zenith).multiplyScalar(sky);
      (u.uHorizon.value as THREE.Color).copy(this.o.horizon).multiplyScalar(sky);
      (u.uHaze.value as THREE.Color).copy(this.o.haze).multiplyScalar(sky);
      (u.uGround.value as THREE.Color).copy(this.o.ground).multiplyScalar(ground);
      u.uSunGlow.value = this.o.sunGlow * sky; u.uSunIntensity.value = 0; u.uScatter.value = 1;
      (u.uSunDir.value as THREE.Vector3).copy(dir);
      target = this.pmrem.fromScene(this.envScene, 0, 0.1, 100);
      this.cache.set(key, target);
      while (this.cache.size > this.o.envCacheSize) {
        const [oldKey, old] = this.cache.entries().next().value as [string, THREE.WebGLRenderTarget];
        old.dispose(); this.cache.delete(oldKey);
      }
    }
    return target.texture;
  }

  apply(scene: THREE.Scene, camera: THREE.Camera, s: SunSkylightState) {
    const dir = s.sunDirection.clone().normalize(), sky = THREE.MathUtils.clamp(s.skyAmount, 0, 1);
    const altitude = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    const f = SunSkylightRig.discFraction(altitude, s.horizon ?? 0, this.o.discAngularRadius);
    this.discFractionNow = f;
    this.sun.color.set(s.sunColor ?? 0xffffff);
    this.sun.intensity = s.sunIntensity * f;
    this.sun.target.position.copy(s.focus);
    this.sun.position.copy(s.focus).addScaledVector(dir, s.shadowDepth * 0.5);
    const c = this.sun.shadow.camera;
    c.left = -s.shadowHalfWidth; c.right = s.shadowHalfWidth; c.top = s.shadowHalfHeight; c.bottom = -s.shadowHalfHeight;
    c.near = 0.5; c.far = s.shadowDepth; c.updateProjectionMatrix();
    this.sun.target.updateMatrixWorld(); this.sun.updateMatrixWorld();

    this.dome.scatter = sky;
    (this.dome.uniforms.uSunDir.value as THREE.Vector3).copy(dir);
    this.dome.uniforms.uSunIntensity.value = 0;
    this.dome.follow(camera);

    this.disc.visible = f > 0;
    this.disc.position.copy(camera.position).addScaledVector(dir, this.o.discDistance);
    this.disc.quaternion.copy(camera.quaternion);
    this.glare.visible = f > 0;
    this.glare.position.copy(camera.position).addScaledVector(dir, this.o.discDistance * 0.999);
    this.glare.quaternion.copy(camera.quaternion);
    (this.glare.material as THREE.ShaderMaterial).uniforms.uStrength.value = this.o.glareStrength * Math.sqrt(f); // glare is perceived roughly logarithmically

    const env = this.environment(sky, THREE.MathUtils.clamp(s.groundAmount, 0, 1), dir);
    scene.environment = env;
    scene.environmentIntensity = env ? s.envIntensity : 0;
    this.fog.density = s.hazeDensity * sky;
    scene.fog = this.fog;
  }
}
