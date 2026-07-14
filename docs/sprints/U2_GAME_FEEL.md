# Sprint U2 — Game Feel and Match Feedback

Status: Implementation Complete — Manual Validation Pending

## Goal

Make every pass, shot, tackle, goal, replay, and camera transition feel more responsive and polished without changing football behavior.

## User-visible outcome

- Camera follows play smoothly and remains readable.
- Strong actions feel different from light actions.
- Ball speed and spin are easier to perceive.
- Goals have a short, satisfying presentation sequence.
- Audio confirms important actions without becoming noisy.
- Rain and pitch contact produce restrained contextual particles.
- Effects scale down automatically for reduced-motion and low-power devices.

## Implemented

- Frame-rate-independent camera easing.
- Deterministic bounded camera impulses.
- Strong-shot, tackle, and goal feedback hooks.
- Shared flash decay behavior.
- Speed-based Canvas and WebGL ball trails.
- Height-aware Canvas ball shadow.
- Particle budgets for desktop, low-power, and reduced-motion modes.
- Contextual grass, dry-pitch dust, and rain splash particles.
- Cooldown-based action audio.
- Reduced-motion goal timing and restrained stadium pulse.
- Replay snapshots now retain ball velocity and trail presentation data.
- Goal-sequence effects share a single duration source.
- Audio cooldowns use one monotonic clock domain.
- Automated regression tests cover the reviewed runtime issues.

## Review fixes

- Fixed audio cooldown lock caused by switching between performance and AudioContext clock domains.
- Fixed WebGL ball trail using live state during replay.
- Fixed reduced-motion goal timing drifting from goal-net animation timing.

## Out of scope

- Locomotion tuning
- Ball physics tuning
- Shot or pass balance
- AI changes
- New animations or player-model replacement
- Multiplayer and modes
- Full cinematic cutscenes

## Acceptance criteria

- Camera micro-jitter is visibly reduced.
- Strong shots and goals have noticeable but short feedback.
- No effect changes simulation state or action outcomes.
- Ball remains visible during every effect.
- UI remains readable at desktop and narrow widths.
- Reduced-motion mode disables or minimizes shake, flash, and slow emphasis.
- Existing tests and asset validation pass.
- No major FPS regression in WebGL or Canvas fallback.

## Manual validation

- start match and move across the pitch
- short pass, through pass, loft pass, regular shot, finesse, chip
- tackle and shoulder contact
- ball hits post or crossbar
- goal, replay, and kickoff reset
- pause/resume during active effects
- classic, dry, clear, and rain contexts
- sound on/off
- WebGL and Canvas fallback
- reduced-motion browser preference
- narrow and desktop layouts

## Definition of Done

U2 is complete when the manual checklist has no major regression and the PR remains limited to presentation feedback rather than football tuning. Automated CI and review-regression tests are complete.