import assert from "node:assert/strict";
import test from "node:test";

import { loadPlayerAssetWithRetry } from "../../src/game/presentation/PlayerAssetLoader.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("asset retry clears timers and disposes a timed-out request that completes late", async () => {
  const first = deferred();
  const second = deferred();
  const timers = [];
  const cleared = [];
  const disposed = [];
  let request = 0;
  const loader = { loadAsync: () => (++request === 1 ? first.promise : second.promise) };
  const loading = loadPlayerAssetWithRetry(loader, "player.glb", "character", {
    timeoutMilliseconds: 25,
    attempts: 2,
    setTimer(callback) { const handle = { callback }; timers.push(handle); return handle; },
    clearTimer(handle) { cleared.push(handle); },
    disposeLateResult(result) { disposed.push(result); },
  });
  await flush();
  timers[0].callback();
  await flush();
  const winner = { scene: { name: "fresh" } };
  second.resolve(winner);
  assert.equal(await loading, winner);
  const loser = { scene: { name: "late" } };
  first.resolve(loser);
  await flush(); await flush();
  assert.deepEqual(disposed, [loser]);
  assert.equal(cleared.includes(timers[0]), true);
  assert.equal(cleared.includes(timers[1]), true);
});

test("asset retry observes a late rejection after timeout", async () => {
  const first = deferred();
  const second = deferred();
  const timers = [];
  let request = 0;
  const loading = loadPlayerAssetWithRetry({ loadAsync: () => (++request === 1 ? first.promise : second.promise) }, "player.glb", "character", {
    attempts: 2,
    setTimer(callback) { const handle = { callback }; timers.push(handle); return handle; },
    clearTimer() {},
  });
  await flush(); timers[0].callback(); await flush();
  second.resolve({ scene: null });
  await loading;
  first.reject(new Error("late network failure"));
  await flush(); await flush();
});
