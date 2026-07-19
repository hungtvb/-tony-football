import { GameEventType } from "../engine/GameEvents.js";
import { createAudioFeedbackController } from "./AudioFeedbackController.js";
import { subscribeToGameEvents } from "./BrowserGameEventBridge.js";
import { claimPresentationAudio } from "./PresentationAudioOwnership.js";
import { projectPresentationFeedback } from "./PresentationFeedbackProjection.js";

const GOAL_NOTES = Object.freeze([392, 523, 659, 784]);

function browserAudioContextFactory(target) {
  const AudioContext = target?.AudioContext ?? target?.webkitAudioContext;
  return typeof AudioContext === "function" ? new AudioContext() : null;
}

function browserAudioSupported(target) {
  return typeof (target?.AudioContext ?? target?.webkitAudioContext) === "function";
}

export function createBrowserAudioAdapter({
  target,
  createAudioContext = null,
  nowSeconds = () => (target?.performance?.now?.() ?? globalThis.performance?.now?.() ?? Date.now()) / 1000,
  isEnabled = () => true,
  controller = createAudioFeedbackController(),
} = {}) {
  if (!target || typeof target.addEventListener !== "function") {
    throw new TypeError("BrowserAudioAdapter requires an event target");
  }
  if (createAudioContext !== null && typeof createAudioContext !== "function") {
    throw new TypeError("createAudioContext must be a function or null");
  }
  if (typeof nowSeconds !== "function" || typeof isEnabled !== "function") {
    throw new TypeError("BrowserAudioAdapter requires audio lifecycle functions");
  }

  const supported = createAudioContext !== null || browserAudioSupported(target);
  const contextFactory = createAudioContext ?? (() => browserAudioContextFactory(target));
  let audioContext = null;
  let unsubscribe = null;
  let releaseOwnership = null;

  function context() {
    if (audioContext) return audioContext;
    try {
      audioContext = contextFactory() ?? null;
    } catch {
      audioContext = null;
    }
    return audioContext;
  }

  function tone(frequency, duration, type = "sine", volume = 0.04, delay = 0) {
    if (!isEnabled()) return false;
    const audio = context();
    if (!audio) return false;
    const resume = audio.resume?.();
    resume?.catch?.(() => {});
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audio.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(audio.currentTime + delay);
    oscillator.stop(audio.currentTime + delay + duration);
    return true;
  }

  function playKick(power) {
    if (!controller.canPlay("kick", nowSeconds())) return false;
    const profile = controller.kickProfile(power);
    return tone(profile.frequency, profile.duration, "triangle", profile.volume);
  }

  function playWhistle(long = false) {
    if (!controller.canPlay("whistle", nowSeconds())) return false;
    tone(1450, long ? 0.5 : 0.25, "sine", 0.03);
    tone(1750, long ? 0.42 : 0.18, "sine", 0.02, 0.08);
    return true;
  }

  function playGoal() {
    if (!controller.canPlay("goal", nowSeconds())) return false;
    GOAL_NOTES.forEach((note, index) => tone(note, 0.42, "square", 0.025, index * 0.09));
    return true;
  }

  function handleEvent(event) {
    const feedback = projectPresentationFeedback(event);
    if (event.type === GameEventType.BALL_KICKED) playKick(feedback.audioPower);
    else if (event.type === GameEventType.TACKLE_RESOLVED && feedback.won) playKick(feedback.audioPower);
    else if (event.type === GameEventType.SCORE_CHANGED) playGoal();
    else if (event.type === GameEventType.MATCH_STARTED || event.type === GameEventType.MATCH_RESTARTED) playWhistle(false);
    else if (event.type === GameEventType.MATCH_ENDED) playWhistle(true);
  }

  return Object.freeze({
    get supported() {
      return supported;
    },

    attach() {
      if (!supported) return false;
      if (unsubscribe || releaseOwnership) return false;
      releaseOwnership = claimPresentationAudio(target);
      try {
        unsubscribe = subscribeToGameEvents(target, handleEvent);
        return true;
      } catch (error) {
        releaseOwnership();
        releaseOwnership = null;
        throw error;
      }
    },

    reset() {
      controller.reset();
      return true;
    },

    teardown() {
      const wasAttached = Boolean(unsubscribe || releaseOwnership || audioContext);
      unsubscribe?.();
      unsubscribe = null;
      releaseOwnership?.();
      releaseOwnership = null;
      controller.reset();
      audioContext?.close?.();
      audioContext = null;
      return wasAttached;
    },
  });
}
