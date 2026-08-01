# World Scale Contract

## Canonical profile

`src/game/config/simulationScaleProfile.js` owns the deeply frozen `mini-6v6-metric-v1` contract.

| Dimension | Metric value | Simulation value | Three.js value |
| --- | ---: | ---: | ---: |
| Field length | 55.2 m | 1104 | 55.2 |
| Field width | 30.8 m | 616 | 30.8 |
| Goal clear width | 5 m | 100 | 5 |
| Crossbar underside | 2 m | vertical metric height | 2 |
| Goal depth | 1.5 m | 30 | 1.5 |
| Post thickness | 0.1 m | 2 | 0.1 |
| Ball radius | 0.11 m | 2.2 | 0.11 |
| Representative player height | 1.8 m | presentation normalization | 1.8 |
| Outfield collision radius | 0.32 m | 6.4 | diagnostic ratio only |
| Goalkeeper collision radius | 0.36 m | 7.2 | diagnostic ratio only |

The simulation coordinate range remains `1200 × 700`; the playable field remains bounded by `x=48..1152` and `y=42..658`.

## Ownership

- `simulationScaleProfile.js`: metric source of truth and conversions.
- `PlayerMovementSystem.createFieldBounds`: engine field, goal-mouth and goalkeeper bounds.
- `MatchState`: player and ball collision radii.
- `BallSimulationSystem`: whole-ball goal crossing and frame response.
- `ThreeSceneEnvironmentProfile`: WebGL pitch, markings and goal geometry.
- `CanvasMatchRenderer`: Canvas pitch and goal geometry while Canvas remains supported.
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
- Runtime `width` and `height` must match the selected profile; dimensions cannot be overridden independently from collision and presentation geometry.
- A scale-profile change cannot alter fixed-step duration, command mapping or AI decision ownership.
- Lighting, camera framing and ball-flight tuning are not part of this contract.

## Validation

- `tests/engine/SimulationScaleProfile.test.mjs` validates conversions, immutability and measurable ratios.
- `tests/engine/WorldScaleContract.test.mjs` validates shared engine/WebGL geometry, whole-ball scoring and deterministic command timing.
- `tests/presentation/threeSceneEnvironmentProfile.test.mjs` validates the frozen scene geometry profile.
- Browser evidence must cover broadcast, tactical and close views before TON-87 is completed.
