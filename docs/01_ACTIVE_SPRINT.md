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
  - deterministic capture eligibility and first-touch scoring
  - explicit loose, receiving, controlled, and released possession lifecycle
  - clean, cushioned, heavy, and rejected first-touch outcomes
  - cushioned residual velocity and loose-ball recapture locks
  - precision, normal, and sprint dribble anchors
  - replay owner identity and possession snapshots
  - standard read-only CI with migration scripts removed
Validation complete:
  - capture lock, height, goalkeeper range, cooldown, and last-touch tests
  - first-touch score, classification, and four outcome tests
  - possession lifecycle and kickoff reset tests
  - replay possession and cushioned-velocity regression contracts
  - clean-branch full repository npm test
Remaining:
  - manual slow, fast, aerial, awkward-angle, precision, and sprint reception validation
  - manual goalkeeper pickup and distribution validation
  - manual buffered action, player switching, and post-tackle recovery validation
  - manual replay, WebGL, Canvas fallback, desktop, and narrow-layout validation
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
