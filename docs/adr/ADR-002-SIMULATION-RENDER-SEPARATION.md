# ADR-002 — Simulation and Rendering Separation

Status: Accepted

## Decision
Three.js and Canvas are presentation adapters. They may read simulation state but must not own or mutate authoritative gameplay behavior.