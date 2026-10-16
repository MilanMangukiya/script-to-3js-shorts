import * as THREE from 'three';
import { surface, box, canvasTexture } from '../../../library/util/Modeling';

/** A stylised (not reproduced) US $100 note face with a mustard $10,000 strap, as on a bank bundle of 100 notes. */
function bundleFace() {
  return canvasTexture(256, 112, (g) => {
    const grd = g.createLinearGradient(0, 0, 256, 112); grd.addColorStop(0, '#c9d2bf'); grd.addColorStop(0.5, '#dfe3cf'); grd.addColorStop(1, '#bcc7b4');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 112);
    g.strokeStyle = 'rgba(70,90,70,0.55)'; g.lineWidth = 3; g.strokeRect(6, 6, 244, 100);
    g.fillStyle = 'rgba(80,100,80,0.35)'; g.beginPath(); g.ellipse(150, 56, 34, 40, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(60,80,60,0.85)'; g.font = 'bold 26px Inter, sans-serif'; g.fillText('100', 14, 38); g.fillText('100', 196, 100);
    // The strap across the middle.
    g.fillStyle = '#c9a227'; g.fillRect(96, 0, 34, 112); g.fillStyle = 'rgba(60,40,0,0.8)'; g.font = 'bold 13px Inter, sans-serif';
    g.save(); g.translate(118, 98); g.rotate(-Math.PI / 2); g.fillText('$10,000', 0, 0); g.restore();
  });
}
const paperEdge = () => canvasTexture(64, 16, (g) => { g.fillStyle = '#e4e6da'; g.fillRect(0, 0, 64, 16); for (let y = 0; y < 16; y += 2) { g.fillStyle = `rgba(110,120,100,${0.15 + 0.1 * Math.sin(y)})`; g.fillRect(0, y, 64, 1); } });

/**
 * A briefcase holding $1,000,000 in $100 bills: 100 bundles of 100 notes (each note ~1 g, so about 10 kg), lying flat
 * in a 46 × 34 × 11 cm case. Origin at the centre of the base; the lid hinges at the back (−Z) edge.
 */
export class Briefcase {
  readonly root = new THREE.Group();
  private lid = new THREE.Group();
  constructor() {
    const shell = new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.55, roughness: 0.42 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, metalness: 0.95, roughness: 0.25 });
    const lining = surface(0x3a2b2b, 0.9);
    const w = 0.46, d = 0.34, h = 0.11, t = 0.012;
    // Base tray: bottom and four walls.
    box(this.root, [w, t, d], shell, [0, t / 2, 0]);
    for (const s of [-1, 1]) { box(this.root, [w, h, t], shell, [0, h / 2, s * (d / 2 - t / 2)]); box(this.root, [t, h, d], shell, [s * (w / 2 - t / 2), h / 2, 0]); }
    box(this.root, [w - 2 * t, 0.004, d - 2 * t], lining, [0, t + 0.002, 0]);
    // Cash: 8 full layers of 6 × 2 bundles plus 4 on top = 100 bundles.
    const face = bundleFace(), edge = paperEdge();
    const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.85 }), edgeMat = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.9 });
    const bundle = new THREE.BoxGeometry(0.066, 0.011, 0.156);
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
    const mats = [edgeMat, edgeMat, faceMat, faceMat, edgeMat, edgeMat];
    let k = 0;
    for (let layer = 0; layer < 9 && k < 100; layer++) for (let row = 0; row < 2 && k < 100; row++) for (let col = 0; col < 6 && k < 100; col++, k++) {
      const m = new THREE.Mesh(bundle, mats); m.position.set(-0.165 + col * 0.066, t + 0.0055 + layer * 0.011, -0.079 + row * 0.158); m.castShadow = m.receiveShadow = true; this.root.add(m);
    }
    // Lid: a shallow tray hinged at the back edge.
    this.lid.position.set(0, h, -d / 2); this.root.add(this.lid);
    box(this.lid, [w, t, d], shell, [0, t / 2, d / 2]);
    for (const s of [-1, 1]) { box(this.lid, [w, 0.03, t], shell, [0, -0.012, d / 2 + s * (d / 2 - t / 2)]); box(this.lid, [t, 0.03, d], shell, [s * (w / 2 - t / 2), -0.012, d / 2]); }
    box(this.lid, [w - 2 * t, 0.004, d - 2 * t], lining, [0, -0.002, d / 2]);
    // Handle and latches on the front.
    box(this.root, [0.13, 0.02, 0.025], trim, [0, h * 0.6, d / 2 + 0.018]);
    for (const s of [-1, 1]) box(this.root, [0.035, 0.03, 0.01], trim, [s * 0.15, h - 0.01, d / 2 + 0.006]);
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  /** 0 = closed, 1 = open about 105 degrees. */
  setOpen(k: number) { this.lid.rotation.x = -1.83 * Math.max(0, Math.min(1, k)); }
}
