# Player, Ball and Model-Animation View Contract

## Ownership

`BrowserModelViewAdapter` is the lifecycle owner for WebGL player and ball presentation. It consumes immutable render frames and owns reconciliation by stable entity id.

`PlayerModelView` owns:

- procedural fallback geometry;
- cloned character rig;
- per-player kit materials and squad numbers;
- animation mixer/actions and render-only action poses;
- player marker and label;
- disposal of resources it creates.

`BallModelView` owns:

- ball mesh and surface textures;
- ball-style projection;
- WebGL charge indicator;
- disposal of ball/charge resources.

`BrowserPlayerAssetLoader` owns GLTF/Meshopt loading and independent character/animation failure handling.

## Inputs

Model views may receive only:

- frozen current/previous match snapshots;
- interpolation alpha and timestamp;
- frozen active-charge and pressed-code presentation facts;
- the stable `ThreeSceneHostContract` port;
- browser-safe document services for generated labels/status.

They must never receive mutable engine player or ball objects.

## Scene boundary

Model views register their roots through `addObject` and remove them through `removeObject`. They do not access raw scene, renderer, camera or composer handles. The stable scene façade replays registered roots after WebGL context restoration.

The scene host never disposes model resources. Model views retain teardown ownership.

## Loading and fallback

Character and animation assets load independently:

1. procedural player geometry is immediately available;
2. character success upgrades existing views to cloned rigs;
3. animation success installs clips on existing rigs;
4. character failure keeps procedural geometry;
5. animation failure keeps the loaded static model and basic transform projection.

Asset loading cannot block gameplay or mutate simulation state.

## Animation projection

Animation selection is derived from immutable pose facts:

- idle/jog/sprint use speed with hysteresis;
- celebration maps to `Dance_Loop`;
- dive maps to `Roll`;
- tackle/receive retain stable base locomotion while procedural action pose offsets apply;
- shoot/pass/receive/tackle bone offsets are presentation-only.

No mixer state or rendered bone transform may become a gameplay input.

## Ball and charge projection

Ball position, height and rotation come from the interpolated ball snapshot. Ball style comes from `snapshot.match.settings.ballStyle`.

The charge indicator is visible only when a frozen active-charge fact exists and the selected snapshot player owns the ball. Canvas charge drawing remains in TON-82.

## Reset and teardown

Reset:

- clears transient charge visibility;
- resets model transforms/mixers without reloading assets;
- preserves stable ownership and loaded character data.

Teardown:

- aborts/invalidates pending loader callbacks;
- removes all roots from the scene port;
- disposes player-owned materials/textures/geometries;
- disposes ball/charge resources;
- never disposes scene-host environment resources.

## Deferred

- Canvas renderer extraction and parity: TON-82;
- camera and replay ownership: TON-83;
- particles, trails, settings and feedback: TON-84;
- final compatibility bridge removal: TON-85;
- visual redesign and geometry/lighting tuning: TON-87 onward.
