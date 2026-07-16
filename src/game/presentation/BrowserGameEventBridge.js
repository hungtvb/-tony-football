import { createGameEvent } from "../engine/GameEvents.js";

export const BROWSER_GAME_EVENT = "tony:game-event";

function assertEventTarget(target) {
  if (
    !target
    || typeof target.addEventListener !== "function"
    || typeof target.removeEventListener !== "function"
    || typeof target.dispatchEvent !== "function"
  ) throw new TypeError("Browser game-event bridge requires an event target");
}

function createBrowserEvent(type, detail) {
  return new CustomEvent(type, { detail });
}

export function publishGameEvent(target, event, { eventFactory = createBrowserEvent } = {}) {
  assertEventTarget(target);
  const immutableEvent = createGameEvent(event?.type, event?.payload, {
    tick: event?.tick,
    sequence: event?.sequence
  });
  target.dispatchEvent(eventFactory(BROWSER_GAME_EVENT, immutableEvent));
  return immutableEvent;
}

export function subscribeToGameEvents(target, listener) {
  assertEventTarget(target);
  if (typeof listener !== "function") throw new TypeError("game-event listener must be a function");
  const handler = (browserEvent) => listener(browserEvent.detail);
  target.addEventListener(BROWSER_GAME_EVENT, handler);
  return () => target.removeEventListener(BROWSER_GAME_EVENT, handler);
}
