import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationActionType } from "../../src/game/application/ApplicationActions.js";
import { BrowserBootstrapComposition } from "../../src/game/application/BrowserBootstrapComposition.js";
import { GameCommandType } from "../../src/game/engine/GameCommands.js";

function createDocument() {
  return { getElementById: () => null };
}

function createSimulationLoop(calls) {
  return {
    start: () => calls.push("loop:start"),
    stop: () => calls.push("loop:stop"),
    reset: (now) => calls.push(["loop:reset", now]),
  };
}

function createRuntimeComposition({ authoritative, calls, commands }) {
  return {
    authoritative,
    state: "playing",
    controlMode: "attack",
    attachTarget: () => {
      calls.push("runtime:attach-target");
      return authoritative;
    },
    dispatch: (command) => {
      if (!authoritative) return false;
      commands.push(command);
      return true;
    },
    reset: () => {
      calls.push("runtime:reset");
      return authoritative;
    },
    teardown: () => {
      calls.push("runtime:teardown");
      return true;
    },
  };
}

function createComposition({ authoritative = true } = {}) {
  const calls = [];
  const commands = [];
  const compatibilityCommands = [];
  const runtimeComposition = createRuntimeComposition({ authoritative, calls, commands });
  const composition = new BrowserBootstrapComposition({
    target: new EventTarget(),
    document: createDocument(),
    runtimeComposition,
    simulationLoop: createSimulationLoop(calls),
    snapshotAdapter: {
      capture: () => null,
      reset: () => calls.push("snapshot:reset"),
    },
    dispatchCompatibilityCommand: (command) => compatibilityCommands.push(command),
    getCompatibilityMatchState: () => "playing",
    createPresentationFeedback: () => {
      calls.push("feedback:subscribe");
      return { unsubscribe: () => calls.push("feedback:unsubscribe") };
    },
  });
  return { composition, calls, commands, compatibilityCommands };
}

test("browser bootstrap starts and tears down owned browser services deterministically", () => {
  const { composition, calls } = createComposition();

  assert.equal(composition.start(), true);
  assert.equal(composition.start(), false);
  assert.equal(composition.started, true);
  assert.deepEqual(calls.slice(0, 3), [
    "runtime:attach-target",
    "feedback:subscribe",
    "loop:start",
  ]);

  assert.equal(composition.teardown(), true);
  assert.equal(composition.teardown(), false);
  assert.equal(composition.started, false);
  assert.deepEqual(calls.slice(-3), [
    "feedback:unsubscribe",
    "snapshot:reset",
    "runtime:teardown",
  ]);
});

test("browser bootstrap routes explicit lifecycle operations through one runtime boundary", () => {
  const { composition, calls, commands } = createComposition();
  composition.start();

  composition.request(ApplicationActionType.START_MATCH);
  composition.pause();
  composition.resume();
  composition.reset(1250);

  assert.deepEqual(commands.slice(0, 3).map((command) => command.type), [
    GameCommandType.START_MATCH,
    GameCommandType.PAUSE_MATCH,
    GameCommandType.RESUME_MATCH,
  ]);
  assert.ok(calls.includes("runtime:reset"));
  assert.ok(calls.includes("snapshot:reset"));
  assert.deepEqual(calls.find((entry) => Array.isArray(entry)), ["loop:reset", 1250]);
});

test("browser bootstrap preserves the explicit compatibility command fallback", () => {
  const { composition, compatibilityCommands } = createComposition({ authoritative: false });
  composition.start();

  composition.request(ApplicationActionType.START_MATCH);
  composition.pause();
  composition.resume();

  assert.deepEqual(compatibilityCommands.slice(0, 3).map((command) => command.type), [
    GameCommandType.START_MATCH,
    GameCommandType.PAUSE_MATCH,
    GameCommandType.RESUME_MATCH,
  ]);
  composition.teardown();
});
