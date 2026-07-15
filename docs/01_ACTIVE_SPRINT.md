# Active Sprint

```yaml
Sprint: G2
Title: Player Movement and Locomotion
Status: Implementation Complete — Manual Validation Pending
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
  - tuned acceleration, reversal, sprint entry, and sprint exit response
  - shared WebGL and Canvas heading adapters
  - kickoff, pause/resume, player-switch, and exhausted-sprint runtime contracts
Validation complete:
  - movement unit tests
  - fixed-step acceleration equivalence
  - AI arrival and arrival-damping regression tests
  - sprint transition and renderer heading tests
  - clean-branch full repository npm test
Remaining:
  - manual acceleration, stop, 90-degree, and 180-degree validation
  - manual sprint hold/release and low-stamina validation
  - manual marking and precision movement validation
  - manual WebGL and Canvas fallback orientation validation
  - desktop and narrow-layout browser validation
Do not modify:
  - simulation timing
  - FO4 control mapping
  - ball physics or ownership rules
  - passing, shooting, tackle, or goalkeeper balance
  - AI decisions or team tactics
  - multiplayer or game modes
```

Only one sprint may be active at a time.
