import assert from "node:assert/strict";
import test from "node:test";

import { BrowserBootstrapComposition } from "../../src/game/application/BrowserBootstrapComposition.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";

function createComposition({ throwPresentationReset = false } = {}) {
  const calls = [];
  const listeners = [];
  const target = new EventTarget();
  const document = { getElementById: () => null };
  const snapshot = createMatchSnapshot({
    tick: 4,
    match: {
      state: "playing",
      elapsed: 12,
      matchSeconds: 150,
      score: [1, 0],
      selectedPlayerId: "home-0",
      stats: { possession: [7, 3], shots: [2, 1], passes: 5, completed: 4 },
    },
    players: [{ id: "home-0", team: 0, name: "TONY", number: 10, rating: 92, stamina: 80 }],
    ball: { id: "match-ball", ownerId: "home-0", x: 600, y: 350 },
  });
  const runtimeComposition = {
    authoritative: true,
    state: "playing",
    controlMode: "attack",
    attachTarget: () => true,
    dispatch: () => true,
    reset: () => calls.push("runtime:reset"),
    teardown: () => true,
  };
  const simulationLoop = {
    start: () => calls.push("loop:start"),
    stop: () => calls.push("loop:stop"),
    reset: () => calls.push("loop:reset"),
    subscribeAfterRender: (listener) => {
      listeners.push(listener);
      calls.push("presentation:subscribe");
      return () => calls.push("presentation:unsubscribe");
    },
  };
  const rendered = [];
  let startContext = null;
  let resetContext = null;
  const presentationComposition = {
    start: (context) => {
      startContext = context;
      calls.push("presentation:start");
    },
    render: (frame) => rendered.push(frame),
    reset: (context) => {
      resetContext = context;
      calls.push("presentation:reset");
      if (throwPresentationReset) throw new Error("presentation reset failed");
      return true;
    },
    teardown: () => calls.push("presentation:teardown"),
  };
  const composition = new BrowserBootstrapComposition({
    target,
    document,
    runtimeComposition,
    simulationLoop,
    snapshotAdapter: {
      capture: () => snapshot,
      reset: () => calls.push("snapshot:reset"),
      createRenderFrame: (alpha) => Object.freeze({ previous: snapshot, current: snapshot, alpha }),
    },
    presentationComposition,
  });
  return {
    calls,
    composition,
    listeners,
    rendered,
    snapshot,
    target,
    document,
    getStartContext: () => startContext,
    getResetContext: () => resetContext,
  };
}

test("browser bootstrap subscribes presentation after primary rendering and unsubscribes on teardown", () => {
  const { calls, composition } = createComposition();
  assert.equal(composition.start(), true);
  assert.deepEqual(calls, ["presentation:start", "presentation:subscribe", "loop:start"]);
  assert.equal(composition.teardown(), true);
  assert.deepEqual(calls.slice(-4), [
    "loop:stop",
    "presentation:unsubscribe",
    "presentation:teardown",
    "snapshot:reset",
  ]);
});

test("browser bootstrap fans immutable snapshot facts into presentation adapters", () => {
  const { composition, listeners, rendered, snapshot } = createComposition();
  composition.start();
  listeners[0](Object.freeze({ alpha: 0.25, nowMilliseconds: 1200 }));
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].snapshot, snapshot);
  assert.equal(rendered[0].previousSnapshot, snapshot);
  assert.equal(rendered[0].controlMode, "attack");
  assert.equal(rendered[0].hasActiveInput, false);
  assert.equal(Object.isFrozen(rendered[0]), true);
  assert.equal(Object.isFrozen(rendered[0].snapshot), true);
  composition.teardown();
});

test("browser bootstrap exposes only browser-safe lifecycle context to presentation adapters", () => {
  const {
    composition,
    target,
    document,
    getStartContext,
    getResetContext,
  } = createComposition();
  composition.start();
  composition.reset();

  for (const context of [getStartContext(), getResetContext()]) {
    assert.equal(Object.isFrozen(context), true);
    assert.deepEqual(Object.keys(context).sort(), ["document", "target"]);
    assert.equal(context.target, target);
    assert.equal(context.document, document);
    assert.equal("runtimeComposition" in context, false);
    assert.equal("snapshotAdapter" in context, false);
  }

  composition.teardown();
});

test("presentation reset failures cannot prevent runtime snapshot or simulation reset", () => {
  const { calls, composition } = createComposition({ throwPresentationReset: true });
  composition.start();
  assert.throws(() => composition.reset(1200), /presentation reset failed/);
  assert.deepEqual(
    calls.filter((value) => value.endsWith(":reset")),
    ["runtime:reset", "snapshot:reset", "loop:reset", "presentation:reset"],
  );
  assert.equal(composition.started, true);
  composition.teardown();
});
