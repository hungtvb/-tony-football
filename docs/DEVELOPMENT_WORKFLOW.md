# Development Workflow

## Definition of done

A coding task is not complete when code is pushed. It is complete only when:

1. the focused test suite passes;
2. the full local preflight passes;
3. the latest PR CI gate is green;
4. the final PR head SHA has not changed since that green run;
5. the PR is reviewed for deploy safety and obvious UX regressions.

## Required sequence

### 1. Work on a dedicated branch

- Start from the latest `main`.
- Use one branch per feature or hotfix.
- Keep the PR in Draft while implementation or CI repair is active.

### 2. Run focused validation first

Use the smallest relevant command while developing:

```bash
npm run test:presentation
npm run test:gameplay
npm run test:e2e:intro
```

Focused validation shortens feedback loops but never replaces full preflight.

### 3. Run full preflight before declaring the branch ready

```bash
npm ci
npx playwright install chromium
npm run test:preflight
```

The preflight includes syntax, asset validation, simulation, presentation, gameplay, desktop browser, and narrow-landscape browser tests.

### 4. Open or update a Draft PR

The PR description must include:

- user-visible behavior;
- files or systems touched;
- focused tests run;
- known risks and out-of-scope items.

### 5. Watch the latest CI run

CI is split into independent jobs:

- `Unit and contracts`
- `Playwright desktop`
- `Playwright narrow landscape`
- `CI gate`

When a job fails, inspect that job and its matching artifact directly. Do not wait for manual status reporting.

### 6. Repair failures on the same branch

- Read the exact failing assertion or browser trace.
- Fix runtime code or the stale test contract as appropriate.
- Avoid weakening assertions merely to make CI green.
- Re-run the focused suite, then full preflight.
- Confirm the newest CI run, not an older run.

### 7. Ready and merge rules

A PR may be marked Ready only when the latest `CI gate` is green.

A PR may be merged only when:

- the head SHA matches the SHA validated by the green CI run;
- all required jobs succeeded;
- there are no unresolved review threads;
- deploy-sensitive paths were checked for static hosting compatibility.

## Testing principles

- Prefer behavior assertions over exact implementation constants.
- Do not hard-code animation timing values unless the timing itself is the requirement.
- Browser tests must use deterministic debug hooks for simulation-dependent states.
- Existing regression tests may explicitly bypass a new presentation layer when that layer is not under test.
- New presentation flows require desktop and narrow-landscape coverage.

## Communication rule

After a push, report the current CI run and continue monitoring it. Do not report a task as complete until the latest run is green and the PR head remains unchanged.
