# HUD Specification

## Principle
Gameplay is the dominant layer. Permanent UI must answer an immediate gameplay question.

## Permanent elements
- Score and match clock
- Match state when relevant
- Selected player identity
- Stamina/status feedback
- Radar
- Compact contextual controls

## Contextual elements
- Action charge/power feedback
- Temporary event toast
- Replay badge
- Asset failure warning

## Remove from permanent HUD
- Full possession and shot statistics
- Full controls reference
- Successful asset-ready messages
- Long commentary footer
- Decorative panels without gameplay value

## Layout hierarchy
- Top center: compact scoreboard and clock
- Lower corner: selected-player card and stamina
- Opposite lower corner or centered lower region: radar
- Contextual hints near the relevant HUD edge, never over the ball carrier

## Behavior
- HUD remains visible during normal play.
- Nonessential elements fade during replay or modal states.
- Ready diagnostics auto-hide; failures remain actionable.
- Event toast has a finite duration and never blocks controls.

## Acceptance
- Canvas remains visually dominant.
- HUD is readable at 1280×720 and common laptop widths.
- No permanent panel obscures active play.
- Existing `game.js` UI bindings remain compatible.
