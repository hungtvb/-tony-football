# Active Sprint

```yaml
Sprint: G2
Title: Player Movement and Locomotion
Status: In Progress
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/G2_PLAYER_MOVEMENT.md
Primary specs:
  - docs/gameplay/PLAYER_MOVEMENT.md
Goals:
  - responsive input without instant velocity snapping
  - predictable acceleration and deceleration
  - natural turns and reversals
  - coherent sprint entry and exit
  - stable facing direction and model orientation
  - matching WebGL and Canvas fallback behavior
  - deterministic movement at fixed 60 Hz
Required validation:
  - movement unit tests
  - 30/60/120 FPS equivalence through the fixed simulation loop
  - keyboard direction and diagonal-input tests
  - sprint and stamina transition tests
  - pause/resume and kickoff reset regression tests
  - WebGL and Canvas fallback manual validation
Do not modify:
  - simulation timing
  - FO4 control mapping
  - ball physics or ownership rules
  - passing, shooting, tackle, or goalkeeper balance
  - AI decisions or team tactics
  - multiplayer or game modes
```

Only one sprint may be active at a time.
