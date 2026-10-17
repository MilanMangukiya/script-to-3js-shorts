import * as THREE from 'three';
import { Humanoid, POSE_STAND } from '../../library/characters/Humanoid';
import { actionProgress, applyGroundedPose, soleHeight } from '../../library/characters/CharacterMotion';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const PALM_HALF_THICKNESS = .014;
// Humanoid bakes these radii into the existing hand geometry.
const ORIGINAL_HAND_RADII = V(.043 * .85, .043 * 1.15, .043 * .6);

/** One planted clap, evaluated entirely from absolute film time.
 * Faces +Z. Parent must be unrotated and unscaled, as required by CharacterMotion.
 * The actor's existing hand meshes are shaped into mittens; no replacement rig.
 */
export class ClapActor {
  readonly person: Humanoid;
  readonly root: THREE.Group;
  /** Inner palm surfaces in world coordinates, recomputed after each update. */
  readonly palmL = V(0, 0, 0);
  readonly palmR = V(0, 0, 0);
  readonly handTargetL = V(0, 0, 0);
  readonly handTargetR = V(0, 0, 0);
  /** Separation of the actual palm surfaces; zero at the clap contact. */
  contactError = Infinity;
  /** Actual hand-anchor residuals, separate from the palm separation. */
  handErrorL = Infinity;
  handErrorR = Infinity;
  soleL = Infinity;
  soleR = Infinity;
  private readonly hands: [THREE.Mesh, THREE.Mesh];
  private readonly origin: THREE.Vector3;
  private readonly figureScale: number;

  constructor(
    parent: THREE.Object3D,
    at: [number, number, number] = [0, 0, 0],
    coatColor: THREE.ColorRepresentation = 0xe4b54e,
    skinColor: THREE.ColorRepresentation = 0xc99a78,
    readonly hero = false,
    readonly identity = 0,
    height = 1.72,
  ) {
    if (![...at, identity, height].every(Number.isFinite) || height <= 0) {
      throw new Error('ClapActor: finite origin, identity and positive height required');
    }
    this.origin = V(...at);
    this.figureScale = height / 1.72;
    const hair = [0x241a14, 0x332b2a, 0x604233, 0x96908a][Math.abs(Math.trunc(identity)) % 4];
    this.person = new Humanoid({
      height, coat: 'jacket', coatColor, skinColor, hairColor: hair,
      trouserColor: identity % 2 === 0 ? 0x253e51 : 0x3c4149,
      scarfColor: null,
    });
    this.root = this.person.root;
    this.root.position.copy(this.origin);
    parent.add(this.root);
    this.hands = [this.handMesh(this.person.handL), this.handMesh(this.person.handR)];
    for (const hand of this.hands) {
      // Broad palm in the YZ plane, narrow in X; opposing inner surfaces can meet.
      hand.scale.set(PALM_HALF_THICKNESS / ORIGINAL_HAND_RADII.x,
        .066 / ORIGINAL_HAND_RADII.y, .034 / ORIGINAL_HAND_RADII.z);
    }
    // The registered rig has no facial expression controls. Two tiny eye marks
    // make a frontal head turn legible without pretending to supply a face rig.
    const eyes = new THREE.MeshStandardMaterial({ color: 0x202731, roughness: .85 });
    const eyeGeometry = new THREE.SphereGeometry(.006, 8, 6);
    for (const x of [-.033, .033]) {
      const eye = new THREE.Mesh(eyeGeometry, eyes);
      eye.position.set(x, .135, .104);
      this.person.head.add(eye);
    }
    this.update(0);
  }

  private handMesh(anchor: THREE.Object3D): THREE.Mesh {
    const hand = anchor.parent!.children.find(child => child instanceof THREE.Mesh
      && child.geometry instanceof THREE.SphereGeometry
      && child.position.distanceTo(anchor.position) < 1e-8) as THREE.Mesh | undefined;
    if (!hand) throw new Error('ClapActor: registered Humanoid hand geometry required');
    return hand;
  }

  update(t: number, contactTime = .9): void {
    if (!Number.isFinite(t) || !Number.isFinite(contactTime)) throw new Error('ClapActor: finite action times required');
    const preparation = actionProgress(t, contactTime - .85, contactTime - .30);
    const close = actionProgress(t, contactTime - .30, contactTime);
    const release = actionProgress(t, contactTime + .035, contactTime + .24);
    const lower = actionProgress(t, contactTime + .24, contactTime + 1.0);
    const turn = actionProgress(t, contactTime + 1.15, contactTime + 1.8)
      * (1 - actionProgress(t, contactTime + 2.35, contactTime + 3.0));
    const side = Math.abs(Math.trunc(this.identity)) % 2 === 0 ? 1 : -1;
    // Full reset is deliberate: seeking from a later frame cannot retain a pose.
    this.root.position.copy(this.origin);
    this.root.rotation.set(0, 0, 0);
    applyGroundedPose(this.person, {
      ...POSE_STAND, lean: .02 + .035 * preparation * (1 - lower),
      headPitch: -.025 * preparation * (1 - lower), headYaw: side * .24 * turn,
      armL: [.04, .07, .12], armR: [.04, .07, .12],
      legL: [0, 0], legR: [0, 0], breath: 0,
    }, this.origin.y);

    // Local reference targets: rest -> open anticipation -> contact -> release
    // -> lowered hands. Keep the reach inside both two-bone IK envelopes.
    const rest = V(.285, .95, .10);
    const open = V(.43, 1.25, .26);
    const touching = V(PALM_HALF_THICKNESS, 1.23, .40);
    const separated = V(.215, 1.22, .34);
    const left = rest.clone().lerp(open, preparation).lerp(touching, close)
      .lerp(separated, release).lerp(rest, lower);
    const right = left.clone(); right.x *= -1;
    const asWorld = (p: THREE.Vector3) => p.multiplyScalar(this.figureScale).add(this.root.position);
    this.handTargetL.copy(asWorld(left));
    this.handTargetR.copy(asWorld(right));
    this.person.reachArm('L', this.handTargetL, V(1, -.5, .12), 1);
    this.person.reachArm('R', this.handTargetR, V(-1, -.5, .12), 1);

    // IK turns the forearms; orient each existing palm in a common world frame
    // so touching hand anchors also mean touching physical palm surfaces.
    for (const hand of this.hands) {
      const parentWorld = hand.parent!.getWorldQuaternion(new THREE.Quaternion());
      hand.quaternion.copy(parentWorld.invert());
    }
    this.root.updateMatrixWorld(true);
    this.palmL.copy(this.hands[0].localToWorld(V(-ORIGINAL_HAND_RADII.x, 0, 0)));
    this.palmR.copy(this.hands[1].localToWorld(V(ORIGINAL_HAND_RADII.x, 0, 0)));
    this.contactError = this.palmL.distanceTo(this.palmR);
    this.handErrorL = this.person.handL.getWorldPosition(V(0, 0, 0)).distanceTo(this.handTargetL);
    this.handErrorR = this.person.handR.getWorldPosition(V(0, 0, 0)).distanceTo(this.handTargetR);
    this.soleL = soleHeight(this.person, 'L');
    this.soleR = soleHeight(this.person, 'R');
  }
}
