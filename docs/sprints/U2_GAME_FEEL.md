# Sprint U2 — Game Feel and Match Feedback

Status: In Progress

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

## Scope

### Camera
- Add configurable follow smoothing.
- Add a small dead zone to reduce micro-jitter.
- Add bounded dynamic zoom based on ball position and action context.
- Add short, low-amplitude shake for strong shots, posts, tackles, and goals.
- Never hide the ball or produce motion sickness.

### Ball presentation
- Improve trail readability based on speed.
- Improve visual spin cues.
- Improve contact shadow and airborne separation.
- Keep all visual effects independent from authoritative physics.

### Impact and goal feedback
- Add restrained impact flash and particles.
- Add a short goal emphasis sequence.
- Reuse existing replay flow rather than building a new replay system.
- Keep score, radar, and controls readable throughout.

### Audio
- Layer kick, pass, tackle, post, whistle, goal, and crowd responses.
- Prevent repeated sounds from stacking excessively.
- Respect mute state and browser autoplay restrictions.

### Weather particles
- Add restrained grass/dust contact particles.
- Add rain splash feedback when rain is active.
- Pool particle objects and cap active counts.

### Accessibility and performance
- Respect `prefers-reduced-motion`.
- Provide low-power fallbacks.
- Avoid per-frame DOM creation.
- Reuse objects in hot loops.
- Preserve WebGL and Canvas fallback paths.

## Implemented

- Frame-rate-independent camera easing.
- Deterministic bounded camera impulses.
- Strong-shot, tackle, and goal feedback hooks.
- Shared flash decay behavior.
- Speed-based ball trail length and opacity in Canvas fallback.
- Height-aware ball shadow in Canvas fallback.
- Particle budgets for desktop, low-power, and reduced-motion modes.
- Reduced-motion disables camera shake and shortens flash emphasis.
- Automated presentation tests for camera, impulse, trail, shadow, and budgets.

## Remaining

- Add a lightweight WebGL ball trail without per-frame object creation.
- Add contextual grass, dust, and rain contact particles within the active budget.
- Layer action and crowd audio with cooldowns.
- Refine goal and replay emphasis.
- Perform manual WebGL, Canvas fallback, low-power, and reduced-motion validation.

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
- clear and rain weather
- sound on/off
- WebGL and Canvas fallback
- reduced-motion browser preference
- narrow and desktop layouts

## Definition of Done

U2 is complete when CI passes, the manual checklist has no major regression, documentation matches behavior, and the PR is limited to presentation feedback rather than football tuning.
