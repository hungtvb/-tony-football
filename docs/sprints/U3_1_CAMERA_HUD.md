# U3.1 — Camera and HUD

## Objective
Improve match readability and presentation without changing gameplay rules. The camera must preserve useful field visibility, the radar must remain unobstructed, and HUD elements must communicate state without competing with the pitch.

## Player problems
- The current framing can crop the lower-left and lower-right playable areas.
- Camera tracking follows the ball too literally and does not consistently reveal space ahead of play.
- Text overlaps the radar and hides ball or player markers.
- HUD elements have similar visual weight and remain visible even when not useful.

## Scope

### Camera framing
- Audit viewport, zoom, camera target, clamping, and world-to-screen bounds.
- Define safe margins for the selected player and ball.
- Preserve both lower corners on desktop and narrow layouts.
- Add restrained attack-direction look-ahead.
- Add a dead zone so small ball movement does not constantly move the camera.
- Keep replay camera behavior compatible.

### Radar
- Remove all labels and instructional text from the radar plot area.
- Keep contextual text in a separate HUD region or transient toast.
- Establish marker hierarchy for selected player, ball, teammates, opponents, and goalkeepers.
- Improve contrast without obscuring the pitch.
- Keep radar data renderer-independent.

### HUD hierarchy
- Score and time remain glanceable but secondary to the match.
- Player identity appears briefly on selection changes.
- Stamina is persistent only when relevant and warns gently at low levels.
- Power appears only while charging an action.
- Context hints auto-hide and never overlap the radar.
- Motion follows reduced-motion settings.

## Out of scope
- Pause menu navigation and returning to match setup.
- Kit, ball, pitch, stadium, weather, or time selection.
- Settings architecture and control remapping.
- Gameplay, physics, AI, multiplayer, and game modes.

## Implementation slices

### U3.1.1 — Audit and contracts
- Inventory camera and HUD calculations in `game.js`, HTML, and CSS.
- Add pure camera framing helpers and baseline tests.
- Add radar safe-zone and HUD-overlap contracts.

### U3.1.2 — Camera framing
- Introduce dead zone, look-ahead, safe area, and responsive zoom bounds.
- Preserve replay and reduced-motion behavior.

### U3.1.3 — Radar cleanup
- Remove text from radar bounds.
- Improve marker hierarchy and selected-player readability.

### U3.1.4 — HUD polish
- Refine scoreboard, clock, stamina, power, and contextual hints.
- Add restrained transitions and responsive safe-area spacing.

### U3.1.5 — Validation
- Run repository tests.
- Validate desktop, narrow layout, WebGL, Canvas fallback, replay, and reduced motion.

## Acceptance criteria
- Lower-left and lower-right field areas remain visible during normal play.
- The selected player and ball are not pinned against unsafe viewport edges.
- Camera movement is smoother than direct ball locking and reveals useful attacking space.
- No text renders inside the radar plot area.
- Ball and selected-player radar markers are immediately distinguishable.
- Power and contextual hints do not remain permanently visible.
- HUD does not overlap controls, radar, or critical play space on narrow layouts.
- No gameplay values or decisions change.
- CI passes on a clean branch.

## Current status
Documentation and scope are complete. Runtime camera/HUD audit is next. Keep the PR Draft until implementation and browser validation are complete.
