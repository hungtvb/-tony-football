import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("TON-83 migration keeps one incident side and safely falls back when replay history is missing", async () => {
  const migration = await read("scripts/ton-83-migrate-camera-replay.py");
  for (const marker of [
    "enteringReplayCamera",
    "cameraPosition.copy(cameraTarget)",
    "cameraPosition.x = clamp(cameraPosition.x, -58, 58)",
    "cameraPosition.y = Math.max(12, cameraPosition.y)",
    "cameraPosition.z = clamp(cameraPosition.z, -32, 32)",
    "const replayScoringRight = game.replay.scoringRight",
    "const replayCameraActive = Boolean(replayFrame) && game.replay.cinematicAvailable === true",
    "const scoringRight = replayScoringRight",
    "cameraTarget.set(targetX + (scoringRight ? 18 : -18), 24, clamp(targetZ + 24, -26, 26))",
    "cameraLook.set(targetX + (scoringRight ? -24 : 24), 1.5, targetZ)",
    "replayCameraFraming: Object.freeze({",
    "cinematicActive: Boolean(render3D.replayCameraActive)",
    "cinematicAvailable: Boolean(game.replay.cinematicAvailable)",
    "missingFrame: cameraReplayBridge.diagnostics().replay.missingFrame",
    "missing-history replay must fall back without activating cinematic camera",
    "multi-frame replay camera diagnostics are missing",
  ]) {
    assert.equal(migration.includes(marker), true, `migration must retain ${marker}`);
  }
  assert.equal(migration.includes('throw new Error("Replay incident side is unavailable")'), false);
  assert.equal((migration.match(/const scoringRight = framedX >= W \/ 2/g) ?? []).length, 1, "legacy per-frame side marker may remain only as a generated-output forbidden token");
  assert.match(migration, /forbidden_tokens = \[[\s\S]*'const scoringRight = framedX >= W \/ 2'/);
});

test("browser exposes a presentation-only late-restore seam only for the golden harness", async () => {
  const entry = await read("browser-entry.js");
  const adapter = await read("src/game/presentation/SnapshotCameraReplayAdapter.js");
  assert.match(entry, /new URLSearchParams\(globalThis\.location\.search\)\.has\("goalTest"\)/);
  assert.match(entry, /e2ePresentationSeams \? \{ resetForE2E: \(\) => cameraReplayAdapter\.reset\(\) \} : \{\}/);
  assert.match(adapter, /cinematicAvailable = authoritative\.active && Boolean\(selection\.snapshot\) && typeof playbackScoringRight === "boolean"/);
  assert.match(adapter, /get cinematicAvailable\(\) \{ return Boolean\(latestProjection\?\.replay\.cinematicAvailable\); \}/);
});

test("TON-94 does not change the deterministic rain layout", async () => {
  const host = await read("src/game/presentation/BrowserThreeSceneEnvironmentHost.js");
  assert.match(host, /const y = 2 \+ seededNoise\(index \* 7\.43\) \* 47;/);
  assert.doesNotMatch(host, /seededNoise\(index \* 7\.43 \+ 9\) \* 47/);
});
