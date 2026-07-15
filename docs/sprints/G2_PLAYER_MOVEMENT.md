# G2 — Player Movement and Locomotion

## Objective
Make controlled players feel responsive, readable, and physically coherent while preserving the fixed 60 Hz simulation, FO4 keyboard mapping, and existing gameplay balance outside locomotion.

## Player problem
Current movement mixes target velocity, facing direction, animation pose, stamina, and sprint state inside the monolithic game loop. The result can feel abrupt during reversals, inconsistent across direction changes, and visually disconnected from the model orientation.

## Scope
- Extract deterministic locomotion calculations into a small gameplay module.
- Define walk, run, and sprint acceleration/deceleration behavior.
- Normalize diagonal input so it does not create extra speed.
- Add controlled turning and reversal behavior.
- Stabilize facing direction at very low speed.
- Keep model yaw and Canvas orientation aligned with simulation direction.
- Preserve stamina consumption and recovery intent while making transitions readable.
- Add unit and integration tests for movement invariants.

## Out of scope
- Ball ownership, dribbling, first touch, passing, shooting, tackling, goalkeeper balance, AI decisions, formations, controls remapping, multiplayer, and game modes.

## Implementation slices

### G2.1 — Movement audit and baseline
- Document current acceleration, max speed, sprint multiplier, friction, turn behavior, and stamina effects.
- Add baseline scenario tests before tuning.
- Record controlled-player and AI-player movement paths separately.

### G2.2 — Locomotion model
- Introduce a pure `PlayerLocomotion` module.
- Inputs: direction, magnitude, sprint intent, stamina, current velocity, current facing, timestep, and movement profile.
- Outputs: next velocity, next facing, sprint-active state, and animation hints.
- Keep all calculations fixed-timestep safe and deterministic.

### G2.3 — Turning and reversals
- Fast response for small steering corrections.
- Slower, readable response for 90–180 degree reversals.
- Prevent direction jitter around zero input.
- Ensure a stopped player faces the last meaningful direction.

### G2.4 — Sprint transitions
- Sprint should ramp in rather than snap instantly.
- Low stamina must reduce sustainable sprint without introducing random behavior.
- Releasing sprint should transition naturally back to run speed.
- Sprint state must reset correctly at kickoff, restart, pause/resume, and match reset.

### G2.5 — Rendering coherence
- WebGL model orientation follows locomotion facing, not noisy instantaneous velocity.
- Canvas fallback uses the same facing state.
- Stride blend and lean reflect acceleration and turning without affecting physics.

### G2.6 — Validation and polish
- Compare 30/60/120 render FPS under the fixed simulation loop.
- Test cardinal and diagonal movement.
- Test stop, reverse, sprint, low stamina, kickoff reset, pause/resume, and AI compatibility.
- Confirm no changes to ball, pass, shot, tackle, or AI decision outcomes.

## Acceptance criteria
- Equal directional magnitude produces equal top speed for cardinal and diagonal input.
- Player speed does not depend on rendering FPS.
- Starting, stopping, and reversing are deterministic.
- Small steering adjustments remain responsive.
- 180-degree reversals no longer snap visually or physically.
- Facing direction remains stable when velocity is near zero.
- Sprint transitions are readable and stamina-aware.
- WebGL and Canvas fallback show the same movement direction.
- Existing FO4 controls remain unchanged.
- Existing simulation, presentation, and asset-contract tests remain green.

## Regression checklist
- Start match, restart, pause/resume, kickoff after goal, and full-time flow.
- Player switching and directional switching.
- Ball pickup and ownership transitions.
- Shooting, passing, tackle, teammate run, and camera controls.
- Replay capture and replay rendering.
- WebGL and Canvas fallback.
- Reduced-motion and low-power presentation paths.

## Definition of Done
- Locomotion logic is extracted and documented.
- Movement tests cover acceleration, deceleration, diagonal normalization, turning, reversals, sprint, stamina, and reset behavior.
- CI passes on a clean branch.
- Manual browser validation is documented.
- PR contains no unrelated balance, AI, physics, UI, or mode changes.
