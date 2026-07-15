# G3 — Ball Control and First Touch

## Objective
Make receiving and carrying the ball readable, deterministic, and skill-sensitive without changing passing, shooting, tackle, goalkeeper, control mapping, or AI tactical balance.

## Player problem
The previous runtime treated possession as a nullable `ball.owner`. Loose-ball pickup, first contact, controlled-ball positioning, release locks, and recapture prevention were spread through `game.js`, making the ball feel attached to the player and leaving no explicit first-touch outcome.

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
- Audited writes to `ball.owner`, `ball.lock`, ball position, velocity, height, and last touch.
- Recorded pickup rules for lock, cooldown, radius, height, and last-touch speed block.

### G3.2 — Pure policy module — Complete
- Added centralized `ballControlConfig`.
- Added pure `captureEligibility`, `firstTouchScore`, `classifyFirstTouch`, `resolveFirstTouch`, and `dribbleAnchor` helpers.
- Added tests for capture rules, outcome ordering, four outcome behaviors, and anchor distance.

### G3.3 — Runtime capture and dribble integration — Complete
- Integrated shared capture eligibility into loose-ball pickup.
- Integrated precision, normal, and sprint dribble anchors into controlled-ball follow.
- Preserved legacy pickup boundaries and pass/shot/tackle balance.

### G3.4 — Possession lifecycle — Complete
- Added explicit `loose`, `receiving`, `controlled`, and `released` metadata.
- Kept `ball.owner` compatibility while routing runtime transitions through lifecycle helpers.
- Integrated kickoff, goal, tackle, pass, shot, loft, lock-expiry, and owner transitions.

### G3.5 — First-touch outcomes — Complete
- Clean touch establishes immediate stable control.
- Cushioned touch establishes control while preserving reduced residual velocity.
- Heavy touch keeps the ball loose ahead of the receiver with a recapture lock.
- Rejected touch fails ownership and preserves most incoming momentum.
- Outcomes are deterministic and fixed-step safe.

### G3.6 — Replay and release validation — Complete in automated scope
- Replay snapshots include owner identity and possession metadata.
- Buffered action path remains after successful ownership transition.
- Goalkeeper capture envelope and legacy release values remain covered by tests/contracts.
- Standard read-only CI restored and all migration scripts removed.

## Automated validation
- Syntax checks for `game.js` and `server.mjs`.
- Asset validation.
- Capture lock, height, goalkeeper range, cooldown, and last-touch tests.
- Clean, cushioned, heavy, and rejected first-touch tests.
- Possession lifecycle transition and kickoff-reset tests.
- Dribble anchor ordering and legacy-boundary contracts.
- Replay possession snapshot and cushioned-velocity regression contracts.
- Full repository `npm test` on a clean branch.

## Manual browser validation before merge
- Slow and fast ground reception.
- Aerial and awkward-angle reception.
- Precision and sprint reception.
- Goalkeeper pickup and distribution.
- Buffered action after reception.
- Player switching and post-tackle recovery.
- Replay, WebGL, Canvas fallback, desktop, and narrow layout.

The repository does not currently include a browser automation harness, so the items above require direct browser playtesting.

## Acceptance criteria
- Locked balls cannot be captured.
- Goalkeepers retain their larger catch radius and height allowance.
- Last-touch high-speed recapture prevention remains intact.
- Precision control keeps the ball closer than normal control.
- Sprint control pushes the ball farther than normal control.
- First-touch quality responds consistently to speed, angle, height, movement, rating, precision, and sprinting.
- Poor touches create a recoverable loose ball rather than hidden ownership.
- Replay captures possession metadata.
- CI passes on a clean branch.

## Current status
Implementation, review fixes, automated regression coverage, cleanup, and documentation are complete. PR is ready for review; direct browser playtesting remains required before merge.