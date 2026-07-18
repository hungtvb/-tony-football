# GitHub Actions Workflow Security Policy

GitHub Actions validates and deploys reviewed content. It must not become an alternate source-publication channel or mutate the exact branch head under review.

`scripts/check-workflow-policy.mjs` scans every `.yml` and `.yaml` file directly under `.github/workflows`. It runs through `test:tooling` and therefore the required browser-free CI lane.

## Default boundary

Workflows are read-only by default. The structural extractor evaluates top-level triggers, workflow-level and job-level permissions, step `run` and `uses` values, and executable `actions/github-script` scripts. Comment-only lines are ignored.

The scanner rejects:

- `contents: write` without an exact exception and all `permissions: write-all` grants;
- direct `git push`, workflow-created commits and auto-commit actions;
- source patch application and encoded patch transport;
- GitHub/Octokit file, blob, tree, commit and ref mutations;
- rewrite-and-publish behavior and workflow/transport self-deletion.

Every diagnostic contains the rule ID, workflow path, job ID and reason. Transport rules cannot be suppressed by an exception.

## Exact exception registry

Write exceptions live only in `.github/workflow-policy-allowlist.json` and bind all of these fields:

```json
{
  "path": ".github/workflows/release.yml",
  "job": "publish",
  "owner": "release-maintainers",
  "reason": "Publish reviewed release assets",
  "reviewIssue": "TON-123",
  "allowedTriggers": ["workflow_dispatch"],
  "permissions": ["contents:write"]
}
```

The path and job are exact; globs and workflow-wide grants are invalid. The workflow trigger set must exactly equal `allowedTriggers`, so adding `pull_request_target`, `push`, or any other event requires review. Only `contents:write` can be excepted. Missing, duplicate, stale, unused, job-mismatched or trigger-broadened entries fail.

An exception requires a dedicated tracking issue, named owner and architecture/security review of the exact workflow, job, triggers, permission, external actions and write operation. It never permits source, test, documentation, script or workflow patch transport.

## Review and history

Release/deployment writers should prefer manual dispatch, protected environments, immutable reviewed artifacts and release/deployment APIs. Required CI must be green on the unchanged exact head.

Removing a prohibited transport workflow in a later commit does not sanitize branch history. Before merge, either cleanly rewrite from an approved baseline or squash only the independently reviewed final tree. Any new exact head invalidates previous Reviewer and SA clearance.

## Fixture matrix

The tooling suite proves read-only `.yml` and `.yaml` workflows pass; banned words in comments do not trigger; workflow/job write grants, `write-all`, `pull_request_target` broadening, direct push/commit, auto-commit actions, encoded patch application, Octokit mutation and self-delete fail; read-only GitHub Script and ordinary artifact decoding pass; and exact path/job exceptions cannot suppress transport findings.
