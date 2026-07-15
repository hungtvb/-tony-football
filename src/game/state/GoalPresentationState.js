export const GOAL_PRESENTATION_STATES = Object.freeze({
  HIDDEN: "hidden",
  GOAL: "goal",
  SCORE: "score",
  REPLAY: "replay",
  COMPLETE: "complete",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [GOAL_PRESENTATION_STATES.HIDDEN]: [GOAL_PRESENTATION_STATES.GOAL],
  [GOAL_PRESENTATION_STATES.GOAL]: [GOAL_PRESENTATION_STATES.SCORE],
  [GOAL_PRESENTATION_STATES.SCORE]: [
    GOAL_PRESENTATION_STATES.REPLAY,
    GOAL_PRESENTATION_STATES.COMPLETE,
  ],
  [GOAL_PRESENTATION_STATES.REPLAY]: [GOAL_PRESENTATION_STATES.COMPLETE],
  [GOAL_PRESENTATION_STATES.COMPLETE]: [GOAL_PRESENTATION_STATES.HIDDEN],
});

export function createGoalPresentationState({ onChange = () => {} } = {}) {
  let state = GOAL_PRESENTATION_STATES.HIDDEN;

  function transition(next, context = {}) {
    const allowed = ALLOWED_TRANSITIONS[state] ?? [];
    if (!allowed.includes(next)) {
      throw new Error(`Invalid goal presentation transition: ${state} -> ${next}`);
    }

    const previous = state;
    state = next;
    onChange({ previous, current: state, context });
    return state;
  }

  function reset(context = {}) {
    const previous = state;
    state = GOAL_PRESENTATION_STATES.HIDDEN;
    onChange({ previous, current: state, context: { ...context, reset: true } });
    return state;
  }

  return {
    get state() {
      return state;
    },
    canTransition(next) {
      return (ALLOWED_TRANSITIONS[state] ?? []).includes(next);
    },
    transition,
    reset,
  };
}
