import assert from "node:assert/strict";
import test from "node:test";

import {
  GOAL_PRESENTATION_STATES,
  createGoalPresentationState,
} from "../../src/game/state/GoalPresentationState.js";

test("goal presentation follows goal score replay completion order", () => {
  const changes = [];
  const presentation = createGoalPresentationState({
    onChange: ({ current }) => changes.push(current),
  });

  assert.equal(presentation.state, GOAL_PRESENTATION_STATES.HIDDEN);
  presentation.transition(GOAL_PRESENTATION_STATES.GOAL);
  presentation.transition(GOAL_PRESENTATION_STATES.SCORE);
  presentation.transition(GOAL_PRESENTATION_STATES.REPLAY);
  presentation.transition(GOAL_PRESENTATION_STATES.COMPLETE);
  presentation.transition(GOAL_PRESENTATION_STATES.HIDDEN);

  assert.deepEqual(changes, ["goal", "score", "replay", "complete", "hidden"]);
});

test("goal presentation may complete without replay", () => {
  const presentation = createGoalPresentationState();
  presentation.transition(GOAL_PRESENTATION_STATES.GOAL);
  presentation.transition(GOAL_PRESENTATION_STATES.SCORE);
  assert.equal(presentation.canTransition(GOAL_PRESENTATION_STATES.COMPLETE), true);
  presentation.transition(GOAL_PRESENTATION_STATES.COMPLETE);
  presentation.transition(GOAL_PRESENTATION_STATES.HIDDEN);
  assert.equal(presentation.state, GOAL_PRESENTATION_STATES.HIDDEN);
});

test("goal presentation rejects invalid stage jumps", () => {
  const presentation = createGoalPresentationState();
  assert.throws(
    () => presentation.transition(GOAL_PRESENTATION_STATES.REPLAY),
    /Invalid goal presentation transition/,
  );
});
