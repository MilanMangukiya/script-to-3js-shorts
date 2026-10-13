import * as THREE from 'three';

export interface SolarPanelArrayOptions {
  /** Number of rows (along Z) and panels per row (along X). */
  rows?: number; cols?: number;
  /** Panel size [width along the row, slope length] in metres, tilt in degrees (faces +Z), row pitch in metres. */
  panelSize?: [number, number]; tilt?: number; rowSpacing?: number; gap?: number;
  /** Height of the panel's lower edge above the ground, metres. */
  clearance?: number;
  cellColor?: string; frameColor?: THREE.ColorRepresentation;
  /** 0 = dry, dusty glass; 1 = rain-soaked glossy glass. */
  wetness?: number;
}

/**
 * Ground-mounted photovoltaic array: rows of tilted panels with a canvas-drawn cell grid (silver busbars on dark
 * blue cells), glass with clearcoat, aluminium frames and steel posts. The group's origin is the centre of the
 * array on the ground; panels face +Z. `wetness` makes the glass glossier, mirroring the sky.
 */
export class SolarPanelArray {
  readonly group = new THREE.Group();
  private glass: THREE.MeshPhysicalMaterial;

  constructor(o: SolarPanelArrayOptions = {}) {
    const rows = o.rows ?? 3, cols = o.cols ?? 8, [pw, pl] = o.panelSize ?? [1.0, 1.7], tilt = THREE.MathUtils.degToRad(o.tilt ?? 30);
    const pitch = o.rowSpacing ?? 4.2, gap = o.gap ?? 0.03, clear = o.clearance ?? 0.6;
    // Cell grid texture: 6 x 10 cells per panel.
    const W = 384, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
    g.fillStyle = '#c9ced6'; g.fillRect(0, 0, W, H);
    const cw = W / 6, ch = H / 10;
    for (let j = 0; j < 10; j++) for (let i = 0; i < 6; i++) {
      const x = i * cw + 3, y = j * ch + 3, grad = g.createLinearGradient(x, y, x + cw, y + ch);
      grad.addColorStop(0, o.cellColor ?? '#1b2a4a'); grad.addColorStop(1, '#14203a');
      g.fillStyle = grad; g.fillRect(x, y, cw - 6, ch - 6);
      g.fillStyle = 'rgba(190,200,215,0.55)';
      for (let k = 1; k <= 2; k++) g.fillRect(x + (k * (cw - 6)) / 3 - 1, y, 2, ch - 6);   // busbars
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    this.glass = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.25, envMapIntensity: 1 });
    this.wetness = o.wetness ?? 0;
    const frame = new THREE.MeshStandardMaterial({ color: o.frameColor ?? 0xb9bfc6, roughness: 0.35, metalness: 0.9 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.8 });
    const panelGeo = new THREE.BoxGeometry(pw - gap, 0.035, pl - gap);
    // Box UVs on the top face span the whole texture; other faces show the frame colour from the edges of the map.
    const frameGeo = new THREE.BoxGeometry(pw - gap + 0.02, 0.045, 0.03);
    const sideGeo = new THREE.BoxGeometry(0.03, 0.045, pl - gap + 0.02);
    const width = cols * pw, rise = Math.sin(tilt) * pl;
    for (let r = 0; r < rows; r++) {
      const row = new THREE.Group();
      row.position.set(0, clear + rise / 2, (r - (rows - 1) / 2) * pitch);
      row.rotation.x = tilt;   // lower edge toward +Z, panel normal tilted up toward +Z
      for (let i = 0; i < cols; i++) {
        const x = (i - (cols - 1) / 2) * pw;
        const p = new THREE.Mesh(panelGeo, this.glass); p.position.x = x; p.castShadow = true; p.receiveShadow = true; row.add(p);
        for (const s of [-1, 1]) {
          const f = new THREE.Mesh(frameGeo, frame); f.position.set(x, 0, s * (pl - gap) / 2); row.add(f);
          const e = new THREE.Mesh(sideGeo, frame); e.position.set(x + s * (pw - gap) / 2, 0, 0); row.add(e);
        }
      }
      // Rails under the panels.
      for (const s of [-0.3, 0.3]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.05), steel); rail.position.set(0, -0.05, s * pl); row.add(rail); }
      this.group.add(row);
      // Posts: short at the front (+Z, lower edge), tall at the back.
      const zc = row.position.z, front = zc + Math.cos(tilt) * pl * 0.3, back = zc - Math.cos(tilt) * pl * 0.3;
      for (let i = 0; i <= cols; i += 2) {
        const x = (i - cols / 2) * pw;
        for (const [z, h] of [[front, clear + rise / 2 - Math.sin(tilt) * pl * 0.3], [back, clear + rise / 2 + Math.sin(tilt) * pl * 0.3]] as const) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), steel); post.position.set(x, h / 2 - 0.05, z); post.castShadow = true; this.group.add(post);
        }
      }
    }
  }

  /** 0..1: rain-soaked glass is glossier and mirrors the sky more strongly. */
  set wetness(v: number) {
    this.glass.roughness = 0.35 - 0.27 * v; this.glass.clearcoatRoughness = 0.25 - 0.22 * v; this.glass.envMapIntensity = 1 + 0.6 * v;
  }
}
