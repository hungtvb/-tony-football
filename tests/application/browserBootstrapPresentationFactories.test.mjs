import assert from "node:assert/strict";
import test from "node:test";

import { BrowserBootstrapComposition } from "../../src/game/application/BrowserBootstrapComposition.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";

test("browser bootstrap registers injected presentation factories before built-in adapters", () => {
  const target = new EventTarget();
  const calls = [];
  const listeners = [];
  const snapshot = createMatchSnapshot({
    tick: 1,
    match: { state: "playing", elapsed: 1, matchSeconds: 150, score: [0, 0], selectedPlayerId: null },
    players: [],
    ball: { id: "ball", ownerId: null, x: 600, y: 350 },
  });
  const runtimeComposition = {
    authoritative: true,
    state: "playing",
    controlMode: "attack",
    attachTarget: () => true,
    dispatch: () => true,
    reset: () => true,
    teardown: () => true,
  };
  const simulationLoop = {
    start: () => calls.push("loop:start"),
    stop: () => {},
    reset: () => {},
    subscribeAfterRender: (listener) => {
      listeners.push(listener);
      return () => {};
    },
  };

  const composition = new BrowserBootstrapComposition({
    target,
    document: { getElementById: () => null },
    runtimeComposition,
    simulationLoop,
    snapshotAdapter: {
      capture: () => snapshot,
      createRenderFrame: () => Object.freeze({ previous: snapshot, current: snapshot, alpha: 0 }),
      reset: () => {},
    },
    onPresentationReady: () => calls.push("presentation:ready"),
    presentationAdapterFactories: [
      (context) => {
        calls.push(["custom:create", Object.keys(context).sort()]);
        return {
          attach: () => calls.push("custom:attach"),
          render: (frame) => calls.push(["custom:render", frame.snapshot.tick]),
          teardown: () => calls.push("custom:teardown"),
        };
      },
    ],
  });

  composition.start();
  listeners[0](Object.freeze({ alpha: 0, nowMilliseconds: 16 }));
  composition.teardown();

  assert.deepEqual(calls[0], ["custom:create", ["document", "target"]]);
  assert.equal(calls.includes("custom:attach"), true);
  assert.equal(calls.indexOf("presentation:ready") < calls.indexOf("loop:start"), true);
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === "custom:render"), true);
  assert.equal(calls.includes("custom:teardown"), true);
});

test("browser bootstrap rejects invalid injected presentation factories", () => {
  const target = new EventTarget();
  const runtimeComposition = {
    authoritative: true,
    state: "menu",
    controlMode: "attack",
    attachTarget: () => true,
    dispatch: () => true,
    reset: () => true,
    teardown: () => true,
  };
  assert.throws(() => new BrowserBootstrapComposition({
    target,
    document: { getElementById: () => null },
    runtimeComposition,
    simulationLoop: { start() {}, stop() {}, reset() {} },
    snapshotAdapter: { capture() {} },
    presentationAdapterFactories: [null],
  }), /presentationAdapterFactories/);
});
