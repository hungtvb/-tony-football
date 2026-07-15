# Backlog

Ideas here are not approved for implementation.

## Architecture and technical debt

### U3 Architecture Closeout

**Status:** Proposed — not active  
**Priority:** High before major U4, U5, G4, or AI expansion  
**Origin:** Source-structure audit after U3.3 Post-Match Hub

#### Why this exists

The deterministic simulation core and extracted gameplay helpers are in good shape, but `game.js` remains the composition root for simulation, match lifecycle, input, WebGL, Canvas fallback, radar, audio, DOM updates, debug scenarios, and several UI actions.

The presentation layer is also relying on DOM state as an integration boundary:

- score changes are inferred through `MutationObserver`
- replay state is inferred from the replay badge
- post-match statistics are read back from rendered DOM values
- navigation delegates through synthetic clicks on existing buttons
- presentation modules initialize through import side effects
- feature CSS files continue to accumulate at repository root

These patterns are acceptable for completing U3, but extending them further will increase timing conflicts, hidden initialization order, and cross-feature coupling.

#### Activation trigger

Activate this work after the U3 integrated browser audit and before adding substantial radar modes, onboarding flows, passing/shooting systems, or team AI.

Do not activate it in the middle of a gameplay-balance sprint unless a structural defect blocks that sprint.

#### Target outcomes

- `game.js` becomes a small explicit bootstrap/composition module rather than the owner of every subsystem.
- Presentation receives explicit runtime events instead of inferring game state from DOM mutations.
- One overlay coordinator owns Main Menu, Match Setup, Intro, Pause, Result, and future presentation surfaces.
- Presentation modules expose explicit `init...()` functions; import order no longer performs hidden initialization.
- Match settings and match-end snapshots have stable read-only contracts.
- WebGL, Canvas fallback, radar, audio, input, debug, and match lifecycle have clear module boundaries.
- CSS moves toward `src/styles` with shared tokens and component/screen ownership.
- Existing FO4 controls, simulation timing, gameplay balance, WebGL rendering, and Canvas fallback remain unchanged.

#### Proposed delivery sequence

##### Slice A — Runtime events and overlay ownership

- Add a small `GameEvents` contract using `EventTarget` or an equivalent native event abstraction.
- Emit explicit events such as:
  - `match:start`
  - `match:pause`
  - `score:changed`
  - `replay:start`
  - `replay:end`
  - `match:end`
- Add `OverlayCoordinator` as the single owner of visible navigation/presentation surfaces.
- Replace synthetic navigation clicks with explicit application commands where practical.
- Keep temporary DOM observers only as compatibility bridges, then remove them after equivalent event coverage exists.

##### Slice B — Explicit application bootstrap

- Add a dedicated bootstrap/composition module.
- Replace side-effect-only presentation imports with explicit initialization:
  - `initMainMenuFlow()`
  - `initMatchIntro()`
  - `initGoalPresentation()`
  - `initPostMatchHub()`
- Centralize DOM bindings and validate required elements at startup.
- Define read-only match settings and match summary snapshots.

##### Slice C — Reduce `game.js` ownership

Extract without changing behavior:

- match lifecycle and state transitions
- input/controller binding
- settings and persistence
- formations and static team data
- audio controller wiring
- debug scenario wiring

Each extraction must have focused unit or contract coverage before the next subsystem moves.

##### Slice D — Rendering and style organization

- Separate WebGL renderer, Canvas fallback renderer, and radar renderer behind stable render contracts.
- Preserve both rendering paths throughout the migration.
- Move feature styles from repository root into `src/styles`.
- Introduce shared design tokens before adding more UI surfaces.

#### Guardrails

- No rewrite of the entire game.
- No framework migration as part of this closeout.
- No TypeScript conversion requirement; JSDoc plus `checkJs` may be evaluated separately.
- No changes to fixed-step simulation, match duration, goal timing, replay duration, FO4 mappings, AI balance, passing, shooting, defending, goalkeeper behavior, or camera balance.
- No removal of Canvas fallback.
- Each pull request must remain independently deployable and preserve existing browser flows.
- Latest-head CI Gate must be green before merge.

#### Validation requirements

- Existing unit, desktop Playwright, and narrow-landscape Playwright suites remain green.
- New runtime-event contract tests verify event payloads and ordering.
- Overlay tests prove that no two modal navigation surfaces are visible simultaneously.
- Intro, goal, replay, Full Time, Play Again, Match Setup, and Main Menu flows remain behaviorally identical.
- Debug scenarios remain deterministic.
- WebGL and Canvas fallback smoke tests remain available.

#### Completion criteria

- Presentation no longer depends on score/result `MutationObserver` integrations.
- Presentation does not call hidden controls through `.click()` to execute application commands.
- `game.js` is primarily composition and top-level orchestration, with major subsystems extracted and tested.
- Module ownership is documented and enforced by tests or static checks.
- U4/G4/AI work can add features without editing unrelated rendering, navigation, and presentation internals.

## Future gameplay
- Local multiplayer
- Online rooms
- Additional game modes
- Penalty shootout
- Training
- Tournament
- Career mode

## Presentation
- Commentary
- Team customization
- More stadiums
- Expanded crowd behavior

## Platform
- Accounts
- Match history
- Ranking
- Backend services
