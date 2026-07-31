import assert from "node:assert/strict";
import test from "node:test";
import {
  createBallMotionPresentationState,
  resetBallMotionPresentationState,
  stepBallMotionPresentation,
} from "../../src/game/presentation/BallMotionPresentation.js";

function ball(overrides = {}) {
  return Object.freeze({ vx: 0, vy: 0, vz: 0, height: 0, angle: 0, ...overrides });
}

test("grounded stationary ball remains round with a readable contact shadow", () => {
  const state = createBallMotionPresentationState();
  const result = stepBallMotionPresentation({ state, ball: ball() });
  assert.equal(result.speed, 0);
  assert.equal(result.squash, 0);
  assert.equal(result.meshScaleX, 1);
  assert.equal(result.meshScaleY, 1);
  assert.equal(result.shadowOpacity, .34);
  assert.equal(result.shadowScale, 1);
});

test("airborne ball receives a softer wider shadow without changing trajectory", () => {
  const state = createBallMotionPresentationState();
  const snapshot = ball({ vx: 420, vy: 120, vz: 8, height: 3.2, angle: 1.4 });
  const result = stepBallMotionPresentation({ state, ball: snapshot });
  assert.ok(result.shadowOpacity < .25);
  assert.ok(result.shadowScale > 1.4);
  assert.equal(snapshot.height, 3.2);
  assert.equal(snapshot.vz, 8);
});

test("downward-to-upward transition produces bounded bounce squash", () => {
  const state = createBallMotionPresentationState({ vz: -12 });
  const result = stepBallMotionPresentation({ state, ball: ball({ vz: 4.08, height: 0 }) });
  assert.equal(result.bounced, true);
  assert.ok(result.impactPulse > .7);
  assert.ok(result.squash > .07);
  assert.ok(result.meshScaleY >= .895);
  assert.ok(result.meshScaleX <= 1.055);
});

test("launch from rest is not mistaken for a bounce", () => {
  const state = createBallMotionPresentationState({ vz: 0 });
  const result = stepBallMotionPresentation({ state, ball: ball({ vz: 11, height: 0 }) });
  assert.equal(result.bounced, false);
  assert.equal(result.impactPulse, 0);
  assert.equal(result.squash, 0);
});

test("impact pulse decays and returns to a round ball", () => {
  const state = createBallMotionPresentationState({ vz: -10 });
  stepBallMotionPresentation({ state, ball: ball({ vz: 3.4, height: 0 }) });
  let result;
  for (let index = 0; index < 90; index += 1) {
    result = stepBallMotionPresentation({ state, ball: ball({ vz: 0, height: 0 }), dt: 1 / 60 });
  }
  assert.equal(result.impactPulse, 0);
  assert.equal(result.meshScaleY, 1);
});

test("rolling axis follows travel direction", () => {
  const state = createBallMotionPresentationState();
  const forward = stepBallMotionPresentation({ state, ball: ball({ vy: 220, angle: 2 }) });
  const sideways = stepBallMotionPresentation({ state, ball: ball({ vx: 220, angle: 2 }) });
  assert.ok(Math.abs(forward.rollX) > 1.9);
  assert.ok(Math.abs(forward.rollZ) < 1e-6);
  assert.ok(Math.abs(sideways.rollX) < 1e-6);
  assert.ok(Math.abs(sideways.rollZ) > 1.9);
});

test("invalid render facts fail safe without NaN output", () => {
  const state = createBallMotionPresentationState({ vz: Number.NaN });
  const result = stepBallMotionPresentation({
    state,
    ball: ball({ vx: Number.NaN, vy: Infinity, vz: Number.NaN, height: Number.NaN, angle: Number.NaN }),
    dt: Number.NaN,
  });
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "number") assert.equal(Number.isFinite(value), true, key);
  }
});

test("reset clears impact history", () => {
  const state = createBallMotionPresentationState({ vz: -8 });
  stepBallMotionPresentation({ state, ball: ball({ vz: 3, height: 0 }) });
  resetBallMotionPresentationState(state);
  assert.deepEqual(state, { previousVz: 0, impactPulse: 0 });
});
