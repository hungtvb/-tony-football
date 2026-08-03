---
name: game-design
description: Turn game ideas and player feedback into testable mechanics, core loops, progression, difficulty, balancing, UX feedback, game-feel targets, and evidence-based acceptance criteria.
---

# Game Design

Use when deciding what a mechanic should accomplish, resolving vague feedback, defining acceptance criteria, tuning difficulty/balance, improving game feel, onboarding, or match flow.

## Design hierarchy

```text
player fantasy -> player goal -> repeated decision/action -> system response
-> feedback -> short-term outcome -> match/progression consequence
```

A polished effect that does not support the intended decision or fantasy is not automatically good design.

## Design brief

Define target player/context, desired emotion, player skill or decision, mechanic rule, readable feedback, failure/recovery, tuning variables, abuse risk, and measurable acceptance scenario.

## Converting vague feedback

Translate “rough”, “cheap”, “too easy”, or “not realistic” into hypotheses about readability, responsiveness, motion, audiovisual feedback, camera/framing, challenge/agency, or consistency with the fantasy. Prototype the cheapest discriminating change before broad polish.

## Core-loop review

Ask:

- What does the player repeatedly observe, decide, and execute?
- How quickly is the result confirmed?
- Is the next meaningful decision obvious?
- Are mastery and improvement visible?
- Is downtime intentional?
- Does presentation reinforce or obscure gameplay information?

## Game-feel checklist

- Input response begins promptly.
- Anticipation communicates commitment without excessive latency.
- Motion has readable acceleration, contact, and recovery.
- Camera supports control and spatial understanding.
- Audio/VFX confirm meaningful events without noise.
- Failure explains what happened.
- Feedback remains legible when repeated.
- Cosmetic polish does not contradict authoritative rules.

## Difficulty and balance

Track scenario success rate, comprehension/mastery time, dominant strategy frequency, action usage/effectiveness, comeback potential, AI fairness, reaction windows, and frustration from unreadable or uncontrollable outcomes. Change one tuning dimension at a time where practical and keep configuration versioned.

## Sports-game design

Evaluate responsiveness versus animation authenticity, ball and possession readability, tactical spacing/options, pass/sprint/tackle/shot risk-reward, camera visibility, attack/defense/stoppage/replay transitions, shared rules for human and AI, and whether outcomes feel earned.

## Acceptance criteria

Prefer observable scenarios:

- Given a known state and command sequence, the expected transition occurs.
- At supported viewports, required spatial context remains readable.
- The player receives distinct feedback within a bounded time.
- Difficulty changes decision quality without violating shared rules.
- Repeating a flow does not duplicate or retain stale state.

Pair qualitative judgment with concrete scenarios and evidence captures.

## Playtest method

1. State the hypothesis.
2. Use a representative scenario.
3. Observe without coaching first.
4. Record errors, hesitation, and preference separately.
5. Distinguish comprehension, execution, and preference problems.
6. Change the smallest useful variable.
7. Repeat under comparable conditions.

## Tony Football mapping

Use golden match and presentation scenarios as design contracts. Connect design acceptance criteria to engine/gameplay tests and Playwright evidence. Compose with `ui-ux-pro-max` for UI, `game-3d` for camera/model work, and `gameplay-systems` for mechanics.

## Evidence required

Report intended player outcome, hypothesis, scenario, observation, tuning changed, regression evidence, and unresolved subjective/playtest risk.

## Primary references

- MDA framework: https://users.cs.northwestern.edu/~hunicke/MDA.pdf
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/
- Microsoft Game Accessibility Guidelines: https://learn.microsoft.com/gaming/accessibility/guidelines
- GDC Vault: https://www.gdcvault.com/
