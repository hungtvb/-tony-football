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

### 3a. Bootstrap a restricted ChatGPT container

Some ChatGPT sessions can execute local processes but cannot resolve public package/CDN hosts. In those sessions, use issue `#44` as the runtime control surface.

1. Comment exactly `/build-local-runtime` on issue `#44`.
2. Wait for the workflow reply containing the source SHA, workflow run ID, and two artifact names.
3. Download the runtime and browser artifacts through the GitHub connector.
4. Unzip the runtime artifact and run its bundled bootstrap script:

```bash
bash bootstrap-local-playwright.sh \
  /mnt/data/tony-local-runtime.zip \
  /mnt/data/tony-playwright-browsers.zip \
  --force
```

The generated workspace contains the exact `main` source, `node_modules`, Chromium, Firefox, and `.local-playwright-env`.

Use the repository scripts in this order:

```bash
cd /mnt/data/tony-football-local
bash scripts/run-local-preflight.sh unit
bash scripts/run-local-preflight.sh flow
bash scripts/run-local-preflight.sh webgl-desktop
bash scripts/run-local-preflight.sh webgl-narrow
```

`flow` runs every non-camera desktop and narrow Playwright test with offline Three.js imports. The WebGL commands run one representative renderer scenario in Firefox software WebGL. Run desktop and narrow WebGL as separate top-level commands because restricted chat containers may not reliably launch Firefox twice inside one parent process.

The local runtime is an early feedback mechanism, not the final merge signal. The regular PR CI still owns the complete Chromium desktop/narrow suites, including all camera/HUD scenarios, and the exact-head `CI gate` remains mandatory.

Runtime safety rules:

- Only repository owner/member/collaborator comments are accepted.
- The workflow always packages the latest `main`; arbitrary refs are not accepted.
- Artifacts expire after three days.
- The bootstrap script only replaces generated paths under `/mnt/data` or `.local-runtime`, and requires `--force` for non-empty output.
- No gameplay, deployment, or production HTML is modified to support offline testing.

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

Use `.github/skills/ci-triage/SKILL.md` for the complete reusable diagnosis, repair, and verification loop.

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
