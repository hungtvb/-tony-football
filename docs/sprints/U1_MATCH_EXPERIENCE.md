# Sprint U1 — Match Experience and HUD Hierarchy

Status: In Progress

## Goal
Make Tony Football feel like a focused football game from setup to full time while preserving gameplay, controls, rendering, and performance.

## User-visible outcomes
- Gameplay occupies visual priority.
- Score, clock, selected player, stamina, radar, and context hints are readable at a glance.
- Technical asset status and persistent statistics no longer compete with gameplay.
- Pre-match choices are understandable before starting.
- Pause, controls, and settings are discoverable and keyboard accessible.

## Scope

### Pre-match
- Replace hero-like layout with match setup hierarchy.
- Show both teams, difficulty explanation, pitch, ball, weather, and camera summary.
- Keep one dominant Start Match action.
- Provide clear entries for Controls and Settings.

### In-match HUD
- Compact scoreboard and clock.
- Compact selected-player card with stamina and state.
- Radar as a gameplay overlay rather than a detached dashboard panel.
- Contextual attack/defense control hints.
- Temporary event toast instead of permanent commentary footer.
- Hide ready-state asset diagnostics during normal play.
- Move full statistics out of the permanent HUD.

### Radar
- Complete pitch markings.
- Strong selected-player ring.
- Ball and ball-carrier distinction.
- Goalkeeper distinction.
- Attack direction cue.
- Maintain readability over light and dark pitches.

### Pause and settings information architecture
- Resume, Controls, Match Statistics, Settings, Restart, Return to Setup.
- Settings categories: Gameplay, Camera, Graphics, Audio, Controls, Accessibility.
- Only expose settings backed by working behavior in this sprint.

### Accessibility and responsive behavior
- Full keyboard operation.
- Visible focus states.
- Correct dialog semantics and focus restoration.
- Minimum readable text sizes.
- Reduced-motion compatibility.
- HUD remains usable on laptop and narrow tablet layouts.

## Out of scope
- New gameplay rules or event systems.
- Cards, advantage, or offside logic that does not already exist.
- New AI behavior.
- New controls or remapping.
- Multiplayer or modes.
- Full visual-effects/game-feel overhaul; that belongs to U2.

## Implementation strategy
1. Audit current DOM, CSS, and UI update hooks.
2. Define UI tokens and component hierarchy without changing gameplay state.
3. Refactor pre-match and in-match layouts incrementally.
4. Preserve all existing element IDs required by `game.js`, or add a compatibility mapping.
5. Add UI state classes rather than embedding gameplay logic in DOM handlers.
6. Test WebGL and Canvas fallback paths.

## Acceptance criteria
- Start, pause, resume, restart, result, and setup flows remain functional.
- No existing FO4 control is removed or changed.
- Core gameplay canvas is not obscured by permanent panels.
- Score and clock remain readable at 1280×720 and common laptop widths.
- Selected player, stamina, radar, and contextual hints are understandable within three seconds.
- Technical ready messages disappear after initialization unless an asset fails.
- Dialogs are keyboard accessible and restore focus when closed.
- No console-breaking errors.
- Existing automated tests pass.

## Regression checklist
- Start match
- Movement and sprint
- Pass, through pass, loft pass, shoot, finesse, chip
- Defend and switch player
- Pause and resume
- Goal and replay
- Full-time and play again
- WebGL rendering
- Canvas fallback
- Model load and fallback
- GitHub Pages relative paths

## Documentation impact
Update:
- `docs/ui/HUD.md`
- `docs/ui/PREMATCH.md`
- `docs/ui/RADAR.md`
- `docs/ui/CONTROLS.md`
- `docs/ui/MENUS_SETTINGS.md`
- `docs/CHANGELOG.md`
- `docs/memory/DECISION_LOG.md`

## Definition of Done
U1 is done when implementation matches the specs, automated checks pass, the regression checklist is completed, and no permanent UI element competes with active gameplay without a clear gameplay purpose.
