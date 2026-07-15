# Active Sprint

```yaml
Sprint: G2
Title: Player Movement and Locomotion
Status: In Progress — Controlled Player Integrated
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/G2_PLAYER_MOVEMENT.md
Primary specs:
  - docs/gameplay/PLAYER_MOVEMENT.md
Delivered:
  - centralized locomotion configuration
  - pure deterministic locomotion helpers
  - normalized diagonal movement contract
  - fixed-step acceleration and stop damping tests
  - reversal grip and facing normalization tests
  - stamina drain and recovery tests
  - controlled-player integration through PlayerLocomotion
  - standard CI restored after guarded integration
Next:
  - AI moveToward compatibility
  - controlled-player tuning for acceleration and reversal feel
  - WebGL and Canvas orientation coherence
  - pause, kickoff, and player-switch regressions
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
