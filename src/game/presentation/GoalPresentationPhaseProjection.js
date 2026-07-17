import { GoalSequencePhase } from "../engine/GoalSequenceTimeline.js";

const phaseProjection = Object.freeze({
  [GoalSequencePhase.NATIVE_HIGHLIGHT]: Object.freeze({
    visible: false,
    state: "hidden",
    label: "GOAL CONFIRMED",
    timelinePhase: GoalSequencePhase.NATIVE_HIGHLIGHT
  }),
  [GoalSequencePhase.GOAL_CARD]: Object.freeze({
    visible: true,
    state: "goal",
    label: "GOAL MOMENT",
    timelinePhase: GoalSequencePhase.GOAL_CARD
  }),
  [GoalSequencePhase.SCORE_CARD]: Object.freeze({
    visible: true,
    state: "score",
    label: "SCORE UPDATE",
    timelinePhase: GoalSequencePhase.SCORE_CARD
  }),
  [GoalSequencePhase.REPLAY]: Object.freeze({
    visible: false,
    state: "replay",
    label: "INSTANT REPLAY",
    timelinePhase: GoalSequencePhase.REPLAY
  }),
  [GoalSequencePhase.KICKOFF]: Object.freeze({
    visible: false,
    state: "complete",
    label: "RETURNING TO KICK OFF",
    timelinePhase: GoalSequencePhase.KICKOFF
  })
});

export function projectGoalPresentationPhase(phase) {
  return phaseProjection[phase] ?? null;
}
