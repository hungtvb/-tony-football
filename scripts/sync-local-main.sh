#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/sync-local-main.sh <runtime-artifact.zip> <browser-artifact.zip> --expected-main-sha <sha> [options]

Options:
  --expected-main-sha <sha>  Required current 40-character GitHub main SHA
  --browser-root <path>      Generated browser root (default: /mnt/data/tony-playwright-browsers)
  --help                     Show this help

Requirements:
  - run inside a bootstrapped Tony Football local Git workspace;
  - commit the current sprint work first;
  - download artifacts built from the current GitHub main;
  - expect the current feature branch to be rebased onto the imported main snapshot.
USAGE
}

if [[ $# -lt 2 ]]; then
  usage
  exit 2
fi

runtime_zip=$1
browser_zip=$2
shift 2
expected_main_sha=
browser_root=/mnt/data/tony-playwright-browsers

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-main-sha)
      [[ $# -ge 2 ]] || { echo "--expected-main-sha requires a SHA" >&2; exit 2; }
      expected_main_sha=${2,,}
      shift 2
      ;;
    --browser-root)
      [[ $# -ge 2 ]] || { echo "--browser-root requires a path" >&2; exit 2; }
      browser_root=$2
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

[[ "$expected_main_sha" =~ ^[0-9a-f]{40}$ ]] || {
  echo "A valid --expected-main-sha with 40 hexadecimal characters is required." >&2
  exit 2
}

for command in realpath unzip tar git node npm; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done

mnt_generated_root=$(realpath -m -- /mnt/data)
staging_root_input=${TMPDIR:-/tmp}/tony-football-staging

assert_absolute_without_traversal() {
  local candidate=$1
  local label=$2

  [[ "$candidate" == /* ]] || {
    echo "$label path must be absolute: $candidate" >&2
    return 1
  }
  case "/$candidate/" in
    */../*)
      echo "$label path contains a traversal segment and is not allowed: $candidate" >&2
      return 1
      ;;
  esac
}

assert_no_symlink_boundaries() {
  local candidate=$1
  local label=$2
  local current=/
  local component
  local -a components=()

  IFS='/' read -r -a components <<< "${candidate#/}"
  for component in "${components[@]}"; do
    [[ -n "$component" && "$component" != "." ]] || continue
    if [[ "$current" == / ]]; then
      current="/$component"
    else
      current="$current/$component"
    fi
    if [[ -L "$current" ]]; then
      echo "$label path crosses a symlink boundary: $current" >&2
      return 1
    fi
  done
}

canonicalize_generated_target() {
  local candidate=$1
  local label=$2
  local canonical
  local local_runtime_root=

  assert_absolute_without_traversal "$candidate" "$label"
  assert_no_symlink_boundaries "$candidate" "$label"
  canonical=$(realpath -m -- "$candidate")

  if [[ "$canonical" == "$mnt_generated_root" ]]; then
    echo "$label path cannot be an approved generated root itself: $canonical" >&2
    return 1
  fi
  if [[ "$canonical" == "$mnt_generated_root"/* ]]; then
    printf '%s\n' "$canonical"
    return 0
  fi
  if [[ "$canonical" =~ ^(.*/\.local-runtime)(/.+)$ ]]; then
    local_runtime_root=${BASH_REMATCH[1]}
    [[ "$canonical" != "$local_runtime_root" ]] || {
      echo "$label path cannot be an approved generated root itself: $canonical" >&2
      return 1
    }
    assert_no_symlink_boundaries "$local_runtime_root" "$label generated root"
    printf '%s\n' "$canonical"
    return 0
  fi

  echo "Refusing $label path outside approved generated roots: $candidate -> $canonical" >&2
  return 1
}

canonicalize_staging_path() {
  local candidate=$1
  local label=$2
  local canonical

  assert_absolute_without_traversal "$candidate" "$label"
  assert_no_symlink_boundaries "$candidate" "$label"
  canonical=$(realpath -m -- "$candidate")
  [[ "$canonical" != "$staging_root" && "$canonical" == "$staging_root"/* ]] || {
    echo "$label path must be a strict descendant of the staging root: $canonical" >&2
    return 1
  }
  printf '%s\n' "$canonical"
}

assert_disjoint_paths() {
  local first=$1
  local first_label=$2
  local second=$3
  local second_label=$4

  if [[ "$first" == "$second" || "$first" == "$second"/* || "$second" == "$first"/* ]]; then
    echo "$first_label and $second_label paths must be distinct and non-overlapping: $first <> $second" >&2
    return 1
  fi
}

prepare_staging_root() {
  assert_absolute_without_traversal "$staging_root_input" "Staging root"
  assert_no_symlink_boundaries "$staging_root_input" "Staging root"
  mkdir -p -- "$staging_root_input"
  assert_no_symlink_boundaries "$staging_root_input" "Staging root"
  staging_root=$(realpath -m -- "$staging_root_input")
}

workspace_input=${PWD}
workspace=$(canonicalize_generated_target "$workspace_input" "Workspace")
browser_root=$(canonicalize_generated_target "$browser_root" "Browser")
assert_disjoint_paths "$workspace" "Workspace" "$browser_root" "Browser"
prepare_staging_root

[[ -d "$workspace/.git" && ! -L "$workspace/.git" ]] || {
  echo "Run this command from the bootstrapped Tony Football workspace root." >&2
  exit 1
}
if ! git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "$workspace"; then
  git config --global --add safe.directory "$workspace"
fi
cd "$workspace"

[[ -f .local-runtime-sha ]] || { echo "Missing .local-runtime-sha" >&2; exit 1; }
git rev-parse --verify main >/dev/null 2>&1 || { echo "Local main branch is missing." >&2; exit 1; }

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Workspace is not clean. Commit the current sprint work before syncing main." >&2
  git status --short >&2
  exit 1
fi

current_branch=$(git branch --show-current)
[[ -n "$current_branch" ]] || { echo "Detached HEAD is not supported for local main sync." >&2; exit 1; }

current_source_sha=$(tr -d '\r\n' < .local-runtime-sha | tr '[:upper:]' '[:lower:]')
[[ "$current_source_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid .local-runtime-sha" >&2; exit 1; }
if [[ "$current_source_sha" == "$expected_main_sha" ]]; then
  printf 'Local main snapshot is already current: %s\n' "$expected_main_sha"
  exit 0
fi

for archive in "$runtime_zip" "$browser_zip"; do
  [[ -f "$archive" ]] || { echo "Artifact not found: $archive" >&2; exit 1; }
done

extract_portable_tgz() {
  local archive=$1
  local destination=$2
  tar --extract --gzip --file "$archive" --directory "$destination" \
    --no-same-owner --no-same-permissions
}

temporary=$(mktemp -d "$staging_root/sync.XXXXXX")
temporary=$(canonicalize_staging_path "$temporary" "Sync staging")
assert_disjoint_paths "$temporary" "Sync staging" "$workspace" "Workspace"
assert_disjoint_paths "$temporary" "Sync staging" "$browser_root" "Browser"
cleanup() {
  if [[ -n "$temporary" && ( -e "$temporary" || -L "$temporary" ) ]]; then
    case "$temporary" in
      "$staging_root"/*) rm -rf -- "$temporary" ;;
    esac
  fi
}
trap cleanup EXIT

unzip -q "$runtime_zip" -d "$temporary/runtime"
runtime_tgz=$(find "$temporary/runtime" -type f -name '*.tgz' -print -quit)
[[ -n "$runtime_tgz" ]] || { echo "Runtime artifact does not contain a .tgz bundle" >&2; exit 1; }

artifact_sha=$(tar -xOf "$runtime_tgz" ./.local-runtime-sha 2>/dev/null || tar -xOf "$runtime_tgz" .local-runtime-sha 2>/dev/null || true)
artifact_sha=$(printf '%s' "$artifact_sha" | tr -d '\r\n' | tr '[:upper:]' '[:lower:]')
[[ "$artifact_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Runtime artifact is missing a valid .local-runtime-sha" >&2; exit 1; }
[[ "$artifact_sha" == "$expected_main_sha" ]] || {
  echo "Refusing stale runtime: artifact=$artifact_sha current-main=$expected_main_sha" >&2
  exit 1
}

unzip -q "$browser_zip" -d "$temporary/browsers"
browser_tgz=$(find "$temporary/browsers" -type f -name '*.tgz' -print -quit)
[[ -n "$browser_tgz" ]] || { echo "Browser artifact does not contain a .tgz bundle" >&2; exit 1; }

mkdir -p "$temporary/next-workspace" "$temporary/next-browser-root"
extract_portable_tgz "$runtime_tgz" "$temporary/next-workspace"
extract_portable_tgz "$browser_tgz" "$temporary/next-browser-root"

next_workspace=$(canonicalize_staging_path "$temporary/next-workspace" "Workspace staging")
next_browser_root=$(canonicalize_staging_path "$temporary/next-browser-root" "Browser staging")
assert_disjoint_paths "$next_workspace" "Workspace staging" "$next_browser_root" "Browser staging"

next_sha=$(tr -d '\r\n' < "$next_workspace/.local-runtime-sha" | tr '[:upper:]' '[:lower:]')
[[ "$next_sha" == "$expected_main_sha" ]] || { echo "Extracted runtime SHA changed unexpectedly" >&2; exit 1; }
[[ -f "$next_workspace/package.json" ]] || { echo "Staged runtime workspace is missing package.json" >&2; exit 1; }
[[ -f "$next_workspace/node_modules/@playwright/test/package.json" ]] || { echo "Staged runtime is missing @playwright/test" >&2; exit 1; }
[[ -d "$next_browser_root/ms-playwright" ]] || { echo "Expected Playwright cache missing from staged browser artifact" >&2; exit 1; }

# Revalidate every destructive target immediately before mutation.
[[ "$(canonicalize_generated_target "$workspace" "Workspace")" == "$workspace" ]] || exit 1
[[ "$(canonicalize_generated_target "$browser_root" "Browser")" == "$browser_root" ]] || exit 1
assert_disjoint_paths "$workspace" "Workspace" "$browser_root" "Browser"

printf 'Importing GitHub main %s into local main...\n' "$expected_main_sha"
git switch --quiet main
find "$workspace" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf -- {} +
(
  cd "$next_workspace"
  tar -cf - .
) | (
  cd "$workspace"
  tar --extract --file - --no-same-owner --no-same-permissions
)

mkdir -p "$workspace/.git/info"
for generated in .local-playwright-env .local-home/; do
  grep -Fxq "$generated" "$workspace/.git/info/exclude" 2>/dev/null || printf '%s\n' "$generated" >> "$workspace/.git/info/exclude"
done

rm -rf -- "$browser_root"
mkdir -p -- "$browser_root"
(
  cd "$next_browser_root"
  tar -cf - .
) | (
  cd "$browser_root"
  tar --extract --file - --no-same-owner --no-same-permissions
)
browser_path="$browser_root/ms-playwright"
[[ -d "$browser_path" ]] || { echo "Expected Playwright cache missing: $browser_path" >&2; exit 1; }

cat > "$workspace/.local-playwright-env" <<ENV
export PLAYWRIGHT_BROWSERS_PATH="$browser_path"
export TONY_LOCAL_WORKSPACE="$workspace"
export TONY_LOCAL_HOME="$workspace/.local-home"
export TONY_LOCAL_SOURCE_SHA="$expected_main_sha"
ENV
mkdir -p "$workspace/.local-home"

git config user.name "Tony Football Workspace"
git config user.email "tony-football-workspace@local.invalid"
git add -A
git commit --quiet -m "chore(workspace): sync main ${expected_main_sha:0:12}"

if [[ "$current_branch" != main ]]; then
  git switch --quiet "$current_branch"
  if ! git rebase main; then
    echo "Rebase stopped on conflicts. Resolve them, run git add, then git rebase --continue." >&2
    exit 1
  fi
fi

printf 'Local main source SHA: %s\n' "$expected_main_sha"
printf 'Current branch: %s\n' "$(git branch --show-current)"
printf 'Workspace: %s\n' "$workspace"
printf 'Browser cache: %s\n' "$browser_path"
