# Source Map

## Purpose

This document is the operational index for humans and AI agents navigating Tony Football. It maps a question or subsystem to its current source of truth, runtime owner, tests, and planned R1 destination.

Keep this map stable and query-friendly:

- describe ownership and contracts rather than implementation details
- do not use line numbers
- do not list every helper when a subsystem entry is enough
- update the map in the same pull request when ownership, entry points, or dependency direction changes

## Read path

Before modifying code:

1. Read `docs/00_PROJECT_CONTEXT.md` and `docs/01_ACTIVE_SPRINT.md`.
2. Read the active sprint document.
3. Find the subsystem in this source map.
4. Read its specification, ADR, implementation, and focused tests.
5. Use `rg` on the exported symbol or runtime event before widening the search.

## Runtime entry points

| Entry point | Current responsibility | Notes |
| --- | --- | --- |
| `index.html` | Browser shell, import map, HUD and overlay DOM | Presentation projection; not gameplay authority |
| `game.js` | Current composition root plus authoritative match state, simulation updates, input, rendering, replay, audio, DOM and debug wiring | Primary R1 extraction target |
| `src/game/engine/` | R1 command, event, and snapshot contracts | Headless only; no DOM, Three.js, Canvas, audio, or render-frame dependencies |
| `src/game/core/SimulationLoop.js` | Connects fixed simulation updates to browser rendering | Uses `FixedClock`; exposes interpolation alpha |
| `scripts/dev-server.mjs` | Local static development server | Development only; never the Vercel production entry point |
| `scripts/build-static.mjs` | Produces the static `dist` bundle | Vercel publishes `dist` |
| `vercel.json` | Vercel static build contract | Framework preset disabled intentionally |

## Runtime data flow

### Current

```text
Browser input ─┐
AI decisions ──┼→ game.js state/update → Three.js / Canvas / radar / DOM / audio
DOM observers ─┘                         ↘ replay and presentation bridges
```

### R1 target

```text
Browser input → Commands ─┐
AI decisions → Commands ──┼→ MatchEngine at fixed 60 Hz
                          ├→ Read-only previous/current snapshots → renderers, radar and HUD
                          └→ Ordered gameplay events → animation, audio and overlays
```

Authoritative state flows outward. Scene nodes, Canvas coordinates, DOM values, CSS classes, animation mixers, audio, and replay badges never become gameplay inputs.

## Subsystem ownership

| Question or subsystem | Current source | Current owner | Focused tests/specification | R1 direction |
| --- | --- | --- | --- | --- |
| Fixed timestep and render cadence | `src/game/core/FixedClock.js`, `src/game/core/SimulationLoop.js` | Core | `tests/simulation/`, `docs/gameplay/SIMULATION.md`, ADR-001 | Retain unchanged; `MatchEngine` consumes fixed ticks |
| Commands, events and snapshots | `src/game/engine/` | Engine contracts | `tests/engine/`, R1 sprint document, ADR-002 | Slice A foundation; runtime adapters consume these contracts in later slices |
| Deterministic randomness | `src/game/core/Random.js` | Core | `tests/simulation/` | Engine-only service with no browser dependency |
| Gameplay tuning | `src/game/config/gameplayConfig.js` | Config | Simulation and gameplay contracts | Inject into engine; never read from renderer |
| Player movement, facing and stamina | `src/game/gameplay/PlayerLocomotion.js`, `src/game/config/locomotionConfig.js`, `game.js` | Shared helper plus `game.js` | `tests/gameplay/playerLocomotion.test.mjs`, `docs/gameplay/PLAYER_MOVEMENT.md` | Engine owns position/facing/action; renderer maps them to transforms and animation |
| Ball control and first touch | `src/game/gameplay/BallControl.js`, `src/game/gameplay/PossessionLifecycle.js`, `src/game/config/ballControlConfig.js`, `game.js` | Shared helper plus `game.js` | `tests/gameplay/ballControl.test.mjs`, `tests/gameplay/possessionLifecycle.test.mjs`, `docs/gameplay/BALL_CONTROL.md` | Engine owns ball and possession lifecycle |
| Match lifecycle, score, statistics and clock | `game.js` | `game.js` | Presentation contracts and Playwright match flows | Move to headless `MatchEngine`; publish lifecycle and score events |
| FO4 keyboard mapping and action buffering | `game.js`, `docs/ui/CONTROLS.md` | `game.js` browser listeners | Gameplay contracts and Playwright controls flow | Browser input adapter produces immutable commands |
| AI decisions and goalkeeper behavior | `game.js` | `game.js` | Existing gameplay and visual scenarios | AI produces commands; engine applies outcomes |
| Replay recording and playback | `game.js` | `game.js` | Replay presentation contracts | Engine owns replay facts; presentation owns playback projection |
| WebGL scene, assets and model animation | `game.js`, `assets/models/` | Presentation inside `game.js` | Asset validation, desktop Playwright, `assets/models/README.md` | Extract Three.js renderer consuming snapshots/events |
| Canvas 2D fallback | `game.js` | Presentation inside `game.js` | Canvas smoke path and browser validation | Extract Canvas renderer using the same snapshots |
| Camera and radar | `src/game/presentation/CameraFraming.js`, `src/game/config/cameraHudConfig.js`, `game.js` | Presentation | `tests/presentation/cameraFraming.test.mjs`, `docs/ui/CAMERA_HUD.md`, U3.1 sprint | Consume snapshots only; never affect simulation |
| Game feel, particles, trails and audio | `src/game/presentation/`, `game.js` | Presentation | `tests/presentation/`, `docs/ui/GAME_FEEL.md` | Consume ordered gameplay events and snapshots |
| Main menu, intro, goal and result flows | `src/game/presentation/MainMenuFlow.js`, `MatchIntroFlow.js`, `GoalPresentationFlow.js`, `PostMatchHub.js` | Presentation with DOM bridges | `tests/presentation/`, U3.2/U3.3 sprint docs, Playwright | Explicit initialization and application commands; remove authoritative DOM inference |
| Presentation state machines | `src/game/state/` | Presentation state | `tests/presentation/` | Remain presentation-only and event-driven |
| Static deployment | `package.json`, `scripts/build-static.mjs`, `vercel.json` | Build system | `tests/presentation/staticDeployment.test.mjs` | Preserve; add preview asset smoke validation |

## Current compatibility bridges

These are known migration points, not patterns to copy:

- `game.js` contains both authoritative state and visual objects in one closure.
- goal presentation observes rendered score DOM through `MutationObserver`.
- post-match presentation observes the result overlay and reads rendered statistics.
- some navigation paths delegate through synthetic `.click()` calls.
- presentation modules rely partly on import-time side effects.
- WebGL, Canvas fallback, radar, HUD and replay read mutable runtime objects directly.

R1 removes each bridge only after an equivalent command, event, snapshot, and regression test exists.

## Dependency rules

### Engine-safe dependencies

Engine and core modules may depend on:

- pure JavaScript data and math
- gameplay/config modules
- deterministic clocks and random sources
- command, event and snapshot contracts

They must not depend on:

- `three` or GLTF loaders
- `window`, `document`, DOM nodes or CSS classes
- Canvas contexts
- Web Audio
- `requestAnimationFrame`
- presentation modules or rendered DOM values

### Presentation dependencies

Presentation may depend on engine contracts and read-only snapshots. It may request application commands, but it may not mutate engine-owned players, ball, score, statistics, clock, possession, AI decisions, or match lifecycle.

## Test map

| Change type | Minimum validation |
| --- | --- |
| Core clock or loop | `tests/simulation/` plus 30/60/120 FPS equivalence |
| Movement, ball or possession | Focused `tests/gameplay/` plus deterministic reset coverage |
| Command, event or snapshot contract | Headless contract tests plus event ordering and immutability |
| Three.js or model animation | Asset validation, desktop Playwright and model fallback check |
| Canvas fallback | Canvas smoke flow plus heading/coordinate parity |
| HUD, camera or overlays | `tests/presentation/`, desktop and narrow-landscape Playwright |
| Match lifecycle or replay | Headless lifecycle tests plus intro, pause, goal, replay and Full Time browser flows |
| Static build or assets | Static deployment contract plus Vercel Preview HTTP smoke checks |

## Update checklist

Update this file when a pull request:

- adds, removes, or renames a runtime entry point
- moves authoritative state or subsystem ownership
- introduces or removes a compatibility bridge
- changes dependency direction
- adds a command, event, snapshot, renderer, or application adapter
- relocates focused tests or specifications

The pull request documentation declaration must include `source map` when one of these conditions applies.
