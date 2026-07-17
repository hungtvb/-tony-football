import assert from "node:assert/strict";
import test from "node:test";

import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { GoalSequencePhase } from "../../src/game/engine/GoalSequenceTimeline.js";
import { ScenarioRunner, ScenarioFailure } from "./ScenarioRunner.mjs";

test("equal seed, commands and ticks produce byte-equivalent histories", () => {
  const simulate = () => {
    const runner = new ScenarioRunner({ engineOptions: { kickoffDelay: 0, randomSeed: "scenario-equivalence" } });
    runner.schedule(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION, atTick: 2 });
    runner.schedule(GameCommandType.MOVE, { x: 1, y: 0 }, { source: GameCommandSource.HUMAN, atTick: 4 });
    runner.schedule(GameCommandType.SET_SPRINT, { active: true }, { source: GameCommandSource.HUMAN, atTick: 4 });
    runner.schedule(GameCommandType.MOVE, { x: 0, y: 0 }, { source: GameCommandSource.HUMAN, atTick: 20 });
    runner.schedule(GameCommandType.SET_SPRINT, { active: false }, { source: GameCommandSource.HUMAN, atTick: 20 });
    runner.step(120);
    return runner.history.map((frame) => ({
      tick: frame.tick,
      summary: frame.summary,
      events: frame.events
    }));
  };
  assert.deepEqual(simulate(), simulate());
});

test("events agree with immutable snapshot from the same fixed step", () => {
  const runner = new ScenarioRunner({ engineOptions: { kickoffDelay: 0, goalDuration: 0.04, randomSeed: "same-step" } });
  runner.schedule(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  runner.step();
  const engine = runner;
  // Public MatchEngine method is intentionally not exposed by ScenarioRunner; use the natural lifecycle
  // contract already covered elsewhere and verify every lifecycle event/snapshot pair in captured frames.
  runner.step(10);
  for (const frame of runner.history) {
    assert.ok(Object.isFrozen(frame.snapshot));
    assert.ok(Object.isFrozen(frame.events));
    assert.ok(frame.events.every(Object.isFrozen));
    for (const event of frame.events) {
      assert.equal(event.tick, frame.snapshot.tick);
      if (event.type === GameEventType.REPLAY_STARTED) {
        assert.equal(frame.snapshot.match.replay.active, true);
        assert.equal(frame.snapshot.match.goalSequence.phase, GoalSequencePhase.REPLAY);
      }
      if (event.type === GameEventType.REPLAY_ENDED) {
        assert.equal(frame.snapshot.match.replay.active, false);
      }
    }
  }
  assert.throws(() => { runner.snapshot.match.state = "ended"; }, TypeError);
  assert.equal(engine.snapshot.match.state, "playing");
});

test("scenario timeout emits compact command/event/state trace", () => {
  const runner = new ScenarioRunner({ engineOptions: { kickoffDelay: 0 }, traceDepth: 3 });
  runner.schedule(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  assert.throws(
    () => runner.stepUntil((snapshot) => snapshot.match.state === "never", { maxTicks: 3, label: "impossible state" }),
    (error) => {
      assert.ok(error instanceof ScenarioFailure);
      assert.match(error.message, /impossible state/);
      assert.match(error.message, /tick=/);
      assert.match(error.message, /match:started/);
      return true;
    }
  );
});
