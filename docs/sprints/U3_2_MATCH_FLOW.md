# U3.2 — Match Flow and Pause Navigation

## Objective
Make match navigation predictable and complete without reloading the page.

## First slice
- Resume match.
- Restart match.
- Return from pause to Match Setup.
- Return from pause to the initial screen.
- Clear held input and transient replay/goal state during navigation.
- Preserve selected pitch, ball, weather, and difficulty when returning to setup.
- Validate the flow with unit and browser tests.

## Out of scope
- Kit selection.
- Expanded ball and pitch content.
- Stadium, time-of-day, and weather expansion.
- Settings screen.
- Tournament, career, and multiplayer.

## Acceptance criteria
- No page reload is required.
- Returning to setup stops active gameplay and hides pause/result overlays.
- The start overlay becomes visible and the match state reads `SẴN SÀNG`.
- Held keys and charged actions are cleared.
- Restart still begins a fresh match directly.
- CI and Playwright pass on the PR merge result.
