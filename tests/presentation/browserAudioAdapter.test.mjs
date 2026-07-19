import assert from "node:assert/strict";
import test from "node:test";
import { GameEventType, createGameEvent } from "../../src/game/engine/GameEvents.js";
import { BROWSER_GAME_EVENT } from "../../src/game/presentation/BrowserGameEventBridge.js";
import { createBrowserAudioAdapter } from "../../src/game/presentation/BrowserAudioAdapter.js";
import { createBrowserPresentationFeedbackAdapter } from "../../src/game/presentation/BrowserPresentationFeedbackAdapter.js";

class DetailEvent extends Event { constructor(type, detail) { super(type); this.detail = detail; } }
function publish(target, type, payload = {}, sequence = 0) { target.dispatchEvent(new DetailEvent(BROWSER_GAME_EVENT, createGameEvent(type, payload, { tick: 1, sequence }))); }
function createFakeAudioContext({ throwOscillator = false } = {}) {
  const tones = [];
  const context = { currentTime: 10, destination: {}, closed: false, resume() { return Promise.resolve(); }, close() { this.closed = true; }, createOscillator() { if (throwOscillator) throw new Error("oscillator failed"); const tone = { type: "", frequency: { value: 0 } }; tones.push(tone); return { set type(value) { tone.type = value; }, get type() { return tone.type; }, frequency: tone.frequency, connect(node) { return node; }, start() {}, stop() {} }; }, createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return context.destination; } }; } };
  return { context, tones };
}

test("presentation feedback delegates successful browser event audio", () => {
  const target = new EventTarget(); const { context, tones } = createFakeAudioContext(); const legacy = [];
  const feedback = createBrowserPresentationFeedbackAdapter({ target, createAudioContext: () => context, nowSeconds: () => 1, onKick: () => legacy.push("kick") });
  publish(target, GameEventType.BALL_KICKED, { power: 0.8, x: 10, y: 20 });
  assert.deepEqual(legacy, []); assert.equal(tones.length, 1); feedback.unsubscribe(); assert.equal(context.closed, true);
});

test("null or throwing context factories release ownership and preserve same-event legacy fallback", () => {
  for (const createAudioContext of [() => null, () => { throw new Error("context failed"); }]) {
    const target = new EventTarget(); const calls = [];
    const feedback = createBrowserPresentationFeedbackAdapter({ target, createAudioContext, nowSeconds: () => 1, onKick: () => calls.push("kick") });
    publish(target, GameEventType.BALL_KICKED, { power: 0.8, x: 10, y: 20 });
    assert.deepEqual(calls, ["kick"]);
    const replacement = createBrowserAudioAdapter({ target, createAudioContext: () => createFakeAudioContext().context, nowSeconds: () => 3 });
    assert.equal(replacement.attach(), true);
    replacement.teardown(); feedback.unsubscribe();
  }
});

test("audio-node failure releases ownership and preserves legacy fallback", () => {
  const target = new EventTarget(); const calls = []; const { context } = createFakeAudioContext({ throwOscillator: true });
  const feedback = createBrowserPresentationFeedbackAdapter({ target, createAudioContext: () => context, nowSeconds: () => 1, onWhistle: () => calls.push("whistle") });
  publish(target, GameEventType.MATCH_STARTED);
  assert.deepEqual(calls, ["whistle"]); assert.equal(context.closed, true);
  const replacement = createBrowserAudioAdapter({ target, createAudioContext: () => createFakeAudioContext().context, nowSeconds: () => 3 });
  assert.equal(replacement.attach(), true); replacement.teardown(); feedback.unsubscribe();
});

test("feedback construction rolls back audio ownership when the second subscription fails", () => {
  class FailSecondSubscriptionTarget extends EventTarget { count = 0; addEventListener(...args) { this.count += 1; if (this.count === 2) throw new Error("feedback subscribe failed"); return super.addEventListener(...args); } }
  const target = new FailSecondSubscriptionTarget(); const { context } = createFakeAudioContext();
  assert.throws(() => createBrowserPresentationFeedbackAdapter({ target, createAudioContext: () => context }), /feedback subscribe failed/);
  const replacement = createBrowserAudioAdapter({ target, createAudioContext: () => createFakeAudioContext().context });
  assert.equal(replacement.attach(), true); replacement.teardown();
});

test("browser audio adapter rejects duplicate working ownership and releases it on teardown", () => {
  const target = new EventTarget();
  const first = createBrowserAudioAdapter({ target, createAudioContext: () => createFakeAudioContext().context, nowSeconds: () => 1 });
  const second = createBrowserAudioAdapter({ target, createAudioContext: () => createFakeAudioContext().context, nowSeconds: () => 1 });
  assert.equal(first.attach(), true); assert.throws(() => second.attach(), /already owned/); assert.equal(first.teardown(), true); assert.equal(second.attach(), true); second.teardown();
});

test("mute predicate suppresses both Web Audio and legacy fallback without disabling ownership", () => {
  const target = new EventTarget(); const { context, tones } = createFakeAudioContext(); const legacy = [];
  const feedback = createBrowserPresentationFeedbackAdapter({ target, createAudioContext: () => context, nowSeconds: () => 1, isAudioEnabled: () => false, onWhistle: () => legacy.push("whistle") });
  publish(target, GameEventType.MATCH_STARTED);
  assert.equal(tones.length, 0); assert.deepEqual(legacy, []); feedback.unsubscribe();
});
