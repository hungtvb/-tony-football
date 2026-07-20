import assert from "node:assert/strict";
import test from "node:test";

import { BrowserBootstrapComposition } from "../../src/game/application/BrowserBootstrapComposition.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { FO4_CONTROLS } from "../../src/game/input/FO4Controls.js";

function keyboardEvent(type, code) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, { code: { value: code }, repeat: { value: false }, shiftKey: { value: false } });
  return event;
}

test("browser bootstrap publishes frozen charge and pressed-code presentation facts", () => {
  const target = new EventTarget(); const frames = []; const listeners = [];
  const snapshot = createMatchSnapshot({ tick: 1, match: { state: "playing", elapsed: 1, matchSeconds: 150, score: [0, 0], selectedPlayerId: "home-0" }, players: [{ id: "home-0", x: 100, y: 100 }], ball: { id: "match-ball", ownerId: "home-0", x: 100, y: 100 } });
  const runtimeComposition = { authoritative: true, state: "playing", controlMode: "attack", attachTarget() {}, dispatch() { return true; }, reset() {}, teardown() {} };
  const simulationLoop = { start() {}, stop() {}, reset() {}, subscribeAfterRender(listener) { listeners.push(listener); return () => {}; } };
  const presentationComposition = { start() {}, render(frame) { frames.push(frame); }, reset() {}, teardown() {} };
  const composition = new BrowserBootstrapComposition({ target, document: { getElementById: () => null }, runtimeComposition, simulationLoop, snapshotAdapter: { capture: () => snapshot, createRenderFrame: () => Object.freeze({ previous: snapshot, current: snapshot, alpha: 0 }), reset() {} }, presentationComposition });
  composition.start(); target.dispatchEvent(keyboardEvent("keydown", FO4_CONTROLS.shoot)); listeners[0](Object.freeze({ alpha: 0, nowMilliseconds: performance.now() }));
  assert.equal(frames.length, 1); const frame = frames[0]; assert.equal(Object.isFrozen(frame), true); assert.equal(Object.isFrozen(frame.activeCharge), true); assert.equal(Object.isFrozen(frame.pressedCodes), true); assert.equal(frame.activeCharge.code, FO4_CONTROLS.shoot); assert.equal(frame.pressedCodes.includes(FO4_CONTROLS.shoot), true); assert.equal(frame.hasActiveInput, true); composition.teardown();
});
