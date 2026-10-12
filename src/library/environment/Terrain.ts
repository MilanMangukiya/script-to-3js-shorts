import * as THREE from 'three';
import { clamp, fbm2, ridged2, smoothstep, lerp } from '../util/math';

export interface TerrainOptions {
  seed?: number;
  /** Footprint in metres (x, z) and grid resolution. */
  width?: number; depth?: number; segmentsX?: number; segmentsZ?: number;
  /** Summit height above the base level, metres. */
  peakHeight?: number;
  /** Altitude above base where snow begins and where forest gives way to rock. */
  snowLine?: number; treeLine?: number;
  /** Colour of the emissive altitude contour. */
  contourColor?: THREE.ColorRepresentation;
}

/**
 * Seeded fractal massif (ridged multifractal over a broad dome that falls to sea level at its edges) with
 * altitude/slope vertex colouring. `contourAltitude` draws a glowing iso-altitude line measured in real scene metres
 * above the mesh's base (mesh.position.y), for honest "this is how high" schematics.
 */
export class Terrain {
  readonly mesh: THREE.Mesh;
  private shader: { uniforms: Record<string, THREE.IUniform> } | null = null;
  private contour = { y: -1e6, strength: 0, width: 18 };
  readonly peak: THREE.Vector3;

  constructor(o: TerrainOptions = {}) {
    const W = o.width ?? 9000, D = o.depth ?? 7000, sx = o.segmentsX ?? 300, sz = o.segmentsZ ?? 230;
    const seed = o.seed ?? 11, H = o.peakHeight ?? 2600, snow = o.snowLine ?? 2050, tree = o.treeLine ?? 1250;
    const geo = new THREE.PlaneGeometry(W, D, sx, sz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    let peakH = -1, peak = new THREE.Vector3();
    const heightAt = (x: number, z: number) => {
      const u = x / (W * 0.5), v = z / (D * 0.5);
      const r = Math.sqrt(u * u * 0.85 + v * v * 1.15);
      const dome = Math.pow(clamp(1 - r), 1.35);
      const rid = ridged2(x / 2100 + 5.2, z / 2100 + 1.7, seed, 6);
      const detail = fbm2(x / 380, z / 380, seed + 9, 4);
      let h = dome * (0.34 + 0.66 * rid) * H * 1.18 + (detail - 0.5) * 180 * dome;
      h += (fbm2(x / 1300, z / 1300, seed + 3, 3) - 0.5) * 420 * smoothstep(0, 0.5, dome);
      return h - 14; // shoreline dips just below base level
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, Math.max(h, -30));
      if (h > peakH) { peakH = h; peak.set(x, h, z); }
    }
    // Normalise so the summit is exactly peakHeight.
    const k = H / peakH;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) > 0 ? pos.getY(i) * k : pos.getY(i));
    peak.y = H;
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    const c = new THREE.Color(), forest = new THREE.Color(0x24331f), meadow = new THREE.Color(0x4a5230), rock = new THREE.Color(0x5d5852), rock2 = new THREE.Color(0x3f3c3a), snowC = new THREE.Color(0xe9eef5), shore = new THREE.Color(0x6e6452);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), x = pos.getX(i), z = pos.getZ(i), slope = 1 - nrm.getY(i);
      const n = fbm2(x / 260, z / 260, seed + 21, 3);
      const tl = tree + (n - 0.5) * 420, sl = snow + (n - 0.5) * 300;
      c.copy(forest).lerp(meadow, smoothstep(tl - 500, tl, y) * 0.9);
      c.lerp(rock, smoothstep(tl - 120, tl + 220, y));
      c.lerp(rock2, clamp(slope * 2.2 - 0.25) * smoothstep(300, 900, y));
      c.lerp(snowC, smoothstep(sl - 90, sl + 160, y) * clamp(1.25 - slope * 2.4));
      c.lerp(shore, 1 - smoothstep(0, 35, y));
      const shade = lerp(0.82, 1.1, n);
      colors[i * 3] = c.r * shade; colors[i * 3 + 1] = c.g * shade; colors[i * 3 + 2] = c.b * shade;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    const contourColor = new THREE.Color(o.contourColor ?? 0xffb45c);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uContourY = { value: this.contour.y }; shader.uniforms.uContourStrength = { value: this.contour.strength };
      shader.uniforms.uContourWidth = { value: this.contour.width }; shader.uniforms.uContourColor = { value: contourColor };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTerrainW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTerrainW; uniform float uContourY, uContourStrength, uContourWidth; uniform vec3 uContourColor;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float cw = uContourWidth * (1.0 + fwidth(vTerrainW.y) * 0.6);
          float band = smoothstep(cw, cw*0.25, abs(vTerrainW.y - uContourY));
          float below = smoothstep(uContourY, uContourY - 900.0, vTerrainW.y) ;
          totalEmissiveRadiance += uContourColor * (band * 2.6 + (1.0 - below) * step(vTerrainW.y, uContourY) * 0.0) * uContourStrength;`);
      this.shader = shader;
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = false;
    this.peak = peak;
  }

  /** @param altitude metres above the mesh base; @param strength 0..1 glow; @param width half-thickness in metres. */
  setContour(altitude: number, strength: number, width = 18) {
    this.contour.y = this.mesh.position.y + altitude; this.contour.strength = strength; this.contour.width = width;
    if (this.shader) {
      this.shader.uniforms.uContourY.value = this.contour.y; this.shader.uniforms.uContourStrength.value = strength; this.shader.uniforms.uContourWidth.value = width;
    }
  }
}
