# Documentation Workflow

## New idea not yet approved
Update `docs/10_BACKLOG.md`. Do not modify the roadmap.

## Approved future feature
Update `docs/02_ROADMAP.md` and the relevant high-level specification.

## Sprint becomes active
Update `docs/01_ACTIVE_SPRINT.md`, `docs/00_PROJECT_CONTEXT.md`, and create/update `docs/sprints/<SPRINT>.md`.

## Gameplay behavior changes
Update the matching file under `docs/gameplay/`.

## UI behavior changes
Update the matching file under `docs/ui/`.

## Architecture changes
Create an ADR under `docs/adr/` using the ADR template.

## Bug fix
Usually update `docs/CHANGELOG.md`; update a spec when intended behavior changes.

## Sprint completed
Update active sprint, roadmap, changelog, decision log, and the sprint document.

## PR declaration
Every PR must state its documentation impact: none, changelog, specification, ADR, or roadmap/active sprint.