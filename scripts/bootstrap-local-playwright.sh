#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash bootstrap-local-playwright.sh <runtime-artifact.zip> <browser-artifact.zip> --expected-main-sha <sha> [options]

Options:
  --expected-main-sha <sha>  Required current 40-character main commit SHA
  --workspace <path>         Generated workspace (default: /mnt/data/tony-football-local)
  --browser-root <path>      Generated browser root (default: /mnt/data/tony-playwright-browsers)
  --force                    Replace existing generated output
  --help                     Show this help

The artifact ZIP files are downloaded from the Local Playwright Runtime workflow.
The expected main SHA must be fetched immediately before bootstrap.
The generated workspace is initialized as a local Git repository on branch main.
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
force=false

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
      force=true
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

for archive in "$runtime_zip" "$browser_zip"; do
  [[ -f "$archive" ]] || { echo "Artifact not found: $archive" >&2; exit 1; }
done

for command in unzip tar git node npm; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done

safe_generated_path() {
  case "$1" in
    /mnt/data/*|"$PWD"/.local-runtime/*) return 0 ;;
    *) echo "Refusing generated output outside /mnt/data or $PWD/.local-runtime: $1" >&2; return 1 ;;
  esac
}

prepare_destination() {
  local destination=$1
  safe_generated_path "$destination"
  if [[ -d "$destination" && -n "$(find "$destination" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    if [[ "$force" != true ]]; then
      echo "Destination is not empty: $destination" >&2
      echo "Re-run with --force to replace this generated directory." >&2
      exit 1
    fi
    find "$destination" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  fi
  mkdir -p "$destination"
}

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

prepare_destination "$workspace"
prepare_destination "$browser_root"

extract_portable_tgz "$runtime_tgz" "$workspace"
extract_portable_tgz "$browser_tgz" "$browser_root"

browser_path="$browser_root/ms-playwright"
[[ -d "$browser_path" ]] || { echo "Expected Playwright cache missing: $browser_path" >&2; exit 1; }
[[ -f "$workspace/package.json" ]] || { echo "Runtime workspace is missing package.json" >&2; exit 1; }
extracted_sha=$(tr -d '\r\n' < "$workspace/.local-runtime-sha" | tr '[:upper:]' '[:lower:]')
[[ "$extracted_sha" == "$expected_main_sha" ]] || { echo "Extracted runtime SHA changed unexpectedly" >&2; exit 1; }

git -C "$workspace" init --quiet
if ! git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "$workspace"; then
  git config --global --add safe.directory "$workspace"
fi
git -C "$workspace" symbolic-ref HEAD refs/heads/main
mkdir -p "$workspace/.git/info"
for generated in .local-playwright-env .local-home/; do
  grep -Fxq "$generated" "$workspace/.git/info/exclude" 2>/dev/null || printf '%s\n' "$generated" >> "$workspace/.git/info/exclude"
done

cat > "$workspace/.local-playwright-env" <<ENV
export PLAYWRIGHT_BROWSERS_PATH="$browser_path"
export TONY_LOCAL_WORKSPACE="$workspace"
export TONY_LOCAL_HOME="$workspace/.local-home"
export TONY_LOCAL_SOURCE_SHA="$extracted_sha"
ENV
mkdir -p "$workspace/.local-home"

git -C "$workspace" config user.name "Tony Football Workspace"
git -C "$workspace" config user.email "tony-football-workspace@local.invalid"
git -C "$workspace" add -A
git -C "$workspace" commit --quiet -m "chore(workspace): snapshot main ${extracted_sha:0:12}"

printf 'Workspace: %s\n' "$workspace"
printf 'Browser cache: %s\n' "$browser_path"
printf 'Source SHA: %s\n' "$extracted_sha"
printf 'Local branch: main\n'
printf 'Playwright: %s\n' "$(node -p "require('$workspace/node_modules/@playwright/test/package.json').version")"
printf '\nRun next:\n  cd %q\n  bash scripts/start-local-sprint.sh <branch-name>\n  bash scripts/run-local-preflight.sh smoke\n' "$workspace"
