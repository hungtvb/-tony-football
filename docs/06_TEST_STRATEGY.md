# Test Strategy

Tony Football uses a validation pyramid that keeps gameplay correctness in deterministic Node tests and reserves browsers for composition and visual wiring.

## Required per-commit gate

### Fast engine and contracts

Run:

```bash
npm run test:engine:fast
```

This suite covers fixed simulation, engine contracts, gameplay systems, application/input boundaries and deterministic scenarios. The scenario runner uses public `MatchEngine` / runtime contracts, fixed seeds, explicit target ticks, immutable snapshots and ordered events. Failures include a compact trace of recent ticks, commands, events and state differences.

Core lifecycle scenarios include start/kickoff/play, pass and shot statistics, natural goal → ordered announcement phases → full replay → kickoff, pause/resume, restart, Full Time, equal-seed equivalence and event/snapshot immutability.

### Pure presentation

Run:

```bash
npm run test:presentation:fast
```

Presentation state and snapshot/event/phase projections run in Node without starting a server or browser.

### Complete browser-free gate

Run:

```bash
npm run test:ci:fast
```

This adds syntax, asset, tooling and static-build validation. It never installs or launches a browser.

### Minimal browser composition smoke

Run:

```bash
npm run test:e2e:smoke
```

The smoke suite proves static boot, live engine composition, input/application routing, snapshot/HUD lifecycle projection, WebGL, Canvas fallback, desktop wiring, narrow responsive wiring and absence of uncaught startup/runtime errors. Gameplay rules and lifecycle correctness are not re-proven here.

## Broad browser evidence

The original desktop and narrow suites remain available:

```bash
npm run test:e2e:broad
npm run test:e2e:desktop:broad
npm run test:e2e:narrow:broad
```

They run through the manual/scheduled `Playwright Regression` workflow and remain appropriate for visual changes, renderer work, focused regression diagnosis and release evidence. They are not duplicated on every implementation commit.

## Principles

- Use seeded random and fixed ticks for gameplay and lifecycle validation.
- Schedule immutable commands at explicit target ticks.
- Use only public engine/runtime contracts; never mutate private state or inject score/replay facts.
- Assert event and snapshot agreement from the same engine step.
- Keep browser assertions focused on composition, rendering and responsive presentation.
- For reproducible bugs, add a failing scenario or pure projection test before the fix where practical.
