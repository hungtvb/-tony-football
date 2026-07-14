# Radar Specification

## Purpose
Provide fast spatial awareness without pulling attention away from the match.

## Required visual language
- Full pitch boundary, halfway line, center circle, penalty areas, and goals
- Home and away players with strong contrast
- Selected-player ring
- Ball marker distinct from players
- Ball-carrier emphasis
- Goalkeeper distinction
- Attack direction indicator

## Behavior
- Radar follows pitch orientation consistently.
- Markers remain legible over all pitch styles.
- Selected player and ball are identifiable at a glance.
- Radar may use compact and enlarged presentation states, but U1 must preserve the current gameplay mapping.

## Performance
- Avoid per-frame DOM allocation.
- Reuse Canvas paths and marker styles where practical.
- Radar updates must not modify authoritative gameplay state.

## Acceptance
- User can locate the ball, selected player, nearest teammates, and attacking direction within two seconds.
- No marker disappears at pitch edges.
- Canvas fallback remains functional.
