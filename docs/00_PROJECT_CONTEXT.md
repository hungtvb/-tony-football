# Project Context

## Mission
Build Tony Football into a polished browser-based 6v6 football game with responsive controls, readable football behavior, strong AI, and a focused game UI.

## Current objective
Close U3.3 with an integrated browser audit, then establish the approved R1 runtime boundary so authoritative gameplay can evolve independently from Three.js, Canvas, DOM presentation, and render frame rate.

## Current phase
Phase 4 — Expanded UI/UX, followed by the R1 architecture gate before G4, U4, U5, or major AI expansion.

## Completed
- G1 — Fixed Simulation Foundation
- G2 — Player Movement and Locomotion
- G3 — Ball Control and First Touch
- U1 — Match Experience and HUD Hierarchy
- U2 — Game Feel and Match Feedback
- U3.2 — Match Flow and Pause Navigation

## Current sprint
U3.3 — Match Presentation closeout.

## Priority order
1. Complete the integrated U3 browser audit across intro, goal, replay, pause, and post-match flows
2. Verify desktop, narrow-landscape, WebGL, and Canvas fallback behavior
3. Close U3.3 documentation and regression evidence
4. Activate R1 — Engine and Presentation Boundary as the next architecture sprint
5. Preserve deterministic gameplay and visual parity throughout the R1 migration

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
