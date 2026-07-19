import assert from "node:assert/strict";
import test from "node:test";
import { BrowserPresentationComposition } from "../../src/game/presentation/BrowserPresentationComposition.js";

test("presentation composition owns adapter start render reset and reverse teardown", () => {
  const calls = [];
  const composition = new BrowserPresentationComposition({
    adapterFactories: [
      (context) => ({
        attach: () => calls.push(["first:attach", context.runtime]),
        render: (frame) => calls.push(["first:render", frame.tick]),
        reset: (context) => calls.push(["first:reset", context.reason]),
        teardown: () => calls.push("first:teardown"),
      }),
      () => ({
        render: (frame) => calls.push(["second:render", frame.tick]),
        unsubscribe: () => calls.push("second:unsubscribe"),
      }),
    ],
  });
  assert.equal(composition.start({ runtime: "engine" }), true);
  assert.equal(composition.render(Object.freeze({ tick: 12 })), true);
  assert.equal(composition.reset({ reason: "restart" }), true);
  assert.equal(composition.teardown(), true);
  assert.equal(composition.started, false);
  assert.equal(composition.adapterCount, 0);
  assert.deepEqual(calls, [["first:attach", "engine"], ["first:render", 12], ["second:render", 12], ["first:reset", "restart"], "second:unsubscribe", "first:teardown"]);
});

test("startup rollback preserves the primary error and cleans every adapter despite disposer failures", () => {
  const calls = [];
  const primary = new Error("adapter failed");
  const cleanup = new Error("cleanup failed");
  const composition = new BrowserPresentationComposition({ adapterFactories: [
    () => ({ teardown: () => calls.push("first:teardown") }),
    () => ({ attach: () => { throw primary; }, teardown: () => { calls.push("second:teardown"); throw cleanup; } }),
  ] });
  assert.throws(() => composition.start(), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.deepEqual(error.errors, [primary, cleanup]);
    assert.equal(error.cause, primary);
    return true;
  });
  assert.deepEqual(calls, ["second:teardown", "first:teardown"]);
  assert.equal(composition.started, false);
  assert.equal(composition.adapterCount, 0);
});

test("teardown is best-effort, clears state and allows restart after a middle disposer throws", () => {
  const calls = [];
  let generation = 0;
  const composition = new BrowserPresentationComposition({ adapterFactories: [
    () => ({ teardown: () => calls.push(`first:${generation}`) }),
    () => ({ teardown: () => { calls.push(`second:${generation}`); if (generation === 0) throw new Error("middle teardown failed"); } }),
    () => ({ teardown: () => calls.push(`third:${generation}`) }),
  ] });
  composition.start();
  assert.throws(() => composition.teardown(), /middle teardown failed/);
  assert.deepEqual(calls, ["third:0", "second:0", "first:0"]);
  assert.equal(composition.started, false);
  assert.equal(composition.adapterCount, 0);
  generation = 1;
  assert.equal(composition.start(), true);
  assert.equal(composition.teardown(), true);
  assert.deepEqual(calls.slice(-3), ["third:1", "second:1", "first:1"]);
});

test("render and reset attempt every adapter before reporting failures", () => {
  const calls = [];
  const composition = new BrowserPresentationComposition({ adapterFactories: [
    () => ({ render: () => { calls.push("render:first"); throw new Error("render failed"); }, reset: () => { calls.push("reset:first"); throw new Error("reset failed"); } }),
    () => ({ render: () => calls.push("render:second"), reset: () => calls.push("reset:second") }),
  ] });
  composition.start();
  assert.throws(() => composition.render({}), /render failed/);
  assert.throws(() => composition.reset({}), /reset failed/);
  assert.deepEqual(calls, ["render:first", "render:second", "reset:first", "reset:second"]);
  composition.teardown();
});

test("presentation composition passes frozen lifecycle context to adapters", () => {
  let received;
  const composition = new BrowserPresentationComposition({ adapterFactories: [(context) => { received = context; return null; }] });
  composition.start({ target: "browser" });
  assert.equal(Object.isFrozen(received), true);
  assert.throws(() => { received.target = "other"; }, TypeError);
  composition.teardown();
});
