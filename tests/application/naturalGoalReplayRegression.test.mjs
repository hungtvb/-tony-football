import assert from "node:assert/strict";
import test from "node:test";

import { BrowserMatchRuntime } from "../../src/game/application/BrowserMatchRuntime.js";
import { GameCommandSource, GameCommandType, createGameCommand } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";

const STEP = 1 / 60;

const formations = Object.freeze({
  home: Object.freeze([
    { x: 90, y: 350, role: "GK", name: "KAI", number: 1, rating: 86 },
    { x: 260, y: 120, role: "DF", name: "MINH", number: 4, rating: 87 },
    { x: 260, y: 580, role: "DF", name: "NAM", number: 5, rating: 86 },
    { x: 520, y: 120, role: "MF", name: "HUNG", number: 8, rating: 90 },
    { x: 1050, y: 350, role: "FW", name: "TONY", number: 10, rating: 92 },
    { x: 520, y: 580, role: "FW", name: "PHUC", number: 11, rating: 89 },
  ]),
  away: Object.freeze([
    { x: 1110, y: 230, role: "GK", name: "NOVA", number: 1, rating: 87 },
    { x: 900, y: 100, role: "DF", name: "VEX", number: 3, rating: 88 },
    { x: 900, y: 600, role: "DF", name: "ZERO", number: 5, rating: 87 },
    { x: 760, y: 100, role: "MF", name: "ECHO", number: 8, rating: 91 },
    { x: 700, y: 600, role: "FW", name: "BLAZE", number: 9, rating: 92 },
    { x: 700, y: 100, role: "FW", name: "RUSH", number: 11, rating: 90 },
  ]),
});

test("a real shoot command crosses the goal line and enters replay without score mutation", () => {
  const published = [];
  const engine = new MatchEngine({
    formations,
    kickoffDelay: 0,
    goalDuration: 3.65,
    randomSeed: "ton-67-natural-goal",
  });
  const runtime = new BrowserMatchRuntime({
    engine,
    publishEvent: (event) => published.push(event),
  });

  runtime.dispatch(createGameCommand(GameCommandType.START_MATCH, {}, {
    source: GameCommandSource.APPLICATION,
  }));
  runtime.step(STEP);
  published.length = 0;

  assert.equal(engine.setPossession("home-4", { reason: "natural-shot-setup" }), true);
  runtime.dispatch(createGameCommand(GameCommandType.SHOOT, {
    playerId: "home-4",
    power: 1,
    direction: { x: 1, y: 1 },
    modifiers: {},
  }, {
    source: GameCommandSource.HUMAN,
  }));

  let scoredResult = null;
  for (let index = 0; index < 90 && !scoredResult; index += 1) {
    const result = runtime.step(STEP);
    if (result.events.some((event) => event.type === GameEventType.SCORE_CHANGED)) {
      scoredResult = result;
    }
  }

  assert.ok(scoredResult, "the real shot must be detected as a goal");
  assert.deepEqual(scoredResult.snapshot.match.score, [1, 0]);
  assert.equal(scoredResult.snapshot.match.stats.shots[0], 1);
  assert.ok(scoredResult.snapshot.match.goalSequence);
  assert.deepEqual(published.map((event) => event.type), [
    GameEventType.POSSESSION_CHANGED,
    GameEventType.BALL_KICKED,
    GameEventType.POSSESSION_CHANGED,
    GameEventType.SCORE_CHANGED,
    GameEventType.REPLAY_STARTED,
  ]);

  const replaySnapshot = runtime.step(STEP).snapshot;
  assert.equal(replaySnapshot.match.replay.active, true);
  assert.deepEqual(replaySnapshot.match.score, [1, 0]);

  let replayEnded = false;
  for (let index = 0; index < 240 && !replayEnded; index += 1) {
    const result = runtime.step(STEP);
    replayEnded = result.events.some((event) => event.type === GameEventType.REPLAY_ENDED);
  }
  assert.equal(replayEnded, true);
  assert.equal(runtime.snapshot.match.replay.active, false);

  for (let index = 0; index < 90 && runtime.snapshot.match.goalSequence; index += 1) {
    runtime.step(STEP);
  }
  assert.equal(runtime.snapshot.match.goalSequence, null);
  assert.deepEqual(runtime.snapshot.match.score, [1, 0]);
  assert.equal(runtime.snapshot.ball.ownerId, null);
  assert.ok(runtime.snapshot.match.kickoffTimer >= 0);
});
