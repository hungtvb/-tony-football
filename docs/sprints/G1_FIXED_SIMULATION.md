# Sprint G1 — Fixed Simulation Foundation

Status: In Progress

## Goal

Separate authoritative simulation timing from browser render timing while preserving existing gameplay behavior.

## Branch

`refactor/gameplay-g1-fixed-simulation`

## Scope

- Add a DOM-free `FixedClock`.
- Add foundational simulation configuration.
- Add seeded random utility for future deterministic systems.
- Add headless timing tests.
- Integrate the current `update(dt)` flow into the fixed clock.

## Out of scope

- Gameplay tuning.
- AI behavior changes.
- UI redesign.
- Control changes.
- Models or animations.
- Multiplayer and additional modes.

## Automated tests

- 600 ticks equal 10 seconds.
- 30, 60, and 120 FPS schedules produce 60 simulation updates per second.
- Large frame deltas are clamped.
- Maximum substeps are respected.
- Accumulator remains stable.
- Seeded random sequences repeat.

## Current implementation status

Completed:
- Fixed clock module.
- Seeded random utility.
- Simulation configuration.
- Headless tests.
- Test command wiring.

Remaining before sprint completion:
- Safely adapt the existing monolithic `game.js` requestAnimationFrame loop to call the fixed clock.
- Run the complete repository test suite and manual gameplay checklist.

## Manual validation required

- Start and finish a match.
- Move, sprint, pass, through pass, shoot, finesse, and chip.
- Switch player and defend.
- Score and view replay.
- Pause and resume.
- Verify WebGL and Canvas fallback.
- Verify model and animation fallback.
