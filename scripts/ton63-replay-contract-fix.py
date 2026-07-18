from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement, found {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "tests/presentation/liveReplayCompatibilityProjection.test.mjs",
    '      update(deltaSeconds) { calls.push(["update", deltaSeconds]); return false; },',
    '      syncElapsed(value) { calls.push(["syncElapsed", value]); return true; },',
)
replace_once(
    "tests/presentation/liveReplayCompatibilityProjection.test.mjs",
    '''    ["start", 4],
    ["update", STEP],
    ["update", STEP],
    "stop",''',
    '''    ["start", 4],
    ["syncElapsed", STEP],
    "stop",''',
)
replace_once(
    "tests/presentation/snapshotPresentationRuntime.test.mjs",
    'runtimeSource.indexOf("function updateReplay")',
    'runtimeSource.indexOf("function updateLegacyReplay")',
)
