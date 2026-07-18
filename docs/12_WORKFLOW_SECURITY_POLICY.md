# GitHub Actions Workflow Security Policy

GitHub Actions validates and deploys reviewed content. It must not become an alternate source-publication channel or mutate the exact branch head under review.

`scripts/check-workflow-policy.mjs` recursively scans every `.yml` and `.yaml` file under `.github/workflows`. It runs through `test:tooling` and therefore the required browser-free CI lane.

## Default boundary

Workflows are read-only by default. The structural extractor evaluates top-level triggers, workflow-level and job-level permissions, flow-style permission maps, block-style jobs and steps, step `run` and `uses` values, and executable `actions/github-script` scripts. YAML comments and shell comment-only content are ignored.

Because the validator is deliberately dependency-free, unsupported flow-style job mappings, step sequences and executable keys fail closed with `yaml-flow-policy-structure-unsupported`. Inline permission maps remain supported. A write-authorized job's `actions/github-script` `with.script` body may not load modules or files at all; this closes literal and constructed paths through `require`, dynamic `import`, filesystem APIs, `path.resolve`, `process.cwd()`, or `GITHUB_WORKSPACE`.

The scanner rejects:

- workflow-level repository write permission, unallowlisted job-level `contents: write`, and all `permissions: write-all` grants;
- direct Git publication commands, including option-prefixed commands, workflow-created commits and auto-commit/self-push actions;
- source patch application and encoded patch transport;
- GitHub/Octokit file, blob, tree, commit and ref mutations, including ref creation;
- rewrite-and-publish behavior and workflow/transport self-deletion;
- repository-local scripts, npm scripts, executables, or composite actions invoked from a `contents: write` job.

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

The path and concrete job are exact; globs and workflow-wide grants are invalid. The workflow trigger set must exactly equal `allowedTriggers`, so adding any event requires review. Quoted and unquoted inline trigger forms are normalized before comparison. Only `contents:write` can be excepted. Missing, duplicate, stale, unused, job-mismatched or trigger-broadened entries fail.

`pull_request`, `pull_request_target`, `push`, and `workflow_run` are high-risk write triggers. An exception that intentionally uses one of them must also set `"allowHighRiskTriggers": true`; otherwise the scanner emits `high-risk-write-trigger`. This flag records acknowledgement only. It never suppresses source-publication, patch-transport, API-mutation, or self-delete findings.

An exception requires a dedicated tracking issue, named owner and architecture/security review of the exact workflow, job, triggers, permission, external actions and write operation. It never permits source, test, documentation, script or workflow patch transport.

## Review and history

Release/deployment writers should prefer manual dispatch, protected environments, immutable reviewed artifacts and release/deployment APIs. Required CI must be green on the unchanged exact head.

Removing a prohibited transport workflow in a later commit does not sanitize branch history. Before merge, either cleanly rewrite from an approved baseline or squash only the independently reviewed final tree. Any new exact head invalidates previous Reviewer and SA clearance.

## Fixture matrix

The tooling suite proves:

- the current read-only workflow tree, scheduled browser evidence, `.yml`, `.yaml`, and nested workflow paths pass recursive discovery;
- banned terms in block and inline comments do not trigger;
- workflow/job write grants, flow-style permission maps, `write-all`, and high-risk trigger broadening fail unless the exact reviewed exception applies;
- direct publication, option-prefixed Git commands, auto-commit/self-push actions, encoded patch application, Octokit ref mutation and self-delete fail;
- read-only GitHub Script and ordinary artifact decoding pass;
- exact path/job exceptions cannot suppress transport findings;
- flow-style job/step/executable structures fail closed before the line extractor can miss them;
- an allowlisted write job that invokes a repository-local publishing script, loads any module/file from GitHub Script, or constructs such a path fails with `write-job-local-executable`.
