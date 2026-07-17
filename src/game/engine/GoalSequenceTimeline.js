export const GoalSequencePhase = Object.freeze({
  NATIVE_HIGHLIGHT: "native-highlight",
  GOAL_CARD: "goal-card",
  SCORE_CARD: "score-card",
  REPLAY: "replay",
  KICKOFF: "kickoff"
});

const BASE_PHASES = Object.freeze([
  Object.freeze({ phase: GoalSequencePhase.NATIVE_HIGHLIGHT, duration: 0.46 }),
  Object.freeze({ phase: GoalSequencePhase.GOAL_CARD, duration: 0.5 }),
  Object.freeze({ phase: GoalSequencePhase.SCORE_CARD, duration: 0.38 }),
  Object.freeze({ phase: GoalSequencePhase.REPLAY, duration: 3.05 })
]);

export const DEFAULT_GOAL_SEQUENCE_DURATION = BASE_PHASES.reduce(
  (total, entry) => total + entry.duration,
  0
);

function assertPositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

export function createGoalSequenceTimeline(totalDuration = DEFAULT_GOAL_SEQUENCE_DURATION) {
  assertPositiveFinite(totalDuration, "goal sequence duration");
  const scale = totalDuration / DEFAULT_GOAL_SEQUENCE_DURATION;
  const phases = BASE_PHASES.map((entry) => Object.freeze({
    phase: entry.phase,
    duration: entry.duration * scale
  }));
  return Object.freeze({
    duration: totalDuration,
    phases: Object.freeze(phases),
    replayDuration: phases.find((entry) => entry.phase === GoalSequencePhase.REPLAY).duration
  });
}

export function createGoalSequence({ team, nextTeam, scorerId = null, timeline }) {
  if (!timeline || !Array.isArray(timeline.phases) || timeline.phases.length === 0) {
    throw new TypeError("goal sequence requires a timeline");
  }
  return {
    team,
    nextTeam,
    scorerId,
    phase: timeline.phases[0].phase,
    phaseIndex: 0,
    phaseElapsed: 0,
    elapsed: 0,
    timer: timeline.duration,
    duration: timeline.duration,
    phases: timeline.phases.map((entry) => ({ ...entry }))
  };
}

export function advanceGoalSequence(sequence, deltaSeconds) {
  if (!sequence || !Array.isArray(sequence.phases)) {
    throw new TypeError("goal sequence state is required");
  }
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("goal sequence delta must be a non-negative finite number");
  }

  let remaining = deltaSeconds;
  const actions = [];
  const epsilon = 1e-9;

  while (remaining > epsilon && sequence.phaseIndex < sequence.phases.length) {
    const current = sequence.phases[sequence.phaseIndex];
    const phaseRemaining = Math.max(0, current.duration - sequence.phaseElapsed);
    const consumed = Math.min(remaining, phaseRemaining);

    if (consumed > epsilon) {
      actions.push(Object.freeze({ type: "advance", phase: current.phase, deltaSeconds: consumed }));
      sequence.phaseElapsed += consumed;
      sequence.elapsed += consumed;
      sequence.timer = Math.max(0, sequence.duration - sequence.elapsed);
      remaining -= consumed;
    }

    if (sequence.phaseElapsed + epsilon < current.duration) break;

    const previousPhase = current.phase;
    sequence.phaseIndex += 1;
    sequence.phaseElapsed = 0;
    const next = sequence.phases[sequence.phaseIndex] ?? null;
    sequence.phase = next?.phase ?? GoalSequencePhase.KICKOFF;
    actions.push(Object.freeze({
      type: "transition",
      previousPhase,
      phase: sequence.phase
    }));

    if (!next) {
      sequence.elapsed = sequence.duration;
      sequence.timer = 0;
      break;
    }
  }

  return Object.freeze({
    actions: Object.freeze(actions),
    complete: sequence.phase === GoalSequencePhase.KICKOFF,
    unconsumedDelta: Math.max(0, remaining)
  });
}
