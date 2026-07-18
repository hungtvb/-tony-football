import assert from "node:assert/strict";
import test from "node:test";

import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { GoalSequencePhase } from "../../src/game/engine/GoalSequenceTimeline.js";
import { ScenarioRunner } from "./ScenarioRunner.mjs";
import { compactGoalFormations, findPlayer } from "./fixtures.mjs";

test("natural command path produces ordered announcement, full replay and coherent kickoff", () => {
  const runner = new ScenarioRunner({
    engineOptions: {
      formations: compactGoalFormations,
      kickoffDelay: 0,
      goalDuration: 0.439,
      randomSeed: "ton-43-natural-goal"
    },
    maxTicks: 1_000
  });

  runner.schedule(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  runner.step();
  runner.schedule(GameCommandType.MOVE, { x: 1, y: 0 }, { source: GameCommandSource.HUMAN });
  runner.step(4);
  runner.schedule(GameCommandType.MOVE, { x: 0, y: 0 }, { source: GameCommandSource.HUMAN });
  runner.stepUntil((snapshot) => snapshot.ball.ownerId === "home-4", {
    label: "selected player first touch",
    maxTicks: 120
  });

  runner.schedule(GameCommandType.SET_SPRINT, { active: true }, { source: GameCommandSource.HUMAN });
  while (findPlayer(runner.snapshot, "home-4").x < 1030) {
    runner.schedule(GameCommandType.MOVE, { x: 1, y: 0 }, { source: GameCommandSource.HUMAN });
    runner.step();
    assert.equal(runner.snapshot.ball.ownerId, "home-4");
  }
  runner.schedule(GameCommandType.MOVE, { x: 0, y: 0 }, { source: GameCommandSource.HUMAN });
  runner.schedule(GameCommandType.SET_SPRINT, { active: false }, { source: GameCommandSource.HUMAN });
  runner.step();
  runner.schedule(GameCommandType.SHOOT, {
    playerId: "home-4",
    power: 1,
    direction: { x: 1, y: 0 },
    modifiers: {}
  }, { source: GameCommandSource.HUMAN });

  const scoreResult = runner.stepUntil((snapshot, events) => (
    events.some((event) => event.type === GameEventType.SCORE_CHANGED)
  ), { label: "natural goal", maxTicks: 90 });
  assert.deepEqual(scoreResult.snapshot.match.score, [1, 0]);
  assert.equal(scoreResult.snapshot.match.replay.active, false);
  assert.equal(scoreResult.snapshot.match.goalSequence.phase, GoalSequencePhase.NATIVE_HIGHLIGHT);
  assert.ok(scoreResult.snapshot.match.stats.shots[0] >= 1);

  const replayStart = runner.stepUntil((snapshot, events) => (
    events.some((event) => event.type === GameEventType.REPLAY_STARTED)
  ), { label: "replay start after announcement", maxTicks: 100 });
  const replayPhaseEvent = replayStart.events.find((event) => (
    event.type === GameEventType.GOAL_PHASE_CHANGED && event.payload.phase === GoalSequencePhase.REPLAY
  ));
  const replayStartedEvent = replayStart.events.find((event) => event.type === GameEventType.REPLAY_STARTED);
  assert.equal(replayStart.snapshot.match.goalSequence.phase, GoalSequencePhase.REPLAY);
  assert.equal(replayStart.snapshot.match.replay.active, true);
  assert.equal(replayPhaseEvent.tick, replayStart.snapshot.tick);
  assert.equal(replayStartedEvent.tick, replayStart.snapshot.tick);
  assert.ok(replayPhaseEvent.sequence < replayStartedEvent.sequence);
  assert.deepEqual(
    runner.events.filter((event) => event.type === GameEventType.GOAL_PHASE_CHANGED).map((event) => event.payload.phase),
    [GoalSequencePhase.GOAL_CARD, GoalSequencePhase.SCORE_CARD, GoalSequencePhase.REPLAY]
  );

  const replayEnd = runner.stepUntil((snapshot, events) => (
    events.some((event) => event.type === GameEventType.REPLAY_ENDED)
  ), { label: "full replay end", maxTicks: 250 });
  assert.deepEqual(replayEnd.events.map((event) => event.type), [
    GameEventType.REPLAY_ENDED,
    GameEventType.GOAL_PHASE_CHANGED
  ]);
  assert.equal(replayEnd.events[1].payload.phase, GoalSequencePhase.KICKOFF);
  assert.equal(replayEnd.events[0].tick, replayEnd.snapshot.tick);
  assert.equal(replayEnd.events[1].tick, replayEnd.snapshot.tick);
  assert.ok(replayEnd.events[0].sequence < replayEnd.events[1].sequence);
  assert.equal(replayEnd.snapshot.match.replay.active, false);
  assert.equal(replayEnd.snapshot.match.goalSequence, null);
  assert.deepEqual(replayEnd.snapshot.match.score, [1, 0]);
  assert.equal(replayEnd.snapshot.ball.ownerId, null);
  assert.equal(replayEnd.snapshot.ball.x, 600);
  assert.equal(replayEnd.snapshot.ball.y, 350);
});

test("idle public engine path progresses passes, shots and statistics", () => {
  const runner = new ScenarioRunner({
    engineOptions: { kickoffDelay: 0, matchSeconds: 120, randomSeed: "ton-43-activity" },
    maxTicks: 6_000
  });
  runner.schedule(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  runner.step();
  runner.stepUntil((snapshot) => (
    snapshot.match.stats.passes > 0 && snapshot.match.stats.shots.some((count) => count > 0)
  ), { label: "representative pass and shot statistics", maxTicks: 5_400 });
  assert.ok(runner.events.some((event) => (
    event.type === GameEventType.BALL_KICKED && event.payload.type !== GameCommandType.SHOOT
  )));
  assert.ok(runner.events.some((event) => (
    event.type === GameEventType.BALL_KICKED && event.payload.type === GameCommandType.SHOOT
  )));
});
