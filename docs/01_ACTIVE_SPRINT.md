# Active Sprint

```yaml
Sprint: G3
Title: Ball Control and First Touch
Status: Implementation Complete — Manual Validation Pending
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/G3_BALL_CONTROL_FIRST_TOUCH.md
Primary specs:
  - docs/gameplay/BALL_CONTROL.md
Delivered:
  - centralized ball-control configuration
  - deterministic capture, first-touch, dribble-anchor, and possession lifecycle modules
  - capture eligibility integrated into loose-ball pickup
  - explicit loose, receiving, controlled, and released lifecycle metadata
  - clean, cushioned, heavy, and rejected first-touch outcomes
  - cushioned touches retain controlled residual velocity
  - heavy and rejected touches remain loose with recapture locks
  - precision, normal, and sprint dribble anchors
  - pass, shot, loft, tackle, goal, and kickoff lifecycle transitions
  - replay frames include owner identity and possession snapshot
  - standard read-only CI restored and migration scripts removed
Validation complete:
  - capture lock and goalkeeper-range tests
  - last-touch recapture prevention
  - first-touch scoring, classification, and outcome tests
  - possession lifecycle transition tests
  - precision versus sprint dribble-anchor tests
  - runtime integration and legacy-boundary contracts
  - clean-branch full repository npm test pending latest head
Remaining:
  - manual slow/fast/aerial/sprint/precision reception validation
  - manual goalkeeper, buffered-action, player-switch, and tackle recovery validation
  - replay, WebGL, Canvas fallback, desktop, and narrow-layout validation
Do not modify:
  - simulation timing
  - FO4 control mapping
  - pass or shot power balance
  - tackle success probability
  - goalkeeper decisions
  - AI tactics or formations
  - multiplayer or game modes
```

Only one sprint may be active at a time.
