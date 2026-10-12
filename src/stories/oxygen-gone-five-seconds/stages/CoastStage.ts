import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { SkyDome } from '../../../library/environment/SkyDome';
import { OceanSurface } from '../../../library/environment/OceanSurface';
import { Terrain } from '../../../library/environment/Terrain';
import { BirdFlock } from '../../../library/creatures/BirdFlock';
import { Humanoid, POSE_STAND, lerpPose, type HumanoidPose } from '../../../library/characters/Humanoid';
import { rng, ramp, smoothstep, lerp, settle, clamp } from '../../../library/util/math';
import { T } from '../timeline';

export const SEA_Y = -2.4;
export const BAROMETER_POS = new THREE.Vector3(-0.45, 1.45, 1.6);
export const FIGURE_POS = new THREE.Vector3(0.9, 0, 2.2);
/** Massif placement; a point on its seaward face is used to anchor the altitude callout. */
export const MASSIF_POS = new THREE.Vector3(300, SEA_Y, -9500);

/** Barometer reading in hPa at film time t (1013 → about 800 when the oxygen's partial pressure disappears). */
export const pressureAt = (t: number) => 1013 - 213 * settle((t - T.pressureDrop) * 1.7, 8, 4.2);
/** Equivalent-altitude contour in metres at film time t. */
export const contourAltitudeAt = (t: number) => 1950 * smoothstep(T.contourStart, T.contourEnd, t);

/**
 * Seaside promenade at low golden sun (metres): brass barometer, sea, a 2.6 km massif across the bay.
 * Used by S03 (pressure), S04 (person and bloodstream schematic) and S07/SH01 (gulls).
 */
export class CoastStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 60000);
  private sky: SkyDome; private ocean: OceanSurface; private terrain: Terrain; private birds: BirdFlock;
  private hemi: THREE.HemisphereLight; private fog: THREE.FogExp2; private fogBase = new THREE.Color(0xdcc7b0);
  private needle: THREE.Mesh;
  private figure: Humanoid; private blood: THREE.Points; private heart: THREE.Sprite; private bloodPaths: THREE.CatmullRomCurve3[] = [];
  private bloodData: { path: number; phase: number; speed: number; jit: THREE.Vector3 }[] = [];
  readonly chestWorld = new THREE.Vector3();
  private sunDir = new THREE.Vector3(-0.55, 0.2, -0.81).normalize();

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene, r = rng(23);
    const horizon = 0xdcc3a2, zenith = 0x3d7bd0;
    this.sky = new SkyDome({ zenithColor: zenith, horizonColor: horizon, groundColor: 0x40505e, hazeColor: 0xf3c48f, hazeAmount: 0.5, sunDirection: this.sunDir, sunColor: 0xffd9a2, sunIntensity: 30, sunGlow: 0.55, curve: 0.42 });
    s.add(this.sky.mesh);
    s.environment = this.sky.toEnvironment(renderer); s.environmentIntensity = 0.7;
    this.fog = new THREE.FogExp2(this.fogBase.getHex(), 0.000062); s.fog = this.fog;
    this.ocean = new OceanSurface({ level: SEA_Y, deepColor: 0x0d3550, horizonColor: horizon, zenithColor: zenith, sunDirection: this.sunDir, sunColor: 0xffd9a2, waveHeight: 0.55, fogColor: this.fogBase, fogDensity: 0.00007, glitter: 0.6 });
    s.add(this.ocean.mesh);
    this.terrain = new Terrain({ seed: 11, width: 9000, depth: 7000, peakHeight: 2600, snowLine: 2150, treeLine: 1250 });
    // Centre the summit straight out to sea from the promenade so the tilt-up always finds it.
    this.terrain.mesh.position.set(-this.terrain.peak.x, SEA_Y, MASSIF_POS.z - this.terrain.peak.z);
    this.terrain.mesh.updateMatrixWorld(true);
    s.add(this.terrain.mesh);

    const sun = new THREE.DirectionalLight(0xffd2a0, 3.4);
    sun.position.copy(this.sunDir).multiplyScalar(40).add(new THREE.Vector3(0, 0, 3)); sun.target.position.set(0, 0, 3);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 90 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    s.add(sun, sun.target);
    this.hemi = new THREE.HemisphereLight(0x9cb6e2, 0x5a4c3e, 0.95); s.add(this.hemi);

    // --- Promenade -------------------------------------------------------------------------------------------
    const pave = document.createElement('canvas'); pave.width = pave.height = 1024; const pc = pave.getContext('2d')!;
    pc.fillStyle = '#8d8478'; pc.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { const v = 118 + r() * 34; pc.fillStyle = `rgb(${v + 8},${v + 2},${v - 8})`; pc.fillRect(i * 128 + 3 + (j % 2) * 64 - 64, j * 256 + 3, 122, 250); }
    for (let i = 0; i < 9000; i++) { pc.fillStyle = `rgba(${r() < 0.5 ? 30 : 235},${r() < 0.5 ? 28 : 230},${r() < 0.5 ? 24 : 220},${r() * 0.07})`; pc.fillRect(r() * 1024, r() * 1024, 1 + r() * 3, 1 + r() * 3); }
    const paveTex = new THREE.CanvasTexture(pave); paveTex.colorSpace = THREE.SRGBColorSpace; paveTex.wrapS = paveTex.wrapT = THREE.RepeatWrapping; paveTex.repeat.set(10, 3.5); paveTex.anisotropy = 16;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(60, 0.8, 14), new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.82, metalness: 0 }));
    slab.position.set(0, -0.4, 7.6); slab.receiveShadow = true; s.add(slab);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 3.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x6f675c, roughness: 0.95 })); wall.position.set(0, -1.6, 0.6); s.add(wall);
    const iron = new THREE.MeshStandardMaterial({ color: 0x1f2328, roughness: 0.45, metalness: 0.7 });
    const railZ = 1.2;
    for (const y of [1.05, 0.56]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(y > 1 ? 0.03 : 0.018, y > 1 ? 0.03 : 0.018, 60, 12).rotateZ(Math.PI / 2), iron); rail.position.set(0, y, railZ); rail.castShadow = true; s.add(rail); }
    const postGeo = new THREE.CylinderGeometry(0.028, 0.032, 1.08, 10), posts = new THREE.InstancedMesh(postGeo, iron, 34), d = new THREE.Object3D();
    for (let i = 0; i < 34; i++) { d.position.set(-29.7 + i * 1.8, 0.54, railZ); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); }
    posts.castShadow = true; s.add(posts);

    // --- Brass aneroid barometer -----------------------------------------------------------------------------
    const brass = new THREE.MeshStandardMaterial({ color: 0xb58b45, roughness: 0.32, metalness: 0.95 });
    const baro = new THREE.Group(); baro.position.copy(BAROMETER_POS); s.add(baro);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.3, 14), iron); post.position.set(0, -0.82, -0.02); post.castShadow = true; baro.add(post);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.08, 48).rotateX(Math.PI / 2), brass); body.position.z = -0.04; body.castShadow = true; baro.add(body);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.016, 14, 64), brass); bezel.position.z = 0.004; baro.add(bezel);
    const dial = document.createElement('canvas'); dial.width = dial.height = 1024; const dc = dial.getContext('2d')!;
    const dg = dc.createRadialGradient(512, 512, 60, 512, 512, 512); dg.addColorStop(0, '#f4ecd8'); dg.addColorStop(1, '#e2d5b6'); dc.fillStyle = dg; dc.fillRect(0, 0, 1024, 1024);
    dc.translate(512, 512); dc.strokeStyle = '#2a241c'; dc.fillStyle = '#2a241c'; dc.textAlign = 'center'; dc.textBaseline = 'middle';
    const ang = (v: number) => ((v - 910) / 130) * 135 * Math.PI / 180 - Math.PI / 2;
    for (let v = 780; v <= 1040; v += 5) {
      const a = ang(v), major = v % 20 === 0, r1 = major ? 400 : 425, r2 = 455;
      dc.lineWidth = major ? 7 : 3; dc.beginPath(); dc.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); dc.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); dc.stroke();
      if (v % 40 === 0 || v === 780) { dc.font = '600 62px Inter, "Segoe UI", sans-serif'; dc.fillText(String(v), Math.cos(a) * 330, Math.sin(a) * 330); }
    }
    dc.font = '600 54px Inter, "Segoe UI", sans-serif'; dc.fillText('hPa', 0, 170);
    dc.font = '500 34px Inter, "Segoe UI", sans-serif'; dc.fillStyle = '#5b5040'; dc.fillText('AIR PRESSURE', 0, -150);
    const dialTex = new THREE.CanvasTexture(dial); dialTex.colorSpace = THREE.SRGBColorSpace; dialTex.anisotropy = 16;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.158, 64), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.7 })); face.position.z = 0.002; face.receiveShadow = true; baro.add(face);
    this.needle = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.15, 0.003).translate(0, 0.052, 0), new THREE.MeshStandardMaterial({ color: 0x11161f, roughness: 0.4, metalness: 0.4 }));
    this.needle.position.z = 0.012; this.needle.castShadow = true; baro.add(this.needle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 20).rotateX(Math.PI / 2), brass); cap.position.z = 0.014; baro.add(cap);

    // --- Person and schematic bloodstream --------------------------------------------------------------------
    this.figure = new Humanoid({ height: 1.72, coatColor: 0x2c3a52, scarfColor: 0xb0563f, coat: 'long' });
    this.figure.root.position.copy(FIGURE_POS); this.figure.root.rotation.y = Math.PI - 0.22; // facing the sea, turned slightly toward the sun
    s.add(this.figure.root);
    const mirror = (pts: number[][]) => pts.map(([x, y, z]) => [-x, y, z]);
    const H = [0.03, 1.3, 0.03];
    const loops: number[][][] = [
      [H, [0, 1.5, 0.02], [0.035, 1.66, 0.02], [-0.03, 1.67, 0], [-0.015, 1.5, 0]],
      [H, [0.19, 1.4, 0], [0.215, 1.12, 0], [0.225, 0.86, 0.02], [0.2, 0.86, -0.01], [0.19, 1.12, -0.02], [0.15, 1.38, 0]],
      [H, [0.05, 1.05, 0], [0.1, 0.88, 0], [0.105, 0.48, 0], [0.1, 0.08, 0.02], [0.075, 0.08, 0], [0.07, 0.48, -0.01], [0.06, 0.9, 0], [0, 1.1, 0]],
    ];
    loops.push(mirror(loops[1]).map((p, i) => (i === 0 ? H : p)), mirror(loops[2]).map((p, i) => (i === 0 ? H : p)));
    this.bloodPaths = loops.map((l) => new THREE.CatmullRomCurve3(l.map((p) => new THREE.Vector3(p[0], p[1], p[2])), true, 'centripetal'));
    const weights = [0.16, 0.19, 0.23, 0.19, 0.23], nB = 820, bpos = new Float32Array(nB * 3), bcol = new Float32Array(nB * 3), bsz = new Float32Array(nB);
    for (let i = 0; i < nB; i++) {
      let q = r(), path = 0; while (q > weights[path] && path < 4) { q -= weights[path]; path++; }
      this.bloodData.push({ path, phase: r(), speed: 0.1 + r() * 0.05, jit: new THREE.Vector3((r() - 0.5) * 0.03, (r() - 0.5) * 0.02, (r() - 0.5) * 0.03) });
      const warm = r(); bcol.set([1.0, 0.22 + warm * 0.3, 0.12 + warm * 0.1], i * 3); bsz[i] = 0.6 + r() * 0.7;
    }
    const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bgeo.setAttribute('aCol', new THREE.BufferAttribute(bcol, 3)); bgeo.setAttribute('aSize', new THREE.BufferAttribute(bsz, 1));
    this.blood = new THREE.Points(bgeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uAlpha: { value: 0 }, uPx: { value: 9.5 } },
      vertexShader: `attribute vec3 aCol; attribute float aSize; uniform float uPx; varying vec3 vCol; void main(){ vCol = aCol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = uPx*aSize*(4.6/max(-mv.z, 0.5)); }`,
      fragmentShader: `uniform float uAlpha; varying vec3 vCol; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0, 0.0, d); a *= a; gl_FragColor = vec4(vCol*a*uAlpha*0.95, a*uAlpha); }`,
    }));
    this.blood.frustumCulled = false; this.blood.renderOrder = 20;
    this.figure.root.add(this.blood);
    const hc = document.createElement('canvas'); hc.width = hc.height = 128; const hx = hc.getContext('2d')!;
    const rg = hx.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(255,150,110,0.9)'); rg.addColorStop(0.4, 'rgba(255,90,60,0.25)'); rg.addColorStop(1, 'rgba(255,60,40,0)'); hx.fillStyle = rg; hx.fillRect(0, 0, 128, 128);
    this.heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, fog: false }));
    this.heart.position.set(H[0], H[1], H[2]); this.heart.renderOrder = 21; this.figure.root.add(this.heart);

    // --- Gulls -----------------------------------------------------------------------------------------------
    this.birds = new BirdFlock({ count: 9, seed: 12, spread: [5, 1.8, 4], sunDirection: this.sunDir, sunColor: 0xffd9a8, ambient: 0x7f93b2 });
    s.add(this.birds.mesh);
  }

  /** World point on the seaward face of the massif at the given altitude (metres above sea level), right of the summit. */
  massifAnchor(altitude: number): THREE.Vector3 {
    const pos = this.terrain.mesh.geometry.attributes.position as THREE.BufferAttribute, off = this.terrain.mesh.position;
    const best = new THREE.Vector3(900, SEA_Y + altitude, off.z + 900); let bestZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + off.x; if (x < 500 || x > 1300) continue;
      if (Math.abs(pos.getY(i) - altitude) > 45) continue;
      const z = pos.getZ(i) + off.z; if (z > bestZ) { bestZ = z; best.set(x, SEA_Y + altitude, z); }
    }
    return best;
  }

  update(t: number, shot: ShotInfo) {
    const sc = shot.sceneId;
    // Oxygen is gone for all of S04 and S07; in S03 it vanishes at the pressure drop.
    const gone = sc === 'S03' ? ramp(t, T.pressureDrop, T.pressureDrop + 0.3) : 1;
    const scatter = lerp(1, 0.8, gone);
    this.sky.scatter = scatter; this.ocean.skyScale = scatter; this.hemi.intensity = 0.95 * scatter;
    this.fog.color.copy(this.fogBase).multiplyScalar(scatter);
    this.ocean.update(t);

    // Barometer needle: clockwise for higher pressure, 910 hPa straight up.
    const p = sc === 'S03' ? pressureAt(t) : 800;
    this.needle.rotation.z = -((p - 910) / 130) * (135 * Math.PI / 180);
    this.terrain.setContour(contourAltitudeAt(t), sc === 'S03' ? smoothstep(T.contourStart - 0.2, T.contourStart + 0.4, t) : 0, 16);

    // Person
    const fig = this.figure;
    fig.root.visible = sc === 'S04';
    if (fig.root.visible) {
      const flinch = ramp(t, T.earPop, T.earPop + 0.32) * (1 - ramp(t, T.handDown, T.handDown + 1.0));
      const breath = Math.sin((t - T.handDown) * 1.5) * smoothstep(T.handDown, T.handDown + 0.8, t);
      const ear: Partial<HumanoidPose> = { shrug: 1, headPitch: 0.12, headYaw: -0.22, lean: 0.07, sideLean: -0.05 };
      const pose = lerpPose({ ...POSE_STAND, headYaw: 0.12 }, ear, flinch);
      pose.breath = 0.5 + 0.5 * breath; pose.shrug += 0.25 * Math.max(0, breath);
      fig.setPose(pose);
      if (flinch > 0.001) {
        const earWorld = fig.head.localToWorld(new THREE.Vector3(-0.128, 0.1, 0.02));
        fig.reachArm('R', earWorld, new THREE.Vector3(-0.75, -0.5, 0.45).applyQuaternion(fig.root.quaternion), flinch);
      }
      fig.chestAnchor.getWorldPosition(this.chestWorld);
      const a = smoothstep(T.bloodIn, T.bloodIn + 0.9, t);
      (this.blood.material as THREE.ShaderMaterial).uniforms.uAlpha.value = a * 0.85;
      const pos = this.blood.geometry.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
      for (let i = 0; i < this.bloodData.length; i++) {
        const b = this.bloodData[i];
        this.bloodPaths[b.path].getPointAt((b.phase + t * b.speed) % 1, v);
        pos.setXYZ(i, v.x + b.jit.x, v.y + b.jit.y, v.z + b.jit.z);
      }
      pos.needsUpdate = true;
      const beat = Math.pow(Math.max(0, Math.sin(t * 7.2)), 6);
      this.heart.scale.setScalar(0.2 + 0.05 * beat); (this.heart.material as THREE.SpriteMaterial).opacity = a * (0.55 + 0.35 * beat);
    }

    // Gulls: cruise, then sink and flap harder in the thinner air.
    this.birds.mesh.visible = sc === 'S07';
    if (this.birds.mesh.visible) {
      const dip = smoothstep(T.birdsDip, T.birdsDip + 1.6, t);
      const f0 = 3.1, f1 = 5.0, dt = Math.max(0, t - T.birdsDip);
      // Analytic integral of a flap frequency that eases from f0 to f1 over 0.8 s.
      const k = clamp(dt / 0.8), phase = 2 * Math.PI * (f0 * (t - 40) + (f1 - f0) * (dt > 0.8 ? dt - 0.4 : 0.5 * dt * k));
      this.birds.update(t, { center: new THREE.Vector3(4 * (t - 44.6), 15.5, -58 - 8 * (t - 44.6)), heading: new THREE.Vector3(0.45, 0, -0.9).normalize(), sink: 5.2 * dip, pitch: 0.2 * Math.sin(dip * Math.PI) }, phase);
    }
  }
}
