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

`BrowserThreeSceneEnvironmentHost` contains the clean renderer/composer, scene, environment map, lights, pitch, grass, stadium, crowd and weather implementation. During parity migration, `LegacyAdoptedThreeSceneHost` adopts the existing renderer, scene, camera, composer and environment object identities so the adapter becomes the sole render/resize/fallback owner without creating a second WebGL context. `BrowserThreeSceneEnvironmentAdapterFactory` selects the adopted host when the legacy composition exists and the clean host otherwise; application modules do not import Three.js.

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
2. Move the concrete Three.js renderer/composer and environment resources from `game.js` into the host factory. **Complete.**
3. Register the adapter through `BrowserBootstrapComposition.presentationAdapterFactories`. **Complete through browser-entry composition.**
4. Rewire legacy player/ball/camera implementations to the port without moving their ownership. **Complete through the temporary `LegacyThreeSceneRegistry`: the adapter adopts the existing renderer/scene/camera, suppresses the superseded render call and forwards late model objects.**
5. Prove WebGL success and forced Canvas fallback in browser smoke. **In validation.**
6. Remove the superseded `init3D` environment construction source from `game.js`. **Deferred to TON-85. Until then the adopted host preserves the existing object identities, while the registry suppresses the legacy render call and the adapter owns render, resize, context fallback and teardown.**

No step may alter visuals or gameplay facts.
