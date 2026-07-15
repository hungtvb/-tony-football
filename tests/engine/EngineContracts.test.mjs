import assert from "node:assert/strict";
import test from "node:test";

import {
  GameCommandBuffer,
  GameCommandSource,
  GameCommandType,
  createGameCommand
} from "../../src/game/engine/GameCommands.js";
import {
  GameEventQueue,
  GameEventType,
  createGameEvent
} from "../../src/game/engine/GameEvents.js";
import {
  createMatchSnapshot,
  createSnapshotFrame
} from "../../src/game/engine/MatchSnapshot.js";

test("game commands are immutable serializable contracts", () => {
  const direction = { x: 1, y: 0 };
  const command = createGameCommand(
    GameCommandType.SHOOT,
    { power: 0.8, direction, modifiers: { finesse: true } },
    { source: GameCommandSource.HUMAN, sequence: 4, targetTick: 20 }
  );

  direction.x = -1;
  assert.equal(command.payload.direction.x, 1);
  assert.equal(command.sequence, 4);
  assert.equal(command.targetTick, 20);
  assert.ok(Object.isFrozen(command));
  assert.ok(Object.isFrozen(command.payload));
  assert.ok(Object.isFrozen(command.payload.modifiers));
  assert.throws(() => { command.payload.power = 0; }, TypeError);
});

test("game commands reject unknown types and invalid payloads", () => {
  assert.throws(() => createGameCommand("player:teleport"), /Unknown game command/);
  assert.throws(() => createGameCommand(GameCommandType.MOVE, { x: 2, y: 0 }), /move.x/);
  assert.throws(() => createGameCommand(GameCommandType.SET_SPRINT, { active: 1 }), /boolean/);
  assert.throws(() => createGameCommand(GameCommandType.SHORT_PASS, { power: 1.2 }), /between 0 and 1/);
  assert.throws(() => createGameCommand(GameCommandType.PAUSE_MATCH, { reason: "menu" }), /does not accept/);
});

test("command buffer assigns deterministic order and drains atomically", () => {
  const buffer = new GameCommandBuffer();
  buffer.enqueue(GameCommandType.MOVE, { x: 0.5, y: -0.25 });
  buffer.enqueue(GameCommandType.SET_SPRINT, { active: true });

  const commands = buffer.drain();
  assert.deepEqual(commands.map((command) => command.sequence), [0, 1]);
  assert.ok(Object.isFrozen(commands));
  assert.equal(buffer.size, 0);
});

test("game event queue preserves explicit tick and emission order", () => {
  const queue = new GameEventQueue();
  queue.emit(GameEventType.MATCH_STARTED, { side: 0 }, { tick: 10 });
  queue.emit(GameEventType.BALL_KICKED, { playerId: "home-10" }, { tick: 10 });
  queue.emit(GameEventType.SCORE_CHANGED, { score: [1, 0] }, { tick: 11 });

  const events = queue.drain();
  assert.deepEqual(events.map((event) => event.sequence), [0, 1, 2]);
  assert.deepEqual(events.map((event) => event.tick), [10, 10, 11]);
  assert.ok(events.every(Object.isFrozen));
  assert.equal(queue.size, 0);
});

test("game events clone payloads and reject browser-shaped class instances", () => {
  const payload = { score: [2, 1] };
  const event = createGameEvent(GameEventType.MATCH_ENDED, payload, { tick: 9000 });
  payload.score[0] = 9;
  assert.deepEqual(event.payload.score, [2, 1]);
  assert.throws(
    () => createGameEvent(GameEventType.BALL_KICKED, { vector: new Date() }),
    /plain objects/
  );
});

test("match snapshots require stable entity ids and are deeply read-only", () => {
  const source = {
    tick: 60,
    match: { state: "playing", time: 149, score: [0, 0] },
    players: [
      { id: "home-10", team: 0, x: 690, y: 205, facing: { x: 1, y: 0 }, action: "run" },
      { id: "away-5", team: 1, x: 930, y: 205, facing: { x: -1, y: 0 }, action: "idle" }
    ],
    ball: { id: "match-ball", x: 700, y: 205, ownerId: "home-10" }
  };

  const snapshot = createMatchSnapshot(source);
  source.players[0].x = 999;
  assert.equal(snapshot.players[0].x, 690);
  assert.ok(Object.isFrozen(snapshot.players));
  assert.ok(Object.isFrozen(snapshot.players[0].facing));
  assert.throws(() => { snapshot.match.state = "ended"; }, TypeError);
});

test("match snapshots reject duplicate and dangling entity ids", () => {
  const match = { state: "playing" };
  assert.throws(() => createMatchSnapshot({
    tick: 0,
    match,
    players: [{ id: "same" }, { id: "same" }],
    ball: { id: "ball" }
  }), /Duplicate player id/);

  assert.throws(() => createMatchSnapshot({
    tick: 0,
    match,
    players: [{ id: "home-10" }],
    ball: { id: "ball", ownerId: "away-9" }
  }), /does not reference/);
});

test("snapshot frames expose bounded render interpolation without mutation", () => {
  const previous = createMatchSnapshot({
    tick: 4,
    match: { state: "playing" },
    players: [{ id: "home-10", x: 10, y: 20 }],
    ball: { id: "ball", ownerId: null }
  });
  const current = createMatchSnapshot({
    tick: 5,
    match: { state: "playing" },
    players: [{ id: "home-10", x: 12, y: 20 }],
    ball: { id: "ball", ownerId: null }
  });

  const frame = createSnapshotFrame(previous, current, 0.25);
  assert.deepEqual(frame, { previous, current, alpha: 0.25 });
  assert.ok(Object.isFrozen(frame));
  assert.throws(() => createSnapshotFrame(current, previous, 0.5), /must not exceed/);
  assert.throws(() => createSnapshotFrame(previous, current, 1.1), /between 0 and 1/);
});
