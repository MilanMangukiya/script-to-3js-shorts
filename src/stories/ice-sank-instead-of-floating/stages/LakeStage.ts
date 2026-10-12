import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Terrain } from '../../../library/environment/Terrain';
import { Underwater } from '../../../library/environment/Underwater';
import { IceSheet } from '../../../library/environment/IceSheet';
import { ConiferStand, scatterTrees } from '../../../library/environment/ConiferStand';
import { FishSchool } from '../../../library/creatures/FishSchool';
import { Humanoid, POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { Snowfall } from '../../../library/fx/Snowfall';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { GLSL_NOISE } from '../../../library/util/glsl';
import { fbm2, smoothstep, lerp, clamp, ramp } from '../../../library/util/math';
import { T, LAKE_DEPTH } from '../timeline';

const ICE_THICKNESS = 0.45;
/** Bottom-ice thickness in metres at film time t (illustrative accelerated growth). */
export const bottomIceAt = (t: number) => 1.0 * smoothstep(T.bottomIceStart, 32.3, t) + 5.4 * smoothstep(T.timelapseStart, T.timelapseEnd, t);

/**
 * Winter mountain lake (metres, surface at y = 0) used above and below the waterline:
 *  S03 today (skater on the ice, then under it) · S04/S05 what-if under water (crystals sink, ice builds from the bed)
 *  S06 what-if on the shore (open steaming water, person on a jetty).
 */
export class LakeStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.08, 30000);
  private above = new THREE.Group(); private below = new THREE.Group();
  private sky: SkyDome; private ice: IceSheet; private openWater: OceanSurface; private water: Underwater;
  private fish: FishSchool; private crystals: Snowfall; private snow: Snowfall; private bottomIce: THREE.Mesh;
  private figure: Humanoid; private skates = new THREE.Group(); private jetty = new THREE.Group();
  private wisps: SmokeWisp[] = []; private inIce: THREE.Mesh; private fog: THREE.FogExp2; private shadow!: THREE.Mesh;

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene;
    s.add(this.above, this.below, this.camera);
    const sunDir = new THREE.Vector3(-0.55, 0.2, -0.81).normalize(), horizon = 0xdfe7f0, zenith = 0x3b6cb0;
    // ------------------------------------------------------------------ above the waterline
    this.sky = new SkyDome({ zenithColor: zenith, horizonColor: horizon, groundColor: 0x9fb0c4, hazeColor: 0xffe4c4, hazeAmount: 0.45, sunDirection: sunDir, sunColor: 0xffe0b0, sunIntensity: 26, sunGlow: 0.6, curve: 0.45 });
    this.above.add(this.sky.mesh);
    s.environment = this.sky.toEnvironment(renderer); s.environmentIntensity = 0.6;
    this.fog = new THREE.FogExp2(0xdbe4ee, 0.00011); s.fog = this.fog;
    const sun = new THREE.DirectionalLight(0xffd9a8, 3.1);
    sun.position.copy(sunDir).multiplyScalar(60).add(new THREE.Vector3(0, 0, -3)); sun.target.position.set(0, 0, -3);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 140 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.above.add(sun, sun.target, new THREE.HemisphereLight(0xa9c4ee, 0x9aa3b2, 1.0));

    const massif = new Terrain({ seed: 5, width: 9000, depth: 6000, peakHeight: 1700, snowLine: 260, treeLine: 520 });
    massif.mesh.position.set(-700 - massif.peak.x, -12, -5400 - massif.peak.z);
    this.above.add(massif.mesh);
    // Snowy far shore with conifers.
    const bankH = (x: number, z: number) => smoothstep(-285, -430, z) * (9 + 16 * fbm2(x / 180, z / 180, 3, 3));
    const bankGeo = new THREE.PlaneGeometry(2600, 420, 110, 18).rotateX(-Math.PI / 2); bankGeo.translate(0, 0, -480);
    const bp = bankGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) bp.setY(i, bankH(bp.getX(i), bp.getZ(i)) - 0.3);
    bankGeo.computeVertexNormals();
    const bank = new THREE.Mesh(bankGeo, new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.92 })); bank.receiveShadow = true;
    const trees = new ConiferStand({ positions: scatterTrees(520, 7, [-1200, 1200, -640, -300], bankH), seed: 8, minHeight: 9, maxHeight: 19, snow: 0.85 });
    this.above.add(bank, trees.mesh);

    this.ice = new IceSheet({ size: 6000, thickness: ICE_THICKNESS, snowAmount: 0.42, seed: 4, horizonColor: horizon, zenithColor: zenith, sunDirection: sunDir, sunColor: 0xffe0b0, fogColor: 0xdbe4ee, fogDensity: 0.00016, underFogColor: 0x0f4a4a, underFogDensity: 0.06 });
    s.add(this.ice.group);
    this.openWater = new OceanSurface({ size: 12000, level: 0, deepColor: 0x0c2b3a, horizonColor: horizon, zenithColor: zenith, sunDirection: sunDir, sunColor: 0xffe0b0, waveHeight: 0.3, waveScale: 0.16, fogColor: 0xdbe4ee, fogDensity: 0.00016, glitter: 0.5 });
    this.above.add(this.openWater.mesh);
    this.snow = new Snowfall({ count: 1400, seed: 2, box: [30, 12, 30], fallSpeed: 0.9, drift: 0.5, size: 34, minPx: 1.5, maxPx: 7, color: 0xffffff, brightness: 0.55, far: 26 });
    this.above.add(this.snow.points);

    // Person: skater in S03, standing on the jetty in S06.
    this.figure = new Humanoid({ height: 1.72, coatColor: 0x7a2f2a, trouserColor: 0x1f2430, scarfColor: 0xe0c48a, coat: 'long', hat: true });
    this.above.add(this.figure.root);
    // Long soft ground shadow (the ice shader does not receive shadow maps): low sun, so about 8 m long.
    const sc = document.createElement('canvas'); sc.width = 256; sc.height = 64; const sx = sc.getContext('2d')!;
    const sg = sx.createRadialGradient(128, 32, 2, 128, 32, 128); sg.addColorStop(0, 'rgba(20,34,60,0.6)'); sg.addColorStop(0.6, 'rgba(20,34,60,0.28)'); sg.addColorStop(1, 'rgba(20,34,60,0)');
    sx.fillStyle = sg; sx.fillRect(0, 0, 256, 64);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 0.75).rotateX(-Math.PI / 2).translate(4.0, 0, 0), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, fog: false }));
    this.shadow.rotation.y = Math.atan2(-0.81, 0.55); // pointing away from the sun
    this.above.add(this.shadow);
    const blade = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, metalness: 0.9, roughness: 0.25 }), boot = new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.7 });
    for (const dx of [-0.035, 0.04]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.2), boot); b.position.set(dx, -0.2, 0.02); b.rotation.z = dx * 3;
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.035, 0.27), blade); bl.position.set(dx, -0.3, 0.03);
      this.skates.add(b, bl);
    }
    this.figure.handR.add(this.skates);
    // Snow-covered jetty running out from the near shore.
    const wood = new THREE.MeshStandardMaterial({ color: 0x5b4634, roughness: 0.9 }), snowMat = new THREE.MeshStandardMaterial({ color: 0xf2f6fb, roughness: 0.95 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 9), wood); deck.position.set(0, 0.44, 2.5);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.07, 9.04), snowMat); cap.position.set(0, 0.535, 2.5);
    this.jetty.add(deck, cap);
    for (let i = 0; i < 5; i++) for (const sx of [-0.8, 0.8]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 10), wood); post.position.set(sx, -0.15, -1.8 + i * 2.1); this.jetty.add(post); const pc = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, 6.283, 0, 1.4), snowMat); pc.position.set(sx, 0.95, -1.8 + i * 2.1); this.jetty.add(pc); }
    this.jetty.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.above.add(this.jetty);
    for (let i = 0; i < 9; i++) {
      const w = new SmokeWisp({ height: 3.4 + (i % 3) * 0.8, baseWidth: 1.6, topWidth: 5, curl: 1.4, riseSpeed: 0.55, color: 0xeef3f9, opacity: 0.16, seed: 3 + i * 2.7 });
      w.mesh.position.set(-13 + i * 3.0 + (i % 2) * 1.5, 0.05, -4.5 - (i * 5.3) % 22); this.above.add(w.mesh); this.wisps.push(w);
    }

    // ------------------------------------------------------------------ below the waterline
    const sunUnder = new THREE.Vector3(-0.3, 1, -0.35).normalize();
    this.water = new Underwater({ depth: LAKE_DEPTH, extent: 60, waterColor: 0x1b6660, deepColor: 0x04222a, surfaceColor: 0xa8dfe0, sunDirection: sunUnder, rayStrength: 0.26, rayCount: 12, fogDensity: 0.06, grassCount: 700, seed: 9 });
    this.below.add(this.water.group);
    this.fish = new FishSchool({ count: 120, seed: 4, length: 0.18, spread: [3.0, 1.2, 1.6], fogColor: this.water.fogColor, fogDensity: this.water.fogDensity, lightDirection: sunUnder });
    this.below.add(this.fish.mesh);
    this.crystals = new Snowfall({ count: 2800, seed: 13, box: [26, LAKE_DEPTH, 26], fallSpeed: 0.9, drift: 0.22, size: 72, minPx: 2, maxPx: 14, color: 0xdff6ff, brightness: 1.25, glint: 0.75, far: 22 });
    this.crystals.points.position.set(0, -LAKE_DEPTH, -3);
    this.below.add(this.crystals.points);
    // Ice building up from the lake bed: one heightfield raised by a thickness uniform.
    this.bottomIce = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 200, 200).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      fog: false,
      uniforms: { uThickness: { value: 0 }, uDepth: { value: LAKE_DEPTH }, uFogColor: { value: this.water.fogColor }, uFogDensity: { value: this.water.fogDensity }, uSunDir: { value: sunUnder } },
      vertexShader: /* glsl */ `uniform float uThickness, uDepth; varying vec3 vP; varying float vLump;
        ${GLSL_NOISE}
        void main(){ vec3 p = position; float n = fbm(p.xz*0.16 + 4.0), l = fbm(p.xz*0.9 + 9.0);
          vLump = l; p.y = -uDepth - 0.4 + uThickness*(0.9 + 0.2*n) + (l - 0.5)*min(uThickness, 1.0)*0.8;
          vec4 w = modelMatrix*vec4(p,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `uniform vec3 uFogColor, uSunDir; uniform float uFogDensity; varying vec3 vP; varying float vLump;
        void main(){ vec3 N = normalize(cross(dFdx(vP), dFdy(vP))); if (N.y < 0.0) N = -N;
          float dist = length(cameraPosition - vP); vec3 V = normalize(cameraPosition - vP);
          float diff = max(dot(N, uSunDir), 0.0), rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
          float depthLight = exp(vP.y*0.11);
          float tex = 0.5 + 0.5*sin(vP.x*3.1 + vLump*9.0)*sin(vP.z*2.7 - vLump*7.0);
          vec3 base = mix(vec3(0.2, 0.5, 0.6), vec3(0.62, 0.86, 0.92), 0.3 + 0.7*diff) * (0.86 + 0.14*tex);
          vec3 col = base * (0.22 + 0.78*diff*depthLight*1.25 + 0.2*rim) + vec3(0.6, 0.95, 1.0)*smoothstep(0.66, 0.84, vLump)*0.07;
          float f = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist);
          gl_FragColor = vec4(mix(col, uFogColor, clamp(f, 0.0, 1.0)), 1.0); }`,
    }));
    this.bottomIce.frustumCulled = false;
    this.below.add(this.bottomIce);

    // Full-frame veil while the lens is inside the ice slab.
    this.inIce = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, fog: false, uniforms: { uA: { value: 0 }, uT: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uA, uT; varying vec2 vUv; ${GLSL_NOISE}
        void main(){ float n = fbm(vUv*vec2(3.0, 9.0) + vec2(0.0, uT*2.5)), b = smoothstep(0.75, 0.9, vnoise(vUv*40.0 + uT));
          vec3 c = mix(vec3(0.55, 0.85, 0.95), vec3(0.95, 1.0, 1.0), n) * 1.25 + b*0.4; gl_FragColor = vec4(c, uA); }`,
    }));
    this.inIce.frustumCulled = false; this.inIce.renderOrder = 999;
    this.camera.add(this.inIce);
  }

  private skatePose(t: number): HumanoidPose {
    // Alternating long glides: one leg trails behind while the body leans into the stride.
    const ph = t * 2.3, sw = Math.sin(ph), k = 0.5 + 0.5 * sw;
    return { ...POSE_STAND, hipsY: 0.87, lean: 0.34, twist: 0.12 * sw, sideLean: 0.05 * sw, headPitch: -0.2, headYaw: 0,
      legL: [lerp(0.35, -0.55, k), lerp(0.45, 0.35, k)], legR: [lerp(-0.55, 0.35, k), lerp(0.35, 0.45, k)],
      armL: [lerp(-0.5, 0.45, k), 0.18, 0.35], armR: [lerp(0.45, -0.5, k), 0.18, 0.35], shrug: 0, breath: 0.5 };
  }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId, cam = this.camera, today = sc === 'S03', under = cam.position.y < -0.2;
    // Only one side of the waterline is drawn at a time; the switch happens behind the in-ice veil or the surface.
    this.above.visible = !under; this.below.visible = under;
    this.ice.group.visible = today; this.openWater.mesh.visible = !today && !under;
    this.water.surface.visible = !today;
    this.fog.density = under ? 0 : 0.00011;
    const y = cam.position.y;
    (this.inIce.material as THREE.ShaderMaterial).uniforms.uA.value = today ? smoothstep(0.32, 0.06, y) * smoothstep(-ICE_THICKNESS - 0.42, -ICE_THICKNESS - 0.02, y) : 0;
    (this.inIce.material as THREE.ShaderMaterial).uniforms.uT.value = t;
    this.ice.update(t); this.openWater.update(t); this.water.update(t, cam);
    this.snow.points.position.set(cam.position.x, 0, cam.position.z - 8); this.snow.update(t);

    // ---- person
    const fig = this.figure;
    this.jetty.visible = sc === 'S06'; this.skates.visible = sc === 'S06';
    if (today) {
      const x = -7 + 3.2 * (t - 14.7);
      fig.root.position.set(x, 0, -7 + 0.5 * Math.sin((t - 14.7) * 0.7)); fig.root.rotation.y = Math.PI / 2 - 0.1 * Math.cos((t - 14.7) * 0.7);
      fig.setPose(this.skatePose(t));
      // Seen from below, the skater is a soft shadow sliding across the ice ceiling.
      const u = clamp((t - T.shadowIn) / (T.shadowOut - T.shadowIn));
      this.ice.setShadow(lerp(10.5, -3.0, u), lerp(-7.6, -6.0, u), 1.35, smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u)));
    } else if (sc === 'S06') {
      fig.root.position.set(0.2, 0.57, -1.3); fig.root.rotation.y = Math.PI + 0.15;
      const look = smoothstep(45.6, 48.6, t);
      fig.setPose(lerpPose({ ...POSE_STAND, headYaw: -0.35, headPitch: 0.05, armR: [0.02, 0.12, 0.2], breath: 0.5 + 0.5 * Math.sin(t * 1.3) }, { headYaw: 0.4 }, look));
    }
    fig.root.visible = today || sc === 'S06';
    this.shadow.visible = fig.root.visible; this.shadow.position.set(fig.root.position.x, fig.root.position.y + 0.012, fig.root.position.z);
    for (let i = 0; i < this.wisps.length; i++) {
      const cycle = 7.5, a = (t * 0.8 + i * 1.9) % cycle;
      this.wisps[i].update(t, a + 0.4, sc === 'S06' ? 0.42 * Math.sin((a / cycle) * Math.PI) : 0, cam);
    }

    // ---- under water
    const th = today ? 0 : bottomIceAt(t);
    this.bottomIce.visible = th > 0.01; (this.bottomIce.material as THREE.ShaderMaterial).uniforms.uThickness.value = th;
    this.crystals.points.visible = !today; this.crystals.points.position.x = cam.position.x; this.crystals.points.position.z = cam.position.z - 5;
    this.crystals.amount = ramp(t, T.crystalsStart, T.crystalsFull); this.crystals.update(t);
    // Fish: calm under the ice; lifting off the bed as ice arrives; squeezed under the surface in the time-lapse.
    const iceTop = -LAKE_DEPTH + th, sq = smoothstep(T.timelapseStart, T.timelapseEnd, t);
    let cy = -1.9, spreadY = 0.8, cx = 2.6 + 0.25 * (t - 18), cz = -4.6 + 0.5 * Math.sin(t * 0.3), hx = 1;
    if (sc === 'S04') { cy = lerp(-3.4, -4.6, smoothstep(23.3, 30, t)); cx = 2.5 - 0.3 * (t - 23.3); cz = -4.5; hx = -1; }
    if (sc === 'S05') { cy = Math.max(lerp(-4.6, -1.35, sq), iceTop + 1.0); spreadY = lerp(1.25, 0.38, sq); cx = 1.6 - 0.42 * (t - 32.3); cz = -0.5 + 0.6 * Math.sin(t * 0.35); hx = -1; }
    this.fish.setSpread([lerp(3.0, 4.2, sc === 'S05' ? sq : 0), spreadY, 1.6]);
    this.fish.update(t, new THREE.Vector3(cx, cy, cz), new THREE.Vector3(hx, 0, 0.12 * Math.cos(t * 0.3)).normalize());
  }
}
