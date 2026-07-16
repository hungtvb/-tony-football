# Delivery Planning Pointer

This repository does not maintain a mutable active-sprint record.

## Current delivery source

Use the [Tony Football Linear project](https://linear.app/tony-football/project/tony-football-product-delivery-b20205c7650f) for:

- active and queued work;
- priority and sequencing;
- ownership and role handoffs;
- dependencies and blockers;
- delivery status and acceptance state.

## Session alignment

Before acting on a `TON-x` item:

1. read the latest Linear issue description and handoff comments;
2. confirm the active owner and detect branch/file ownership collisions;
3. correlate the Linear issue with its GitHub issue, branch, and pull request;
4. verify the exact GitHub head SHA and current CI/review freshness;
5. write a durable Linear update after each material implementation, review, merge, or blocker event.

Chat-only information is not considered communicated to the team.

## Repository technical records

Files under `docs/sprints/` remain technical scope and validation records. They may explain architecture, contracts, risks, and acceptance evidence, but they do not indicate current priority, ownership, or delivery status.

Use `docs/00_PROJECT_CONTEXT.md`, `docs/05_ARCHITECTURE.md`, `docs/11_SOURCE_MAP.md`, relevant specifications, and accepted ADRs to recover technical context.
