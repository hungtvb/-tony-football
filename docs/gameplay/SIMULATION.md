# Simulation Specification

## Purpose

Provide stable, testable gameplay timing independent of render frame rate.

## Requirements

- Authoritative simulation runs at 60 Hz.
- Rendering remains independent from simulation timing.
- Large frame deltas are clamped.
- Substeps are capped to avoid a spiral of death.
- Core timing code has no DOM, Canvas, WebGL, or Three.js dependency.
- Seeded randomness is available for deterministic tests.

## Configuration

```js
{
  fixedDeltaSeconds: 1 / 60,
  maxSubSteps: 5,
  maxFrameDeltaSeconds: 0.1,
}
```

## Acceptance criteria

- 600 simulation ticks equal 10 seconds.
- 30, 60, and 120 FPS render schedules produce the same number of simulation ticks.
- Long inactive frames cannot cause unlimited catch-up work.
- Accumulator interpolation alpha remains in `[0, 1)`.
- The existing game loop is migrated without intentional gameplay tuning.
