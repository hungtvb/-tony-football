# Sprint G1 — Fixed Simulation Foundation

Status: In Progress — implementation complete, manual gameplay validation pending

## Goal

Separate simulation timing from rendering while preserving current gameplay behavior.

## Implemented

- `src/game/core/FixedClock.js`
- `src/game/core/SimulationLoop.js`
- `src/game/core/Random.js`
- `src/game/config/gameplayConfig.js`
- fixed-step integration in `game.js`
- headless clock, loop, and deterministic RNG tests
- pull-request CI workflow

## Runtime design

- Simulation runs at 60 Hz.
- Rendering remains tied to browser animation frames.
- Large frame deltas are clamped.
- Maximum substeps prevent a spiral of death.
- Remaining accumulator time is exposed as render interpolation alpha.
- Current rendering does not yet interpolate entity transforms; alpha is available for a later sprint.

## Constraints respected

- No intentional gameplay tuning.
- No UI redesign.
- No control changes.
- No multiplayer or game-mode work.
- WebGL and Canvas code paths remain unchanged.
- No full `game.js` rewrite.

## Automated validation

Covered by `npm test`:

- syntax check for `game.js` and `server.mjs`
- asset validation
- 30, 60, and 120 FPS fixed update behavior
- large delta clamp
- maximum substeps
- floating-point accumulator normalization
- deterministic seeded random
- one render per browser frame
- idempotent loop start
- safe loop stop
- interpolation alpha delivery

## Manual validation pending

- start match
- movement and sprint
- passing, through pass, loft pass, and shooting
- defending and switching player
- pause and resume
- goal and replay
- full-time flow
- WebGL renderer
- Canvas fallback
- player model and animation fallback

## Definition of Done

G1 is ready to merge after CI passes and the manual checklist is completed without a major regression.
