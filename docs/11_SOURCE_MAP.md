# Source Map

## Purpose

This document maps Tony Football subsystems to their runtime owner, source, tests and allowed dependency direction. Update it whenever a pull request changes ownership, entry points, compatibility bridges or validation paths.

## Read path

1. Read the assigned Linear issue and latest canonical handoff.
2. Read `AGENTS.md`, `docs/03_DEV_RULES.md` and the relevant architecture contract.
3. Find the subsystem below.
4. Read its owner, migration bridge and focused tests before widening scope.

## Runtime entry points

| Entry point | Responsibility | Ownership note |
| --- | --- | --- |
| `index.html` | Browser shell, import map, canvas, HUD, menus and overlays | Loads guarded `browser-entry.js`; never gameplay authority |
| `browser-entry.js` | Removes blocked URL seams, exposes stable scene/model diagnostics bridges, registers model then scene presentation factories, imports generated runtime | Composition only; no mutable gameplay state |
| `generated/game.js` | Compatibility mirrors, Canvas renderer, settings callbacks, particles, trails, preview tones and camera/replay projection | Deterministically generated from tracked `game.js`; no player/ball/model-animation ownership |
| `game.js` | Canonical migration input | Reviewable legacy source only; never served or mutated by build/test |
| `BrowserBootstrapComposition.js` | Runtime/input/application/snapshot/presentation composition root | Publishes immutable snapshot and input presentation facts |
| `BrowserPresentationComposition.js` | Adapter creation, rollback, render/reset fan-out and reverse teardown | Gameplay facts arrive only through immutable frames/events |
| `BrowserRuntimeComposition.js`, `BrowserMatchRuntime.js` | Live engine runtime | One authoritative `MatchEngine` |
| `BrowserInputAdapter.js` | FO4 keyboard lifecycle and immutable commands | Exposes frozen active-charge and pressed-code facts to bootstrap |
| `CompatibilitySnapshotAdapter.js` | Mirrors engine facts into compatibility presentation objects | Outward-only bridge |
| `SnapshotRenderState.js` | Immutable snapshot interpolation | Shared presentation contract |
| `scripts/prepare-ton80-game.mjs` | Clean-host/model-view generated artifact preparation | Leaves tracked `game.js` byte-identical |
| `scripts/build-static.mjs`, `vercel.json` | Static build/deployment | Publishes `dist` from clean checkout |

## Three.js scene and environment ownership

| Source | Responsibility | Boundary |
| --- | --- | --- |
| `ThreeSceneEnvironmentAdapter.js` | WebGL/fallback status, resize, context lifecycle and immutable-frame render | Presentation lifecycle owner |
| `BrowserThreeSceneEnvironmentAdapterFactory.js` | Creates clean host and fallback policy | Composition only |
| `BrowserThreeSceneEnvironmentHost.js` | Renderer/composer, scene, environment, lights, pitch, stadium, goals and weather | Detaches but never disposes foreign model/effect objects |
| `RebindableThreeSceneHostPort.js` | Stable page-lifetime façade across restored hosts | Replays registered objects and camera pose |
| `ThreeSceneHostContract.js` | Object registration, camera pose/quaternion, render request and diagnostics | No raw renderer/scene/camera handles |

## Player, ball and model-animation ownership

| Source | Responsibility | Boundary |
| --- | --- | --- |
| `BrowserModelViewAdapter.js` | Snapshot reconciliation, player/ball view lifecycle, asset status and model installation | Consumes immutable frames and stable scene port only |
| `PlayerModelView.js` | Procedural fallback, cloned rig, kit shader/materials, mixer/actions, labels, marker and action poses | Never receives mutable engine player objects |
| `BallModelView.js` | Ball mesh/surface/style and WebGL charge indicator | Charge uses frozen input facts; trail remains TON-84 |
| `BrowserPlayerAssetLoader.js` | GLTF/Meshopt loading, timeout/retry and independent character/animation fallback | No scene registration or gameplay access |

The model adapter factory is listed before the scene factory so model transforms run before the scene render. Its `attach()` does not require a scene. The scene adapter binds the stable façade later in the same startup transaction; model objects are created lazily on the first immutable render frame.

## Browser runtime flow

```text
index.html
  → browser-entry.js
      ├→ stable scene façade
      ├→ model diagnostics bridge
      └→ presentation factories [model adapter, scene adapter]
  → generated/game.js
  → BrowserBootstrapComposition
      ├→ BrowserInputAdapter → BrowserRuntimeComposition → MatchEngine
      ├→ CompatibilitySnapshotAdapter → immutable previous/current frames
      └→ BrowserPresentationComposition
          ├→ BrowserModelViewAdapter → PlayerModelView / BallModelView
          ├→ ThreeSceneEnvironmentAdapter → clean scene host
          ├→ DomHudAdapter
          ├→ RadarSnapshotAdapter
          └→ feedback/audio adapters
```

Authoritative state flows outward. Animation mixers, meshes, materials, charge geometry and DOM status never become gameplay inputs.

## Subsystem ownership

| Subsystem | Source and owner | Focused validation |
| --- | --- | --- |
| Engine/gameplay | `src/game/engine/` | deterministic engine/scenario tests |
| Input | `BrowserInputAdapter.js` | input/application tests |
| Snapshot interpolation | `SnapshotRenderState.js` | presentation tests |
| WebGL environment | scene adapter/factory/host/profile/port | lifecycle/profile/context smoke |
| Player/ball models | model adapter, player view, ball view, asset loader | adapter lifecycle, transition/style contracts, asset validation and browser smoke |
| Canvas fallback | generated runtime | pending TON-82 |
| Camera/replay | snapshot controllers plus camera-pose bridge | pending TON-83 |
| Settings/particles/trails | generated runtime | pending TON-84 |
| Final bridge cleanup | generated runtime/tooling | TON-85 |

## Current migration bridges

- `CompatibilitySnapshotAdapter` mirrors immutable engine facts into compatibility objects only where remaining presentation code still reads them.
- Generated runtime owns Canvas rendering, camera/replay, particles and trails.
- Player/ball/model ownership is no longer generated; model views register through `ThreeSceneHostContract`.
- Camera decisions remain projected through immutable `setCameraPose`.
- New gameplay logic must never be added to `game.js`.

## Dependency rules

Engine/core modules may not depend on browser or presentation APIs. Presentation modules may import Three.js and consume immutable snapshots/events/input facts, but may not mutate engine state. Application modules accept factories and ports and do not import Three.js.

## Validation pyramid

- `test:engine:fast`: deterministic authority.
- `test:presentation:fast`: model/scene/HUD/radar/audio lifecycle and pure projection.
- `test:tooling`: generated ownership guards and workflow policy.
- `test:ci:fast`: syntax, assets, engine, presentation, tooling and static build.
- `test:e2e:smoke`: clean-host model views, forced Canvas, movement and lifecycle.

## Minimum validation

| Change | Minimum evidence |
| --- | --- |
| Player/ball/model animation | asset validation, model adapter lifecycle tests, transition/style contracts, production WebGL and Canvas smoke |
| Scene lifecycle | startup/fallback/context restore/foreign-resource tests |
| Canvas | engine-backed Canvas smoke and coordinate parity |
| Camera/HUD | pure presentation tests plus browser evidence |
| Engine contract | deterministic headless tests |
