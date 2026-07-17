import assert from "node:assert/strict";
import test from "node:test";

import { BrowserMatchRuntime } from "../../src/game/application/BrowserMatchRuntime.js";
import {
  GameCommandSource,
  GameCommandType,
  createGameCommand
} from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";

const STEP = 1 / 60;

const formations = Object.freeze({
  home: Object.freeze([
    { x: 90, y: 350, role: "GK", name: "KAI", number: 1, rating: 86 },
    { x: 260, y: 120, role: "DF", name: "MINH", number: 4, rating: 87 },
    { x: 260, y: 580, role: "DF", name: "NAM", number: 5, rating: 86 },
    { x: 520, y: 120, role: "MF", name: "HUNG", number: 8, rating: 90 },
    { x: 690, y: 205, role: "FW", name: "TONY", number: 10, rating: 92 },
    { x: 520, y: 580, role: "FW", name: "PHUC", number: 11, rating: 89 },
  ]),
  away: Object.freeze([
    { x: 360, y: 80, role: "DF", name: "NOVA", number: 1, rating: 87 },
    { x: 390, y: 80, role: "DF", name: "VEX", number: 3, rating: 88 },
    { x: 420, y: 80, role: "DF", name: "ZERO", number: 5, rating: 87 },
    { x: 360, y: 620, role: "MF", name: "ECHO", number: 8, rating: 91 },
    { x: 390, y: 620, role: "FW", name: "BLAZE", number: 9, rating: 92 },
    { x: 420, y: 620, role: "FW", name: "RUSH", number: 11, rating: 90 },
  ]),
});

function findPlayer(snapshot, playerId) {
  return snapshot.players.find((player) => player.id === playerId) ?? null;
}

test("declared commands drive kickoff possession, a natural goal, replay, and coherent restart", () => {
  const published = [];
  const engine = new MatchEngine({
    formations,
    kickoffDelay: 0,
    goalDuration: 3.65,
    randomSeed: "ton-67-command-goal",
  });
  const runtime = new BrowserMatchRuntime({
    engine,
    publishEvent: (event) => published.push(event),
  });
  let sequence = 0;
  const dispatch = (type, payload = {}, source = GameCommandSource.HUMAN) => (
    runtime.dispatch(createGameCommand(type, payload, { source, sequence: sequence++ }))
  );

  dispatch(GameCommandType.START_MATCH, {}, GameCommandSource.APPLICATION);
  runtime.step(STEP);
  assert.equal(runtime.snapshot.match.state, "playing");

  for (let index = 0; index < 120 && runtime.snapshot.ball.ownerId !== "home-4"; index += 1) {
    runtime.step(STEP);
  }
  assert.equal(
    runtime.snapshot.ball.ownerId,
    "home-4",
    "the kickoff taker must gain possession through normal ball simulation"
  );
  assert.ok(published.some((event) => (
    event.type === GameEventType.POSSESSION_CHANGED
    && event.payload.ownerId === "home-4"
  )));
  published.length = 0;

  dispatch(GameCommandType.SET_SPRINT, { active: true });
  for (let index = 0; index < 240; index += 1) {
    const selected = findPlayer(runtime.snapshot, "home-4");
    if (selected?.x >= 1030) break;
    dispatch(GameCommandType.MOVE, { x: 1, y: 0 });
    runtime.step(STEP);
    assert.equal(runtime.snapshot.ball.ownerId, "home-4");
  }

  const shootingPlayer = findPlayer(runtime.snapshot, "home-4");
  assert.ok(shootingPlayer?.x >= 1030, "declared movement commands must reach the shooting lane");
  dispatch(GameCommandType.MOVE, { x: 0, y: 0 });
  dispatch(GameCommandType.SET_SPRINT, { active: false });
  runtime.step(STEP);

  dispatch(GameCommandType.SHOOT, {
    playerId: "home-4",
    power: 1,
    direction: { x: 1, y: 0 },
    modifiers: {},
  });

  let scoredResult = null;
  for (let index = 0; index < 90 && !scoredResult; index += 1) {
    const result = runtime.step(STEP);
    if (result.events.some((event) => event.type === GameEventType.SCORE_CHANGED)) {
      scoredResult = result;
    }
  }

  assert.ok(scoredResult, "the declared shoot command must cross the goal line");
  assert.deepEqual(scoredResult.snapshot.match.score, [1, 0]);
  assert.equal(scoredResult.snapshot.match.stats.shots[0], 1);
  assert.ok(scoredResult.snapshot.match.goalSequence);
  assert.deepEqual(
    published
      .filter((event) => [
        GameEventType.BALL_KICKED,
        GameEventType.POSSESSION_CHANGED,
        GameEventType.SCORE_CHANGED,
        GameEventType.REPLAY_STARTED,
      ].includes(event.type))
      .map((event) => event.type),
    [
      GameEventType.BALL_KICKED,
      GameEventType.POSSESSION_CHANGED,
      GameEventType.SCORE_CHANGED,
      GameEventType.REPLAY_STARTED,
    ]
  );

  let replayProgressed = false;
  let replayEnded = false;
  for (let index = 0; index < 240 && !replayEnded; index += 1) {
    const result = runtime.step(STEP);
    replayProgressed ||= result.snapshot.match.replay.elapsed > STEP;
    replayEnded = result.events.some((event) => event.type === GameEventType.REPLAY_ENDED);
  }
  assert.equal(replayProgressed, true);
  assert.equal(replayEnded, true);
  assert.equal(runtime.snapshot.match.replay.active, false);

  for (let index = 0; index < 90 && runtime.snapshot.match.goalSequence; index += 1) {
    runtime.step(STEP);
  }
  assert.equal(runtime.snapshot.match.goalSequence, null);
  assert.deepEqual(runtime.snapshot.match.score, [1, 0]);
  assert.equal(runtime.snapshot.ball.ownerId, null);
  assert.equal(runtime.snapshot.ball.x, 600);
  assert.equal(runtime.snapshot.ball.y, 350);
  assert.equal(runtime.snapshot.match.kickoffTimer, 0);
  assert.equal(runtime.snapshot.match.controls.lastMode, "defense");
});
