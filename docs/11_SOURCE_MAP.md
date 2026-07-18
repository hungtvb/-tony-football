# Source Map

## Purpose

This document is the operational index for humans and AI agents navigating Tony Football. It maps each subsystem to its runtime owner, source, tests, and intended dependency direction.

Keep this map stable and query-friendly:

- describe ownership and contracts rather than mutable delivery status;
- do not use line numbers;
- do not list every helper when a subsystem entry is enough;
- update this map in the same pull request when ownership, entry points, or dependency direction changes.

## Read path

Before modifying code:

1. Read the assigned Linear issue and latest handoff.
2. Read `AGENTS.md` and `docs/03_DEV_RULES.md`.
3. Find the subsystem in this source map.
4. Read its specification, ADR, implementation, and focused tests.
5. Use the exported symbol or runtime event to narrow code search before widening scope.

## Runtime entry points

| Entry point | Responsibility | Ownership note |
| --- | --- | --- |
| `index.html` | Browser shell, import map, HUD, menus and overlays | Loads the guarded browser entry; never gameplay authority |
| `browser-entry.js` | Sanitizes browser URL state before loading `game.js` | Removes compatibility/debug gameplay mutation switches and guarantees deployed engine authority |
| `game.js` | Render implementations, DOM callbacks, settings/effects, presentation-only fixed-step decay and temporary snapshot-projected legacy objects | Deployed `simulationStep` invokes only presentation updates and engine snapshot capture; isolated legacy gameplay helpers have a zero-invocation browser guard |
| `src/game/application/BrowserBootstrapComposition.js` | Named browser composition root for runtime target, application/input adapters, simulation loop, snapshot adapter and presentation-feedback subscription | Owns deterministic start, reset, pause/resume requests and teardown without changing deployed entry behavior |
| `src/game/application/BrowserRuntimeComposition.js` | Owns live browser runtime configuration, fixed source ticks, lifecycle/input routing and browser event publication | Deployed browser always resolves to engine authority; compatibility construction is isolated and cannot progress application lifecycle |
| `src/game/application/BrowserMatchRuntime.js` | Owns one `MatchEngine`, deterministic command scheduling, fixed steps, immutable snapshots, ordered events and action intents | Browser-facing wrapper only; it publishes engine results and never infers score/replay transitions |
| `src/game/engine/MatchEngine.js`, `GoalSequenceTimeline.js` | MatchEngine lifecycle plus deterministic goal phases `native-highlight → goal-card → score-card → replay → kickoff` | Headless authority for phase order, replay clock and post-goal reset; transitions occur before snapshot capture |
| `src/game/engine/` | Match state, movement, ball simulation, player actions, goalkeeper behavior, AI and selected-owner takeover guard | Headless authority; owns active human attack intent and idle-owner assist; no DOM, Three.js, Canvas, audio or render-frame dependencies |
| `src/game/input/BrowserInputAdapter.js` | FO4 key lifecycle, immutable human commands and transient attack-intent signaling | Deployed bootstrap dispatches only to the live runtime and fails closed if authority is unavailable; callback injection remains isolated from production composition |
| `src/game/application/ApplicationRuntime.js` | Match lifecycle commands and navigation requests | Lifecycle requires live engine dispatch; navigation remains outside MatchEngine |
| `src/game/application/BrowserApplicationAdapter.js` | Browser buttons/events and immediate lifecycle UI projection | Listener lifecycle only; runtime target attachment belongs to the bootstrap composition |
| `src/game/presentation/CompatibilitySnapshotAdapter.js` | Mirrors immutable live-engine facts into temporary legacy presentation objects or creates isolated read-only compatibility snapshots | Browser mirror writes never become engine inputs; replay history is an outward-only temporary frame cache |
| `src/game/presentation/GoalPresentationFlow.js`, `GoalPresentationPhaseProjection.js` | Maps authoritative goal-phase events to announcement-card visibility, replay exposure and completion | Presentation consumes phases; preview timers are isolated fixtures and cannot start/end authoritative replay |
| `src/game/presentation/SnapshotRenderState.js` | Interpolates immutable player/ball transforms between fixed snapshots | Shared by WebGL and Canvas; presentation-only |
| `src/game/presentation/SnapshotCameraController.js`, `SnapshotReplayController.js` | Snapshot-driven camera and replay frame selection | Never mutate gameplay state; replay progress comes from engine snapshots |
| `src/game/presentation/HudSnapshotProjection.js`, `RadarSnapshotRenderer.js` | HUD facts and radar drawing from match snapshots | Presentation-only snapshot consumers |
| `src/game/presentation/BrowserGameEventBridge.js` | Projects immutable ordered game events to browser consumers | Event transport only |
| `src/game/core/SimulationLoop.js` | Connects fixed simulation updates to browser rendering | Fixed 60 Hz cadence with interpolation alpha |
| `tests/scenarios/ScenarioRunner.mjs` | Public-contract deterministic scenario execution, explicit target-tick scheduling, immutable capture and compact failure traces | Test infrastructure only; never reaches private engine state |
| `tests/tooling/browserGameplayAuthorityGuard.test.mjs` | Static deployed-entry and required-smoke authority guard | Fails if direct `game.js` loading, URL compatibility routing or required debug mutation fixtures return |
| `.github/workflows/ci.yml`, `.github/workflows/playwright-regression.yml` | Required fast validation/smoke gate and retained scheduled/manual broad browser evidence | Fast lane owns per-commit correctness; broad browser suite remains available outside the commit gate |
| `scripts/build-static.mjs`, `vercel.json` | Static build and deployment contract | Preserve Vercel and GitHub Pages compatibility |

## Browser runtime flow

```text
index.html → browser-entry.js engine-only URL guard
                         ↓
BrowserBootstrapComposition
  ├→ BrowserInputAdapter ─────────────┐
  ├→ BrowserApplicationAdapter        ├→ BrowserRuntimeComposition
  ├→ SimulationLoop start/stop/reset  ├→ BrowserMatchRuntime → MatchEngine at fixed 60 Hz
  ├→ CompatibilitySnapshotAdapter     │                    ├→ immutable previous/current snapshots
  └→ presentation feedback lifetime ──┘                    ├→ ordered gameplay events
                                                           └→ action intents

Natural goal → MatchEngine goal timeline
             → native-highlight → goal-card → score-card → replay → kickoff
             → phase/replay events and same-step snapshots

Snapshots → CompatibilitySnapshotAdapter outward projection
          → camera, replay frame cache, WebGL/Canvas transforms, HUD and radar
Events    → BrowserGameEventBridge → audio, particles and phase-driven overlays
```

The deployed browser has no compatibility runtime switch. Legacy mutable objects in
`game.js` are temporary presentation mirrors only: deployed fixed steps call the
presentation-only update path and never invoke legacy AI, physics, rules, clock or
lifecycle progression. Debug URL parameters are removed before module load, input
fails closed outside engine authority, and direct mirror writes are overwritten by the
next immutable engine snapshot without changing engine-owned state.

`BrowserInputAdapter` expresses a charged pass or shot as a transient immutable
`SET_ATTACK_INTENT` command pair. It sends `active: true` when charging starts and
`active: false` on normal release, control-mode cancellation, reset, blur and
detach. `MatchEngine` alone owns that intent and the selected-owner takeover
guard: idle grace accrues only while the selected player owns the ball, controls
are neutral and no human attack intent is active. Human commands reset the grace;
AI owner action may resume only after the grace expires. Input never mutates the
engine or AI systems directly.

Authoritative state flows outward. Scene nodes, Canvas coordinates, DOM values, CSS classes, animation mixers, audio and replay badges never become gameplay inputs.

## Subsystem ownership

| Subsystem | Source and owner | Focused validation | Direction |
| --- | --- | --- | --- |
| Fixed timestep and render cadence | `src/game/core/FixedClock.js`, `SimulationLoop.js` | `tests/simulation/`, ADR-001 | Retain fixed 60 Hz and interpolation |
| Browser bootstrap lifecycle | `BrowserBootstrapComposition.js` | `tests/application/browserBootstrapComposition.test.mjs` | One explicit owner attaches listeners/subscriptions, starts the loop and resets or tears all of them down |
| Browser runtime authority | `browser-entry.js`, `BrowserRuntimeComposition.js`, `BrowserMatchRuntime.js`, `MatchEngine.js` | entry/runtime authority guards and deterministic snapshot tests | One live MatchEngine owns browser commands/snapshots/events; no URL or application fallback can progress compatibility gameplay |
| Commands, events and snapshots | `src/game/engine/` | Engine contract, ordering and immutability tests | Plain serializable immutable contracts, including transient `SET_ATTACK_INTENT` and typed goal phases |
| Goal announcement, replay and kickoff | `GoalSequenceTimeline.js`, `MatchEngine.js` | measured-tick timeline, runtime event/snapshot agreement, natural-goal integration | Engine owns one ordered timeline; presentation only projects current phase/progress |
| Player movement and stamina | `PlayerMovementSystem.js`, gameplay/config modules | Engine simulation and locomotion tests | Engine authoritative; renderer consumes snapshots |
| Ball, possession and first touch | `BallSimulationSystem.js`, `BallControl.js`, `PossessionLifecycle.js` | Engine/gameplay tests | Engine authoritative; no renderer mutation |
| Passing, shooting, tackling and runs | `KickActionSystem.js`, `PlayerActionSystem.js` | Focused engine integration tests | Human/AI commands enter the same engine boundary |
| Match lifecycle, score, stats and clock | `MatchEngine.js`, `MatchState.js` | MatchEngine/application tests plus `tests/scenarios/` | Live snapshots supply browser facts; direct legacy mirror writes cannot alter them |
| FO4 keyboard mapping | `BrowserInputAdapter.js`, `FO4Controls.js` | `tests/input/`, browser controls flows | Immutable human commands; attack intent is always paired across release/cancellation paths |
| AI and goalkeeper behavior | `AIDecisionSystem.js`, `MatchEngine.js`, engine systems | Deterministic AI/engine tests | Engine-only decisions; MatchEngine gates selected-owner takeover behind neutral controls, no attack intent and expired idle grace |
| WebGL and models | `game.js`, `SnapshotRenderState.js`, assets | Asset validation and desktop Playwright | Presentation consumes snapshot poses |
| Canvas fallback | `game.js`, `SnapshotRenderState.js` | Engine-backed Canvas smoke and narrow Playwright | Same immutable snapshot transforms as WebGL |
| Camera, radar and HUD | presentation snapshot modules plus `game.js` DOM binding | presentation tests and browser flows | Read-only snapshot consumers |
| Audio, particles and overlays | browser event/presentation adapters | presentation tests and event browser flows | Ordered event/phase consumers |
| Main menu and setup navigation | application adapters and `BrowserBootstrapComposition` navigation callbacks | application and Playwright flows | Bootstrap reset boundary owns navigation cleanup; match lifecycle remains engine commands |
| Static deployment | `package.json`, `scripts/build-static.mjs`, `vercel.json` | build and deployment contracts | Preserve static hosting |

## Current migration bridges

These are temporary migration points, not patterns to copy:

- `game.js` still contains isolated legacy implementation helpers because renderer, DOM and settings extraction belongs to TON-64; deployed fixed steps have a tested zero-invocation boundary for those helpers.
- `CompatibilitySnapshotAdapter` mirrors immutable engine facts into legacy player/ball objects only where existing presentation implementations still read those objects.
- `CompatibilitySnapshotAdapter` / `SnapshotReplayController` retain an outward-only replay-frame cache, while engine replay phase/progress is the sole lifecycle clock.
- Browser presentation implementation extraction and removal of now-dead co-located helpers belongs to TON-64; new gameplay logic must never be added to `game.js`.

## Dependency rules

Engine and core modules may depend on pure JavaScript data/math, deterministic clocks/random sources, gameplay configuration and engine contracts. They must not depend on `window`, `document`, DOM, CSS, Three.js, Canvas, Web Audio, `requestAnimationFrame`, presentation modules or rendered values.

Browser composition may connect input, application, engine and presentation adapters. Presentation may consume engine contracts and read-only snapshots/events, but may not mutate engine-owned players, ball, score, statistics, clock, possession, AI decisions, goal phases, replay lifecycle or match lifecycle.

## Validation pyramid

- `npm run test:engine:fast` owns simulation, engine, gameplay, input/application contracts and deterministic scenarios.
- `npm run test:presentation:fast` owns pure snapshot/event/phase projection and presentation state.
- `npm run test:ci:fast` adds syntax, assets, tooling, authority guards and static build without installing a browser.
- `npm run test:e2e:smoke` proves WebGL/Canvas boot, live composition, input/application routing, snapshot/HUD projection and representative desktop/narrow wiring.
- `npm run test:e2e:broad` and the `Playwright Regression` workflow retain the full visual regression inventory for manual, scheduled, focused and release evidence.

Gameplay correctness never depends on Playwright. Browser tests never inject score/replay facts to prove engine rules. PO sampling is asynchronous and non-blocking unless an explicit `PO Gate Required` delivery decision exists.

## Test map

| Change type | Minimum validation |
| --- | --- |
| Browser bootstrap/composition lifecycle | focused bootstrap/runtime/snapshot reset and teardown tests, `test:ci:fast`, and minimal desktop/narrow smoke |
| Browser runtime authority | entry/runtime guards, direct-mirror-mutation isolation, deterministic snapshot parity, `test:ci:fast`, and minimal desktop/narrow smoke |
| Core clock or loop | simulation tests plus 30/60/120 FPS equivalence |
| Movement, ball or possession | focused gameplay/engine tests and deterministic reset coverage |
| Command, event or snapshot contract | headless contracts, ordering and immutability |
| Goal/replay timing contract | deterministic natural-goal engine scenario evidence, measured ticks, same-step snapshot/event agreement and synthetic presentation projection; browser visual evidence is focused/optional projection evidence |
| Three.js or model animation | asset validation, required WebGL/Canvas smoke, plus focused broad Playwright evidence |
| Canvas fallback | required engine-backed Canvas boot smoke plus heading/coordinate parity |
| HUD, camera or overlays | pure presentation tests; broad desktop/narrow Playwright for visual changes |
| Match lifecycle or replay | deterministic `tests/scenarios/` lifecycle/goal/replay/Full Time coverage; browser smoke proves only composition |
| Static build or assets | static build contract and preview smoke |

## Update checklist

Update this file when a pull request changes a runtime entry point, authoritative owner, compatibility bridge, dependency direction, command/event/snapshot contract, adapter location or focused validation path.