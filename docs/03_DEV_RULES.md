# Development Rules

## Workflow

- Linear is the mutable source for task selection, priority, ownership, dependencies, delivery status, acceptance, and cross-role handoffs.
- GitHub is the source for implementation evidence: issues, branches, commits, pull requests, reviews, CI, and merge state.
- Repository docs are the persistent source for stable technical contracts, not mutable delivery status.
- One `TON-x` delivery item equals one GitHub issue, one branch containing `ton-x`, and one pull request starting with `[TON-x]`.
- At session start, read the latest Linear handoff, verify ownership, and detect branch/file collisions before editing.
- Fetch the latest GitHub `main` SHA and create the remote branch directly from that SHA.
- Create the matching local branch from the verified local `main` snapshot before modifying files.
- Never implement delivery work directly on `main`.
- When GitHub `main` moves, commit current work, import the new verified runtime snapshot into local `main`, then rebase the delivery branch.
- After every material push, review, blocker, merge, or acceptance event, record exact GitHub evidence and the next owner in Linear.
- Chat-only information is not considered communicated.
- Do not merge unless explicitly requested by the Product Owner.
- Keep the game playable after every delivery item.

## Architecture

- Simulation is authoritative; rendering is presentation only.
- Input produces commands.
- Do not add another major subsystem directly to `game.js`.
- Extract incrementally and externalize tuning configuration.

## Compatibility

Preserve WebGL, Canvas fallback, FO4 controls, model loading/fallback, replay, GitHub Pages, pitch, ball, weather, HUD, and match flow unless the assigned Linear issue explicitly changes an approved contract.

## Safety

- Do not use destructive disk, filesystem, git-history, secret-printing, or credential-upload commands.
- `bootstrap-local-playwright.sh` creates a new workspace only and must never target a destination containing `.git`.
- Use `scripts/sync-local-main.sh` from an existing bootstrapped Git workspace; destructive reset requires a separate reviewed recovery flow.
- Publish changes through GitHub file APIs or an atomic blob/tree/commit/ref update; do not create a write-enabled workflow to transport patches.

## Completion

Tests pass, manual validation is reported, documentation routing is checked, regressions and limitations are documented, exact-head CI/review freshness is verified, and the next owner is handed off in Linear.
