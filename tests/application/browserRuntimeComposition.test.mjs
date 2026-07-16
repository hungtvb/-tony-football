import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationActionType } from "../../src/game/application/ApplicationActions.js";
import { ApplicationRuntime } from "../../src/game/application/ApplicationRuntime.js";
import {
  BrowserRuntimeComposition,
  BrowserRuntimeMode,
  resolveBrowserRuntimeMode,
} from "../../src/game/application/BrowserRuntimeComposition.js";
import {
  GameCommandSource,
  GameCommandType,
  createGameCommand,
} from "../../src/game/engine/GameCommands.js";
import { createMatchBall, createMatchPlayers } from "../../src/game/engine/MatchState.js";
import { CompatibilitySnapshotAdapter } from "../../src/game/presentation/CompatibilitySnapshotAdapter.js";

function createSource(tick = 0) {
  const players = createMatchPlayers().map((player) => ({ ...player }));
  const selectedPlayer = players.find((player) => player.id === "home-4");
  const engineBall = createMatchBall();
  return {
    tick,
    state: "menu",
    matchSeconds: 150,
    time: 150,
    difficulty: "pro",
    score: [0, 0],
    stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
    settings: { pitchStyle: "classic", ballStyle: "classic", weather: "clear" },
    replay: { active: false, elapsed: 0, duration: 3.05 },
    selectedPlayer,
    players,
    ball: {
      ...engineBall,
      owner: null,
      lastTouch: null,
    },
  };
}

function applicationRuntime(runtimeComposition, compatibilityCommands = []) {
  return new ApplicationRuntime({
    dispatchGameCommand: (command) => compatibilityCommands.push(command),
    runtimeComposition,
  });
}

test("browser runtime mode defaults to engine while retaining explicit compatibility paths", () => {
  assert.equal(resolveBrowserRuntimeMode(null), BrowserRuntimeMode.COMPATIBILITY);
  assert.equal(resolveBrowserRuntimeMode(""), BrowserRuntimeMode.ENGINE);
  assert.equal(resolveBrowserRuntimeMode("?runtime=engine"), BrowserRuntimeMode.ENGINE);
  assert.equal(resolveBrowserRuntimeMode("?runtime=compatibility"), BrowserRuntimeMode.COMPATIBILITY);
  assert.equal(resolveBrowserRuntimeMode("?debugScenario=low-stamina"), BrowserRuntimeMode.COMPATIBILITY);
  assert.equal(resolveBrowserRuntimeMode("?runtime=engine&debugScenario=low-stamina"), BrowserRuntimeMode.ENGINE);
});

test("live browser composition owns lifecycle commands and authoritative snapshots", () => {
  const composition = new BrowserRuntimeComposition({ mode: BrowserRuntimeMode.ENGINE });
  const adapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition: composition,
  });
  const compatibilityCommands = [];
  const runtime = applicationRuntime(composition, compatibilityCommands);
  const source = createSource(0);

  const initial = adapter.capture(source);
  assert.equal(initial.match.state, "menu");

  runtime.request(ApplicationActionType.START_MATCH);
  source.tick = 1;
  const playing = adapter.capture(source);

  assert.equal(playing.match.state, "playing");
  assert.equal(composition.state, "playing");
  assert.deepEqual(compatibilityCommands, []);
  assert.equal(adapter.snapshot, composition.snapshot);
  assert.equal(adapter.createRenderFrame(0.5).current, composition.snapshot);
});

test("human commands advance deterministically through the same live runtime boundary", () => {
  const left = new BrowserRuntimeComposition({ mode: BrowserRuntimeMode.ENGINE });
  const right = new BrowserRuntimeComposition({ mode: BrowserRuntimeMode.ENGINE });
  const leftAdapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition: left,
  });
  const rightAdapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition: right,
  });
  const leftSource = createSource(0);
  const rightSource = createSource(0);

  leftAdapter.capture(leftSource);
  rightAdapter.capture(rightSource);
  for (const composition of [left, right]) {
    composition.dispatch(createGameCommand(GameCommandType.START_MATCH, {}, {
      source: GameCommandSource.APPLICATION,
    }));
  }
  leftSource.tick = 1;
  rightSource.tick = 1;
  leftAdapter.capture(leftSource);
  rightAdapter.capture(rightSource);

  for (const composition of [left, right]) {
    composition.dispatch(createGameCommand(GameCommandType.MOVE, { x: 0.8, y: -0.2 }, {
      source: GameCommandSource.HUMAN,
    }));
    composition.dispatch(createGameCommand(GameCommandType.SET_SPRINT, { active: true }, {
      source: GameCommandSource.HUMAN,
    }));
  }
  leftSource.tick = 2;
  rightSource.tick = 2;
  const leftSnapshot = leftAdapter.capture(leftSource);
  const rightSnapshot = rightAdapter.capture(rightSource);

  assert.deepEqual(leftSnapshot, rightSnapshot);
  assert.equal(leftSnapshot.match.controls.moveX, 0.8);
  assert.equal(leftSnapshot.match.controls.sprinting, true);
});

test("engine snapshots are mirrored only into legacy presentation objects", () => {
  const composition = new BrowserRuntimeComposition({ mode: BrowserRuntimeMode.ENGINE });
  const adapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition: composition,
  });
  const source = createSource(0);

  adapter.capture(source);
  composition.dispatch(createGameCommand(GameCommandType.START_MATCH, {}, {
    source: GameCommandSource.APPLICATION,
  }));
  source.tick = 1;
  const snapshot = adapter.capture(source);

  const snapshotSelected = snapshot.players.find((player) => player.id === snapshot.match.selectedPlayerId);
  const legacySelected = source.players.find((player) => player.team === 0 && player.index === 4);
  assert.equal(legacySelected.x, snapshotSelected.x);
  assert.deepEqual(source.score, snapshot.match.score);
  assert.deepEqual(source.stats.possession, snapshot.match.stats.possession);
});

test("compatibility mode preserves the legacy dispatch callback", () => {
  const composition = new BrowserRuntimeComposition({ mode: BrowserRuntimeMode.COMPATIBILITY });
  const compatibilityCommands = [];
  const runtime = applicationRuntime(composition, compatibilityCommands);

  runtime.request(ApplicationActionType.START_MATCH);

  assert.equal(compatibilityCommands.length, 1);
  assert.equal(compatibilityCommands[0].type, GameCommandType.START_MATCH);
});
