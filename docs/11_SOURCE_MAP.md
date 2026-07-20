# Source Map

## Purpose

This document is the operational index for humans and AI agents navigating Tony Football. It maps each subsystem to its runtime owner, source, tests and allowed dependency direction.

Keep this map stable and query-friendly:

- describe ownership and contracts rather than temporary delivery status;
- do not use line numbers;
- update this map in the same pull request when ownership, entry points or dependency direction changes.

## Read path

Before modifying code:

1. Read the assigned Linear issue and latest canonical handoff.
2. Read `AGENTS.md`, `docs/03_DEV_RULES.md` and the relevant architecture contract.
3. Find the subsystem below.
4. Read its owner, migration bridge and focused tests before widening scope.

## Runtime entry points

| Entry point | Responsibility | Ownership note |
| --- | --- | --- |
| `index.html` | Browser shell, import map, canvas, HUD, menus and overlays | Loads guarded `browser-entry.js`; never gameplay authority |
| `browser-entry.js` | Removes blocked runtime/debug URL seams, exposes frozen scene/model/Canvas diagnostics bridges, registers browser presentation factories, then imports generated runtime | Entry composition only; no mutable gameplay state |
| `game.js` | Canonical compatibility input used to generate remaining settings/particles/trails/preview-tone/camera/replay presentation bridges | Does not own WebGL environment, player/ball model views or match Canvas drawing; fixed steps capture immutable engine snapshots |
| `generated/game.js` | Deterministic compatibility artifact created from tracked `game.js` | Never edited directly; contains only still-deferred presentation bridges |
| `src/game/application/BrowserBootstrapComposition.js` | Browser runtime/input/application/snapshot/presentation composition root | Attaches adapters and publishes immutable presentation frames before starting the loop; never imports Three.js or Canvas APIs |
| `src/game/presentation/BrowserPresentationComposition.js` | Adapter creation, startup rollback, render/reset fan-out and reverse teardown | Factories receive frozen browser lifecycle context; facts arrive through immutable frames/events |
| `src/game/application/BrowserRuntimeComposition.js` | Live browser runtime configuration and browser event publication | Deployed browser always uses engine authority |
| `src/game/application/BrowserMatchRuntime.js` | One `MatchEngine`, deterministic command scheduling, fixed steps, immutable snapshots and ordered events | Browser wrapper only; never infers gameplay facts from presentation |
| `src/game/engine/` | Match lifecycle, movement, ball, actions, possession, AI, goalkeeper and selected-owner takeover | No DOM, Canvas, Three.js, Web Audio or render-frame dependencies |
| `src/game/input/BrowserInputAdapter.js` | FO4 keyboard lifecycle, immutable commands, frozen active-charge and pressed-code facts | Dispatches to live engine authority and exposes presentation facts read-only |
| `src/game/application/ApplicationRuntime.js` | Navigation and match lifecycle requests | Match lifecycle requires live engine dispatch |
| `src/game/application/BrowserApplicationAdapter.js` | Browser buttons/events and immediate lifecycle UI projection | Listener lifecycle only |
| `src/game/presentation/CompatibilitySnapshotAdapter.js` | Mirrors immutable live-engine facts into temporary compatibility objects | Outward-only mirror; writes never become engine inputs |
| `src/game/presentation/SnapshotRenderState.js` | Immutable previous/current player and ball interpolation | Shared projection contract for WebGL and Canvas |
| `src/game/presentation/CanvasMatchRenderer.js` | Explicit forced-Canvas session lifecycle, viewport observation and snapshot-driven pitch/player/ball/selection/charge/weather projection | Sole owner of the match Canvas 2D context; inactive during WebGL sessions |
| `src/game/presentation/SnapshotCameraController.js`, `SnapshotReplayController.js` | Snapshot-driven camera/replay projections | Camera/replay extraction remains TON-83 |
| `src/game/presentation/DomHudAdapter.js`, `HudSnapshotProjection.js` | Browser HUD ownership and snapshot projection | Read-only snapshot consumer |
| `src/game/presentation/RadarSnapshotAdapter.js`, `RadarSnapshotRenderer.js` | Radar Canvas ownership and drawing | Read-only snapshot consumer with duplicate-owner transition guard |
| `src/game/presentation/BrowserAudioAdapter.js` | Usable match-event Web Audio ownership | Releases ownership on backend failure so compatibility fallback remains audible |
| `src/game/presentation/BrowserGameEventBridge.js` | Immutable ordered event transport | Transport only |
| `src/game/core/SimulationLoop.js` | Fixed simulation/render cadence and isolated after-render listeners | Presentation failures cannot stop later frames |
| `scripts/prepare-ton80-game.mjs`, `scripts/ton-80-migrate-game.py`, `scripts/ton-82-migrate-canvas.py` | Deterministic compatibility-artifact generation | Tracked source stays byte-identical; generated output fails closed on forbidden ownership |
| `scripts/build-static.mjs`, `vercel.json` | Static build/deployment contract | Preserve Vercel and GitHub Pages compatibility |

## Three.js scene and environment ownership

| Source | Responsibility | Boundary |
| --- | --- | --- |
| `ThreeSceneEnvironmentAdapter.js` | WebGL/fallback status, canvas lookup, resize, context loss/restoration, transactional host startup, immutable-frame render and teardown | Explicit scene lifecycle owner |
| `BrowserThreeSceneEnvironmentAdapterFactory.js` | Creates the clean browser scene host with the active frozen profile | Composition only; no gameplay authority |
| `BrowserThreeSceneEnvironmentHost.js` | Renderer/composer, scene, environment map, lights, pitch, grass, stadium, crowd, goals and weather | Owns one environment root; never disposes foreign registered objects |
| `ThreeSceneEnvironmentProfile.js` | Validated world/field/goal, renderer, camera, lighting and pitch-environment defaults | Stable visual-quality seam; no runtime mutation |
| `ThreeSceneHostContract.js` | Frozen port for object registration, immutable camera pose, quaternion copy, render request and diagnostics | Does not expose raw scene/camera/renderer/composer handles |
| `RebindableThreeSceneHostPort.js` | Page-lifetime stable port across clean-host replacement | Retains foreign object identities and latest camera pose without owning their resources |
| `docs/13_THREE_SCENE_HOST_CONTRACT.md` | Durable scene ownership, fallback, teardown and validation rules | Architecture contract for TON-80 and successor slices |

The deployed WebGL path uses one renderer, one scene, one camera and one composer created inside the clean host. Player, ball, model, trail and particle objects register as foreign roots through the stable port. Forced Canvas, unavailable WebGL, startup failure and context restoration remain explicit adapter-owned paths.

## Player and ball model ownership

| Source | Responsibility | Boundary |
| --- | --- | --- |
| `BrowserModelViewAdapter.js` | Snapshot interpolation, player reconciliation, shared character/animation loading, status/fallback lifecycle, reset and teardown | Receives immutable frames and frozen input presentation facts only |
| `PlayerModelView.js` | Procedural fallback, cloned rig, kit materials, mixer/actions, action pose, marker and label | Mutates only its own Three.js projection; never gameplay state |
| `BallModelView.js` | Ball mesh/surface/style and charge indicator | Charge reads frozen active-charge facts; trail remains outside TON-81 |
| `docs/14_MODEL_VIEW_CONTRACT.md` | Durable model ownership, asset fallback, facts and teardown rules | Architecture contract for TON-81 and successor slices |

Character loading failure preserves procedural players. Animation loading failure preserves a static model with safe basic motion. The adapter tears down all views before disposing shared source assets. Context restoration replays retained roots through the stable scene port.

## Canvas match ownership

| Source | Responsibility | Boundary |
| --- | --- | --- |
| `CanvasMatchRenderer.js` | Forced-Canvas activation, 2D context ownership, immutable snapshot interpolation, match drawing, resize/reset/teardown and diagnostics | Never reads mutable compatibility game/player/ball/input objects |
| `docs/15_CANVAS_MATCH_RENDERER_CONTRACT.md` | Activation, facts, parity, lifecycle and validation rules | Architecture contract for TON-82 and successor slices |
| `scripts/ton-82-migrate-canvas.py` | Removes generated match Canvas drawing and adds diagnostics bridge evidence | Generated compatibility runtime retains no match Canvas context |

Camera/replay decisions remain TON-83. Settings, particles, trails and preview tones remain TON-84. TON-85 removes final compatibility bridges.

## Browser runtime flow

```text
index.html
  → browser-entry.js engine-only URL guard
  → create page-lifetime stable scene façade
  → register model, scene and Canvas match adapter factories
  → import generated compatibility runtime
  → BrowserBootstrapComposition
      ├→ BrowserInputAdapter → immutable commands + frozen presentation input facts
      ├→ BrowserRuntimeComposition → BrowserMatchRuntime → MatchEngine
      ├→ CompatibilitySnapshotAdapter → immutable previous/current frames
      └→ BrowserPresentationComposition
          ├→ BrowserModelViewAdapter (lazy attach after scene bind; updates before scene render)
          ├→ ThreeSceneEnvironmentAdapter → clean BrowserThreeSceneEnvironmentHost
          ├→ CanvasMatchRenderer (active only for renderer=canvas page sessions)
          ├→ DomHudAdapter
          ├→ RadarSnapshotAdapter
          └→ event-audio/feedback adapters
      → presentation-ready hook registers remaining trail/particle/camera compatibility views
      → SimulationLoop starts
```

Authoritative state flows outward. Scene nodes, Canvas coordinates, DOM values, CSS classes, animation mixers, audio nodes and replay badges never become gameplay inputs.

## Subsystem ownership

| Subsystem | Source and owner | Focused validation | Direction |
| --- | --- | --- | --- |
| Fixed timestep | `FixedClock.js`, `SimulationLoop.js` | `tests/simulation/` | Fixed 60 Hz and interpolation |
| Browser bootstrap | `BrowserBootstrapComposition.js` | `tests/application/` | Immutable frame facts; one lifecycle owner |
| Presentation lifecycle | `BrowserPresentationComposition.js` | composition negative-path tests | Best-effort cleanup; frozen browser context |
| Browser runtime authority | browser entry/runtime/engine modules | authority guards and deterministic engine tests | One live `MatchEngine` |
| Commands/events/snapshots | `src/game/engine/` | contract, ordering and immutability tests | Serializable immutable contracts |
| Goal/replay timeline | `GoalSequenceTimeline.js`, `MatchEngine.js` | deterministic scenario/timeline tests | Engine authoritative |
| Player movement/stamina | engine movement systems | engine/gameplay tests | Renderer consumes snapshots |
| Ball/possession/actions | engine ball/action systems | engine/gameplay tests | No renderer mutation |
| FO4 keyboard mapping | `BrowserInputAdapter.js`, `FO4Controls.js` | input/application tests | Immutable commands and frozen presentation facts |
| AI/goalkeeper | engine AI systems | deterministic AI/engine tests | Engine-only decisions |
| Three.js renderer/environment | clean scene adapter/factory/host/profile/port | lifecycle, teardown, profile, source guards and browser smoke | Host owns environment; foreign views retain disposal ownership |
| Player/ball models and animation | `BrowserModelViewAdapter`, `PlayerModelView`, `BallModelView` | loading success/failure, animation projection, reset/teardown, source guard and browser smoke | Snapshot-only projection through stable scene port |
| Canvas fallback renderer | `CanvasMatchRenderer`, `SnapshotRenderState` | immutable lifecycle/parity tests, generated ownership guard, forced-Canvas browser smoke | One explicit Canvas page-session owner |
| Camera/replay | snapshot controllers plus scene-port camera pose | presentation and browser flows | Pending TON-83 extraction |
| Settings/particles/trails | remaining generated runtime implementations | presentation/event/browser tests | Pending TON-84 extraction |
| Final bridge cleanup | remaining duplicate callbacks and composition helpers | architecture/source-map and parity gates | TON-85 |
| Static deployment | package/build/Vercel contracts | build and preview smoke | Static hosting preserved |
| Workflow safety | policy scanners, allowlist and security docs | tooling policy suite | CI cannot publish source or broaden permissions |

## Current migration bridges

These are temporary migration points, not patterns to copy:

- `CompatibilitySnapshotAdapter` mirrors immutable engine facts into compatibility objects only where remaining presentation implementations still read them.
- Generated runtime owns trail, particles, settings/preview tones and camera/replay projection but no longer owns WebGL environment, player/ball models or match Canvas drawing.
- Camera decisions remain in snapshot camera/replay controllers and are projected through immutable `setCameraPose` calls.
- New presentation implementations must register through `BrowserPresentationComposition`; new gameplay logic must never be added to `game.js`.

## Dependency rules

Engine and core modules may depend on pure JavaScript data/math, deterministic clocks/random sources, gameplay configuration and engine contracts. They must not depend on `window`, `document`, DOM, CSS, Three.js, Canvas, Web Audio, `requestAnimationFrame`, presentation modules or rendered values.

Browser composition may connect input, application, engine and presentation adapters. Presentation adapters may consume immutable snapshots/events and browser-safe services, but may not mutate engine-owned players, ball, score, statistics, clock, possession, AI, goal phases, replay or match lifecycle.

Three.js and Canvas context ownership belong under presentation. Application modules accept factories/ports and do not import renderer implementations.

## Validation pyramid

- `npm run test:engine:fast`: simulation, engine, gameplay, input/application and deterministic scenarios.
- `npm run test:presentation:fast`: snapshot/event projections, adapter lifecycle, scene/model/Canvas lifecycle and profile validation without gameplay simulation.
- `npm run test:tooling`: workflow policy, source/authority/ownership guards and architecture contracts.
- `npm run test:ci:fast`: syntax, assets, engine, presentation, tooling and static build.
- `npm run test:e2e:smoke`: clean-host WebGL, forced Canvas, model views, input, pause/resume and context restoration.
- broad Playwright remains focused/manual/scheduled visual evidence; gameplay correctness never depends on it.

## Test map

| Change type | Minimum validation |
| --- | --- |
| Browser bootstrap/composition | focused lifecycle tests, `test:ci:fast`, desktop/narrow smoke |
| Three scene lifecycle or host | startup/fallback/context-loss/teardown, foreign-resource preservation, profile, WebGL/Canvas smoke |
| Player/ball model animation | immutable-frame, asset success/failure, animation state, reset/teardown, source guard, WebGL/Canvas smoke |
| Canvas fallback | immutable lifecycle/parity, missing-context and coordinate tests, generated ownership guard, engine-backed Canvas smoke |
| Camera/HUD/overlays | pure presentation tests; broad browser evidence for visual changes |
| Engine contract | deterministic headless contracts, ordering and immutability |
| Workflow/CI policy | actual workflow scan, positive/negative fixtures and required CI gate |

## Update checklist

Update this file whenever a pull request changes a runtime entry point, authoritative owner, compatibility bridge, dependency direction, command/event/snapshot contract, adapter location, workflow-security boundary or focused validation path.
