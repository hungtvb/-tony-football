export const MATCH_PRESENTATION_STATES = Object.freeze({
  IDLE: "idle",
  VERSUS: "versus",
  COUNTDOWN: "countdown",
  KICKOFF: "kickoff",
  COMPLETE: "complete",
});

const TRANSITIONS = Object.freeze({
  [MATCH_PRESENTATION_STATES.IDLE]: new Set([MATCH_PRESENTATION_STATES.VERSUS]),
  [MATCH_PRESENTATION_STATES.VERSUS]: new Set([
    MATCH_PRESENTATION_STATES.COUNTDOWN,
    MATCH_PRESENTATION_STATES.IDLE,
  ]),
  [MATCH_PRESENTATION_STATES.COUNTDOWN]: new Set([
    MATCH_PRESENTATION_STATES.KICKOFF,
    MATCH_PRESENTATION_STATES.IDLE,
  ]),
  [MATCH_PRESENTATION_STATES.KICKOFF]: new Set([
    MATCH_PRESENTATION_STATES.COMPLETE,
    MATCH_PRESENTATION_STATES.IDLE,
  ]),
  [MATCH_PRESENTATION_STATES.COMPLETE]: new Set([MATCH_PRESENTATION_STATES.IDLE]),
});

export function createMatchPresentationState({ onChange = () => {} } = {}) {
  let current = MATCH_PRESENTATION_STATES.IDLE;

  function canTransition(next) {
    return TRANSITIONS[current]?.has(next) ?? false;
  }

  function transition(next, payload = {}) {
    if (!canTransition(next)) {
      throw new Error(`Invalid match presentation transition: ${current} -> ${next}`);
    }

    const previous = current;
    current = next;
    onChange({ previous, current, payload });
    return current;
  }

  function reset(payload = {}) {
    if (current === MATCH_PRESENTATION_STATES.IDLE) return current;
    return transition(MATCH_PRESENTATION_STATES.IDLE, payload);
  }

  return {
    get state() {
      return current;
    },
    canTransition,
    transition,
    reset,
  };
}
