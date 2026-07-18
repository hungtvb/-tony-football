import assert from "node:assert/strict";
import test from "node:test";

import { BrowserBootstrapComposition } from "../../src/game/application/BrowserBootstrapComposition.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";

function createComposition() {
  const calls = [];
  const listeners = [];
  const target = new EventTarget();
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
    reset: () => true,
    teardown: () => true,
  };
  const simulationLoop = {
    start: () => calls.push("loop:start"),
    stop: () => calls.push("loop:stop"),
    reset: () => {},
    subscribeAfterRender: (listener) => {
      listeners.push(listener);
      calls.push("presentation:subscribe");
      return () => calls.push("presentation:unsubscribe");
    },
  };
  const rendered = [];
  const presentationComposition = {
    start: () => calls.push("presentation:start"),
    render: (frame) => rendered.push(frame),
    reset: () => true,
    teardown: () => calls.push("presentation:teardown"),
  };
  const composition = new BrowserBootstrapComposition({
    target,
    document: { getElementById: () => null },
    runtimeComposition,
    simulationLoop,
    snapshotAdapter: {
      capture: () => snapshot,
      reset: () => {},
      createRenderFrame: (alpha) => Object.freeze({ previous: snapshot, current: snapshot, alpha }),
    },
    presentationComposition,
  });
  return { calls, composition, listeners, rendered, snapshot };
}

test("browser bootstrap subscribes presentation after primary rendering and unsubscribes on teardown", () => {
  const { calls, composition } = createComposition();
  assert.equal(composition.start(), true);
  assert.deepEqual(calls, ["presentation:start", "presentation:subscribe", "loop:start"]);
  assert.equal(composition.teardown(), true);
  assert.deepEqual(calls.slice(-3), [
    "loop:stop",
    "presentation:unsubscribe",
    "presentation:teardown",
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
