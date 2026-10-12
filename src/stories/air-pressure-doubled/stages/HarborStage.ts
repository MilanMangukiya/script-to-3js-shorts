import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Terrain } from '../../../library/environment/Terrain';
import { BirdFlock } from '../../../library/creatures/BirdFlock';
import { Humanoid, POSE_STAND, lerpPose } from '../../../library/characters/Humanoid';
import { PlasticBottle } from '../../../library/props/PlasticBottle';
import { Sailboat } from '../../../library/vehicles/Sailboat';
import { AirMolecules } from '../../../library/diagram/AirMolecules';
import { rng, smoothstep, clamp } from '../../../library/util/math';
import { T } from '../timeline';

export const SEA_Y = -2.4;
export const PERSON_POS = new THREE.Vector3(1.3, 0, -0.15);
export const BOTTLE_POS = new THREE.Vector3(0.02, 0.74, -0.04);
/** Column footprint (1 m x 1 m) centred on the person; molecules fill it from above head height. */
export const COLUMN = { x: PERSON_POS.x, z: PERSON_POS.z, molBottom: 2.0, molTop: 16 };

/** Crumple amount of the bottle at film time t (rigid until "pressing", collapse on "suddenly doubled", small rebound). */
export function crumpleAt(t: number): number {
  const a = 0.18 * smoothstep(T.crumpleStart, T.crumpleStart + 0.5, t);
  const b = 0.9 * smoothstep(T.crumpleMain - 0.15, T.crumpleEnd, t);
  const over = 0.06 * Math.sin(clamp((t - T.crumpleEnd + 0.25) / 0.6) * Math.PI);
  return a + b + over;
}

interface Look { sun: THREE.Vector3; sunColor: THREE.Color; sunI: number; hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number; fog: THREE.Color; fogD: number; env: THREE.Texture; envI: number }

/**
 * Harbor cafe terrace (metres): stone table with the bottle and an espresso cup on a promenade, railing, seawall,
 * moored sloops, a headland across the bay. Morning light for S01/S02, the doubled-air sunset for S09.
 */
export class HarborStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.02, 30000);
  readonly bottle: PlasticBottle;
  private skyM: SkyDome; private skyE: SkyDome; private ocean: OceanSurface;
  private sunLight: THREE.DirectionalLight; private hemi: THREE.HemisphereLight; private fog: THREE.FogExp2;
  private boats: { b: Sailboat }[] = [];
  private figure: Humanoid; private birds: BirdFlock;
  private column = new THREE.Group(); private columnMat: THREE.ShaderMaterial; private floorMat: THREE.ShaderMaterial;
  readonly molecules: AirMolecules;
  private looks: { morning: Look; evening: Look };

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene, r = rng(41);
    // ---------------------------------------------------------------- skies (morning, and doubled-air sunset)
    const sunM = new THREE.Vector3(-0.36, 0.25, -0.9).normalize();
    const sunE = new THREE.Vector3(0.12, 0.018, -0.99).normalize();
    this.skyM = new SkyDome({ zenithColor: 0x3a72c2, horizonColor: 0xbfd4e6, groundColor: 0x4c5a66, hazeColor: 0xf1dcc2, hazeAmount: 0.32, sunDirection: sunM, sunColor: 0xfff0d4, sunIntensity: 26, sunGlow: 0.6, curve: 0.5 });
    this.skyE = new SkyDome({ zenithColor: 0x1b2150, horizonColor: 0x9c3a26, groundColor: 0x241c22, hazeColor: 0xb94a2c, hazeAmount: 0.5, sunDirection: sunE, sunColor: 0xff3a14, sunIntensity: 14, sunGlow: 1.15, curve: 0.38 });
    s.add(this.skyM.mesh, this.skyE.mesh);
    const envM = this.skyM.toEnvironment(renderer), envE = this.skyE.toEnvironment(renderer, 0.12);
    this.looks = {
      morning: { sun: sunM, sunColor: new THREE.Color(0xfff0dc), sunI: 3.0, hemiSky: new THREE.Color(0xa9c3e6), hemiGround: new THREE.Color(0x6a5a48), hemiI: 0.9, fog: new THREE.Color(0xd9dde0), fogD: 0.00011, env: envM, envI: 0.85 },
      evening: { sun: sunE, sunColor: new THREE.Color(1.0, 0.16, 0.035), sunI: 2.6, hemiSky: new THREE.Color(0x4a3f6e), hemiGround: new THREE.Color(0x3a2420), hemiI: 0.55, fog: new THREE.Color(0x8a3a30), fogD: 0.00016, env: envE, envI: 0.7 },
    };
    this.fog = new THREE.FogExp2(0xd9dde0, 0.00011); s.fog = this.fog;
    this.ocean = new OceanSurface({ level: SEA_Y, deepColor: 0x0f3b52, horizonColor: 0xbfd4e6, zenithColor: 0x3a72c2, sunDirection: sunM, sunColor: 0xfff0d4, waveHeight: 0.42, fogColor: 0xd9dde0, fogDensity: 0.00009, glitter: 0.85 });
    s.add(this.ocean.mesh);
    // Headland across the bay (left of the view axis).
    const head = new Terrain({ seed: 5, width: 4200, depth: 2400, segmentsX: 220, segmentsZ: 130, peakHeight: 230, snowLine: 99999, treeLine: 160 });
    head.mesh.position.set(-1500, SEA_Y, -3000); s.add(head.mesh);
    const head2 = new Terrain({ seed: 8, width: 5200, depth: 2200, segmentsX: 200, segmentsZ: 100, peakHeight: 140, snowLine: 99999, treeLine: 120 });
    head2.mesh.position.set(2600, SEA_Y, -5200); s.add(head2.mesh);

    // ---------------------------------------------------------------- lights
    this.sunLight = new THREE.DirectionalLight(0xfff0dc, 3.3);
    this.sunLight.castShadow = true; this.sunLight.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sunLight.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 0.5, far: 40 });
    this.sunLight.shadow.bias = -0.0004; this.sunLight.shadow.normalBias = 0.01; this.sunLight.shadow.radius = 3;
    s.add(this.sunLight, this.sunLight.target);
    this.hemi = new THREE.HemisphereLight(0xa9c3e6, 0x6a5a48, 0.9); s.add(this.hemi);

    // ---------------------------------------------------------------- promenade, railing, seawall
    const pave = document.createElement('canvas'); pave.width = pave.height = 1024; const pc = pave.getContext('2d')!;
    pc.fillStyle = '#857c70'; pc.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const v = 112 + r() * 36; pc.fillStyle = `rgb(${v + 10},${v + 4},${v - 6})`; pc.fillRect(i * 128 + 3 + (j % 2) * 64 - 64, j * 128 + 3, 122, 122); }
    for (let i = 0; i < 12000; i++) { pc.fillStyle = `rgba(${r() < 0.5 ? 30 : 235},${r() < 0.5 ? 28 : 230},${r() < 0.5 ? 24 : 220},${r() * 0.06})`; pc.fillRect(r() * 1024, r() * 1024, 1 + r() * 3, 1 + r() * 3); }
    const paveTex = new THREE.CanvasTexture(pave); paveTex.colorSpace = THREE.SRGBColorSpace; paveTex.wrapS = paveTex.wrapT = THREE.RepeatWrapping; paveTex.repeat.set(30, 7); paveTex.anisotropy = 16;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(60, 0.6, 14), new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.85 }));
    slab.position.set(0, -0.3, 5.9); slab.receiveShadow = true; s.add(slab);
    // Low granite parapet just behind the table (hidden below the macro sight line), seawall dropping to the sea.
    const granite = new THREE.MeshStandardMaterial({ color: 0x7b766e, roughness: 0.9 });
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(60, 0.56, 0.4), granite); parapet.position.set(0, 0.28, -0.82); parapet.receiveShadow = true; parapet.castShadow = true; s.add(parapet);
    const capStone = new THREE.Mesh(new THREE.BoxGeometry(60, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0x8f897f, roughness: 0.75 })); capStone.position.set(0, 0.59, -0.82); capStone.receiveShadow = true; s.add(capStone);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 2.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.95 }));
    wall.position.set(0, -1.1, -0.92); s.add(wall);

    // ---------------------------------------------------------------- cafe table, cup, bottle
    // Weathered teak slats.
    const wood = document.createElement('canvas'); wood.width = wood.height = 1024; const wc = wood.getContext('2d')!;
    wc.fillStyle = '#6d4a2e'; wc.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 700; i++) { wc.strokeStyle = `rgba(${40 + r() * 60},${24 + r() * 34},${10 + r() * 18},${0.12 + r() * 0.25})`; wc.lineWidth = 0.6 + r() * 2.4; const y = r() * 1024; wc.beginPath(); wc.moveTo(0, y); wc.bezierCurveTo(340, y + (r() - 0.5) * 18, 680, y + (r() - 0.5) * 18, 1024, y + (r() - 0.5) * 10); wc.stroke(); }
    for (let k = 1; k < 8; k++) { wc.fillStyle = 'rgba(18,10,6,0.85)'; wc.fillRect(0, k * 128 - 4, 1024, 8); }
    const woodTex = new THREE.CanvasTexture(wood); woodTex.colorSpace = THREE.SRGBColorSpace; woodTex.anisotropy = 8;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 64).translate(0, 0.725, 0), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62 }));
    top.receiveShadow = true; top.castShadow = true; s.add(top);
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.8 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.71, 16).translate(0, 0.355, 0), metal); stem.castShadow = true; s.add(stem);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.025, 32).translate(0, 0.0125, 0), metal); foot.receiveShadow = true; s.add(foot);
    const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.1 });
    const cup = new THREE.Group(); cup.position.set(-0.16, 0.74, 0.1); s.add(cup);
    const saucer = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.05, 0.001], [0.066, 0.008], [0.068, 0.011], [0.06, 0.009], [0.02, 0.006], [0, 0.006]].map(([x, y]) => new THREE.Vector2(x, y)), 48), ceramic);
    saucer.castShadow = true; saucer.receiveShadow = true; cup.add(saucer);
    const cupBody = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.007], [0.022, 0.007], [0.03, 0.02], [0.033, 0.058], [0.031, 0.058], [0.028, 0.022], [0.02, 0.012], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y)), 48), ceramic);
    cupBody.castShadow = true; cup.add(cupBody);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 20, Math.PI * 1.25).rotateZ(-Math.PI * 0.62), ceramic); handle.position.set(0.035, 0.038, 0); cup.add(handle);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.029, 32).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x2a160b, roughness: 0.08, clearcoat: 1 }));
    coffee.position.y = 0.05; cup.add(coffee);
    this.bottle = new PlasticBottle({ seed: 7, labelColor: 0xa9cfb4, capColor: 0x2f74c0 });
    this.bottle.group.position.copy(BOTTLE_POS); this.bottle.group.rotation.y = 0.6; s.add(this.bottle.group);

    // ---------------------------------------------------------------- moored sloops
    const spots: [number, number, number][] = [[-40, -70, 0.4], [-95, -150, -0.6], [-12, -210, 1.1], [-210, -300, 0.2], [60, -120, -1.0], [-150, -420, 0.8], [140, -260, 2.2]];
    for (const [x, z, yaw] of spots) {
      const b = new Sailboat({ length: 9 + r() * 3, sails: false, seed: Math.floor(r() * 100), hullColor: r() < 0.25 ? 0x1f3550 : 0xf4f2ec });
      b.group.position.set(x, SEA_Y, z); b.group.rotation.y = yaw; s.add(b.group); this.boats.push({ b });
    }

    // ---------------------------------------------------------------- person, gulls
    this.figure = new Humanoid({ height: 1.72, coatColor: 0x26324a, trouserColor: 0x3b3f46, scarfColor: null, coat: 'jacket', hairColor: 0x2b1d16 });
    this.figure.root.position.copy(PERSON_POS); this.figure.root.rotation.y = Math.PI + 0.12; s.add(this.figure.root);
    this.birds = new BirdFlock({ count: 5, seed: 21, spread: [6, 2, 5], sunDirection: sunM });
    s.add(this.birds.mesh);

    // ---------------------------------------------------------------- schematic air column (S02)
    this.columnMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uReveal: { value: 0 }, uGlow: { value: 1 }, uColor: { value: new THREE.Color(0x9fd8ff) } },
      vertexShader: `varying vec2 vUv; varying float vY; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vY = w.y; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uReveal, uGlow; uniform vec3 uColor; varying vec2 vUv; varying float vY;
        void main(){ float edge = smoothstep(0.42, 0.5, abs(vUv.x - 0.5));
          float h = vY;
          float up = smoothstep(uReveal*60.0 + 0.5, uReveal*60.0 - 4.0, h) * exp(-h*0.012);
          float a = (0.035 + edge*0.55) * up * uGlow;
          gl_FragColor = vec4(uColor*a, a); }`,
    });
    const side = new THREE.PlaneGeometry(1, 400).translate(0, 200, 0);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(side, this.columnMat); m.frustumCulled = false;
      const a = (i * Math.PI) / 2; m.position.set(COLUMN.x + Math.sin(a) * 0.5, 0, COLUMN.z + Math.cos(a) * 0.5); m.rotation.y = a; m.renderOrder = 9;
      this.column.add(m);
    }
    this.floorMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uA: { value: 0 }, uColor: { value: new THREE.Color(0x9fd8ff) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uA; uniform vec3 uColor; varying vec2 vUv;
        void main(){ vec2 q = abs(vUv - 0.5); float e = max(q.x, q.y); float line = smoothstep(0.44, 0.48, e) * (1.0 - smoothstep(0.495, 0.5, e));
          float a = (line*0.9 + 0.06) * uA; gl_FragColor = vec4(uColor*a, a); }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.06).rotateX(-Math.PI / 2), this.floorMat);
    floor.position.set(COLUMN.x, 0.004, COLUMN.z); floor.renderOrder = 9; this.column.add(floor);
    s.add(this.column);
    this.molecules = new AirMolecules({ size: new THREE.Vector3(0.96, COLUMN.molTop - COLUMN.molBottom, 0.96), count: 420, maxDensity: 2.05, scale: 0.026, seed: 12, topFade: 0.4 });
    this.molecules.group.position.set(COLUMN.x, (COLUMN.molTop + COLUMN.molBottom) / 2, COLUMN.z);
    s.add(this.molecules.group);
  }

  private applyLook(L: Look, sky: 'm' | 'e') {
    this.skyM.mesh.visible = sky === 'm'; this.skyE.mesh.visible = sky === 'e';
    this.sunLight.position.copy(L.sun).multiplyScalar(30); this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.color.copy(L.sunColor); this.sunLight.intensity = L.sunI;
    this.hemi.color.copy(L.hemiSky); this.hemi.groundColor.copy(L.hemiGround); this.hemi.intensity = L.hemiI;
    this.fog.color.copy(L.fog); this.fog.density = L.fogD;
    this.scene.environment = L.env; this.scene.environmentIntensity = L.envI;
    const u = this.ocean.uniforms, sky0 = sky === 'm' ? this.skyM : this.skyE;
    u.uSunDir.value.copy(L.sun); u.uSunColor.value.copy(sky === 'm' ? new THREE.Color(0xfff0d4) : new THREE.Color(1.0, 0.22, 0.05));
    u.uHorizon.value.copy(sky0.uniforms.uHorizon.value); u.uZenith.value.copy(sky0.uniforms.uZenith.value); u.uFogColor.value.copy(L.fog);
    u.uDeep.value.set(sky === 'm' ? 0x0f3b52 : 0x2a1418); u.uGlitter.value = sky === 'm' ? 0.55 : 1.1;
  }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId, evening = sc === 'S09';
    this.applyLook(evening ? this.looks.evening : this.looks.morning, evening ? 'e' : 'm');
    this.ocean.update(t);
    for (const { b } of this.boats) b.update(t, { bob: 0.6 });
    this.bottle.crumple = sc === 'S01' ? crumpleAt(t) : 1;

    // Person: present in S02 and S09; glances up when the air doubles.
    const fig = this.figure;
    fig.root.visible = sc !== 'S01';
    if (fig.root.visible) {
      const look = sc === 'S02' ? smoothstep(T.doubleIt + 0.1, T.doubleIt + 0.9, t) * (1 - smoothstep(T.S02_end - 0.8, T.S02_end, t) * 0.4) : 0;
      const pose = lerpPose(POSE_STAND, { headPitch: -0.42, headYaw: 0.1, lean: -0.03 }, look);
      pose.armL = [0.05, 0.1, 0.5]; pose.armR = [0.02, 0.08, 0.35];
      pose.breath = 0.5 + 0.5 * Math.sin(t * 1.4);
      fig.setPose(pose);
    }

    // Air column and molecules (S02 only).
    const colOn = sc === 'S02';
    this.column.visible = colOn; this.molecules.group.visible = colOn;
    if (colOn) {
      const reveal = smoothstep(T.columnIn, T.columnIn + 2.2, t), dbl = smoothstep(T.doubleIt, T.doubleEnd, t);
      this.columnMat.uniforms.uReveal.value = reveal; this.columnMat.uniforms.uGlow.value = 1 + 0.8 * dbl;
      this.floorMat.uniforms.uA.value = smoothstep(T.columnIn, T.columnIn + 0.6, t) * (1 + 0.5 * dbl);
      this.molecules.update(t, 1 + dbl, smoothstep(T.columnIn + 0.3, T.columnIn + 1.6, t));
    }

    // Gulls drifting high over the bay (flapping slowly, gliding between beats).
    const gl = 0.5 + 0.5 * Math.sin(t * 0.7);
    this.birds.update(t, { center: new THREE.Vector3(-30 + 2.2 * t, 22 + Math.sin(t * 0.3) * 1.5, -70), heading: new THREE.Vector3(1, 0, 0.15).normalize(), glide: gl }, 2 * Math.PI * 2.6 * t);
    this.birds.mesh.visible = !evening || t < T.S09_start + 3;
  }
}
