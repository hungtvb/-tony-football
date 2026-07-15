# G2 — Player Movement and Locomotion

## Objective
Make controlled players feel responsive, readable, and physically coherent while preserving the fixed 60 Hz simulation, FO4 keyboard mapping, and existing gameplay balance outside locomotion.

## Player problem
Movement previously mixed target velocity, facing direction, animation pose, stamina, sprint state, and renderer orientation inside the monolithic game loop. This made reversals, sprint transitions, AI arrival, and model direction difficult to test or tune safely.

## Delivered
- Extracted deterministic movement calculations into `PlayerLocomotion`.
- Centralized controlled-player and AI values in `locomotionConfig`.
- Preserved normalized diagonal input and fixed-step behavior.
- Integrated controlled-player acceleration, stopping, turn grip, facing, stamina, and sprint state.
- Integrated AI `moveToward` through the shared target locomotion helper without changing tactical decisions.
- Tuned acceleration and 180-degree reversal response.
- Added distinct sprint-entry and sprint-exit responses without changing maximum speed or stamina balance.
- Added renderer heading adapters for WebGL and Canvas fallback.
- Added runtime contracts for kickoff reset, pause/resume, player switching, and low-stamina sprint exit.

## Scope guard
No ball ownership, dribbling, first touch, passing, shooting, tackling, goalkeeper balance, AI decisions, formations, controls remapping, multiplayer, or game-mode changes.

## Automated validation complete
- Cardinal and diagonal input normalization.
- Equivalent elapsed-time acceleration across fixed timesteps.
- Stop damping without direction inversion.
- Turn grip and full-reversal response.
- Facing normalization while turning.
- Sprint drain, normal movement drain, and idle recovery.
- Sprint-entry and sprint-exit response selection.
- AI fixed-step arrival and arrival-radius damping.
- Canonical WebGL and Canvas heading directions.
- Kickoff resets velocity, sprint, boost, lean, and stride blend.
- Pause/resume does not mutate player locomotion.
- Player switching does not copy movement state.
- Exhausted players cannot remain sprinting.
- Full repository `npm test` on the clean branch.

## Manual validation matrix
- Start from idle, accelerate, stop, and immediately move again.
- Perform repeated 90-degree and 180-degree changes.
- Hold and release sprint at full and low stamina.
- Verify marking and precision movement remain controllable.
- Switch players while teammates are moving or sprinting.
- Pause and resume during acceleration and sprint.
- Restart and verify kickoff movement state is clean.
- Compare WebGL model direction with Canvas fallback direction.
- Validate desktop and narrow browser layouts.

## Acceptance criteria
- Equal directional magnitude produces equal top speed for cardinal and diagonal input.
- Player speed does not depend on rendering FPS.
- Starting, stopping, and reversing are deterministic.
- Small steering adjustments remain responsive.
- 180-degree reversals remain readable and do not snap.
- Facing direction remains normalized and stable.
- Sprint entry/exit is readable and stamina-aware.
- WebGL and Canvas fallback represent the same movement direction.
- Existing FO4 controls remain unchanged.
- Existing simulation, presentation, asset-contract, and gameplay tests remain green.

## Definition of Done
- Locomotion logic and configuration are extracted and documented.
- Controlled-player and AI movement use shared deterministic helpers.
- Movement tests cover acceleration, deceleration, diagonal input, turning, reversal, sprint, stamina, arrival, renderer orientation, and reset behavior.
- Temporary migration files are removed and standard CI is restored.
- CI passes on a clean branch.
- Manual browser validation remains documented as the pre-merge check.
- PR contains no unrelated balance, AI-decision, physics, UI, or mode changes.
