---
name: game-engine
description: Design, debug, and review real-time game engine architecture, deterministic simulation, lifecycle, state ownership, events, boundaries, performance, and testability.
---

# Game Engine

Use for engine architecture, update loops, state ownership, simulation/render separation, shared contracts, replay foundations, lifecycle, or engine-level performance.

## Operating model

Keep ownership explicit:

1. Input adapters translate devices into commands.
2. Simulation advances authoritative state.
3. Snapshots/events expose immutable outputs.
4. Presentation renders without becoming authoritative.
5. Application composition owns create, start, pause, restore, rebind, and dispose.

DOM, Three.js objects, audio nodes, and wall-clock timers must not become authoritative game state.

## Core rules

- Use a fixed simulation step for authoritative mechanics.
- Render at display cadence; interpolate presentation only.
- Bound frame delta and accumulated backlog after stalls.
- Prefer commands into the engine and snapshots/events out.
- Keep randomness behind a seedable source.
- Make pause, restart, context restore, replay, and disposal first-class paths.
- Keep engine tests runnable without browser or renderer.
- Measure before optimizing.

## Workflow

1. Record authoritative owner, command source, update cadence, outputs, lifecycle owner, seed/configuration, and external inputs.
2. Reproduce at the lowest layer, preferably a deterministic headless test.
3. Test at least two causes: simulation defect, duplicate/stale ownership, or timing/lifecycle defect.
4. Fix the owner instead of synchronizing multiple owners.
5. Run focused tests, then the engine and CI gates.

For Tony Football:

```bash
npm run test:engine:fast
npm run test:ci:fast
```

Use browser tests for composition, context restore, replay presentation, or adapter wiring.

## Fixed-step checklist

- Constant simulation step.
- Wall-clock delta only feeds an accumulator.
- Bounded catch-up work.
- Commands sampled/queued at a defined tick boundary.
- Seeded randomness.
- Explicit numeric tolerances.
- Presentation cannot mutate simulation.
- Replay records every required external input.

## Lifecycle checklist

Verify bootstrap, match start, pause/resume, restart, route/menu transition, context loss/restore, renderer fallback/rebind, repeated mount, and final disposal. Count listeners, loops, timers, mixers, caches, and subscriptions before and after repeated cycles.

## Anti-patterns

- Variable-delta authoritative physics.
- Engine reading renderer or DOM state.
- Presentation events changing match truth.
- Multiple loops updating one system.
- Global mutable singleton state.
- Replay reconstructed from visuals.
- Partial reset logic.
- Sleep-only timing tests.

## Tony Football mapping

Read `docs/adr/ADR-001-FIXED-TIMESTEP.md`, `docs/adr/ADR-002-SIMULATION-RENDER-SEPARATION.md`, `src/game/core/SimulationLoop.js`, `src/game/engine/MatchEngine.js`, and application composition before engine changes.

## Evidence required

Report the exact owner and failure mechanism, deterministic reproduction, lifecycle/failure paths tested, validation commands and results, and remaining platform/performance risk.

## Primary references

- Three.js renderer loop: https://threejs.org/docs/pages/Renderer.html
- Unity execution order: https://docs.unity3d.com/Manual/execution-order.html
- Godot idle and physics processing: https://docs.godotengine.org/en/stable/tutorials/scripting/idle_and_physics_processing.html
- Fix Your Timestep: https://gafferongames.com/post/fix_your_timestep/
