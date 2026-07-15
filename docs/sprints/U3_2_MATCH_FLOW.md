# U3.2 — Match Flow and Pause Navigation

## Objective
Make match navigation predictable and complete without reloading the page.

## First slice
- Resume match.
- Restart match.
- Return from pause directly to Match Setup.
- Return from pause to a separate initial Main Menu.
- Enter Match Setup from Main Menu through Quick Match.
- Return from Match Setup to Main Menu without starting a match.
- Clear held input and transient replay/goal state during navigation.
- Preserve selected pitch, ball, weather, and difficulty when returning to setup.
- Validate the flow with unit and browser tests.

## Flow contract

```text
Main Menu
  └─ Quick Match → Match Setup
       ├─ Start Match → Playing
       └─ Back → Main Menu

Playing
  └─ Pause
       ├─ Resume → Playing
       ├─ Restart → Playing with fresh match state
       ├─ Back to Match Setup → Match Setup
       └─ Back to Initial Screen → Main Menu
```

Main Menu and Match Setup must never be aliases of the same overlay. They are separate presentation surfaces with different purposes and actions.

## Out of scope
- Kit selection.
- Expanded ball and pitch content.
- Stadium, time-of-day, and weather expansion.
- Settings screen.
- Tournament, career, and multiplayer.

## Acceptance criteria
- No page reload is required.
- Initial load presents Main Menu, not Match Setup.
- Quick Match opens Match Setup.
- Returning to setup stops active gameplay, hides Main Menu, and shows Match Setup.
- Returning to the initial screen stops active gameplay, hides Match Setup, and shows Main Menu.
- Main Menu and Match Setup cannot be visible at the same time.
- The match state reads `SẴN SÀNG` after leaving a match.
- Held keys and charged actions are cleared.
- Restart still begins a fresh match directly.
- Debug scenarios bypass menu overlays for deterministic visual validation.
- CI and Playwright pass on the PR merge result.
