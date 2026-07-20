# Player and Ball Model View Contract

## Scope

This contract belongs to TON-81. It extracts Three.js player meshes, the ball mesh, shared GLTF/model-animation loading, kit materials, selection markers, labels and the charge indicator from generated `game.js` into explicit presentation views. It does not move gameplay, camera/replay, Canvas rendering, particles, trails, settings, audio or visual tuning.

## Ownership

`BrowserModelViewAdapter` owns browser composition for all WebGL player and ball views. It receives frozen presentation frames, interpolates through `SnapshotRenderState`, reconciles views by stable snapshot player id, owns shared character/animation asset loading and creates/tears down `PlayerModelView` and `BallModelView` instances through the TON-80 stable scene port.

`PlayerAssetLoader` owns GLTF/Meshopt loading, bounded asset retries and source-template disposal. `PlayerModelView` owns one player's procedural fallback, cloned rig, kit materials, mixer/actions, render-only action pose, selection marker and label. `BallModelView` owns the ball mesh, generated surface textures, ball-style projection and charge indicator.

## Facts boundary

Model views receive immutable facts only: current/previous match snapshots, interpolated player and ball render facts, selected-player and ball-owner ids, frozen active-charge and pressed-code facts, frame time and control mode. Views mutate only their own Three.js projections. They cannot dispatch commands or change possession, score, physics, match lifecycle, AI, replay or camera decisions.

## Scene boundary

TON-80 remains the sole owner of renderer, scene, camera, composer and environment lifecycle. Model views receive the stable frozen scene port, never raw scene or renderer handles. Context restoration replays retained objects to a fresh clean host.

The model adapter is ordered before the scene adapter for frame rendering. Its initial attach may defer until the scene host binds; on the first immutable frame it attaches, updates player/ball projections and only then the scene host renders that frame.

## Asset and fallback contract

- Character and animation assets load independently.
- Character failure leaves procedural players active.
- Animation failure leaves the loaded rig active with basic motion.
- Late async results after teardown are ignored.
- Shared source assets are disposed only after cloned views are torn down.
- View-owned materials, textures, labels, markers and procedural geometry are disposed by their owner.

## Ball and charge contract

Ball style is a read-only projection of `snapshot.match.settings.ballStyle`. The charge indicator is visible only when a frozen active-charge fact exists and the selected snapshot player owns the ball. Camera-facing orientation uses the scene-port quaternion operation. Trail ownership remains TON-84.

## Reset and teardown

Reset restores presentation transforms and hides transient indicators without changing simulation state. Teardown removes every owned root, stops mixers and releases owned resources after loading success or failure.

## Validation

TON-81 requires pure animation-state tests, immutable-frame rejection, asset success/failure, reconciliation/reset/teardown, generated-source ownership guards, production browser smoke, full CI and Vercel evidence on one frozen head. No validation may depend on gameplay mutation or visual tuning.
