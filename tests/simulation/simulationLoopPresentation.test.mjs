import assert from "node:assert/strict";
import test from "node:test";

import { createSimulationLoop } from "../../src/game/core/SimulationLoop.js";

test("simulation loop notifies after-render subscribers with a frozen timing frame", () => {
  const scheduled = [];
  const calls = [];
  const loop = createSimulationLoop({
    update: () => calls.push("update"),
    render: () => calls.push("render"),
    requestFrame: (callback) => {
      scheduled.push(callback);
      return scheduled.length;
    },
    cancelFrame: () => {},
  });

  const frames = [];
  const unsubscribe = loop.subscribeAfterRender((frame) => {
    calls.push("after-render");
    frames.push(frame);
  });

  loop.start();
  scheduled.shift()(1000);

  assert.deepEqual(calls, ["render", "after-render"]);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].nowMilliseconds, 1000);
  assert.equal(frames[0].alpha, 0);
  assert.equal(Object.isFrozen(frames[0]), true);

  unsubscribe();
  scheduled.shift()(1020);
  assert.deepEqual(calls.slice(-2), ["update", "render"]);
  loop.stop();
});

test("simulation loop rejects invalid after-render subscribers", () => {
  const loop = createSimulationLoop({
    update: () => {},
    render: () => {},
    requestFrame: () => 1,
  });
  assert.throws(() => loop.subscribeAfterRender(null), /after-render listener/);
});
