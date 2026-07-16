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

test("MatchEngine applies scheduled commands only when targetTick is reached", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  engine.enqueue(GameCommandType.START_MATCH, {}, {
    source: GameCommandSource.APPLICATION,
    targetTick: 3
  });

  engine.step(1 / 60);
  engine.step(1 / 60);
  assert.equal(engine.snapshot.match.state, "menu");
  assert.equal(engine.commandCount, 1);
  assert.equal(engine.drainEvents().length, 0);

  engine.step(1 / 60);
  assert.equal(engine.snapshot.match.state, "playing");
  assert.equal(engine.commandCount, 0);
  assert.equal(engine.drainEvents()[0].tick, 3);
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
  const frame = engine.createRenderFrame(0.5);
  assert.equal(frame.previous, frame.current);
});

test("control commands drive movement and authoritative kick actions", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.enqueue(GameCommandType.MOVE, { x: 1, y: 0 });
  engine.enqueue(GameCommandType.SET_SPRINT, { active: true });
  engine.step(1 / 60);

  const player = engine.snapshot.players.find((candidate) => candidate.id === engine.snapshot.match.selectedPlayerId);
  assert.ok(player.x > 690);
  assert.equal(player.sprinting, true);
  assert.ok(player.stamina < 100);
  assert.deepEqual(engine.snapshot.match.controls, {
    moveX: 1,
    moveY: 0,
    sprinting: true,
    shielding: false,
    goalkeeperRush: false,
    teamPress: false,
    lastMode: "attack"
  });
  engine.setPossession(player.id, { reason: "test-control" });
  engine.drainEvents();
  engine.enqueue(GameCommandType.SHOOT, { power: 0.7, direction: { x: 1, y: 0 } });
  engine.step(1 / 60);

  assert.equal(engine.snapshot.ball.ownerId, null);
  assert.equal(engine.snapshot.match.stats.shots[0], 1);
  assert.deepEqual(
    engine.drainEvents().map((event) => event.type),
    [GameEventType.BALL_KICKED, GameEventType.POSSESSION_CHANGED]
  );
  assert.equal(engine.drainActionIntents().length, 0);
});

test("selected-owner idle grace starts on possession instead of global match idle", () => {
  const engine = new MatchEngine({ kickoffDelay: 0, randomSeed: "fresh-owner-grace" });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  for (let tick = 0; tick < 120; tick += 1) engine.step(1 / 60);

  const selectedId = engine.snapshot.match.selectedPlayerId;
  engine.setPossession(selectedId, { reason: "fresh-owner-test" });
  engine.drainEvents();
  const graceEvents = [];
  for (let tick = 0; tick < 89; tick += 1) {
    engine.step(1 / 60);
    graceEvents.push(...engine.drainEvents());
  }
  const duringGrace = engine.snapshot.players.find((player) => player.id === selectedId);

  assert.equal(engine.snapshot.ball.ownerId, selectedId);
  assert.equal(duringGrace.vx, 0);
  assert.equal(duringGrace.vy, 0);
  assert.equal(graceEvents.some((event) => (
    event.type === GameEventType.BALL_KICKED && event.payload.playerId === selectedId
  )), false);
});

test("active charged attack intent cannot be pre-empted by selected-owner assist", () => {
  const engine = new MatchEngine({ kickoffDelay: 0, randomSeed: "charged-owner-intent" });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);
  const selectedId = engine.snapshot.match.selectedPlayerId;
  engine.setPossession(selectedId, { reason: "charged-owner-test" });
  engine.enqueue(GameCommandType.SET_ATTACK_INTENT, { active: true }, {
    source: GameCommandSource.HUMAN
  });
  engine.drainEvents();
  const chargingEvents = [];
  for (let tick = 0; tick < 120; tick += 1) {
    engine.step(1 / 60);
    chargingEvents.push(...engine.drainEvents());
  }
  const whileCharging = engine.snapshot.players.find((player) => player.id === selectedId);
  assert.equal(engine.snapshot.ball.ownerId, selectedId);
  assert.equal(whileCharging.vx, 0);
  assert.equal(whileCharging.vy, 0);
  assert.equal(chargingEvents.some((event) => (
    event.type === GameEventType.BALL_KICKED && event.payload.playerId === selectedId
  )), false);

  engine.enqueue(GameCommandType.SET_ATTACK_INTENT, { active: false }, {
    source: GameCommandSource.HUMAN
  });
  engine.step(1 / 60);
  assert.equal(engine.snapshot.ball.ownerId, selectedId);
});

test("tackle and teammate-run commands emit explicit gameplay events", () => {
  const engine = new MatchEngine({ kickoffDelay: 0, randomSeed: "player-actions" });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
  engine.step(1 / 60);
  engine.setPossession("home-4");
  engine.drainEvents();
  engine.enqueue(GameCommandType.TRIGGER_TEAMMATE_RUN, {}, { source: GameCommandSource.TEST });
  engine.step(1 / 60);
  assert.deepEqual(
    engine.drainEvents().map((event) => event.type),
    [GameEventType.TEAMMATE_RUN_TRIGGERED]
  );
});

test("defensive AI hold controls remain engine-owned command state", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
  engine.enqueue(GameCommandType.SET_GOALKEEPER_RUSH, { active: true });
  engine.enqueue(GameCommandType.SET_TEAM_PRESS, { active: true });
  engine.step(1 / 60);

  assert.equal(engine.snapshot.match.controls.goalkeeperRush, true);
  assert.equal(engine.snapshot.match.controls.teamPress, true);
});

test("directional switch command selects a teammate in the requested lane", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
  engine.step(1 / 60);
  const before = engine.snapshot.match.selectedPlayerId;
  engine.enqueue(GameCommandType.SWITCH_PLAYER_DIRECTION, {
    direction: { x: -1, y: 0 }
  }, { source: GameCommandSource.TEST });
  engine.step(1 / 60);

  assert.notEqual(engine.snapshot.match.selectedPlayerId, before);
  assert.ok(engine.snapshot.players.find((player) => player.id === engine.snapshot.match.selectedPlayerId).x < 690);
});

test("equal kick commands and seeds produce deterministic ball outcomes", () => {
  function shoot() {
    const engine = new MatchEngine({ kickoffDelay: 0, randomSeed: "kick-parity" });
    engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
    engine.step(1 / 60);
    engine.setPossession("home-4");
    engine.enqueue(GameCommandType.SHOOT, {
      power: 0.65,
      direction: { x: 1, y: -0.35 },
      modifiers: { finesse: true }
    }, { source: GameCommandSource.TEST });
    engine.step(1 / 60);
    return engine.snapshot;
  }

  assert.deepEqual(shoot(), shoot());
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

test("render frames snap across lifecycle resets instead of interpolating old entities", () => {
  const engine = new MatchEngine({ kickoffDelay: 0 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  engine.step(1 / 60);

  const frame = engine.createRenderFrame(0.4);
  assert.equal(frame.previous, engine.snapshot);
  assert.equal(frame.current, engine.snapshot);
  assert.equal(frame.alpha, 0.4);
  assert.ok(Object.isFrozen(frame.current.players[0]));
});

test("custom formations without number 10 retain a valid selected player through home kickoff", () => {
  const formations = {
    home: [
      { x: 90, y: 350, role: "GK", name: "KEEPER", number: 1, rating: 80 },
      { x: 600, y: 350, role: "FW", name: "SEVEN", number: 7, rating: 85 }
    ],
    away: [
      { x: 1110, y: 350, role: "GK", name: "AWAY GK", number: 1, rating: 80 },
      { x: 640, y: 350, role: "FW", name: "NINE", number: 9, rating: 85 }
    ]
  };
  const engine = new MatchEngine({ formations, kickoffDelay: 0, goalDuration: 0.01 });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
  engine.step(1 / 60);
  assert.equal(engine.snapshot.match.selectedPlayerId, "home-1");

  engine.recordGoal(1, { scorerId: "away-1" });
  engine.step(0.01);
  assert.equal(engine.snapshot.match.selectedPlayerId, "home-1");
  assert.ok(engine.snapshot.players.some((player) => player.id === engine.snapshot.match.selectedPlayerId));
  const frame = engine.createRenderFrame(0.5);
  assert.equal(frame.previous, frame.current);
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

test("headless AI match remains finite and referentially valid during a ten-second soak", () => {
  const engine = new MatchEngine({ matchSeconds: 20, kickoffDelay: 0, randomSeed: "ai-soak" });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
  for (let tick = 0; tick < 600; tick += 1) engine.step(1 / 60);
  const snapshot = engine.snapshot;
  const playerIds = new Set(snapshot.players.map((player) => player.id));

  assert.equal(snapshot.tick, 600);
  assert.ok(snapshot.players.every((player) => (
    Number.isFinite(player.x)
    && Number.isFinite(player.y)
    && Number.isFinite(player.vx)
    && Number.isFinite(player.vy)
  )));
  assert.ok(Number.isFinite(snapshot.ball.x));
  assert.ok(Number.isFinite(snapshot.ball.y));
  assert.ok(snapshot.ball.ownerId === null || playerIds.has(snapshot.ball.ownerId));
  assert.ok(snapshot.match.elapsed > 0 && snapshot.match.elapsed < 10.01);
  assert.ok(snapshot.match.time > 9.99 && snapshot.match.time < 20);
});
