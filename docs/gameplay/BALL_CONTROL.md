# Ball Control and First Touch — Source of Truth

## Principles
1. The ball is never visually attached without a valid possession state.
2. Ownership changes are explicit, deterministic, and fixed-step safe.
3. First touch quality depends on the situation, not random presentation logic.
4. A poor touch creates a loose-ball opportunity rather than hidden possession.
5. Passing, shooting, and tackles release through the same ownership boundary.

## Possession states

### `loose`
- No owner.
- Ball follows physics.
- Eligible players may attempt capture when lock, height, distance, and approach rules allow it.

### `receiving`
- A player has initiated a valid contact attempt.
- Touch outcome is evaluated once from the contact snapshot.
- This state must not persist indefinitely.

### `controlled`
- Ball has an authoritative owner.
- Position is derived from the dribble anchor, facing, player movement, and current control mode.
- Ball velocity remains meaningful for later release.

### `released`
- Ownership has ended because of pass, shot, loft, tackle, goalkeeper distribution, kickoff, or forced loss.
- A release lock prevents immediate recapture by the releaser or nearby players.
- The state returns to `loose` when the lock expires.

## Capture eligibility
A capture attempt requires all of the following:
- no current owner;
- release lock expired;
- ball height below the ground-control threshold unless the receiver supports aerial control;
- distance within the role-appropriate contact radius;
- relative speed below the absolute rejection threshold;
- approach geometry within the allowed contact cone;
- player is not in an incompatible animation or cooldown state.

## First-touch inputs
- incoming ball speed;
- relative player-to-ball speed;
- contact angle against player facing;
- ball height;
- player rating;
- sprint state;
- precision/shield input;
- rain or pitch modifiers only when already represented in deterministic gameplay state.

## First-touch outcomes

### Clean control
- Immediate transition to `controlled`.
- Minimal displacement.
- Used for low-speed, aligned receptions.

### Cushioned touch
- Transition to `controlled` after a small deterministic displacement.
- Ball settles toward the intended movement direction.

### Heavy touch
- Ball remains `loose`.
- Deterministic displacement follows the contact and movement vectors.
- Receiver receives a brief recapture delay.

### Rejection
- No ownership transition.
- Used for excessive height, speed, lock, or invalid geometry.

## Dribble anchors
- Precision: closest anchor and strongest damping.
- Normal run: medium anchor and stable side offset.
- Sprint: farther anchor, weaker damping, and readable push cadence.
- Idle: ball settles near the last meaningful facing direction.
- Anchor calculations must be deterministic and renderer-independent.

## Release contract
Every pass, shot, loft, tackle loss, goalkeeper release, and kickoff reset must:
- clear authoritative owner;
- set state and release reason;
- assign velocity and height before the next capture check;
- apply a deterministic recapture lock;
- preserve last-touch and pending-pass semantics where applicable.

## Reset contract
Kickoff and full match reset must clear:
- owner;
- possession state;
- receiver candidate;
- contact snapshot;
- release reason;
- recapture lock;
- pending first-touch result.

## Rendering contract
- WebGL and Canvas read the same authoritative ball position and possession state.
- Replay frames capture possession state, owner identity, ball velocity, height, and trail.
- Presentation may animate contact but must not mutate ownership.

## Testing contract
Required automated scenarios:
- valid slow ground capture;
- locked-ball rejection;
- high-ball rejection;
- fast-pass heavy touch;
- aligned precision clean control;
- sprint reception degradation;
- heavy-touch loose-ball state;
- sprint/normal/precision anchor ordering;
- release lock expiry;
- kickoff reset;
- replay state capture.
