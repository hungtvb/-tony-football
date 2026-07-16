# Active Sprint

```yaml
Sprint: R1
Title: Engine and Presentation Boundary
Status: In Progress — Slice D2b interpolated entity transforms complete
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/R1_ENGINE_PRESENTATION_BOUNDARY.md
Primary goals:
  - define immutable gameplay commands and deterministic buffering
  - define explicit ordered gameplay events
  - define deeply read-only match snapshots with stable entity identifiers
  - enforce that engine modules remain independent of DOM, Three.js, Canvas, audio, and render frames
  - prepare parity-first extraction of authoritative state from game.js
Architecture:
  - fixed 60 Hz SimulationLoop remains unchanged
  - engine contracts contain only plain serializable JavaScript data
  - presentation consumes snapshots and events but never owns authoritative gameplay
  - game.js compatibility bridges remain until each extraction has equivalent tests
Validation required:
  - command validation, immutability, buffering, and ordering tests
  - event immutability and deterministic ordering tests
  - snapshot identity, ownership, immutability, and interpolation-frame tests
  - engine import-boundary tests
  - all existing simulation, gameplay, presentation, and asset tests
  - desktop and narrow browser flows for score, replay, and match-ended events
  - WebGL and Canvas fallback browser coverage for snapshot-driven HUD/radar and entity transforms
Do not modify:
  - simulation timing
  - movement, possession, pass, shot, tackle, or goalkeeper balance
  - FO4 control mapping
  - WebGL, Canvas fallback, models, camera, or presentation behavior
Next slices:
  - Slice D2c Snapshot/event-driven camera, replay, and audio facts
  - Slice E Explicit bootstrap and compatibility cleanup
```

Only one sprint may be active at a time.
