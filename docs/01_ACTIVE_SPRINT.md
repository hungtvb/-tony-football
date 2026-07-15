# Active Sprint

```yaml
Sprint: U3.3
Title: Match Presentation
Status: Closeout — implementation merged and production deployed; integrated browser audit pending
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/U3_3_MATCH_PRESENTATION.md
Primary goals:
  - replace the single-action Full Time card with a complete post-match decision hub
  - present win, draw, or loss copy from the native final score
  - surface possession, shots, and Tony FC pass accuracy from existing match statistics
  - provide Play Again, Match Setup, and Main Menu actions without duplicating reset logic
  - preserve selected difficulty, pitch, ball, and weather when playing again
  - support desktop, narrow-landscape, keyboard focus, and reduced motion
Architecture:
  - PostMatchSummary is a pure model that normalizes final score and statistics
  - PostMatchHub enhances the existing result DOM and observes the native result overlay
  - hidden pause actions remain the single bridge into game.js setup and main-menu reset behavior
  - game.js remains owner of match time, final score, statistics, endMatch, reset, and startMatch
Validation required:
  - post-match summary unit tests for win, draw, loss, and invalid values
  - desktop and narrow-landscape Playwright result flow
  - Play Again retains current match setup and begins immediately
  - Match Setup and Main Menu actions expose only one overlay surface
  - existing intro, goal, camera, HUD, pause, replay, and static-deploy tests
Do not modify:
  - match duration or end-match timing
  - score or statistics ownership
  - simulation timing
  - movement, possession, pass, shot, tackle, or goalkeeper balance
  - FO4 control mapping
Next slices:
  - U3 integrated browser audit and closeout
  - activate R1 Engine and Presentation Boundary after U3 closeout
```

Only one sprint may be active at a time.
