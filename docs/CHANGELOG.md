# Changelog

## Unreleased

### Added
- U1 Match Experience and HUD Hierarchy specifications.
- HUD, pre-match, radar, controls, pause, and settings source-of-truth documents.
- R1 immutable game-command, ordered event, and read-only snapshot contracts.
- Headless engine dependency guardrails and focused contract tests.
- Headless match-state factory and MatchEngine lifecycle foundation with stable 6v6 entities.
- Headless fixed-step player movement and ball simulation systems with engine parity coverage.
- Headless kick, tackle, and teammate-run systems with seeded outcomes and explicit gameplay events.
- Deterministic headless goalkeeper and team AI decisions routed through engine commands.
- FO4 browser input adapter with immutable movement, pass, shot, tackle, sprint, shield, goalkeeper-rush, and team-press commands.
- Application runtime for explicit match lifecycle and setup/main-menu navigation actions.

### Changed
- Active sprint moved from G1 to U1.
- Roadmap now includes U2 Game Feel after U1.
- U3.1, U3.2, and U3.3 are closed; R1 Engine and Presentation Boundary is active.
- Playwright browser validation now uses deterministic local Three.js fixtures,
  single-worker WebGL execution, and state-history assertions instead of transient timing windows.
- Match intro and post-match navigation now request semantic application actions instead of synthetic button clicks.

### Fixed
- Prevented the post-match observer from reacting to its own overlay mutations and locking the browser main thread.
- Removed the narrow-landscape goal-presentation race around the short native-highlight stage.

## G1 — Fixed Simulation Foundation

### Added
- Fixed 60 Hz simulation clock.
- Simulation loop adapter with render interpolation alpha.
- Seeded random utility and simulation configuration.
- Headless simulation tests and pull-request CI.

### Changed
- Gameplay updates are now independent from browser render FPS.

### Documentation
- Added AI Workspace v5 structure for Codex and Antigravity.
