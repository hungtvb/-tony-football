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
| `index.html` | Browser shell, import map, HUD, menus and overlays | Presentation projection; never gameplay authority |
| `game.js` | Browser composition root, render implementations, DOM wiring and temporary compatibility shadow state | Compatibility update functions remain for parity and are removed only by TON-63 |
| `src/game/application/BrowserRuntimeComposition.js` | Selects live-engine or explicit compatibility mode, owns browser runtime configuration, routes fixed source ticks, lifecycle/input state and browser event publication | Default browser authority; `?runtime=compatibility` is the temporary fallback |
| `src/game/application/BrowserMatchRuntime.js` | Owns one `MatchEngine`, deterministic command scheduling, fixed steps, immutable snapshots, ordered events and action intents | Browser-facing authoritative runtime wrapper |
| `src/game/engine/` | MatchEngine lifecycle, state, movement, ball simulation, player actions, goalkeeper behavior, AI and selected-owner takeover guard | Headless authority; owns active human attack intent and idle-owner assist; no DOM, Three.js, Canvas, audio or render-frame dependencies |
| `src/game/input/BrowserInputAdapter.js` | FO4 key lifecycle, immutable human commands and transient attack-intent signaling | Sends paired `SET_ATTACK_INTENT` start/end commands across release and cancellation paths; legacy callback is compatibility-only |
| `src/game/application/ApplicationRuntime.js` | Match lifecycle commands and navigation requests | Routes gameplay lifecycle to live composition; navigation remains outside MatchEngine |
| `src/game/application/BrowserApplicationAdapter.js` | Browser buttons/events and immediate lifecycle UI projection | Attaches browser event target to live runtime composition |
| `src/game/presentation/CompatibilitySnapshotAdapter.js` | Selects live engine snapshots in browser, mirrors immutable facts to legacy presentation objects, or produces explicit compatibility snapshots | Live engine is default in browser; Node contract tests and query fallback retain compatibility mode |
| `src/game/presentation/SnapshotRenderState.js` | Interpolates immutable player/ball transforms between fixed snapshots | Shared by WebGL and Canvas; presentation-only |
| `src/game/presentation/SnapshotCameraController.js`, `SnapshotReplayController.js` | Snapshot-driven camera and replay presentation | Never mutate gameplay state |
| `src/game/presentation/HudSnapshotProjection.js`, `RadarSnapshotRenderer.js` | HUD facts and radar drawing from match snapshots | Presentation-only snapshot consumers |
| `src/game/presentation/BrowserGameEventBridge.js` | Projects immutable ordered game events to browser consumers | Event transport only |
| `src/game/core/SimulationLoop.js` | Connects fixed simulation updates to browser rendering | Fixed 60 Hz cadence with interpolation alpha |
| `scripts/build-static.mjs`, `vercel.json` | Static build and deployment contract | Preserve Vercel and GitHub Pages compatibility |

## Browser runtime flow

```text
FO4 keyboard ───────────────┐
Application lifecycle ──────┼→ BrowserRuntimeComposition
                            ├→ BrowserMatchRuntime → MatchEngine at fixed 60 Hz
Engine AI decisions ────────┘                    ├→ immutable previous/current snapshots
                                                  ├→ ordered gameplay events
                                                  └→ action intents

Snapshots → CompatibilitySnapshotAdapter live projection
          → camera, replay, WebGL/Canvas transforms, HUD and radar
Events    → BrowserGameEventBridge → audio, particles and overlays

Compatibility game.js update/state remains a temporary shadow for parity evidence.
It is not the default browser snapshot or command authority and is enabled as the
full fallback only with `?runtime=compatibility` until TON-63 removes it.
```

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
| Browser runtime authority | `BrowserRuntimeComposition.js`, `BrowserMatchRuntime.js`, `MatchEngine.js` | `tests/application/browserMatchRuntime.test.mjs`, `browserRuntimeComposition.test.mjs` | One live MatchEngine owns browser commands/snapshots/events |
| Commands, events and snapshots | `src/game/engine/` | Engine contract, ordering and immutability tests | Plain serializable immutable contracts, including transient `SET_ATTACK_INTENT` |
| Player movement and stamina | `PlayerMovementSystem.js`, gameplay/config modules | Engine simulation and locomotion tests | Engine authoritative; renderer consumes snapshots |
| Ball, possession and first touch | `BallSimulationSystem.js`, `BallControl.js`, `PossessionLifecycle.js` | Engine/gameplay tests | Engine authoritative; no renderer mutation |
| Passing, shooting, tackling and runs | `KickActionSystem.js`, `PlayerActionSystem.js` | Focused engine integration tests | Human/AI commands enter the same engine boundary |
| Match lifecycle, score, stats and clock | `MatchEngine.js`, `MatchState.js` | MatchEngine/application/browser tests | Live snapshots supply browser facts |
| FO4 keyboard mapping | `BrowserInputAdapter.js`, `FO4Controls.js` | `tests/input/`, browser controls flows | Immutable human commands; attack intent is always paired across release/cancellation paths |
| AI and goalkeeper behavior | `AIDecisionSystem.js`, `MatchEngine.js`, engine systems | Deterministic AI/engine tests | Engine-only decisions; MatchEngine gates selected-owner takeover behind neutral controls, no attack intent and expired idle grace |
| WebGL and models | `game.js`, `SnapshotRenderState.js`, assets | Asset validation and desktop Playwright | Presentation consumes snapshot poses |
| Canvas fallback | `game.js`, `SnapshotRenderState.js` | Canvas smoke and narrow Playwright | Same snapshot transforms as WebGL |
| Camera, radar and HUD | presentation snapshot modules plus `game.js` DOM binding | presentation tests and browser flows | Read-only snapshot consumers |
| Audio, particles and overlays | browser event/presentation adapters | presentation tests and event browser flows | Ordered event consumers |
| Main menu and setup navigation | application adapters and `game.js` navigation callbacks | application and Playwright flows | Outside MatchEngine; match lifecycle remains engine commands |
| Static deployment | `package.json`, `scripts/build-static.mjs`, `vercel.json` | build and deployment contracts | Preserve static hosting |

## Current migration bridges

These are temporary migration points, not patterns to copy:

- `game.js` still contains compatibility mutable gameplay/update functions, but live browser commands and snapshots bypass them by default.
- `CompatibilitySnapshotAdapter` mirrors immutable engine facts into legacy player/ball objects only where existing presentation implementations still read those objects.
- `?runtime=compatibility` keeps an explicit fallback for parity diagnosis; it must not become the normal path.
- Remaining compatibility ownership removal belongs to TON-63.
- Browser presentation implementation extraction belongs to TON-64.

## Dependency rules

Engine and core modules may depend on pure JavaScript data/math, deterministic clocks/random sources, gameplay configuration and engine contracts. They must not depend on `window`, `document`, DOM, CSS, Three.js, Canvas, Web Audio, `requestAnimationFrame`, presentation modules or rendered values.

Browser composition may connect input, application, engine and presentation adapters. Presentation may consume engine contracts and read-only snapshots/events, but may not mutate engine-owned players, ball, score, statistics, clock, possession, AI decisions or match lifecycle.

## Test map

| Change type | Minimum validation |
| --- | --- |
| Browser runtime authority | composition/runtime tests, deterministic snapshot parity, full unit suite and desktop/narrow Playwright |
| Core clock or loop | simulation tests plus 30/60/120 FPS equivalence |
| Movement, ball or possession | focused gameplay/engine tests and deterministic reset coverage |
| Command, event or snapshot contract | headless contracts, ordering and immutability |
| Three.js or model animation | asset validation, desktop Playwright and model fallback |
| Canvas fallback | Canvas smoke plus heading/coordinate parity |
| HUD, camera or overlays | presentation tests, desktop and narrow landscape |
| Match lifecycle or replay | headless lifecycle plus intro, pause, goal, replay and Full Time flows |
| Static build or assets | static build contract and preview smoke |

## Update checklist

Update this file when a pull request changes a runtime entry point, authoritative owner, compatibility bridge, dependency direction, command/event/snapshot contract, adapter location or focused validation path.
