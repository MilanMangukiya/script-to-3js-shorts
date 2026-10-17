import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, fbm2, clamp, smoothstep } from '../util/math';
import { Sailboat } from '../vehicles/Sailboat';

export interface HarbourBoatSpec {
  kind: 'yacht' | 'fishing';
  /** Mooring position (boat centre) and heading (radians; 0 = bow toward +X). */
  x: number; z: number; heading: number;
  length?: number; color?: THREE.ColorRepresentation; seed?: number;
  /** Heel when grounded (radians, sign picks the side). */
  groundHeel?: number;
}
export interface HarbourBasinOptions {
  seed?: number;
  /** Basin interior: x in [-halfWidth, halfWidth], z from headZ (landward quay) to mouthZ (seaward, more negative). */
  halfWidth?: number; headZ?: number; mouthZ?: number;
  /** Width of the side quays and of the harbour mouth opening (half). */
  sideQuayWidth?: number; mouthHalfWidth?: number;
  /** World heights: quay top, mean sea level, floor near the walls and in the central channel. */
  quayTop?: number; meanSea?: number; floorWall?: number; floorChannel?: number;
  /** Lighthouse on the south (+X) or north (-X) breakwater end, or none. */
  lighthouse?: 1 | -1 | 0;
  boats?: HarbourBoatSpec[];
  /** Quay lamp positions [x, z]; each gets an emissive lantern (the first `lights` also get point lights). */
  lamps?: [number, number][]; lights?: number;
  /** Areas left unpaved at quay level (e.g. where a street already has its own surface): [x0, x1, z0, z1]. */
  pavingHoles?: [number, number, number, number][];
}

interface BoatRig { spec: HarbourBoatSpec; g: THREE.Group; tilt: THREE.Group; yacht?: Sailboat; draft: number; floor: number }

const tex = (c: HTMLCanvasElement, rx: number, ry: number) => {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t;
};
function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); return c; }

/** Ashlar quay wall, 4 m wide x 12 m tall per tile, from y = top - 12 (bottom of the image) to the top: weed, tide stains, dry stone. */
function wallTexture(seed: number, meanBelowTop: number) {
  const r = rng(seed), W = 512, H = 1536, pxm = H / 12;
  return canvas(W, H, (g) => {
    for (let y = 0; y < H; y += 48) for (let x = -((y / 48) % 2) * 64; x < W; x += 128) {
      const v = 112 + r() * 40, tint = r() * 10;
      g.fillStyle = `rgb(${v + tint},${v + tint * .6},${v - 6})`; g.fillRect(x + 2, y + 2, 124, 44);
      for (let k = 0; k < 40; k++) { const s = 60 + r() * 120; g.fillStyle = `rgba(${s},${s},${s - 8},.18)`; g.fillRect(x + r() * 124, y + r() * 44, 2 + r() * 6, 1 + r() * 4); }
    }
    g.fillStyle = 'rgba(30,30,28,.55)';
    for (let y = 0; y < H; y += 48) g.fillRect(0, y, W, 3);
    for (let y = 0; y < H; y += 48) for (let x = -((y / 48) % 2) * 64; x < W; x += 128) g.fillRect(x, y, 3, 48);
    // Tide zones measured from the top: dry above high water, barnacle-grey intertidal band, dark weed below low water.
    const yMean = meanBelowTop * pxm;
    const grad = g.createLinearGradient(0, 0, 0, H);
    const at = (m: number) => clamp(m * pxm / H, 0, 1);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(at(meanBelowTop - 1.4), 'rgba(0,0,0,0)');
    grad.addColorStop(at(meanBelowTop - 0.9), 'rgba(48,52,44,.35)'); grad.addColorStop(at(meanBelowTop + 0.6), 'rgba(40,46,36,.55)');
    grad.addColorStop(at(meanBelowTop + 1.6), 'rgba(28,36,22,.78)'); grad.addColorStop(1, 'rgba(18,24,14,.9)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 2600; k++) { // barnacles and weed specks in the intertidal band
      const y = yMean + (r() - .35) * 2.6 * pxm, x = r() * W, s = 1 + r() * 2.5;
      g.fillStyle = r() < .55 ? 'rgba(190,190,176,.45)' : 'rgba(30,48,22,.6)'; g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill();
    }
    for (let k = 0; k < 90; k++) { // vertical drip stains from the coping
      const x = r() * W, len = (0.6 + r() * 2.2) * pxm; const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, 'rgba(40,36,30,.32)'); gr.addColorStop(1, 'rgba(40,36,30,0)'); g.fillStyle = gr; g.fillRect(x, 0, 2 + r() * 5, len);
    }
  });
}
function pavingTexture(seed: number) {
  const r = rng(seed);
  return canvas(512, 512, (g) => {
    g.fillStyle = '#6e6c66'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 128) {
      const v = 98 + r() * 34; g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(x + 2, y + 2, 124, 60);
      for (let k = 0; k < 60; k++) { const s = 70 + r() * 110; g.fillStyle = `rgba(${s},${s},${s},.16)`; g.fillRect(x + r() * 124, y + r() * 60, 1 + r() * 3, 1 + r() * 3); }
    }
  });
}
function mudTexture(seed: number) {
  const r = rng(seed);
  return canvas(512, 512, (g) => {
    g.fillStyle = '#6a665a'; g.fillRect(0, 0, 512, 512);
    const img = g.getImageData(0, 0, 512, 512), d = img.data;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const n = fbm2(x / 64, y / 64, seed, 5), m = fbm2(x / 13, y / 13, seed + 9, 3), i = (y * 512 + x) * 4;
      const v = 0.55 + 0.6 * n + 0.18 * m;
      d[i] = 104 * v; d[i + 1] = 100 * v + 6 * m; d[i + 2] = 86 * v;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 340; k++) { // shells, pebbles and weed scraps
      const x = r() * 512, y = r() * 512; g.fillStyle = r() < .4 ? 'rgba(170,165,150,.55)' : r() < .7 ? 'rgba(36,52,28,.6)' : 'rgba(20,20,18,.5)';
      g.beginPath(); g.ellipse(x, y, 1 + r() * 3, 1 + r() * 2, r() * 3, 0, 6.283); g.fill();
    }
  });
}

/** Simple wooden-hulled fishing boat (local frame like Sailboat: bow +X, waterline y = 0). */
function fishingBoat(length: number, color: THREE.ColorRepresentation, seed: number): { g: THREE.Group; draft: number } {
  const g = new THREE.Group(), L = length, B = L * 0.36, r = rng(seed);
  const hullMat = new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .05 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: .5 }), dark = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: .6 });
  const pos: number[] = [], idx: number[] = [], nu = 28, nv = 12;
  const half = (u: number) => (B / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, u * .9 + .1)), .5) * (u > .8 ? 1 - Math.pow((u - .8) / .2, 2) * .85 : 1);
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, x = (u - .5) * L, h = Math.max(half(u), .02), fb = L * (.09 + .04 * u), dr = L * .1 * Math.sin(Math.PI * Math.min(1, u * .95 + .05));
    for (let j = 0; j <= nv; j++) { const a = (j / nv) * Math.PI - Math.PI / 2, s = Math.sin(a), c = Math.cos(a); pos.push(x, fb - (fb + dr) * Math.pow(c, .8), h * Math.sign(s) * Math.pow(Math.abs(s), .6)); }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setIndex(idx); hg.computeVertexNormals();
  const hull = new THREE.Mesh(hg, hullMat); hull.castShadow = true; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L * .8, L * .02, B * .78), new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: .85 })); deck.position.y = L * .1; g.add(deck);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(L * .22, L * .15, B * .6), white); cab.position.set(-L * .08, L * .18, 0); cab.castShadow = true; g.add(cab);
  const win = new THREE.Mesh(new THREE.BoxGeometry(L * .225, L * .045, B * .55), new THREE.MeshStandardMaterial({ color: 0x18242c, roughness: .15, metalness: .4 })); win.position.set(-L * .08, L * .225, 0); g.add(win);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, L * .55, 8), dark); mast.position.set(L * .15, L * .38, 0); g.add(mast);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, L * .32, 6), dark); boom.rotation.z = 1.1 + r() * .2; boom.position.set(L * .25, L * .3, 0); g.add(boom);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * .82, L * .012, B * 1.01), white); stripe.position.y = L * .075; g.add(stripe);
  return { g, draft: L * .1 };
}

/**
 * harbour-basin-v1 — metre-scale stone harbour: ashlar quay walls with tide staining, coping, steps, ladders, bollards,
 * railings, granite-paved quays, a mud floor heightfield, breakwater arms with a lighthouse, quay lamps, and moored
 * boats that float on the current sea level and ground and heel on the mud as it falls. The water surface itself is
 * supplied by the caller (e.g. ocean-surface-v1 at the same level). Deterministic: `update(time_s, seaLevel)`.
 */
export class HarbourBasin {
  readonly group = new THREE.Group();
  readonly boats: BoatRig[] = [];
  readonly lampHeads: THREE.MeshStandardMaterial[] = [];
  readonly lampLights: THREE.PointLight[] = [];
  readonly lampPositions: THREE.Vector3[] = [];
  readonly lighthouseLamp?: THREE.MeshStandardMaterial;
  readonly lighthouseTop = new THREE.Vector3();
  private beam?: THREE.Mesh;
  readonly o: Required<Omit<HarbourBasinOptions, 'boats' | 'lamps' | 'pavingHoles'>> & { boats: HarbourBoatSpec[]; lamps: [number, number][]; pavingHoles: [number, number, number, number][] };

  constructor(opts: HarbourBasinOptions = {}) {
    const o = this.o = { seed: 31, halfWidth: 55, headZ: -104, mouthZ: -290, sideQuayWidth: 20, mouthHalfWidth: 13, quayTop: 0, meanSea: -2.2,
      floorWall: -7.0, floorChannel: -8.8, lighthouse: 1, lights: 2, boats: [], lamps: [], pavingHoles: [], ...opts } as HarbourBasin['o'];
    const hw = o.halfWidth, top = o.quayTop, sq = o.sideQuayWidth, r = rng(o.seed);
    const meanBelowTop = top - o.meanSea;
    const stone = new THREE.MeshStandardMaterial({ map: tex(wallTexture(o.seed, meanBelowTop), 1, 1), roughness: .86 });
    const coping = new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: .8 });
    const paving = new THREE.MeshStandardMaterial({ map: tex(pavingTexture(o.seed + 3), 1, 1), roughness: .78 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: .45, metalness: .6 });
    const rail = new THREE.MeshStandardMaterial({ color: 0x2c4a5a, roughness: .5, metalness: .4 });
    const statics: Record<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }> = {};
    const add = (key: string, mat: THREE.Material, geo: THREE.BufferGeometry, m?: THREE.Matrix4) => {
      (statics[key] ??= { mat, geos: [] }).geos.push(m ? geo.applyMatrix4(m) : geo);
    };
    const boxAt = (key: string, mat: THREE.Material, s: [number, number, number], p: [number, number, number], ry = 0) =>
      add(key, mat, new THREE.BoxGeometry(...s), new THREE.Matrix4().makeRotationY(ry).setPosition(...p));

    // ---- quay walls: vertical quads with UVs in metres (u along the wall / 4 m, v = (y - (top-12)) / 12)
    const bottom = Math.min(o.floorChannel, o.floorWall) - 1.5;
    const wall = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.BufferGeometry();
      const p = [x0, bottom, z0, x1, bottom, z1, x1, top, z1, x0, top, z0];
      const vb = (bottom - (top - 12)) / 12;
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, vb, len / 4, vb, len / 4, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); add('wall', stone, g);
      // coping kerb along the top edge
      const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
      const cg = new THREE.BoxGeometry(len, .32, .55);
      add('coping', coping, cg, new THREE.Matrix4().makeRotationY(-Math.atan2(z1 - z0, x1 - x0)).setPosition((x0 + x1) / 2 - nx * .2, top - .14, (z0 + z1) / 2 - nz * .2));
    };
    // Faces point into the basin: head wall faces -Z, side walls face inward.
    wall(hw, o.headZ, -hw, o.headZ);
    wall(-hw, o.headZ, -hw, o.mouthZ);
    wall(hw, o.mouthZ, hw, o.headZ);
    // Breakwater arms across the mouth (inner faces), leaving the opening.
    wall(-o.mouthHalfWidth, o.mouthZ, -hw, o.mouthZ);
    wall(hw, o.mouthZ, o.mouthZ < 0 ? o.mouthHalfWidth : 0, o.mouthZ);
    // Arm ends (vertical faces at the opening) and the seaward faces.
    wall(-o.mouthHalfWidth, o.mouthZ - 14, -o.mouthHalfWidth, o.mouthZ);
    wall(o.mouthHalfWidth, o.mouthZ, o.mouthHalfWidth, o.mouthZ - 14);
    wall(-hw - sq, o.mouthZ - 14, -o.mouthHalfWidth, o.mouthZ - 14);
    wall(o.mouthHalfWidth, o.mouthZ - 14, hw + sq, o.mouthZ - 14);
    wall(-hw - sq, o.headZ, -hw - sq, o.mouthZ - 14);
    wall(hw + sq, o.mouthZ - 14, hw + sq, o.headZ);

    // ---- quay-level paving (top faces), with holes left for other surfaces
    const pave = (x0: number, x1: number, z0: number, z1: number) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 8, uv.getY(i) * (z1 - z0) / 8);
      add('paving', paving, g, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, top, (z0 + z1) / 2));
    };
    const rects: [number, number, number, number][] = [
      [-hw - sq, -hw, o.mouthZ - 14, o.headZ], [hw, hw + sq, o.mouthZ - 14, o.headZ],
      [-hw, -o.mouthHalfWidth, o.mouthZ - 14, o.mouthZ], [o.mouthHalfWidth, hw, o.mouthZ - 14, o.mouthZ]];
    for (const rc of rects) pave(...rc);
    // Plaza between the quay head and the town (z from headZ to headZ + 36), minus holes.
    const plaza: [number, number, number, number] = [-hw - sq - 30, hw + sq + 30, o.headZ, o.headZ + 36];
    const holes = o.pavingHoles;
    const cut = (rc: [number, number, number, number]): [number, number, number, number][] => {
      for (const h of holes) {
        const [x0, x1, z0, z1] = rc, [hx0, hx1, hz0, hz1] = h;
        if (hx1 <= x0 || hx0 >= x1 || hz1 <= z0 || hz0 >= z1) continue;
        const out: [number, number, number, number][] = [];
        if (hx0 > x0) out.push([x0, hx0, z0, z1]);
        if (hx1 < x1) out.push([hx1, x1, z0, z1]);
        const cx0 = Math.max(x0, hx0), cx1 = Math.min(x1, hx1);
        if (hz0 > z0) out.push([cx0, cx1, z0, hz0]);
        if (hz1 < z1) out.push([cx0, cx1, hz1, z1]);
        return out.flatMap(cut);
      }
      return [rc];
    };
    for (const rc of cut(plaza)) pave(...rc);

    // ---- steps down the head wall and the north wall; iron ladders; bollards; railing on the head quay
    const stepsAt = (x: number, z: number, along: 'x' | 'z', dir: number) => {
      for (let k = 0; k < 18; k++) {
        const y = top - .3 - k * .38, off = .2 + k * .32;
        if (along === 'x') boxAt('coping', coping, [1.6, .38, .34], [x, y, z - dir * off]);
        else boxAt('coping', coping, [.34, .38, 1.6], [x + dir * off, y, z]);
      }
    };
    stepsAt(-30, o.headZ, 'x', 1);
    stepsAt(-hw, o.headZ - 40, 'z', 1);
    for (const [x, z, ry] of [[22, o.headZ, 0], [-hw, o.headZ - 85, Math.PI / 2], [hw, o.headZ - 60, Math.PI / 2], [hw, o.headZ - 130, Math.PI / 2]] as const) {
      for (const s of [-.22, .22]) boxAt('iron', iron, [.05, top - bottom - 1, .05], [x + (ry ? 0 : s), (top + bottom) / 2, z + (ry ? s : 0) - (ry ? 0 : .12)]);
      for (let y = top - .3; y > bottom + 1; y -= .32) boxAt('iron', iron, ry ? [.05, .04, .5] : [.5, .04, .05], [x + (ry ? (x > 0 ? -.12 : .12) : 0), y, z - (ry ? 0 : .12)]);
    }
    const bollard = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(.2, 0), new THREE.Vector2(.17, .38), new THREE.Vector2(.12, .5), new THREE.Vector2(.2, .6), new THREE.Vector2(.18, .68), new THREE.Vector2(0, .7)], 14);
    this.bollards = [];
    const placeBollard = (x: number, z: number) => { add('iron', iron, bollard.clone(), new THREE.Matrix4().makeTranslation(x, top, z)); this.bollards.push(new THREE.Vector3(x, top + .55, z)); };
    for (let x = -hw + 6; x <= hw - 6; x += 12) placeBollard(x, o.headZ + .9);
    for (let z = o.headZ - 10; z >= o.mouthZ + 6; z -= 14) { placeBollard(-hw - .9, z); placeBollard(hw + .9, z); }
    for (let x = -hw + 2; x <= hw - 2; x += 2.4) boxAt('rail', rail, [.06, 1.05, .06], [x, top + .52, o.headZ + 2.2]);
    for (const y of [.55, 1.02]) boxAt('rail', rail, [hw * 2 - 4, .05, .06], [0, top + y, o.headZ + 2.2]);

    // ---- breakwater parapet and lighthouse
    boxAt('coping', coping, [hw + sq - o.mouthHalfWidth, 1.1, .8], [-(hw + sq + o.mouthHalfWidth) / 2, top + .55, o.mouthZ - 13.4]);
    boxAt('coping', coping, [hw + sq - o.mouthHalfWidth, 1.1, .8], [(hw + sq + o.mouthHalfWidth) / 2, top + .55, o.mouthZ - 13.4]);
    if (o.lighthouse) {
      const lx = o.lighthouse * (o.mouthHalfWidth + 4.5), lz = o.mouthZ - 7, H = 13;
      const red = new THREE.MeshStandardMaterial({ color: 0xa8302a, roughness: .55 }), whiteM = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: .5 });
      for (let k = 0; k < 5; k++) {
        const r0 = 2.3 - k * .22, r1 = 2.3 - (k + 1) * .22;
        add(k % 2 ? 'lhRed' : 'lhWhite', k % 2 ? red : whiteM, new THREE.CylinderGeometry(r1, r0, H / 5, 28), new THREE.Matrix4().makeTranslation(lx, top + H / 10 + k * H / 5, lz));
      }
      add('iron', iron, new THREE.CylinderGeometry(1.75, 1.75, .18, 28), new THREE.Matrix4().makeTranslation(lx, top + H + .09, lz));
      for (let a = 0; a < 16; a++) boxAt('iron', iron, [.04, .9, .04], [lx + Math.cos(a / 16 * 6.283) * 1.65, top + H + .6, lz + Math.sin(a / 16 * 6.283) * 1.65]);
      const glass = new THREE.MeshStandardMaterial({ color: 0x223038, roughness: .1, metalness: .3, transparent: true, opacity: .55 });
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.5, 20), glass); lantern.position.set(lx, top + H + .95, lz); this.group.add(lantern);
      const lampMat = (this as any).lighthouseLamp = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe2a8, emissiveIntensity: 6, roughness: .3 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12), lampMat); lamp.position.set(lx, top + H + .95, lz); this.group.add(lamp);
      add('lhRed', red, new THREE.ConeGeometry(1.25, 1.1, 20), new THREE.Matrix4().makeTranslation(lx, top + H + 2.25, lz));
      this.lighthouseTop.set(lx, top + H + .95, lz);
      // A soft rotating beam (additive, fades along its length).
      const beamGeo = new THREE.ConeGeometry(2.2, 60, 24, 1, true); beamGeo.translate(0, -30, 0); beamGeo.rotateZ(Math.PI / 2);
      const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { uK: { value: .5 } },
        vertexShader: `varying float vX; varying vec3 vN; varying vec3 vV; void main(){ vX = -position.x / 60.0; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform float uK; varying float vX; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.5); float a = f * pow(1.0 - clamp(vX,0.0,1.0), 2.0) * smoothstep(0.0, 0.05, vX) * uK; gl_FragColor = vec4(vec3(1.0, .9, .7) * a, 1.0); }` });
      this.beam = new THREE.Mesh(beamGeo, beamMat); this.beam.position.copy(this.lighthouseTop); this.beam.frustumCulled = false; this.group.add(this.beam);
    }

    // ---- quay lamps
    const lampPost = new THREE.MeshStandardMaterial({ color: 0x1c2226, roughness: .5, metalness: .5 });
    o.lamps.forEach(([x, z], i) => {
      add('lampPost', lampPost, new THREE.CylinderGeometry(.07, .1, 4.6, 10), new THREE.Matrix4().makeTranslation(x, top + 2.3, z));
      add('lampPost', lampPost, new THREE.CylinderGeometry(.2, .26, .2, 10), new THREE.Matrix4().makeTranslation(x, top + .1, z));
      add('lampPost', lampPost, new THREE.ConeGeometry(.34, .28, 8), new THREE.Matrix4().makeTranslation(x, top + 5.08, z));
      const head = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb45e, emissiveIntensity: 5, roughness: .35 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.22, .16, .5, 10), head); m.position.set(x, top + 4.75, z); this.group.add(m);
      this.lampHeads.push(head); this.lampPositions.push(new THREE.Vector3(x, top + 4.75, z));
      if (i < o.lights) { const l = new THREE.PointLight(0xffb870, 40, 26, 1.8); l.position.set(x, top + 4.6, z); this.group.add(l); this.lampLights.push(l); }
    });

    // ---- mud floor
    const fx0 = -hw, fx1 = hw, fz0 = o.mouthZ - 14, fz1 = o.headZ, nx = 110, nz = 200;
    const floor = new THREE.PlaneGeometry(fx1 - fx0, fz1 - fz0, nx, nz); floor.rotateX(-Math.PI / 2); floor.translate((fx0 + fx1) / 2, 0, (fz0 + fz1) / 2);
    const fp = floor.attributes.position as THREE.BufferAttribute, fuv = floor.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i); fp.setY(i, this.floorAt(x, z)); fuv.setXY(i, x / 9, z / 9); }
    floor.computeVertexNormals();
    const mudMap = tex(mudTexture(o.seed + 5), 1, 1);
    const mud = new THREE.Mesh(floor, new THREE.MeshStandardMaterial({ map: mudMap, roughness: .55, metalness: .02, color: 0xb8b2a6 }));
    mud.receiveShadow = true; this.group.add(mud);
    // Rocks, a tyre and chain loops on the mud.
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4740, roughness: .7 });
    for (let k = 0; k < 70; k++) {
      const x = (r() < .5 ? -1 : 1) * (hw - 1 - r() * 8), z = o.headZ - 2 - r() * (o.headZ - o.mouthZ - 6), s = .25 + r() * .6;
      add('rock', rockMat, new THREE.IcosahedronGeometry(s, 0), new THREE.Matrix4().compose(new THREE.Vector3(x, this.floorAt(x, z) + s * .2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(1, .6, 1.2)));
    }
    add('iron', iron, new THREE.TorusGeometry(.45, .16, 8, 18).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(-24, this.floorAt(-24, o.headZ - 18) + .12, o.headZ - 18));

    // ---- merge statics by material
    for (const k of Object.keys(statics)) {
      const geo = mergeGeometries(statics[k].geos.map((g) => g.index ? g : g), false);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, statics[k].mat); mesh.castShadow = k !== 'wall' && k !== 'paving'; mesh.receiveShadow = true; this.group.add(mesh);
    }

    // ---- boats
    for (const spec of o.boats) {
      const g = new THREE.Group(), tilt = new THREE.Group(); g.add(tilt); this.group.add(g);
      const L = spec.length ?? (spec.kind === 'yacht' ? 10 : 8.5);
      let draft: number, yacht: Sailboat | undefined;
      if (spec.kind === 'yacht') {
        yacht = new Sailboat({ length: L, sails: false, hullColor: spec.color ?? 0xf2efe8, seed: spec.seed ?? 3 });
        tilt.add(yacht.group); draft = L * .075;
      } else {
        const fb = fishingBoat(L, spec.color ?? 0x2f5d8a, spec.seed ?? 5); tilt.add(fb.g); draft = fb.draft;
      }
      g.traverse((m) => { if (m instanceof THREE.Mesh) { m.castShadow = true; m.receiveShadow = true; } });
      this.boats.push({ spec, g, tilt, yacht, draft, floor: this.floorAt(spec.x, spec.z) });
    }
    this.update(0, o.meanSea);
  }

  bollards: THREE.Vector3[];

  /** Mud floor height under (x, z): shallow along the walls, a central channel deepening toward the mouth. */
  floorAt(x: number, z: number): number {
    const o = this.o, hw = o.halfWidth;
    const u = clamp((o.headZ - z) / (o.headZ - o.mouthZ)), side = Math.abs(x) / hw;
    // The channel shoals onto a mud bank in the last few tens of metres before the landward quay.
    const channel = (1 - smoothstep(.0, .55, side)) * smoothstep(.04, .22, u);
    let y = o.floorWall + (o.floorChannel - o.floorWall) * channel - 0.7 * u * channel;
    y += (fbm2(x * .045, z * .045, o.seed, 4) - .5) * .9 + (fbm2(x * .3, z * .3, o.seed + 3, 3) - .5) * .12;
    y += 0.35 * smoothstep(.82, 1, side); // mud banks up against the walls
    return y;
  }

  /** Boat state for a sea level: afloat (bobbing) or grounded and heeled on the mud. Returns 0 (grounded) .. 1 (afloat). */
  boatState(b: BoatRig, time_s: number, seaLevel: number) {
    const keel = b.floor + b.draft;
    const float = smoothstep(keel - .05, keel + .35, seaLevel);
    const sp = b.spec, bob = Math.sin(time_s * 1.3 + sp.x) * .05 * float;
    const y = Math.max(seaLevel, keel) - (1 - float) * .12 + bob;
    return { float, y, heel: (sp.groundHeel ?? .3) * (1 - float) + Math.sin(time_s * .9 + sp.z) * .02 * float };
  }

  /** Lamp brightness per fixture (0..1). */
  setLamps(level: (i: number) => number) {
    this.lampHeads.forEach((m, i) => { m.emissiveIntensity = 5 * level(i); });
    this.lampLights.forEach((l, i) => { l.intensity = 40 * level(i); });
  }

  update(time_s: number, seaLevel: number, beamAngle = time_s * .8) {
    for (const b of this.boats) {
      const s = this.boatState(b, time_s, seaLevel);
      b.g.position.set(b.spec.x, s.y, b.spec.z);
      b.g.rotation.set(0, b.spec.heading, 0);
      b.tilt.rotation.set(s.heel, 0, Math.sin(time_s * .7 + b.spec.x) * .015 * s.float);
    }
    if (this.beam) this.beam.rotation.set(0, beamAngle, 0);
  }
  set beamStrength(v: number) { if (this.beam) ((this.beam.material as THREE.ShaderMaterial).uniforms.uK.value = v); }
}
