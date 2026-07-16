# Tony Football — Agent Entry Point

This file is the mandatory entry point for repository-level AI agents.

## Read first

Before planning or modifying code, read in this order:

1. `docs/00_PROJECT_CONTEXT.md`
2. `docs/01_ACTIVE_SPRINT.md`
3. `docs/03_DEV_RULES.md`
4. The file referenced by `Sprint document` in `01_ACTIVE_SPRINT.md`
5. The relevant section of `docs/11_SOURCE_MAP.md`
6. Only the relevant specification files
7. Only the relevant ADR files

Do not scan every document by default.

## Persistent session startup

Repository documentation is the persistent memory across chat sessions. Do not rely on a previous conversation to reconstruct the workflow.

At the beginning of every new coding session:

1. Read the mandatory files above.
2. Fetch the latest GitHub `main` SHA through the GitHub connector.
3. Compare it with `.local-runtime-sha` in the generated workspace.
4. If no verified local Git workspace exists, bootstrap the current runtime artifact.
5. If `main` moved, commit the current sprint work and run `scripts/sync-local-main.sh` before editing further.
6. When starting a new sprint, create the GitHub branch directly from the latest `main`, then create the same local branch with `scripts/start-local-sprint.sh`.
7. When resuming an existing sprint, resume its existing branch instead of creating a replacement branch.

Never implement sprint work directly on local or remote `main`. One sprint still equals one branch and one pull request.

## Publishing local changes

Restricted local workspaces may not contain an authenticated Git remote. Use the local workspace to edit, test, inspect diffs, and create recoverable local commits, but publish repository changes through the GitHub connector.

Required publishing path:

1. Create or reuse the task branch from the latest verified `main` SHA.
2. Publish file changes with GitHub file APIs or an atomic blob/tree/commit/ref update.
3. Open or update the task pull request from that branch.
4. Verify that the published branch head matches the intended local change.
5. Run and monitor standard exact-head PR CI.

Do not:

- Create a temporary GitHub Actions workflow or script whose purpose is to decode, apply, commit, or push a patch.
- Grant `contents: write` to a PR workflow merely to transport code from a local workspace.
- Encode source patches in workflow YAML, repository secrets, issue comments, or workflow inputs.
- Make a workflow delete itself or its patch payload after pushing.
- Treat a transport workflow as implementation validation or as part of the required CI gate.

If the GitHub connector cannot safely publish an atomic multi-file change, report the publishing blocker on the related Linear/GitHub item. Do not invent a write-enabled transport workflow as a workaround.

## Scope rule

Implement only the active sprint unless the user explicitly requests another task.

Do not:
- Start multiplayer or game-mode work.
- Rewrite the whole project.
- Expand `game.js` with another large subsystem.
- Change the FO4 control mapping without approval.
- Remove WebGL or Canvas fallback.
- Merge directly to `main`.
- Perform destructive repository or filesystem operations without explicit approval.

## Source-of-truth priority

1. Direct user instruction
2. `docs/00_PROJECT_CONTEXT.md`
3. `docs/01_ACTIVE_SPRINT.md`
4. Accepted ADRs
5. Gameplay/UI specifications
6. `docs/02_ROADMAP.md`
7. `docs/10_BACKLOG.md`
8. Existing code comments

Report unresolved contradictions before implementation.

## Operational skills

Use repository skills for repeatable operational workflows:

- **CI triage:** `.github/skills/ci-triage/SKILL.md`
  - Triggered by requests such as `check CI`, `fix CI`, `CI failed`, a workflow run number, or merge-readiness verification.
  - Own the loop from current PR head SHA through job/log/artifact diagnosis, repair, and verification of the latest green `CI gate`.
  - Continue the diagnosis-and-repair loop without waiting for the user to report each subsequent failed run.

## Required workflow

Before coding:
- Summarize the relevant current architecture.
- List files to add or modify.
- List regression risks.
- Define tests and manual checks.

After coding:
- Run existing and new tests.
- Validate the live-use flow locally.
- Update required documentation.
- Report changed files, commands, results, limitations, and next recommendation.

Use `docs/04_DOCUMENTATION_WORKFLOW.md` to route documentation updates.
