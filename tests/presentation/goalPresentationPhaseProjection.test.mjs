import assert from "node:assert/strict";
import test from "node:test";

import { GoalSequencePhase } from "../../src/game/engine/GoalSequenceTimeline.js";
import { projectGoalPresentationPhase } from "../../src/game/presentation/GoalPresentationPhaseProjection.js";

test("synthetic authoritative goal phases drive visibility without owning lifecycle timing", () => {
  const projections = [
    GoalSequencePhase.NATIVE_HIGHLIGHT,
    GoalSequencePhase.GOAL_CARD,
    GoalSequencePhase.SCORE_CARD,
    GoalSequencePhase.REPLAY,
    GoalSequencePhase.KICKOFF
  ].map(projectGoalPresentationPhase);

  assert.deepEqual(projections.map((entry) => entry.state), [
    "hidden", "goal", "score", "replay", "complete"
  ]);
  assert.deepEqual(projections.map((entry) => entry.visible), [
    false, true, true, false, false
  ]);
  assert.equal(projections[3].label, "INSTANT REPLAY");
});
