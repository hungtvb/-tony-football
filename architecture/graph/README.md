# Tony Football architecture graph

This directory is the machine-readable architecture map for humans and AI agents.

## Commands

- `npm run graph:build` regenerates `graph.json`, `graph.mmd`, `graph.svg` and `index.html`.
- `npm run graph:check` validates source references, graph integrity, architecture direction and committed generated outputs.
- Open `architecture/graph/index.html` directly or use the deployed `/architecture/graph/` path.

## Update contract

Update `semantic-overrides.json` in the same pull request when runtime ownership, entry points, command/event/snapshot direction, focused tests or migration bridges change. Generated files are deterministic and must be committed with that change.

The graph intentionally models durable architecture rather than every helper function. Static import validation checks tracked modules for forbidden reverse dependencies; the semantic overlay records ownership and runtime relations that imports cannot prove.

Linear remains the planning source of truth. `docs/11_SOURCE_MAP.md` remains the human-readable navigation index. This graph is implementation evidence and a visual companion to that document.