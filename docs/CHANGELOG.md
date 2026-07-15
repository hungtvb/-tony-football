# Changelog

## Unreleased

### Added
- U1 Match Experience and HUD Hierarchy specifications.
- HUD, pre-match, radar, controls, pause, and settings source-of-truth documents.

### Changed
- Active sprint moved from G1 to U1.
- Roadmap now includes U2 Game Feel after U1.
- Playwright browser validation now uses deterministic local Three.js fixtures,
  single-worker WebGL execution, and state-history assertions instead of transient timing windows.

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
