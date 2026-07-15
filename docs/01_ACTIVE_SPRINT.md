# Active Sprint

```yaml
Sprint: U3.3
Title: Match Presentation
Status: Implementation — Match Intro Foundation
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/U3_3_MATCH_PRESENTATION.md
Primary goals:
  - transition from Match Setup into gameplay through a broadcast VS screen
  - reflect selected difficulty, pitch, ball, and weather
  - run a deterministic 3 · 2 · 1 countdown and Kick Off stage
  - keep gameplay input locked until native match initialization
  - preserve immediate Restart and Play Again behavior
Architecture:
  - presentation state machine remains separate from simulation state
  - MatchIntroFlow captures only the initial Start action
  - game.js remains owner of reset, whistle, clock, kickoff, and simulation
Validation required:
  - state transition unit tests
  - runtime integration contracts
  - desktop Playwright flow
  - narrow-landscape Playwright flow
  - existing camera, HUD, pause, replay, and static-deploy tests
Do not modify:
  - simulation timing
  - movement, possession, pass, shot, tackle, or goalkeeper balance
  - FO4 control mapping
  - AI tactics or formations
  - Main Menu and Match Setup destination semantics
Next slices:
  - goal presentation and replay polish
  - result screen and match statistics
```

Only one sprint may be active at a time.
