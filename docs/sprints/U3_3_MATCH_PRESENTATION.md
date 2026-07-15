# U3.3 — Match Presentation

## Objective

Add broadcast-style transitions around the match without changing simulation balance, restart behavior, score ownership, or replay mechanics.

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

## Slice 2 — Goal Presentation and Replay Polish

### Flow

```text
Confirmed score increase
  → Native flash + scoreboard pop
    → Goal hero
      → Updated scoreline
        → Goal card clears
          → Native instant replay remains visible
            → Return to native kickoff
```

### Delivered scope

- Dedicated presentation state machine: `hidden → goal → score → replay → complete → hidden`.
- Score observer reacts only to confirmed score increases while the active body flow is `match`.
- Broadcast overlay reflects Tony FC or Neon United, team crest, and live scoreline.
- Replay stage is included only when the existing native replay badge confirms replay availability.
- Presentation camera treatment darkens and settles the pitch without changing camera calculations.
- Goal overlay is non-interactive and does not intercept controls or own simulation timing.
- Deterministic preview and hold hooks support desktop and narrow-landscape Playwright validation.
- Reduced-motion users receive short stage timings without losing the stage order.

### Timing coordination

- The presentation waits 460 ms in normal mode so the native goal flash and 420 ms scoreboard pop remain unobstructed.
- The visible Goal and Score card occupies 880 ms total in normal mode.
- The card is hidden before the Replay state so the native replay footage is visible rather than covered by a second full-screen treatment.
- Replay completion follows the existing replay badge with a bounded fallback; the presentation never extends the native 3.65 second goal sequence.
- Visual-test and reduced-motion modes preserve the same ordering with accelerated timings.

## Architecture

`MatchIntroFlow.js` owns the transition into the first kickoff. It captures the initial `playButton` action, runs the presentation, then replays the native click once.

`GoalPresentationFlow.js` owns visual reaction to score changes only. It observes the existing score DOM, snapshots scoring team and scoreline, and runs an independent presentation state machine. It does not write to game score, replay buffers, goal sequence timers, player animation state, or kickoff state.

`game.js` remains the owner of reset, score, goal detection, scorer celebration, replay recording and playback, kickoff, clock, whistle, and simulation state.

These boundaries allow later result and statistics presentation slices to evolve without duplicating match rules.

## Out of scope

- Goal detection or scoring-rule changes.
- Replay buffer duration, frame rate, or playback calculation changes.
- Full-time statistics redesign.
- Stadium selection and time of day.
- Kit customization.
- Gameplay camera balance.
- Movement, passing, shooting, defending, goalkeeper, or AI tuning.

## Acceptance criteria

### Match intro

- Match Setup does not enter `playing` immediately after Start.
- VS, Countdown, and Kick Off stages occur in order.
- Active setup choices are visible during the VS presentation.
- Match state becomes `playing` only after presentation completion.
- Restart remains immediate.
- Main Menu and Match Setup navigation remain unchanged.

### Goal presentation

- A home score increase presents Tony FC and the updated scoreline.
- An away score increase presents Neon United and the updated scoreline.
- Score resets or unchanged score renders do not trigger a goal presentation.
- Native goal flash and scoreboard pop complete before the presentation card appears.
- Goal, Score, Replay, and Complete stages occur in order when replay is available.
- The presentation card is hidden during the native Replay stage.
- Presentation completes without a Replay stage when replay is unavailable.
- The overlay does not alter native score, goal delay, replay, or kickoff behavior.
- Desktop and narrow-landscape Playwright projects pass.
- Reduced-motion users retain the presentation order with effectively instant visual transitions.
