# Snapshot Camera and Replay Contract

## Purpose

TON-83 gives camera and replay projection one explicit presentation owner. The engine remains the only authority for match lifecycle, goal phases, replay activation, replay progress, clock, score, possession and kickoff restoration.

## Owner

`src/game/presentation/SnapshotCameraReplayAdapter.js` owns:

- presentation-only camera follow interpolation and zoom projection;
- an immutable rolling history used only to choose visual replay frames;
- replay-frame selection from authoritative snapshot `match.replay.active`, `elapsed` and `duration` facts;
- reset, skip, missing-frame and teardown behavior;
- read-only diagnostics and compatibility facades during migration.

It does not own or advance gameplay time.

## Input boundary

The adapter receives only frozen presentation frames containing:

- immutable previous/current match snapshots;
- interpolation alpha and render timestamp;
- presentation-only camera mode and optional scorer identifier.

Snapshots are validated before use. Retained replay history contains the frozen snapshot objects themselves. The adapter never writes into a snapshot, compatibility player, ball, match state or engine object.

## Replay authority

The following facts are engine-owned:

- whether replay is active;
- replay elapsed time;
- replay duration and progress;
- goal/replay phase transitions;
- skip/end decisions;
- kickoff restoration.

The presentation owner may select a retained frame using those facts. It must not increment elapsed time, end replay, schedule timers or publish gameplay commands. The compatibility `update()` facade is intentionally a no-op.

When authoritative replay becomes inactive, the projected replay frame is removed immediately and renderers return to the current live snapshot. When replay is active but no retained frame exists, the adapter reports `missingFrame` and falls back to the live immutable snapshot rather than inventing state.

## Projected renderer contract

The owner publishes one frozen projection for each browser presentation frame. The projection contains:

- `renderSnapshot`: current authoritative match metadata with any historical player/ball visual facts projected into it;
- `camera`: frozen `x`, `y`, `zoom`, `targetZoom` and mode facts;
- `replay`: frozen authoritative active/elapsed/duration/progress plus visual frame index/count and missing-frame status;
- `projectionSequence`: the exact-once monotonically increasing presentation sequence.

A projected renderer frame must use the same `renderSnapshot` object and carry that projection as `frame.cameraReplay`. Consumers may not call the owner or derive a second projection.

`CanvasMatchRenderer` validates this contract, applies the supplied camera x/y/zoom transform to the 2D world, uses the supplied replay facts for replay-only visibility decisions and records the consumed projection sequence/camera/replay facts in its diagnostics. It does not instantiate a camera controller or infer replay state. WebGL/model and Canvas therefore consume the same frozen projection produced once by `SnapshotCameraReplayAdapter`.

## Camera projection

Camera state is presentation-only. `SnapshotCameraController` may retain interpolated x/y/zoom state between render frames, but that state:

- is derived from immutable snapshot subjects;
- never feeds engine movement, AI, possession, scoring or replay timing;
- is reset on browser runtime reset;
- is disposed with the presentation adapter.

WebGL and Canvas consume the same camera/replay projection. Replay selection is calculated once before downstream adapters render.

## Lifecycle

- `attach()` starts one owner instance.
- `project(frame)` validates immutable facts, records eligible live history, selects any authoritative replay frame and updates presentation camera state.
- `reset()` clears history, playback projection, camera interpolation and diagnostics counters.
- authoritative replay deactivation is the skip/end path and immediately restores live projection.
- fresh-match elapsed regression clears stale history before kickoff recording resumes.
- `teardown()` is terminal and releases all retained references.

## Migration boundary

`scripts/ton-83-migrate-camera-replay.py` removes deployed generated-runtime ownership of:

- local camera/replay controller construction;
- simulation-side camera updates;
- presentation-side replay elapsed advancement and completion;
- legacy replay recording flags and calls.

Tracked `game.js` remains the canonical migration input and is not edited directly. `generated/game.js` binds the frozen `__TONY_CAMERA_REPLAY_BRIDGE__` and may retain only still-deferred TON-84 presentation bridges.

## Validation

Required evidence includes:

- synthetic normal-play camera/history projection;
- authoritative replay frame selection at multiple engine elapsed values;
- proof that local `update(dt)` cannot advance or end replay;
- skip and kickoff-restoration tests;
- missing-frame fallback;
- reset and terminal teardown;
- Canvas rejection of missing/mutable/mismatched camera-replay projections;
- Canvas camera-transform and authoritative replay-fact consumption tests;
- exact consumed `projectionSequence`, camera and replay parity in forced-Canvas browser smoke;
- generated ownership guards;
- browser composition smoke for unchanged WebGL and Canvas startup.

## Out of scope

TON-83 does not redesign camera visuals, tune gameplay timing, change goal/replay timelines, extract settings/particles/trails/feedback, remove all compatibility bridges or resume TON-78.
