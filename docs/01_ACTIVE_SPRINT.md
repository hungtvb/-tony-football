# Active Sprint

```yaml
Sprint: G3
Title: Ball Control and First Touch
Status: In Progress
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/G3_BALL_CONTROL_FIRST_TOUCH.md
Primary specs:
  - docs/gameplay/BALL_CONTROL.md
Goals:
  - make first touch depend on incoming ball speed, angle, height, and player movement
  - replace sticky possession with explicit capture, controlled, loose, and released states
  - keep dribble distance readable at walk, run, sprint, and precision pace
  - preserve deterministic fixed-step behavior
  - keep passing, shooting, tackle, goalkeeper, and AI-decision balance unchanged
Required validation:
  - possession-state unit tests
  - first-touch outcome tests
  - dribble-anchor distance tests
  - high-speed and aerial-ball rejection tests
  - kickoff, replay, player-switch, and pause/resume regressions
  - WebGL and Canvas fallback manual validation
Do not modify:
  - simulation timing
  - FO4 control mapping
  - pass and shot power balance
  - tackle success balance
  - goalkeeper decision logic
  - AI tactical decisions or formations
  - multiplayer or game modes
```

Only one sprint may be active at a time.
