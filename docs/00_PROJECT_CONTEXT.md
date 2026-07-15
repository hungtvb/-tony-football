# Project Context

## Mission
Build Tony Football into a polished browser-based 6v6 football game with responsive controls, readable football behavior, strong AI, and a focused game UI.

## Current objective
Improve moment-to-moment game feel without changing football rules, control mapping, AI decisions, or core movement and ball tuning.

## Current phase
Phase 1 — Foundation and presentation quality.

## Completed
- G1 — Fixed Simulation Foundation
- U1 — Match Experience and HUD Hierarchy

## Current sprint
U2 — Game Feel and Match Feedback.

## Priority order
1. Camera readability and smoothness
2. Ball and impact feedback
3. Goal and replay presentation
4. Audio feedback
5. Weather-aware particles
6. Reduced-motion and low-power fallbacks
7. Stable performance

## Explicitly out of scope
- Player locomotion tuning
- Ball physics tuning
- Passing, shooting, or tackle balance
- AI behavior changes
- FO4 control remapping
- Local or online multiplayer
- Additional game modes
- Tournament or career mode
- Backend services

## Existing product constraints
- Preserve FIFA Online 4-style keyboard controls.
- Preserve WebGL rendering.
- Preserve Canvas 2D fallback.
- Preserve player-model and animation fallback behavior.
- Preserve GitHub Pages deployment.
- Respect `prefers-reduced-motion` and low-power-device fallbacks.
- Effects must improve feedback without obscuring the ball, players, radar, score, or controls.
- Refactor incrementally rather than rewriting the game.
