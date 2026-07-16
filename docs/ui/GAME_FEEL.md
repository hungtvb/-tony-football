# Game Feel Specification

## Principles

- Feedback must clarify play, not decorate it blindly.
- The ball, selected player, radar, score, and control hints always remain readable.
- Effects never write authoritative simulation state.
- Stronger actions may receive stronger feedback, but all values are bounded.
- Reduced-motion and low-power modes are first-class behavior.

## Camera

- Camera follow uses frame-rate-independent easing.
- Shake is a deterministic bounded impulse that decays quickly.
- Normal passes use no shake.
- Strong shots, hard tackles, and goals may trigger small impulses.
- Reduced-motion disables camera offsets.

## Ball

- Trail length and opacity scale with visual speed.
- Trail disappears quickly at low speed.
- Canvas and WebGL paths share the same trail policy.
- WebGL trail reuses a fixed buffer and does not allocate objects each frame.
- Airborne Canvas shadow communicates height with bounded scale and opacity.

## Impact feedback

- Shot and tackle contact points emit contextual particles.
- Classic and elite pitches use grass palettes.
- Dry pitch uses dust palettes.
- Rain overrides pitch context and uses splash palettes.
- Burst counts scale down on low-power and reduced-motion devices.
- Active particles always respect the central particle budget.
- Kick, tackle, and score events carry effect position/intensity facts; gameplay actions never call particle implementations directly.

## Goal and replay

- Goal feedback uses score emphasis, crowd/stadium pulse, camera impulse, flash, and the existing replay flow.
- Reduced-motion uses a shorter goal sequence and restrained pulse.
- `SnapshotReplayController` samples immutable match snapshots at 15 FPS, retains at most 66 history frames plus the final goal frame, and preserves the 3.05-second playback window.
- Replay playback is presentation-only and never writes recorded positions back into simulation.

## Audio

- Existing Web Audio output is preserved.
- Kick, whistle, and goal channels use cooldowns to avoid stacking.
- Kick tone profile scales with power.
- Muting silences all presentation audio.
- Kick, goal, start/restart, and full-time audio is projected from immutable gameplay/lifecycle events by `BrowserPresentationFeedbackAdapter`.

## Performance

- Reuse buffers and controller state in hot paths.
- Cap active particles by device capability.
- Avoid per-frame DOM creation.
- Preserve Canvas fallback.
- Preserve low-power and reduced-motion fallbacks.

## Validation

Automated tests cover snapshot camera framing, immutable replay sampling/playback, event-to-feedback projection, camera easing, impulse behavior, flash decay, trail policy, WebGL trail buffers, shadow scaling, device budgets, audio cooldowns, and contextual particle selection. Manual browser validation remains required before merge.
