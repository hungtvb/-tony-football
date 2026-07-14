# ADR-001 — Fixed Timestep

Status: Accepted

## Context
Gameplay currently updates using render frame delta, limiting determinism and testability.

## Decision
Run authoritative gameplay at a fixed 60 Hz timestep. Rendering remains independent.

## Consequences
- Requires accumulator and maximum substeps.
- Allows deterministic simulation tests.
- Rendering may interpolate between simulation states.