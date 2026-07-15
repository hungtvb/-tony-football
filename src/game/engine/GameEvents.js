import {
  assertNonNegativeInteger,
  assertPlainRecord,
  cloneAndFreezeContractValue
} from "./ContractValue.js";

export const GameEventType = Object.freeze({
  MATCH_STARTED: "match:started",
  MATCH_PAUSED: "match:paused",
  MATCH_RESUMED: "match:resumed",
  MATCH_RESTARTED: "match:restarted",
  POSSESSION_CHANGED: "possession:changed",
  BALL_KICKED: "ball:kicked",
  TACKLE_RESOLVED: "player:tackle-resolved",
  TEAMMATE_RUN_TRIGGERED: "team:run-triggered",
  SCORE_CHANGED: "score:changed",
  REPLAY_STARTED: "replay:started",
  REPLAY_ENDED: "replay:ended",
  MATCH_ENDED: "match:ended"
});

const eventTypes = new Set(Object.values(GameEventType));

export function createGameEvent(type, payload = {}, { tick = 0, sequence = 0 } = {}) {
  if (!eventTypes.has(type)) throw new TypeError(`Unknown game event type: ${type}`);
  assertPlainRecord(payload, "event payload");
  assertNonNegativeInteger(tick, "event tick");
  assertNonNegativeInteger(sequence, "event sequence");

  return Object.freeze({
    type,
    payload: cloneAndFreezeContractValue(payload, "event payload"),
    tick,
    sequence
  });
}

export class GameEventQueue {
  #events = [];
  #nextSequence = 0;

  get size() {
    return this.#events.length;
  }

  emit(type, payload = {}, { tick = 0 } = {}) {
    const event = createGameEvent(type, payload, {
      tick,
      sequence: this.#nextSequence
    });
    this.#nextSequence += 1;
    this.#events.push(event);
    return event;
  }

  drain() {
    const drained = Object.freeze(this.#events.slice());
    this.#events.length = 0;
    return drained;
  }

  clear() {
    this.#events.length = 0;
  }
}
