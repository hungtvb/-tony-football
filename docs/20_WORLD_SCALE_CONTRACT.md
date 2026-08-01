# World Scale Contract

## Canonical profile

`src/game/config/simulationScaleProfile.js` owns the deeply frozen `mini-6v6-metric-v1` contract.

| Dimension | Metric value | Simulation value | Three.js value |
| --- | ---: | ---: | ---: |
| Field length | 50 m | 1000 | 50 |
| Field width | 32 m | 640 | 32 |
| Field aspect ratio | 1.5625 | derived | derived |
| Field area | 1600 m² | derived | derived |
| Behind-goal runoff | 5 m per side | 100 per side | 5 per side |
| Touchline runoff | 1.5 m per side | 30 per side | 1.5 per side |
| Centre-circle radius | 3 m | 60 | 3 |
| Penalty-area envelope | 6 × 12 m | 120 × 240 | 6 × 12 |
| Goal-area envelope | 4 × 10 m | 80 × 200 | 4 × 10 |
| Penalty-mark distance | 6 m | 120 | 6 |
| Line width | 0.08 m | 1.6 | 0.08 |
| Goal clear width | 5 m | 100 | 5 |
| Crossbar underside | 2 m | vertical metric height | 2 |
| Goal depth | 1.5 m | 30 | 1.5 |
| Post thickness | 0.1 m | 2 | 0.1 |
| Ball radius | 0.11 m | 2.2 | 0.11 |
| Representative player height | 1.8 m | presentation normalization | 1.8 |
| Outfield collision radius | 0.32 m | 6.4 | diagnostic ratio only |
| Goalkeeper collision radius | 0.36 m | 7.2 | diagnostic ratio only |

The simulation coordinate range remains `1200 × 700`; the playable field is centred at `(600, 350)` and bounded by `x=100..1100` and `y=30..670`.

The 50 × 32 m choice deliberately replaces the legacy 1104 × 616 screen-shaped rectangle. It keeps a compact 6v6 playing area, leaves explicit safety/runoff space inside the simulation world and avoids making the penalty areas dominate the pitch.

## Ownership

- `simulationScaleProfile.js`: metric source of truth, derived field ratios and conversions.
- `PlayerMovementSystem.createFieldBounds`: engine field, goal-mouth and goalkeeper bounds.
- `MatchState`: player formations plus player and ball collision radii.
- `BallSimulationSystem`: whole-ball goal crossing and frame response.
- `ThreeSceneEnvironmentProfile`: WebGL pitch, markings and goal geometry.
- `CanvasMatchRenderer`: Canvas pitch and goal geometry while Canvas remains supported.
- `RadarSnapshotAdapter`: radar projection bounds.
- `PlayerModelView`: runtime rig measurement and uniform representative-height normalization.
- `BallModelView`: visual ball radius.

## Rig normalization

The player model is cloned and measured before it is committed to the scene:

```text
uniform scale = representative player height / measured rig height
```

The accepted V2 character has a measured bind-pose height of approximately `1.81960792`, producing a uniform scale of approximately `0.9892241` for a `1.8 m` representative player.

Diagnostics record the profile id, measured height, target height and applied scale on the cloned model.

## Invariants

- Engine modules do not import Three.js or Canvas.
- Presentation geometry does not write engine dimensions.
- Goal line, post faces and crossbar underside derive from the same profile.
- Field length is greater than field width, with positive runoff on all sides.
- Centre circle, penalty area, goal area and penalty mark must fit inside the playable field.
- The playable field remains centred in the simulation world; engine AI, kickoff and camera projections rely on that invariant.
- Runtime `width` and `height` default from and must match the selected profile; dimensions cannot be overridden independently from collision and presentation geometry.
- Default formations must start fully inside the calibrated field.
- A scale-profile change cannot alter fixed-step duration, command mapping or AI decision ownership.
- Lighting, camera framing and ball-flight tuning are not part of this contract.

## Validation

- `tests/engine/SimulationScaleProfile.test.mjs` validates conversions, immutability, field ratios and invalid marking geometry.
- `tests/engine/WorldScaleContract.test.mjs` validates shared engine/WebGL geometry, whole-ball scoring, formations and deterministic command timing.
- `tests/presentation/threeSceneEnvironmentProfile.test.mjs` validates the frozen scene geometry profile.
- Radar tests validate that default marker projection uses the same field bounds.
- Browser evidence must cover broadcast, tactical and close views before TON-87 is completed.
