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
| `browser-entry.js` | Removes blocked runtime/debug URL seams, installs the temporary Three.js migration registry, registers browser presentation adapter factories, then imports `game.js` | Entry composition only; it does not progress gameplay or expose mutable runtime state |
| `game.js` | Remaining compatibility presentation mirrors, player/ball/model animation, Canvas renderer, settings, particles, trails, preview tones and temporary legacy Three.js construction | Fixed steps capture immutable engine snapshots; legacy gameplay helpers retain a tested zero-invocation browser boundary |
| `src/game/application/BrowserBootstrapComposition.js` | Browser runtime/input/application/snapshot/presentation composition root | Resolves validated presentation adapter factories, owns deterministic start/reset/teardown and never imports Three.js |
| `src/game/presentation/BrowserPresentationComposition.js` | Presentation adapter creation, best-effort startup rollback, render/reset fan-out and reverse teardown | Factories receive frozen browser-safe lifecycle context; gameplay facts arrive only through immutable frames/events |
| `src/game/application/BrowserRuntimeComposition.js` | Live browser runtime configuration and browser event publication | Deployed browser always uses engine authority |
| `src/game/application/BrowserMatchRuntime.js` | One `MatchEngine`, deterministic command scheduling, fixed steps, immutable snapshots and ordered events | Browser wrapper only; never infers authoritative gameplay facts |
| `src/game/engine/MatchEngine.js`, `GoalSequenceTimeline.js` | Match lifecycle and deterministic goal timeline | Headless authority for score, phases, replay clock and kickoff reset |
| `src/game/engine/` | Movement, ball, actions, possession, AI, goalkeeper and selected-owner takeover | No DOM, Canvas, Three.js, Web Audio or render-frame dependencies |
| `src/game/input/BrowserInputAdapter.js` | FO4 keyboard lifecycle and immutable human commands | Dispatches to live engine authority and fails closed otherwise |
| `src/game/application/ApplicationRuntime.js` | Navigation and match lifecycle requests | Match lifecycle requires live engine dispatch |
| `src/game/application/BrowserApplicationAdapter.js` | Browser buttons/events and immediate lifecycle UI projection | Listener lifecycle only |
| `src/game/presentation/CompatibilitySnapshotAdapter.js` | Mirrors immutable live-engine facts into temporary legacy presentation objects | Outward-only mirror; writes never become engine inputs |
| `src/game/presentation/SnapshotRenderState.js` | Immutable previous/current snapshot interpolation | Shared presentation contract for WebGL and Canvas |
| `src/game/presentation/SnapshotCameraController.js`, `SnapshotReplayController.js` | Snapshot-driven camera/replay projections | Camera/replay ownership extraction remains TON-83 |
| `src/game/presentation/DomHudAdapter.js`, `HudSnapshotProjection.js` | Browser HUD ownership and snapshot projection | Read-only snapshot consumer |
| `src/game/presentation/RadarSnapshotAdapter.js`, `RadarSnapshotRenderer.js` | Radar canvas ownership and drawing | Read-only snapshot consumer with duplicate-owner transition guard |
| `src/game/presentation/BrowserAudioAdapter.js` | Usable match-event Web Audio ownership | Releases ownership on backend failure so compatibility fallback remains audible |
| `src/game/presentation/BrowserGameEventBridge.js` | Immutable ordered event transport to browser consumers | Transport only |
| `src/game/core/SimulationLoop.js` | Fixed simulation/render cadence and isolated after-render listeners | Presentation failures cannot stop subsequent frames |
| `scripts/build-static.mjs`, `vercel.json` | Static build/deployment contract | Preserve Vercel and GitHub Pages compatibility |

## Three.js scene and environment ownership

| Source | Responsibility | Boundary |
| --- | --- | --- |
| `ThreeSceneEnvironmentAdapter.js` | WebGL/fallback status, canvas lookup, resize, context loss/restoration, transactional host startup, immutable-frame render and best-effort teardown | Explicit presentation lifecycle owner |
| `BrowserThreeSceneEnvironmentAdapterFactory.js` | Selects the adopted parity host when legacy resources exist and the clean host otherwise | Composition only; no gameplay authority |
| `BrowserThreeSceneEnvironmentHost.js` | Clean renderer/composer, scene, environment map, lights, pitch, grass, stadium, crowd, goals and weather implementation | Presentation-only Three.js implementation |
| `LegacyAdoptedThreeSceneHost.js` | Adopts the existing renderer, scene, camera and composer without creating a second WebGL context or disposing legacy model objects | Temporary parity host; adapter becomes sole render/resize/fallback owner |
| `LegacyThreeSceneRegistry.js` | Captures legacy Three.js resources before `game.js` boot, suppresses the superseded legacy render call and forwards late model objects through a recursion-safe mutation scope | Temporary bridge scheduled for TON-85 removal |
| `ThreeSceneHostContract.js` | Frozen scene-host port: object registration, immutable camera pose, quaternion copy, render request and immutable diagnostics | Does not expose raw scene/camera/renderer/composer handles |
| `docs/13_THREE_SCENE_HOST_CONTRACT.md` | Durable ownership, fallback and migration rules | Architecture contract for TON-80 and successors |

The deployed WebGL path uses one renderer, one scene, one camera and one composer. During parity migration, the adapter adopts those existing objects, suppresses the direct legacy render call and performs the official render from the immutable after-render frame. Forced `renderer=canvas`, unavailable WebGL and context failure remain explicit fallback paths.

Player/ball meshes, model loading and animation mixers remain owned by `game.js` until TON-81. Camera/replay decisions remain TON-83. Settings, particles, trails and preview tones remain TON-84. Removing the adopted-host registry and superseded construction source belongs to TON-85.

## Browser runtime flow

```text
index.html
  → browser-entry.js engine-only URL guard
  → install temporary Three.js registry
  → register presentation adapter factories
  → game.js creates legacy parity objects and live engine composition
  → BrowserBootstrapComposition
      ├→ BrowserInputAdapter → BrowserRuntimeComposition → BrowserMatchRuntime → MatchEngine
      ├→ CompatibilitySnapshotAdapter → immutable previous/current frames
      └→ BrowserPresentationComposition
          ├→ ThreeSceneEnvironmentAdapter → adopted or clean Three scene host
          ├→ DomHudAdapter
          ├→ RadarSnapshotAdapter
          └→ event-audio/feedback adapters
```

Authoritative state flows outward. Scene nodes, Canvas coordinates, DOM values, CSS classes, animation mixers, audio nodes and replay badges never become gameplay inputs.

## Subsystem ownership

| Subsystem | Source and owner | Focused validation | Direction |
| --- | --- | --- | --- |
| Fixed timestep | `FixedClock.js`, `SimulationLoop.js` | `tests/simulation/` | Fixed 60 Hz and interpolation |
| Browser bootstrap | `BrowserBootstrapComposition.js` | `tests/application/` | One explicit lifecycle owner |
| Presentation lifecycle | `BrowserPresentationComposition.js` | composition negative-path tests | Best-effort cleanup; immutable browser context |
| Browser runtime authority | browser entry/runtime/engine modules | authority guards and deterministic engine tests | One live MatchEngine |
| Commands/events/snapshots | `src/game/engine/` | contract, ordering and immutability tests | Serializable immutable contracts |
| Goal/replay timeline | `GoalSequenceTimeline.js`, `MatchEngine.js` | deterministic scenario/timeline tests | Engine authoritative |
| Player movement/stamina | engine movement systems | engine/gameplay tests | Renderer consumes snapshots |
| Ball/possession/actions | engine ball/action systems | engine/gameplay tests | No renderer mutation |
| FO4 keyboard mapping | `BrowserInputAdapter.js`, `FO4Controls.js` | input/application tests | Immutable human commands |
| AI/goalkeeper | engine AI systems | deterministic AI/engine tests | Engine-only decisions |
| Three.js renderer/environment | Three scene adapter, factory, clean/adopted hosts and registry bridge | `threeSceneEnvironmentAdapter`, host-contract, adopted-host, registry tests plus required WebGL/Canvas smoke | Adapter owns render/resize/fallback lifecycle; legacy model identity preserved |
| Player/ball models and animation | `game.js` plus assets | asset validation and browser smoke | Pending TON-81 adapter extraction |
| Canvas fallback renderer | `game.js`, `SnapshotRenderState.js` | required engine-backed Canvas smoke | Pending TON-82 extraction |
| Camera/replay | snapshot controllers plus compatibility wiring | presentation and browser flows | Pending TON-83 extraction |
| Settings/particles/trails | remaining `game.js` implementations | presentation/event/browser tests | Pending TON-84 extraction |
| Final bridge cleanup | adopted Three registry plus remaining duplicate callbacks/construction | exact-head architecture/source-map and browser parity gates | TON-85 |
| Static deployment | package/build/Vercel contracts | build and preview smoke | Static hosting preserved |
| Workflow safety | policy scanners, allowlist and security docs | tooling policy suite | CI cannot publish source or broaden permissions |

## Current migration bridges

These are temporary migration points, not patterns to copy:

- `LegacyThreeSceneRegistry` captures legacy Three resources and prevents duplicate rendering while `LegacyAdoptedThreeSceneHost` preserves object identity. The adapter owns the official render/resize/fallback lifecycle; TON-85 removes this bridge after successor adapters no longer depend on legacy construction.
- `game.js` still constructs legacy environment objects so parity is preserved without a risky whole-file replacement. This is construction debt, not runtime ownership.
- `CompatibilitySnapshotAdapter` mirrors immutable engine facts into legacy player/ball objects only where existing presentation implementations still read them.
- Player/ball model loading may add objects after adapter activation; the registry forwards them through the frozen scene-host port using an owned mutation scope that bypasses recursive `Scene.add` interception.
- New presentation implementations must register through `BrowserPresentationComposition`; new gameplay logic must never be added to `game.js`.

## Dependency rules

Engine and core modules may depend on pure JavaScript data/math, deterministic clocks/random sources, gameplay configuration and engine contracts. They must not depend on `window`, `document`, DOM, CSS, Three.js, Canvas, Web Audio, `requestAnimationFrame`, presentation modules or rendered values.

Browser composition may connect input, application, engine and presentation adapters. Presentation adapters may consume immutable snapshots/events and browser-safe services, but may not mutate engine-owned players, ball, score, statistics, clock, possession, AI, goal phases, replay or match lifecycle.

Three.js imports belong under presentation or the guarded browser entry. Application modules accept factories/ports and do not import Three.js.

## Validation pyramid

- `npm run test:engine:fast`: simulation, engine, gameplay, input/application and deterministic scenarios.
- `npm run test:presentation:fast`: snapshot/event projections and synthetic adapter lifecycle without gameplay simulation.
- `npm run test:tooling`: workflow policy, source/authority guards and architecture contracts.
- `npm run test:ci:fast`: syntax, assets, engine, presentation, tooling and static build.
- `npm run test:e2e:smoke`: production WebGL boot, forced Canvas boot, input, pause/resume, snapshot/HUD projection and desktop/narrow composition.
- broad Playwright remains focused/manual/scheduled visual evidence; gameplay correctness never depends on it.

## Test map

| Change type | Minimum validation |
| --- | --- |
| Browser bootstrap/composition | focused lifecycle tests, `test:ci:fast`, desktop/narrow smoke |
| Three scene lifecycle or host | synthetic startup/fallback/context-loss/teardown tests, host/registry/adoption tests, required WebGL and forced Canvas smoke |
| Player/ball model animation | asset validation, WebGL/Canvas smoke and focused broad visual evidence |
| Canvas fallback | engine-backed Canvas smoke and coordinate parity |
| Camera/HUD/overlays | pure presentation tests; broad browser evidence for visual changes |
| Engine contract | deterministic headless contracts, ordering and immutability |
| Workflow/CI policy | actual workflow scan, positive/negative fixtures and required CI gate |

## Update checklist

Update this file whenever a pull request changes a runtime entry point, authoritative owner, compatibility bridge, dependency direction, command/event/snapshot contract, adapter location, workflow-security boundary or focused validation path.
