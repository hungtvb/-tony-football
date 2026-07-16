#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash bootstrap-local-playwright.sh <runtime-artifact.zip> <browser-artifact.zip> --expected-main-sha <sha> [options]

Options:
  --expected-main-sha <sha>  Required current 40-character main commit SHA
  --workspace <path>         New generated workspace (default: /mnt/data/tony-football-local)
  --browser-root <path>      New generated browser root (default: /mnt/data/tony-playwright-browsers)
  --force                    Deprecated compatibility flag; never replaces existing output
  --help                     Show this help

The artifact ZIP files are downloaded from the Local Playwright Runtime workflow.
The expected main SHA must be fetched immediately before bootstrap.
Bootstrap creates a new workspace only. Existing Git workspaces must use
scripts/sync-local-main.sh and are never replaced by this command.
USAGE
}

if [[ $# -lt 2 ]]; then
  usage
  exit 2
fi

runtime_zip=$1
browser_zip=$2
shift 2
workspace=/mnt/data/tony-football-local
browser_root=/mnt/data/tony-playwright-browsers
expected_main_sha=
force_requested=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-main-sha)
      [[ $# -ge 2 ]] || { echo "--expected-main-sha requires a SHA" >&2; exit 2; }
      expected_main_sha=${2,,}
      shift 2
      ;;
    --workspace)
      [[ $# -ge 2 ]] || { echo "--workspace requires a path" >&2; exit 2; }
      workspace=$2
      shift 2
      ;;
    --browser-root)
      [[ $# -ge 2 ]] || { echo "--browser-root requires a path" >&2; exit 2; }
      browser_root=$2
      shift 2
      ;;
    --force)
      force_requested=true
      shift
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

invocation_root=$(pwd -P)
mnt_generated_root=$(realpath -m -- /mnt/data)
local_generated_root=$(realpath -m -- "$invocation_root/.local-runtime")
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

  assert_absolute_without_traversal "$candidate" "$label"
  assert_no_symlink_boundaries "$candidate" "$label"
  canonical=$(realpath -m -- "$candidate")

  if [[ "$canonical" == "$local_generated_root" || "$canonical" == "$mnt_generated_root" ]]; then
    echo "$label path cannot be an approved generated root itself: $canonical" >&2
    return 1
  fi
  case "$canonical" in
    "$local_generated_root"/*|"$mnt_generated_root"/*)
      printf '%s\n' "$canonical"
      ;;
    *)
      echo "Refusing $label path outside approved generated roots: $candidate -> $canonical" >&2
      return 1
      ;;
  esac
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

workspace=$(canonicalize_generated_target "$workspace" "Workspace")
browser_root=$(canonicalize_generated_target "$browser_root" "Browser")
assert_disjoint_paths "$workspace" "Workspace" "$browser_root" "Browser"
prepare_staging_root

temporary=
cleanup() {
  if [[ -n "$temporary" && ( -e "$temporary" || -L "$temporary" ) ]]; then
    case "$temporary" in
      "$staging_root"/*) rm -rf -- "$temporary" ;;
    esac
  fi
}
trap cleanup EXIT

assert_new_destination() {
  local destination=$1
  local label=$2
  local current

  current=$(canonicalize_generated_target "$destination" "$label")
  [[ "$current" == "$destination" ]] || {
    echo "$label destination changed during validation: $destination -> $current" >&2
    exit 1
  }

  if [[ -e "$destination/.git" || -L "$destination/.git" ]]; then
    echo "Refusing to bootstrap over an existing Git workspace: $destination" >&2
    echo "Use scripts/sync-local-main.sh from the existing workspace instead." >&2
    if [[ "$force_requested" == true ]]; then
      echo "The deprecated --force flag cannot replace a destination containing .git." >&2
    fi
    exit 1
  fi

  if [[ -e "$destination" || -L "$destination" ]]; then
    if [[ ! -d "$destination" || -L "$destination" ]]; then
      echo "$label destination already exists and is not an empty directory: $destination" >&2
      exit 1
    fi
    if [[ -n "$(find "$destination" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
      echo "$label destination is not empty: $destination" >&2
      echo "Bootstrap creates new output only; choose a new path or use the existing-workspace sync flow." >&2
      exit 1
    fi
  fi
}

publish_new_destination() {
  local staged=$1
  local destination=$2
  local label=$3
  local validated_staged
  local validated_destination

  validated_staged=$(canonicalize_staging_path "$staged" "$label staging")
  validated_destination=$(canonicalize_generated_target "$destination" "$label")
  [[ "$validated_staged" == "$staged" && "$validated_destination" == "$destination" ]] || {
    echo "$label publication path changed during validation." >&2
    exit 1
  }

  if [[ -d "$destination" ]]; then
    rmdir -- "$destination"
  fi
  mkdir -p -- "$(dirname -- "$destination")"
  mv -- "$staged" "$destination"
}

# Guard active workspaces before inspecting artifacts so stale, corrupt, incomplete,
# or missing artifacts can never trigger mutation of an existing local repository.
assert_new_destination "$workspace" "Workspace"
assert_new_destination "$browser_root" "Browser"

for archive in "$runtime_zip" "$browser_zip"; do
  [[ -f "$archive" ]] || { echo "Artifact not found: $archive" >&2; exit 1; }
done

extract_portable_tgz() {
  local archive=$1
  local destination=$2
  tar --extract --gzip --file "$archive" --directory "$destination" \
    --no-same-owner --no-same-permissions
}

temporary=$(mktemp -d "$staging_root/bootstrap.XXXXXX")
temporary=$(canonicalize_staging_path "$temporary" "Bootstrap staging")
assert_disjoint_paths "$temporary" "Bootstrap staging" "$workspace" "Workspace"
assert_disjoint_paths "$temporary" "Bootstrap staging" "$browser_root" "Browser"

unzip -q "$runtime_zip" -d "$temporary/runtime"
runtime_tgz=$(find "$temporary/runtime" -type f -name '*.tgz' -print -quit)
[[ -n "$runtime_tgz" ]] || { echo "Runtime artifact does not contain a .tgz bundle" >&2; exit 1; }

artifact_sha=$(tar -xOf "$runtime_tgz" ./.local-runtime-sha 2>/dev/null || tar -xOf "$runtime_tgz" .local-runtime-sha 2>/dev/null || true)
artifact_sha=$(printf '%s' "$artifact_sha" | tr -d '\r\n' | tr '[:upper:]' '[:lower:]')
[[ "$artifact_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Runtime artifact is missing a valid .local-runtime-sha" >&2; exit 1; }
if [[ "$artifact_sha" != "$expected_main_sha" ]]; then
  echo "Refusing stale runtime: artifact=$artifact_sha current-main=$expected_main_sha" >&2
  exit 1
fi

unzip -q "$browser_zip" -d "$temporary/browsers"
browser_tgz=$(find "$temporary/browsers" -type f -name '*.tgz' -print -quit)
[[ -n "$browser_tgz" ]] || { echo "Browser artifact does not contain a .tgz bundle" >&2; exit 1; }

mkdir -p "$temporary/next-workspace" "$temporary/next-browser-root"
extract_portable_tgz "$runtime_tgz" "$temporary/next-workspace"
extract_portable_tgz "$browser_tgz" "$temporary/next-browser-root"

next_workspace=$(canonicalize_staging_path "$temporary/next-workspace" "Workspace staging")
next_browser_root=$(canonicalize_staging_path "$temporary/next-browser-root" "Browser staging")
assert_disjoint_paths "$next_workspace" "Workspace staging" "$next_browser_root" "Browser staging"

staged_browser_path="$next_browser_root/ms-playwright"
[[ -d "$staged_browser_path" ]] || { echo "Expected Playwright cache missing from staged browser artifact" >&2; exit 1; }
[[ -f "$next_workspace/package.json" ]] || { echo "Staged runtime workspace is missing package.json" >&2; exit 1; }
staged_sha=$(tr -d '\r\n' < "$next_workspace/.local-runtime-sha" | tr '[:upper:]' '[:lower:]')
[[ "$staged_sha" == "$expected_main_sha" ]] || { echo "Extracted runtime SHA changed unexpectedly" >&2; exit 1; }
[[ -f "$next_workspace/node_modules/@playwright/test/package.json" ]] || {
  echo "Staged runtime is missing @playwright/test" >&2
  exit 1
}

browser_path="$browser_root/ms-playwright"
cat > "$next_workspace/.local-playwright-env" <<ENV
export PLAYWRIGHT_BROWSERS_PATH="$browser_path"
export TONY_LOCAL_WORKSPACE="$workspace"
export TONY_LOCAL_HOME="$workspace/.local-home"
export TONY_LOCAL_SOURCE_SHA="$staged_sha"
ENV
mkdir -p "$next_workspace/.local-home"

git -C "$next_workspace" init --quiet
git -C "$next_workspace" symbolic-ref HEAD refs/heads/main
mkdir -p "$next_workspace/.git/info"
for generated in .local-playwright-env .local-home/; do
  grep -Fxq "$generated" "$next_workspace/.git/info/exclude" 2>/dev/null || \
    printf '%s\n' "$generated" >> "$next_workspace/.git/info/exclude"
done
git -C "$next_workspace" config user.name "Tony Football Workspace"
git -C "$next_workspace" config user.email "tony-football-workspace@local.invalid"
git -C "$next_workspace" add -A
git -C "$next_workspace" commit --quiet -m "chore(workspace): snapshot main ${staged_sha:0:12}"
playwright_version=$(node -p "require('$next_workspace/node_modules/@playwright/test/package.json').version")

# Re-check immediately before publication. No existing non-empty destination is ever removed.
assert_new_destination "$workspace" "Workspace"
assert_new_destination "$browser_root" "Browser"
assert_disjoint_paths "$workspace" "Workspace" "$browser_root" "Browser"
publish_new_destination "$next_browser_root" "$browser_root" "Browser"
publish_new_destination "$next_workspace" "$workspace" "Workspace"

if ! git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "$workspace"; then
  git config --global --add safe.directory "$workspace"
fi

printf 'Workspace: %s\n' "$workspace"
printf 'Browser cache: %s\n' "$browser_path"
printf 'Source SHA: %s\n' "$staged_sha"
printf 'Local branch: main\n'
printf 'Playwright: %s\n' "$playwright_version"
printf '\nRun next:\n  cd %q\n  bash scripts/start-local-sprint.sh <branch-name>\n  bash scripts/run-local-preflight.sh smoke\n' "$workspace"
