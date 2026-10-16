import * as THREE from 'three';
import { rng } from '../util/math';
import { projectUVs, type PBRLibrary } from '../materials/PBR';

/**
 * Building kit: procedural facades with photo-scanned PBR walls and roofs, trims, cornices, balconies, shopfronts and
 * doors, and windows drawn with an interior-mapping shader — every window shows a lit or dark room behind the glass
 * (walls, floor, ceiling lamp, furniture, curtains or blinds, the odd TV glow) plus sky reflections, so streets read
 * rich by day and glow with varied warm/cool rooms at night. Metres; a building's front faces +Z, origin at the
 * centre of its footprint on the ground. `night` (0..1) and `update(time_s)` are deterministic setters.
 */
export type BuildingStyle = 'townhouse' | 'apartment' | 'tower' | 'shop' | 'cottage' | 'office';
export interface BuildingOptions {
  style: BuildingStyle; width: number; depth: number; floors: number; floorHeight?: number;
  /** PBR set ids for walls, trims and roof (see PBR_SETS); tints multiply the photo texture. */
  wall?: string; wallTint?: THREE.ColorRepresentation; trimTint?: THREE.ColorRepresentation;
  roof?: 'flat' | 'gable' | 'hip'; roofSet?: string; roofTint?: THREE.ColorRepresentation;
  windowsPerFloor?: number; windowW?: number; windowH?: number;
  balconies?: boolean; shutters?: THREE.ColorRepresentation | null;
  /** Ground-floor shopfront with an illuminated sign. */
  shop?: { sign: string; color?: THREE.ColorRepresentation; awning?: THREE.ColorRepresentation | null } | null;
  /** Fraction of rooms lit at full night. */
  litFraction?: number;
  seed?: number;
}

const WIN_VS = /* glsl */ `
  // Per-window values travel as flat varyings: hashing an interpolated seed would turn float rounding into per-pixel noise.
  attribute vec4 aWin;      // seed, lit, room depth (m), style (0 home, 1 office, 2 shop)
  attribute vec2 aSize;     // window width, height (m)
  varying vec2 vUv; varying vec3 vP; varying vec3 vCam; flat varying vec4 vWin; flat varying vec2 vSize; varying vec3 vWorld;
  void main(){
    vec3 p = vec3(position.xy * aSize, 0.0);
    mat4 m = modelMatrix * instanceMatrix;
    vec4 w = m * vec4(p, 1.0); vWorld = w.xyz;
    vCam = (inverse(m) * vec4(cameraPosition, 1.0)).xyz;   // camera in the window's metre frame (no scale in m)
    vP = p; vUv = position.xy + 0.5; vWin = aWin; vSize = aSize;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const WIN_FS = /* glsl */ `
  uniform float uNight, uTime, uDay; uniform vec3 uZen, uHor, uWarm, uCool;
  varying vec2 vUv; varying vec3 vP; varying vec3 vCam; flat varying vec4 vWin; flat varying vec2 vSize; varying vec3 vWorld;
  float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
  float hv(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  // Square-wave stripes faded to their mean as the period approaches the pixel footprint (no shimmer or speckle).
  float stripes(float x, float fp){ return mix(step(0.5, fract(x)), 0.5, smoothstep(0.25, 0.8, fp)); }
  vec3 palette(float k){ return k < 0.2 ? vec3(0.86, 0.82, 0.74) : k < 0.4 ? vec3(0.78, 0.8, 0.72) : k < 0.55 ? vec3(0.7, 0.76, 0.82) : k < 0.7 ? vec3(0.86, 0.72, 0.6) : k < 0.85 ? vec3(0.92, 0.9, 0.86) : vec3(0.62, 0.7, 0.62); }
  void main(){
    float seed = vWin.x, style = vWin.w, D = vWin.z;
    vec3 ro = vP, rd = normalize(vP - vCam);
    float glassFp = length(fwidth(vP)), camD = max(length(vP - vCam), 0.1);   // metres per pixel on the glass
    if (rd.z > -0.001) rd.z = -0.001;                    // always look into the room
    // Room box behind the window: wider than the window, floor 0.9 m below its bottom, 2.8 m ceiling.
    float RW = max(vSize.x * 1.9, 2.8), fl = -vSize.y * 0.5 - (style > 1.5 ? 0.05 : 0.9), ce = fl + (style > 0.5 ? 3.2 : 2.75);
    float tx = ((rd.x > 0.0 ? RW * 0.5 : -RW * 0.5) - ro.x) / rd.x, ty = ((rd.y > 0.0 ? ce : fl) - ro.y) / rd.y, tz = (-D - ro.z) / rd.z;
    float t = min(tx, min(ty, tz)); vec3 hp = ro + rd * t;
    float fp = glassFp * (1.0 + t / camD);                // metres per pixel at the hit point
    vec3 wallC = palette(h1(seed * 3.1)), col;
    float lamp = 0.0;
    if (t == tz) { col = wallC * (0.9 + 0.1 * stripes(hp.x * 2.5 + h1(seed) * 7.0, fp * 2.5) * step(0.7, h1(seed * 5.3)));
      vec2 fr = vec2(hp.x - (h1(seed * 2.2) - 0.5) * RW * 0.4, hp.y - (fl + 1.55));           // a picture or a bookshelf
      if (abs(fr.x) < 0.35 && abs(fr.y) < 0.25) col = mix(col, vec3(h1(seed * 7.0), h1(seed * 8.0), h1(seed * 9.0)) * 0.6 + 0.15, 0.85);
    } else if (t == tx) { col = wallC * 0.82; }
    else if (rd.y < 0.0) { float plank = stripes(hp.x * 4.0 + floor(hp.z * 1.2) * 0.37, fp * 4.0 * 2.0);
      col = style > 1.5 ? vec3(0.55, 0.53, 0.5) : mix(vec3(0.42, 0.28, 0.18), vec3(0.5, 0.34, 0.22), plank) * (h1(seed * 4.4) < 0.3 ? 0.55 : 1.0); }
    else { col = vec3(0.9, 0.89, 0.86); lamp = exp(-dot(hp.xz - vec2(0.0, -D * 0.5), hp.xz - vec2(0.0, -D * 0.5)) * 1.5); }
    // A sofa / desk / counter silhouette near the back wall.
    vec3 bmin = vec3(-0.9, fl, -D), bmax = vec3(0.9, fl + (style > 0.5 ? 0.75 : 0.85), -D + 0.85);
    vec3 i0 = (bmin - ro) / rd, i1 = (bmax - ro) / rd, tmn = min(i0, i1), tmx = max(i0, i1);
    float tn = max(max(tmn.x, tmn.y), tmn.z), tf = min(min(tmx.x, tmx.y), tmx.z);
    if (tn < tf && tn > 0.0 && tn < t) { col = vec3(h1(seed * 11.0), h1(seed * 12.0), h1(seed * 13.0)) * 0.35 + 0.1; t = tn; }
    // Lighting: lit rooms at night (warm or cool, ceiling lamp), daylight rooms dim; some TVs flicker.
    float on = step(h1(seed * 17.0), vWin.y) * uNight;
    vec3 lightC = mix(uWarm, uCool, step(0.72, h1(seed * 21.0)));
    float tv = step(0.86, h1(seed * 23.0)) * step(0.5, on);
    float fall = 1.0 / (1.0 + t * t * 0.08);
    vec3 interior = col * (uDay * 0.32 * fall + on * lightC * (0.5 + 1.3 * lamp) * fall * 1.05);   // warm rooms, not blown out
    interior += tv * vec3(0.25, 0.42, 0.8) * (0.5 + 0.5 * sin(uTime * 7.0 + seed * 30.0) * sin(uTime * 2.3 + seed)) * 0.6 * step(tz - 0.01, t);
    // Curtains or blinds in the window plane.
    float kind = h1(seed * 29.0), wu = vUv.x, wv = vUv.y;
    if (kind < 0.45) { float cov = 0.12 + 0.3 * h1(seed * 31.0), folds = 0.85 + 0.15 * sin(wu * 60.0) * (1.0 - smoothstep(0.1, 0.4, glassFp * 60.0 / (6.2832 * max(vSize.x, 0.1))));
      if (wu < cov || wu > 1.0 - cov * (0.6 + 0.8 * h1(seed * 33.0))) { vec3 cc = palette(h1(seed * 35.0)) * vec3(1.0, 0.92, 0.85) * folds;
        interior = cc * (uDay * 0.45 + on * lightC * 0.8 + 0.02); } }
    else if (kind < 0.7) { float drop = h1(seed * 37.0) * 0.8; if (wv > 1.0 - drop) { float slat = 0.75 + 0.25 * stripes(wv * vSize.y * 18.0, glassFp * 18.0);
      interior = vec3(0.85, 0.83, 0.78) * slat * (uDay * 0.5 + on * lightC * 0.9 + 0.02); } }
    // Glass: Fresnel sky reflection over the room.
    vec3 v = normalize(vCam - vP); float fres = 0.04 + 0.96 * pow(1.0 - clamp(v.z, 0.0, 1.0), 5.0);
    vec3 r = reflect(-v, vec3(0.0, 0.0, 1.0)); vec3 sky = mix(uHor, uZen, clamp(r.y * 1.4, 0.0, 1.0));
    vec3 c = interior + sky * (fres * (0.35 + 0.65 * uDay) + 0.05 * uDay) * (1.0 - 0.7 * on);
    c *= 0.96 + 0.04 * hv(floor(vWorld * 6.0));              // faint pane-to-pane glass variation
    gl_FragColor = vec4(c, 1.0);
  }`;

/** Interior-mapped window material for instanced quads (attributes aWin, aSize). */
export function windowMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: WIN_VS, fragmentShader: WIN_FS, fog: false,
    uniforms: { uNight: { value: 0 }, uDay: { value: 1 }, uTime: { value: 0 }, uZen: { value: new THREE.Color(0x4d7fc0) }, uHor: { value: new THREE.Color(0xc9d8e6) },
      uWarm: { value: new THREE.Color(1.0, 0.72, 0.42) }, uCool: { value: new THREE.Color(0.78, 0.86, 1.0) } },
  });
}

interface Win { x: number; y: number; z: number; ry: number; w: number; h: number; style: number; depth: number }

export class Building {
  readonly group = new THREE.Group();
  readonly height: number;
  readonly windowMat = windowMaterial();
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private signMat?: THREE.MeshStandardMaterial;

  constructor(o: BuildingOptions, pbr: PBRLibrary) {
    const r = rng(o.seed ?? 5), fh = o.floorHeight ?? (o.style === 'tower' || o.style === 'office' ? 3.6 : o.style === 'cottage' ? 2.9 : 3.2);
    const W = o.width, Dp = o.depth, F = o.floors, H = (this.height = F * fh + (o.style === 'shop' ? 0.6 : 0));
    const wallSet = o.wall ?? ({ townhouse: 'red_brick_03', apartment: 'beige_wall_001', tower: 'rectangular_facade_tiles', shop: 'brick_wall_001', cottage: 'white_plaster_02', office: 'concrete_wall_008' } as const)[o.style];
    const wallMat = pbr.material(wallSet, { tint: o.wallTint ?? 0xffffff });
    const trimMat = pbr.material(o.style === 'cottage' ? 'large_sandstone_blocks' : 'concrete_wall_008', { tint: o.trimTint ?? 0xe8e2d6, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.4 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, uv = true) => {
      const m = new THREE.Mesh(uv ? projectUVs(geo) : geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; this.group.add(m); return m; };
    // Main volume, then trims: plinth, floor bands, cornice/parapet.
    const body = new THREE.BoxGeometry(W, H, Dp).translate(0, H / 2, 0);
    add(body, wallMat, 0, 0, 0);
    add(new THREE.BoxGeometry(W + 0.12, 0.55, Dp + 0.12), trimMat, 0, 0.275, 0);
    if (o.style !== 'tower') for (let f = 1; f < F; f++) add(new THREE.BoxGeometry(W + 0.06, 0.14, Dp + 0.06), trimMat, 0, f * fh + (o.style === 'shop' ? 0.6 : 0) - 0.05, 0);
    const roof = o.roof ?? (o.style === 'cottage' || o.style === 'townhouse' ? 'gable' : 'flat');
    if (roof === 'flat') {
      add(new THREE.BoxGeometry(W + 0.3, 0.32, Dp + 0.3), trimMat, 0, H + 0.16, 0);
      add(new THREE.BoxGeometry(W - 0.2, 0.7, Dp - 0.2), wallMat, 0, H + 0.35, 0);   // parapet (hollowness hidden from street level)
      for (let k = 0; k < 2 + Math.floor(r() * 3); k++) add(new THREE.BoxGeometry(0.8 + r() * 1.4, 0.7 + r() * 0.8, 0.8 + r() * 1.2), darkMat, (r() - 0.5) * (W - 2), H + 1.0, (r() - 0.5) * (Dp - 2), false);
    } else {
      const roofMat = pbr.material(o.roofSet ?? (o.style === 'cottage' ? 'clay_roof_tiles_02' : 'grey_roof_tiles'), { tint: o.roofTint ?? 0xffffff });
      const rise = W * (o.style === 'cottage' ? 0.42 : 0.32), shape = new THREE.Shape([new THREE.Vector2(-W / 2 - 0.3, 0), new THREE.Vector2(W / 2 + 0.3, 0), new THREE.Vector2(0, rise)]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: Dp + 0.5, bevelEnabled: false }).translate(0, 0, -(Dp + 0.5) / 2);
      // UVs along the slopes in metres for the tile texture.
      const pos = g.attributes.position as THREE.BufferAttribute, uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); uv[i * 2] = z / 1.0; uv[i * 2 + 1] = (Math.abs(x) * 0.3 + y) / 1.0 * (x < 0 ? 1 : -1); }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals();
      const rm = new THREE.Mesh(g, roofMat); rm.position.y = H; rm.castShadow = rm.receiveShadow = true; this.group.add(rm);
      const gableShape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, rise - 0.15)]);
      for (const z of [Dp / 2, -Dp / 2]) { const gg = new THREE.ShapeGeometry(gableShape); const m = new THREE.Mesh(projectUVs(gg), wallMat); m.position.set(0, H, z); if (z < 0) m.rotation.y = Math.PI; m.castShadow = m.receiveShadow = true; this.group.add(m); }
      add(new THREE.BoxGeometry(0.55, 1.4, 0.55), pbr.material('brick_wall_001'), W * 0.28, H + rise * 0.55 + 0.4, -Dp * 0.15);
    }
    // Windows on all four facades.
    const wins: Win[] = [], perFloor = o.windowsPerFloor ?? Math.max(1, Math.floor(W / (o.style === 'tower' || o.style === 'office' ? 1.8 : 2.6)));
    const ww = o.windowW ?? (o.style === 'tower' ? W / perFloor - 0.25 : o.style === 'office' ? 1.5 : o.style === 'cottage' ? 0.85 : 1.05), wh = o.windowH ?? (o.style === 'tower' ? fh - 0.55 : o.style === 'cottage' ? 1.05 : o.style === 'office' ? 1.9 : 1.55);
    const style = o.style === 'tower' || o.style === 'office' ? 1 : 0;
    const startF = o.style === 'shop' ? 1 : 0;
    for (const [face, len, nx, nz, ry] of [[0, W, 0, 1, 0], [1, W, 0, -1, Math.PI], [2, Dp, 1, 0, Math.PI / 2], [3, Dp, -1, 0, -Math.PI / 2]] as const) {
      const cols = face < 2 ? perFloor : Math.max(1, Math.floor(len / 3.2));
      for (let f = startF; f < F; f++) for (let c = 0; c < cols; c++) {
        if (f === 0 && face === 0 && c === Math.floor(cols / 2) && o.style !== 'tower') continue;   // the door
        const u = (c + 0.5) / cols - 0.5, y = f * fh + (o.style === 'shop' ? 0.6 : 0) + (style ? fh * 0.5 : 0.95 + wh / 2);
        const along = u * len, off = (face < 2 ? Dp : W) / 2 + 0.012;
        wins.push({ x: nz !== 0 ? along * nz : off * nx, y, z: nz !== 0 ? off * nz : -along * nx, ry, w: ww, h: wh, style, depth: 3 + r() * 2.5 });
      }
    }
    // Shopfront: wide glazing with a bright interior, sign and awning.
    if (o.shop) {
      wins.push({ x: 0, y: 1.75, z: Dp / 2 + 0.012, ry: 0, w: W * 0.72, h: 2.5, style: 2, depth: 5 });
      const sign = canvasSign(o.shop.sign, o.shop.color ?? 0xffd27a);
      this.signMat = new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.5 });
      const s = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.55, 0.08), [darkMat, darkMat, darkMat, darkMat, this.signMat, darkMat]); s.position.set(0, 3.35, Dp / 2 + 0.05); this.group.add(s);
      if (o.shop.awning !== null) {
        const aw = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, 1.3, 1, 1), new THREE.MeshStandardMaterial({ map: stripes(o.shop.awning ?? 0x9c2f2f), roughness: 0.85, side: THREE.DoubleSide }));
        aw.position.set(0, 3.0, Dp / 2 + 0.6); aw.rotation.x = -Math.PI / 2 + 0.42; aw.castShadow = true; this.group.add(aw);
      }
    }
    this.addWindows(wins, o, r, trimMat, darkMat);
    // Door with a small lamp.
    if (o.style !== 'tower' && !o.shop) {
      add(new THREE.BoxGeometry(1.1, 2.2, 0.12), pbr.material('wood_table_001', { tint: [0x5a3a26, 0x2f4a3a, 0x7a2f2a, 0x2b3550][Math.floor(r() * 4)] }), 0, 0.55 + 1.1, Dp / 2 + 0.02);
      add(new THREE.BoxGeometry(1.4, 0.12, 0.35), trimMat, 0, 2.95, Dp / 2 + 0.15);
      const lm = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.3 }); this.lampMats.push(lm);
      add(new THREE.SphereGeometry(0.09, 12, 8), lm, 0.8, 2.5, Dp / 2 + 0.12, false);
    }
    if (o.balconies) for (let f = 1; f < F; f++) for (let c = 0; c < perFloor; c += 2) {
      const u = (c + 0.5) / perFloor - 0.5, y = f * fh + 0.1;
      add(new THREE.BoxGeometry(ww + 0.8, 0.14, 0.9), trimMat, u * W, y, Dp / 2 + 0.45);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.8, 0.9, 0.03), new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.4, metalness: 0.7, transparent: true, opacity: 0.85 }));
      rail.position.set(u * W, y + 0.52, Dp / 2 + 0.88); this.group.add(rail);
    }
  }

  private addWindows(wins: Win[], o: BuildingOptions, r: () => number, trimMat: THREE.Material, darkMat: THREE.Material) {
    const n = wins.length, quad = new THREE.PlaneGeometry(1, 1);
    const aWin = new Float32Array(n * 4), aSize = new Float32Array(n * 2), lit = o.litFraction ?? 0.6;
    const glass = new THREE.InstancedMesh(quad, this.windowMat, n);
    const frameGeo = frameGeometry(), frames = new THREE.InstancedMesh(frameGeo, o.style === 'tower' ? darkMat : trimMat, n);
    const shutters = o.shutters ? new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.04), new THREE.MeshStandardMaterial({ color: o.shutters, roughness: 0.8 }), n * 2) : null;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    wins.forEach((w, i) => {
      q.setFromEuler(e.set(0, w.ry, 0));
      glass.setMatrixAt(i, m.compose(new THREE.Vector3(w.x, w.y, w.z), q, new THREE.Vector3(1, 1, 1)));
      frames.setMatrixAt(i, m.compose(new THREE.Vector3(w.x, w.y, w.z), q, new THREE.Vector3(w.w, w.h, w.style === 1 ? 0.6 : 1)));
      if (shutters) for (const sx of [-1, 1]) { const off = new THREE.Vector3(sx * (w.w * 0.5 + 0.28), 0, 0.03).applyQuaternion(q); shutters.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), m.compose(new THREE.Vector3(w.x, w.y, w.z).add(off), q, new THREE.Vector3(0.5, w.h, 1))); }
      aWin.set([r() * 1000, w.style === 2 ? 1.0 : lit, w.depth, w.style], i * 4); aSize.set([w.w, w.h], i * 2);
    });
    quad.setAttribute('aWin', new THREE.InstancedBufferAttribute(aWin, 4)); quad.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2));
    frames.castShadow = true; frames.receiveShadow = true; glass.receiveShadow = false;
    this.group.add(glass, frames); if (shutters) { shutters.castShadow = true; this.group.add(shutters); }
  }

  /** 0 = day, 1 = full night: rooms light up, door lamps and signs glow; sky colours tint the glass reflections. */
  setLight(night: number, zenith: THREE.ColorRepresentation, horizon: THREE.ColorRepresentation) {
    const u = this.windowMat.uniforms; u.uNight.value = night; u.uDay.value = 1 - night * 0.92; u.uZen.value.set(zenith); u.uHor.value.set(horizon);
    for (const l of this.lampMats) l.emissiveIntensity = 3.5 * night;
    if (this.signMat) this.signMat.emissiveIntensity = 0.35 + 2.4 * night;
  }
  update(time_s: number) { this.windowMat.uniforms.uTime.value = time_s; }
}

/** Unit window surround (sides, head and a deeper sill) scaled per instance to the window size. */
function frameGeometry() {
  const parts: THREE.BufferGeometry[] = [], t = 0.07, d = 0.16;
  parts.push(new THREE.BoxGeometry(1 + 2 * t, t, d).translate(0, 0.5 + t / 2, d / 2 - 0.02));
  parts.push(new THREE.BoxGeometry(1 + 2 * t + 0.08, t * 1.2, d + 0.08).translate(0, -0.5 - t * 0.6, (d + 0.08) / 2 - 0.02));
  for (const x of [-0.5 - t / 2, 0.5 + t / 2]) parts.push(new THREE.BoxGeometry(t, 1, d).translate(x, 0, d / 2 - 0.02));
  parts.push(new THREE.BoxGeometry(0.025, 1, 0.04).translate(0, 0, 0.02));   // mullion
  parts.push(new THREE.BoxGeometry(1, 0.025, 0.04).translate(0, 0.12, 0.02));   // transom
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (const p of parts) { const b = pos.length / 3; pos.push(...(p.attributes.position.array as Float32Array)); nrm.push(...(p.attributes.normal.array as Float32Array)); idx.push(...Array.from(p.index!.array as Uint16Array, (i) => i + b)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}
function canvasSign(text: string, color: THREE.ColorRepresentation) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d')!;
  g.fillStyle = '#16181c'; g.fillRect(0, 0, 1024, 160); g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 6; g.strokeRect(8, 8, 1008, 144);
  g.fillStyle = `#${new THREE.Color(color).getHexString()}`; g.font = '700 92px "Playfair Display", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = g.fillStyle; g.shadowBlur = 18; g.fillText(text, 512, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function stripes(color: THREE.ColorRepresentation) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d')!, col = new THREE.Color(color);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#efe9dc' : `#${col.getHexString()}`; g.fillRect(i * 32, 0, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
}
