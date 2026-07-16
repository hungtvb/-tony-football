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

safe_generated_path() {
  case "$1" in
    /mnt/data/*|"$PWD"/.local-runtime/*) return 0 ;;
    *) echo "Refusing generated output outside /mnt/data or $PWD/.local-runtime: $1" >&2; return 1 ;;
  esac
}

assert_new_destination() {
  local destination=$1
  local label=$2

  safe_generated_path "$destination"

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

  if [[ -d "$destination" ]]; then
    rmdir "$destination"
  fi
  mkdir -p "$(dirname "$destination")"
  mv "$staged" "$destination"
}

# Guard active workspaces before inspecting artifacts so stale, corrupt, incomplete,
# or missing artifacts can never trigger mutation of an existing local repository.
assert_new_destination "$workspace" "Workspace"
assert_new_destination "$browser_root" "Browser"

for archive in "$runtime_zip" "$browser_zip"; do
  [[ -f "$archive" ]] || { echo "Artifact not found: $archive" >&2; exit 1; }
done

for command in unzip tar git node npm; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done

extract_portable_tgz() {
  local archive=$1
  local destination=$2
  tar --extract --gzip --file "$archive" --directory "$destination" \
    --no-same-owner --no-same-permissions
}

temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT

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

staged_browser_path="$temporary/next-browser-root/ms-playwright"
[[ -d "$staged_browser_path" ]] || { echo "Expected Playwright cache missing from staged browser artifact" >&2; exit 1; }
[[ -f "$temporary/next-workspace/package.json" ]] || { echo "Staged runtime workspace is missing package.json" >&2; exit 1; }
staged_sha=$(tr -d '\r\n' < "$temporary/next-workspace/.local-runtime-sha" | tr '[:upper:]' '[:lower:]')
[[ "$staged_sha" == "$expected_main_sha" ]] || { echo "Extracted runtime SHA changed unexpectedly" >&2; exit 1; }
[[ -f "$temporary/next-workspace/node_modules/@playwright/test/package.json" ]] || {
  echo "Staged runtime is missing @playwright/test" >&2
  exit 1
}

browser_path="$browser_root/ms-playwright"
cat > "$temporary/next-workspace/.local-playwright-env" <<ENV
export PLAYWRIGHT_BROWSERS_PATH="$browser_path"
export TONY_LOCAL_WORKSPACE="$workspace"
export TONY_LOCAL_HOME="$workspace/.local-home"
export TONY_LOCAL_SOURCE_SHA="$staged_sha"
ENV
mkdir -p "$temporary/next-workspace/.local-home"

git -C "$temporary/next-workspace" init --quiet
git -C "$temporary/next-workspace" symbolic-ref HEAD refs/heads/main
mkdir -p "$temporary/next-workspace/.git/info"
for generated in .local-playwright-env .local-home/; do
  grep -Fxq "$generated" "$temporary/next-workspace/.git/info/exclude" 2>/dev/null || \
    printf '%s\n' "$generated" >> "$temporary/next-workspace/.git/info/exclude"
done
git -C "$temporary/next-workspace" config user.name "Tony Football Workspace"
git -C "$temporary/next-workspace" config user.email "tony-football-workspace@local.invalid"
git -C "$temporary/next-workspace" add -A
git -C "$temporary/next-workspace" commit --quiet -m "chore(workspace): snapshot main ${staged_sha:0:12}"
playwright_version=$(node -p "require('$temporary/next-workspace/node_modules/@playwright/test/package.json').version")

# Re-check immediately before publication. No existing non-empty destination is ever removed.
assert_new_destination "$workspace" "Workspace"
assert_new_destination "$browser_root" "Browser"
publish_new_destination "$temporary/next-browser-root" "$browser_root"
publish_new_destination "$temporary/next-workspace" "$workspace"

if ! git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "$workspace"; then
  git config --global --add safe.directory "$workspace"
fi

printf 'Workspace: %s\n' "$workspace"
printf 'Browser cache: %s\n' "$browser_path"
printf 'Source SHA: %s\n' "$staged_sha"
printf 'Local branch: main\n'
printf 'Playwright: %s\n' "$playwright_version"
printf '\nRun next:\n  cd %q\n  bash scripts/start-local-sprint.sh <branch-name>\n  bash scripts/run-local-preflight.sh smoke\n' "$workspace"
