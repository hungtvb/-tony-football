---
name: gameplay-systems
description: Design, implement, debug, tune, and verify player-facing mechanics including input, movement, interactions, physics integration, replay, state transitions, game feel, and deterministic tests.
---

# Gameplay Systems

Use when changing controls, movement, ball interaction, match rules, replay behavior, state transitions, or gameplay feel.

## Principles

- Specify observable rules before coding.
- Separate input, intent, decision, authoritative result, and presentation feedback.
- Make important states and transitions explicit.
- Preserve responsiveness without frame-rate-dependent mechanics.
- Prefer deterministic scenarios over manual play alone.
- Distinguish correctness, feel, and balance; each needs different evidence.

## Mechanic contract

Define trigger, preconditions, state transition, timing window/cooldown, cancellation, interaction with other mechanics, success/failure outputs, player feedback, and deterministic test scenarios.

## Debug workflow

```text
physical input -> mapping/buffering -> intent -> gameplay decision
-> simulation/state transition -> snapshot/event -> animation/audio/VFX
```

1. Capture initial state, command sequence, simulation steps, seed, configuration, expected and actual result.
2. Locate the first incorrect stage.
3. Test competing causes: input mapping, mechanic precondition, overwritten result, timing nondeterminism, or correct state with misleading presentation.
4. Add regression coverage at the lowest authoritative layer and a browser/visual check when presentation caused the perceived defect.

## Input checklist

- Press, release, hold, repeat, and buffering semantics are explicit.
- Conflicting commands have a priority rule.
- Focus loss, menus, pause, and remapping cannot leave stuck inputs.
- Device state becomes engine commands at a defined tick boundary.

## Movement checklist

- Acceleration, deceleration, turn rate, and max speed are separate.
- Behavior is stable across render frame rates.
- Facing and velocity are not conflated.
- Collision response is bounded and explainable.
- Sprint, turn, stop, interruption, and recovery transitions are tested.
- Zero-speed, boundary, and unusual-frame-cadence cases are covered.

## Interaction and sports checklist

For ball/contact mechanics define possession states, eligibility/reach, target selection, contact result, contest resolution, cooldown/recovery, loss-of-control conditions, and scoring/out-of-play consequences. Presentation proximity alone must not be authoritative contact.

## Replay and determinism

Document whether replay uses commands, snapshots plus commands, authoritative state, or presentation-only highlights. Deterministic replay records versioned configuration, initial state, seed, ordered commands/events, and tick indices. Detect divergence using stable state hashes or selected authoritative checkpoints. Similar-looking video is not replay parity evidence.

## Game feel

Evaluate input latency, anticipation, recovery, acceleration, contact confirmation, camera/animation/audio/VFX synchronization, clarity of failure, and controllability during transitions. Cosmetic feedback stays outside authoritative mechanics.

## Testing layers

1. Pure rule/state tests.
2. Deterministic multi-system scenarios.
3. Input/adapter integration.
4. Browser smoke and visual behavior.
5. Manual feel review using a recorded scenario.

Include boundaries, repeated actions, cancellation, simultaneous commands, pause/resume, and abnormal frame cadence.

## Tony Football mapping

Read `docs/gameplay/SIMULATION.md`, `PLAYER_MOVEMENT.md`, `BALL_CONTROL.md`, `src/game/gameplay/`, movement/ball systems, and `BrowserInputAdapter.js`. Run gameplay, input, scenario, and relevant Playwright tests.

## Evidence required

Report the exact command sequence and tick/state transition, regression results, browser/manual evidence for feel changes, and remaining balance/device uncertainty.

## Primary references

- Godot input events: https://docs.godotengine.org/en/stable/tutorials/inputs/inputevent.html
- Unity time/frame management: https://docs.unity3d.com/Manual/TimeFrameManagement.html
- Game Programming Patterns — State: https://gameprogrammingpatterns.com/state.html
- Game Programming Patterns — Event Queue: https://gameprogrammingpatterns.com/event-queue.html
