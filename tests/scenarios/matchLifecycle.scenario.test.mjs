import assert from "node:assert/strict";
import test from "node:test";

import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { ScenarioRunner } from "./ScenarioRunner.mjs";

test("start, kickoff, representative play, pause and resume use ordered public contracts", () => {
  const runner = new ScenarioRunner({ engineOptions: { kickoffDelay: 0.05, randomSeed: "scenario-lifecycle" } });
  runner.schedule(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  runner.step();
  assert.equal(runner.snapshot.match.state, "playing");
  assert.equal(runner.events[0].type, GameEventType.MATCH_STARTED);
  const frozenTime = runner.snapshot.match.time;
  runner.step(2);
  assert.equal(runner.snapshot.match.time, frozenTime);
  runner.stepUntil((snapshot) => snapshot.match.kickoffTimer === 0, { label: "kickoff completion", maxTicks: 10 });

  runner.schedule(GameCommandType.MOVE, { x: 1, y: 0 }, { source: GameCommandSource.HUMAN });
  const selectedId = runner.snapshot.match.selectedPlayerId;
  const beforeX = runner.snapshot.players.find((player) => player.id === selectedId).x;
  runner.step();
  assert.ok(runner.snapshot.players.find((player) => player.id === selectedId).x > beforeX);

  runner.schedule(GameCommandType.PAUSE_MATCH, {}, { source: GameCommandSource.APPLICATION });
  runner.step();
  const pausedTime = runner.snapshot.match.time;
  assert.equal(runner.snapshot.match.state, "paused");
  runner.step(5);
  assert.equal(runner.snapshot.match.time, pausedTime);

  runner.schedule(GameCommandType.RESUME_MATCH, {}, { source: GameCommandSource.APPLICATION });
  runner.step();
  assert.equal(runner.snapshot.match.state, "playing");
  assert.deepEqual(
    runner.events.filter((event) => [
      GameEventType.MATCH_STARTED,
      GameEventType.MATCH_PAUSED,
      GameEventType.MATCH_RESUMED
    ].includes(event.type)).map((event) => event.type),
    [GameEventType.MATCH_STARTED, GameEventType.MATCH_PAUSED, GameEventType.MATCH_RESUMED]
  );
});

test("restart resets match facts and Full Time fires exactly once", () => {
  const runner = new ScenarioRunner({ engineOptions: { kickoffDelay: 0, matchSeconds: 0.08, randomSeed: "scenario-restart" } });
  runner.schedule(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  runner.step();
  runner.schedule(GameCommandType.MOVE, { x: 1, y: 0 });
  runner.step(2);
  runner.schedule(GameCommandType.RESTART_MATCH, {}, { source: GameCommandSource.APPLICATION });
  runner.step();
  assert.deepEqual(runner.snapshot.match.score, [0, 0]);
  assert.equal(runner.snapshot.ball.ownerId, null);
  assert.equal(runner.events.filter((event) => event.type === GameEventType.MATCH_RESTARTED).length, 1);

  runner.stepUntil((snapshot) => snapshot.match.state === "ended", { label: "Full Time", maxTicks: 20 });
  assert.equal(runner.events.filter((event) => event.type === GameEventType.MATCH_ENDED).length, 1);
  runner.step(3);
  assert.equal(runner.events.filter((event) => event.type === GameEventType.MATCH_ENDED).length, 1);
});
