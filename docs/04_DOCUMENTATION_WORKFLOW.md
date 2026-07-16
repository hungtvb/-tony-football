# Documentation Workflow

## Source-of-truth rule

- Use **Linear** for mutable planning: ideas, roadmap, backlog, priority, sequencing, ownership, dependencies, active status, and cross-role handoffs.
- Use **GitHub** for implementation evidence: issues, branches, commits, pull requests, reviews, CI, and merge state.
- Use **repository documentation** for stable technical contracts: architecture, source ownership, ADRs, specifications, technical sprint scope, validation rules, and operational procedures.

## Planning changes

### New idea, approved feature, reprioritization, or backlog change

Create or update the relevant Linear issue. Do not add mutable planning data to `docs/02_ROADMAP.md` or `docs/10_BACKLOG.md`.

### Work becomes active, blocked, handed off, accepted, or completed

Update Linear with the owner, current state, dependency/blocker, exact GitHub evidence, and next action. Do not update repository files solely to reflect delivery status.

### Delivery identity

Use one `TON-x` identity across the Linear issue, GitHub issue, branch, pull request, review evidence, and final handoff.

## Technical documentation changes

### Gameplay behavior changes

Update the matching file under `docs/gameplay/`.

### UI behavior changes

Update the matching file under `docs/ui/`.

### Architecture changes

Create or update an ADR under `docs/adr/` and update `docs/05_ARCHITECTURE.md` when the accepted system boundary changes.

### Source ownership or entry-point changes

Update `docs/11_SOURCE_MAP.md` whenever a module moves, a new runtime entry point is added, dependency direction changes, or test ownership changes. Keep the map at subsystem and contract level; do not add line numbers or duplicate implementation details.

### Technical sprint record

A file under `docs/sprints/` may document technical scope, architecture, risks, validation, and accepted evidence. It must not be treated as the mutable source for priority, ownership, or delivery state.

### Bug fix

Usually update `docs/CHANGELOG.md`; update a specification when intended behavior changes.

## Pull request declaration

Every PR must state:

- its Linear `TON-x` issue;
- documentation impact: none, changelog, specification, ADR, source map, or operational procedure;
- exact validation evidence and known limitations.

After each material implementation, review, merge, or blocker event, write a durable handoff back to Linear. Chat-only information is not considered communicated.
