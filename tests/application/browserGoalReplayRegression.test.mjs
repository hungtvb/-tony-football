import assert from "node:assert/strict";
import test from "node:test";

import { BrowserMatchRuntime } from "../../src/game/application/BrowserMatchRuntime.js";
import { GameCommandSource, GameCommandType, createGameCommand } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { GoalSequencePhase } from "../../src/game/engine/GoalSequenceTimeline.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";

const STEP = 1 / 60;

test("runtime publishes phase events consistent with the same-step replay snapshot", () => {
  const engine = new MatchEngine({ kickoffDelay: 0.25, goalDuration: 0.439 });
  const published = [];
  const runtime = new BrowserMatchRuntime({
    engine,
    publishEvent: (event) => published.push(event),
  });

  runtime.dispatch(createGameCommand(GameCommandType.START_MATCH, {}, {
    source: GameCommandSource.APPLICATION,
  }));
  runtime.step(STEP);
  published.length = 0;

  assert.equal(engine.recordGoal(0, { scorerId: "home-4" }), true);
  const scored = runtime.step(STEP);
  assert.deepEqual(scored.events.map((event) => event.type), [GameEventType.SCORE_CHANGED]);
  assert.equal(scored.snapshot.match.goalSequence.phase, GoalSequencePhase.NATIVE_HIGHLIGHT);
  assert.equal(scored.snapshot.match.replay.active, false);

  const phaseEvents = [];
  let replayStartedResult = null;
  for (let index = 0; index < 60 && !replayStartedResult; index += 1) {
    const result = runtime.step(STEP);
    phaseEvents.push(...result.events.filter((event) => event.type === GameEventType.GOAL_PHASE_CHANGED));
    if (result.events.some((event) => event.type === GameEventType.REPLAY_STARTED)) {
      replayStartedResult = result;
    }
  }

  assert.ok(replayStartedResult, "authoritative replay must start after announcement phases");
  assert.deepEqual(phaseEvents.map((event) => event.payload.phase), [
    GoalSequencePhase.GOAL_CARD,
    GoalSequencePhase.SCORE_CARD,
    GoalSequencePhase.REPLAY,
  ]);
  assert.equal(replayStartedResult.snapshot.match.goalSequence.phase, GoalSequencePhase.REPLAY);
  assert.equal(replayStartedResult.snapshot.match.replay.active, true);
  assert.ok(replayStartedResult.snapshot.match.replay.elapsed >= 0);

  let completedResult = null;
  for (let index = 0; index < 60 && !completedResult; index += 1) {
    const result = runtime.step(STEP);
    if (result.events.some((event) => event.type === GameEventType.REPLAY_ENDED)) {
      completedResult = result;
    }
  }

  assert.ok(completedResult, "replay must end once and hand directly to kickoff");
  assert.deepEqual(completedResult.events.map((event) => event.type), [
    GameEventType.REPLAY_ENDED,
    GameEventType.GOAL_PHASE_CHANGED,
  ]);
  assert.equal(completedResult.events[1].payload.phase, GoalSequencePhase.KICKOFF);
  assert.equal(completedResult.snapshot.match.replay.active, false);
  assert.equal(completedResult.snapshot.match.goalSequence, null);
  assert.ok(completedResult.snapshot.match.kickoffTimer > 0);
});
