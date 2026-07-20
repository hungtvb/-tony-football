# Canvas Match Renderer Contract

## Scope

This contract belongs to TON-82. It moves the match Canvas fallback behind one explicit presentation adapter without changing gameplay, camera/replay policy, WebGL ownership, settings ownership, particles/trails, audio, feedback tuning or visual design.

## Ownership

`CanvasMatchRenderer` is the only owner of the `gameCanvas` 2D context. It owns Canvas lookup, explicit Canvas-session activation, viewport observation, pitch/player/ball drawing, selection and charge projection, basic weather projection, reset clearing and final teardown.

The generated compatibility runtime no longer obtains the match Canvas 2D context and no longer contains match-pitch, player, ball, charge or screen-effect Canvas drawing functions. Radar remains independently owned by `RadarSnapshotAdapter` and `RadarSnapshotRenderer`.

## Activation

A page session chooses one renderer. `CanvasMatchRenderer` activates only when the immutable browser URL preference is `renderer=canvas`. A normal WebGL session leaves the Canvas adapter inactive. Recoverable WebGL startup failure continues to request a fresh Canvas page through the TON-80 fallback policy; TON-82 does not introduce hot dual-renderer takeover.

Missing canvas and missing 2D context are explicit non-throwing states. They are visible through diagnostics and do not create a second rendering owner.

## Facts boundary

Every draw receives one frozen presentation frame from `BrowserBootstrapComposition`:

- frozen current and previous match snapshots;
- interpolation alpha and frame time;
- frozen control mode, pressed-code and active-charge facts.

`SnapshotRenderState` provides interpolated player and ball positions for both WebGL and Canvas. Score, clock, selected-player id, possession owner, pitch style, ball style, weather and goal-sequence facts come only from the current immutable snapshot. Canvas coordinates, painted pixels and context state never become gameplay inputs.

Replay framing and camera decisions remain TON-83. Particles, trails and broader feedback ownership remain TON-84. The Canvas renderer does not read mutable compatibility `players`, `ball`, `game`, `input` or replay-controller objects.

## Lifecycle

- `attach()` is idempotent and activates only for an explicit Canvas session.
- `resize()` refreshes viewport diagnostics while preserving the 1200×700 authoritative world-coordinate contract.
- `render(frame)` rejects mutable frames, interpolates snapshot facts and paints one complete Canvas frame.
- `reset()` clears pixels and presentation diagnostics without changing simulation state.
- `teardown()` removes resize ownership, clears the surface, releases context references and is final/idempotent.

## Parity

Synthetic evidence must prove that Canvas uses the same immutable tick, score, time, selected-player id, ball-owner id and interpolated player/ball coordinates as other presentation adapters. Selection and charge appear only when the selected snapshot player owns the ball and the frozen active-charge fact exists.

## Validation

TON-82 requires:

- pure lifecycle tests for inactive, missing-canvas, missing-context, resize, reset and teardown paths;
- immutable-frame rejection and snapshot interpolation parity tests;
- generated-source guards proving match Canvas ownership is absent from `generated/game.js`;
- engine/application guards proving no Canvas or DOM dependency was introduced;
- forced-Canvas browser smoke with Canvas diagnostics and engine-backed HUD evidence;
- full CI and Vercel evidence on one frozen exact head;
- independent Reviewer and SA clearance before PM expected-head merge.
