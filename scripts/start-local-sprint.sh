#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/start-local-sprint.sh <branch-name>

Creates a clean local sprint branch from the verified local main snapshot.
Create the matching GitHub branch from the latest remote main SHA before coding.

Allowed branch prefixes:
  feat/ fix/ refactor/ chore/ docs/ test/
USAGE
}

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi

branch_name=$1
[[ "$branch_name" =~ ^(feat|fix|refactor|chore|docs|test)/[a-z0-9][a-z0-9._/-]*$ ]] || {
  echo "Invalid sprint branch name: $branch_name" >&2
  usage
  exit 2
}

command -v git >/dev/null || { echo "Missing required command: git" >&2; exit 1; }

workspace=$(pwd -P)
[[ -d "$workspace/.git" ]] || {
  echo "Run this command from the bootstrapped Tony Football workspace root." >&2
  exit 1
}
if ! git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "$workspace"; then
  git config --global --add safe.directory "$workspace"
fi
cd "$workspace"

[[ -f .local-runtime-sha ]] || { echo "Missing .local-runtime-sha; workspace source cannot be verified." >&2; exit 1; }
[[ -f package.json ]] || { echo "Run this command from a Tony Football workspace." >&2; exit 1; }

git rev-parse --verify main >/dev/null 2>&1 || { echo "Local main branch is missing." >&2; exit 1; }

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Workspace is not clean. Commit or discard the current sprint work before starting another sprint." >&2
  git status --short >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch_name"; then
  echo "Local branch already exists: $branch_name" >&2
  echo "Resume it explicitly with: git switch $branch_name" >&2
  exit 1
fi

source_sha=$(tr -d '\r\n' < .local-runtime-sha | tr '[:upper:]' '[:lower:]')
[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid .local-runtime-sha" >&2; exit 1; }

main_source_sha=$(git show main:.local-runtime-sha 2>/dev/null | tr -d '\r\n' | tr '[:upper:]' '[:lower:]' || true)
[[ "$main_source_sha" == "$source_sha" ]] || {
  echo "Local main does not match the verified runtime marker." >&2
  echo "Sync local main from a fresh runtime artifact before creating the sprint branch." >&2
  exit 1
}

git switch --quiet main
git switch --quiet --create "$branch_name" main

printf 'Sprint branch: %s\n' "$branch_name"
printf 'Based on main source SHA: %s\n' "$source_sha"
printf 'Workspace: %s\n' "$workspace"
