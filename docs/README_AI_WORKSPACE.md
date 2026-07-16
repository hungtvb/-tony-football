# Tony Football AI Workspace v6

## Source-of-truth entry points

- Mutable planning and cross-role handoffs: [Tony Football Linear project](https://linear.app/tony-football/project/tony-football-product-delivery-b20205c7650f)
- Collaboration contract: [Tony Football Way of Work](https://linear.app/tony-football/document/tony-football-way-of-work-2d97168dcd1b)
- Session reconciliation: [Tony Football Alignment Protocol](https://linear.app/tony-football/document/tony-football-alignment-protocol-fa0c49f59d44)
- GitHub implementation entry point: `AGENTS.md`
- Antigravity entry points: `.agent/rules/` and `.agent/workflows/`
- Stable technical context: `docs/`

## Mandatory session order

1. Read the assigned Linear `TON-x` issue and its latest handoff comments.
2. Confirm the active role, owner, dependency state, and file/branch collision risk.
3. Correlate the Linear item with its GitHub issue, branch, pull request, and exact head SHA.
4. Read `AGENTS.md`.
5. Read `docs/00_PROJECT_CONTEXT.md` and `docs/03_DEV_RULES.md`.
6. Read only the relevant section of `docs/11_SOURCE_MAP.md`.
7. Read only the relevant technical sprint file, specification, and ADR.
8. Inspect the affected code and tests.

Do not scan every document by default. Do not infer current work from `docs/01_ACTIVE_SPRINT.md`, `docs/02_ROADMAP.md`, `docs/10_BACKLOG.md`, or historical sprint files; Linear owns mutable delivery state.

## Session and branch invariant

At the beginning of every coding session:

1. fetch the latest GitHub `main` SHA;
2. verify or safely sync the restricted local workspace;
3. create one GitHub branch and one matching local branch for the assigned `TON-x` item, or resume the existing assigned branch;
4. never code directly on `main`;
5. test changed local files before publishing;
6. publish through GitHub file APIs or an atomic Git object update;
7. record branch, exact head SHA, tests, blockers, and next owner in Linear after material events.

Chat-only information is not considered communicated. Restricted-container commands are documented in `docs/DEVELOPMENT_WORKFLOW.md`.

## System boundaries

- Linear: roadmap, backlog, priority, ownership, dependencies, delivery status, acceptance, and handoffs.
- GitHub: implementation scope, branches, commits, PR review, CI, and merge evidence.
- Repository docs: architecture, source map, ADRs, specifications, technical sprint records, validation contracts, and operational procedures.
