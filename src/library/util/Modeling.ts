import * as THREE from 'three';

/** Small original geometry helpers shared by procedural architecture and machinery. Metres, Y up. */
export const surface = (color: THREE.ColorRepresentation, roughness = .65, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const glow = (color: THREE.ColorRepresentation, strength = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: .45 });
export function solid(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export const box = (p: THREE.Object3D, size: [number, number, number], mat: THREE.Material, at: [number, number, number] = [0, 0, 0]) => solid(p, new THREE.BoxGeometry(...size), mat, at);
export function rod(p: THREE.Object3D, a: THREE.Vector3 | number[], b: THREE.Vector3 | number[], radius: number, mat: THREE.Material, sides = 8) {
  const x = a instanceof THREE.Vector3 ? a : new THREE.Vector3(...a as [number,number,number]);
  const y = b instanceof THREE.Vector3 ? b : new THREE.Vector3(...b as [number,number,number]);
  const d = y.clone().sub(x), m = solid(p, new THREE.CylinderGeometry(radius, radius, d.length(), sides), mat);
  m.position.copy(x).add(y).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize()); return m;
}
export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Screen points along +Z. Content is procedural, generic and unbranded. */
export function screen(parent: THREE.Object3D, width: number, height: number, texture: THREE.Texture, at: [number,number,number]) {
  box(parent, [width+.08,height+.08,.075], surface(0x101a20,.4), at);
  const m = solid(parent, new THREE.PlaneGeometry(width,height), new THREE.MeshBasicMaterial({map:texture,toneMapped:false}),[at[0],at[1],at[2]+.041]); return m;
}
