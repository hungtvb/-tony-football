import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationActionType } from "../../src/game/application/ApplicationActions.js";
import { ApplicationRuntime } from "../../src/game/application/ApplicationRuntime.js";
import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";

function createRuntimeComposition({ commands = [], getState = () => "menu" } = {}) {
  return {
    authoritative: true,
    get state() {
      return getState();
    },
    dispatch: (command) => {
      commands.push(command);
      return true;
    },
    reset: () => true,
  };
}

test("application runtime translates lifecycle requests into immutable engine commands", () => {
  const commands = [];
  const runtime = new ApplicationRuntime({
    runtimeComposition: createRuntimeComposition({ commands }),
  });
  runtime.request(ApplicationActionType.START_MATCH);
  runtime.request(ApplicationActionType.RESTART_MATCH);

  assert.deepEqual(commands.map((command) => command.type), [
    GameCommandType.START_MATCH,
    GameCommandType.RESTART_MATCH
  ]);
  assert.deepEqual(commands.map((command) => command.sequence), [0, 1]);
  assert.ok(commands.every((command) => command.source === GameCommandSource.APPLICATION));
  assert.ok(commands.every(Object.isFrozen));
});

test("toggle pause resolves from live match state without presentation inference", () => {
  const commands = [];
  let state = "playing";
  const runtime = new ApplicationRuntime({
    runtimeComposition: createRuntimeComposition({ commands, getState: () => state }),
  });
  runtime.request(ApplicationActionType.TOGGLE_PAUSE);
  state = "paused";
  runtime.request(ApplicationActionType.TOGGLE_PAUSE);
  state = "menu";
  runtime.request(ApplicationActionType.TOGGLE_PAUSE);

  assert.deepEqual(commands.map((command) => command.type), [
    GameCommandType.PAUSE_MATCH,
    GameCommandType.RESUME_MATCH
  ]);
});

test("navigation remains an explicit application action outside MatchEngine", () => {
  const navigation = [];
  const runtime = new ApplicationRuntime({
    runtimeComposition: createRuntimeComposition(),
    onNavigation: (action) => navigation.push(action)
  });
  runtime.request(ApplicationActionType.OPEN_MATCH_SETUP);
  runtime.request(ApplicationActionType.OPEN_MAIN_MENU);

  assert.deepEqual(navigation.map((action) => action.type), [
    ApplicationActionType.OPEN_MATCH_SETUP,
    ApplicationActionType.OPEN_MAIN_MENU
  ]);
  assert.ok(navigation.every(Object.isFrozen));
});