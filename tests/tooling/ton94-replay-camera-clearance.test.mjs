import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("TON-83 migration keeps one incident side and exposes multi-frame camera evidence", async () => {
  const migration = await read("scripts/ton-83-migrate-camera-replay.py");
  for (const marker of [
    "enteringReplayCamera",
    "cameraPosition.copy(cameraTarget)",
    "cameraPosition.x = clamp(cameraPosition.x, -58, 58)",
    "cameraPosition.y = Math.max(12, cameraPosition.y)",
    "cameraPosition.z = clamp(cameraPosition.z, -32, 32)",
    "const scoringRight = game.replay.scoringRight",
    "Replay incident side is unavailable",
    "cameraTarget.set(targetX + (scoringRight ? 18 : -18), 24, clamp(targetZ + 24, -26, 26))",
    "cameraLook.set(targetX + (scoringRight ? -24 : 24), 1.5, targetZ)",
    "replayCameraFraming: Object.freeze({",
    "frameIndex: cameraReplayBridge.diagnostics().replay.frameIndex",
    "replay side must remain latched for the immutable incident",
    "multi-frame replay camera diagnostics are missing",
  ]) {
    assert.equal(migration.includes(marker), true, `migration must retain ${marker}`);
  }
  assert.equal(migration.includes("const scoringRight = framedX >= W / 2"), false);
});

test("TON-94 does not change the deterministic rain layout", async () => {
  const host = await read("src/game/presentation/BrowserThreeSceneEnvironmentHost.js");
  assert.match(host, /const y = 2 \+ seededNoise\(index \* 7\.43\) \* 47;/);
  assert.doesNotMatch(host, /seededNoise\(index \* 7\.43 \+ 9\) \* 47/);
});
