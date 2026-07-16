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
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizeCompatibilityKickPayload(payload) {
  if (!Number.isFinite(payload.power) || payload.power <= 1) return payload;

  const speed = Number.isFinite(payload.speed) ? payload.speed : payload.power;
  const power = clamp((speed - 400) / 650, 0, 1);

  return {
    ...payload,
    power,
    speed,
    style: payload.style ?? payload.kind ?? null
  };
}

export function normalizeGameEventPayload(type, payload) {
  if (type === GameEventType.BALL_KICKED) {
    return normalizeCompatibilityKickPayload(payload);
  }
  return payload;
}

export function createGameEvent(type, payload = {}, { tick = 0, sequence = 0 } = {}) {
  if (!eventTypes.has(type)) throw new TypeError(`Unknown game event type: ${type}`);
  assertPlainRecord(payload, "event payload");
  assertNonNegativeInteger(tick, "event tick");
  assertNonNegativeInteger(sequence, "event sequence");

  const normalizedPayload = normalizeGameEventPayload(type, payload);
  return Object.freeze({
    type,
    payload: cloneAndFreezeContractValue(normalizedPayload, "event payload"),
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
