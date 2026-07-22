import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("TON-83 migration keeps replay camera clear and frames the incident", async () => {
  const migration = await read("scripts/ton-83-migrate-camera-replay.py");
  for (const marker of [
    "enteringReplayCamera",
    "cameraPosition.copy(cameraTarget)",
    "cameraPosition.x = clamp(cameraPosition.x, -58, 58)",
    "cameraPosition.y = Math.max(12, cameraPosition.y)",
    "cameraPosition.z = clamp(cameraPosition.z, -32, 32)",
    "cameraTarget.set(targetX + (scoringRight ? -30 : 30), 22, clamp(targetZ + 12, -14, 14))",
    "cameraLook.set(targetX + (scoringRight ? -7 : 7), 1.5, targetZ)",
    "replay camera stadium clearance is missing",
    "replay incident framing is missing",
  ]) {
    assert.equal(migration.includes(marker), true, `migration must retain ${marker}`);
  }
});

test("Three scene diagnostics expose immutable live camera position", async () => {
  const host = await read("src/game/presentation/BrowserThreeSceneEnvironmentHost.js");
  assert.match(host, /cameraPosition: camera \? Object\.freeze\(\{ x: camera\.position\.x, y: camera\.position\.y, z: camera\.position\.z \}\) : null/);
});
