# G3 — Ball Control and First Touch

## Objective
Make receiving and carrying the ball readable, deterministic, and skill-sensitive without changing passing, shooting, tackle, goalkeeper, control mapping, or AI tactical balance.

## Player problem
The current runtime treats possession as a nullable `ball.owner`. Loose-ball pickup, first contact, controlled-ball positioning, release locks, and recapture prevention are spread through `game.js`. This makes the ball feel attached to the player and leaves no explicit first-touch outcome.

## Scope
- Define deterministic capture eligibility.
- Introduce explicit possession lifecycle metadata.
- Evaluate first-touch quality from incoming speed, angle, height, player movement, rating, precision input, and sprint state.
- Support clean, cushioned, heavy, and rejected touches.
- Centralize precision, normal, and sprint dribble anchors.
- Preserve pass, shot, tackle, goalkeeper, kickoff, replay, WebGL, and Canvas compatibility.
- Add release locks that prevent instant recapture.

## Out of scope
- Pass target selection or power tuning.
- Shot accuracy, curve, or power tuning.
- Tackle probability or physical-contest redesign.
- Goalkeeper decision changes.
- AI tactical changes, formations, multiplayer, skill moves, and game modes.

## Implementation progress

### G3.1 — Ownership and release audit — Complete
- Audited all writes to `ball.owner`, `ball.lock`, ball position, velocity, height, and last touch.
- Confirmed current pickup rules: lock, cooldown, radius, height, and last-touch speed block.
- Confirmed current dribble anchor is calculated inside `updateBall`.

### G3.2 — Pure policy module — Complete
- Added centralized `ballControlConfig`.
- Added pure `captureEligibility`, `firstTouchScore`, `classifyFirstTouch`, and `dribbleAnchor` helpers.
- Added baseline tests for lock, goalkeeper range, last-touch recapture prevention, precision bonus, sprint penalty, and anchor distance.

### G3.3 — Behavior-preserving runtime integration — Complete
- Integrated `captureEligibility` into loose-ball pickup.
- Integrated precision, normal, and sprint `dribbleAnchor` modes into controlled-ball follow.
- Preserved legacy pickup boundaries and legacy precision/normal anchor values.
- Removed guarded migration and restored standard CI.

### G3.4 — Possession lifecycle — Next
- Add explicit `loose`, `receiving`, `controlled`, and `released` metadata.
- Keep `ball.owner` compatibility while migrating runtime decisions.
- Ensure kickoff, goal, tackle, pass, shot, and goalkeeper flows set consistent state.

### G3.5 — First-touch outcomes — Planned
- Calculate touch quality at capture time.
- Clean: immediate stable control.
- Cushioned: short settle window and reduced carry distance.
- Heavy: ball remains loose ahead of receiver with a short recapture lock.
- Rejected: receiver fails to establish possession.
- Keep outcomes deterministic and fixed-step safe.

### G3.6 — Release contracts and validation — Planned
- Centralize pass, shot, tackle, and kickoff lock durations.
- Verify buffered actions, replay capture, WebGL, Canvas fallback, goalkeeper pickup, and player switching.
- Complete manual browser validation.

## Acceptance criteria
- Locked balls cannot be captured.
- Goalkeepers retain their larger catch radius and height allowance.
- Last-touch high-speed recapture prevention remains intact.
- Precision control keeps the ball closer than normal control.
- Sprint control pushes the ball farther than normal control.
- First-touch quality responds consistently to speed, angle, height, player movement, rating, precision, and sprinting.
- Pass, shot, tackle, goalkeeper, kickoff, replay, and controls behavior remain compatible.
- CI passes on a clean branch.

## Current status
Capture and dribble-anchor policies are integrated with legacy behavior preserved. Explicit possession lifecycle and first-touch outcomes remain to be implemented. PR must remain Draft.
