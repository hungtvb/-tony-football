# Development Rules

## Workflow
- One sprint equals one branch and one pull request.
- Pull latest `main` before implementation.
- Do not merge unless explicitly requested.
- Keep the game playable after every sprint.

## Architecture
- Simulation is authoritative; rendering is presentation only.
- Input produces commands.
- Do not add another major subsystem directly to `game.js`.
- Extract incrementally and externalize tuning configuration.

## Compatibility
Preserve WebGL, Canvas fallback, FO4 controls, model loading/fallback, replay, GitHub Pages, pitch, ball, weather, HUD, and match flow.

## Safety
Do not use destructive disk, filesystem, git-history, secret-printing, or credential-upload commands.

## Completion
Tests pass, manual validation is reported, documentation routing is checked, regressions are explained, and limitations are documented.