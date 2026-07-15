# U3.1 — Camera and HUD

## Objective
Improve match readability and presentation without changing gameplay rules. The camera must preserve useful field visibility, the radar must remain unobstructed, and HUD elements must communicate state without competing with the pitch.

## Player problems
- The previous framing could crop the lower-left and lower-right playable areas.
- Camera tracking followed the ball too literally and zoomed closer as ball speed increased.
- The commentary toast overlapped the radar plot and hid markers.
- HUD elements still have similar visual weight and remain visible even when not useful.

## Scope

### Camera framing
- Define safe margins for the selected player and ball.
- Preserve both lower corners on desktop and narrow layouts.
- Add restrained velocity look-ahead.
- Add a dead zone so small ball movement does not constantly move the camera.
- Keep replay and goal camera behavior compatible.

### Radar
- Keep all labels and instructional text outside the radar plot area.
- Establish marker hierarchy for selected player, ball, teammates, and opponents.
- Improve contrast without obscuring the pitch.
- Keep radar data renderer-independent.

### HUD hierarchy
- Score and time remain glanceable but secondary to the match.
- Player identity appears briefly on selection changes.
- Stamina remains compact and warns gently at low levels.
- Power appears only while charging an action.
- Context hints reduce prominence after initial onboarding and never overlap the radar.
- Motion follows reduced-motion settings.

## Out of scope
- Pause menu navigation and returning to match setup.
- Kit, ball, pitch, stadium, weather, or time selection.
- Settings architecture and control remapping.
- Gameplay, physics, AI, multiplayer, and game modes.

## Implementation slices

### U3.1.1 — Audit and contracts — Complete
- Audited camera and HUD calculations in `game.js`, HTML, and CSS.
- Added centralized `cameraHudConfig`.
- Added pure zoom, look-ahead, dead-zone, safe-area, and frame-target helpers.
- Added baseline camera tests.

### U3.1.2 — Camera framing — Complete in code
- Integrated shared framing into the normal WebGL camera.
- Reversed the old speed zoom behavior so fast play reveals more field.
- Added bounded velocity look-ahead and dead-zone tracking.
- Increased broadcast distance through logical zoom scaling.
- Preserved replay and goal camera branches.
- Kept Canvas fallback full-field rendering unchanged so it does not crop the pitch.

### U3.1.3 — Radar cleanup — Complete in code
- Radar maps players and ball using playable pitch bounds.
- Added a high-contrast ball marker.
- Added a selected-player ring distinct from team markers.
- Kept the plot free of text rendering.
- Moved the commentary toast above the radar on desktop and to a top safe region on narrow layouts.

### U3.1.4 — HUD polish — Next
- Refine scoreboard and clock weight.
- Add a restrained selected-player transition.
- Add a low-stamina warning state.
- Reduce contextual hint prominence after initial onboarding.
- Preserve reduced-motion behavior.

### U3.1.5 — Validation — In progress
- Camera policy and runtime contract tests pass.
- Radar no-text, marker hierarchy, stylesheet ordering, and overlap contracts pass.
- Full repository tests pass on the integrated source.
- Manual WebGL lower-corner, desktop, narrow-layout, replay, Canvas fallback, and reduced-motion validation remain.

## Acceptance criteria
- Lower-left and lower-right field areas remain visible during normal play.
- The selected player and ball are not pinned against unsafe viewport edges.
- Camera movement is smoother than direct ball locking and reveals useful attacking space.
- No text renders inside or over the radar plot area.
- Ball and selected-player radar markers are immediately distinguishable.
- Power and contextual hints do not remain permanently prominent.
- HUD does not overlap controls, radar, or critical play space on narrow layouts.
- No gameplay values or decisions change.
- CI passes on a clean branch.

## Current status
Camera framing and radar cleanup are integrated with automated contracts passing. HUD hierarchy polish and manual browser validation remain. Keep the PR Draft.
