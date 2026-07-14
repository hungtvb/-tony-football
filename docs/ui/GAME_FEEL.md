# Game Feel Specification

## Principles

- Feedback must clarify play, not decorate it blindly.
- The ball, selected player, radar, score, and control hints always remain readable.
- Effects never write authoritative simulation state.
- Stronger actions may receive stronger feedback, but all values are bounded.
- Reduced-motion and low-power modes are first-class behavior.

## Camera

- Use smooth follow with a small dead zone.
- Zoom changes must be gradual and bounded.
- Shake is an impulse that decays quickly.
- Normal passes use no shake.
- Strong shots, posts, hard tackles, and goals may trigger small shake.
- Goal emphasis must not prevent player control after replay completes.

## Ball

- Trail length and opacity scale with visual speed.
- Trail must disappear quickly at low speed.
- Spin cues are visual only.
- Airborne ball shadow must communicate height without becoming detached or distracting.

## Impact feedback

- Use short-lived pooled particles.
- Avoid full-screen white flashes.
- Contact feedback should be localized where practical.
- Do not spawn particles every simulation tick.

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

- Pool reusable particle and impulse objects.
- Cap active effects.
- Avoid DOM creation in the main loop.
- Disable expensive effects on low-power devices.
- Preserve Canvas fallback with simpler equivalents.
