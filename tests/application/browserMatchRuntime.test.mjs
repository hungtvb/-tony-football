import assert from "node:assert/strict";
import test from "node:test";
import { BrowserMatchRuntime } from "../../src/game/application/BrowserMatchRuntime.js";
import {
  GameCommandSource,
  GameCommandType,
  createGameCommand,
} from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";

const STEP = 1 / 60;

function command(type, payload = {}, options = {}) {
  return createGameCommand(type, payload, options);
}

function createRuntime(options = {}) {
  return new BrowserMatchRuntime({
    engineOptions: {
      kickoffDelay: 0,
      randomSeed: "browser-runtime-test",
      ...options,
    },
  });
}

test("browser runtime schedules human and application commands on the next fixed tick", () => {
  const published = [];
  const runtime = new BrowserMatchRuntime({
    engineOptions: { kickoffDelay: 0, randomSeed: "next-tick" },
    publishEvent: (event) => published.push(event),
  });

  runtime.dispatch(command(GameCommandType.START_MATCH, {}, {
    source: GameCommandSource.APPLICATION,
  }));
  runtime.dispatch(command(GameCommandType.MOVE, { x: 1, y: 0 }, {
    source: GameCommandSource.HUMAN,
  }));

  const result = runtime.step(STEP);

  assert.equal(runtime.tick, 1);
  assert.equal(runtime.state, "playing");
  assert.equal(result.snapshot.match.controls.moveX, 1);
  assert.equal(result.events[0]?.type, GameEventType.MATCH_STARTED);
  assert.deepEqual(published, result.events);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.snapshot), true);
  assert.equal(Object.isFrozen(result.events), true);
});

test("browser runtime preserves an explicit future target tick", () => {
  const runtime = createRuntime();
  runtime.dispatch(command(GameCommandType.START_MATCH, {}, {
    source: GameCommandSource.APPLICATION,
    targetTick: 3,
  }));

  runtime.step(STEP);
  assert.equal(runtime.state, "menu");
  runtime.step(STEP);
  assert.equal(runtime.state, "menu");
  runtime.step(STEP);
  assert.equal(runtime.state, "playing");
});

test("browser runtime produces deterministic snapshots for equal command and tick sequences", () => {
  const left = createRuntime({ randomSeed: "parity-seed" });
  const right = createRuntime({ randomSeed: "parity-seed" });

  const execute = (runtime) => {
    runtime.dispatch(command(GameCommandType.START_MATCH, {}, {
      source: GameCommandSource.APPLICATION,
    }));
    runtime.step(STEP);
    runtime.dispatch(command(GameCommandType.MOVE, { x: 0.75, y: -0.25 }, {
      source: GameCommandSource.HUMAN,
    }));
    runtime.dispatch(command(GameCommandType.SET_SPRINT, { active: true }, {
      source: GameCommandSource.HUMAN,
    }));
    runtime.step(STEP);
    runtime.step(STEP);
    runtime.dispatch(command(GameCommandType.SET_SPRINT, { active: false }, {
      source: GameCommandSource.HUMAN,
    }));
    runtime.step(STEP);
    return runtime.snapshot;
  };

  assert.deepEqual(execute(left), execute(right));
});

test("browser runtime exposes immutable previous/current render frames", () => {
  const runtime = createRuntime();
  runtime.dispatch(command(GameCommandType.START_MATCH, {}, {
    source: GameCommandSource.APPLICATION,
  }));
  runtime.step(STEP);
  runtime.step(STEP);

  const frame = runtime.createRenderFrame(0.5);

  assert.equal(frame.previous.tick, 1);
  assert.equal(frame.current.tick, 2);
  assert.equal(frame.alpha, 0.5);
  assert.equal(Object.isFrozen(frame), true);
  assert.equal(Object.isFrozen(frame.previous), true);
  assert.equal(Object.isFrozen(frame.current), true);
});
