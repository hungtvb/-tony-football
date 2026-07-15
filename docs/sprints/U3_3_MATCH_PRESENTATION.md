# U3.3 — Match Presentation

## Objective

Add a broadcast-style transition between Match Setup and active gameplay without changing simulation balance or restart behavior.

## Slice 1 — Match Intro Foundation

### Flow

```text
Main Menu
  → Quick Match
    → Match Setup
      → Start Match
        → Versus presentation
          → Countdown 3 · 2 · 1
            → Kick Off
              → Playing
```

### Delivered scope

- Guarded presentation state machine: `idle → versus → countdown → kickoff → complete`.
- Dedicated VS presentation for Tony FC and Neon United.
- Selected difficulty, pitch, ball, and weather reflected in the intro.
- Countdown and Kick Off presentation before simulation starts.
- Presentation camera CSS hook that settles back into gameplay framing.
- Gameplay input remains locked because `game.js` does not receive the Start action until intro completion.
- Intro can be skipped without skipping the native match reset and whistle.
- Visual-test mode uses accelerated deterministic timings.
- Debug scenarios bypass the intro and remain deterministic.
- Restart and Play Again continue to start directly.

## Architecture

`MatchIntroFlow.js` owns presentation only. It captures the initial `playButton` action, runs the presentation, then replays the native click once. `game.js` remains the owner of reset, kickoff, clock, whistle, and simulation state.

This boundary avoids duplicating match initialization and allows later presentation slices to evolve without changing gameplay rules.

## Out of scope

- Goal celebration and replay redesign.
- Full-time statistics redesign.
- Stadium selection and time of day.
- Kit customization.
- Gameplay camera balance.
- Movement, passing, shooting, defending, goalkeeper, or AI tuning.

## Acceptance criteria

- Match Setup does not enter `playing` immediately after Start.
- VS, Countdown, and Kick Off stages occur in order.
- Active setup choices are visible during the VS presentation.
- Match state becomes `playing` only after presentation completion.
- Restart remains immediate.
- Main Menu and Match Setup navigation remain unchanged.
- Desktop and narrow-landscape Playwright projects pass.
- Reduced-motion users receive effectively instant transitions without losing the stage flow.
