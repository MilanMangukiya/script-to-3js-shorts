import * as THREE from 'three';
import type { Humanoid } from './Humanoid';

export interface ScubaGearOptions {
  tankColor?: THREE.ColorRepresentation; jacketColor?: THREE.ColorRepresentation; finColor?: THREE.ColorRepresentation;
  hoseColor?: THREE.ColorRepresentation; maskColor?: THREE.ColorRepresentation;
}

/**
 * Scuba kit for humanoid-figure-v1: aluminium tank with valve on the back, buoyancy jacket with shoulder straps,
 * weight belt, mask with glass, regulator with a hose to the tank valve, and fins that continue the line of the shin
 * (a pointed-toe kick; the figure's shoes are hidden). All parts attach to the figure's anchors, so they follow any pose.
 * `regulatorWorld()` returns the mouthpiece position for bubble emitters.
 */
export class ScubaGear {
  private reg = new THREE.Object3D();

  constructor(fig: Humanoid, o: ScubaGearOptions = {}) {
    const std = (c: THREE.ColorRepresentation, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
    const tankMat = std(o.tankColor ?? 0xb8c0c7, 0.32, 0.85), jacket = std(o.jacketColor ?? 0x3a3f46, 0.8), black = std(0x111215, 0.55), hose = std(o.hoseColor ?? 0xf2c230, 0.5);
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

    // Tank: body, domed top, valve and first stage, on the back anchor (chest frame: +Y up the spine, -Z behind).
    const back = fig.backAnchor;
    const tank = new THREE.Group(); tank.position.set(0, -0.05, -0.05); back.add(tank);
    add(tank, new THREE.CylinderGeometry(0.088, 0.088, 0.5, 28), tankMat, 0, 0, 0);
    add(tank, new THREE.SphereGeometry(0.088, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), tankMat, 0, 0.25, 0);
    add(tank, new THREE.SphereGeometry(0.088, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), tankMat, 0, -0.25, 0);
    add(tank, new THREE.CylinderGeometry(0.018, 0.022, 0.06, 12), black, 0, 0.36, 0);
    add(tank, new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12).rotateZ(Math.PI / 2), tankMat, 0, 0.39, 0);
    add(tank, new THREE.TorusGeometry(0.09, 0.012, 8, 28).rotateX(Math.PI / 2), black, 0, 0.08, 0);   // cam band
    // Jacket: back plate and shoulder straps on the chest, belt on the waist.
    add(back, new THREE.BoxGeometry(0.3, 0.42, 0.05), jacket, 0, -0.05, 0.015);
    for (const sx of [1, -1]) {
      const strap = add(fig.chestAnchor.parent!, new THREE.TorusGeometry(0.12, 0.022, 8, 20, Math.PI), jacket, sx * 0.1, 0.42, 0);
      strap.rotation.set(0, Math.PI / 2, Math.PI / 2); strap.scale.set(1.05, 1, 1);
    }
    add(fig.chestAnchor.parent!, new THREE.CapsuleGeometry(0.168, 0.16, 6, 20), jacket, 0, 0.28, 0).scale.set(1.12, 1, 0.78);
    add(fig.waistAnchor, new THREE.TorusGeometry(0.17, 0.025, 8, 28).rotateX(Math.PI / 2), black, 0, 0.0, 0).scale.set(1.08, 1, 0.8);
    for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6; add(fig.waistAnchor, new THREE.BoxGeometry(0.05, 0.05, 0.03), std(0x4a4d52, 0.4, 0.6), Math.sin(a) * 0.19, 0, Math.cos(a) * 0.14); }

    // Mask and regulator on the head (head frame: face toward +Z, centre at y ≈ 0.115).
    const head = fig.headAnchor;
    add(head, new THREE.BoxGeometry(0.135, 0.07, 0.05), std(o.maskColor ?? 0x111215, 0.55), 0, 0.03, 0.085);
    const glass = add(head, new THREE.BoxGeometry(0.118, 0.054, 0.006), new THREE.MeshPhysicalMaterial({ color: 0x0c1418, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }), 0, 0.03, 0.111);
    glass.castShadow = false;
    add(head, new THREE.TorusGeometry(0.105, 0.008, 6, 32).rotateY(Math.PI / 2).rotateZ(Math.PI / 2), black, 0, 0.035, -0.005).scale.set(0.95, 1, 1.05);
    add(head, new THREE.CylinderGeometry(0.022, 0.026, 0.035, 14).rotateX(Math.PI / 2), black, 0, -0.045, 0.105);
    add(head, new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10).rotateX(Math.PI / 2), hose, 0.03, -0.05, 0.1);
    this.reg.position.set(0, -0.06, 0.13); head.add(this.reg);
    // Hose from the regulator over the right shoulder to the tank valve (chest frame, approximate for small head turns).
    const chest = fig.chestAnchor.parent!;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.04, 0.66, 0.11), new THREE.Vector3(-0.14, 0.62, 0.06), new THREE.Vector3(-0.17, 0.66, -0.08), new THREE.Vector3(-0.06, 0.66, -0.17)]);
    add(chest, new THREE.TubeGeometry(curve, 24, 0.008, 8, false), hose);

    // Fins: blade continuing the shin line beyond the shoe (knee frame: shin along -Y, toes toward +Z).
    const finMat = new THREE.MeshStandardMaterial({ color: o.finColor ?? 0x15171b, roughness: 0.5, side: THREE.DoubleSide });
    const blade = new THREE.Shape(); blade.moveTo(-0.05, 0); blade.lineTo(0.05, 0); blade.lineTo(0.11, -0.5); blade.quadraticCurveTo(0, -0.46, -0.11, -0.5); blade.closePath();
    const finGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.008, bevelEnabled: false }).translate(0, 0, -0.004);
    for (const foot of [fig.footL, fig.footR]) {
      // Fin foot pockets replace the shoes; with a pointed foot the blade continues the shin line.
      for (const ch of foot.parent!.children) if (ch instanceof THREE.Mesh && ch.geometry instanceof THREE.BoxGeometry) ch.visible = false;
      add(foot, new THREE.BoxGeometry(0.1, 0.2, 0.075), black, 0, -0.04, -0.035);
      const f = new THREE.Mesh(finGeo, finMat); f.position.set(0, -0.11, -0.035); f.rotation.x = -0.18; f.castShadow = true; foot.add(f);
    }
  }

  /** World position of the regulator exhaust (where exhaled bubbles leave). */
  regulatorWorld(out = new THREE.Vector3()): THREE.Vector3 { return this.reg.getWorldPosition(out); }
}
