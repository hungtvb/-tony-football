import { GameEventType } from "../engine/GameEvents.js";
import { subscribeToGameEvents } from "./BrowserGameEventBridge.js";
import { projectPresentationFeedback } from "./PresentationFeedbackProjection.js";

const noop = () => {};

export function createBrowserPresentationFeedbackAdapter({
  target,
  getSnapshot = () => null,
  onKick = noop,
  onWhistle = noop,
  onGoal = noop,
  onParticles = noop,
  onContextParticles = noop
}) {
  const unsubscribe = subscribeToGameEvents(target, (event) => {
    const feedback = projectPresentationFeedback(event, getSnapshot());
    if (event.type === GameEventType.BALL_KICKED) {
      onKick(feedback.audioPower);
      onParticles(feedback.particles);
      if (feedback.contextParticles) onContextParticles(feedback.contextParticles);
    } else if (event.type === GameEventType.TACKLE_RESOLVED) {
      onContextParticles(feedback.contextParticles);
      if (feedback.won) onKick(feedback.audioPower);
    } else if (event.type === GameEventType.SCORE_CHANGED) {
      onGoal(feedback.goal);
      onParticles(feedback.particles);
    } else if (event.type === GameEventType.MATCH_STARTED || event.type === GameEventType.MATCH_RESTARTED) {
      onWhistle(false);
    } else if (event.type === GameEventType.MATCH_ENDED) {
      onWhistle(true);
    }
  });

  return Object.freeze({ unsubscribe });
}
