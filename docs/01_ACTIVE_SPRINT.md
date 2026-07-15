# Active Sprint

```yaml
Sprint: G3
Title: Ball Control and First Touch
Status: In Progress
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/G3_BALL_CONTROL_FIRST_TOUCH.md
Primary specs:
  - docs/gameplay/BALL_CONTROL.md
Delivered:
  - centralized ball-control configuration
  - pure capture, first-touch, and dribble-anchor policy module
  - capture eligibility integrated into loose-ball pickup
  - precision, normal, and sprint dribble anchors integrated into controlled-ball follow
  - legacy pickup radius, height, cooldown, and last-touch speed behavior preserved
  - guarded integration removed and standard CI restored
Validation complete:
  - capture lock and goalkeeper-range tests
  - last-touch recapture prevention
  - first-touch scoring and classification baselines
  - precision versus sprint dribble-anchor tests
  - runtime import and legacy-boundary integration contracts
Remaining:
  - add explicit possession lifecycle metadata
  - integrate clean, cushioned, heavy, and rejected first-touch outcomes
  - centralize release locks for pass, shot, tackle, and kickoff
  - preserve goalkeeper, replay, pass, shot, and tackle compatibility
  - manual WebGL and Canvas fallback validation
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
