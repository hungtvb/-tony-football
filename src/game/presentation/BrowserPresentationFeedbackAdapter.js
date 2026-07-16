import { GameEventType } from "../engine/GameEvents.js";
import { subscribeToGameEvents } from "./BrowserGameEventBridge.js";

const noop = () => {};

export function createBrowserPresentationFeedbackAdapter({
  target,
  onKick = noop,
  onWhistle = noop,
  onGoal = noop,
  onParticles = noop,
  onContextParticles = noop
}) {
  const unsubscribe = subscribeToGameEvents(target, (event) => {
    const payload = event.payload ?? {};
    if (event.type === GameEventType.BALL_KICKED) {
      onKick(payload.audioPower ?? 0.55);
      onParticles(payload);
      if (payload.contextEnergy !== undefined) onContextParticles(payload);
    } else if (event.type === GameEventType.TACKLE_RESOLVED) {
      onContextParticles(payload);
      if (payload.success) onKick(payload.audioPower ?? 0.3);
    } else if (event.type === GameEventType.SCORE_CHANGED) {
      onGoal(payload);
      onParticles(payload);
    } else if (event.type === GameEventType.MATCH_STARTED || event.type === GameEventType.MATCH_RESTARTED) {
      onWhistle(false);
    } else if (event.type === GameEventType.MATCH_ENDED) {
      onWhistle(true);
    }
  });

  return Object.freeze({ unsubscribe });
}
