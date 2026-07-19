import { GameEventType } from "../engine/GameEvents.js";
import { createBrowserAudioAdapter } from "./BrowserAudioAdapter.js";
import { subscribeToGameEvents } from "./BrowserGameEventBridge.js";
import { isPresentationAudioClaimed } from "./PresentationAudioOwnership.js";
import { projectPresentationFeedback } from "./PresentationFeedbackProjection.js";

const noop = () => {};

function defaultAudioEnabled(target) {
  return !target?.document?.getElementById?.("soundButton")?.classList?.contains?.("muted");
}

export function createBrowserPresentationFeedbackAdapter({
  target,
  getSnapshot = () => null,
  onKick = noop,
  onWhistle = noop,
  onGoal = noop,
  onParticles = noop,
  onContextParticles = noop,
  createAudioContext = null,
  nowSeconds,
  isAudioEnabled = () => defaultAudioEnabled(target),
}) {
  const audioAdapter = createBrowserAudioAdapter({
    target,
    createAudioContext,
    ...(nowSeconds ? { nowSeconds } : {}),
    isEnabled: isAudioEnabled,
  });
  audioAdapter.attach();

  const unsubscribeFeedback = subscribeToGameEvents(target, (event) => {
    const feedback = projectPresentationFeedback(event, getSnapshot());
    const audioOwned = isPresentationAudioClaimed(target);
    if (event.type === GameEventType.BALL_KICKED) {
      if (!audioOwned) onKick(feedback.audioPower);
      if (feedback.particles) onParticles(feedback.particles);
      if (feedback.contextParticles) onContextParticles(feedback.contextParticles);
    } else if (event.type === GameEventType.TACKLE_RESOLVED) {
      if (feedback.contextParticles) onContextParticles(feedback.contextParticles);
      if (!audioOwned && feedback.won) onKick(feedback.audioPower);
    } else if (event.type === GameEventType.SCORE_CHANGED) {
      if (!audioOwned) onGoal(feedback.goal);
      if (feedback.particles) onParticles(feedback.particles);
    } else if (event.type === GameEventType.MATCH_STARTED || event.type === GameEventType.MATCH_RESTARTED) {
      if (!audioOwned) onWhistle(false);
    } else if (event.type === GameEventType.MATCH_ENDED) {
      if (!audioOwned) onWhistle(true);
    }
  });

  let subscribed = true;
  return Object.freeze({
    reset() {
      return audioAdapter.reset();
    },
    unsubscribe() {
      if (!subscribed) return false;
      subscribed = false;
      unsubscribeFeedback();
      audioAdapter.teardown();
      return true;
    },
  });
}
