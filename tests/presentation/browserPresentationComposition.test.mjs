import assert from "node:assert/strict";
import test from "node:test";

import { BrowserPresentationComposition } from "../../src/game/presentation/BrowserPresentationComposition.js";

test("presentation composition owns adapter start render reset and reverse teardown", () => {
  const calls = [];
  const composition = new BrowserPresentationComposition({
    adapterFactories: [
      (context) => {
        calls.push(["first:create", context.runtime]);
        return {
          attach: () => calls.push("first:attach"),
          render: (frame) => calls.push(["first:render", frame.tick]),
          reset: (context) => calls.push(["first:reset", context.reason]),
          teardown: () => calls.push("first:teardown"),
        };
      },
      () => {
        calls.push("second:create");
        return {
          render: (frame) => calls.push(["second:render", frame.tick]),
          unsubscribe: () => calls.push("second:unsubscribe"),
        };
      },
    ],
  });

  assert.equal(composition.start({ runtime: "engine" }), true);
  assert.equal(composition.start({ runtime: "engine" }), false);
  assert.equal(composition.started, true);
  assert.equal(composition.adapterCount, 2);

  assert.equal(composition.render(Object.freeze({ tick: 12 })), true);
  assert.equal(composition.reset({ reason: "restart" }), true);
  assert.equal(composition.teardown(), true);
  assert.equal(composition.teardown(), false);
  assert.equal(composition.started, false);
  assert.equal(composition.adapterCount, 0);

  assert.deepEqual(calls, [
    ["first:create", "engine"],
    "first:attach",
    "second:create",
    ["first:render", 12],
    ["second:render", 12],
    ["first:reset", "restart"],
    "second:unsubscribe",
    "first:teardown",
  ]);
});

test("presentation composition rolls back already-created adapters when startup fails", () => {
  const calls = [];
  const composition = new BrowserPresentationComposition({
    adapterFactories: [
      () => ({ teardown: () => calls.push("first:teardown") }),
      () => ({
        attach: () => { throw new Error("adapter failed"); },
        teardown: () => calls.push("second:teardown"),
      }),
    ],
  });

  assert.throws(() => composition.start(), /adapter failed/);
  assert.deepEqual(calls, ["second:teardown", "first:teardown"]);
  assert.equal(composition.started, false);
  assert.equal(composition.adapterCount, 0);
});

test("presentation composition passes frozen lifecycle context to adapters", () => {
  let received;
  const composition = new BrowserPresentationComposition({
    adapterFactories: [(context) => {
      received = context;
      return null;
    }],
  });

  composition.start({ runtime: "engine" });
  assert.equal(Object.isFrozen(received), true);
  assert.throws(() => { received.runtime = "compatibility"; }, TypeError);
  composition.teardown();
});
