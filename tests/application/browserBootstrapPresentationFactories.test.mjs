import assert from "node:assert/strict";
import test from "node:test";

import { BrowserBootstrapComposition } from "../../src/game/application/BrowserBootstrapComposition.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";

function keyboardEvent(type, code) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "code", { value: code });
  Object.defineProperty(event, "repeat", { value: false });
  Object.defineProperty(event, "shiftKey", { value: false });
  return event;
}

test("browser bootstrap registers injected presentation factories and publishes immutable input presentation facts", () => {
  const target = new EventTarget();
  const calls = [];
  const listeners = [];
  const renderedFrames = [];
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
          render: (frame) => {
            renderedFrames.push(frame);
            calls.push(["custom:render", frame.snapshot.tick]);
          },
          teardown: () => calls.push("custom:teardown"),
        };
      },
    ],
  });

  composition.start();
  target.dispatchEvent(keyboardEvent("keydown", "KeyD"));
  listeners[0](Object.freeze({ alpha: 0, nowMilliseconds: 16 }));
  target.dispatchEvent(keyboardEvent("keyup", "KeyD"));
  composition.teardown();

  assert.deepEqual(calls[0], ["custom:create", ["document", "target"]]);
  assert.equal(calls.includes("custom:attach"), true);
  assert.equal(calls.indexOf("presentation:ready") < calls.indexOf("loop:start"), true);
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === "custom:render"), true);
  assert.equal(calls.includes("custom:teardown"), true);
  assert.equal(renderedFrames.length, 1);
  assert.ok(Object.isFrozen(renderedFrames[0]));
  assert.ok(Object.isFrozen(renderedFrames[0].activeCharge));
  assert.ok(Object.isFrozen(renderedFrames[0].pressedCodes));
  assert.equal(renderedFrames[0].activeCharge.code, "KeyD");
  assert.deepEqual(renderedFrames[0].pressedCodes, ["KeyD"]);
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
