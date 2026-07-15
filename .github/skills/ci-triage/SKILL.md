---
name: ci-triage
description: Diagnose, repair, and verify GitHub Actions CI failures for the active pull request without waiting for the user to report each failed run.
---

# CI Triage Skill

Use this skill whenever the user says `check CI`, `fix CI`, `CI failed`, mentions a failed run number, or asks whether a pull request is ready to merge.

## Goal

Take ownership of the full CI feedback loop:

1. identify the current pull request and exact head SHA;
2. inspect the newest workflow run for that SHA;
3. isolate the failing job, step, assertion, trace, or artifact;
4. fix the root cause on the same branch;
5. run focused validation and full preflight;
6. verify a new CI run on the new head SHA;
7. stop only when the latest `CI gate` is green or a concrete external blocker is proven.

The user must not have to open GitHub, read logs, or report another failed run manually.

## Required repository context

Read these before changing code:

1. `AGENTS.md`
2. `docs/01_ACTIVE_SPRINT.md`
3. `docs/03_DEV_RULES.md`
4. `docs/DEVELOPMENT_WORKFLOW.md`
5. the active sprint document
6. files and tests directly related to the failing job

Do not scan unrelated documentation or rewrite unrelated systems.

## Non-negotiable rules

- Work on the pull request's existing head branch.
- Keep the pull request Draft while CI repair is active.
- Always match workflow runs to the current PR head SHA.
- Ignore cancelled, superseded, or older runs after the head SHA changes.
- Never claim CI is green from a run belonging to an older SHA.
- Read the exact failing job before changing code.
- Prefer root-cause fixes over retries.
- Retry without code changes only when logs prove an external or flaky infrastructure failure.
- Do not weaken assertions only to obtain a green build.
- Prefer behavioral assertions over exact internal constants.
- Preserve existing gameplay, controls, WebGL, Canvas fallback, and deploy behavior unless the failure directly requires a scoped change.
- Do not merge unless the user explicitly asks.

## Workflow

### 1. Resolve the active PR

Determine:

- repository;
- PR number;
- base branch;
- head branch;
- current head SHA;
- Draft/Ready state;
- mergeability.

When the user supplies only a run number, trace it back to its branch, SHA, and PR before editing.

### 2. Select the correct workflow run

Fetch runs associated with the exact current head SHA.

Select the newest run. Record:

- run number and run ID;
- status and conclusion;
- head SHA;
- workflow name.

If the run is queued or in progress, inspect available jobs but do not evaluate readiness yet.

### 3. Inspect jobs before logs

List all jobs and classify them:

- `Unit and contracts`;
- `Playwright desktop`;
- `Playwright narrow landscape`;
- `CI gate`;
- any future required job.

The gate is normally a downstream symptom. Diagnose the first real failed prerequisite job rather than editing the gate.

### 4. Read the smallest useful evidence

Use this order:

1. failed step summary;
2. failed job log around the assertion or stack trace;
3. matching uploaded artifact;
4. Playwright trace, screenshot, video, or error context;
5. related source and test files.

Avoid reading thousands of unrelated log lines. Search for terms such as:

- `Error:`
- `AssertionError`
- `Expected`
- `Received`
- `Timeout`
- `failed`
- `exit code`
- the failing test title

### 5. Classify the failure

Choose one primary category:

#### Runtime defect

The application behavior is incorrect. Fix production code and add or strengthen regression coverage.

#### Stale test contract

The intended behavior changed, but a test still asserts obsolete implementation details. Update the test to assert the accepted behavior. Do not simply delete coverage.

#### Test race or nondeterminism

The test relies on wall-clock timing, animation duration, asynchronous module registration, or simulation luck. Replace timing guesses with deterministic readiness/state hooks.

#### Test isolation failure

A test unintentionally passes through a new presentation layer or inherits state from another scenario. Use a documented test-only bypass or fresh page when that layer is not under test.

#### CI configuration defect

The command, glob, artifact path, dependency setup, browser installation, job dependency, or gate condition is incorrect. Fix the workflow and validate its semantics.

#### External infrastructure failure

Examples include GitHub service failure, package registry outage, runner termination, or network timeout before tests begin. Record evidence, then rerun the failed job once. Do not edit product code without evidence.

### 6. Reproduce with the focused command

Use the narrowest relevant command first:

```bash
npm run test:presentation
npm run test:gameplay
npm run test:e2e:intro
npm run test:e2e:desktop
npm run test:e2e:narrow
```

Then run the full preflight before declaring the repair ready:

```bash
npm ci
npx playwright install chromium
npm run test:preflight
```

When the execution environment cannot run local commands, compensate by:

- reviewing the exact command from the workflow;
- making the smallest evidence-backed change;
- relying on the next CI run as validation;
- never claiming local validation occurred.

### 7. Push the repair and follow the new run

After every repair commit:

1. fetch the PR again;
2. record the new head SHA;
3. find the newest workflow run for that SHA;
4. ignore runs for all previous SHAs;
5. inspect failures directly if the new run turns red;
6. repeat the loop without waiting for the user to report it.

Do not mark the PR Ready while any required job is pending or failed.

### 8. Verify completion

The CI repair is complete only when all are true:

- the latest run belongs to the current PR head SHA;
- all required jobs succeeded;
- `CI gate` succeeded;
- the PR head SHA has not changed after the green run;
- there are no unresolved review blockers;
- deploy-sensitive changes were checked for static hosting compatibility.

Only then may the PR be marked Ready. Merging still requires explicit user instruction.

## Common Tony Football patterns

### Presentation flow race

Wait for explicit debug readiness and state diagnostics rather than clicking immediately after `DOMContentLoaded` or sleeping for a fixed duration.

### Animation timing test

Assert stage order, visibility, state transition, and bounded positive timing. Do not hard-code exact millisecond constants unless exact timing is itself a product requirement.

### Existing regression test crossing a new layer

Use an explicit query flag such as a test-only presentation bypass when the bypass is documented and the presentation layer has its own dedicated tests.

### Slow Playwright runner

Reduce expensive actionability interactions in fixture setup, use deterministic DOM setup where appropriate, and give only the affected suite a justified timeout. Do not globally inflate all timeouts first.

### CI gate failure

Inspect prerequisite jobs. Never treat the gate's failure message as the root cause when an upstream job is red.

## Communication format

### While diagnosing

Report one concise update containing:

- run number;
- failed job;
- confirmed failure category;
- next repair action.

### After a repair commit

Report:

- root cause;
- files changed;
- focused validation performed or not available;
- new head SHA;
- newest CI run number and current status.

### When complete

Report:

- latest green run number;
- validated head SHA;
- required job results;
- PR Draft/Ready state;
- whether it is safe to merge.

Do not say `done`, `complete`, or `ready to merge` while the latest CI run is queued, running, failed, cancelled, or belongs to an older SHA.

## Invocation examples

- `Use ci-triage and check PR #36.`
- `CI failed, diagnose and fix it.`
- `Check run #207 and continue until the current CI gate is green.`
- `Verify whether this PR is safe to merge.`
