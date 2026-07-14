# Game Feel Specification

## Principles

- Feedback must clarify play, not decorate it blindly.
- The ball, selected player, radar, score, and control hints always remain readable.
- Effects never write authoritative simulation state.
- Stronger actions may receive stronger feedback, but all values are bounded.
- Reduced-motion and low-power modes are first-class behavior.

## Camera

- Use smooth follow with frame-rate-independent easing.
- Zoom changes must be gradual and bounded.
- Shake is a deterministic impulse that decays quickly.
- Normal passes use no shake.
- Strong shots, hard tackles, and goals may trigger small shake.
- Reduced-motion mode disables camera offset while retaining non-motion feedback.
- Goal emphasis must not prevent player control after replay completes.

## Ball

- Trail length and opacity scale with visual speed.
- Trail must disappear quickly at low speed.
- Low-power and reduced-motion modes use shorter trails.
- Spin cues are visual only.
- Airborne ball shadow becomes smaller and lighter as height increases.
- Canvas and WebGL paths may use different rendering techniques but must communicate the same state.

## Impact feedback

- Use short-lived pooled or capped particles.
- Avoid full-screen white flashes.
- Contact feedback should be localized where practical.
- Do not spawn particles every simulation tick.

## Particle budgets

- Desktop budget: 240 active particles.
- Low-power budget: 90 active particles.
- Reduced-motion budget: 36 active particles.
- Spawns above the active budget are discarded rather than allocating more objects.
- WebGL draw range must respect the same active budget as Canvas.

## Goal feedback

- Use a brief score emphasis, crowd rise, camera impulse, and existing replay badge/flow.
- Keep the sequence short enough to preserve match pace.
- Reduced-motion mode uses opacity and audio emphasis instead of scale, shake, or aggressive movement.

## Audio

- Reuse the current Web Audio setup.
- Add cooldowns for repetitive effects.
- Crowd layers should rise for shots and goals, then settle.
- Muting must silence all new layers.

## Weather

- Clear: restrained grass or dust contact.
- Rain: restrained splash feedback.
- Weather feedback is cosmetic and must not change physics.

## Performance

- Pool reusable particle and impulse objects where practical.
- Cap active effects.
- Avoid DOM creation in the main loop.
- Disable expensive effects on low-power devices.
- Preserve Canvas fallback with simpler equivalents.
