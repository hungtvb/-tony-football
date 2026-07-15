import assert from "node:assert/strict";
import test from "node:test";

import { FixedClock } from "../../src/game/core/FixedClock.js";
import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";

test("MatchEngine creates stable 6v6 state without browser globals", () => {
  const engine = new MatchEngine();
  const snapshot = engine.snapshot;

  assert.equal(snapshot.match.state, "menu");
  assert.equal(snapshot.players.length, 12);
  assert.equal(new Set(snapshot.players.map((player) => player.id)).size, 12);
  assert.equal(snapshot.match.selectedPlayerId, "home-4");
  assert.equal(snapshot.ball.id, "match-ball");
  assert.equal(snapshot.ball.ownerId, null);
});

test("MatchEngine processes lifecycle commands and emits ordered events", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);
  engine.enqueue(GameCommandType.PAUSE_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);
  engine.enqueue(GameCommandType.RESUME_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);

  assert.equal(engine.snapshot.match.state, "playing");
  assert.deepEqual(
    engine.drainEvents().map((event) => event.type),
    [GameEventType.MATCH_STARTED, GameEventType.MATCH_PAUSED, GameEventType.MATCH_RESUMED]
  );
});

test("MatchEngine clock starts after kickoff delay and ends exactly once", () => {
  const engine = new MatchEngine({ matchSeconds: 0.05, kickoffDelay: 0.02 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(0.01);
  assert.equal(engine.snapshot.match.time, 0.05);
  engine.step(0.01);
  assert.equal(engine.snapshot.match.time, 0.05);
  engine.step(0.05);
  assert.equal(engine.snapshot.match.time, 0);
  assert.equal(engine.snapshot.match.state, "ended");
  assert.equal(engine.drainEvents().filter((event) => event.type === GameEventType.MATCH_ENDED).length, 1);
  engine.step(0.05);
  assert.equal(engine.drainEvents().length, 0);
});

test("restart creates fresh entities while preserving selected match settings", () => {
  const engine = new MatchEngine({ difficulty: "legend", pitchStyle: "dry", ballStyle: "volt", weather: "rain" });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);
  engine.setPossession("home-4");
  engine.recordGoal(0, { scorerId: "home-4" });

  engine.enqueue(GameCommandType.RESTART_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);
  const snapshot = engine.snapshot;
  assert.deepEqual(snapshot.match.score, [0, 0]);
  assert.equal(snapshot.ball.ownerId, null);
  assert.equal(snapshot.match.difficulty, "legend");
  assert.deepEqual(snapshot.match.settings, { pitchStyle: "dry", ballStyle: "volt", weather: "rain" });
  assert.equal(snapshot.players.find((player) => player.id === "home-4").x, 690);
});

test("control commands drive engine-owned movement while actions remain buffered intents", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.enqueue(GameCommandType.MOVE, { x: 1, y: 0 });
  engine.enqueue(GameCommandType.SET_SPRINT, { active: true });
  engine.enqueue(GameCommandType.SHOOT, { power: 0.7, direction: { x: 1, y: 0 } });
  engine.step(1 / 60);

  const player = engine.snapshot.players.find((candidate) => candidate.id === engine.snapshot.match.selectedPlayerId);
  assert.ok(player.x > 690);
  assert.equal(player.sprinting, true);
  assert.ok(player.stamina < 100);
  assert.deepEqual(engine.snapshot.match.controls, {
    moveX: 1,
    moveY: 0,
    sprinting: true,
    shielding: false
  });
  const intents = engine.drainActionIntents();
  assert.equal(intents.length, 1);
  assert.equal(intents[0].type, GameCommandType.SHOOT);
  assert.equal(engine.drainActionIntents().length, 0);
});

test("score and possession facts are engine-owned and event-driven", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);
  engine.drainEvents();

  assert.equal(engine.setPossession("home-4", { reason: "first-touch" }), true);
  assert.equal(engine.setPossession("home-4", { reason: "same-owner" }), false);
  assert.equal(engine.recordGoal(0, { scorerId: "home-4" }), true);
  assert.equal(engine.recordGoal(0, { scorerId: "home-4" }), false);
  assert.deepEqual(engine.snapshot.match.score, [0, 0]);

  engine.step(1 / 60);
  assert.deepEqual(engine.snapshot.match.score, [1, 0]);
  assert.equal(engine.snapshot.ball.ownerId, null);
  assert.equal(engine.snapshot.ball.possession.ownerId, null);
  assert.equal(engine.snapshot.ball.possession.releaseReason, "goal");
  assert.deepEqual(
    engine.drainEvents().map((event) => event.type),
    [GameEventType.POSSESSION_CHANGED, GameEventType.SCORE_CHANGED]
  );
});

test("goal sequence returns to kickoff without resetting score or match time", () => {
  const engine = new MatchEngine({ kickoffDelay: 0.01, goalDuration: 0.02 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(0.01);
  const timeBeforeGoal = engine.snapshot.match.time;
  engine.recordGoal(0, { scorerId: "home-4" });

  engine.step(0.02);
  assert.deepEqual(engine.snapshot.match.score, [1, 0]);
  assert.equal(engine.snapshot.match.goalSequence, null);
  assert.equal(engine.snapshot.match.kickoffTimer, 0.01);
  assert.equal(engine.snapshot.match.time, timeBeforeGoal);
  assert.equal(engine.snapshot.ball.ownerId, null);
  assert.equal(engine.snapshot.players.find((player) => player.id === "away-4").x, 626);
  assert.equal(engine.snapshot.players.find((player) => player.id === "away-4").y, 350);

  engine.step(0.01);
  assert.equal(engine.snapshot.match.time, timeBeforeGoal);
  engine.step(0.01);
  assert.ok(engine.snapshot.match.time < timeBeforeGoal);
});

test("render frames retain previous and current immutable snapshots", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  const initial = engine.snapshot;
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);

  const frame = engine.createRenderFrame(0.4);
  assert.equal(frame.previous, initial);
  assert.equal(frame.current, engine.snapshot);
  assert.equal(frame.alpha, 0.4);
  assert.ok(Object.isFrozen(frame.current.players[0]));
});

test("fixed render schedules produce equal headless lifecycle snapshots", () => {
  function simulate(framesPerSecond) {
    const engine = new MatchEngine({ matchSeconds: 10, kickoffDelay: 0 });
    const clock = new FixedClock();
    engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
    clock.advance(0, () => {});
    for (let frame = 1; frame <= framesPerSecond * 2; frame += 1) {
      clock.advance(frame / framesPerSecond, (dt) => engine.step(dt));
    }
    return engine.snapshot;
  }

  const at30 = simulate(30);
  const at60 = simulate(60);
  const at120 = simulate(120);
  assert.equal(at30.tick, 120);
  assert.deepEqual(at30, at60);
  assert.deepEqual(at60, at120);
});
