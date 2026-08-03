---
name: game-ai
description: Design, debug, tune, and verify real-time game AI including perception, decisions, steering, navigation, team coordination, fairness, performance, and explainable diagnostics.
---

# Game AI

Use for computer-controlled players, tactical behavior, target selection, positioning, navigation, coordination, difficulty, or AI performance.

## Architecture

```text
world snapshot -> perception/memory -> candidates -> scoring/planning
-> selected intent -> steering/path/command -> gameplay simulation
```

AI proposes commands. Gameplay systems remain authoritative over rules and outcomes.

## Choose the simplest model

- FSM for a small number of clear modes.
- Behavior tree for hierarchical reactive control.
- Utility AI for continuously scored competing actions.
- GOAP/planning for meaningful multi-step plans.
- Steering for local movement intentions.
- Navigation/pathfinding for reachability.

Do not combine models without explicit boundaries. Sports games commonly use team-level intent, player-level utility/FSM, and local steering.

## AI contract

Define observations, memory/expiry, decision cadence, legal commands, deterministic randomness, difficulty modifiers, CPU budget, and debug explanation format.

## Debug workflow

1. Capture seed, snapshot, controlled agent, tactical state, candidates, scores, selected intent, and issued command.
2. Find the first wrong stage: perception, stale memory, missing candidate, scoring, steering/path, gameplay rejection, or presentation.
3. Expose current role, target, destination, top scores, steering vector, transition reason, cooldown, and blocked precondition.
4. Add deterministic scenario regression. Assert intent and acceptable outcome ranges rather than incidental exact paths.

## Team and sports AI

Separate:

1. Team tactical phase/shape.
2. Role assignment.
3. Local decision and marking/support target.
4. Steering/navigation.
5. Gameplay action execution.

Validate spacing, coverage, support options, and role exclusivity. Prevent every agent from independently chasing the same target.

## Fairness and difficulty

Prefer changing reaction delay, perception uncertainty, decision quality, coordination, risk preference, and bounded execution error. Avoid hidden stat cheating unless explicitly designed. AI must use the same gameplay APIs and eligibility rules as the player.

## Performance

- Stagger expensive decisions across ticks.
- Separate high-frequency steering from low-frequency planning.
- Bound search depth, candidate count, and path work.
- Cache only with explicit invalidation.
- Use spatial indexes only after profiling.
- Track worst-case cost and population scaling.

## Anti-patterns

- AI mutating match state directly.
- Hidden transitions inside large switch statements.
- Unseeded randomness.
- Pathfinding every frame for every agent.
- Difficulty implemented only as faster speed or impossible reactions.
- Tuning without scenario suites.
- No explanation for selected actions.

## Tony Football mapping

Read `docs/adr/ADR-004-FAIR-AI-DIFFICULTY.md`, `src/game/engine/AIDecisionSystem.js`, match snapshots, gameplay command contracts, and deterministic scenario tests. AI must not bypass possession, kick, movement, or match-state rules.

## Evidence required

Provide the deterministic scenario, perceived facts, candidate scores or transition reason, selected command, resulting gameplay state, performance impact, and remaining emergent-behavior risk.

## Primary references

- Godot navigation: https://docs.godotengine.org/en/stable/tutorials/navigation/navigation_introduction_2d.html
- Unity AI Navigation: https://docs.unity3d.com/Packages/com.unity.ai.navigation@latest
- Game AI Pro: https://www.gameaipro.com/
- Reynolds steering behaviors: https://www.red3d.com/cwr/steer/
