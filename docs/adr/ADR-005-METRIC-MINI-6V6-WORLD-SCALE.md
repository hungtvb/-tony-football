# ADR-005 — Metric Mini-6v6 World Scale

Status: Accepted

## Context

Tony Football historically mixed unrelated dimensions:

- simulation coordinates used a `1200 × 700` world;
- WebGL projected those coordinates with `WORLD_SCALE = 0.1`;
- the pitch, goal frame, player rig and ball each used independent sizes;
- scoring boundaries did not derive from the rendered post and crossbar dimensions.

This made player, ball and goal proportions impossible to reason about and blocked authored Player V3 assets, camera calibration and ball-feel work.

## Decision

Tony Football uses the immutable `mini-6v6-metric-v1` simulation scale profile.

- `20` simulation units represent `1 metre`.
- `1` Three.js world unit represents `1 metre`.
- The playable field is `55.2 × 30.8 m`.
- The goal clear opening is `5 × 2 m`, with `1.5 m` depth and `0.1 m` post thickness.
- The ball radius is `0.11 m`.
- The representative player height is `1.8 m`.
- Loaded player rigs are measured at runtime and uniformly normalized to the representative height.

The profile is the source of truth for engine collision/scoring geometry, WebGL geometry, Canvas geometry and model scale. Presentation consumes the contract but may not mutate simulation state.

## Goal semantics

`ball.height` is the distance between the bottom of the ball and the ground. A goal is awarded only when:

1. the whole ball has crossed the goal line;
2. the whole ball is horizontally between the inside faces of the posts;
3. the whole ball is below the underside of the crossbar.

This yields a maximum scoring `ball.height` of `2.0 - 0.22 = 1.78 m`.

## Consequences

- Goal, ball and player ratios become measurable and testable.
- Changing simulation density can preserve fixed-step timing, command ordering and AI/input authority.
- Player GLB scale no longer depends on an asset-specific magic number.
- Camera, lighting and ball-physics feel remain separate follow-up concerns.
- Canvas remains on the shared scale contract until its planned retirement under TON-193.
