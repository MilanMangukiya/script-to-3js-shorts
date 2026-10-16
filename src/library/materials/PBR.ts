import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Photo-scanned CC0 materials (Poly Haven, see assets/library/polyhaven.manifest.json) as MeshStandardMaterials:
 * diffuse colour, OpenGL normal map and the packed AO/roughness/metal ("arm") map. Textures load once per set and
 * are shared; every material gets its own repeat. Pair with `projectUVs` so texel density stays constant in metres.
 */
export const PBR_SETS: Record<string, { res: string; tile: number }> = {
  // id → library resolution and the real-world size (metres) one texture repeat covers.
  red_brick_03: { res: '2k', tile: 2.0 }, brick_wall_001: { res: '1k', tile: 2.0 }, beige_wall_001: { res: '1k', tile: 2.5 },
  white_plaster_02: { res: '1k', tile: 2.5 }, concrete_wall_008: { res: '1k', tile: 3.0 }, large_sandstone_blocks: { res: '1k', tile: 2.5 },
  blue_painted_planks: { res: '1k', tile: 2.0 }, clay_roof_tiles_02: { res: '1k', tile: 2.0 }, grey_roof_tiles: { res: '1k', tile: 2.0 },
  rectangular_facade_tiles: { res: '1k', tile: 2.0 }, asphalt_02: { res: '1k', tile: 4.0 }, cobblestone_floor_04: { res: '1k', tile: 2.0 },
  concrete_tiles_02: { res: '1k', tile: 2.0 }, coast_sand_01: { res: '2k', tile: 3.0 }, aerial_grass_rock: { res: '1k', tile: 4.0 },
  rock_face: { res: '1k', tile: 3.0 }, gravel_floor_02: { res: '1k', tile: 1.5 }, laminate_floor_02: { res: '1k', tile: 2.0 },
  plastered_wall_04: { res: '1k', tile: 2.0 }, cotton_jersey: { res: '1k', tile: 0.4 }, denim_fabric: { res: '1k', tile: 0.4 },
  velour_velvet: { res: '1k', tile: 0.6 }, brown_leather: { res: '1k', tile: 0.5 }, wood_table_001: { res: '1k', tile: 1.0 },
  bark_willow_02: { res: '1k', tile: 1.5 },
};
export const HDRIS = ['kloofendal_48d_partly_cloudy_puresky', 'belfast_sunset_puresky', 'qwantani_dusk_2_puresky', 'kloppenheim_02_puresky', 'cobblestone_street_night'] as const;
export type HdriId = (typeof HDRIS)[number];

interface Maps { map: THREE.Texture; normalMap: THREE.Texture; arm: THREE.Texture }
export interface PBROptions {
  /** Metres covered by one repeat (defaults to the set's natural tile size); scale with `projectUVs` geometry. */
  tile?: number;
  /** Colour multiplier, roughness multiplier/offset, normal strength, AO strength, metalness. */
  tint?: THREE.ColorRepresentation; roughness?: number; normalScale?: number; aoIntensity?: number; metalness?: number;
  /** Optional emissive colour/intensity (e.g. a lit sign). */
  emissive?: THREE.ColorRepresentation; emissiveIntensity?: number;
  side?: THREE.Side;
}

/** Library of loaded sets. Call `await PBRLibrary.load(base, ids)` once per film, then `material(id, opts)` freely. */
export class PBRLibrary {
  private sets = new Map<string, Maps>();
  constructor(private maxAnisotropy = 16) {}

  async load(base: string, ids: string[]) {
    const loader = new THREE.TextureLoader();
    await Promise.all(ids.filter((id) => !this.sets.has(id)).map(async (id) => {
      const res = PBR_SETS[id]?.res ?? '1k', dir = `${base}assets/library/textures/pbr/${id}/${id}_`;
      const [map, normalMap, arm] = await Promise.all(['diff', 'nor_gl', 'arm'].map((m) => loader.loadAsync(`${dir}${m}_${res}.jpg`)));
      map.colorSpace = THREE.SRGBColorSpace; normalMap.colorSpace = arm.colorSpace = THREE.NoColorSpace;
      for (const t of [map, normalMap, arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = this.maxAnisotropy; }
      this.sets.set(id, { map, normalMap, arm });
    }));
    return this;
  }

  /** A new material on a loaded set; texture repeat = 1 / tile (geometry UVs are expected in metres, see projectUVs). */
  material(id: string, o: PBROptions = {}): THREE.MeshStandardMaterial {
    const s = this.sets.get(id);
    if (!s) throw new Error(`PBR set not loaded: ${id}`);
    const rep = 1 / (o.tile ?? PBR_SETS[id]?.tile ?? 2);
    const tex = (t: THREE.Texture) => { const c = t.clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c; };
    const arm = tex(s.arm);
    const m = new THREE.MeshStandardMaterial({
      map: tex(s.map), normalMap: tex(s.normalMap), aoMap: arm, roughnessMap: arm, metalnessMap: arm,
      // metalness 1 lets the arm map's blue channel decide (0 for these sets); roughness multiplies its green channel.
      color: new THREE.Color(o.tint ?? 0xffffff), roughness: o.roughness ?? 1, metalness: o.metalness ?? 1, aoMapIntensity: o.aoIntensity ?? 1,
      normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1), side: o.side ?? THREE.FrontSide,
    });
    if (o.emissive !== undefined) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    return m;
  }
}

/**
 * Rewrite a geometry's UVs as box-projected metres (world-consistent texel density): each vertex is projected on the
 * plane facing its dominant normal axis. `scale` divides metres (1 = one UV unit per metre).
 */
export function projectUVs(geo: THREE.BufferGeometry, scale = 1, offset: [number, number] = [0, 0]) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z * Math.sign(nrm.getX(i) || 1); v = y; } else { u = x * Math.sign(-nrm.getZ(i) || 1) * -1; v = y; }
    uv[i * 2] = u / scale + offset[0]; uv[i * 2 + 1] = v / scale + offset[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Image-based lighting from a library HDRI (prefiltered for PBR), or a neutral studio room for interiors. */
export async function loadEnvironment(renderer: THREE.WebGLRenderer, base: string, id: HdriId | 'room'): Promise<THREE.Texture> {
  const pm = new THREE.PMREMGenerator(renderer);
  let tex: THREE.Texture;
  if (id === 'room') tex = pm.fromScene(new RoomEnvironment(), 0.03).texture;
  else {
    const hdr = await new HDRLoader().loadAsync(`${base}assets/library/hdri/${id}_1k.hdr`);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    tex = pm.fromEquirectangular(hdr).texture; hdr.dispose();
  }
  pm.dispose();
  return tex;
}
