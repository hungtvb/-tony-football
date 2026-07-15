# Project Context

## Mission
Build Tony Football into a polished browser-based 6v6 football game with responsive controls, readable football behavior, strong AI, and a focused game UI.

## Current objective
Improve player locomotion responsiveness, acceleration, turning, sprint transitions, facing direction, and animation coherence without changing FO4 control mapping, ball physics, passing/shooting balance, or AI decisions.

## Current phase
Phase 2 — Core Gameplay.

## Completed
- G1 — Fixed Simulation Foundation
- U1 — Match Experience and HUD Hierarchy
- U2 — Game Feel and Match Feedback

## Current sprint
G2 — Player Movement and Locomotion.

## Priority order
1. Input responsiveness and predictable acceleration
2. Natural deceleration and stop behavior
3. Turning radius and direction changes
4. Sprint entry, exit, and stamina readability
5. Facing direction and body orientation
6. Animation-state coherence in WebGL and Canvas fallback
7. AI-controlled player compatibility without AI decision changes
8. Deterministic, frame-rate-independent movement tests

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
- Preserve GitHub Pages deployment.
- Movement must remain deterministic for equal inputs and fixed timesteps.
- Presentation feedback must not modify simulation outcomes.
- Refactor incrementally rather than rewriting the game.
