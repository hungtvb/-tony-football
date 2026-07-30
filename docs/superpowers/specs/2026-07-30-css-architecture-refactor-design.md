# TON-37 CSS Architecture Refactor Design

## Context

Tony Football currently loads seven production stylesheets from the repository root. Their names encode delivery history (`u1-*`, `u3-*`) instead of responsibility, and the static page relies on an implicit override chain. Three presentation flows also construct root-relative stylesheet URLs at runtime.

The Product Owner approved consolidating these styles under `src/styles/`, using responsibility-based names, and treating the current local `css/style.css` refinement as the intended canonical core source. This activation is an explicit sequencing override of the older TON-37 handoff that recommended waiting for TON-64. The work remains isolated from TON-85 and does not change gameplay or renderer ownership.

## Goals

- Put all production CSS under `src/styles/`.
- Replace sprint-prefixed names with responsibility-based names.
- Expose one static stylesheet entry point from `index.html`.
- Make stylesheet order and ownership explicit.
- Preserve the approved local visual refinements and current responsive behavior.
- Preserve static Vercel and GitHub Pages deployment.
- Add regression coverage for paths, ordering, and lazy stylesheet ownership.

## Non-goals

- No gameplay, simulation, FO4 control, player model, WebGL, or Canvas changes.
- No TON-85 presentation bridge cleanup.
- No Sass, PostCSS, runtime bundler, or CSS-in-JS dependency.
- No new visual redesign beyond the already approved working-tree refinements.
- No selector renaming unless required to eliminate a demonstrably duplicate rule.

## Target structure

```text
src/styles/
├── app.css
├── tokens.css
├── foundation.css
├── match.css
├── match-flow.css
├── match-intro.css
├── goal-presentation.css
└── post-match.css
```

### Ownership

- `tokens.css`: root custom properties and global theme primitives.
- `foundation.css`: reset, typography, application shell, shared buttons, shared overlays, shared animation primitives, and foundation responsive rules.
- `match.css`: pitch layout, scoreboard, match HUD, radar, match cards, and camera/HUD presentation refinements. It consolidates the current `u1-match-experience.css` followed by `u3-camera-hud.css` so their cascade order is preserved.
- `match-flow.css`: main menu, setup, pause navigation, and match-flow responsive behavior.
- `match-intro.css`: match-intro overlay owned by `MatchIntroFlow`.
- `goal-presentation.css`: goal overlay owned by `GoalPresentationFlow`.
- `post-match.css`: full-time/results hub owned by `PostMatchHub`.
- `app.css`: import-only static entry point.

## Loading contract

`index.html` links only:

```html
<link rel="stylesheet" href="src/styles/app.css" />
```

`app.css` imports in this exact order:

```css
@import url("./tokens.css");
@import url("./foundation.css");
@import url("./match.css");
@import url("./match-flow.css");
```

Match intro, goal presentation, and post-match styles remain separate and are loaded once by their presentation owners. Each owner resolves its stylesheet relative to its JavaScript module:

```text
MatchIntroFlow.js       → ../../styles/match-intro.css
GoalPresentationFlow.js → ../../styles/goal-presentation.css
PostMatchHub.js         → ../../styles/post-match.css
```

This removes the current duplicate eager/dynamic match-intro path while retaining the existing `data-*`/ID guard that prevents repeated insertion.

## Migration strategy

1. Use the approved `css/style.css` as the canonical core input.
2. Extract only the `:root` token block into `tokens.css`; keep the remaining core rules in their current relative order in `foundation.css`.
3. Concatenate the approved `u1-match-experience.css` and `u3-camera-hud.css` contents into `match.css`, preserving source order and adding ownership section comments.
4. Move the approved match-flow, intro, goal, and post-match contents to their responsibility-based targets without selector rewrites.
5. Update all HTML, JavaScript, test, validation-script, and documentation references.
6. Remove the seven obsolete root stylesheets and the temporary `css/style.css` only after reference and content checks pass.

The first delivery favors cascade safety over aggressive selector deduplication. Removing override chains safely requires visual and computed-style evidence; responsibility-based consolidation is the architectural boundary for this task.

## Failure behavior

- A missing static stylesheet must fail the asset/path guard and static build tests.
- A lazy stylesheet load failure remains visible through the browser console/network evidence; no silent Canvas or renderer fallback is introduced by this task.
- Presentation flow initialization remains idempotent: an existing link marker is reused and duplicate links are not appended.
- CSS continues to represent presentation state through existing classes and data attributes only; it cannot mutate gameplay state.

## Validation

Automated checks:

- add a focused CSS architecture test asserting the target files, exact `app.css` import order, one static page link, valid lazy paths, and absence of production root CSS/sprint-prefixed references;
- update existing presentation tests to read the new paths;
- update asset validation to assert `src/styles/app.css`;
- run focused presentation tests;
- run `git diff --check`;
- run `npm run test:ci:fast`;
- run desktop and narrow Playwright smoke coverage.

Manual checks:

- main menu, setup, and mode cards;
- match intro transition;
- match HUD, radar, scoreboard, pause menu, and responsive layout;
- goal presentation;
- post-match hub;
- browser console/network for missing stylesheets;
- desktop and narrow viewport comparison for material visual regressions.

## Documentation impact

Update `docs/11_SOURCE_MAP.md` with the static stylesheet entry point, the shared match/HUD layer, and the three presentation-owned lazy stylesheets. Mutable scope, status, ownership, and validation evidence remain in Linear TON-37 and GitHub issue #106.

## Risks and mitigations

- **Cascade drift:** preserve source order and avoid broad selector rewrites; verify browser flows.
- **Broken module-relative URLs:** cover exact hrefs in presentation tests and browser smoke.
- **Static build omissions:** rely on the recursive static extension copy and verify the built tree.
- **Unrelated user changes lost:** keep the existing working tree intact and commit only reviewed in-scope files.
- **Collision with TON-85:** do not touch bridge-removal ownership or frozen TON-85 work.
