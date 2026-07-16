# Tony Football AI Workspace v5

## Entry points

- Codex and compatible agents: `AGENTS.md`
- Antigravity: `.agent/rules/` and `.agent/workflows/`
- Shared source of truth: `docs/`

## Mandatory read order

1. `docs/00_PROJECT_CONTEXT.md`
2. `docs/01_ACTIVE_SPRINT.md`
3. `docs/03_DEV_RULES.md`
4. Active sprint file
5. Relevant section of `docs/11_SOURCE_MAP.md`
6. Relevant gameplay or UI specification
7. Relevant ADRs
8. Code

Do not read all documentation unless the task requires it.

## Session and branch invariant

Every new chat session must recover state from the repository rather than from chat history:

1. read `AGENTS.md` and the mandatory docs;
2. fetch the latest GitHub `main` SHA;
3. bootstrap or sync the verified local workspace;
4. create one GitHub branch and one matching local branch from `main` when a sprint starts;
5. resume the existing sprint branch when continuing that sprint;
6. never code directly on `main`.

Restricted-container commands are documented in `docs/DEVELOPMENT_WORKFLOW.md`.
