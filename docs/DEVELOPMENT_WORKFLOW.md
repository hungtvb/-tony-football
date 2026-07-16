# Development Workflow

## Definition of done

A coding task is not complete when code is pushed. It is complete only when:

1. the focused test suite passes;
2. the full local preflight passes;
3. the latest PR CI gate is green;
4. the final PR head SHA has not changed since that green run;
5. the PR is reviewed for deploy safety and obvious UX regressions.

## Required sequence

### 1. Recover the session and work on a dedicated branch

Repository docs are the persistent memory across chat sessions. At the start of each coding session, read `AGENTS.md`, fetch the latest GitHub `main` SHA, and compare it with the local `.local-runtime-sha` before modifying code.

When a new sprint starts:

1. Create the GitHub sprint branch directly from the latest `main` SHA.
2. Bootstrap or sync the local workspace to that same `main` SHA.
3. Create the matching local branch from local `main`:

```bash
cd /mnt/data/tony-football-local
bash scripts/start-local-sprint.sh feat/<sprint-name>
```

When resuming the same sprint, switch to the existing branch instead of creating another branch.

- One sprint equals one branch and one pull request.
- Never implement sprint work directly on local or remote `main`.
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
4. Immediately before bootstrap, fetch the current `main` SHA through the GitHub connector.
5. Unzip the runtime artifact and run its bundled bootstrap script with that exact SHA:

```bash
CURRENT_MAIN_SHA=<current-40-character-main-sha>
bash bootstrap-local-playwright.sh \
  /mnt/data/tony-local-runtime.zip \
  /mnt/data/tony-playwright-browsers.zip \
  --expected-main-sha "$CURRENT_MAIN_SHA" \
  --force
```

The bootstrap refuses the artifact before replacing existing generated output when its `.local-runtime-sha` differs from the supplied current `main` SHA. The generated workspace contains that exact `main` source, `node_modules`, Chromium, Firefox, and `.local-playwright-env`. It also initializes a local Git repository whose `main` branch is the verified runtime snapshot.

Before implementing a new sprint, create the matching GitHub branch from the same SHA and then create the local sprint branch:

```bash
cd /mnt/data/tony-football-local
bash scripts/start-local-sprint.sh feat/<sprint-name>
```

Use the repository validation scripts in this order:

```bash
bash scripts/run-local-preflight.sh unit
bash scripts/run-local-preflight.sh flow
bash scripts/run-local-preflight.sh webgl-desktop
bash scripts/run-local-preflight.sh webgl-narrow
```

`flow` runs every non-camera desktop and narrow Playwright test with offline Three.js imports. The WebGL commands run one representative renderer scenario in Firefox software WebGL. Run desktop and narrow WebGL as separate top-level commands because restricted chat containers may not reliably launch Firefox twice inside one parent process.

The local runtime is an early feedback mechanism, not the final merge signal. The regular PR CI still owns the complete Chromium desktop/narrow suites, including all camera/HUD scenarios, and the exact-head `CI gate` remains mandatory.

### 3b. Sync local work when GitHub `main` moves

The generated workspace has no Git remote, so do not use `git pull`. Preserve the sprint history with the verified snapshot import flow instead:

1. Commit the current local sprint work.
2. Trigger `/build-local-runtime` again and download artifacts for the new `main`.
3. Fetch the latest 40-character GitHub `main` SHA immediately before syncing.
4. Run:

```bash
cd /mnt/data/tony-football-local
bash scripts/sync-local-main.sh \
  /mnt/data/tony-local-runtime.zip \
  /mnt/data/tony-playwright-browsers.zip \
  --expected-main-sha <current-main-sha>
```

The sync script verifies the artifact before replacing generated files, commits the imported snapshot on local `main`, switches back to the current sprint branch, and rebases it onto the updated local `main`. Resolve any reported conflicts, continue the rebase, and rerun focused plus full validation.

Do not bootstrap with `--force` over an active sprint workspace; use `sync-local-main.sh` so committed sprint work remains recoverable.

Runtime safety rules:

- Only repository owner/member/collaborator comments are accepted.
- The workflow checks out only `main`; arbitrary refs are not accepted.
- The workflow verifies that `main` did not move before artifact upload and again immediately before publishing the ready comment.
- The bootstrap requires the current 40-character `main` SHA and refuses stale artifacts before deleting generated workspace contents.
- Artifacts expire after three days.
- The bootstrap script only replaces generated paths under `/mnt/data` or `.local-runtime`, and requires `--force` for non-empty output.
- The bootstrap creates a local `main` baseline; sprint work must begin on a separate local and GitHub branch.
- The sync script requires a clean committed worktree, imports only a verified current-`main` artifact, and rebases the existing sprint branch.
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
