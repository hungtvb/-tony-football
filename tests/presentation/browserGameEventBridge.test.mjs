import assert from "node:assert/strict";
import test from "node:test";

import { createGameEvent, GameEventType } from "../../src/game/engine/GameEvents.js";
import {
  BROWSER_GAME_EVENT,
  publishGameEvent,
  subscribeToGameEvents
} from "../../src/game/presentation/BrowserGameEventBridge.js";

class FakeEventTarget {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    return true;
  }
}

test("browser bridge publishes cloned immutable game events", () => {
  const target = new FakeEventTarget();
  const received = [];
  const unsubscribe = subscribeToGameEvents(target, (event) => received.push(event));
  const source = createGameEvent(GameEventType.SCORE_CHANGED, {
    team: 0,
    score: [1, 0]
  }, { tick: 90, sequence: 4 });

  const published = publishGameEvent(target, source, {
    eventFactory: (type, detail) => ({ type, detail })
  });
  unsubscribe();
  publishGameEvent(target, source, {
    eventFactory: (type, detail) => ({ type, detail })
  });

  assert.equal(BROWSER_GAME_EVENT, "tony:game-event");
  assert.equal(received.length, 1);
  assert.deepEqual(received[0], source);
  assert.notEqual(published, source);
  assert.ok(Object.isFrozen(received[0]));
  assert.ok(Object.isFrozen(received[0].payload.score));
});
