# Active Sprint

```yaml
Sprint: U3.3
Title: Match Presentation
Status: Implementation — Goal Presentation and Replay Polish
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/U3_3_MATCH_PRESENTATION.md
Primary goals:
  - detect confirmed score changes without moving score ownership out of game.js
  - present a broadcast Goal → Score → Replay sequence
  - reflect scoring team and live scoreline
  - keep controls, goal delay, replay buffer, and kickoff behavior unchanged
  - support desktop, narrow-landscape, and reduced-motion presentation
Architecture:
  - GoalPresentationFlow observes score DOM changes only while body flow is match
  - GoalPresentationState owns presentation stages independently from simulation state
  - game.js remains owner of goals, score, scorer animation, replay frames, and kickoff
  - deterministic preview and hold hooks exist only for browser validation
Validation required:
  - goal presentation state transition unit tests
  - runtime ownership and stylesheet contracts
  - desktop Playwright goal flow
  - narrow-landscape Playwright goal flow
  - existing intro, camera, HUD, pause, replay, and static-deploy tests
Do not modify:
  - goal detection thresholds or goal sequence duration
  - replay recording duration, frame rate, or playback calculation
  - simulation timing
  - movement, possession, pass, shot, tackle, or goalkeeper balance
  - FO4 control mapping
Next slices:
  - result screen and match statistics
```

Only one sprint may be active at a time.
