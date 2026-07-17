import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GOAL_SEQUENCE_DURATION,
  GoalSequencePhase,
  advanceGoalSequence,
  createGoalSequence,
  createGoalSequenceTimeline
} from "../../src/game/engine/GoalSequenceTimeline.js";

test("default goal timeline owns announcement then full replay without overlap", () => {
  const timeline = createGoalSequenceTimeline();
  assert.equal(Number(timeline.duration.toFixed(2)), 4.39);
  assert.deepEqual(
    timeline.phases.map(({ phase, duration }) => [phase, Number(duration.toFixed(2))]),
    [
      [GoalSequencePhase.NATIVE_HIGHLIGHT, 0.46],
      [GoalSequencePhase.GOAL_CARD, 0.5],
      [GoalSequencePhase.SCORE_CARD, 0.38],
      [GoalSequencePhase.REPLAY, 3.05]
    ]
  );
});

test("measured ticks transition to replay only after announcement phases finish", () => {
  const timeline = createGoalSequenceTimeline();
  const sequence = createGoalSequence({ team: 0, nextTeam: 1, timeline });
  const beforeReplay = advanceGoalSequence(sequence, 1.339);
  assert.equal(sequence.phase, GoalSequencePhase.SCORE_CARD);
  assert.equal(beforeReplay.complete, false);

  const replayEdge = advanceGoalSequence(sequence, 0.001);
  assert.equal(sequence.phase, GoalSequencePhase.REPLAY);
  assert.ok(replayEdge.actions.some((action) => (
    action.type === "transition" && action.phase === GoalSequencePhase.REPLAY
  )));
  assert.equal(Number(sequence.elapsed.toFixed(2)), 1.34);
});

test("one large fixed step preserves ordered phase actions and kickoff completion", () => {
  const timeline = createGoalSequenceTimeline(0.2);
  const sequence = createGoalSequence({ team: 0, nextTeam: 1, timeline });
  const result = advanceGoalSequence(sequence, 0.2);
  assert.equal(result.complete, true);
  assert.equal(sequence.phase, GoalSequencePhase.KICKOFF);
  assert.deepEqual(
    result.actions.filter((action) => action.type === "transition").map((action) => action.phase),
    [
      GoalSequencePhase.GOAL_CARD,
      GoalSequencePhase.SCORE_CARD,
      GoalSequencePhase.REPLAY,
      GoalSequencePhase.KICKOFF
    ]
  );
  assert.equal(Number(sequence.elapsed.toFixed(3)), 0.2);
  assert.equal(Number(sequence.timer.toFixed(3)), 0);
});

test("custom total duration scales all phases while retaining replay proportion", () => {
  const timeline = createGoalSequenceTimeline(DEFAULT_GOAL_SEQUENCE_DURATION * 2);
  assert.equal(Number(timeline.replayDuration.toFixed(2)), 6.1);
  assert.equal(Number(timeline.phases[0].duration.toFixed(2)), 0.92);
});
