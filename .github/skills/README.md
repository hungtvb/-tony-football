# Game Development Skills

Tony Football keeps the game skill set intentionally small. Load one primary skill and at most two supporting skills for an active task.

| Skill | Primary scope |
| --- | --- |
| `game-engine` | Architecture, fixed-step simulation, ownership, lifecycle, determinism, profiling |
| `game-3d` | Three.js/WebGL, glTF, cameras, animation, materials, lighting, GPU lifecycle |
| `gameplay-systems` | Input, movement, interactions, replay, state transitions, gameplay tests |
| `game-ai` | Perception, decisions, steering, navigation, team tactics, fairness |
| `game-design` | Core loop, game feel, difficulty, balancing, UX feedback, acceptance criteria |

## Loading policy

1. Read `AGENTS.md`, the active sprint, and files directly related to the ticket.
2. Do not load all five skills by default.
3. Use `game-engine` when changing ownership, timing, shared contracts, or lifecycle.
4. Use `game-3d` for Three.js, model, camera, animation, material, lighting, or GPU issues.
5. Use `gameplay-systems` for player-visible rules and interactions.
6. Use `game-ai` only when computer-controlled behavior is involved.
7. Use `game-design` when intended experience, tuning, or acceptance criteria are unclear.

## Recommended compositions

- Player model/clothing defect: `game-3d` + `game-engine`
- Movement/ball control: `gameplay-systems` + `game-engine`
- Replay divergence: `gameplay-systems` + `game-engine`
- Camera/pitch scale: `game-3d` + `game-design`
- Team positioning: `game-ai` + `gameplay-systems` + `game-design`
- New match feature: `game-design` + `gameplay-systems` + `game-engine`

Every skill uses the same evidence loop: reproduce, identify ownership, repair the smallest coherent boundary, run focused validation, run the relevant broader gate, and report residual risk.
