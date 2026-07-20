import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("TON-81 model views keep deferred ownership outside the slice", async () => {
  const [adapter, sourceMap, contract] = await Promise.all([
    read("src/game/presentation/BrowserModelViewAdapter.js"),
    read("docs/11_SOURCE_MAP.md"),
    read("docs/14_MODEL_VIEW_CONTRACT.md"),
  ]);
  assert.match(adapter, /createSnapshotRenderState/);
  assert.doesNotMatch(adapter, /MatchEngine|setCameraPose|createBallTrail3D|CanvasRenderingContext2D/);
  assert.match(sourceMap, /Canvas fallback.*pending TON-82/);
  assert.match(contract, /camera and replay ownership: TON-83/);
  assert.match(contract, /particles, trails, settings and feedback: TON-84/);
});
