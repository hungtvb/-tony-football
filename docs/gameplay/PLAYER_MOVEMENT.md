# Player Movement Specification

## Design target
Movement should feel closer to FIFA Online 4 than an arcade twin-stick game: immediate intent recognition, controlled momentum, readable body orientation, and no hidden randomness.

## Input contract
- Arrow keys remain the movement input.
- Input vector must be normalized when both axes are active.
- Input magnitude is clamped to `[0, 1]`.
- Sprint intent remains bound to the existing FO4 sprint key.
- No new control mapping is introduced in G2.

## Simulation contract
- Locomotion runs only inside the fixed simulation update.
- Render interpolation may smooth visuals but must not alter velocity, position, stamina, or facing state.
- Equal initial state plus equal input sequence must produce equal output.
- No use of `Math.random()` in locomotion.

## State model
Each player locomotion state should expose:
- planar velocity;
- last meaningful facing direction;
- sprint-active state;
- acceleration ratio;
- turn intensity;
- stride blend;
- turn lean as a presentation hint.

## Movement phases

### Idle
- Velocity decays predictably to zero.
- Facing remains at the last meaningful direction.
- Tiny floating-point velocity must not rotate the player.

### Start
- Input is recognized on the first simulation tick.
- Velocity ramps up rather than snapping to maximum speed.
- Start acceleration may be stronger than sustained steering acceleration.

### Run
- Cardinal and diagonal inputs reach the same maximum speed.
- Small direction changes should feel responsive.
- Speed should remain stable under constant input.

### Sprint
- Sprint requires valid intent and sufficient stamina.
- Sprint acceleration and maximum speed are profile-driven.
- Entering and leaving sprint should not cause a velocity discontinuity.
- Exhaustion reduces sustainable speed in a deterministic way.

### Stop
- Releasing movement input uses active deceleration.
- Stopping distance must be short enough for responsive football control.
- Velocity below the configured epsilon becomes exactly zero.

### Turn
- Steering response depends on angle between current velocity/facing and desired direction.
- Minor corrections preserve speed.
- Sharp turns trade some speed for readability.

### Reverse
- A near-180-degree input should brake before accelerating in the opposite direction.
- Facing transitions through the turn instead of snapping.
- Reverse behavior must be deterministic and covered by tests.

## Profiles
Movement values should live in one configuration object rather than scattered numeric literals. At minimum:
- walk/run maximum speed;
- sprint maximum speed;
- start acceleration;
- steering acceleration;
- active deceleration;
- reversal braking;
- turn-rate limits;
- low-speed facing epsilon;
- velocity stop epsilon;
- stamina thresholds and sprint modifiers.

## Controlled and AI players
- Both use the same locomotion solver.
- Controlled players receive human input intent.
- AI players receive desired movement intent from existing AI code.
- G2 must not change how AI chooses targets or tactics.

## Rendering contract
- WebGL and Canvas read the same facing and movement hints.
- Model yaw should derive from stable facing, not raw zero-speed velocity.
- Lean, stride, and bob are presentation-only.
- Reduced motion may reduce lean/bob but not locomotion simulation.

## Test matrix
- cardinal acceleration;
- diagonal normalization;
- release-to-stop;
- 90-degree turn;
- 180-degree reversal;
- sprint ramp-up and release;
- low-stamina sprint behavior;
- fixed-timestep determinism;
- render-FPS independence;
- reset/kickoff state;
- controlled and AI intent compatibility.

## Non-goals
This specification does not define dribbling, ball shielding, collision contests, animation assets, pass assistance, shooting assistance, or AI tactical choices.
