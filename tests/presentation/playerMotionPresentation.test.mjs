import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlayerMotionPresentationState,
  resetPlayerMotionPresentationState,
  stepPlayerMotionPresentation,
} from "../../src/game/presentation/PlayerMotionPresentation.js";

function pose(overrides = {}) {
  return Object.freeze({ vx: 0, vy: 0, sprinting: false, turnLean: 0, ...overrides });
}

test("idle presentation remains neutral and stable", () => {
  const state = createPlayerMotionPresentationState();
  const result = stepPlayerMotionPresentation({ state, pose: pose(), dt: 1 / 60, yaw: 0, animationState: "Idle_Loop" });
  assert.equal(result.speed, 0);
  assert.equal(result.strideRate, 1);
  assert.equal(result.forwardLean, 0);
  assert.equal(result.lateralLean, 0);
  assert.equal(result.compression, 0);
});

test("sprinting builds bounded forward lean and cadence", () => {
  const state = createPlayerMotionPresentationState({ vx: 0, vy: 240 });
  let result;
  for (let index = 0; index < 24; index += 1) {
    result = stepPlayerMotionPresentation({ state, pose: pose({ vy: 285, sprinting: true }), dt: 1 / 60, yaw: 0, animationState: "Sprint_Loop" });
  }
  assert.ok(result.forwardLean > .09);
  assert.ok(result.forwardLean <= .17);
  assert.ok(result.animationTimeScale > 1.15);
  assert.ok(result.animationTimeScale <= 1.42);
});

test("turning applies lateral bank opposite the engine turn direction", () => {
  const state = createPlayerMotionPresentationState({ vx: 0, vy: 180 });
  let result;
  for (let index = 0; index < 18; index += 1) {
    result = stepPlayerMotionPresentation({ state, pose: pose({ vx: 80, vy: 160, turnLean: 1 }), dt: 1 / 60, yaw: 0, animationState: "Jog_Fwd_Loop" });
  }
  assert.ok(result.lateralLean < -.08);
  assert.ok(result.lateralLean >= -.22);
});

test("hard braking creates short bounded compression without reversing root motion", () => {
  const state = createPlayerMotionPresentationState({ vx: 0, vy: 260 });
  stepPlayerMotionPresentation({ state, pose: pose({ vy: 260, sprinting: true }), dt: 1 / 60, yaw: 0, animationState: "Sprint_Loop" });
  const result = stepPlayerMotionPresentation({ state, pose: pose({ vy: 40 }), dt: 1 / 60, yaw: 0, animationState: "Jog_Fwd_Loop" });
  assert.ok(result.forwardAcceleration < 0);
  assert.ok(result.braking > 0);
  assert.ok(result.compression > 0);
  assert.ok(result.compression <= .085);
});

test("invalid heading fails safe without producing NaN transforms", () => {
  const state = createPlayerMotionPresentationState({ vx: 30, vy: 40 });
  const result = stepPlayerMotionPresentation({
    state,
    pose: pose({ vx: 120, vy: 80, turnLean: Number.NaN }),
    dt: 1 / 60,
    yaw: Number.NaN,
    animationState: "Jog_Fwd_Loop",
  });
  for (const value of Object.values(result)) assert.equal(Number.isFinite(value), true);
});

test("reset clears temporal motion history", () => {
  const state = createPlayerMotionPresentationState({ vx: 20, vy: 30 });
  stepPlayerMotionPresentation({ state, pose: pose({ vx: 200, vy: 50, turnLean: -.5 }), dt: 1 / 60, yaw: Math.PI / 2, animationState: "Jog_Fwd_Loop" });
  resetPlayerMotionPresentationState(state);
  assert.deepEqual(state, {
    previousVx: 0,
    previousVy: 0,
    forwardLean: 0,
    lateralLean: 0,
    compression: 0,
    animationTimeScale: 1,
    initialized: false,
  });
});
