import * as THREE from 'three';
import { projectUVs, type PBRLibrary } from '../materials/PBR';
import { LightBeam } from '../fx/LightBeam';

/**
 * Coastal lighthouse: tapered stone tower with painted bands, gallery with railing, glazed lantern room, keeper's
 * cottage, and at night a glowing lamp with a rotating twin beam (soft volumetric `LightBeam`s) that flares when a
 * beam sweeps across the camera. Metres; origin at the base. `night` (0..1) and `update(time_s, camera?)` (beam angle =
 * time × rpm; the camera drives the flare) are deterministic.
 */
export interface LighthouseOptions { height?: number; bandColor?: THREE.ColorRepresentation; rpm?: number; beamLength?: number; pbr?: PBRLibrary }

export class Lighthouse {
  readonly group = new THREE.Group();
  private beam = new THREE.Group(); private lamp: THREE.MeshStandardMaterial; private beams: LightBeam[] = []; private windowMat: THREE.MeshStandardMaterial;
  private flare: THREE.Sprite; private rpm: number; private nightLevel = 0; private lampPos = new THREE.Vector3(); private tmp = new THREE.Vector3();
  constructor(o: LighthouseOptions = {}) {
    const H = o.height ?? 16, R0 = 2.2, R1 = 1.35; this.rpm = o.rpm ?? 6;
    // Painted bands via a canvas map along the tower height.
    const c = document.createElement('canvas'); c.width = 8; c.height = 256; const g = c.getContext('2d')!;
    const band = `#${new THREE.Color(o.bandColor ?? 0xb3261e).getHexString()}`;
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? band : '#efebe2'; g.fillRect(0, i * 64, 8, 64); }
    const bands = new THREE.CanvasTexture(c); bands.colorSpace = THREE.SRGBColorSpace;
    const towerMat = new THREE.MeshStandardMaterial({ map: bands, roughness: 0.82 });
    if (o.pbr) { const stone = o.pbr.material('white_plaster_02'); towerMat.normalMap = stone.normalMap; towerMat.roughnessMap = stone.roughnessMap; }
    const pts: THREE.Vector2[] = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(R0 + (R1 - R0) * Math.pow(t, 0.9), t * H)); }
    const tower = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), towerMat); tower.castShadow = tower.receiveShadow = true; this.group.add(tower);
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d2226, roughness: 0.4, metalness: 0.7 });
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(R1 + 0.55, R1 + 0.4, 0.25, 40), dark); gallery.position.y = H + 0.12; this.group.add(gallery);
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), dark); post.position.set(Math.cos(a) * (R1 + 0.5), H + 0.7, Math.sin(a) * (R1 + 0.5)); this.group.add(post); }
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R1 + 0.5, 0.03, 6, 48).rotateX(Math.PI / 2), dark); rail.position.y = H + 1.15; this.group.add(rail);
    this.windowMat = new THREE.MeshStandardMaterial({ color: 0x2a3a40, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.75 });
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(R1 * 0.75, R1 * 0.75, 1.6, 16, 1, true), this.windowMat); lantern.position.y = H + 1.05; this.group.add(lantern);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(R1 * 0.95, 1.2, 24), dark); roof.position.y = H + 2.45; this.group.add(roof);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), dark); ball.position.y = H + 3.1; this.group.add(ball);
    this.lamp = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe1a8, emissiveIntensity: 0, roughness: 0.2 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), this.lamp); bulb.position.y = H + 1.05; this.group.add(bulb);
    // Twin beams: long soft cones pointing out horizontally (±X before rotation), turning about the tower axis.
    const L = o.beamLength ?? 160;
    for (const dir of [1, -1]) {
      const b = new LightBeam({ length: L, radius: L * 0.05, color: 0xffe6b8, intensity: 0.55, edge: 1.6, falloff: 1.5, nearFade: 32 });
      b.mesh.geometry.rotateZ(dir * Math.PI / 2); b.level = 0; this.beam.add(b.mesh); this.beams.push(b);
    }
    this.beam.position.y = H + 1.05; this.group.add(this.beam);
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture(), color: new THREE.Color(0xffe2b0).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.flare.position.y = H + 1.05; this.flare.scale.setScalar(5); this.group.add(this.flare);
    // Keeper's cottage at the foot.
    const cottage = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(5, 3, 4)), o.pbr ? o.pbr.material('white_plaster_02') : new THREE.MeshStandardMaterial({ color: 0xece6da }));
    cottage.position.set(R0 + 2.6, 1.5, 0.5); cottage.castShadow = cottage.receiveShadow = true; this.group.add(cottage);
    const cr = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.8, 4).rotateY(Math.PI / 4), o.pbr ? o.pbr.material('grey_roof_tiles') : dark); cr.scale.set(1, 1, 0.8); cr.position.set(R0 + 2.6, 3.9, 0.5); cr.castShadow = true; this.group.add(cr);
  }
  set night(v: number) { this.nightLevel = v; this.lamp.emissiveIntensity = 14 * v; this.windowMat.emissiveIntensity = 1.6 * v; for (const b of this.beams) b.level = v; this.beam.visible = v > 0.01; }
  update(time_s: number, camera?: THREE.Camera) {
    const a = (time_s * this.rpm / 60) * Math.PI * 2; this.beam.rotation.y = a;
    // Flare: the lamp blazes for a moment as either beam points at the camera, and glows softly otherwise.
    let k = 0.18;
    if (camera) {
      this.group.updateWorldMatrix(true, false); this.lampPos.set(0, this.flare.position.y, 0).applyMatrix4(this.group.matrixWorld);
      const to = this.tmp.copy(camera.position).sub(this.lampPos); to.y = 0; to.normalize();
      const groupYaw = Math.atan2(this.group.matrixWorld.elements[8], this.group.matrixWorld.elements[10]);
      const c = Math.cos(a + groupYaw) * to.x - Math.sin(a + groupYaw) * to.z;   // beam axis (cos, 0, −sin) · direction to camera
      k += 2.6 * Math.pow(Math.abs(c), 48);
    }
    (this.flare.material as THREE.SpriteMaterial).opacity = Math.min(1, k) * this.nightLevel; this.flare.scale.setScalar(4 + 6 * Math.min(1, k - 0.18));
    this.flare.visible = this.nightLevel > 0.01;
  }
}
let _flare: THREE.Texture | undefined;
function flareTexture() {
  if (_flare) return _flare;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (_flare = new THREE.CanvasTexture(c));
}
