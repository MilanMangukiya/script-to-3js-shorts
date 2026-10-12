import * as THREE from 'three';
import { GLSL_NOISE } from '../util/glsl';

export interface AirlinerOptions {
  /** Overall length in metres (model is authored at 38 m; everything scales with it). */
  length?: number;
  paintColor?: THREE.ColorRepresentation; accentColor?: THREE.ColorRepresentation;
  /** Contrail ribbon length in metres and whether to build contrails at all. */
  contrailLength?: number; contrails?: boolean;
  sunColor?: THREE.ColorRepresentation;
}
export interface AirlinerState {
  /** 0..1 warm exhaust glow in the engine nozzles. */
  engineGlow: number;
  /** Air-relative speed used to convert contrail distance into emission time, metres per second. */
  airspeed: number;
  /** Engines produce no contrail for emission times inside [cutStart, cutEnd). Use Infinity for "never". */
  cutStart: number; cutEnd: number;
}

/**
 * Unbranded twin-engine narrow-body airliner built procedurally (lathe fuselage and nacelles, extruded swept
 * wings and tail). Flies toward local -Z. Contrails are ribbons whose opacity is gated by each point's emission
 * time, so an engine flame-out leaves a physically consistent gap that grows behind the aircraft.
 */
export class Airliner {
  readonly group = new THREE.Group();
  /** Contrails live outside the aircraft transform so they stay level while the aircraft pitches or sinks. */
  readonly contrailGroup = new THREE.Group();
  private glowMats: THREE.MeshBasicMaterial[] = [];
  private trailMats: THREE.ShaderMaterial[] = [];
  private engineLocal: THREE.Vector3[] = [];

  constructor(o: AirlinerOptions = {}) {
    const k = (o.length ?? 38) / 38;
    const g = this.group; g.scale.setScalar(k);
    const paint = new THREE.MeshPhysicalMaterial({ color: o.paintColor ?? 0xf1f2f4, roughness: 0.38, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.25 });
    const accent = new THREE.MeshPhysicalMaterial({ color: o.accentColor ?? 0x2f9c98, roughness: 0.4, metalness: 0.05, clearcoat: 0.5 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.35, metalness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.6, metalness: 0.2 });
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = g) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

    // Fuselage: lathe profile (radius vs station from nose), then laid along +Z with the nose at -Z.
    const prof: [number, number][] = [[0.0, 0], [0.55, 0.35], [1.05, 1.0], [1.5, 2.2], [1.82, 3.8], [1.95, 5.6], [1.95, 24], [1.75, 28], [1.25, 32.5], [0.7, 36], [0.3, 37.6], [0.0, 38]];
    const curve = new THREE.CatmullRomCurve3(prof.map(([r, s]) => new THREE.Vector3(r, s, 0)), false, 'centripetal');
    const fus = new THREE.LatheGeometry(curve.getSpacedPoints(64).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y)), 40);
    // Make v proportional to the station along the fuselage so the window band maps predictably.
    const fuv = fus.attributes.uv as THREE.BufferAttribute, fpos0 = fus.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fuv.count; i++) fuv.setY(i, fpos0.getY(i) / 38);
    fus.rotateX(Math.PI / 2); fus.translate(0, 0, -17.5);
    // Slight tail upsweep.
    const fp = fus.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const z = fp.getZ(i); if (z > 8) fp.setY(i, fp.getY(i) + Math.pow((z - 8) / 12.5, 2) * 1.1); }
    fus.computeVertexNormals();
    // Window band texture: v runs nose→tail, u around the circumference.
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 2048; const c2 = cv.getContext('2d')!;
    c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, 512, 2048);
    c2.fillStyle = '#1b2230';
    for (const u of [0.285, 0.715]) for (let i = 0; i < 44; i++) { const v = 0.16 + i * 0.0122; c2.fillRect(u * 512 - 3, (1 - v) * 2048 - 5, 6, 10); }
    // Cockpit windshield band near the nose on the upper half (u = 0.5 is the top of the fuselage).
    c2.fillRect(0.5 * 512 - 62, (1 - 0.075) * 2048, 124, 22);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const fusMat = paint.clone(); fusMat.map = tex;
    mesh(fus, fusMat);

    // Wings: planform in the XZ plane, extruded thin along Y.
    const wingShape = (root: number, tip: number, span: number, sweep: number) => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(span, sweep); s.lineTo(span, sweep + tip); s.lineTo(0, root); s.closePath(); return s;
    };
    const flat = (shape: THREE.Shape, thick: number) => {
      const e = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.45, bevelSize: thick * 0.6, bevelSegments: 3 });
      e.rotateX(Math.PI / 2); e.translate(0, thick / 2, 0); return e; // shape (x, y) → (x, z)
    };
    for (const side of [1, -1]) {
      const wing = mesh(flat(wingShape(6.6, 1.5, 16.2, 7.6), 0.34), paint);
      wing.scale.x = side; wing.position.set(side * 1.6, -0.75, -4.4); wing.rotation.z = side * 0.095;
      const winglet = mesh(flat(wingShape(1.5, 0.6, 1.9, 1.3), 0.12), accent);
      winglet.scale.x = side; winglet.position.set(side * (1.6 + 16.1), -0.75 + 16.2 * 0.095, -4.4 + 7.6); winglet.rotation.z = side * 1.25;
      const stab = mesh(flat(wingShape(3.4, 1.2, 5.8, 3.2), 0.22), paint);
      stab.scale.x = side; stab.position.set(side * 0.7, 1.15, 14.2); stab.rotation.z = side * 0.1;
      // Engine nacelle + pylon
      const nac = new THREE.LatheGeometry([[0.0, 0], [0.95, 0.02], [1.2, 0.45], [1.25, 1.6], [1.12, 3.2], [0.78, 4.4], [0.0, 4.42]].map(([r, s]) => new THREE.Vector2(r, s)), 28);
      nac.rotateX(Math.PI / 2);
      const ex = side * 5.9, ey = -2.25, ez = -7.4;
      const n = mesh(nac, metal); n.position.set(ex, ey, ez);
      const intake = mesh(new THREE.CircleGeometry(0.93, 28), dark); intake.position.set(ex, ey, ez - 0.01); intake.rotation.y = Math.PI;
      const pyl = mesh(new THREE.BoxGeometry(0.3, 1.35, 3.4), paint); pyl.position.set(ex, ey + 1.15, ez + 2.6);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true, depthWrite: false, toneMapped: false });
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.66, 24), glowMat); glow.position.set(ex, ey, ez + 4.46); g.add(glow);
      this.glowMats.push(glowMat);
      this.engineLocal.push(new THREE.Vector3(ex, ey, ez + 4.6));
      // Wingtip navigation light
      const nav = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: side === 1 ? 0x30ff70 : 0xff3030, toneMapped: false }));
      nav.position.set(side * 17.9, 0.9, 3.4); g.add(nav);
    }
    // Vertical fin (shape in the YZ plane).
    const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.lineTo(5.2, 0); finShape.lineTo(6.6, 5.9); finShape.lineTo(4.9, 5.9); finShape.closePath();
    const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 2 });
    fin.rotateY(-Math.PI / 2); fin.translate(0.12, 0, 0);
    const f = mesh(fin, accent); f.position.set(0, 1.9, 10.6);

    // Contrails
    if (o.contrails !== false) {
      const L = o.contrailLength ?? 900;
      for (const e of this.engineLocal) {
        for (const vertical of [false, true]) {
          const geo = new THREE.PlaneGeometry(1, L, 1, 80); // local y = distance behind
          geo.translate(0, L / 2, 0);
          geo.rotateX(Math.PI / 2);                     // length now along +Z
          if (vertical) geo.rotateZ(Math.PI / 2);
          const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
            uniforms: { uTime: { value: 0 }, uSpeed: { value: 60 }, uCutStart: { value: Infinity }, uCutEnd: { value: Infinity }, uLen: { value: L }, uColor: { value: new THREE.Color(o.sunColor ?? 0xfff1dc) }, uSeed: { value: e.x } },
            vertexShader: /* glsl */ `uniform float uLen; varying vec2 vUv; varying float vD;
              void main(){ vUv = uv; vD = uv.y * uLen; vec3 p = position; float w = 2.4 + vD*0.035;
                // widen across the ribbon's local width axis (x for the flat ribbon, y for the vertical one)
                if (abs(p.x) > 1e-4) p.x *= w; else p.y *= w * 0.55;
                gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
            fragmentShader: /* glsl */ `uniform float uTime, uSpeed, uCutStart, uCutEnd, uLen, uSeed; uniform vec3 uColor; varying vec2 vUv; varying float vD;
              ${GLSL_NOISE}
              void main(){ float te = uTime - vD/uSpeed;
                float cut = step(uCutStart, te) * (1.0 - step(uCutEnd, te));
                float soft = 1.0 - smoothstep(uCutStart - 0.06, uCutStart, te) * (1.0 - smoothstep(uCutEnd, uCutEnd + 0.06, te));
                float edge = 1.0 - abs(vUv.x - 0.5)*2.0;
                float air = vD - uTime*uSpeed;               // pattern is fixed in the air, not on the aircraft
                float puff = 0.55 + 0.6*fbm(vec2(air*0.045 + uSeed, vUv.x*2.0 + uSeed));
                float a = smoothstep(0.0, 0.75, edge) * puff * smoothstep(3.0, 16.0, vD) * (1.0 - smoothstep(uLen*0.55, uLen, vD)) * soft;
                gl_FragColor = vec4(uColor * 1.5, clamp(a * 0.95, 0.0, 1.0) * (1.0 - cut)); }`,
          });
          const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 4;
          m.userData.engine = e;
          this.contrailGroup.add(m); this.trailMats.push(mat);
        }
      }
    }
  }

  /** Call after positioning `group`: keeps contrail sources attached to the engines and updates glow/contrail timing. */
  update(time_s: number, s: AirlinerState) {
    for (const m of this.glowMats) { m.opacity = Math.min(1, s.engineGlow); m.color.setRGB(2.2 * s.engineGlow + 0.02, 1.0 * s.engineGlow + 0.01, 0.35 * s.engineGlow); }
    this.group.updateMatrixWorld(true);
    for (const child of this.contrailGroup.children) {
      const e = child.userData.engine as THREE.Vector3;
      child.position.copy(e).applyMatrix4(this.group.matrixWorld);
    }
    for (const m of this.trailMats) { m.uniforms.uTime.value = time_s; m.uniforms.uSpeed.value = s.airspeed; m.uniforms.uCutStart.value = s.cutStart; m.uniforms.uCutEnd.value = s.cutEnd; }
  }
}
