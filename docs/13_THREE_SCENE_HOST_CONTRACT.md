# Three.js Scene Host Contract

## Scope

This contract belongs to TON-80. It moves browser WebGL scene and environment lifecycle behind `ThreeSceneEnvironmentAdapter` without absorbing player/ball model animation, camera/replay decisions, settings, particles, trails, audio or final compatibility cleanup.

## Ownership

`ThreeSceneEnvironmentAdapter` owns:

- WebGL capability selection and forced Canvas preference;
- canvas lookup, resize listeners and pixel-ratio projection;
- context-loss and context-restoration lifecycle;
- transactional scene-host startup and best-effort disposal;
- explicit fallback publication through `tony:three-scene-fallback`;
- immutable after-render frame delivery to the active scene host.

`BrowserThreeSceneEnvironmentHost` owns renderer/composer, scene, environment map, lights, pitch, grass, stadium, crowd and weather resources. `BrowserThreeSceneEnvironmentAdapterFactory` binds that host to the lifecycle adapter without adding Three.js imports to application modules.

## Port boundary

Later TON-81 and TON-83 work may connect through the frozen scene-host port only:

- `addObject(object)` and `removeObject(object)`;
- `setCameraPose(immutablePose)`;
- `copyCameraQuaternion(target)`;
- `requestRender()`;
- `diagnostics()` returning a frozen plain object.

The port does not expose raw `scene`, `camera`, `renderer` or `composer` references. It cannot dispatch gameplay commands, reset runtime state or mutate snapshots.

## Fallback contract

Expected fallback reasons are stable strings:

- `forced-canvas`;
- `canvas-missing`;
- `webgl-startup-failed`;
- `webgl-context-lost`;
- `webgl-resize-failed`;
- `webgl-render-unavailable`;
- `webgl-render-failed`;
- `webgl-reset-failed`.

Fallback details are immutable and contain `reason`, `message` and `recoverable`. Context restoration may create a fresh host after a recoverable failure. Forced Canvas and missing canvas are non-recoverable for the current attachment.

## Delivery sequence

1. Land and validate the lifecycle/port contract. **Complete.**
2. Move the concrete Three.js renderer/composer and environment resources from `game.js` into the host factory. **Complete as an isolated presentation host.**
3. Register the adapter through `BrowserBootstrapComposition.presentationAdapterFactories`.
4. Rewire legacy player/ball/camera implementations to the port without moving their ownership.
5. Prove WebGL success and forced Canvas fallback in browser smoke.
6. Remove the superseded `init3D` environment lifecycle from `game.js`.

No step may alter visuals or gameplay facts.
