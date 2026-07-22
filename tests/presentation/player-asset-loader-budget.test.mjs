import assert from "node:assert/strict";
import test from "node:test";

import {
  loadPlayerAssetWithRetry,
  PLAYER_ASSET_ATTEMPT_TIMEOUT_MILLISECONDS,
} from "../../src/game/presentation/PlayerAssetLoader.js";

test("default asset attempt budget allows software GLB decode without becoming unbounded", async () => {
  assert.equal(PLAYER_ASSET_ATTEMPT_TIMEOUT_MILLISECONDS, 30000);

  let resolveLoad;
  const asset = { scene: { traverse() {} } };
  const loader = {
    loadAsync() {
      return new Promise((resolve) => { resolveLoad = resolve; });
    },
  };
  let scheduledDelay = null;
  let clearedHandle = null;
  const timerHandle = Object.freeze({ id: "asset-timeout" });

  const resultPromise = loadPlayerAssetWithRetry(loader, "/character.glb", "character", {
    attempts: 1,
    setTimer(callback, milliseconds) {
      assert.equal(typeof callback, "function");
      scheduledDelay = milliseconds;
      return timerHandle;
    },
    clearTimer(handle) { clearedHandle = handle; },
  });

  await Promise.resolve();
  assert.equal(scheduledDelay, PLAYER_ASSET_ATTEMPT_TIMEOUT_MILLISECONDS);
  resolveLoad(asset);
  assert.equal(await resultPromise, asset);
  assert.equal(clearedHandle, timerHandle);
});

test("an explicit shorter budget remains available for deterministic timeout tests", async () => {
  let timeoutCallback = null;
  const loader = { loadAsync: () => new Promise(() => {}) };
  const resultPromise = loadPlayerAssetWithRetry(loader, "/stalled.glb", "character", {
    attempts: 1,
    timeoutMilliseconds: 25,
    setTimer(callback, milliseconds) {
      timeoutCallback = callback;
      assert.equal(milliseconds, 25);
      return 1;
    },
    clearTimer() {},
  });

  await Promise.resolve();
  timeoutCallback();
  await assert.rejects(resultPromise, /character timeout after 25ms/);
});
