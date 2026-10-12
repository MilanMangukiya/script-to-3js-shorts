import * as THREE from 'three';
import type { Stage, ShotInfo } from '../../../library/render/FilmPipeline';
import { Flame } from '../../../library/fx/Flame';
import { SmokeWisp } from '../../../library/fx/SmokeWisp';
import { SkyDome } from '../../../library/environment/SkyDome';
import { rng, ramp, smoothstep, wobble, clamp, lerp } from '../../../library/util/math';
import { T } from '../timeline';

/** Windowsill candle before a blue-hour city (S01 hook and S09 ending). Units: metres. */
export class CandleStage implements Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(22, 9 / 16, 0.02, 800);
  private flame: Flame; private ghosts: Flame[] = []; private smoke: SmokeWisp;
  private key: THREE.PointLight; private candleMat: THREE.MeshStandardMaterial; private poolMat: THREE.MeshStandardMaterial;
  private ember: THREE.Mesh; private halo: THREE.Sprite;
  private bokeh: THREE.ShaderMaterial;
  private match = new THREE.Group(); private matchFlame: Flame; private matchLight: THREE.PointLight;

  constructor() {
    const s = this.scene, r = rng(41);
    const sky = new SkyDome({ zenithColor: 0x081431, horizonColor: 0x223c78, groundColor: 0x0c1428, hazeColor: 0x8a6a78, hazeAmount: 0.2, sunIntensity: 0, sunGlow: 0, curve: 0.5 });
    s.add(sky.mesh);

    // --- City bokeh: tower window grids rendered as soft discs -------------------------------------------------
    const pos: number[] = [], col: number[] = [], misc: number[] = [];
    const warm = [1.0, 0.72, 0.42], cool = [0.82, 0.9, 1.0], teal = [0.45, 0.95, 0.9], red = [1.0, 0.3, 0.25];
    for (let b = 0; b < 26; b++) {
      const z = -(95 + r() * 230), bx = (r() - 0.5) * 120, w = 8 + r() * 12, h = 45 + r() * 120, base = -75 + r() * 20, bRand = r();
      const cols = Math.max(2, Math.round(w / 3.4)), rows = Math.round(h / 3.6), lit = 0.1 + r() * 0.2;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (r() > lit) continue;
        pos.push(bx + (i / (cols - 1) - 0.5) * w, base + j * 3.6, z);
        const q = r(), c = q < 0.7 ? warm : q < 0.9 ? cool : q < 0.96 ? teal : red, br = 0.35 + r() * 0.65;
        col.push(c[0] * br, c[1] * br, c[2] * br);
        misc.push(0.75 + r() * 0.6, bRand * 0.82 + r() * 0.18, r() * 6.28); // size, outage rank, shimmer phase
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); bg.setAttribute('aMisc', new THREE.Float32BufferAttribute(misc, 3));
    this.bokeh = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uPx: { value: 76 }, uOutage: { value: 0 }, uTime: { value: 0 }, uGain: { value: 0.15 } },
      vertexShader: /* glsl */ `attribute vec3 aCol, aMisc; uniform float uPx, uOutage, uTime; varying vec3 vCol;
        void main(){ float on = smoothstep(uOutage - 0.01, uOutage + 0.01, aMisc.y); vCol = aCol * on * (0.93 + 0.07*sin(uTime*2.3 + aMisc.z));
          gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize = uPx * aMisc.x; }`,
      fragmentShader: /* glsl */ `uniform float uGain; varying vec3 vCol;
        void main(){ float d = length(gl_PointCoord - 0.5)*2.0; float a = smoothstep(1.0, 0.88, d) * (0.7 + 0.45*smoothstep(0.5, 0.95, d)); gl_FragColor = vec4(vCol*a*uGain, a); }`,
    });
    const bokeh = new THREE.Points(bg, this.bokeh); bokeh.frustumCulled = false; bokeh.renderOrder = -50;
    s.add(bokeh);

    // --- Sill, window frame, props ---------------------------------------------------------------------------
    const wood = document.createElement('canvas'); wood.width = 1024; wood.height = 256;
    const wc = wood.getContext('2d')!; wc.fillStyle = '#4d3a2b'; wc.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 260; i++) { wc.strokeStyle = `rgba(${20 + r() * 40},${12 + r() * 24},${6 + r() * 16},${0.12 + r() * 0.25})`; wc.lineWidth = 0.6 + r() * 2.2; const y = r() * 256; wc.beginPath(); wc.moveTo(0, y); wc.bezierCurveTo(340, y + (r() - 0.5) * 14, 680, y + (r() - 0.5) * 14, 1024, y + (r() - 0.5) * 8); wc.stroke(); }
    const woodTex = new THREE.CanvasTexture(wood); woodTex.colorSpace = THREE.SRGBColorSpace; woodTex.anisotropy = 8;
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.6), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.48, metalness: 0 }));
    sill.position.set(0, -0.02, 0.02); sill.receiveShadow = true; s.add(sill);
    const framePaint = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.55 });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.028, 0.03), framePaint); rail.position.set(0, 0.014, -0.245); rail.receiveShadow = true; s.add(rail);
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, 0.03), framePaint); mullion.position.set(-0.088, 0.6, -0.245); mullion.receiveShadow = true; s.add(mullion);
    // Matchbox
    const boxMats = [0x6a4a34, 0x6a4a34, 0x1f3b63, 0x1f3b63, 0x3a2a20, 0x3a2a20].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    const matchbox = new THREE.Mesh(new THREE.BoxGeometry(0.053, 0.015, 0.036), boxMats); matchbox.position.set(-0.066, 0.0076, 0.06); matchbox.rotation.y = 0.55; matchbox.castShadow = true; matchbox.receiveShadow = true; s.add(matchbox);

    // --- Candle ----------------------------------------------------------------------------------------------
    const grad = document.createElement('canvas'); grad.width = 4; grad.height = 256; const gc = grad.getContext('2d')!;
    const lg = gc.createLinearGradient(0, 0, 0, 256); lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.28, '#8a8a8a'); lg.addColorStop(0.7, '#1c1c1c'); lg.addColorStop(1, '#050505');
    gc.fillStyle = lg; gc.fillRect(0, 0, 4, 256);
    const gradTex = new THREE.CanvasTexture(grad);
    this.candleMat = new THREE.MeshStandardMaterial({ color: 0xefe3cb, roughness: 0.46, emissive: 0xff8a3a, emissiveMap: gradTex, emissiveIntensity: 0 });
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.0355, 0.09, 64, 1), this.candleMat); candle.position.y = 0.045; candle.castShadow = true; candle.receiveShadow = true; s.add(candle);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0335, 0.0022, 10, 64).rotateX(Math.PI / 2), this.candleMat); rim.position.y = 0.0902; s.add(rim);
    this.poolMat = new THREE.MeshStandardMaterial({ color: 0xe6d6b4, roughness: 0.18, emissive: 0xff9a45, emissiveIntensity: 0 });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.0325, 48).rotateX(-Math.PI / 2), this.poolMat); pool.position.y = 0.0885; pool.receiveShadow = true; s.add(pool);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0013, 0.013, 8), new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 1 }));
    wick.position.set(0.0006, 0.095, 0); wick.rotation.z = -0.14; s.add(wick);
    this.ember = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff5a1a, toneMapped: false }));
    this.ember.position.set(0.0016, 0.1012, 0); s.add(this.ember);

    this.flame = new Flame({ width: 0.03, height: 0.054, turbulence: 0.11, speed: 0.9, brightness: 2.5, blueBase: 0.8, seed: 2 });
    this.flame.mesh.position.set(0.0012, 0.0985, 0); s.add(this.flame.mesh);
    // Double-glazing reflections of the flame in the window.
    for (const [dz, b] of [[-0.49, 0.09], [-0.512, 0.045]] as const) {
      const g = new Flame({ width: 0.03, height: 0.054, turbulence: 0.11, speed: 0.9, brightness: 2.5 * b, blueBase: 0.8, seed: 2 });
      g.mesh.position.set(0.0012, 0.0985, dz); s.add(g.mesh); this.ghosts.push(g);
    }
    const hc = document.createElement('canvas'); hc.width = hc.height = 128; const hx = hc.getContext('2d')!;
    const rg = hx.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(255,190,110,0.55)'); rg.addColorStop(0.35, 'rgba(255,150,70,0.16)'); rg.addColorStop(1, 'rgba(255,120,40,0)');
    hx.fillStyle = rg; hx.fillRect(0, 0, 128, 128);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.halo.scale.setScalar(0.17); this.halo.position.set(0, 0.122, -0.002); s.add(this.halo);

    this.smoke = new SmokeWisp({ height: 0.24, baseWidth: 0.0035, topWidth: 0.04, curl: 0.022, riseSpeed: 0.085, color: 0xb4c0d8, opacity: 0.5, seed: 4 });
    this.smoke.mesh.position.set(0.0016, 0.1015, 0); s.add(this.smoke.mesh);

    // --- Lights ----------------------------------------------------------------------------------------------
    this.key = new THREE.PointLight(0xffa04a, 0, 2.5, 2);
    this.key.position.set(0.001, 0.122, 0.0); this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.near = 0.01; this.key.shadow.camera.far = 2.5; this.key.shadow.bias = -0.002; this.key.shadow.radius = 4;
    s.add(this.key);
    s.add(new THREE.HemisphereLight(0x6f86c8, 0x1a1c26, 1.05));
    const win = new THREE.DirectionalLight(0x7f9be0, 1.3); win.position.set(-0.4, 0.5, -1); s.add(win);
    const front = new THREE.DirectionalLight(0x6b7fb5, 0.45); front.position.set(0.3, 0.4, 1); s.add(front);

    // --- Long match (ending) ---------------------------------------------------------------------------------
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.17, 8).translate(0, 0.085, 0), new THREE.MeshStandardMaterial({ color: 0xc9a877, roughness: 0.8 }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 10, 8), new THREE.MeshStandardMaterial({ color: 0x241410, roughness: 1 }));
    this.match.add(stick, head);
    this.matchFlame = new Flame({ width: 0.02, height: 0.034, turbulence: 0.22, speed: 1.2, brightness: 2.4, blueBase: 0.5, seed: 9 });
    this.matchLight = new THREE.PointLight(0xffa04a, 0, 1.2, 2);
    s.add(this.match, this.matchFlame.mesh, this.matchLight);
  }

  update(t: number, shot: ShotInfo) {
    const ending = shot.sceneId === 'S09';
    const flameOn = ending ? ramp(t, T.relight, T.relight + 0.6) : 1 - ramp(t, T.candleOut, T.candleOut + 0.15);
    const flick = 1 + 0.045 * wobble(t * 7.3, 1) + 0.02 * wobble(t * 19, 2);
    const f = flameOn * flick;
    this.flame.update(t, flameOn, this.camera);
    for (const g of this.ghosts) g.update(t, flameOn, this.camera);
    this.key.intensity = 0.07 * f;
    this.key.position.x = 0.001 + 0.0012 * wobble(t * 5.1, 3);
    this.candleMat.emissiveIntensity = 0.5 * f; this.poolMat.emissiveIntensity = 0.4 * f;
    (this.halo.material as THREE.SpriteMaterial).opacity = clamp(f) * 0.9;
    // Wick ember glows briefly after the flame dies.
    const since = t - T.candleOut;
    const emberGlow = ending ? 0 : (since > 0 ? Math.exp(-since / 1.1) : 0);
    (this.ember.material as THREE.MeshBasicMaterial).color.setRGB(3.0 * emberGlow + 0.02, 0.8 * emberGlow + 0.01, 0.15 * emberGlow);
    this.smoke.update(t, ending ? -1 : since - 0.05, 0.75 * (1 - smoothstep(3.4, 6.0, since)), this.camera);
    this.bokeh.uniforms.uTime.value = t; this.bokeh.uniforms.uOutage.value = ending ? 0.36 : 0;

    // Match: glide in, touch the wick, withdraw.
    const m = this.match;
    m.visible = ending && t > T.matchIn - 0.05 && t < T.relight + 1.25;
    const wickTip = new THREE.Vector3(0.006, 0.106, 0.003), away = new THREE.Vector3(0.2, 0.2, 0.06);
    const inU = smoothstep(T.matchIn, T.relight, t), outU = smoothstep(T.relight + 0.25, T.relight + 1.2, t);
    const headPos = away.clone().lerp(wickTip, inU).lerp(new THREE.Vector3(0.22, 0.17, 0.08), outU);
    headPos.y += Math.sin(inU * Math.PI) * 0.012;
    m.position.copy(headPos);
    const dir = new THREE.Vector3(0.84, 0.47, 0.27).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mf = m.visible ? lerp(1, 0.85, outU) : 0;
    this.matchFlame.mesh.position.copy(headPos).add(new THREE.Vector3(-0.001, -0.003, 0));
    this.matchFlame.update(t, mf, this.camera);
    this.matchLight.position.copy(headPos).add(new THREE.Vector3(0, 0.015, 0));
    this.matchLight.intensity = 0.03 * mf * flick;
  }
}
