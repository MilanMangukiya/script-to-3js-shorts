import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';
import { rng, fbm2 } from '../util/math';

export interface UnderwaterOptions {
  /** Sea-floor depth below the surface (surface is at local y = 0). */
  depth?: number;
  /** Horizontal half-extent of the dressed floor area in metres. */
  extent?: number;
  waterColor?: THREE.ColorRepresentation; deepColor?: THREE.ColorRepresentation; surfaceColor?: THREE.ColorRepresentation;
  /** Direction light travels from (toward the sun), used for shafts and shading. */
  sunDirection?: THREE.Vector3;
  rayStrength?: number; rayCount?: number;
  causticScale?: number; causticStrength?: number;
  fogDensity?: number;
  grassCount?: number; particleCount?: number; seed?: number;
  /** How many of the 16 seeded rocks to show (default all; the random sequence is unchanged either way). */
  rockCount?: number;
}

const CAUSTIC = /* glsl */ `
float causticLayer(vec2 p, float t){
  vec2 q = p + (vec2(fbm(p*0.8 + t*0.21), fbm(p*0.8 - t*0.17 + 5.2)) - 0.5) * 1.8;
  float n = vnoise(q*1.7 + vec2(t*0.12, -t*0.09));
  return pow(max(1.0 - abs(n*2.0 - 1.0), 0.0), 7.0);
}
float caustic(vec2 p, float t){ return causticLayer(p, t)*0.9 + causticLayer(p*1.7 + 3.1, t*1.3)*0.55; }
`;

/**
 * Shallow-sea environment seen from below the surface: rippling Snell-window surface, sun shafts, caustic-lit
 * sand and rocks, swaying seagrass, drifting particles and an optional bubble burst. Deterministic in `time_s`.
 * Add `group` to a scene; use `fogColor`/`fogDensity` for THREE.FogExp2 so standard materials match.
 */
export class Underwater {
  readonly group = new THREE.Group();
  readonly fogColor: THREE.Color;
  readonly fogDensity: number;
  private shared: Record<string, THREE.IUniform>;
  /** Gradient backdrop and water-surface meshes, exposed so a stage can hide them (e.g. above water or under an ice sheet). */
  backdrop!: THREE.Mesh; surface!: THREE.Mesh;
  private rays: { mesh: THREE.Mesh; top: THREE.Vector3 }[] = [];
  private floorSeed = 5;
  private rayDir = new THREE.Vector3();
  private bubbles: THREE.Points;
  private depth: number;

  constructor(o: UnderwaterOptions = {}) {
    const depth = (this.depth = o.depth ?? 9), ext = o.extent ?? 60, seed = (this.floorSeed = o.seed ?? 5), r = rng(seed);
    const water = new THREE.Color(o.waterColor ?? 0x1c6f86), deep = new THREE.Color(o.deepColor ?? 0x062a3c), surf = new THREE.Color(o.surfaceColor ?? 0x9fe6ee);
    const sun = (o.sunDirection ?? new THREE.Vector3(-0.35, 1, -0.25)).clone().normalize();
    this.rayDir.copy(sun).multiplyScalar(-1); // light travels downward
    this.fogColor = water.clone().multiplyScalar(0.62); this.fogDensity = o.fogDensity ?? 0.055;
    this.shared = {
      uTime: { value: 0 }, uFogColor: { value: this.fogColor }, uFogDensity: { value: this.fogDensity }, uSunDir: { value: sun },
      uCausticScale: { value: o.causticScale ?? 0.55 }, uCausticStrength: { value: o.causticStrength ?? 1.3 }, uDepth: { value: depth },
    };

    // Backdrop gradient (bright above, deep below).
    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { uUp: { value: surf.clone().multiplyScalar(0.55) }, uMid: { value: this.fogColor }, uDown: { value: deep } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,0.0); gl_Position = projectionMatrix*vec4(p.xyz,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 uUp, uMid, uDown; varying vec3 vDir; void main(){ float h = normalize(vDir).y; vec3 c = mix(uMid, uUp, smoothstep(0.0, 0.9, h)); c = mix(c, uDown, smoothstep(0.0, -0.7, h)); gl_FragColor = vec4(c,1.0); }`,
    }));
    back.frustumCulled = false; back.renderOrder = -100;
    this.group.add(back); this.backdrop = back;

    // Water surface from below.
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(ext * 8, ext * 8).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
      side: THREE.DoubleSide, fog: false, uniforms: { ...this.shared, uSurf: { value: surf }, uWater: { value: water } },
      vertexShader: `varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uFogDensity; uniform vec3 uFogColor, uSunDir, uSurf, uWater; varying vec3 vP;
        ${GLSL_NOISE}
        void main(){
          vec3 I = normalize(vP - cameraPosition); float dist = length(vP - cameraPosition);
          vec2 p = vP.xz;
          vec2 n = vec2(fbm(p*0.55 + uTime*0.35) - 0.5, fbm(p*0.55 - uTime*0.3 + 7.3) - 0.5) * 1.1
                 + vec2(sin(p.x*1.9 + uTime*1.4), cos(p.y*1.6 - uTime*1.1)) * 0.07;
          vec3 d = normalize(I + vec3(n.x, 0.0, n.y) * 0.55);
          float win = smoothstep(0.6, 0.72, d.y);                  // Snell's window (critical angle about 48.6 degrees)
          float sunSpot = pow(max(dot(d, uSunDir), 0.0), 26.0);
          vec3 inside = uSurf * (0.9 + 0.5*fbm(p*1.3 + uTime*0.5)) + vec3(1.0, 0.97, 0.88) * sunSpot * 3.0;
          vec3 outside = uWater * (0.32 + 0.4*smoothstep(0.2, 0.9, fbm(p*0.9 - uTime*0.25)));
          vec3 col = mix(outside, inside, win);
          float f = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist*0.35);
          gl_FragColor = vec4(mix(col, uFogColor, clamp(f, 0.0, 1.0)), 1.0);
        }`,
    }));
    surface.frustumCulled = false;
    this.group.add(surface); this.surface = surface;

    // Sea floor with gentle dunes.
    const fg = new THREE.PlaneGeometry(ext * 4, ext * 4, 180, 180).rotateX(-Math.PI / 2);
    const fp = fg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i); fp.setY(i, (fbm2(x / 9, z / 9, seed, 4) - 0.5) * 2.4 + (fbm2(x / 1.7, z / 1.7, seed + 4, 2) - 0.5) * 0.18); }
    fg.computeVertexNormals();
    const litVert = /* glsl */ `varying vec3 vP; varying vec3 vN;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`;
    const litFrag = (body: string) => /* glsl */ `
      uniform float uTime, uFogDensity, uCausticScale, uCausticStrength, uDepth; uniform vec3 uFogColor, uSunDir, uA, uB; varying vec3 vP; varying vec3 vN;
      ${GLSL_NOISE}${CAUSTIC}
      void main(){
        vec3 N = vN / max(length(vN), 1e-4); float dist = length(vP - cameraPosition);
        ${body}
        float up = clamp(N.y, 0.0, 1.0);
        float c = caustic(vP.xz*uCausticScale + uSunDir.xz*vP.y*0.3, uTime) * up;
        float depthFade = exp((vP.y) * 0.06);
        vec3 col = base * (vec3(0.16, 0.30, 0.34) + vec3(0.55, 0.75, 0.7) * max(dot(N, uSunDir), 0.0) * (0.55 + c*uCausticStrength)) * depthFade * 2.2;
        float f = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist);
        gl_FragColor = vec4(max(mix(col, uFogColor, clamp(f, 0.0, 1.0)), vec3(0.0)), 1.0);
      }`;
    const floor = new THREE.Mesh(fg, new THREE.ShaderMaterial({
      fog: false, uniforms: { ...this.shared, uA: { value: new THREE.Color(0xb9a784) }, uB: { value: new THREE.Color(0x5d5a50) } }, vertexShader: litVert,
      fragmentShader: litFrag(`float m = smoothstep(0.42, 0.7, fbm(vP.xz*0.22 + 3.0)); vec3 base = mix(uA, uB, m) * (0.85 + 0.3*fbm(vP.xz*4.0));`),
    }));
    floor.position.y = -depth;
    this.group.add(floor);

    // Rocks.
    const rockMat = new THREE.ShaderMaterial({ fog: false, uniforms: { ...this.shared, uA: { value: new THREE.Color(0x4f5148) }, uB: { value: new THREE.Color(0x2c3a34) } }, vertexShader: litVert,
      fragmentShader: litFrag(`vec3 base = mix(uA, uB, fbm(vP.xz*1.5 + vP.y)) * (0.8 + 0.4*fbm(vP.xy*5.0));`) });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position as THREE.BufferAttribute, s0 = r() * 100;
      for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(p, k); const n = fbm2(v.x * 1.4 + s0, v.y * 1.4 + v.z * 1.4, seed + i, 3); v.multiplyScalar(0.72 + n * 0.6); p.setXYZ(k, v.x, v.y, v.z); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rockMat), sc = 0.6 + r() * 1.9;
      m.scale.set(sc * (0.8 + r() * 0.7), sc * (0.45 + r() * 0.5), sc * (0.8 + r() * 0.7));
      m.position.set((r() - 0.5) * ext * 0.9, -depth + sc * 0.15, -r() * ext * 0.6 + 6); m.rotation.y = r() * 6.28;
      if (i < (o.rockCount ?? 16)) this.group.add(m);
    }

    // Seagrass.
    const nGrass = o.grassCount ?? 1600;
    const blade = new THREE.PlaneGeometry(0.075, 1, 1, 7).translate(0, 0.5, 0);
    const phases = new Float32Array(nGrass);
    const grass = new THREE.InstancedMesh(blade, new THREE.ShaderMaterial({
      side: THREE.DoubleSide, fog: false, uniforms: { ...this.shared },
      vertexShader: /* glsl */ `attribute float aPhase; uniform float uTime; varying vec3 vP; varying float vH;
        void main(){ vec3 p = position; vH = p.y;
          vec4 w = modelMatrix*instanceMatrix*vec4(p,1.0);
          float sway = sin(uTime*1.25 + aPhase + w.x*0.35) * 0.22 + sin(uTime*0.6 + aPhase*1.7) * 0.12;
          w.x += sway * p.y * p.y; w.z += cos(uTime*0.9 + aPhase) * 0.08 * p.y * p.y;
          vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `uniform float uFogDensity; uniform vec3 uFogColor; varying vec3 vP; varying float vH;
        void main(){ float dist = length(vP - cameraPosition); vec3 col = mix(vec3(0.02, 0.09, 0.05), vec3(0.2, 0.42, 0.16), vH) * 1.5;
          float f = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist); gl_FragColor = vec4(mix(col, uFogColor, clamp(f,0.0,1.0)), 1.0); }`,
    }), nGrass);
    const dummy = new THREE.Object3D();
    let placed = 0, guard = 0;
    while (placed < nGrass && guard++ < nGrass * 30) {
      const x = (r() - 0.5) * ext * 0.95, z = -r() * ext * 0.7 + 7;
      if (fbm2(x / 5.5, z / 5.5, seed + 77, 3) < 0.5) continue;
      const y = -depth + (fbm2(x / 9, z / 9, seed, 4) - 0.5) * 2.4;
      dummy.position.set(x, y - 0.03, z); dummy.rotation.set(0, r() * 6.28, (r() - 0.5) * 0.25); dummy.scale.set(1 + r() * 0.8, 0.5 + r() * 1.3, 1); dummy.updateMatrix();
      grass.setMatrixAt(placed, dummy.matrix); phases[placed] = r() * 6.28; placed++;
    }
    grass.count = placed;
    blade.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    grass.frustumCulled = false;
    this.group.add(grass);

    // Light shafts (re-oriented toward the camera each frame around the ray axis).
    const nRays = o.rayCount ?? 16;
    const rayMat = () => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uTime: this.shared.uTime, uSeed: { value: r() * 50 }, uStrength: { value: o.rayStrength ?? 0.5 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime, uSeed, uStrength; varying vec2 vUv;
        ${GLSL_NOISE}
        void main(){ float edge = 1.0 - abs(vUv.x - 0.5)*2.0;
          float stripes = fbm(vec2(vUv.x*5.0 + uSeed, uTime*0.22 + uSeed)) ;
          float a = smoothstep(0.0, 0.9, edge) * smoothstep(0.3, 0.75, stripes) * pow(max(vUv.y, 0.0), 1.6) * smoothstep(1.0, 0.94, vUv.y);
          a *= 0.75 + 0.25*sin(uTime*0.8 + uSeed);
          gl_FragColor = vec4(vec3(0.55, 0.95, 0.9) * a * uStrength, a); }`,
    });
    for (let i = 0; i < nRays; i++) {
      const len = depth * 1.25, mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + r() * 2.0, len).translate(0, -len / 2, 0), rayMat());
      mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.renderOrder = 5;
      const top = new THREE.Vector3((r() - 0.5) * 34, 0, -r() * 30 + 6);
      this.rays.push({ mesh, top }); this.group.add(mesh);
    }

    // Drifting particles ("marine snow").
    const nP = o.particleCount ?? 1600, pp = new Float32Array(nP * 3), ps = new Float32Array(nP);
    for (let i = 0; i < nP; i++) { pp.set([(r() - 0.5) * 30, -r() * depth, (r() - 0.5) * 30 - 4], i * 3); ps[i] = r() * 6.28; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(ps, 1));
    const particles = new THREE.Points(pg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uTime: this.shared.uTime },
      vertexShader: `attribute float aSeed; uniform float uTime; varying float vA;
        void main(){ vec3 p = position; p.x += sin(uTime*0.3 + aSeed)*0.4; p.y += sin(uTime*0.22 + aSeed*2.0)*0.25 - uTime*0.02; p.z += cos(uTime*0.25 + aSeed*1.3)*0.4;
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; float d = -mv.z; gl_PointSize = clamp(26.0/d, 1.0, 9.0); vA = smoothstep(26.0, 3.0, d) * smoothstep(0.3, 1.2, d); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0, 0.1, d)*vA*0.32; gl_FragColor = vec4(vec3(0.7,0.95,0.92)*a, a); }`,
    }));
    particles.frustumCulled = false;
    this.group.add(particles);

    // Bubble burst (inactive until setBubbleBurst is called).
    const nB = 90, bp = new Float32Array(nB * 3), bs = new Float32Array(nB * 4);
    for (let i = 0; i < nB; i++) { bp.set([(r() - 0.5) * 1.6, -r() * 1.6, (r() - 0.5) * 1.6], i * 3); bs.set([r() * 0.6, 0.7 + r() * 1.1, r() * 6.28, 0.5 + r()], i * 4); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.setAttribute('aB', new THREE.BufferAttribute(bs, 4));
    this.bubbles = new THREE.Points(bg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uTime: this.shared.uTime, uT0: { value: 1e9 }, uOrigin: { value: new THREE.Vector3() } },
      vertexShader: `attribute vec4 aB; uniform float uTime, uT0; uniform vec3 uOrigin; varying float vA;
        void main(){ float age = uTime - uT0 - aB.x; vec3 p = uOrigin + position; p.y += max(age, 0.0)*aB.y; p.x += sin(age*5.0 + aB.z)*0.07; p.z += cos(age*4.3 + aB.z)*0.07;
          vA = step(0.0, age) * smoothstep(0.0, -0.4, p.y) * smoothstep(3.2, 0.6, age);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(34.0*aB.w/(-mv.z), 1.5, 26.0); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float ring = smoothstep(1.0, 0.82, d)*smoothstep(0.45, 0.85, d) + smoothstep(0.35, 0.0, length(gl_PointCoord-vec2(0.36,0.34))*2.0)*0.8;
          float a = ring*vA*0.75; gl_FragColor = vec4(vec3(0.8,1.0,1.0)*a, a); }`,
    }));
    this.bubbles.frustumCulled = false;
    this.group.add(this.bubbles);
  }

  /** Release a burst of bubbles from `origin` (local coordinates) starting at absolute time `t0`. */
  setBubbleBurst(t0: number, origin: THREE.Vector3) {
    const u = (this.bubbles.material as THREE.ShaderMaterial).uniforms; u.uT0.value = t0; u.uOrigin.value.copy(origin);
  }

  /** Exact sea-floor height (group-local y) at x, z, for seating props such as corals on the sand. */
  floorHeight(x: number, z: number) {
    const seed = this.floorSeed;
    return -this.depth + (fbm2(x / 9, z / 9, seed, 4) - 0.5) * 2.4 + (fbm2(x / 1.7, z / 1.7, seed + 4, 2) - 0.5) * 0.18;
  }

  update(time_s: number, camera: THREE.Camera) {
    this.shared.uTime.value = time_s;
    const axis = this.rayDir, x = new THREE.Vector3(), z = new THREE.Vector3(), up = axis.clone().multiplyScalar(-1), m = new THREE.Matrix4(), toCam = new THREE.Vector3();
    for (const ray of this.rays) {
      toCam.copy(camera.position).sub(ray.top);
      x.crossVectors(up, toCam).normalize(); z.crossVectors(x, up).normalize();
      m.makeBasis(x, up, z); m.setPosition(ray.top);
      ray.mesh.matrix.copy(m); ray.mesh.matrixWorldNeedsUpdate = true;
    }
  }
}
