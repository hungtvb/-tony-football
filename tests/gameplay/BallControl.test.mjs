import assert from "node:assert/strict";
import test from "node:test";

import { ballControlConfig } from "../../src/game/config/ballControlConfig.js";
import {
  captureEligibility,
  classifyFirstTouch,
  dribbleAnchor,
  firstTouchScore,
  resolveFirstTouch,
} from "../../src/game/gameplay/BallControl.js";

const capture = ballControlConfig.capture;
const firstTouch = ballControlConfig.firstTouch;

const receiver = { vx: 120, vy: 0, dirX: 1, dirY: 0 };

test("locked ball cannot be captured", () => {
  const result = captureEligibility({ distance: 5, ballHeight: 0, ballSpeed: 0, locked: true, playerCooldown: 0, isGoalkeeper: false, isLastTouch: false, config: capture });
  assert.equal(result.eligible, false);
});

test("goalkeeper capture envelope is larger than outfield envelope", () => {
  const outfield = captureEligibility({ distance: 32, ballHeight: 2, ballSpeed: 100, locked: false, playerCooldown: 0, isGoalkeeper: false, isLastTouch: false, config: capture });
  const keeper = captureEligibility({ distance: 32, ballHeight: 2, ballSpeed: 100, locked: false, playerCooldown: 0, isGoalkeeper: true, isLastTouch: false, config: capture });
  assert.equal(outfield.eligible, false);
  assert.equal(keeper.eligible, true);
});

test("last toucher is blocked from immediate high-speed recapture", () => {
  const result = captureEligibility({ distance: 4, ballHeight: 0, ballSpeed: 700, locked: false, playerCooldown: 0, isGoalkeeper: false, isLastTouch: true, config: capture });
  assert.equal(result.blockedByLastTouch, true);
  assert.equal(result.eligible, false);
});

test("precision input improves first-touch score while sprinting reduces it", () => {
  const base = {
    ballSpeed: 420,
    incomingX: -1,
    incomingY: 0,
    facingX: 1,
    facingY: 0,
    ballHeight: 0.2,
    playerSpeed: 120,
    rating: 88,
    config: firstTouch,
    captureConfig: capture,
  };
  const precision = firstTouchScore({ ...base, precision: true, sprinting: false });
  const sprint = firstTouchScore({ ...base, precision: false, sprinting: true });
  assert.ok(precision > sprint);
});

test("first-touch classification preserves ordered outcome thresholds", () => {
  assert.equal(classifyFirstTouch(0.9, firstTouch), "clean");
  assert.equal(classifyFirstTouch(0.6, firstTouch), "cushioned");
  assert.equal(classifyFirstTouch(0.35, firstTouch), "heavy");
  assert.equal(classifyFirstTouch(0.1, firstTouch), "rejected");
});

test("clean and cushioned touches result in control", () => {
  const clean = resolveFirstTouch({ outcome: "clean", ballX: 10, ballY: 20, ballVx: 200, ballVy: 0, receiver });
  const cushioned = resolveFirstTouch({ outcome: "cushioned", ballX: 10, ballY: 20, ballVx: 200, ballVy: 0, receiver });
  assert.equal(clean.controls, true);
  assert.equal(cushioned.controls, true);
  assert.ok(Math.hypot(cushioned.vx, cushioned.vy) < 70);
});

test("heavy touch leaves a recoverable loose ball with recapture lock", () => {
  const result = resolveFirstTouch({ outcome: "heavy", ballX: 10, ballY: 20, ballVx: 500, ballVy: 0, receiver });
  assert.equal(result.controls, false);
  assert.ok(result.lock > 0);
  assert.ok(Math.hypot(result.vx, result.vy) >= 105);
  assert.notEqual(result.x, 10);
});

test("rejected touch preserves loose-ball momentum", () => {
  const result = resolveFirstTouch({ outcome: "rejected", ballX: 10, ballY: 20, ballVx: 700, ballVy: 0, receiver });
  assert.equal(result.controls, false);
  assert.ok(result.vx > 0);
  assert.ok(result.lock > 0);
});

test("sprint dribble anchor leads farther than precision control", () => {
  const owner = { x: 100, y: 200, vx: 180, vy: 0, dirX: 1, dirY: 0, radius: 17, dribbleSide: 1 };
  const precision = dribbleAnchor({ owner, mode: "precision", stepPhase: 0.9, config: ballControlConfig.dribble });
  const sprint = dribbleAnchor({ owner, mode: "sprint", stepPhase: 0.9, config: ballControlConfig.dribble });
  assert.ok(sprint.lead > precision.lead);
  assert.ok(sprint.followRate < precision.followRate);
});
