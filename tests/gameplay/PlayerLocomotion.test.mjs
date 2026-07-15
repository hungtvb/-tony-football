import assert from "node:assert/strict";
import test from "node:test";

import { locomotionConfig } from "../../src/game/config/locomotionConfig.js";
import {
  dampVelocity,
  chooseTurnResponse,
  normalizeMovementInput,
  stepFacing,
  stepStamina,
  stepTowardTarget,
  stepVelocity,
} from "../../src/game/gameplay/PlayerLocomotion.js";

const controlled = locomotionConfig.controlled;
const ai = locomotionConfig.ai;

test("diagonal movement input is normalized", () => {
  const input = normalizeMovementInput(1, 1);
  assert.ok(Math.abs(Math.hypot(input.x, input.y) - 1) < 1e-9);
  assert.equal(input.magnitude, 1);
});

test("acceleration is fixed-step stable across equivalent elapsed time", () => {
  let sixty = { vx: 0, vy: 0 };
  for (let i = 0; i < 60; i += 1) {
    sixty = stepVelocity({ ...sixty, desiredX: 1, desiredY: 0, targetSpeed: 205, dt: 1 / 60, response: 12 });
  }

  let thirty = { vx: 0, vy: 0 };
  for (let i = 0; i < 30; i += 1) {
    thirty = stepVelocity({ ...thirty, desiredX: 1, desiredY: 0, targetSpeed: 205, dt: 1 / 30, response: 12 });
  }

  assert.ok(Math.abs(sixty.vx - thirty.vx) < 1e-8);
  assert.ok(Math.abs(sixty.vy - thirty.vy) < 1e-8);
});

test("full reversal uses slower response and reduced turn grip", () => {
  const reversal = chooseTurnResponse({ currentX: 1, currentY: 0, desiredX: -1, desiredY: 0, config: controlled });
  assert.equal(reversal.response, controlled.reversalResponse);
  assert.equal(reversal.turnGrip, controlled.turnGripBase);
});

test("stop damping reduces velocity without flipping direction", () => {
  const result = dampVelocity({ vx: 120, vy: -80, dt: 1 / 60, damping: controlled.stopDamping });
  assert.ok(result.vx > 0 && result.vx < 120);
  assert.ok(result.vy < 0 && result.vy > -80);
});

test("facing remains normalized while turning", () => {
  const facing = stepFacing({ dirX: 1, dirY: 0, targetX: 0, targetY: 1, dt: 1 / 60, response: controlled.facingResponse });
  assert.ok(Math.abs(Math.hypot(facing.dirX, facing.dirY) - 1) < 1e-9);
  assert.ok(facing.dirX > 0);
  assert.ok(facing.dirY > 0);
});

test("sprint drains stamina faster than normal movement and idle recovers", () => {
  const sprint = stepStamina({ stamina: 100, moving: true, sprinting: true, precision: false, magnitude: 1, dt: 1, config: controlled });
  const normal = stepStamina({ stamina: 100, moving: true, sprinting: false, precision: false, magnitude: 1, dt: 1, config: controlled });
  const recovery = stepStamina({ stamina: 50, moving: false, sprinting: false, precision: false, magnitude: 0, dt: 1, config: controlled });
  assert.ok(sprint < normal);
  assert.ok(recovery > 50);
});

test("AI target locomotion preserves fixed-step arrival behavior", () => {
  let state = { x: 0, y: 0, vx: 0, vy: 0, dirX: 1, dirY: 0 };
  for (let i = 0; i < 60; i += 1) {
    const next = stepTowardTarget({ ...state, targetX: 120, targetY: 0, speed: 168, dt: 1 / 60, config: ai });
    state = { ...state, vx: next.vx, vy: next.vy, dirX: next.dirX, dirY: next.dirY };
    state.x += state.vx / 60;
    state.y += state.vy / 60;
  }
  assert.ok(state.x > 90);
  assert.ok(state.x < 150);
  assert.ok(state.dirX > 0.99);
});

test("AI target locomotion damps velocity inside arrival radius", () => {
  const far = stepTowardTarget({ x: 0, y: 0, vx: 80, vy: 0, dirX: 1, dirY: 0, targetX: 100, targetY: 0, speed: 168, dt: 1 / 60, config: ai });
  const near = stepTowardTarget({ x: 96, y: 0, vx: 80, vy: 0, dirX: 1, dirY: 0, targetX: 100, targetY: 0, speed: 168, dt: 1 / 60, config: ai });
  assert.ok(near.vx < far.vx);
  assert.ok(Math.abs(Math.hypot(near.dirX, near.dirY) - 1) < 1e-9);
});
