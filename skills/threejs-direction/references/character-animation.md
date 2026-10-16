# Character animation

## Analyze

Inspect the actual rig, root trajectory, attachments and visible shot, rather than assuming an asset's idle cycle supplies acting. Identify what the person wants, what catches their attention, and what their action changes. Check hand, foot, seat and prop contacts. In this repository Humanoid faces local +Z, supports complete `setPose` resets and world-space `reachArm`; its foot anchors are shoe centers, not soles. It has no expressive facial rig: direct attention with head, torso, silhouette and hands at an appropriate distance.

## Plan

Give a pivotal action absolute times for anticipation, action, response and settlement. A clinician can notice a line, reach it, check it and release; a seated person can notice a call, lift the handset, look down and hesitate. Prefer one readable action to several simultaneous gestures. Preserve the story's uncertainty: considering an incoming call must not accidentally depict answering it.

Separate planted acting from locomotion. Specify the supported foot/seat, target object, actual travel path and stop. Tie gait to distance traveled; time-driven leg cycling on a stationary root creates a treadmill. Keep established camera, lighting and narration fixed in an isolated character comparison.

## Work

- Reuse Humanoid poses, joint anchors and `reachArm` before adding rigs or geometry. Attach held objects to the appropriate hand; solve an interaction against the actual moving prop's world transform after posing.
- Keep planted feet fixed while the upper body acts. For visible walking, use a stance/swing pattern driven by absolute path distance, with stable stance contact, toe clearance and an intentional final placement. Stop gait when travel stops. Avoid abrupt heading changes, reversed travel with unchanged heading, and root bobbing unrelated to contact.
- A simple gait is not full body dynamics. Check the actual mesh soles, not just anchor positions, and account for character scale and raised floors. Use opt-in helpers so existing films do not silently change.
- Registered `character-motion-v1` supports straight paths with uniform scale and unrotated, unscaled room parents at world Y=0. It levels the existing shoes around their ankle pivots. Apply a `seatedPose` through `applyGroundedPose` after adding upper-body acting so previous ankle compensation resets; bare `setPose` does not own those added transforms.
- Let attention lead a reach and let the body settle after it. Continuous breathing can remain subtle; repeated head swivels and arm oscillations should not replace a completed action. Offset incidental actors rather than synchronizing them.
- Derive the full root, pose and interaction state from absolute film time on every update. Hand IK follows the pose reset. Ended actions stay ended on direct or backward seeks.
- For the later sound pass, record palm contact, foot planting, sneeze recoil and other audible action times in the existing animation plan/audio cues. Keep audio fixed during the isolated character comparison; use [scene sound design](../../voice-direction/references/sound-design.md) when synchronizing Foley in the assembled review.

## Review

Compare the same moving interval before/after, including the start, contact, release, stop and a nearby cut. Inspect the silhouette at phone size and normal overlays. Look for feet sliding or penetrating floors, floating seated hips, hands missing props, limb penetration and props detaching across cuts. Where contacts are important, supplement pictures with world-space measurements across multiple frames. Verify exact frames after out-of-order seeks.

Fix failures before changing voice performance. Record what improved and the limits of the stylized rig; a successful encode or lower motion amplitude alone does not establish convincing acting or higher retention.
