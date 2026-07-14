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

## Scope delivered

### Camera
- Frame-rate-independent follow easing.
- Deterministic bounded camera impulses.
- Strong-shot, tackle, and goal feedback hooks.
- Reduced-motion disables shake offsets.

### Ball presentation
- Speed-based trail length and opacity.
- Reusable WebGL trail buffer with no per-frame object creation.
- Canvas fallback trail using the same presentation policy.
- Height-aware Canvas ball shadow.

### Impact and goal feedback
- Shared flash decay behavior.
- Contextual contact particles for shots and tackles.
- Grass, dry-pitch dust, and rain splash palettes.
- Reduced-motion goal timing and restrained stadium pulse.
- Existing replay flow remains authoritative and unchanged.

### Audio
- Cooldown-based kick, whistle, and goal feedback.
- Power-scaled kick profile.
- Muting and browser autoplay behavior remain preserved.

### Accessibility and performance
- Desktop, low-power, and reduced-motion particle budgets.
- Effects are presentation-only and do not write football simulation outcomes.
- Reusable controllers are covered by automated tests.
- Temporary migration workflows and scripts were removed after integration.

## Automated coverage

- camera easing and impulse decay
- deterministic camera noise
- strong-shot thresholds
- flash decay bounds
- trail point count and opacity
- airborne shadow scaling
- particle budgets and reduced-motion behavior
- WebGL trail buffer behavior
- audio cooldown and profile scaling
- contextual particle selection and burst scaling

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
- Reduced-motion mode disables or minimizes shake, flash, and aggressive pulse.
- Existing tests and asset validation pass.
- No major FPS regression in WebGL or Canvas fallback.

## Manual validation pending

- start match and move across the pitch
- short pass, through pass, loft pass, regular shot, finesse, chip
- tackle and shoulder contact
- goal, replay, and kickoff reset
- pause/resume during active effects
- classic, dry, and rain particle contexts
- sound on/off
- WebGL and Canvas fallback
- reduced-motion browser preference
- low-power and desktop devices
- narrow and desktop layouts

## Definition of Done

U2 is complete when CI passes, the manual checklist has no major regression, documentation matches behavior, and the PR remains limited to presentation feedback rather than football tuning.
