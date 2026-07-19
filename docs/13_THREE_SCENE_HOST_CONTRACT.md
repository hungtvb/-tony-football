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

`BrowserThreeSceneEnvironmentHost` is the only production WebGL scene/environment host. It creates and owns the renderer/composer, scene, environment map, lights, pitch, grass, stadium, crowd, goals and weather resources. `BrowserThreeSceneEnvironmentAdapterFactory` always creates this clean host on the WebGL path. Application modules do not import Three.js.

`ThreeSceneEnvironmentProfile` is a deeply frozen, validated configuration seam. It contains the current world, field and goal geometry; renderer background, fog and exposure; camera defaults; lighting; and pitch-environment styles. Defaults preserve the current presentation. Diagnostics expose the active profile id without exposing mutable resources.

## Foreign-resource rule

Objects added through the scene-host port belong to their registering adapter or compatibility view. The scene host may attach or detach them, but it must not dispose their geometry, materials, textures, animation mixers or other resources.

The host keeps its own environment objects under a dedicated environment root. Teardown:

1. detaches all foreign objects;
2. removes and disposes only the environment root;
3. disposes the environment texture, composer and renderer;
4. clears internal state even when one disposer fails.

## Port boundary

Later TON-81 and TON-83 work may connect through the frozen scene-host port only:

- `addObject(object)` and `removeObject(object)`;
- `setCameraPose(immutablePose)`;
- `copyCameraQuaternion(target)`;
- `requestRender()`;
- `diagnostics()` returning a frozen plain object.

The page-lifetime `RebindableThreeSceneHostPort` façade retains foreign object identities and the latest immutable camera pose while the concrete clean host is replaceable. Fresh-host binding replays those facts transactionally. Failed replay rolls candidate registrations back and leaves the façade detached; neither the host nor the façade may dispose foreign resources.

The port does not expose raw `scene`, `camera`, `renderer` or `composer` references. It cannot dispatch gameplay commands, reset runtime state or mutate snapshots.

## Startup order

`BrowserBootstrapComposition` attaches presentation adapters before starting the simulation loop. It then invokes the presentation-ready hook so temporary player, ball and effect views can register through the already-active stable scene-host port. `game.js` must not create a renderer, scene, camera, composer, environment map, lights, pitch, stadium, goals or weather resources.

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

Fallback details are immutable and contain `reason`, `message` and `recoverable`.

Production fallback routing is deliberately minimal:

- forced Canvas starts through the existing Canvas path;
- recoverable startup, resize, render and reset failures route to Canvas immediately;
- `webgl-context-lost` remains on the current page and waits for one browser `webglcontextrestored` event;
- the restoration event attempts one fresh clean-host startup using the existing stable façade;
- successful startup rebinds retained views and the latest immutable camera pose;
- failed fresh-host startup publishes `webgl-startup-failed` and routes to Canvas;
- TON-80 introduces no timeout, retry orchestration, hot WebGL-to-Canvas takeover, dual-renderer synchronization or live match-state migration.

A Canvas reload may restart the current match. In-place Canvas snapshot parity and any future renderer switching belong to TON-82.

## Validation

TON-80 requires:

- synthetic adapter lifecycle and fallback coverage;
- executable clean-host start, render, dispose and restart coverage;
- a regression proving foreign geometry/material resources survive host teardown;
- stable façade replay and failed-rebind rollback coverage;
- production factory/browser integration proving context loss does not navigate immediately, one restoration event creates a fresh host, retained views/camera pose replay and subsequent camera/quaternion/render operations reach the fresh host;
- a production-factory regression proving failed fresh-host startup routes to Canvas without timer/retry orchestration;
- frozen profile validation and profile diagnostics;
- source guards proving `game.js` no longer constructs the Three.js environment;
- production WebGL smoke proving `owner === "clean-host"`;
- forced Canvas smoke;
- full CI and deployment checks on one exact head.

No step may alter visuals or gameplay facts.
