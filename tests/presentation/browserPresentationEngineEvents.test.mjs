import assert from "node:assert/strict";
import test from "node:test";

import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";
import { publishGameEvent } from "../../src/game/presentation/BrowserGameEventBridge.js";
import { createBrowserPresentationFeedbackAdapter } from "../../src/game/presentation/BrowserPresentationFeedbackAdapter.js";

class FakeEventTarget {
  listeners = new Map();
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== listener)); }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) ?? []) listener(event); return true; }
}

const formations = {
  home: [
    { x: 90, y: 350, role: "GK", name: "HOME GK", number: 1, rating: 80 },
    { x: 600, y: 350, role: "FW", name: "HOME FW", number: 7, rating: 99 }
  ],
  away: [
    { x: 1110, y: 350, role: "GK", name: "AWAY GK", number: 1, rating: 80 },
    { x: 618, y: 350, role: "FW", name: "AWAY FW", number: 9, rating: 1 }
  ]
};

function createStartedEngine(randomSeed) {
  const engine = new MatchEngine({ formations, kickoffDelay: 0, randomSeed });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
  engine.step(1 / 60);
  engine.drainEvents();
  return engine;
}

function publishEvents(target, events) {
  for (const event of events) {
    publishGameEvent(target, event, {
      eventFactory: (eventType, detail) => ({ type: eventType, detail })
    });
  }
}

function assertFinitePoint(payload) {
  assert.equal(Number.isFinite(payload.x), true);
  assert.equal(Number.isFinite(payload.y), true);
}

test("browser feedback derives safe presentation payloads from MatchEngine events and snapshots", () => {
  const target = new FakeEventTarget();
  const calls = [];
  let activeEngine = null;
  createBrowserPresentationFeedbackAdapter({
    target,
    getSnapshot: () => activeEngine?.snapshot ?? null,
    onKick: (power) => calls.push(["kick", power]),
    onGoal: (payload) => calls.push(["goal", payload]),
    onParticles: (payload) => calls.push(["particles", payload]),
    onContextParticles: (payload) => calls.push(["context", payload])
  });

  activeEngine = createStartedEngine("feedback-kick");
  activeEngine.setPossession("home-1", { reason: "feedback-test" });
  activeEngine.drainEvents();
  activeEngine.enqueue(GameCommandType.SHOOT, {
    power: 0.8,
    direction: { x: 1, y: 0 }
  }, { source: GameCommandSource.TEST });
  activeEngine.step(1 / 60);
  const kickEvents = activeEngine.drainEvents();
  assert.ok(kickEvents.some((event) => event.type === GameEventType.BALL_KICKED));
  publishEvents(target, kickEvents);

  activeEngine = createStartedEngine("feedback-tackle");
  activeEngine.setPossession("away-1", { reason: "feedback-test" });
  activeEngine.drainEvents();
  activeEngine.enqueue(GameCommandType.TACKLE, {}, { source: GameCommandSource.TEST });
  activeEngine.step(1 / 60);
  const tackleEvents = activeEngine.drainEvents();
  assert.ok(tackleEvents.some((event) => event.type === GameEventType.TACKLE_RESOLVED));
  publishEvents(target, tackleEvents);

  activeEngine = createStartedEngine("feedback-score");
  activeEngine.recordGoal(0, { scorerId: "home-1" });
  activeEngine.step(1 / 60);
  const scoreEvents = activeEngine.drainEvents();
  assert.ok(scoreEvents.some((event) => event.type === GameEventType.SCORE_CHANGED));
  publishEvents(target, scoreEvents);

  const particlePayloads = calls.filter(([type]) => type === "particles").map(([, payload]) => payload);
  const contextPayloads = calls.filter(([type]) => type === "context").map(([, payload]) => payload);
  assert.ok(particlePayloads.length >= 2);
  assert.ok(contextPayloads.length >= 2);
  particlePayloads.forEach(assertFinitePoint);
  contextPayloads.forEach(assertFinitePoint);
  assert.ok(calls.some(([type, power]) => type === "kick" && power > 0));
  assert.ok(calls.some(([type, payload]) => type === "goal" && payload.scorerId === "home-1"));
});
