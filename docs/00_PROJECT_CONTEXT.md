# Project Context

## Mission
Build Tony Football into a polished browser-based 6v6 football game with responsive controls, readable football behavior, strong AI, and a focused game UI.

## Current objective
Establish the R1 runtime boundary so authoritative gameplay can evolve independently from Three.js, Canvas, DOM presentation, and render frame rate while preserving current behavior.

## Current phase
R1 architecture gate before returning to G4, U4, U5, or major AI expansion.

## Completed
- G1 — Fixed Simulation Foundation
- G2 — Player Movement and Locomotion
- G3 — Ball Control and First Touch
- U1 — Match Experience and HUD Hierarchy
- U2 — Game Feel and Match Feedback
- U3.1 — Camera and HUD
- U3.2 — Match Flow and Pause Navigation
- U3.3 — Match Presentation

## Current sprint
R1 — Engine and Presentation Boundary.

## Priority order
1. Add browser input and application adapters without changing FO4 mappings
2. Validate browser commands against the headless gameplay baseline
3. Make renderers and presentation consume snapshots and events
4. Preserve WebGL and Canvas parity through compatibility bridges
5. Reduce `game.js` to explicit composition and bootstrap

## Explicitly out of scope
- Ball physics tuning
- Dribbling and first-touch tuning
- Passing, shooting, or tackle balance
- AI decision-making and team tactics
- FO4 control remapping
- Local or online multiplayer
- Additional game modes
- Tournament or career mode
- Backend services

## Existing product constraints
- Preserve FIFA Online 4-style keyboard controls.
- Preserve the fixed 60 Hz simulation foundation.
- Preserve WebGL rendering and Canvas 2D fallback.
- Preserve player-model and animation fallback behavior.
- Preserve static deployment compatibility on Vercel production and GitHub Pages unless deployment policy changes.
- Movement must remain deterministic for equal inputs and fixed timesteps.
- Presentation feedback must not modify simulation outcomes.
- Refactor incrementally rather than rewriting the game.
