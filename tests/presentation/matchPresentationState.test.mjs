import assert from "node:assert/strict";
import test from "node:test";

import {
  MATCH_PRESENTATION_STATES,
  createMatchPresentationState,
} from "../../src/game/state/MatchPresentationState.js";

test("match presentation follows the guarded intro sequence", () => {
  const changes = [];
  const presentation = createMatchPresentationState({
    onChange: ({ previous, current }) => changes.push(`${previous}->${current}`),
  });

  assert.equal(presentation.state, MATCH_PRESENTATION_STATES.IDLE);
  presentation.transition(MATCH_PRESENTATION_STATES.VERSUS);
  presentation.transition(MATCH_PRESENTATION_STATES.COUNTDOWN);
  presentation.transition(MATCH_PRESENTATION_STATES.KICKOFF);
  presentation.transition(MATCH_PRESENTATION_STATES.COMPLETE);
  presentation.reset();

  assert.deepEqual(changes, [
    "idle->versus",
    "versus->countdown",
    "countdown->kickoff",
    "kickoff->complete",
    "complete->idle",
  ]);
});

test("match presentation rejects an invalid state jump", () => {
  const presentation = createMatchPresentationState();
  assert.equal(presentation.canTransition(MATCH_PRESENTATION_STATES.KICKOFF), false);
  assert.throws(
    () => presentation.transition(MATCH_PRESENTATION_STATES.KICKOFF),
    /Invalid match presentation transition: idle -> kickoff/,
  );
});

test("an active intro can safely reset to idle", () => {
  const presentation = createMatchPresentationState();
  presentation.transition(MATCH_PRESENTATION_STATES.VERSUS);
  presentation.reset({ reason: "cancelled" });
  assert.equal(presentation.state, MATCH_PRESENTATION_STATES.IDLE);
});
