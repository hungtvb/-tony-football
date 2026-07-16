# Tony Football — Agent Entry Point

This file is the mandatory entry point for repository-level AI agents.

## Read first

Before planning or modifying code, read in this order:

1. The assigned Linear `TON-x` issue and its latest handoff comments.
2. The [Tony Football Way of Work](https://linear.app/tony-football/document/tony-football-way-of-work-2d97168dcd1b).
3. The [Tony Football Alignment Protocol](https://linear.app/tony-football/document/tony-football-alignment-protocol-fa0c49f59d44).
4. `docs/00_PROJECT_CONTEXT.md`.
5. `docs/03_DEV_RULES.md`.
6. The relevant section of `docs/11_SOURCE_MAP.md`.
7. Only the relevant technical sprint, specification, and ADR files.
8. The affected code and tests.

Do not scan every document by default. Do not infer current priority, ownership, or delivery status from repository planning files or historical sprint documents.

## Persistent session startup

Linear is the persistent source for mutable planning, ownership, dependencies, status, acceptance, and cross-role handoffs. Repository documentation is the persistent source for stable technical contracts. Chat-only information is not considered communicated.

At the beginning of every coding session:

1. Read the latest Linear handoff and confirm the active role, owner, dependency state, and file/branch collision risk.
2. Correlate the `TON-x` item with its GitHub issue, branch, pull request, exact head SHA, CI, and review state.
3. Fetch the latest GitHub `main` SHA through the GitHub connector.
4. Compare it with `.local-runtime-sha` in the generated workspace.
5. If no verified local Git workspace exists, bootstrap a new workspace from the current runtime artifact.
6. If `main` moved, commit current work and run `scripts/sync-local-main.sh` before editing further.
7. When starting a delivery item, create the GitHub branch directly from latest `main`, then create the same local branch with `scripts/start-local-sprint.sh`.
8. When resuming an existing item, resume its assigned branch instead of creating a replacement branch.
9. After every material push, review, blocker, merge, or acceptance event, record exact evidence and the next owner in Linear.

Never implement delivery work directly on local or remote `main`. One `TON-x` delivery item equals one GitHub issue, one branch containing `ton-x`, and one pull request starting with `[TON-x]`.

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

Implement only the assigned Linear issue unless the Product Owner explicitly changes scope.

Do not:

- Start unassigned multiplayer or game-mode work.
- Rewrite the whole project.
- Expand `game.js` with another large subsystem.
- Change the FO4 control mapping without approval.
- Remove WebGL or Canvas fallback.
- Merge directly to `main`.
- Perform destructive repository or filesystem operations without explicit approval.

## Source-of-truth priority

1. Direct Product Owner instruction.
2. Assigned Linear issue, latest durable handoff, Way of Work, and Alignment Protocol.
3. Exact GitHub implementation evidence: issue, branch, commit, PR, review, CI, and merge state.
4. Accepted ADRs and repository architecture/source-map contracts.
5. Relevant gameplay/UI specifications and technical sprint records.
6. Existing code comments.

`docs/01_ACTIVE_SPRINT.md`, `docs/02_ROADMAP.md`, and `docs/10_BACKLOG.md` are stable pointers to Linear and never override current Linear delivery state.

Report unresolved contradictions before implementation.

## Operational skills

Use repository skills for repeatable operational workflows:

- **CI triage:** `.github/skills/ci-triage/SKILL.md`
  - Triggered by requests such as `check CI`, `fix CI`, `CI failed`, a workflow run number, or merge-readiness verification.
  - Own the loop from current PR head SHA through job/log/artifact diagnosis, repair, and verification of the latest green `CI gate`.
  - Continue the diagnosis-and-repair loop without waiting for the user to report each subsequent failed run.

## Required workflow

Before coding:

- Record the branch, exact baseline SHA, intended files, validation plan, blockers, and ownership boundary in Linear.
- Summarize the relevant current architecture.
- List regression risks and manual checks.

After coding:

- Run existing and new tests.
- Validate the live-use flow locally when runtime behavior changed.
- Update required technical documentation.
- Verify the exact published head and current CI/review state.
- Report changed files, commands, results, limitations, and next owner in Linear.

Use `docs/04_DOCUMENTATION_WORKFLOW.md` to route documentation updates.
