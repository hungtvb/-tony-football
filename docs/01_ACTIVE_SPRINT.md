# Active Sprint

```yaml
Sprint: G2
Title: Player Movement and Locomotion
Status: In Progress
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/G2_PLAYER_MOVEMENT.md
Primary specs:
  - docs/gameplay/PLAYER_MOVEMENT.md
Delivered:
  - centralized locomotion configuration
  - pure deterministic locomotion helpers
  - normalized diagonal input
  - controlled-player acceleration, reversal, stop damping, facing, sprint, and stamina integration
  - AI moveToward integration through shared target locomotion
  - fixed-step arrival and arrival-damping regression tests
Validation complete:
  - movement unit tests
  - controlled-player guarded integration
  - AI compatibility guarded integration
  - full repository npm test after each integration
Remaining:
  - tune acceleration, reversal, and sprint entry/exit feel
  - verify WebGL and Canvas orientation coherence
  - add pause, kickoff, and player-switch regressions
  - manual WebGL and Canvas fallback validation
Do not modify:
  - simulation timing
  - FO4 control mapping
  - ball physics or ownership rules
  - passing, shooting, tackle, or goalkeeper balance
  - AI decisions or team tactics
  - multiplayer or game modes
```

Only one sprint may be active at a time.
