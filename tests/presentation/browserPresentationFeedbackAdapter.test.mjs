import assert from "node:assert/strict";
import test from "node:test";

import { createGameEvent, GameEventType } from "../../src/game/engine/GameEvents.js";
import { publishGameEvent } from "../../src/game/presentation/BrowserGameEventBridge.js";
import { createBrowserPresentationFeedbackAdapter } from "../../src/game/presentation/BrowserPresentationFeedbackAdapter.js";

class FakeEventTarget {
  listeners = new Map();
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== listener)); }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) ?? []) listener(event); return true; }
}

function publish(target, type, payload = {}) {
  return publishGameEvent(target, createGameEvent(type, payload), {
    eventFactory: (eventType, detail) => ({ type: eventType, detail })
  });
}

test("browser feedback projects kick, tackle, score, and lifecycle events", () => {
  const target = new FakeEventTarget();
  const calls = [];
  const adapter = createBrowserPresentationFeedbackAdapter({
    target,
    onKick: (power) => calls.push(["kick", power]),
    onWhistle: (long) => calls.push(["whistle", long]),
    onGoal: (payload) => calls.push(["goal", payload.team]),
    onParticles: (payload) => calls.push(["particles", payload.particleCount]),
    onContextParticles: (payload) => calls.push(["context", payload.contextEnergy])
  });

  publish(target, GameEventType.MATCH_STARTED);
  publish(target, GameEventType.BALL_KICKED, { audioPower: 0.9, particleCount: 9, contextEnergy: 1.4, x: 700, y: 350 });
  publish(target, GameEventType.TACKLE_RESOLVED, { success: true, audioPower: 0.3, contextEnergy: 0.8, x: 500, y: 350 });
  publish(target, GameEventType.SCORE_CHANGED, { team: 0, particleCount: 80, x: 1152, y: 350 });
  publish(target, GameEventType.MATCH_ENDED);

  assert.deepEqual(calls, [
    ["whistle", false],
    ["kick", 0.9], ["particles", 9], ["context", 1.4],
    ["context", 0.8], ["kick", 0.3],
    ["goal", 0], ["particles", 80],
    ["whistle", true]
  ]);

  adapter.unsubscribe();
  publish(target, GameEventType.MATCH_RESTARTED);
  assert.equal(calls.length, 9);
});

test("failed tackles keep contextual feedback without playing a kick", () => {
  const target = new FakeEventTarget();
  const calls = [];
  createBrowserPresentationFeedbackAdapter({
    target,
    onKick: () => calls.push("kick"),
    onContextParticles: () => calls.push("context")
  });

  publish(target, GameEventType.TACKLE_RESOLVED, { success: false, contextEnergy: 0.8, x: 500, y: 350 });
  assert.deepEqual(calls, ["context"]);
});
