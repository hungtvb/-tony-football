import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("TON-83 migration keeps replay camera clear and points back into the field", async () => {
  const migration = await read("scripts/ton-83-migrate-camera-replay.py");
  for (const marker of [
    "enteringReplayCamera",
    "cameraPosition.copy(cameraTarget)",
    "cameraPosition.x = clamp(cameraPosition.x, -58, 58)",
    "cameraPosition.y = Math.max(12, cameraPosition.y)",
    "cameraPosition.z = clamp(cameraPosition.z, -32, 32)",
    "const scoringRight = framedX >= W / 2",
    "cameraTarget.set(targetX + (scoringRight ? 18 : -18), 24, clamp(targetZ + 24, -26, 26))",
    "cameraLook.set(targetX + (scoringRight ? -24 : 24), 1.5, targetZ)",
    "replay camera stadium clearance is missing",
    "replay side must derive from immutable replay-frame ball position",
    "replay incident inward framing is missing",
  ]) {
    assert.equal(migration.includes(marker), true, `migration must retain ${marker}`);
  }
});

test("Three scene diagnostics expose immutable live camera position", async () => {
  const host = await read("src/game/presentation/BrowserThreeSceneEnvironmentHost.js");
  assert.match(host, /cameraPosition: camera \? Object\.freeze\(\{ x: camera\.position\.x, y: camera\.position\.y, z: camera\.position\.z \}\) : null/);
});
