# Development Rules

## Workflow
- Repository docs are the persistent workflow memory across chat sessions.
- One sprint equals one branch and one pull request.
- At sprint start, fetch the latest GitHub `main` SHA and create the remote sprint branch directly from that SHA.
- Create the matching local sprint branch from the verified local `main` snapshot before modifying files.
- Never implement sprint work directly on `main`.
- When GitHub `main` moves during a sprint, commit current work, import the new verified runtime snapshot into local `main`, then rebase the sprint branch.
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