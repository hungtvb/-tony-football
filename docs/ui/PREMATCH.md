# Pre-Match Experience Specification

## Goal
Present a clear match setup, not a marketing landing page.

## Information hierarchy
1. Match identity: home team versus away team
2. Primary action: Start Match
3. Match setup: difficulty, pitch, weather, ball, camera
4. Supporting actions: Controls and Settings
5. Short contextual explanations

## Requirements
- Team cards have equal visual weight.
- Difficulty shows what changes, without implying unfair physical boosts.
- Selected options are visually and semantically clear.
- Start Match remains the strongest action.
- Controls and Settings are accessible before kickoff.
- Existing preference persistence remains functional.

## Responsive behavior
- Desktop: two-team composition with setup summary.
- Narrow layout: stack teams and controls without horizontal overflow.
- Primary action remains visible without excessive scrolling.

## Acceptance
- A new player can identify teams, difficulty, environment, and start action within five seconds.
- Keyboard navigation follows a logical order.
- Existing option IDs and handlers remain compatible or receive an explicit adapter.
