# GitHub Actions Workflow Security Policy

## Purpose

GitHub Actions validates and deploys reviewed repository content. It must not become an alternate source-publication channel or mutate the branch whose exact head is under review.

The required gate is `scripts/check-workflow-policy.mjs`. It scans every `.yml` and `.yaml` file directly under `.github/workflows` and runs through `npm run test:tooling`, which is part of the required browser-free CI lane.

## Default policy

Repository workflows are read-only by default.

The scanner reports these policy codes:

- `unallowlisted-contents-write`: repository write permission lacks an exact path-scoped exception;
- `direct-git-push`: a workflow attempts direct repository ref publication;
- `workflow-self-commit`: a workflow creates repository commits;
- `source-patch-application`: a workflow applies a transported source patch;
- `encoded-patch-transport`: encoded source payload transport is present;
- `rewrite-and-publish`: repository source, tests, documentation, scripts, workflows, `game.js`, or `package.json` are rewritten and then published;
- `workflow-self-delete`: a workflow removes itself or its transport files;
- `exception-trigger-mismatch`, `unused-exception`, and `stale-exception`: an exception is broader than reviewed, no longer needed, or no longer attached to a workflow.

Transport violations remain prohibited even when a workflow has an approved repository-write exception. A legitimate release or deployment writer must use a reviewed GitHub action or API operation and may not publish developer source changes.

## Exception registry

All write exceptions live in `.github/workflow-policy-allowlist.json`.

Each exception must contain:

```json
{
  "path": ".github/workflows/release.yml",
  "owner": "release-maintainers",
  "reason": "Publish reviewed release assets without modifying repository source",
  "reviewIssue": "TON-123",
  "allowedTriggers": ["workflow_dispatch"],
  "permissions": ["contents:write"]
}
```

Rules:

1. `path` is an exact repository-relative `.github/workflows/*.yml` or `.yaml` path. Globs and directory-wide exceptions are not allowed.
2. `owner`, `reason`, and `reviewIssue` are mandatory and identify who maintains the exception and where it was approved.
3. `allowedTriggers` enumerates every trigger used by the workflow. Adding any trigger requires an allowlist update and fresh review in the same pull request.
4. `permissions` explicitly contains `contents:write`; no implicit or workspace-wide exception exists.
5. An allowlist entry fails once its workflow disappears or no longer requests write permission. Remove stale entries in the same change.
6. An exception permits only the documented release/deployment write. It never suppresses transport violation codes.

## Approved review flow

A new or changed exception requires:

1. a dedicated Linear item or linked approval issue;
2. architecture/security review of the exact workflow path, triggers, permissions, external actions, and write operation;
3. focused fixture coverage when the exception introduces a new safe pattern;
4. required CI green on the unchanged exact head;
5. removal or narrowing when the write requirement ends.

Release and deployment workflows should prefer manual dispatch, environment protection, immutable reviewed artifacts, and GitHub release/deployment APIs. They remain read-only unless the documented operation technically requires repository write access.

## Branch-history handling

Removing a prohibited workflow in a later commit does not automatically make every merge method safe.

Before merge, either:

- cleanly rewrite the branch from an approved baseline, or
- squash only the independently reviewed final tree.

A merge strategy must not import rejected transport commits into `main`. Any branch rewrite or new exact head invalidates previous Reviewer and SA clearance.

## Validation

Run the workflow-policy command, the complete tooling suite, and the browser-free CI suite before handoff.

The fixture suite proves:

- normal read-only PR and main-branch CI passes;
- unallowlisted repository-write permission fails;
- the TON-63 incident pattern reports all transport violation codes;
- a narrow documented release exception passes only on its declared path and triggers;
- stale, unused, malformed, or trigger-broadened exceptions fail.
