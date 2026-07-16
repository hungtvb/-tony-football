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
- Browser game-event bridge for immutable score, replay, lifecycle, and match-ended presentation facts.
- Compatibility snapshot adapter plus pure HUD and radar snapshot consumers.
- Pure snapshot render-state interpolation shared by WebGL and Canvas entity transforms.
- Snapshot-driven camera framing and immutable 15 FPS replay playback controllers.
- Browser presentation feedback adapter for event-driven kick, tackle, goal, and match lifecycle audio/particle effects.

### Changed
- Linear now owns mutable roadmap, backlog, priority, dependency, ownership, delivery status, acceptance, and cross-role handoffs; repository planning documents are stable pointers and technical records only.
- AI workspace startup now begins from the assigned Linear `TON-x` handoff, correlates exact GitHub implementation evidence, and records durable updates after material events.
- Restricted-container bootstrap now initializes a verified local Git `main` baseline.
- New-session workflow now requires a GitHub and matching local delivery branch created from the latest `main`.
- Local workspaces can import a newer verified `main` snapshot and rebase committed delivery work without `git pull`.
- Playwright browser validation now uses deterministic local Three.js fixtures,
  single-worker WebGL execution, and state-history assertions instead of transient timing windows.
- Match intro and post-match navigation now request semantic application actions instead of synthetic button clicks.
- Goal and post-match presentation now consume explicit events instead of inferring gameplay facts from rendered DOM mutations.
- HUD match facts and radar markers now consume immutable fixed-tick snapshots in both WebGL and Canvas fallback paths.
- WebGL and Canvas player position, facing, locomotion pose, ball position, height, and rotation now consume one interpolated snapshot render state with reset/teleport guards.
- Camera framing and replay playback now consume immutable match snapshots; gameplay actions publish feedback events instead of calling audio or particle implementations directly.

### Fixed
- Generated workspace, browser-cache, and staging targets are canonicalized before mutation; traversal, symlink boundaries, approved roots, and overlapping or nested destinations are rejected.
- Local Playwright bootstrap now refuses existing Git or non-empty destinations even with `--force`, validates staged runtime/browser artifacts before publication, and directs existing workspaces to the safe sync flow.
- Future gameplay commands no longer execute before their declared `targetTick`.
- Start, restart, and post-goal kickoff frames no longer interpolate against pre-reset snapshots.
- Custom formations without a number 10 retain a valid home selection, and compatibility score events use stable snapshot player IDs.
- Compatibility kick producers now emit canonical command type, normalized power, world-unit speed, style, target, and velocity facts without engine-side legacy normalization.
- Compatibility kick events now capture the final action-specific ball velocity after chip, finesse, chipped-through, and loft adjustments.
- Presentation feedback skips particle callbacks when neither event data nor the active snapshot provides finite coordinates.
- Runtime and browser artifacts no longer try to restore the GitHub runner UID/GID or archived permissions when extracted in restricted containers.
- Prevented the post-match observer from reacting to its own overlay mutations and locking the browser main thread.
- Removed the narrow-landscape goal-presentation race around the short native-highlight stage.
- Made local Playwright artifact bootstrap portable across runner/container user IDs.

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
