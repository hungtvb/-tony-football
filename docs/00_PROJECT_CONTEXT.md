# Project Context

## Mission
Build Tony Football into a polished browser-based 6v6 football game with responsive controls, readable football behavior, strong AI, and a focused game UI.

## Source-of-truth boundaries

- **Linear** is the only mutable source for roadmap, backlog, priority, dependency, ownership, active delivery status, and cross-role handoffs.
- **GitHub** is the source for implementation evidence: issues, branches, commits, pull requests, reviews, CI, and merge state.
- **Repository documentation** stores stable technical context: architecture, source ownership, ADRs, technical sprint specifications, gameplay/UI contracts, validation rules, and operational procedures.

Current work must be recovered from the [Tony Football Linear project](https://linear.app/tony-football/project/tony-football-product-delivery-b20205c7650f), not inferred from repository filenames or archived sprint documents.

## Stable technical context

- Gameplay simulation is authoritative and advances on a fixed 60 Hz timestep.
- Input produces commands; presentation consumes snapshots and events.
- WebGL is the primary renderer and Canvas 2D remains the supported fallback.
- FIFA Online 4-style keyboard controls remain the default interaction model.
- Player models and animations retain explicit loading and fallback behavior.
- Static deployment must remain compatible with Vercel production and GitHub Pages unless an approved technical decision changes that constraint.
- Equal inputs and fixed timesteps must produce deterministic movement and gameplay outcomes.
- Presentation feedback must never modify simulation outcomes.
- Refactoring is incremental; avoid whole-project rewrites and avoid adding another major subsystem directly to `game.js`.

## Technical recovery path

For repository-level work, read only the relevant technical sources:

1. `AGENTS.md`
2. `docs/03_DEV_RULES.md`
3. `docs/05_ARCHITECTURE.md`
4. the relevant section of `docs/11_SOURCE_MAP.md`
5. relevant gameplay/UI specifications and ADRs
6. any technical sprint document linked from the active Linear issue

`docs/01_ACTIVE_SPRINT.md`, `docs/02_ROADMAP.md`, and `docs/10_BACKLOG.md` are stable pointers to Linear and do not carry mutable delivery state.
