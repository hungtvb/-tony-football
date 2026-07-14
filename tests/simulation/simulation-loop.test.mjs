import test from "node:test";
import assert from "node:assert/strict";

import { createSimulationLoop } from "../../src/game/core/SimulationLoop.js";

function createFrameHarness() {
  const callbacks = [];
  return {
    requestFrame(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
    cancelFrame() {},
    runNext(timestamp) {
      const callback = callbacks.shift();
      assert.ok(callback, "expected a scheduled frame");
      callback(timestamp);
    },
    get pending() {
      return callbacks.length;
    },
  };
}

test("simulation loop runs fixed updates and renders once per browser frame", () => {
  const harness = createFrameHarness();
  const updates = [];
  const renders = [];
  const loop = createSimulationLoop({
    update: (dt) => updates.push(dt),
    render: (alpha, now, result) => renders.push({ alpha, now, steps: result.steps }),
    requestFrame: harness.requestFrame,
    cancelFrame: harness.cancelFrame,
  });

  loop.start();
  assert.equal(harness.pending, 1);

  harness.runNext(0);
  harness.runNext(1000 / 30);

  assert.equal(updates.length, 2);
  assert.ok(updates.every((dt) => Math.abs(dt - 1 / 60) < 1e-12));
  assert.equal(renders.length, 2);
  assert.equal(renders[1].steps, 2);
  assert.equal(harness.pending, 1);
});

test("simulation loop start is idempotent and stop prevents further work", () => {
  const harness = createFrameHarness();
  let updates = 0;
  let renders = 0;
  const loop = createSimulationLoop({
    update: () => updates += 1,
    render: () => renders += 1,
    requestFrame: harness.requestFrame,
    cancelFrame: harness.cancelFrame,
  });

  loop.start();
  loop.start();
  assert.equal(harness.pending, 1);

  loop.stop();
  harness.runNext(16.67);
  assert.equal(updates, 0);
  assert.equal(renders, 0);
  assert.equal(loop.running, false);
});

test("simulation loop exposes interpolation alpha to rendering", () => {
  const harness = createFrameHarness();
  let latestAlpha = null;
  const loop = createSimulationLoop({
    update: () => {},
    render: (alpha) => latestAlpha = alpha,
    requestFrame: harness.requestFrame,
    cancelFrame: harness.cancelFrame,
  });

  loop.start();
  harness.runNext(0);
  harness.runNext(25);

  assert.ok(latestAlpha > 0 && latestAlpha < 1);
});
