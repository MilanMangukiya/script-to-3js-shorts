import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { Flame } from '../../../library/fx/Flame';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { SkyDome } from '../../../library/environment/SkyDome';
import { Starfield } from '../../../library/space/Starfield';
import { Humanoid, POSE_SIT, lerpPose } from '../../../library/characters/Humanoid';
import { GLSL_NOISE } from '../../../library/util/glsl';
import { rng, ramp, smoothstep, wobble, clamp, fbm2 } from '../../../library/util/math';
import { T } from '../timeline';

/** Night campfire with two seated campers (metres). S05: the flames vanish. S08/SH01: embers reignite. */
export class CampfireStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 9 / 16, 0.1, 3000);
  private flames: { f: Flame; seed: number }[] = [];
  private fireLight: THREE.PointLight; private emberLight: THREE.PointLight;
  private emberBed: THREE.ShaderMaterial; private logMat: THREE.MeshStandardMaterial;
  private sparks: THREE.ShaderMaterial; private smokes: SmokeWisp[] = [];
  private campers: Humanoid[] = []; private stars: Starfield;

  constructor() {
    const s = this.scene, r = rng(5);
    const sky = new SkyDome({ zenithColor: 0x040813, horizonColor: 0x0f1b33, groundColor: 0x05070c, hazeColor: 0x1a2a4a, hazeAmount: 0.4, sunIntensity: 0, sunGlow: 0, curve: 0.6 });
    s.add(sky.mesh);
    this.stars = new Starfield({ seed: 31, count: 2200, radius: 1500, brightness: 0.95, maxSize: 4.5, minY: 0.02 });
    s.add(this.stars.points);
    s.fog = new THREE.FogExp2(0x070b14, 0.012);

    // Ground with soft undulation and a grain texture.
    const gg = new THREE.PlaneGeometry(90, 90, 120, 120).rotateX(-Math.PI / 2), gp = gg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i), d = Math.hypot(x, z); gp.setY(i, (fbm2(x / 3, z / 3, 7, 3) - 0.5) * 0.14 * smoothstep(0.8, 3, d)); }
    gg.computeVertexNormals();
    const gc = document.createElement('canvas'); gc.width = gc.height = 512; const gx = gc.getContext('2d')!;
    gx.fillStyle = '#6a5a47'; gx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 26000; i++) { const v = 60 + r() * 90; gx.fillStyle = `rgba(${v + 14},${v},${v - 18},${0.25 + r() * 0.5})`; gx.fillRect(r() * 512, r() * 512, 1 + r() * 2.4, 1 + r() * 2.4); }
    const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace; gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(26, 26); gt.anisotropy = 8;
    const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: gt, bumpMap: gt, bumpScale: 1.2, roughness: 1 })); ground.receiveShadow = true; s.add(ground);

    // Stone ring
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + r() * 0.2, st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11 + r() * 0.05, 1), stoneMat);
      st.position.set(Math.cos(a) * 0.6, 0.06, Math.sin(a) * 0.6); st.scale.set(1 + r() * 0.5, 0.7 + r() * 0.4, 1 + r() * 0.4); st.rotation.set(r() * 3, r() * 3, r() * 3);
      st.castShadow = true; st.receiveShadow = true; s.add(st);
    }
    // Logs with ember cracks
    const ec = document.createElement('canvas'); ec.width = 256; ec.height = 64; const ex = ec.getContext('2d')!;
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 90; i++) { ex.strokeStyle = `rgba(255,${120 + r() * 100},${30 + r() * 40},${0.35 + r() * 0.6})`; ex.lineWidth = 0.6 + r() * 2.2; const x = r() * 256, y = r() * 64; ex.beginPath(); ex.moveTo(x, y); ex.lineTo(x + (r() - 0.5) * 46, y + (r() - 0.5) * 14); ex.stroke(); }
    const et = new THREE.CanvasTexture(ec); et.wrapS = et.wrapT = THREE.RepeatWrapping;
    this.logMat = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 1, emissive: 0xff4a12, emissiveMap: et, emissiveIntensity: 1 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3, log = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + r() * 0.02, 0.06 + r() * 0.02, 0.78, 10), this.logMat);
      const foot = new THREE.Vector3(Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36), top = new THREE.Vector3(Math.cos(a + 2.6) * 0.05, 0.5, Math.sin(a + 2.6) * 0.05);
      log.position.copy(foot).add(top).multiplyScalar(0.5); log.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
      log.castShadow = true; s.add(log);
    }
    this.emberBed = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uEmber: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime, uEmber; varying vec2 vUv; ${GLSL_NOISE}
        void main(){ vec2 p = (vUv - 0.5)*2.0; float d = length(p);
          float n = fbm(p*5.0 + vec2(0.0, uTime*0.12)); float cell = smoothstep(0.38, 0.75, n + 0.12*sin(uTime*2.3 + p.x*9.0));
          float a = smoothstep(1.0, 0.25, d);
          vec3 c = mix(vec3(0.5, 0.06, 0.01), vec3(1.0, 0.42, 0.08), cell) * (0.25 + 2.6*cell) * uEmber;
          gl_FragColor = vec4(c*a, a); }`,
    });
    const bed = new THREE.Mesh(new THREE.CircleGeometry(0.46, 40).rotateX(-Math.PI / 2), this.emberBed); bed.position.y = 0.035; s.add(bed);

    // Flames
    const layout: [number, number, number, number][] = [[0, 0, 0.62, 1.05], [-0.16, 0.06, 0.46, 0.8], [0.17, -0.04, 0.46, 0.84], [0.04, 0.16, 0.4, 0.66], [-0.07, -0.15, 0.42, 0.72], [0.2, 0.12, 0.3, 0.5], [-0.22, -0.08, 0.3, 0.52]];
    layout.forEach(([x, z, w, h], i) => {
      const f = new Flame({ width: w, height: h, turbulence: 0.9, speed: 1.7, brightness: 1.5, blueBase: 0.12, seed: 3 + i * 1.7, colorCore: 0xffe9a8, colorMid: 0xff8a26, colorTip: 0xe0340c });
      f.mesh.position.set(x, 0.06, z); s.add(f.mesh); this.flames.push({ f, seed: i });
    });
    // Sparks
    const nS = 90, sp = new Float32Array(nS * 3), sd = new Float32Array(nS * 4);
    for (let i = 0; i < nS; i++) { sp.set([(r() - 0.5) * 0.4, 0.3, (r() - 0.5) * 0.4], i * 3); sd.set([r(), 0.35 + r() * 0.35, r() * 6.28, 1.4 + r() * 2.2], i * 4); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(sd, 4));
    this.sparks = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uTime: { value: 0 }, uFire: { value: 1 }, uBurst: { value: 0 } },
      vertexShader: `attribute vec4 aS; uniform float uTime, uFire, uBurst; varying float vA;
        void main(){ float age = fract(uTime*aS.y + aS.x); vec3 p = position; p.y += age*aS.w*(1.0 + uBurst*0.6); p.x += sin(age*7.0 + aS.z)*0.22*age + age*0.25; p.z += cos(age*5.0 + aS.z)*0.2*age;
          vA = pow(1.0 - age, 1.6) * smoothstep(0.0, 0.08, age) * uFire; vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(22.0/(-mv.z), 1.5, 8.0); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0, 0.0, d)*vA; gl_FragColor = vec4(vec3(3.2, 1.3, 0.3)*a, a); }`,
    });
    const sparks = new THREE.Points(sg, this.sparks); sparks.frustumCulled = false; s.add(sparks);
    // Smoke puffs released when the flames die
    for (let i = 0; i < 3; i++) {
      const w = new SmokeWisp({ height: 2.6, baseWidth: 0.1, topWidth: 0.6, curl: 0.4, riseSpeed: 0.85 + i * 0.12, color: 0x5d6779, opacity: 0.3, seed: 2 + i * 3.1 });
      w.mesh.position.set((i - 1) * 0.14, 0.35, (i - 1) * 0.06); s.add(w.mesh); this.smokes.push(w);
    }

    // Lights
    this.fireLight = new THREE.PointLight(0xff8a3c, 0, 22, 1.7); this.fireLight.position.set(0, 0.55, 0);
    this.fireLight.castShadow = true; this.fireLight.shadow.mapSize.set(1024, 1024); this.fireLight.shadow.bias = -0.004; this.fireLight.shadow.radius = 5; this.fireLight.shadow.camera.near = 0.2;
    this.emberLight = new THREE.PointLight(0xff3a10, 0, 5, 2); this.emberLight.position.set(0, 0.25, 0);
    const moon = new THREE.DirectionalLight(0x8fa8e0, 1.15); moon.position.set(5, 7, 3);
    s.add(this.fireLight, this.emberLight, moon, new THREE.HemisphereLight(0x2c3f6e, 0x0c0d12, 0.85));

    // Conifers
    const treeGeo = new THREE.ConeGeometry(1, 3.2, 8).translate(0, 1.6, 0), treeMat = new THREE.MeshStandardMaterial({ color: 0x0f1f17, roughness: 1 });
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, 300), d = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const a = Math.PI * (0.03 + r() * 1.94) + Math.PI, dist = 16 + r() * 34, x = Math.cos(a) * dist * 1.25, z = Math.sin(a) * dist - 3, h = 1.9 + r() * 2.0;
      if (z > 3) continue;
      for (let k = 0; k < 3; k++) { d.position.set(x, 0.6 + k * h * 0.72, z); d.scale.set(h * (0.62 - k * 0.15), h * 0.5, h * (0.62 - k * 0.15)); d.rotation.y = r() * 6; d.updateMatrix(); trees.setMatrixAt(n++, d.matrix); }
    }
    trees.count = n; s.add(trees);

    // Log bench and campers (backs to camera, facing the fire)
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 1 });
    for (const x of [-0.48, 0.5]) { const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.4, 14), stumpMat); stump.position.set(x, 0.2, 1.68); stump.castShadow = true; stump.receiveShadow = true; s.add(stump); }
    const a = new Humanoid({ height: 1.7, coatColor: 0x38523f, trouserColor: 0x22242c, scarfColor: 0x9a4a35, coat: 'jacket', hat: true });
    a.root.position.set(-0.48, 0, 1.6); a.root.rotation.y = Math.PI + 0.14;
    const b = new Humanoid({ height: 1.78, coatColor: 0x39486a, trouserColor: 0x2a2620, scarfColor: null, hairColor: 0x1b1512, coat: 'jacket' });
    b.root.position.set(0.5, 0, 1.6); b.root.rotation.y = Math.PI - 0.16;
    s.add(a.root, b.root); this.campers = [a, b];
  }

  /** Flame level 0..1 and ember glow for a given shot/time. */
  private fireState(t: number, sceneId: string) {
    if (sceneId === 'S08') {
      const fire = ramp(t, T.fireBack, T.fireBack + 0.7) * (1 + 0.22 * Math.sin(clamp((t - T.fireBack) / 1.4) * Math.PI));
      return { fire, ember: 0.32 + 0.75 * ramp(t, T.oxygenBack, T.oxygenBack + 0.9) + 0.2 * fire, out: T.fireOut, burst: Math.exp(-Math.max(0, t - T.fireBack) / 0.8) * step(t, T.fireBack) };
    }
    const fire = 1 - ramp(t, T.fireOut, T.fireOut + 0.22);
    return { fire, ember: fire > 0.02 ? 1 : 0.6 - 0.22 * smoothstep(T.fireOut, T.fireOut + 2, t), out: T.fireOut, burst: 0 };
  }

  update(t: number, shot: ShotInfo) {
    const st = this.fireState(t, shot.sceneId), fire = st.fire;
    const flick = 0.86 + 0.14 * wobble(t * 9.5, 1) + 0.07 * wobble(t * 23, 2);
    for (const { f, seed } of this.flames) f.update(t, clamp(fire * (0.82 + 0.25 * wobble(t * 3.1, seed * 2.3)), 0, 1.25), this.camera);
    this.fireLight.intensity = 55 * fire * flick;
    this.fireLight.position.set(0.05 * wobble(t * 6, 5), 0.55 + 0.05 * wobble(t * 7.7, 6), 0.05 * wobble(t * 5.3, 7));
    this.emberLight.intensity = 1.6 * st.ember;
    this.emberBed.uniforms.uTime.value = t; this.emberBed.uniforms.uEmber.value = st.ember;
    this.logMat.emissiveIntensity = 0.7 * st.ember + 0.5 * fire;
    this.sparks.uniforms.uTime.value = t; this.sparks.uniforms.uFire.value = clamp(fire); this.sparks.uniforms.uBurst.value = st.burst;
    // Smoke: rises from the instant the flames die; nearly gone by the time oxygen returns.
    const since = t - st.out, late = shot.sceneId === 'S08';
    const op = late ? 0.07 * (1 - ramp(t, T.fireBack - 0.2, T.fireBack + 0.3)) : 0.2 * (1 - fire);
    for (const w of this.smokes) w.update(t, late ? 4 : since, op, this.camera);

    // Campers: quiet surprise when the flames vanish, settling forward again when the fire returns.
    const react = shot.sceneId === 'S08' ? 1 - smoothstep(T.fireBack + 0.3, T.fireBack + 1.6, t) : smoothstep(T.fireOut + 0.15, T.fireOut + 0.9, t);
    const breath = 0.5 + 0.5 * Math.sin(t * 1.4);
    this.campers[0].setPose({ ...lerpPose(POSE_SIT, { lean: 0.08, headPitch: -0.2, armL: [-0.55, 0.16, 0.8], armR: [-0.55, 0.16, 0.8] }, react), breath });
    this.campers[1].setPose({ ...lerpPose({ ...POSE_SIT, lean: 0.36, headYaw: 0.0 }, { lean: 0.2, headYaw: -0.55, headPitch: -0.08 }, smoothstep(0, 1, react)), breath: 1 - breath });
    this.stars.follow(this.camera);
    this.stars.brightness = 0.55 + 0.6 * (1 - clamp(fire));
  }
}

const step = (t: number, edge: number) => (t >= edge ? 1 : 0);
