# G3 — Ball Control and First Touch

## Objective
Make ball reception, possession, and dribbling feel physical and readable while preserving the fixed 60 Hz simulation and the current passing, shooting, tackling, goalkeeper, and AI-decision balance.

## Player problem
The current ball can feel attached to a player rather than controlled through contact. Fast passes, awkward angles, sprinting receptions, and loose-ball challenges need distinct outcomes so possession feels earned instead of automatic.

## Scope
- Introduce an explicit possession state model.
- Define capture eligibility from distance, relative speed, ball height, lock time, and approach angle.
- Add deterministic first-touch quality and displacement.
- Add readable dribble anchor distances for precision, run, and sprint movement.
- Preserve release paths for pass, shot, loft, tackle, and goalkeeper distribution.
- Keep replay capture and both renderers coherent with the new ball state.
- Add unit and runtime-contract tests before tuning.

## Out of scope
- Pass targeting and power tuning.
- Shot aiming and power tuning.
- Tackle success probability.
- Skill moves.
- Advanced shielding contests.
- New goalkeeper decisions.
- AI tactical decisions, formations, multiplayer, or modes.

## Implementation slices

### G3.1 — Audit and baseline
- Map all writes to `ball.owner`, `ball.lock`, `ball.pendingPass`, position, velocity, height, and release functions.
- Record current pickup radius and ownership rules.
- Add source-level runtime contracts for kickoff, replay, pass, shot, tackle, and goalkeeper release.

### G3.2 — Possession state model
- Add explicit states: `loose`, `receiving`, `controlled`, and `released`.
- Keep a single authoritative owner transition function.
- Store last controller, contact timestamp, and release reason.
- Prevent owner changes while release lock is active.

### G3.3 — First touch
- Calculate touch difficulty from incoming speed, relative approach speed, angle, height, player rating, sprint state, and precision input.
- Produce deterministic outcomes: clean control, cushioned touch, heavy touch, or rejection.
- Heavy touches must leave the ball loose and recoverable rather than teleporting ownership.

### G3.4 — Dribble controller
- Place controlled ball ahead of the player using facing and movement state.
- Precision movement keeps the ball closer.
- Sprint movement pushes the ball farther with a recoverable cadence.
- Avoid per-frame teleport artifacts and keep ball velocity coherent for release.

### G3.5 — Compatibility
- Preserve pass, through-ball, loft, shot, tackle, slide, goalkeeper distribution, kickoff, replay, and player switching.
- Keep AI decision code unchanged; only route ownership/contact through the shared controller.
- Maintain WebGL and Canvas fallback parity.

### G3.6 — Validation and tuning
- Test slow ground pass, fast ground pass, aerial ball, sprint reception, back-to-ball reception, precision reception, contested loose ball, and post-tackle recovery.
- Compare equivalent fixed-step elapsed time.
- Validate desktop, narrow layout, WebGL, Canvas fallback, and replay.

## Acceptance criteria
- Possession transitions occur through one authoritative path.
- A locked or high aerial ball cannot be captured illegally.
- Faster and more awkward receptions produce less reliable first touches.
- Precision movement improves control without changing top-level control mapping.
- Sprint dribbling creates more separation than normal dribbling.
- Heavy touches leave a genuinely loose ball.
- Passing, shooting, tackling, goalkeeper distribution, replay, and kickoff remain functional.
- No render-FPS dependency is introduced.
- Existing tests remain green.

## Regression checklist
- Start, restart, pause/resume, kickoff after goal, and full time.
- Player switching before and after receiving the ball.
- Short pass, through ball, loft, shot, finesse, chip, tackle, slide, and goalkeeper release.
- Replay capture and rendering.
- WebGL and Canvas fallback.
- Reduced-motion and low-power presentation paths.

## Definition of Done
- Possession and first-touch logic are extracted, deterministic, and documented.
- Tests cover capture eligibility, first-touch outcomes, dribble anchors, release locks, and reset behavior.
- CI passes on a clean branch.
- Manual browser validation is documented.
- PR contains no unrelated balance, AI, UI, or mode changes.
